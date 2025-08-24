"use client";

import React from "react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
// UI icon import unused here
import { useAccounts } from "@/hooks/useAccounts";

interface Props {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  selectTriggerClasses?: string;
  destructiveBorderClasses?: string;
}

export default function AccountSelectorDropdown({
  value,
  onChange,
  disabled = false,
  selectTriggerClasses = "flex h-10 w-full items-center justify-between rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:ring-offset-zinc-950 dark:placeholder:text-zinc-400 dark:focus:ring-zinc-300",
  destructiveBorderClasses = "border-red-500 dark:border-red-700",
}: Props) {
  const {
    accounts,
    loading: accountsLoading,
    error: accountsError,
  } = useAccounts();

  return (
    <div className="space-y-2">
      <Select
        value={value}
        onValueChange={onChange}
        disabled={disabled || accountsLoading}
      >
        <SelectTrigger
          className={`${selectTriggerClasses} ${
            !value ? destructiveBorderClasses : ""
          }`}
        >
          <SelectValue
            placeholder={
              accountsLoading ? "Loading accounts..." : "Select account..."
            }
          />
        </SelectTrigger>
        <SelectContent className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
          {accounts.map((account) => (
            <SelectItem key={account.id} value={account.id}>
              {account.name} {account.type ? `(${account.type})` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {accountsError && (
        <p className="text-sm text-red-500 dark:text-red-400">
          Error loading accounts: {accountsError}
        </p>
      )}
    </div>
  );
}
