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
Admin organization API client. Wraps /api/admin/organizations endpoints.
*/
import { api } from '@/lib/api'

import type {
  CreateOrgPayload,
  CreditOrgPayload,
  Organization,
  OrgLedgerEntry,
  PagedResponse,
  UpdateOrgPayload,
} from './types'

type ApiResp<T> = {
  success: boolean
  message?: string
  data?: T
}

export async function listOrganizations(params: {
  page: number
  pageSize: number
}): Promise<PagedResponse<Organization>> {
  const qs = new URLSearchParams()
  qs.set('p', String(params.page))
  qs.set('page_size', String(params.pageSize))
  const res = await api.get<ApiResp<PagedResponse<Organization>>>(
    `/api/admin/organizations?${qs.toString()}`
  )
  if (!res.data?.success || !res.data.data)
    throw new Error(res.data?.message || 'Failed to load organizations')
  return res.data.data
}

export async function createOrganization(
  payload: CreateOrgPayload
): Promise<void> {
  const res = await api.post<ApiResp<unknown>>(
    '/api/admin/organizations',
    payload
  )
  if (!res.data?.success)
    throw new Error(res.data?.message || 'Failed to create organization')
}

export async function updateOrganization(
  id: number,
  payload: UpdateOrgPayload
): Promise<void> {
  const res = await api.put<ApiResp<unknown>>(
    `/api/admin/organizations/${id}`,
    payload
  )
  if (!res.data?.success)
    throw new Error(res.data?.message || 'Failed to update organization')
}

export async function creditOrganization(
  id: number,
  payload: CreditOrgPayload
): Promise<void> {
  const res = await api.post<ApiResp<unknown>>(
    `/api/admin/organizations/${id}/credit`,
    payload
  )
  if (!res.data?.success)
    throw new Error(res.data?.message || 'Failed to credit organization')
}

export async function listOrgLedger(params: {
  id: number
  page: number
  pageSize: number
}): Promise<PagedResponse<OrgLedgerEntry>> {
  const qs = new URLSearchParams()
  qs.set('p', String(params.page))
  qs.set('page_size', String(params.pageSize))
  const res = await api.get<ApiResp<PagedResponse<OrgLedgerEntry>>>(
    `/api/admin/organizations/${params.id}/ledger?${qs.toString()}`
  )
  if (!res.data?.success || !res.data.data)
    throw new Error(res.data?.message || 'Failed to load ledger')
  return res.data.data
}

// Platform-provisioned org membership: only a platform admin attaches a user
// to an org (org console cannot conscript arbitrary users). Fails if the user
// already belongs to any organization.
export async function attachOrgAccount(payload: {
  org_id: number
  user_id: number
  monthly_budget?: number
  registered_by?: string
}): Promise<void> {
  const res = await api.post<ApiResp<unknown>>(
    '/api/admin/organizations/accounts',
    payload
  )
  if (!res.data?.success)
    throw new Error(res.data?.message || 'Failed to attach account')
}
