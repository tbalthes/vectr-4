"use client";

import React from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export interface AccountNotificationOptions {
  id?: string;
  duration?: number;
  dismissible?: boolean;
  persistent?: boolean;
  position?:
    | "top-left"
    | "top-center"
    | "top-right"
    | "bottom-left"
    | "bottom-center"
    | "bottom-right";
}

export interface SyncProgressData {
  accountName: string;
  step: number;
  totalSteps: number;
  currentOperation: string;
  estimatedTime?: string;
}

export interface BulkSyncProgressData {
  totalAccounts: number;
  completedAccounts: number;
  currentAccount?: string;
  estimatedTime?: string;
  failedAccounts?: string[];
}

/**
 * Enhanced Toast Notification System for Account Operations
 * Provides comprehensive feedback for all account-related actions
 */
export class AccountNotifications {
  private static activeToasts = new Map<string, string>();
  private static syncToastId: string | null = null;
  private static bulkSyncToastId: string | null = null;

  /**
   * Account Connection Success - Bottom-right dismissible popup
   */
  static connectionSuccess(accountName: string, syncMessage?: string): void {
    toast.success(
      `✅ ${accountName} connected successfully!${
        syncMessage ? ` ${syncMessage}` : ""
      }`,
      {
        duration: 5000,
        dismissible: true,
        position: "bottom-right",
        description: syncMessage || "Syncing your accounts...",
        action: {
          label: "View Account",
          onClick: () => console.log("Navigate to account details"),
        },
      }
    );
  }

  /**
   * Account Disconnection
   */
  static disconnectionSuccess(accountName: string): void {
    toast.success(`🔗 ${accountName} disconnected`, {
      duration: 4000,
      description: "Your data remains secure",
    });
  }

  /**
   * Account Nickname Updates
   */
  static nicknameUpdated(oldName: string, newName: string): void {
    toast.success(`✏️ Account renamed to "${newName}"`, {
      duration: 3000,
      description: `Previously "${oldName}"`,
    });
  }

  /**
   * Bulk Operations Success
   */
  static bulkOperationSuccess(accountCount: number, operation: string): void {
    toast.success(`📊 ${accountCount} accounts ${operation} successfully`, {
      duration: 4000,
      description: "All operations completed",
    });
  }

  /**
   * Single Account Sync Progress - Bottom-right dismissible popup
   */
  static accountSyncProgress(data: SyncProgressData): string {
    const toastId = `sync-${data.accountName}`;
    const message = `🔄 Syncing ${data.accountName}... Step ${data.step} of ${data.totalSteps}`;
    const description = `${data.currentOperation}${
      data.estimatedTime ? ` • Est. ${data.estimatedTime} remaining` : ""
    }`;

    const existingId = this.activeToasts.get(toastId);

    // Use a stable ID for both create and update to avoid duplicates
    const id = toast.loading(message, {
      id: existingId || toastId,
      duration: Infinity,
      description,
      dismissible: true, // Allow user to dismiss
      position: "bottom-right", // Bottom-right corner
      icon: React.createElement(Loader2, { className: "h-4 w-4 animate-spin" }),
      action: {
        label: "Dismiss",
        onClick: () => toast.dismiss(existingId || toastId),
      },
    });
    const idStr = String(id);
    this.activeToasts.set(toastId, idStr);
    return idStr;
  }

