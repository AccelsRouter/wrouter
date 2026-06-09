/*
Refund API client — small wrappers over the /api/user/refund endpoints.
*/
import { api } from '@/lib/api'
import type {
  RefundPrecheck,
  RefundRequest,
  SubmitRefundPayload,
} from './types'

type ApiResp<T> = {
  success: boolean
  message?: string
  data?: T
}

export async function fetchRefundPrecheck(): Promise<RefundPrecheck> {
  const res = await api.get<ApiResp<RefundPrecheck>>('/api/user/refund/precheck')
  if (!res.data?.success || !res.data.data)
    throw new Error(res.data?.message || 'Failed to fetch refund precheck')
  return res.data.data
}

export async function fetchActiveRefundRequest(): Promise<RefundRequest | null> {
  const res = await api.get<ApiResp<{ active_request: RefundRequest | null }>>(
    '/api/user/refund/active'
  )
  if (!res.data?.success)
    throw new Error(res.data?.message || 'Failed to fetch active refund')
  return res.data.data?.active_request ?? null
}

export async function listMyRefundRequests(
  limit = 50
): Promise<RefundRequest[]> {
  const res = await api.get<ApiResp<{ items: RefundRequest[] }>>(
    `/api/user/refund?limit=${limit}`
  )
  if (!res.data?.success)
    throw new Error(res.data?.message || 'Failed to list refund requests')
  return res.data.data?.items ?? []
}

export async function submitRefundRequest(
  payload: SubmitRefundPayload
): Promise<RefundRequest> {
  const res = await api.post<ApiResp<RefundRequest>>(
    '/api/user/refund',
    payload
  )
  if (!res.data?.success || !res.data.data)
    throw new Error(res.data?.message || 'Failed to submit refund request')
  return res.data.data
}

export async function cancelRefundRequest(id: number): Promise<void> {
  const res = await api.post<ApiResp<{ cancelled: boolean }>>(
    `/api/user/refund/${id}/cancel`
  )
  if (!res.data?.success)
    throw new Error(res.data?.message || 'Failed to cancel refund request')
}

export async function disableAllMyTokens(): Promise<number> {
  const res = await api.post<ApiResp<{ disabled: number }>>(
    '/api/user/refund/disable-tokens'
  )
  if (!res.data?.success)
    throw new Error(res.data?.message || 'Failed to disable tokens')
  return res.data.data?.disabled ?? 0
}
