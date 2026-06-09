/*
Admin refund API client.
*/
import { api } from '@/lib/api'
import type { RefundRequest } from '../refund/types'
import type { RefundListResponse } from './types'

type ApiResp<T> = {
  success: boolean
  message?: string
  data?: T
}

export async function listRefundRequests(params: {
  status?: string
  limit?: number
  offset?: number
}): Promise<RefundListResponse> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  if (params.offset) qs.set('offset', String(params.offset))
  const res = await api.get<ApiResp<RefundListResponse>>(
    `/api/admin/refund/?${qs.toString()}`
  )
  if (!res.data?.success || !res.data.data)
    throw new Error(res.data?.message || 'Failed to load refund requests')
  return res.data.data
}

export async function getRefundRequest(id: number): Promise<RefundRequest> {
  const res = await api.get<ApiResp<RefundRequest>>(`/api/admin/refund/${id}`)
  if (!res.data?.success || !res.data.data)
    throw new Error(res.data?.message || 'Failed to load refund request')
  return res.data.data
}

export async function approveRefundRequest(
  id: number,
  note: string
): Promise<void> {
  const res = await api.post<ApiResp<{ approved: boolean }>>(
    `/api/admin/refund/${id}/approve`,
    { note }
  )
  if (!res.data?.success)
    throw new Error(res.data?.message || 'Approve failed')
}

export async function rejectRefundRequest(
  id: number,
  note: string
): Promise<void> {
  const res = await api.post<ApiResp<{ rejected: boolean }>>(
    `/api/admin/refund/${id}/reject`,
    { note }
  )
  if (!res.data?.success)
    throw new Error(res.data?.message || 'Reject failed')
}

export async function markRefundRefunded(
  id: number,
  note: string
): Promise<void> {
  const res = await api.post<ApiResp<{ refunded: boolean }>>(
    `/api/admin/refund/${id}/mark-refunded`,
    { note }
  )
  if (!res.data?.success)
    throw new Error(res.data?.message || 'Mark refunded failed')
}
