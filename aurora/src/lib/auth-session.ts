/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
/**
 * Dashboard authentication session management.
 *
 * rc.22 replaced the dashboard session cookie with a stateless Bearer access
 * token plus an httpOnly refresh cookie. This module owns:
 *   - restoring a session on app boot from the refresh cookie
 *   - single-flight token refresh (one in-flight refresh at a time)
 *   - clearing local token state on sign-out / refresh failure
 *
 * A dedicated axios instance (no interceptors) is used for the refresh call to
 * avoid recursion with the interceptors in `@/lib/api`.
 */
import axios from 'axios'

import { removeUserId, saveUserId } from '@/features/auth/lib/storage'
import {
  useAuthStore,
  type AuthBundle,
  type LoginSession,
} from '@/stores/auth-store'

export type RefreshOutcome =
  | { kind: 'authenticated'; bundle: AuthBundle }
  | { kind: 'anonymous' }
  | { kind: 'transient_error'; error: unknown }

// Dedicated client for the refresh call. `withCredentials` is required so the
// httpOnly refresh cookie is sent; it carries no interceptors of its own.
const authClient = axios.create({
  baseURL: '',
  withCredentials: true,
  headers: {
    'Cache-Control': 'no-store',
  },
})

let refreshPromise: Promise<RefreshOutcome> | null = null

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function isLoginSession(value: unknown): value is LoginSession {
  if (!isRecord(value)) return false
  return (
    typeof value.sid === 'string' &&
    value.sid.length > 0 &&
    typeof value.current === 'boolean' &&
    typeof value.login_method === 'string' &&
    typeof value.ip === 'string' &&
    typeof value.user_agent === 'string' &&
    typeof value.created_at === 'number' &&
    typeof value.last_active_at === 'number' &&
    typeof value.expires_at === 'number'
  )
}

/**
 * Parse an unknown value into a valid AuthBundle, or return null. The `user`
 * field is optional; only the token fields and session are mandatory.
 */
export function parseAuthBundle(value: unknown): AuthBundle | null {
  if (!isRecord(value)) return null
  const tokenFieldsValid =
    typeof value.access_token === 'string' &&
    value.access_token.length > 0 &&
    typeof value.token_type === 'string' &&
    value.token_type.length > 0 &&
    typeof value.access_expires_at === 'number' &&
    Number.isFinite(value.access_expires_at) &&
    value.access_expires_at > 0
  if (!tokenFieldsValid || !isLoginSession(value.session)) return null
  return value as unknown as AuthBundle
}

/** Store a login/refresh bundle and mirror the user id into legacy storage. */
export function applyAuthBundle(bundle: AuthBundle): void {
  useAuthStore.getState().auth.setBundle(bundle)
  if (bundle.user?.id != null) {
    saveUserId(bundle.user.id)
  }
}

/** Clear all local dashboard auth state (token, session, cached user, uid). */
export function clearAuthentication(): void {
  useAuthStore.getState().auth.reset()
  removeUserId()
}

function nowInSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

async function runRefresh(): Promise<RefreshOutcome> {
  try {
    const response = await authClient.post('/api/user/auth/refresh')
    const data = isRecord(response.data) ? response.data : undefined
    const bundle =
      data?.success === true ? parseAuthBundle(data.data) : null
    if (bundle) {
      applyAuthBundle(bundle)
      return { kind: 'authenticated', bundle }
    }
    // A 2xx without a valid bundle means the server no longer recognises us.
    clearAuthentication()
    return { kind: 'anonymous' }
  } catch (error: unknown) {
    const status = axios.isAxiosError(error)
      ? (error.response?.status ?? 0)
      : 0
    // Network / server hiccups are transient: keep any existing state and let
    // the caller retry later without forcing a sign-out.
    if (!status || status >= 500 || status === 429) {
      useAuthStore.getState().auth.setBootstrapState('idle')
      return { kind: 'transient_error', error }
    }
    // 401 / 4xx: the refresh cookie is missing or invalid -> anonymous.
    clearAuthentication()
    return { kind: 'anonymous' }
  }
}

/**
 * Refresh the access token, coalescing concurrent callers into one request.
 */
export function refreshAuthentication(): Promise<RefreshOutcome> {
  if (!refreshPromise) {
    refreshPromise = runRefresh().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

/**
 * Restore the session on app boot. Returns immediately if a valid in-memory
 * token already exists; otherwise attempts a single refresh from the cookie.
 * Idempotent across navigations via the store's bootstrapState.
 */
export async function bootstrapAuthentication(): Promise<RefreshOutcome> {
  const auth = useAuthStore.getState().auth

  if (
    auth.accessToken &&
    auth.accessExpiresAt &&
    auth.accessExpiresAt > nowInSeconds()
  ) {
    auth.setBootstrapState('complete')
    return { kind: 'authenticated', bundle: currentBundle()! }
  }

  // Already bootstrapped and definitely signed out -> don't hammer the server.
  const hasStaleUser = Boolean(auth.user)
  if (auth.bootstrapState === 'complete' && !hasStaleUser) {
    return { kind: 'anonymous' }
  }

  auth.setBootstrapState('checking')
  return refreshAuthentication()
}

function currentBundle(): AuthBundle | null {
  const auth = useAuthStore.getState().auth
  if (!auth.accessToken || !auth.accessExpiresAt || !auth.session) return null
  return {
    access_token: auth.accessToken,
    token_type: 'Bearer',
    access_expires_at: auth.accessExpiresAt,
    user: auth.user,
    session: auth.session,
  }
}

/** Convenience guard used by the app-boot flow. */
export function getAccessToken(): string | null {
  return useAuthStore.getState().auth.accessToken
}
