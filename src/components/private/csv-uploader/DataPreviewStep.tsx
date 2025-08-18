import React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { type ColumnMapping, formatCurrency } from "./csv-utils";

interface DataPreviewStepProps {
  data: Array<Record<string, string | number | undefined>>;
  mapping: ColumnMapping;
  onContinue: () => void;
  onBack: () => void;
}

export function DataPreviewStep({
  data,
  mapping,
  onContinue,
  onBack,
}: DataPreviewStepProps) {
  const previewData = data.slice(0, 10);
  const totalRows = data.length;

  const getCustomFieldValue = (
    record: Record<string, string | number | undefined>,
    fieldName: string
  ) => {
    return record[fieldName] || "";
  };

  const hasValidData =
    previewData.length > 0 &&
    previewData.some(
      (record) => record.description || record.amount || record.date
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Data Preview
          </h2>
          <p className="text-muted-foreground mt-1">
            Preview of your mapped data showing how transactions will be
            processed
          </p>
        </div>
        <Badge variant="secondary" className="text-sm">
          Showing {previewData.length} of {totalRows} rows
        </Badge>
      </div>

      {!hasValidData && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No valid transaction data found. Please check your column mapping
            and ensure your CSV contains transaction data.
          </AlertDescription>
        </Alert>
      )}

      {hasValidData && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Data looks good! {totalRows} transactions ready for import.
          </AlertDescription>
        </Alert>
      )}

      {/* Preview Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Transaction Preview</CardTitle>
          <CardDescription>
            First {previewData.length} transactions from your CSV file
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">#</th>
                  {mapping.transactionNumber && (
                    <th className="text-left p-3 font-medium">
                      Transaction Number
                    </th>
                  )}
                  <th className="text-left p-3 font-medium">Description</th>
                  <th className="text-left p-3 font-medium">Date</th>
                  <th className="text-right p-3 font-medium">Amount</th>
                  {mapping.balance && (
                    <th className="text-right p-3 font-medium">Balance</th>
                  )}
                  {Object.keys(mapping.customFields).map((fieldName) => (
                    <th key={fieldName} className="text-left p-3 font-medium">
                      {fieldName.replace("custom_", "Custom ")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewData.map((record, index) => (
                  <tr key={index} className="border-b hover:bg-muted/30">
                    <td className="p-3 text-sm text-muted-foreground">
                      {index + 1}
                    </td>
                    {mapping.transactionNumber && (
                      <td className="p-3 text-sm font-mono">
                        {record.transactionNumber}
                      </td>
                    )}
                    <td className="p-3 text-sm">{record.description}</td>
                    <td className="p-3 text-sm">{record.date}</td>
                    <td className="p-3 text-sm text-right font-mono">
                      <span
                        className={
                          typeof record.amount === "number" && record.amount < 0
                            ? "text-red-600"
                            : "text-green-600"
                        }
                      >
                        {typeof record.amount === "number"
                          ? formatCurrency(record.amount)
                          : record.amount}
                      </span>
                    </td>
                    {mapping.balance && (
                      <td className="p-3 text-sm text-right font-mono">
                        {record.balance}
                      </td>
                    )}
                    {Object.keys(mapping.customFields).map((fieldName) => (
                      <td key={fieldName} className="p-3 text-sm">
                        {getCustomFieldValue(record, fieldName)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalRows > 10 && (
            <div className="mt-4 text-center text-sm text-muted-foreground">
              ... and {totalRows - 10} more rows
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back to Mapping
        </Button>

        <Button
          onClick={onContinue}
          disabled={!hasValidData}
          className="min-w-[120px]"
        >
          Continue to Import
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
