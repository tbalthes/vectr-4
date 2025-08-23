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
      <Card className="space-y-6 p-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-3 text-2xl font-bold">
              <Eye className="h-8 w-8 text-primary" />
              Data Preview
            </CardTitle>
            <CardDescription className="text-base">
              Preview of your mapped data showing how transactions will be
              processed
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-sm py-1 px-3">
            Showing {previewData.length} of {totalRows} rows
          </Badge>
        </CardHeader>
        <CardContent className="space-y-6 pb-6">
          {!hasValidData && (
            <Alert variant="destructive" className="border-destructive/30">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No valid transaction data found. Please check your column
                mapping and ensure your CSV contains transaction data.
              </AlertDescription>
            </Alert>
          )}

          {hasValidData && (
            <Alert className="border-success/30 bg-success/10">
              <CheckCircle className="h-4 w-4 text-success" />
              <AlertDescription className="text-success">
                Data looks good! {totalRows} transactions ready for import.
              </AlertDescription>
            </Alert>
          )}

          {/* Preview Table */}
          <Card className="border shadow-sm">
            <CardHeader className="pl-5 pt-5 pb-3">
              <CardTitle className="text-lg font-semibold">
                Transaction Preview
              </CardTitle>
              <CardDescription>
                First {previewData.length} transactions from your CSV file
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left pl-3 font-medium text-sm uppercase tracking-wider text-muted-foreground">
                        #
                      </th>
                      {mapping.transactionNumber && (
                        <th className="text-left p-2 font-medium text-sm/3 uppercase tracking-wider text-muted-foreground">
                          Trans. Number
                        </th>
                      )}
                      <th className="text-left p-2 font-medium text-sm uppercase tracking-wider text-muted-foreground">
                        Description
                      </th>
                      <th className="text-left p-2 font-medium text-sm uppercase tracking-wider text-muted-foreground">
                        Date
                      </th>
                      <th className="text-right p-2 font-medium text-sm uppercase tracking-wider text-muted-foreground">
                        Amount
                      </th>
                      {mapping.balance && (
                        <th className="text-right p-2 font-medium text-sm uppercase tracking-wider text-muted-foreground">
                          Balance
                        </th>
                      )}
                      {Object.entries(mapping.customFields)
                        .filter(
                          ([, columnName]) =>
                            columnName && columnName.trim() !== ""
                        )
                        .map(([fieldName, columnName]) => (
                          <th
                            key={fieldName}
                            className="text-left p-2 font-medium text-sm uppercase tracking-wider text-muted-foreground"
                          >
                            {columnName}
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
                        <td className="p-3 text-sm text-muted-foreground">
                          {index + 1}
                        </td>
                        {mapping.transactionNumber && (
                          <td className="p-3 text-sm font-mono">
                            {record.transactionNumber}
                          </td>
                        )}
                        <td className="p-3 text-sm font-medium">
                          {record.description}
                        </td>
                        <td className="p-3 text-sm">{record.date}</td>
                        <td className="p-3 text-sm text-right font-mono tabular-nums">
                          <span
                            className={
                              typeof record.amount === "number" &&
                              record.amount < 0
                                ? "text-destructive font-medium"
                                : typeof record.amount === "number" &&
                                  record.amount > 0
                                ? "text-success font-medium"
                                : "text-muted-foreground font-medium"
                            }
                          >
                            {record.formattedAmount ||
                              (typeof record.amount === "number"
                                ? formatCurrency(record.amount)
                                : "$0.00")}
                          </span>
                        </td>
                        {mapping.balance && (
                          <td className="p-3 text-sm text-right font-mono tabular-nums">
                            {record.balance}
                          </td>
                        )}
                        {Object.entries(mapping.customFields)
                          .filter(
                            ([, columnName]) =>
                              columnName && columnName.trim() !== ""
                          )
                          .map(([fieldName, columnName]) => (
                            <td key={fieldName} className="p-3 text-sm">
                              {getCustomFieldValue(record, columnName)}
                            </td>
                          ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalRows > 10 && (
                <div className="mt-4 text-center text-sm text-muted-foreground py-3 border-t">
                  ... and {totalRows - 10} more rows
                </div>
              )}
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="sticky bottom-0 left-0 right-0 bg-background pt-4 pb-4 z-20 flex justify-between border-t border-border mt-8">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back to Mapping
        </Button>

        <Button
          onClick={onContinue}
          disabled={!hasValidData}
          className="min-w-[140px] gap-2"
        >
          Continue to Import
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
