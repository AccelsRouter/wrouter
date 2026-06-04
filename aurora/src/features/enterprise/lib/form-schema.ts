/*
wspn fork: enterprise inquiry form zod schema.
*/
import { z } from 'zod'

export const enterpriseFormSchema = z.object({
  name: z
    .string()
    .min(1, { message: 'Please enter your name' })
    .max(100, { message: 'Name is too long' }),
  company: z
    .string()
    .min(1, { message: 'Please enter your company' })
    .max(200, { message: 'Company is too long' }),
  work_email: z
    .string()
    .min(1, { message: 'Please enter your work email' })
    .email({ message: 'Please enter a valid email address' })
    .max(200, { message: 'Email is too long' }),
  country: z.string().min(1, { message: 'Please select your country' }),
  monthly_volume: z.string().optional(),
  models_interest: z.array(z.string()),
  use_case: z
    .string()
    .min(20, {
      message: 'Please describe your use case in a few sentences (≥ 20 chars)',
    })
    .max(4000, { message: 'Use case is too long' }),
  source: z.string().optional(),
})

export type EnterpriseFormValues = z.infer<typeof enterpriseFormSchema>

export const enterpriseFormDefaults: EnterpriseFormValues = {
  name: '',
  company: '',
  work_email: '',
  country: '',
  monthly_volume: '',
  models_interest: [],
  use_case: '',
  source: '',
}
