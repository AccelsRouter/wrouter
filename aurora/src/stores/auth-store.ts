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
import { create } from 'zustand'

import type { AdminCapabilities } from '@/lib/admin-permissions'

export type UserPermissions = {
  sidebar_settings?: boolean
  sidebar_modules?: Record<string, unknown>
  admin_permissions?: AdminCapabilities
}

export interface AuthUser {
  id: number
  username: string
  display_name?: string
  email?: string
  role: number
  status?: number
  group?: string
  quota?: number
  used_quota?: number
  request_count?: number
  aff_code?: string
  aff_count?: number
  aff_quota?: number
  aff_history_quota?: number
  inviter_id?: number
  github_id?: string
  oidc_id?: string
  wechat_id?: string
  telegram_id?: string
  linux_do_id?: string
  setting?: Record<string, unknown> | string
  stripe_customer?: string
  sidebar_modules?: string
  permissions?: UserPermissions
}

/**
 * A dashboard login session as reported by the backend. rc.22 replaced the
 * server-side session cookie with a stateless access token + refresh cookie;
 * this describes the session the token belongs to.
 */
export interface LoginSession {
  sid: string
  current: boolean
  login_method: string
  ip: string
  user_agent: string
  created_at: number
  last_active_at: number
  expires_at: number
}

/**
 * The authentication bundle returned by every login path (password, 2FA,
 * passkey, OAuth) and by the refresh endpoint. `user` is optional because some
 * login responses omit it and the full profile is fetched via `getSelf`.
 */
export interface AuthBundle {
  access_token: string
  token_type: string
  access_expires_at: number
  user?: AuthUser | null
  session: LoginSession
}

// Tracks whether the app-boot refresh (restore-session-from-cookie) has run.
export type AuthBootstrapState = 'idle' | 'checking' | 'complete'

interface AuthState {
  auth: {
    user: AuthUser | null
    accessToken: string | null
    accessExpiresAt: number | null
    session: LoginSession | null
    bootstrapState: AuthBootstrapState
    setUser: (user: AuthUser | null) => void
    setBundle: (bundle: AuthBundle) => void
    setBootstrapState: (bootstrapState: AuthBootstrapState) => void
    reset: () => void
  }
}

export const useAuthStore = create<AuthState>()((set) => {
  // Restore user info from localStorage
  const initUser = (() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = window.localStorage.getItem('user')
        return saved ? JSON.parse(saved) : null
      }
    } catch {
      // Clear dirty data when parsing fails
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('user')
      }
    }
    return null
  })()

  return {
    auth: {
      user: initUser,
      // Access tokens are kept in memory only. On reload they are restored from
      // the httpOnly refresh cookie via bootstrapAuthentication(); never persist
      // the token to localStorage.
      accessToken: null,
      accessExpiresAt: null,
      session: null,
      bootstrapState: 'idle',
      setUser: (user) =>
        set((state) => {
          // Persist user to localStorage
          if (typeof window !== 'undefined') {
            if (user) {
              window.localStorage.setItem('user', JSON.stringify(user))
            } else {
              window.localStorage.removeItem('user')
            }
          }
          return { ...state, auth: { ...state.auth, user } }
        }),
      setBundle: (bundle) =>
        set((state) => {
          // Only overwrite the user when the bundle carries one; some login
          // paths omit it and rely on a follow-up getSelf() call.
          const nextUser =
            bundle.user !== undefined && bundle.user !== null
              ? bundle.user
              : state.auth.user
          if (typeof window !== 'undefined' && nextUser) {
            window.localStorage.setItem('user', JSON.stringify(nextUser))
          }
          return {
            ...state,
            auth: {
              ...state.auth,
              user: nextUser,
              accessToken: bundle.access_token,
              accessExpiresAt: bundle.access_expires_at,
              session: bundle.session,
              bootstrapState: 'complete',
            },
          }
        }),
      setBootstrapState: (bootstrapState) =>
        set((state) => ({
          ...state,
          auth: { ...state.auth, bootstrapState },
        })),
      reset: () =>
        set((state) => {
          if (typeof window !== 'undefined') {
            window.localStorage.removeItem('user')
          }
          return {
            ...state,
            auth: {
              ...state.auth,
              user: null,
              accessToken: null,
              accessExpiresAt: null,
              session: null,
              bootstrapState: 'complete',
            },
          }
        }),
    },
  }
})
