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
Small presentational primitives shared across the organization console tabs.
*/
import { Label } from '@/components/ui/label'

export function Th(props: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-3 py-2 text-left font-medium ${props.className ?? ''}`}>
      {props.children}
    </th>
  )
}

export function Td(props: { children: React.ReactNode; className?: string }) {
  return (
    <td className={`px-3 py-2 align-middle ${props.className ?? ''}`}>
      {props.children}
    </td>
  )
}

export function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <div className='flex flex-col gap-1.5'>
      <Label className='text-xs'>{props.label}</Label>
      {props.children}
    </div>
  )
}

export function fmtTime(unixSec: number): string {
  if (!unixSec) return '-'
  return new Date(unixSec * 1000).toLocaleString()
}
