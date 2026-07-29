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
import axios, { type AxiosRequestConfig } from 'axios'
import { t } from 'i18next'
import { toast } from 'sonner'

import {
  clearAuthentication,
  refreshAuthentication,
} from '@/lib/auth-session'
import { useAuthStore } from '@/stores/auth-store'

export {
  applyAuthBundle,
  bootstrapAuthentication,
  clearAuthentication,
  parseAuthBundle,
  refreshAuthentication,
} from '@/lib/auth-session'
export type { RefreshOutcome } from '@/lib/auth-session'

declare module 'axios' {
  export interface AxiosRequestConfig {
    skipBusinessError?: boolean
    skipErrorHandler?: boolean
    disableDuplicate?: boolean
    // When set, a 401 will not trigger a token refresh (used by callers that
    // carry their own credentials, e.g. relay/API-key requests).
    skipAuthRefresh?: boolean
    // Internal marker: set once a request has been retried after a refresh so
    // we never loop on a second 401.
    authRetry?: boolean
  }
}

export type ApiRequestConfig = AxiosRequestConfig

// ============================================================================
// Axios Instance Configuration
// ============================================================================

// Base URL: empty string for same-origin API requests
const baseURL = ''

// Create axios instance with default config
export const api = axios.create({
  baseURL,
  withCredentials: true, // Include cookies in cross-origin requests
  headers: {
    'Cache-Control': 'no-store', // Prevent caching
  },
})

// ============================================================================
// Request Deduplication
// ============================================================================

// Deduplicate concurrent GET requests to the same URL
// Prevents multiple identical requests from being sent simultaneously
const inFlightGet = new Map<string, Promise<unknown>>()
const originalGet = api.get.bind(api)

api.get = ((url: string, config: ApiRequestConfig = {}) => {
  const disableDuplicate = config.disableDuplicate
  if (disableDuplicate) return originalGet(url, config)

  const params = config.params ? JSON.stringify(config.params) : '{}'
  const key = `${url}?${params}`

  // Return existing in-flight request if available
  if (inFlightGet.has(key)) return inFlightGet.get(key)!

  // Create new request and clean up after completion
  const req = originalGet(url, config).finally(() => inFlightGet.delete(key))
  inFlightGet.set(key, req)
  return req
}) as typeof api.get

// ============================================================================
// Response Interceptor
// ============================================================================

// Handle business logic errors and HTTP errors globally
api.interceptors.response.use(
  (response) => {
    const skipBusiness = response.config.skipBusinessError

    // Unified business response format: { success, message, data }
    if (
      !skipBusiness &&
      response &&
      response.data &&
      typeof response.data.success === 'boolean'
    ) {
      if (!response.data.success) {
        // Show error toast for business failures
        const msg = response.data.message || t('Request failed')
        toast.error(msg)
      }
    }
    return response
  },
  async (error) => {
    const config = error?.config as ApiRequestConfig | undefined
    const skip = config?.skipErrorHandler
    const status = error?.response?.status

    if (status === 401) {
      // Only attempt a refresh for dashboard requests that relied on our stored
      // access token. Requests carrying their own Authorization (relay/API-key)
      // set skipAuthRefresh and are left untouched.
      const hasDashboardToken = Boolean(
        useAuthStore.getState().auth.accessToken
      )
      if (
        config &&
        !config.skipAuthRefresh &&
        !config.authRetry &&
        hasDashboardToken
      ) {
        config.authRetry = true
        const outcome = await refreshAuthentication()
        if (outcome.kind === 'authenticated') {
          const token = useAuthStore.getState().auth.accessToken
          if (token) {
            config.headers = {
              ...config.headers,
              Authorization: `Bearer ${token}`,
            }
          }
          return api.request(config)
        }
        // Refresh failed: drop local state and send the user back to sign-in.
        clearAuthentication()
        if (!skip) toast.error(t('Session expired!'))
        redirectToSignIn()
      } else {
        clearAuthentication()
        if (!skip) toast.error(t('Session expired!'))
        if (config?.authRetry) redirectToSignIn()
      }
    } else if (!skip) {
      // Other errors: show error message from response or default
      const msg =
        error?.response?.data?.message || error?.message || t('Request failed')
      toast.error(msg)
    }
    return Promise.reject(error)
  }
)

