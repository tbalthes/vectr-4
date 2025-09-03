"use client";
import React, { useState } from "react";
import { LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/private/PageHeader";
import { AccountsGrid } from "@/components/private/accounts/AccountsGrid";
import { AccountsStatsCards } from "@/components/private/accounts/AccountsStatsCards";
import { ConnectAccountModal } from "@/components/private/accounts/ConnectAccountModal";
import { useAccounts } from "@/hooks/useAccounts";

export default function AccountsPage() {
  const [showConnectModal, setShowConnectModal] = useState(false);
  const { accounts, loading, error, refetch } = useAccounts();

  const handleAccountConnected = () => {
    setShowConnectModal(false);
    refetch();
  };

  return (
    <>
      <PageHeader
        title="Accounts"
        subtitle="Manage your linked accounts and view balances across all your financial institutions."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              className="text-white"
              onClick={() => setShowConnectModal(true)}
            >
              <LinkIcon className="mr-2 h-4 w-4" />
              Connect Account
            </Button>
          </div>
        }
      />
      
      <div className="flex-1 space-y-6 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto animate-fade-in">
        {/* Stats Cards */}
        <AccountsStatsCards accounts={accounts} loading={loading} />

        {/* Accounts Grid */}
        <AccountsGrid 
          accounts={accounts} 
          loading={loading} 
          error={error}
          onRefresh={refetch}
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