  /**
   * Bulk Account Sync Progress - Bottom-right dismissible popup
   */
  static bulkSyncProgress(data: BulkSyncProgressData): string {
    const progressPercentage = Math.round(
      (data.completedAccounts / data.totalAccounts) * 100
    );
    const message = `🔄 Syncing accounts... ${data.completedAccounts} of ${data.totalAccounts} complete (${progressPercentage}%)`;

    let description = "";
    if (data.currentAccount) {
      description += `Currently: ${data.currentAccount}`;
    }
    if (data.estimatedTime) {
      description += `${description ? " • " : ""}Est. ${
        data.estimatedTime
      } remaining`;
    }
    if (data.failedAccounts && data.failedAccounts.length > 0) {
      description += `${description ? " • " : ""}${
        data.failedAccounts.length
      } failed`;
    }

    // Always use a stable ID for bulk sync to prevent duplicates
    const stableId = "bulk-sync";
    const initialMessage = `🔄 Syncing ${data.totalAccounts} accounts... This may take 2-3 minutes`;
    const id = toast.loading(
      data.completedAccounts === 0 ? initialMessage : message,
      {
        id: this.bulkSyncToastId || stableId,
        duration: Infinity,
        description,
        dismissible: true, // Allow user to dismiss
        position: "bottom-right", // Bottom-right corner
        icon: React.createElement(Loader2, {
          className: "h-4 w-4 animate-spin",
        }),
        action: {
          label: "Dismiss",
          onClick: () => toast.dismiss(this.bulkSyncToastId || stableId),
        },
      }
    );
    this.bulkSyncToastId = String(id);
    return this.bulkSyncToastId;
  }

  /**
   * Account Sync Completion - Bottom-right dismissible popup
   */
  static syncComplete(accountName: string, newTransactions?: number): void {
    const toastId = `sync-${accountName}`;
    const existingId = this.activeToasts.get(toastId);

    const message = `✅ ${accountName} synced successfully!`;
    const description =
      newTransactions && newTransactions > 0
        ? `${newTransactions} new transaction${
            newTransactions > 1 ? "s" : ""
          } found`
        : undefined;

    if (existingId) {
      toast.success(message, {
        id: existingId,
        duration: 4000,
        dismissible: true,
        position: "bottom-right",
        description,
      });
      this.activeToasts.delete(toastId);
    } else {
      this.connectionSuccess(accountName, description);
    }
  }

  /**
   * Bulk Sync Completion
   */
  static bulkSyncComplete(
    totalAccounts: number,
    totalTransactions?: number,
    failedAccounts?: string[]
  ): void {
    const successCount = totalAccounts - (failedAccounts?.length || 0);
    const message = `✅ All accounts synced! ${successCount} of ${totalAccounts} successful`;

    let description = "";
    if (totalTransactions && totalTransactions > 0) {
      description += `${totalTransactions} new transactions found`;
    }
    if (failedAccounts && failedAccounts.length > 0) {
      description += `${description ? " • " : ""}${
        failedAccounts.length
      } failed: ${failedAccounts.join(", ")}`;
    }

    const id = this.bulkSyncToastId || "bulk-sync";
    toast.success(message, {
      id,
      duration: 6000,
      description,
      action:
        failedAccounts && failedAccounts.length > 0
          ? {
              label: "Retry Failed",
              onClick: () => console.log("Retry failed syncs"),
            }
          : undefined,
    });
    this.bulkSyncToastId = null;
  }

  /**
   * Error Handling with Recovery Options
   */
  static syncError(
    accountName: string,
    errorMessage: string,
    canRetry = true
  ): void {
    const toastId = `sync-${accountName}`;
    const existingId = this.activeToasts.get(toastId);

    const message = `⚠️ Unable to sync ${accountName}`;
    const description = `${errorMessage}${
      canRetry ? " • Try individual refresh if bulk sync fails" : ""
    }`;

    const toastOptions = {
      duration: 8000,
      description,
      action: canRetry
        ? {
            label: "Retry",
            onClick: () => console.log(`Retry sync for ${accountName}`),
          }
        : undefined,
      cancel: {
        label: "Dismiss",
        onClick: () => console.log("Dismissed error"),
      },
    };

    if (existingId) {
      toast.error(message, { ...toastOptions, id: existingId });
      this.activeToasts.delete(toastId);
    } else {
      toast.error(message, toastOptions);
    }
  }