// Send the user to the sign-in page without stacking redirects.
function redirectToSignIn(): void {
  if (
    typeof window !== 'undefined' &&
    window.location.pathname !== '/sign-in'
  ) {
    window.location.replace('/sign-in')
  }
}

// ============================================================================
// Common Headers Utility
// ============================================================================

/**
 * Get user ID from localStorage
 */
function getUserId(): string | null {
  try {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('uid')
    }
  } catch {
    /* empty */
  }
  return null
}

/**
 * Get common request headers (for both axios and SSE requests)
 */
export function getCommonHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  const uid = getUserId()
  if (uid) {
    headers['New-Api-User'] = uid
  }

  // Dashboard-authenticated fetch/SSE calls (e.g. the playground) need the
  // Bearer access token too, since the cookie session was removed in rc.22.
  const accessToken = useAuthStore.getState().auth.accessToken
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`
  }

  return headers
}

// ============================================================================
// Request Interceptor
// ============================================================================

// Attach user ID header and dashboard Bearer token for all requests
api.interceptors.request.use((config) => {
  const uid = getUserId()
  if (uid) {
    // Custom header for user identification
    ;(config.headers as Record<string, string>)['New-Api-User'] = uid
  }

  // Inject the dashboard access token, but never clobber a request that
  // already carries an explicit Authorization (e.g. relay/API-key calls).
  const headers = config.headers as Record<string, string>
  if (!headers.Authorization) {
    const accessToken = useAuthStore.getState().auth.accessToken
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`
    }
  }
  return config
})

// ============================================================================
// Common API Functions
// ============================================================================

// ----------------------------------------------------------------------------
// User APIs
// ----------------------------------------------------------------------------

// Get current user info
export async function getSelf() {
  const res = await api.get('/api/user/self', {
    // Avoid global 401 toast during guards/preloads
    skipErrorHandler: true,
  })
  return res.data
}

// Get user available models
export async function getUserModels(): Promise<{
  success: boolean
  message?: string
  data?: string[]
}> {
  const res = await api.get('/api/user/models')
  return res.data
}

// Get user groups with descriptions and ratios
export async function getUserGroups(): Promise<{
  success: boolean
  message?: string
  data?: Record<string, { desc: string; ratio: number | string }>
}> {
  const res = await api.get('/api/user/self/groups')
  return res.data
}

// ----------------------------------------------------------------------------
// System APIs
// ----------------------------------------------------------------------------

// Get system status
export async function getStatus() {
  const res = await api.get('/api/status')
  return res.data?.data as Record<string, unknown>
}

// Get system notice
export async function getNotice(): Promise<{
  success: boolean
  message?: string
  data?: string
}> {
  const res = await api.get('/api/notice')
  return res.data
}

// ----------------------------------------------------------------------------
// 2FA Management APIs
// ----------------------------------------------------------------------------

// Get 2FA status
export async function get2FAStatus() {
  const res = await api.get('/api/user/2fa/status')
  return res.data
}

// Setup 2FA
export async function setup2FA() {
  const res = await api.post('/api/user/2fa/setup')
  return res.data
}

// Enable 2FA with verification code
export async function enable2FA(code: string) {
  const res = await api.post('/api/user/2fa/enable', { code })
  return res.data
}

// Disable 2FA with verification code
export async function disable2FA(code: string) {
  const res = await api.post('/api/user/2fa/disable', { code })
  return res.data
}

// Regenerate 2FA backup codes
export async function regenerate2FABackupCodes(code: string) {
  const res = await api.post('/api/user/2fa/backup_codes', { code })
  return res.data
}
