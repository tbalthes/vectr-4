'use client';

import React from 'react';

import { AccountNotificationDemo } from '@/components/private/accounts/AccountNotificationDemo';
import { AccountsGrid } from '@/components/private/accounts/AccountsGrid';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAccounts } from '@/hooks/useAccounts';

// Mock data for demonstration
const mockAccounts = [
  {
    id: '1',
    name: 'Chase Checking',
    institution_name: 'JPMorgan Chase',
    type: 'checking',
    balance_amount: 2850.75,
    available: 2850.75,
    currency: 'USD',
    last_synced_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    provider: 'plaid',
    mask: '1234',
  },
  {
    id: '2',
    name: 'Wells Fargo Savings',
    institution_name: 'Wells Fargo',
    type: 'savings',
    balance_amount: 15420.3,
    available: 15420.3,
    currency: 'USD',
    last_synced_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    provider: 'plaid',
    mask: '5678',
  },
  {
    id: '3',
    name: 'Citi Credit Card',
    institution_name: 'Citibank',
    type: 'credit',
    balance_amount: -1250.45,
    available: 8749.55,
    currency: 'USD',
    last_synced_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    provider: 'plaid',
    mask: '9012',
  },
];

export default function NotificationTestPage() {
  const { accounts, loading, error, refetch } = useAccounts();

  // Use real accounts if available, otherwise fallback to mock data
  const displayAccounts = accounts && accounts.length > 0 ? accounts : mockAccounts;

  const handleSyncAccount = async (accountId: string, accountName: string): Promise<void> => {
    console.log(`Syncing account: ${accountName} (${accountId})`);

    // Mock sync implementation
    await new Promise((resolve) => setTimeout(resolve, 2000 + Math.random() * 3000));

    // Simulate occasional failures
    if (Math.random() < 0.2) {
      throw new Error('Sync failed');
    }
  };

  const handleSyncAll = async () => {
    // Mock bulk sync implementation
    const results = {
      successful: 0,
      failed: 0,
      failedAccounts: [] as string[],
      totalNewTransactions: 0,
    };

    for (const account of displayAccounts) {
      await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000));

      if (Math.random() < 0.8) {
        results.successful++;
        results.totalNewTransactions += Math.floor(Math.random() * 15);
      } else {
        results.failed++;
        results.failedAccounts.push(account.name);
      }
    }

    return results;
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Account Notification System</h1>
        <p className="text-muted-foreground">
          Complete demonstration of the enhanced account management and notification system
        </p>
      </div>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🔧 System Status
            <Badge variant="outline" className="bg-green-50 text-green-700">
              Operational
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="font-medium">✅ Notification System</p>
              <p className="text-muted-foreground">Toast notifications with progress tracking</p>
            </div>
            <div>
              <p className="font-medium">✅ Account Sync Context</p>
              <p className="text-muted-foreground">Global state management for sync operations</p>
            </div>
            <div>
              <p className="font-medium">✅ Enhanced UI Components</p>
              <p className="text-muted-foreground">Responsive grid with real-time updates</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Live Accounts Grid */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Live Account Management</h2>
        <AccountsGrid
          accounts={displayAccounts}
          loading={loading}
          error={error}
          onRefresh={() => void refetch()}
          onSyncAccount={handleSyncAccount}
          onSyncAll={handleSyncAll}
        />
      </div>

      {/* Interactive Demo */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Interactive Notification Demo</h2>
        <AccountNotificationDemo />
      </div>

      {/* Features Overview */}
      <Card>
        <CardHeader>
          <CardTitle>🚀 System Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-2">Notification Types</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Progress indicators with live updates</li>
                <li>• Success notifications with transaction counts</li>
                <li>• Error handling with retry suggestions</li>
                <li>• Warning dialogs for bulk operations</li>
                <li>• Background process indicators</li>
                <li>• Connection status notifications</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Account Management</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Individual account synchronization</li>
                <li>• Bulk sync with progress tracking</li>
                <li>• Real-time balance updates</li>
                <li>• Account connection/disconnection</li>
                <li>• Responsive grid layout</li>
                <li>• Privacy controls (balance hiding)</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
