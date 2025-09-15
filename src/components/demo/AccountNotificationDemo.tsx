'use client';

import React from 'react';
import { RefreshCw, Zap, AlertTriangle, CheckCircle, Clock, Edit3, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { accountToasts } from '@/lib/notifications/account-notifications';
import { useAccountSync } from '@/contexts/AccountSyncContext';

export function AccountNotificationDemo() {
  const { startAccountSync, startBulkSync, clearAllSyncs } = useAccountSync();

  const demoAccounts = [
    { name: 'Chase Checking', id: 'chase-1' },
    { name: 'Wells Fargo Savings', id: 'wells-1' },
    { name: 'Bank of America Credit', id: 'boa-1' },
    { name: 'Capital One 360', id: 'cap1-1' },
    { name: 'Citi Double Cash', id: 'citi-1' },
  ];

  // Basic notification demos
  const demos = [
    {
      category: 'Success Notifications',
      icon: CheckCircle,
      color: 'text-green-600',
      items: [
        {
          label: 'Account Connected',
          action: () => accountToasts.connected('Chase Checking', 'Syncing your accounts...'),
        },
        {
          label: 'Sync Complete',
          action: () => accountToasts.syncComplete('Wells Fargo', 23),
        },
        {
          label: 'Account Renamed',
          action: () => accountToasts.renamed('Checking Account', 'Emergency Fund'),
        },
        {
          label: 'Bulk Success',
          action: () => accountToasts.bulkSuccess(5, 'refreshed'),
        },
      ],
    },
    {
      category: 'Progress Notifications',
      icon: Clock,
      color: 'text-blue-600',
      items: [
        {
          label: 'Single Account Sync',
          action: () => {
            accountToasts.syncProgress({
              accountName: 'Chase Checking',
              step: 2,
              totalSteps: 3,
              currentOperation: 'Fetching transactions...',
              estimatedTime: '15 seconds',
            });
          },
        },
        {
          label: 'Bulk Sync Progress',
          action: () => {
            accountToasts.bulkSyncProgress({
              totalAccounts: 5,
              completedAccounts: 2,
              currentAccount: 'Wells Fargo Savings',
              estimatedTime: '2 minutes',
            });
          },
        },
      ],
    },
    {
      category: 'Warning Notifications',
      icon: AlertTriangle,
      color: 'text-yellow-600',
      items: [
        {
          label: 'Connection Warning',
          action: () => accountToasts.connectionWarning(5, '2-3 minutes'),
        },
        {
          label: 'Retry Suggestion',
          action: () => accountToasts.retrySuggestion('Bank of America', 3),
        },
      ],
    },
    {
      category: 'Error Notifications',
      icon: AlertTriangle,
      color: 'text-red-600',
      items: [
        {
          label: 'Sync Error (Retryable)',
          action: () => accountToasts.syncError('Chase Checking', 'Connection timeout', true),
        },
        {
          label: 'Sync Error (Non-retryable)',
          action: () => accountToasts.syncError('API', 'Server temporarily unavailable', false),
        },
      ],
    },
    {
      category: 'Action Notifications',
      icon: Edit3,
      color: 'text-purple-600',
      items: [
        {
          label: 'Account Disconnected',
          action: () => accountToasts.disconnected('Old Bank Account'),
        },
        {
          label: 'Bulk Sync Complete',
          action: () => accountToasts.bulkSyncComplete(5, 47, ['Capital One']),
        },
      ],
    },
  ];

  // Advanced demo scenarios
  const runFullSyncDemo = async () => {
    // Step 1: Warning
    accountToasts.connectionWarning(5, '2-3 minutes');

    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Step 2: Start bulk sync
    startBulkSync({
      totalAccounts: 5,
      completedAccounts: 0,
      estimatedTime: '2-3 minutes',
    });
    accountToasts.bulkSyncProgress({
      totalAccounts: 5,
      completedAccounts: 0,
      estimatedTime: '2-3 minutes',
    });

    // Step 3: Progress through accounts
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const account = demoAccounts[i];

      startAccountSync({
        accountName: account.name,
        step: 1,
        totalSteps: 1,
        currentOperation: 'Syncing account...',
        estimatedTime: '1 minute',
      });

      accountToasts.bulkSyncProgress({
        totalAccounts: 5,
        completedAccounts: i,
        currentAccount: account.name,
        estimatedTime: `${(5 - i) * 0.5} minutes`,
      });

      // Simulate individual account sync
      await new Promise((resolve) => setTimeout(resolve, 1000));
      accountToasts.syncComplete(account.name, Math.floor(Math.random() * 20) + 5);
    }

    // Step 4: Complete
    await new Promise((resolve) => setTimeout(resolve, 500));
    accountToasts.bulkSyncComplete(5, 67);
    clearAllSyncs();
  };

  const runErrorRecoveryDemo = async () => {
    // Start sync
    const account = demoAccounts[0];
    startAccountSync({
      accountName: account.name,
      step: 1,
      totalSteps: 1,
      currentOperation: 'Syncing account...',
      estimatedTime: '1 minute',
    });

    accountToasts.syncProgress({
      accountName: account.name,
      step: 1,
      totalSteps: 3,
      currentOperation: 'Connecting to institution...',
      estimatedTime: '30 seconds',
    });

    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Error occurs
    accountToasts.syncError(account.name, 'Network timeout', true);

    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Retry suggestion
    accountToasts.retrySuggestion(account.name, 2);

    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Successful retry
    accountToasts.syncComplete(account.name, 12);
    clearAllSyncs();
  };

  return (
    <div className="space-y-6 p-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Enhanced Account Notifications Demo</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Experience Vectr's comprehensive notification system that keeps users informed throughout
          all account operations with clear, actionable feedback.
        </p>
      </div>

      {/* Advanced Demo Scenarios */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            <span>Advanced Demo Scenarios</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Button
              onClick={() => void runFullSyncDemo()}
              className="h-auto p-4 flex flex-col items-center space-y-2"
              variant="outline"
            >
              <RefreshCw className="h-6 w-6" />
              <div className="text-center">
                <div className="font-semibold">Full Sync Workflow</div>
                <div className="text-xs text-muted-foreground">
                  Complete multi-account sync with progress updates
                </div>
              </div>
            </Button>

            <Button
              onClick={() => void runErrorRecoveryDemo()}
              className="h-auto p-4 flex flex-col items-center space-y-2"
              variant="outline"
            >
              <AlertTriangle className="h-6 w-6" />
              <div className="text-center">
                <div className="font-semibold">Error & Recovery</div>
                <div className="text-xs text-muted-foreground">
                  Demonstrates error handling and retry flow
                </div>
              </div>
            </Button>
          </div>

          <Separator />

          <div className="flex justify-center">
            <Button onClick={clearAllSyncs} variant="ghost" size="sm">
              <Trash2 className="mr-2 h-4 w-4" />
              Clear All Active Syncs
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Individual Notification Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {demos.map((category, categoryIndex) => {
          const IconComponent = category.icon;
          return (
            <Card key={categoryIndex}>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <IconComponent className={`h-5 w-5 ${category.color}`} />
                  <span>{category.category}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {category.items.map((item, itemIndex) => (
                    <Button
                      key={itemIndex}
                      variant="outline"
                      size="sm"
                      onClick={item.action}
                      className="w-full justify-start"
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Feature Highlights */}
      <Card>
        <CardHeader>
          <CardTitle>✨ Key Features Demonstrated</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Badge className="bg-green-100 text-green-800">Immediate Feedback</Badge>
              <p className="text-sm text-muted-foreground">
                Instant notifications for all account actions with clear success/error states
              </p>
            </div>

            <div className="space-y-2">
              <Badge className="bg-blue-100 text-blue-800">Progress Transparency</Badge>
              <p className="text-sm text-muted-foreground">
                Real-time updates with step progress and estimated completion times
              </p>
            </div>

            <div className="space-y-2">
              <Badge className="bg-purple-100 text-purple-800">Smart Error Recovery</Badge>
              <p className="text-sm text-muted-foreground">
                Intelligent error handling with actionable suggestions and retry mechanisms
              </p>
            </div>

            <div className="space-y-2">
              <Badge className="bg-orange-100 text-orange-800">Non-blocking Operations</Badge>
              <p className="text-sm text-muted-foreground">
                Background sync with persistent indicators allowing free navigation
              </p>
            </div>

            <div className="space-y-2">
              <Badge className="bg-teal-100 text-teal-800">Contextual Messaging</Badge>
              <p className="text-sm text-muted-foreground">
                Appropriate notifications for single vs. bulk operations
              </p>
            </div>

            <div className="space-y-2">
              <Badge className="bg-pink-100 text-pink-800">User Confidence</Badge>
              <p className="text-sm text-muted-foreground">
                Clear communication eliminates uncertainty about operation status
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
