"use client";

import React from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Biohazard } from "lucide-react";
interface ColumnMappingAlertProps {
  isFormValid: boolean;
  transactionNumber?: string;
  description?: string;
  date?: string;
  amountColumns: string[];
  hasBalance: boolean;
  balance?: string;
}

export function ColumnMappingAlert({
  isFormValid,
//   transactionNumber,
//   description,
//   date,
//   amountColumns,
//   hasBalance,
//   balance,
}: ColumnMappingAlertProps) {
  if (isFormValid) return null;

  return (
    <>
      <Alert className="relative w-full justify-center rounded-lg border border-red-500 bg-red-50 text-sm text-red-800 dark:border-red-900 dark:bg-red-900/30 dark:text-red-300">
        <AlertTitle className="text-center"><strong>Please complete all required field mappings</strong></AlertTitle>
      </Alert>
    </>
  );
}

        //   <ul className="list-disc list-inside mt-1 gap-2">
        //     {!transactionNumber && <li>Transaction Number</li>}
        //     {!description && <li>Description</li>}
        //     {!date && <li>Date</li>}
        //     {amountColumns.length === 0 && <li>Amount</li>}
        //     {hasBalance && !balance && <li>Balance required</li>}
        //   </ul>;