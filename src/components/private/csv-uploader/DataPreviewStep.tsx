import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  AlertCircle,
  CheckCircle,
} from "lucide-react";

import { type ColumnMapping, formatCurrency } from "./csv-utils";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DataPreviewStepProps {
  data: Record<string, string | number | undefined>[];
  mapping: ColumnMapping;
  onContinue: () => void;
  onBack: () => void;
  totalRows: number;
}

export function DataPreviewStep({
  data,
  mapping,
  onContinue,
  onBack,
  totalRows,
}: DataPreviewStepProps) {
  const previewData = data.slice(0, 10);

  const getCustomFieldValue = (
    record: Record<string, string | number | undefined>,
    fieldName: string
  ) => {
    return record[fieldName] || "";
  };

  const hasValidData = previewData.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Eye className="h-8 w-8" />
          Data Preview
        </h1>
        <p className="text-muted-foreground mt-2">
          Preview of your mapped data showing how transactions will be processed
        </p>
      </div>

      {/* Content area */}
      <div className="space-y-6">
        <Badge variant="secondary" className="text-sm py-1 px-3">
          Showing {previewData.length} of {totalRows} rows
        </Badge>

        {!hasValidData && (
          <Alert variant="destructive" className="border-destructive/30">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No valid transaction data found. Please check your column mapping
              and ensure your CSV contains transaction data.
            </AlertDescription>
          </Alert>
        )}

        {hasValidData && (
          <Alert className="border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-800 dark:text-green-300">
              Data successfully processed and ready for import!
            </AlertDescription>
          </Alert>
        )}

        {/* Preview Table */}
        <div className="border shadow-sm rounded-lg">
          <div className="pl-6 pt-6 pb-4">
            <h2 className="text-xl font-semibold">Transaction Preview</h2>
            <p className="text-base text-muted-foreground">
              Preview of first {previewData.length} transactions from your CSV
              file ({totalRows} total)
            </p>
          </div>
          <div className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left pl-6 font-semibold text-sm uppercase tracking-wider text-muted-foreground py-3">
                      #
                    </th>
                    {mapping.transactionNumber && (
                      <th className="text-left p-3 font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                        Trans. Number
                      </th>
                    )}
                    <th className="text-left p-3 font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                      Description
                    </th>
                    <th className="text-left p-3 font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                      Date
                    </th>
                    <th className="text-right p-3 font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                      Amount
                    </th>
                    {mapping.balance && (
                      <th className="text-right p-3 font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                        Balance
                      </th>
                    )}
                    {Object.values(mapping.customFields).map((fieldName) => (
                      <th
                        key={fieldName}
                        className="text-left p-3 font-semibold text-sm uppercase tracking-wider text-muted-foreground"
                      >
                        {fieldName}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((record, index) => (
                    <tr
                      key={index}
                      className="border-b hover:bg-muted/30 transition-colors"
                    >
                      <td className="pl-6 py-3 text-sm text-muted-foreground">
                        {index + 1}
                      </td>
                      {mapping.transactionNumber && (
                        <td className="p-3 text-sm">
                          {record.transactionNumber || "—"}
                        </td>
                      )}
                      <td className="p-3 text-sm max-w-[200px] truncate">
                        {record.description || "—"}
                      </td>
                      <td className="p-3 text-sm">{record.date || "—"}</td>
                      <td className="p-3 text-sm text-right font-mono">
                        {record.formattedAmount || "—"}
                      </td>
                      {mapping.balance && (
                        <td className="p-3 text-sm text-right font-mono">
                          {record.balance
                            ? formatCurrency(Number(record.balance))
                            : "—"}
                        </td>
                      )}
                      {Object.values(mapping.customFields).map((fieldName) => (
                        <td key={fieldName} className="p-3 text-sm">
                          {getCustomFieldValue(record, fieldName) || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-6 border-t border-border">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back to Mapping
        </Button>

        <Button
          onClick={onContinue}
          disabled={!hasValidData}
          className="min-w-[140px]"
        >
          Continue to Import
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
