"use client";

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  ReactNode,
} from "react";
import {
  accountToasts,
  SyncProgressData,
  BulkSyncProgressData,
} from "@/lib/notifications/account-notifications";

export interface AccountSyncState {
  isGlobalSyncActive: boolean;
  activeSyncs: Map<string, SyncProgressData>;
  bulkSyncData: BulkSyncProgressData | null;
  lastSyncTime: Date | null;
  backgroundProcesses: Array<{
    id: string;
    message: string;
    startTime: Date;
  }>;
}

export type AccountSyncAction =
  | { type: "START_ACCOUNT_SYNC"; payload: SyncProgressData }
  | { type: "UPDATE_ACCOUNT_SYNC"; payload: SyncProgressData }
  | {
      type: "COMPLETE_ACCOUNT_SYNC";
      payload: { accountName: string; newTransactions?: number };
    }
  | {
      type: "ERROR_ACCOUNT_SYNC";
      payload: { accountName: string; error: string };
    }
  | { type: "START_BULK_SYNC"; payload: BulkSyncProgressData }
  | { type: "UPDATE_BULK_SYNC"; payload: BulkSyncProgressData }
  | {
      type: "COMPLETE_BULK_SYNC";
      payload: {
        totalAccounts: number;
        totalTransactions?: number;
        failedAccounts?: string[];
      };
    }
  | { type: "ADD_BACKGROUND_PROCESS"; payload: { id: string; message: string } }
  | { type: "REMOVE_BACKGROUND_PROCESS"; payload: { id: string } }
  | { type: "CLEAR_ALL_SYNCS" };

const initialState: AccountSyncState = {
  isGlobalSyncActive: false,
  activeSyncs: new Map(),
  bulkSyncData: null,
  lastSyncTime: null,
  backgroundProcesses: [],
};

function accountSyncReducer(
  state: AccountSyncState,
  action: AccountSyncAction
): AccountSyncState {
  switch (action.type) {
    case "START_ACCOUNT_SYNC": {
      const newActiveSyncs = new Map(state.activeSyncs);
      newActiveSyncs.set(action.payload.accountName, action.payload);

      // Show toast notification
      accountToasts.syncProgress(action.payload);

      return {
        ...state,
        isGlobalSyncActive: true,
        activeSyncs: newActiveSyncs,
      };
    }

    case "UPDATE_ACCOUNT_SYNC": {
      const newActiveSyncs = new Map(state.activeSyncs);
      newActiveSyncs.set(action.payload.accountName, action.payload);

      // Update toast notification
      accountToasts.syncProgress(action.payload);

      return {
        ...state,
        activeSyncs: newActiveSyncs,
      };
    }

    case "COMPLETE_ACCOUNT_SYNC": {
      const newActiveSyncs = new Map(state.activeSyncs);
      newActiveSyncs.delete(action.payload.accountName);

      // Show completion toast
      accountToasts.syncComplete(
        action.payload.accountName,
        action.payload.newTransactions
      );

      return {
        ...state,
        activeSyncs: newActiveSyncs,
        isGlobalSyncActive:
          newActiveSyncs.size > 0 || state.bulkSyncData !== null,
        lastSyncTime: new Date(),
      };
    }

    case "ERROR_ACCOUNT_SYNC": {
      const newActiveSyncs = new Map(state.activeSyncs);
      newActiveSyncs.delete(action.payload.accountName);

      // Show error toast
      accountToasts.syncError(action.payload.accountName, action.payload.error);

      return {
        ...state,
        activeSyncs: newActiveSyncs,
        isGlobalSyncActive:
          newActiveSyncs.size > 0 || state.bulkSyncData !== null,
      };
    }

    case "START_BULK_SYNC": {
      return {
        ...state,
        isGlobalSyncActive: true,
        bulkSyncData: action.payload,
      };
    }

    case "UPDATE_BULK_SYNC": {
      // Update bulk sync progress toast
      accountToasts.bulkSyncProgress(action.payload);

      return {
        ...state,
        bulkSyncData: action.payload,
      };
    }

    case "COMPLETE_BULK_SYNC": {
      // Show completion toast
      accountToasts.bulkSyncComplete(
        action.payload.totalAccounts,
        action.payload.totalTransactions,
        action.payload.failedAccounts
      );

      return {
        ...state,
        isGlobalSyncActive: state.activeSyncs.size > 0,
        bulkSyncData: null,
        lastSyncTime: new Date(),
      };
    }

    case "ADD_BACKGROUND_PROCESS": {
      const newProcess = {
        id: action.payload.id,
        message: action.payload.message,
        startTime: new Date(),
      };

      // Show background process indicator
      accountToasts.backgroundProcess(action.payload.message);

      return {
        ...state,
        backgroundProcesses: [...state.backgroundProcesses, newProcess],
      };
    }

    case "REMOVE_BACKGROUND_PROCESS": {
      return {
        ...state,
        backgroundProcesses: state.backgroundProcesses.filter(
          (p) => p.id !== action.payload.id
        ),
      };
    }

    case "CLEAR_ALL_SYNCS": {
      // Clear all notifications
      accountToasts.clearAll();

      return {
        ...state,
        isGlobalSyncActive: false,
        activeSyncs: new Map(),
        bulkSyncData: null,
        backgroundProcesses: [],
      };
    }

    default:
      return state;
  }
}

