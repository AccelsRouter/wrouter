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
import { api, refreshAuthentication } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

import type {
  LoginPayload,
  LoginResponse,
  Login2FAResponse,
  TwoFAPayload,
  RegisterPayload,
  ApiResponse,
} from './types'

// ============================================================================
// Authentication APIs
// ============================================================================

// ----------------------------------------------------------------------------
// Login & Logout
// ----------------------------------------------------------------------------

// User login with username and password
export async function login(payload: LoginPayload) {
  const turnstile = payload.turnstile ?? ''
  const res = await api.post<LoginResponse>(
    `/api/user/login?turnstile=${turnstile}`,
    {
      username: payload.username,
      password: payload.password,
    }
  )
  return res.data
}

// Two-factor authentication login
export async function login2fa(payload: TwoFAPayload) {
  const res = await api.post<Login2FAResponse>('/api/user/login/2fa', payload)
  return res.data
}

// User logout. rc.22 replaced GET /api/user/logout with POST
// /api/user/auth/logout, which revokes the server-side session and clears the
// httpOnly refresh cookie (Bearer identifies the session; X-Auth-Session pins
// it). Without this the refresh cookie stays valid and the app silently
// re-authenticates on the next load — i.e. logout appears not to work.
export async function logout(): Promise<ApiResponse> {
  const postLogout = async () => {
    const sid = useAuthStore.getState().auth.session?.sid
    const res = await api.post('/api/user/auth/logout', undefined, {
      headers: sid ? { 'X-Auth-Session': sid } : undefined,
      skipAuthRefresh: true,
      skipErrorHandler: true,
    })
    return res.data as ApiResponse
  }
  try {
    return await postLogout()
  } catch (error: unknown) {
    // The access token may have expired; refresh once so the revocation
    // actually reaches the server, then retry.
    const status = (error as { response?: { status?: number } })?.response
      ?.status
    if (status === 401) {
      const outcome = await refreshAuthentication()
      if (outcome.kind === 'authenticated') {
        try {
          return await postLogout()
        } catch {
          /* fall through */
        }
      }
    }
    // Server-side revoke failed; the caller still clears local auth state.
    return { success: false, message: 'logout failed' }
  }
}

// ----------------------------------------------------------------------------
// Password Management
// ----------------------------------------------------------------------------

// Send password reset email
export async function sendPasswordResetEmail(
  email: string,
  turnstile?: string
): Promise<ApiResponse> {
  const res = await api.get('/api/reset_password', {
    params: { email, turnstile },
  })
  return res.data
}

// ----------------------------------------------------------------------------
// OAuth
// ----------------------------------------------------------------------------

// Start GitHub OAuth flow
export async function githubOAuthStart(clientId: string, state: string) {
  const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&state=${state}&scope=user:email`
  window.open(url)
}

// Get OAuth state (flow token) for CSRF protection. The rc.22 backend requires
// POST /api/oauth/state with the provider and intent so the callback can verify
// the provider bound at state creation. (A GET here previously matched the
// GET /oauth/:provider callback route with provider="state" → "Unknown OAuth
// provider".)
export async function getOAuthState(
  provider: string,
  intent: 'login' | 'bind' = 'login'
): Promise<string> {
  const aff =
    typeof window !== 'undefined' ? (localStorage.getItem('aff') ?? '') : ''
  const res = await api.post('/api/oauth/state', { provider, intent, aff })
  if (res.data?.success) return res.data.data
  return ''
}

// WeChat login by authorization code
export async function wechatLoginByCode(code: string): Promise<ApiResponse> {
  const res = await api.get('/api/oauth/wechat', { params: { code } })
  return res.data
}

// ----------------------------------------------------------------------------
// Registration
// ----------------------------------------------------------------------------

// User registration
export async function register(payload: RegisterPayload): Promise<ApiResponse> {
  const res = await api.post(`/api/user/register`, payload, {
    params: { turnstile: payload.turnstile ?? '' },
  })
  return res.data
}

// Send email verification code
export async function sendEmailVerification(
  email: string,
  turnstile?: string
): Promise<ApiResponse> {
  const res = await api.get('/api/verification', {
    params: { email, turnstile },
  })
  return res.data
}

// Bind email to OAuth account
export async function bindEmail(
  email: string,
  code: string
): Promise<ApiResponse> {
  const res = await api.post('/api/oauth/email/bind', {
    email,
    code,
  })
  return res.data
}
