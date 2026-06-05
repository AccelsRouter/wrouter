/*
Enterprise inquiry API client.
*/
import { api } from '@/lib/api'
import type {
  EnterpriseInquiryPayload,
  EnterpriseInquiryResponse,
} from './types'

export async function submitEnterpriseInquiry(
  payload: EnterpriseInquiryPayload
): Promise<EnterpriseInquiryResponse> {
  const res = await api.post<EnterpriseInquiryResponse>(
    '/api/enterprise-inquiry',
    payload
  )
  return res.data
}
