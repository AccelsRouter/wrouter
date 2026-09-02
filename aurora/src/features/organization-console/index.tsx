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
"My Organization" console for a user who owns/administers an organization.
Shows the wallet balance and tabs for members/customers, workspaces, BYOK
channels and the ledger; resellers additionally get allocate/revoke actions.

Renders a friendly empty state (and the parent hides its nav entry) when the
caller does not manage an organization — see useOrgConsoleAccess.
*/
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building2, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatQuotaWithCurrency } from '@/lib/currency'

import { AccountsTab } from './accounts-tab'
import { AllocationDialog, type AllocationMode } from './allocation-dialog'
import { getOrgSelf } from './api'
import { ByokTab } from './byok-tab'
import { LedgerTab } from './ledger-tab'
import { WorkspacesTab } from './workspaces-tab'

export function OrganizationConsole() {
  const { t } = useTranslation()
  const [tab, setTab] = useState('accounts')
  const [allocationMode, setAllocationMode] = useState<AllocationMode | null>(
    null
  )

  const { data: self, isLoading } = useQuery({
    queryKey: ['org-self'],
    queryFn: getOrgSelf,
    staleTime: 60_000,
  })

  const isReseller = self?.type === 'reseller'

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('My Organization')}</SectionPageLayout.Title>
      {self && isReseller && (
        <SectionPageLayout.Actions>
          <Button
            variant='outline'
            size='sm'
            onClick={() => setAllocationMode('allocate')}
          >
            {t('Allocate Quota')}
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={() => setAllocationMode('revoke')}
          >
            {t('Revoke Quota')}
          </Button>
        </SectionPageLayout.Actions>
      )}
      <SectionPageLayout.Content>
        {isLoading ? (
          <div className='flex h-40 items-center justify-center'>
            <Loader2 className='text-muted-foreground h-5 w-5 animate-spin' />
          </div>
        ) : !self ? (
          <div className='border-border/40 flex h-56 flex-col items-center justify-center gap-2 rounded-md border border-dashed'>
            <Building2 className='text-muted-foreground/60 h-8 w-8' />
            <p className='text-muted-foreground text-sm'>
              {t('You do not manage an organization.')}
            </p>
          </div>
        ) : (
          <div className='flex flex-col gap-5'>
            <div className='border-border/60 bg-muted/30 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4'>
              <div className='flex flex-col gap-1'>
                <div className='flex items-center gap-2'>
                  <span className='text-base font-semibold'>{self.name}</span>
                  <Badge variant={isReseller ? 'default' : 'secondary'}>
                    {isReseller ? t('Reseller') : t('Enterprise')}
                  </Badge>
                  <Badge
                    variant={
                      self.status === 'active' ? 'outline' : 'destructive'
                    }
                  >
                    {self.status === 'active' ? t('Active') : t('Suspended')}
                  </Badge>
                </div>
                {self.price_group && (
                  <span className='text-muted-foreground text-xs'>
                    {t('Price Group')}: {self.price_group}
                  </span>
                )}
              </div>
              <div className='flex flex-col items-end'>
                <span className='text-muted-foreground text-xs'>
                  {t('Wallet Balance')}
                </span>
                <span className='text-lg font-bold tabular-nums'>
                  {formatQuotaWithCurrency(self.wallet_quota)}
                </span>
              </div>
            </div>

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className='max-w-full flex-wrap justify-start group-data-horizontal/tabs:h-auto'>
                <TabsTrigger value='accounts'>
                  {isReseller ? t('Customers') : t('Members')}
                </TabsTrigger>
                <TabsTrigger value='workspaces'>{t('Workspaces')}</TabsTrigger>
                <TabsTrigger value='byok'>{t('BYOK')}</TabsTrigger>
                <TabsTrigger value='ledger'>{t('Ledger')}</TabsTrigger>
              </TabsList>
              <TabsContent value='accounts' className='pt-4'>
                <AccountsTab orgType={self.type} />
              </TabsContent>
              <TabsContent value='workspaces' className='pt-4'>
                <WorkspacesTab />
              </TabsContent>
              <TabsContent value='byok' className='pt-4'>
                <ByokTab />
              </TabsContent>
              <TabsContent value='ledger' className='pt-4'>
                <LedgerTab />
              </TabsContent>
            </Tabs>
          </div>
        )}

        <AllocationDialog
          mode={allocationMode}
          onClose={() => setAllocationMode(null)}
        />
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
