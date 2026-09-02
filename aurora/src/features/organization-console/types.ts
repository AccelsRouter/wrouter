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
Organization console types. Mirror the backend JSON shapes exposed by
controller/organization_console.go and organization_workspace.go.
*/
export type OrgType = 'enterprise' | 'reseller'
export type OrgStatus = 'active' | 'suspended'
export type AccountStatus = 'active' | 'suspended'

export type OrgSelf = {
  id: number
  name: string
  type: OrgType
  status: OrgStatus
  wallet_quota: number
  price_group: string
  is_owner: boolean
}

export type OrgAccount = {
  user_id: number
  relation: string // member | customer
  role: string // owner | admin | member
  monthly_budget: number // 0 = unlimited
  period_spend: number
  status: AccountStatus
  registered_by: string
}

export type OrgWorkspace = {
  id: number
  name: string
  status: AccountStatus
  monthly_budget: number
  period_spend: number
  created_time: number
}

export type OrgByokChannel = {
  channel_id: number
  name: string
  type: number
  models: string
  status: number
  key_masked: string
}

export type OrgLedgerEntry = {
  id: number
  from_org_id: number
  to_org_id: number
  quota: number
  type: string
  operator_id: number
  trade_no: string
  remark: string
  created_time: number
}

export type PagedResponse<T> = {
  items: T[]
  total: number
  page: number
  page_size: number
}
