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
/*
Organization console API client. Wraps /api/organization/* endpoints used
by an org owner/admin to manage their own organization.
*/
import { api } from '@/lib/api'

import type {
  ApplyResult,
  InvitationPreview,
  OrgAccount,
  OrgApplication,
  OrgByokChannel,
  OrgInvitation,
  OrgLedgerEntry,
  OrgSelf,
  OrgType,
  OrgWorkspace,
  PagedResponse,
} from './types'

type ApiResp<T> = {
  success: boolean
  message?: string
  data?: T
}

function unwrap<T>(res: { data?: ApiResp<T> }, fallback: string): T {
  if (!res.data?.success || res.data.data == null)
    throw new Error(res.data?.message || fallback)
  return res.data.data
}

function assertOk(res: { data?: ApiResp<unknown> }, fallback: string): void {
  if (!res.data?.success) throw new Error(res.data?.message || fallback)
}

// Returns null when the caller does not manage an organization (backend
// responds with a business error / non-2xx, e.g. "organization not found").
// Both are treated as "no console" rather than surfaced as an error.
export async function getOrgSelf(): Promise<OrgSelf | null> {
  try {
    const res = await api.get<ApiResp<OrgSelf>>('/api/organization/self', {
      skipErrorHandler: true,
      skipBusinessError: true,
    })
    if (!res.data?.success || !res.data.data) return null
    return res.data.data
  } catch {
    return null
  }
}

export async function listOrgAccounts(): Promise<OrgAccount[]> {
  const res = await api.get<ApiResp<OrgAccount[]>>('/api/organization/accounts')
  return unwrap(res, 'Failed to load accounts')
}

export async function updateOrgAccount(
  userId: number,
  payload: { monthly_budget?: number; status?: string; role?: string }
): Promise<void> {
  const res = await api.put<ApiResp<unknown>>(
    `/api/organization/accounts/${userId}`,
    payload
  )
  assertOk(res, 'Failed to update account')
}

export async function removeOrgAccount(userId: number): Promise<void> {
  const res = await api.delete<ApiResp<unknown>>(
    `/api/organization/accounts/${userId}`
  )
  assertOk(res, 'Failed to remove account')
}

export async function listOrgWorkspaces(): Promise<OrgWorkspace[]> {
  const res = await api.get<ApiResp<OrgWorkspace[]>>(
    '/api/organization/workspaces'
  )
  return unwrap(res, 'Failed to load workspaces')
}

export async function createOrgWorkspace(payload: {
  name: string
  monthly_budget?: number
}): Promise<void> {
  const res = await api.post<ApiResp<unknown>>(
    '/api/organization/workspaces',
    payload
  )
  assertOk(res, 'Failed to create workspace')
}

export async function updateOrgWorkspace(
  id: number,
  payload: { name?: string; monthly_budget?: number; status?: string }
): Promise<void> {
  const res = await api.put<ApiResp<unknown>>(
    `/api/organization/workspaces/${id}`,
    payload
  )
  assertOk(res, 'Failed to update workspace')
}

export async function deleteOrgWorkspace(id: number): Promise<void> {
  const res = await api.delete<ApiResp<unknown>>(
    `/api/organization/workspaces/${id}`
  )
  assertOk(res, 'Failed to delete workspace')
}

export async function bindWorkspaceToken(
  id: number,
  tokenId: number
): Promise<void> {
  const res = await api.post<ApiResp<unknown>>(
    `/api/organization/workspaces/${id}/tokens`,
    { token_id: tokenId }
  )
  assertOk(res, 'Failed to bind token')
}

export async function listOrgByok(): Promise<OrgByokChannel[]> {
  const res = await api.get<ApiResp<OrgByokChannel[]>>('/api/organization/byok')
  return unwrap(res, 'Failed to load BYOK channels')
}

export async function createOrgByok(payload: {
  name: string
  type: number
  key: string
  base_url: string
  models: string
}): Promise<void> {
  const res = await api.post<ApiResp<unknown>>(
    '/api/organization/byok',
    payload
  )
  assertOk(res, 'Failed to create BYOK channel')
}

export async function deleteOrgByok(channelId: number): Promise<void> {
  const res = await api.delete<ApiResp<unknown>>(
    `/api/organization/byok/${channelId}`
  )
  assertOk(res, 'Failed to delete BYOK channel')
}

export async function listOrgLedger(params: {
  page: number
  pageSize: number
}): Promise<PagedResponse<OrgLedgerEntry>> {
  const qs = new URLSearchParams()
  qs.set('p', String(params.page))
  qs.set('page_size', String(params.pageSize))
  const res = await api.get<ApiResp<PagedResponse<OrgLedgerEntry>>>(
    `/api/organization/ledger?${qs.toString()}`
  )
  return unwrap(res, 'Failed to load ledger')
}

export async function allocateQuota(payload: {
  to_org_id: number
  quota: number
  remark: string
}): Promise<void> {
  const res = await api.post<ApiResp<unknown>>(
    '/api/organization/allocate',
    payload
  )
  assertOk(res, 'Failed to allocate quota')
}

export async function revokeQuota(payload: {
  to_org_id: number
  quota: number
  remark: string
}): Promise<void> {
  const res = await api.post<ApiResp<unknown>>(
    '/api/organization/revoke',
    payload
  )
  assertOk(res, 'Failed to revoke quota')
}

// --- Self-service onboarding (any authenticated user) ---

export async function applyForOrg(payload: {
  type: OrgType
  org_name: string
  contact: string
  remark: string
}): Promise<ApplyResult> {
  const res = await api.post<ApiResp<ApplyResult>>(
    '/api/organization/apply',
    payload
  )
  return unwrap(res, 'Failed to submit application')
}

// Returns the caller's latest application, or null when they never applied.
// A successful response with a null payload is a valid "no application" state.
export async function getSelfApplication(): Promise<OrgApplication | null> {
  const res = await api.get<ApiResp<OrgApplication | null>>(
    '/api/organization/apply/self',
    { skipErrorHandler: true, skipBusinessError: true }
  )
  if (!res.data?.success) return null
  return res.data.data ?? null
}

export async function previewInvitation(
  code: string
): Promise<InvitationPreview> {
  const res = await api.get<ApiResp<InvitationPreview>>(
    `/api/organization/invitations/preview?code=${encodeURIComponent(code)}`,
    { skipErrorHandler: true, skipBusinessError: true }
  )
  return unwrap(res, 'This invitation is invalid or has expired.')
}

export async function acceptInvitation(
  code: string
): Promise<{ org_id: number }> {
  const res = await api.post<ApiResp<{ org_id: number }>>(
    '/api/organization/invitations/accept',
    { code }
  )
  return unwrap(res, 'Failed to accept invitation')
}

// --- Org console invitations (owner/admin of the caller's org) ---

export async function listInvitations(): Promise<OrgInvitation[]> {
  const res = await api.get<ApiResp<OrgInvitation[]>>(
    '/api/organization/invitations'
  )
  return unwrap(res, 'Failed to load invitations')
}

export async function createInvitation(payload: {
  relation?: string
  role?: string
  monthly_budget?: number
  invited_email?: string
}): Promise<{ code: string; expires_at: number }> {
  const res = await api.post<ApiResp<{ code: string; expires_at: number }>>(
    '/api/organization/invitations',
    payload
  )
  return unwrap(res, 'Failed to create invitation')
}

export async function revokeInvitation(id: number): Promise<void> {
  const res = await api.delete<ApiResp<unknown>>(
    `/api/organization/invitations/${id}`
  )
  assertOk(res, 'Failed to revoke invitation')
}