interface AccountSyncContextType {
  state: AccountSyncState;
  dispatch: React.Dispatch<AccountSyncAction>;
  // Convenience methods
  startAccountSync: (data: SyncProgressData) => void;
  updateAccountSync: (data: SyncProgressData) => void;
  completeAccountSync: (accountName: string, newTransactions?: number) => void;
  errorAccountSync: (accountName: string, error: string) => void;
  startBulkSync: (data: BulkSyncProgressData) => void;
  updateBulkSync: (data: BulkSyncProgressData) => void;
  completeBulkSync: (
    totalAccounts: number,
    totalTransactions?: number,
    failedAccounts?: string[]
  ) => void;
  addBackgroundProcess: (id: string, message: string) => void;
  removeBackgroundProcess: (id: string) => void;
  clearAllSyncs: () => void;
  // Status checks
  isAccountSyncing: (accountName: string) => boolean;
  isBulkSyncing: () => boolean;
  hasActiveOperations: () => boolean;
  getSyncProgress: () => number;
}

const AccountSyncContext = createContext<AccountSyncContextType | undefined>(
  undefined
);

export function useAccountSync(): AccountSyncContextType {
  const context = useContext(AccountSyncContext);
  if (!context) {
    throw new Error(
      "useAccountSync must be used within an AccountSyncProvider"
    );
  }
  return context;
}

interface AccountSyncProviderProps {
  children: ReactNode;
}

export function AccountSyncProvider({ children }: AccountSyncProviderProps) {
  const [state, dispatch] = useReducer(accountSyncReducer, initialState);

  // Auto-cleanup background processes after 5 minutes of inactivity
  useEffect(() => {
    const cleanup = setInterval(() => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      state.backgroundProcesses.forEach((process) => {
        if (process.startTime < fiveMinutesAgo) {
          dispatch({
            type: "REMOVE_BACKGROUND_PROCESS",
            payload: { id: process.id },
          });
        }
      });
    }, 60000); // Check every minute

    return () => clearInterval(cleanup);
  }, [state.backgroundProcesses]);

  // Convenience methods
  const startAccountSync = (data: SyncProgressData) => {
    dispatch({ type: "START_ACCOUNT_SYNC", payload: data });
  };

  const updateAccountSync = (data: SyncProgressData) => {
    dispatch({ type: "UPDATE_ACCOUNT_SYNC", payload: data });
  };

  const completeAccountSync = (
    accountName: string,
    newTransactions?: number
  ) => {
    dispatch({
      type: "COMPLETE_ACCOUNT_SYNC",
      payload: { accountName, newTransactions },
    });
  };

  const errorAccountSync = (accountName: string, error: string) => {
    dispatch({ type: "ERROR_ACCOUNT_SYNC", payload: { accountName, error } });
  };

  const startBulkSync = (data: BulkSyncProgressData) => {
    dispatch({ type: "START_BULK_SYNC", payload: data });
  };

  const updateBulkSync = (data: BulkSyncProgressData) => {
    dispatch({ type: "UPDATE_BULK_SYNC", payload: data });
  };

  const completeBulkSync = (
    totalAccounts: number,
    totalTransactions?: number,
    failedAccounts?: string[]
  ) => {
    dispatch({
      type: "COMPLETE_BULK_SYNC",
      payload: { totalAccounts, totalTransactions, failedAccounts },
    });
  };

  const addBackgroundProcess = (id: string, message: string) => {
    dispatch({ type: "ADD_BACKGROUND_PROCESS", payload: { id, message } });
  };

  const removeBackgroundProcess = (id: string) => {
    dispatch({ type: "REMOVE_BACKGROUND_PROCESS", payload: { id } });
  };

  const clearAllSyncs = () => {
    dispatch({ type: "CLEAR_ALL_SYNCS" });
  };

  // Status check methods
  const isAccountSyncing = (accountName: string) => {
    return state.activeSyncs.has(accountName);
  };

  const isBulkSyncing = () => {
    return state.bulkSyncData !== null;
  };

  const hasActiveOperations = () => {
    return state.isGlobalSyncActive || state.backgroundProcesses.length > 0;
  };

  const getSyncProgress = () => {
    if (state.bulkSyncData) {
      return Math.round(
        (state.bulkSyncData.completedAccounts /
          state.bulkSyncData.totalAccounts) *
          100
      );
    }
    if (state.activeSyncs.size > 0) {
      const totalSteps = Array.from(state.activeSyncs.values()).reduce(
        (sum, sync) => sum + sync.totalSteps,
        0
      );
      const completedSteps = Array.from(state.activeSyncs.values()).reduce(
        (sum, sync) => sum + (sync.step - 1),
        0
      );
      return Math.round((completedSteps / totalSteps) * 100);
    }
    return 0;
  };

  const contextValue: AccountSyncContextType = {
    state,
    dispatch,
    startAccountSync,
    updateAccountSync,
    completeAccountSync,
    errorAccountSync,
    startBulkSync,
    updateBulkSync,
    completeBulkSync,
    addBackgroundProcess,
    removeBackgroundProcess,
    clearAllSyncs,
    isAccountSyncing,
    isBulkSyncing,
    hasActiveOperations,
    getSyncProgress,
  };

  return (
    <AccountSyncContext.Provider value={contextValue}>
      {children}
    </AccountSyncContext.Provider>
  );
}
