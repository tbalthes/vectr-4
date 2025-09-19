'use client';
import React, { useState } from 'react';
import { LinkIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import PageHeader from '@/components/private/PageHeader';
import { LuxuryAccountsGrid } from '@/components/private/accounts/LuxuryAccountsGrid';
import { AccountsStatsCards } from '@/components/private/accounts/AccountsStatsCards';
import { ConnectAccountModal } from '@/components/private/accounts/ConnectAccountModal';
import { useAccounts } from '@/hooks/useAccounts';

export default function AccountsPage() {
  const [showConnectModal, setShowConnectModal] = useState(false);
  const { accounts, loading, error, refetch, syncAccount, syncAllAccounts } = useAccounts();

  const handleAccountConnected = () => {
    setShowConnectModal(false);
    void refetch(false); // Don't show notifications - we already showed success for account creation
  };

  const handleRefresh = async () => {
    await refetch(true); // Show notifications on manual refresh
  };

  return (
    <>
      <PageHeader
        title="Accounts"
        subtitle="Manage your linked accounts and view balances across all your financial institutions."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" className="text-white" onClick={() => setShowConnectModal(true)}>
              <LinkIcon className="mr-2 h-4 w-4" />
              Add Account
            </Button>
          </div>
        }
      />

      <div className="flex-1 space-y-4 sm:space-y-6 px-4 sm:px-6 lg:px-8 py-4 sm:py-6 max-w-7xl mx-auto animate-fade-in">
        {/* Stats Cards */}
        <AccountsStatsCards accounts={accounts} loading={loading} />

        {/* Accounts Grid */}
        <LuxuryAccountsGrid
          accounts={accounts}
          loading={loading}
          error={error}
          onRefresh={() => {
            void handleRefresh();
          }}
          onSyncAccount={syncAccount}
          onSyncAll={syncAllAccounts}
        />
      </div>

      {/* Connect Account Modal */}
      <ConnectAccountModal
        open={showConnectModal}
        onOpenChange={setShowConnectModal}
        onAccountConnected={handleAccountConnected}
      />
    </>
  );
}
