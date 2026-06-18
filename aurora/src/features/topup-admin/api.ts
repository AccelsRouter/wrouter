/*
Admin top-up order API client. Uses the same endpoints as classic's
TopupHistoryModal: GET /api/user/topup (admin-wide) and
POST /api/user/topup/complete (manual reconcile).
*/
import { api } from '@/lib/api'
import type { TopUpListResponse } from './types'

type ApiResp<T> = {
  success: boolean
  message?: string
  data?: T
}

export async function listTopUps(params: {
  page: number
  pageSize: number
  keyword?: string
}): Promise<TopUpListResponse> {
  const qs = new URLSearchParams()
  qs.set('p', String(params.page))
  qs.set('page_size', String(params.pageSize))
  if (params.keyword) qs.set('keyword', params.keyword)
  const res = await api.get<ApiResp<TopUpListResponse>>(
    `/api/admin/topup-orders/?${qs.toString()}`
  )
  if (!res.data?.success || !res.data.data)
    throw new Error(res.data?.message || 'Failed to load top-up orders')
  return res.data.data
}

export async function completeTopUp(tradeNo: string): Promise<void> {
  const res = await api.post<ApiResp<unknown>>('/api/user/topup/complete', {
    trade_no: tradeNo,
  })
  if (!res.data?.success)
    throw new Error(res.data?.message || 'Failed to complete order')
}
