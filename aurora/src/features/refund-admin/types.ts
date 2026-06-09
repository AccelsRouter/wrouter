/*
Refund-admin types. Reuses the user-facing RefundRequest shape from
features/refund.
*/
export type {
  RefundRequest,
  RefundStatus,
  RefundMethod,
} from '../refund/types'

export type RefundListResponse = {
  items: import('../refund/types').RefundRequest[]
  total: number
  limit: number
  offset: number
}
