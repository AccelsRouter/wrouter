/*
Refund-request types mirroring the backend at model/refund_request.go.
*/

export type RefundStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'refunded'
  | 'cancelled'

export type RefundMethod = 'bank' | 'crypto'

export type RefundRequest = {
  id: number
  user_id: number
  username: string
  email: string
  amount_usd: number
  balance_snapshot: number
  method: RefundMethod
  refund_destination: string
  reason: string
  contact_info: string
  status: RefundStatus
  admin_note: string
  processed_by: number
  processed_at: string | null
  created_at: string
  updated_at: string
}

export type RefundPrecheck = {
  active_tokens: number
  balance_usd: number
  active_request: RefundRequest | null
  can_submit: boolean
  block_reasons: string[]
}

export type SubmitRefundPayload = {
  amount_usd: number
  method: RefundMethod
  refund_destination: string
  reason: string
  contact_info: string
}
