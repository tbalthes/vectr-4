"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { accountToasts } from "@/lib/notifications/account-notifications";

/**
 * Demo component showcasing the account notification system
 * This demonstrates all the different types of notifications available
 */
export function AccountNotificationDemo() {
  const [isRunning, setIsRunning] = useState(false);
  const [demoAccount] = useState("Chase Checking");
  const [demoAccounts] = useState([
    "Chase Checking",
    "Wells Fargo Savings",
    "Citi Credit Card",
  ]);

  // Mock API calls - simulate network delays and possible failures
  const mockSyncAccount = async (): Promise<{
    success: boolean;
    newTransactions?: number;
    error?: string;
  }> => {
    const delay = Math.random() * 3000 + 1000; // 1-4 seconds
    await new Promise((resolve) => setTimeout(resolve, delay));

    // 80% success rate
    if (Math.random() < 0.8) {
      return {
        success: true,
        newTransactions: Math.floor(Math.random() * 15),
      };
    } else {
      return {
        success: false,
        error: "Connection timeout",
      };
    }
  };

  const mockConnectAccount = async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    const delay = Math.random() * 2000 + 500; // 0.5-2.5 seconds
    await new Promise((resolve) => setTimeout(resolve, delay));

    // 90% success rate for connections
    if (Math.random() < 0.9) {
      return { success: true };
    } else {
      return {
        success: false,
        error: "Invalid credentials",
      };
    }
  };

  // Demo actions
  const handleSingleSync = async () => {
    setIsRunning(true);

    // Show progress
    const progressToastId = accountToasts.syncProgress({
      accountName: demoAccount,
      step: 1,
      totalSteps: 3,
      currentOperation: "Fetching transactions",
      estimatedTime: "2-3 minutes",
    });

    // Simulate progress updates
    setTimeout(() => {
      accountToasts.syncProgress({
        accountName: demoAccount,
        step: 2,
        totalSteps: 3,
        currentOperation: "Processing transactions",
        estimatedTime: "1-2 minutes",
      });
    }, 1500);

    try {
      const result = await mockSyncAccount();
      accountToasts.clear(progressToastId);

      if (result.success) {
        accountToasts.syncComplete(demoAccount, result.newTransactions);
      } else {
        accountToasts.syncError(
          demoAccount,
          result.error || "Unknown error",
          true
        );
      }
    } catch {
      accountToasts.clear(progressToastId);
      accountToasts.syncError(demoAccount, "Network error", true);
    }

    setIsRunning(false);
  };

  const handleBulkSync = async () => {
    setIsRunning(true);

    // Show warning first
    accountToasts.connectionWarning(demoAccounts.length, "5-8 minutes");

    // Wait a bit then start bulk sync
    setTimeout(async () => {
      const results: Array<{
        account: string;
        success: boolean;
        newTransactions?: number;
        error?: string;
      }> = [];
      let completedCount = 0;

      // Start bulk sync progress
      accountToasts.bulkSyncProgress({
        totalAccounts: demoAccounts.length,
        completedAccounts: 0,
        currentAccount: demoAccounts[0],
        estimatedTime: "5-8 minutes",
      });

      // Process each account
      for (const account of demoAccounts) {
        try {
          accountToasts.bulkSyncProgress({
            totalAccounts: demoAccounts.length,
            completedAccounts: completedCount,
            currentAccount: account,
            estimatedTime: `${Math.max(1, 8 - completedCount * 2)} minutes`,
          });

          const result = await mockSyncAccount();
          completedCount++;

          results.push({
            account,
            success: result.success,
            newTransactions: result.newTransactions,
            error: result.error,
          });

          // Update progress
          accountToasts.bulkSyncProgress({
            totalAccounts: demoAccounts.length,
            completedAccounts: completedCount,
            failedAccounts: results
              .filter((r) => !r.success)
              .map((r) => r.account),
          });

          // Show retry suggestion for failed accounts
          if (!result.success) {
            accountToasts.retrySuggestion(account, 1);
          }
        } catch {
          completedCount++;
          results.push({
            account,
            success: false,
            error: "Network error",
          });
        }
      }

      // Show completion
      const totalTransactions = results
        .filter((r) => r.success)
        .reduce((sum, r) => sum + (r.newTransactions || 0), 0);

      const failedAccounts = results
        .filter((r) => !r.success)
        .map((r) => r.account);

      accountToasts.bulkSyncComplete(
        demoAccounts.length,
        totalTransactions,
        failedAccounts
      );

      setIsRunning(false);
    }, 2000);
  };

  const handleConnectAccount = async () => {
    setIsRunning(true);

    try {
      const result = await mockConnectAccount();

      if (result.success) {
        accountToasts.connected("New Bank Account", "Starting initial sync...");

        // Simulate initial sync after connection
        setTimeout(() => {
          accountToasts.syncComplete("New Bank Account", 45);
        }, 3000);
      } else {
        accountToasts.syncError(
          "New Bank Account",
          result.error || "Connection failed"
        );
      }
    } catch {
      accountToasts.syncError("New Bank Account", "Network error");
    }

    setIsRunning(false);
  };

  const handleDisconnectAccount = () => {
    accountToasts.disconnected(demoAccount);
  };

  const handleRenameAccount = () => {
    const newName = "Chase Primary Checking";
    accountToasts.renamed(demoAccount, newName);
  };

  const handleBackgroundProcess = () => {
    accountToasts.backgroundProcess(
      "Categorizing transactions in background..."
    );

    // Simulate background completion
    setTimeout(() => {
      accountToasts.bulkSuccess(150, "categorization");
    }, 4000);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🔔 Account Notification System Demo
            {isRunning && <Badge variant="secondary">Running</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This demo showcases the comprehensive notification system for
            account operations. Click the buttons below to see different types
            of notifications in action.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <Button
              onClick={handleSingleSync}
              disabled={isRunning}
              variant="default"
            >
              🔄 Single Account Sync
            </Button>

            <Button
              onClick={handleBulkSync}
              disabled={isRunning}
              variant="default"
            >
              🔄 Bulk Account Sync
            </Button>

            <Button
              onClick={handleConnectAccount}
              disabled={isRunning}
              variant="outline"
            >
              🔗 Connect Account
            </Button>

            <Button
              onClick={handleDisconnectAccount}
              disabled={isRunning}
              variant="outline"
            >
              🔌 Disconnect Account
            </Button>

            <Button
              onClick={handleRenameAccount}
              disabled={isRunning}
              variant="outline"
            >
              ✏️ Rename Account
            </Button>

            <Button
              onClick={handleBackgroundProcess}
              disabled={isRunning}
              variant="secondary"
            >
              ⚙️ Background Process
            </Button>
          </div>

          <div className="pt-4 border-t">
            <h4 className="font-medium mb-2">Features Demonstrated:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Progress indicators with live updates</li>
              <li>• Success/error notifications with retry options</li>
              <li>• Bulk operation progress tracking</li>
              <li>• Warning dialogs for long operations</li>
              <li>• Background process indicators</li>
              <li>• Connection status notifications</li>
              <li>• Persistent toast management</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