  /**
   * Connection Pre-Warning
   */
  static connectionWarning(accountCount: number, estimatedTime: string): void {
    const message =
      accountCount === 1
        ? "⏳ This will refresh 1 account"
        : `⏳ This will refresh all ${accountCount} accounts`;

    toast.warning(message, {
      duration: 5000,
      description: `Typically takes ${estimatedTime}`,
      action: {
        label: "Continue",
        onClick: () => console.log("User confirmed bulk sync"),
      },
      cancel: {
        label: "Cancel",
        onClick: () => console.log("User cancelled bulk sync"),
      },
    });
  }

  /**
   * Retry Suggestion
   */
  static retrySuggestion(accountName: string, attempt: number): void {
    toast.info(`🔄 Retry suggested for ${accountName}`, {
      description: `Attempt ${attempt} - Try individual refresh if bulk sync continues to fail.`,
      action: {
        label: "Retry",
        onClick: () => {
          toast.loading(`Retrying ${accountName}...`);
        },
      },
      duration: 8000,
    });
  }

  /**
   * Background Process Indicator (for navigation header)
   */
  static backgroundProcessIndicator(message: string): string {
    const id = toast.loading(`🔄 ${message}`, {
      duration: Infinity,
      position: "bottom-right",
    });
    return String(id);
  }

  /**
   * Clear all active notifications
   */
  static clearAll(): void {
    this.activeToasts.clear();
    this.syncToastId = null;
    this.bulkSyncToastId = null;
    toast.dismiss();
  }

  /**
   * Clear specific notification
   */
  static clear(toastId: string): void {
    toast.dismiss(toastId);
    this.activeToasts.forEach((id, key) => {
      if (id === toastId) {
        this.activeToasts.delete(key);
      }
    });
    if (this.syncToastId === toastId) {this.syncToastId = null;}
    if (this.bulkSyncToastId === toastId) {this.bulkSyncToastId = null;}
  }
}

/**
 * Convenience functions for common operations
 */
export const accountToasts = {
  // Connection operations
  connected: (accountName: string, syncMessage?: string) =>
    AccountNotifications.connectionSuccess(accountName, syncMessage),

  disconnected: (accountName: string) =>
    AccountNotifications.disconnectionSuccess(accountName),

  renamed: (oldName: string, newName: string) =>
    AccountNotifications.nicknameUpdated(oldName, newName),

  // Sync operations
  syncProgress: (data: SyncProgressData) =>
    AccountNotifications.accountSyncProgress(data),

  bulkSyncProgress: (data: BulkSyncProgressData) =>
    AccountNotifications.bulkSyncProgress(data),

  syncComplete: (accountName: string, newTransactions?: number) =>
    AccountNotifications.syncComplete(accountName, newTransactions),

  bulkSyncComplete: (
    totalAccounts: number,
    totalTransactions?: number,
    failedAccounts?: string[]
  ) =>
    AccountNotifications.bulkSyncComplete(
      totalAccounts,
      totalTransactions,
      failedAccounts
    ),

  // Error handling
  syncError: (accountName: string, errorMessage: string, canRetry?: boolean) =>
    AccountNotifications.syncError(accountName, errorMessage, canRetry),

  retrySuggestion: (accountName: string, attempt: number) =>
    AccountNotifications.retrySuggestion(accountName, attempt),

  connectionWarning: (accountCount: number, estimatedTime: string) =>
    AccountNotifications.connectionWarning(accountCount, estimatedTime),

  // Background processes
  backgroundProcess: (message: string) =>
    AccountNotifications.backgroundProcessIndicator(message),

  // Bulk operations
  bulkSuccess: (accountCount: number, operation: string) =>
    AccountNotifications.bulkOperationSuccess(accountCount, operation),

  // Utility
  clearAll: () => AccountNotifications.clearAll(),
  clear: (toastId: string) => AccountNotifications.clear(toastId),
};
