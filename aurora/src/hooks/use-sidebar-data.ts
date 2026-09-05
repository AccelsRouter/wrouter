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
import {
  Activity,
  Box,
  Building2,
  CreditCard,
  FileText,
  FlaskConical,
  Key,
  KeyRound,
  LayoutDashboard,
  ListTodo,
  MessageSquare,
  Radio,
  ServerCog,
  Settings,
  Ticket,
  User,
  Users,
  Wallet,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { type NavItem, type SidebarData } from '@/components/layout/types'
import { getOrgSelf } from '@/features/organization-console/api'
import { useStatus } from '@/hooks/use-status'
import { ROLE } from '@/lib/roles'

/**
 * Root navigation groups for the application sidebar.
 *
 * These are shown when the URL does not match any nested sidebar view
 * registered in `layout/lib/sidebar-view-registry.ts`.
 */
export function useSidebarData(): SidebarData {
  const { t } = useTranslation()
  const { status } = useStatus()

  // Resellers get the separate "Distributor" console; everyone else (enterprise
  // owners, members, and users with no org) gets "My Organization" — those
  // without an org land there on the self-service apply page. The self query is
  // resilient: a 401/error/no-org falls back to the "My Organization" entry.
  const { data: orgSelf } = useQuery({
    queryKey: ['org-self'],
    queryFn: getOrgSelf,
    staleTime: 60_000,
  })
  const isReseller = orgSelf?.type === 'reseller'

  const orgNavItem: NavItem = isReseller
    ? {
        title: t('Distributor'),
        url: '/reseller',
        icon: Building2,
      }
    : {
        title: t('My Organization'),
        url: '/organization',
        icon: Building2,
      }

  const personalItems: NavItem[] = [
    {
      title: t('Wallet'),
      url: '/wallet',
      icon: Wallet,
    },
    orgNavItem,
    // Personal BYOK is an opt-in platform feature; only surface it when the
    // backend status flag enables it.
    ...(status?.personal_byok_enabled
      ? [
          {
            title: t('Personal BYOK'),
            url: '/personal-byok',
            icon: KeyRound,
          } as NavItem,
        ]
      : []),
    {
      title: t('Profile'),
      url: '/profile',
      icon: User,
    },
  ]

  return {
    navGroups: [
      {
        id: 'chat',
        title: t('Chat'),
        items: [
          {
            title: t('Playground'),
            url: '/playground',
            icon: FlaskConical,
          },
          {
            title: t('Chat'),
            icon: MessageSquare,
            type: 'chat-presets',
          },
        ],
      },
      {
        id: 'general',
        title: t('General'),
        items: [
          {
            title: t('Overview'),
            url: '/dashboard/overview',
            icon: Activity,
          },
          {
            title: t('Dashboard'),
            url: '/dashboard/models',
            icon: LayoutDashboard,
          },
          {
            title: t('API Keys'),
            url: '/keys',
            icon: Key,
          },
          {
            title: t('Usage Logs'),
            url: '/usage-logs/common',
            icon: FileText,
          },
          {
            title: t('Task Logs'),
            url: '/usage-logs/task',
            activeUrls: ['/usage-logs/drawing'],
            configUrls: ['/usage-logs/drawing', '/usage-logs/task'],
            icon: ListTodo,
          },
        ],
      },
      {
        id: 'personal',
        title: t('Personal'),
        items: personalItems,
      },
      {
        id: 'admin',
        title: t('Admin'),
        items: [
          {
            title: t('Channels'),
            url: '/channels',
            icon: Radio,
          },
          {
            title: t('Models'),
            url: '/models/metadata',
            icon: Box,
          },
          {
            title: t('Users'),
            url: '/users',
            icon: Users,
          },
          {
            title: t('Redemption Codes'),
            url: '/redemption-codes',
            icon: Ticket,
          },
          {
            title: t('Subscriptions'),
            url: '/subscriptions',
            icon: CreditCard,
          },
          {
            title: t('System Info'),
            url: '/system-info',
            icon: ServerCog,
            requiredRole: ROLE.SUPER_ADMIN,
          },
          {
            title: t('System Settings'),
            url: '/system-settings/site',
            activeUrls: ['/system-settings'],
            icon: Settings,
          },
        ],
      },
    ],
  }
}
