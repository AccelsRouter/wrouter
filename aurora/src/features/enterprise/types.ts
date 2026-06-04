/*
wspn fork: enterprise inquiry payload type.
*/
export type EnterpriseInquiryPayload = {
  name: string
  company: string
  work_email: string
  country: string
  monthly_volume: string
  models_interest: string[]
  use_case: string
  source: string
}

export type EnterpriseInquiryResponse = {
  success: boolean
  message?: string
  data?: {
    submitted?: boolean
  }
}
