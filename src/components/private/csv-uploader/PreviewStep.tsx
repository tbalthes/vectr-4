import React from "react";
import { SupabaseClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  ChevronLeft,
  Eye,
  Download,
  CheckCircle,
  DollarSign,
} from "lucide-react";
import { type ColumnMapping } from "./csv-utils";

interface PreviewStepProps {
  data: Array<Record<string, string | number | undefined>>;
  mapping: ColumnMapping;
  user_id: string;
  account_id: string;
  supabase?: SupabaseClient;
  onComplete: () => void;
  onBack: () => void;
  onCancel?: () => void;
}

export function PreviewStep({
  data,
  mapping,
  user_id,
  account_id,
  supabase,
  onComplete,
  onBack,
  onCancel,
}: PreviewStepProps) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [effectiveUserId] = React.useState<string | null>(user_id || null);
  const [resolvingUserId, setResolvingUserId] = React.useState(false);

  const previewData = data.slice(0, 10);

  // Pull ordered custom field column names for display (custom_1, custom_2, ...)
  const customFieldList: string[] = Object.values(mapping.customFields || {});

  const getCustomFieldValue = (
    record: Record<string, string | number | undefined>,
    fieldName: string
  ) => {
    return record[fieldName] || "—";
  };

  const getAmountClass = (amount: number) => {
    if (amount > 0) return "text-green-600 dark:text-green-500";
    if (amount < 0) return "text-red-600 dark:text-red-500";
    return "text-muted-foreground";
  };

  const handleImport = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    console.log(
      "Starting import with user_id:",
      user_id,
      "account_id:",
      account_id
    );

    try {
      // Prefer resolved effectiveUserId from component state. As a last resort try fetching.
      let payloadUserId = effectiveUserId;
      if (!payloadUserId && supabase) {
        try {
          setResolvingUserId(true);
          const { data: userData } = await supabase.auth.getUser();
          const fetchedUser = userData?.user;
          if (fetchedUser?.id) payloadUserId = fetchedUser.id;
        } catch {
          // ignore and let validation handle it
        } finally {
          setResolvingUserId(false);
        }
      }

      // If we still don't have a user id, abort early with a clear client-side error
      if (!payloadUserId) {
        console.error("Import aborted: no authenticated user id available");
        setError("You must be signed in to complete the import.");
        setLoading(false);
        return;
      }

      const payload = {
        user_id: payloadUserId,
        account_id,
        transactions: data.map((row) => {
          const {
            transactionNumber,
            description,
            date,
            amount,
            balance,
            ...rest
          } = row;

          // Filter out undefined values and format user_metadata
          const user_metadata: Record<string, string | number> = {};
          Object.entries(rest).forEach(([key, value]) => {
            // Skip system fields that shouldn't be in user_metadata
            const isSystemField =
              key.startsWith("_") ||
              key.toLowerCase().includes("rowindex") ||
              key.toLowerCase().includes("formattedamount") ||
              key.toLowerCase().includes("index");

            if (
              !isSystemField &&
              value !== undefined &&
              value !== null &&
              value !== ""
            ) {
              user_metadata[key] = value;
            }
          });

          return {
            date: date as string,
            transaction_number: parseFloat(transactionNumber as string) || 0,
            description: description as string,
            amount: amount as number,
            balance: balance ? parseFloat(balance as string) : undefined,
            user_metadata,
          };
        }),
      };

      console.log("Sending payload:", payload);

      const url = "/api/upload-transactions";
      console.log("Making POST request to Next.js API route:", url);

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      console.log("Response status:", res.status);
      console.log(
        "Response headers:",
        Object.fromEntries(res.headers.entries())
      );

      if (!res.ok) {
        const err = await res.text();
        console.error("API Error:", err);
        throw new Error(err || `HTTP ${res.status}`);
      }

      const result = await res.json();
      console.log("API Response:", result);

      setSuccess(true);
      setTimeout(() => {
        onComplete();
      }, 1000);
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(e.message || "Upload failed");
      } else {
        setError("Upload failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Eye className="w-8 h-8" />
          Preview Import
        </h1>
        <p className="text-muted-foreground mt-2">
          Review your mapped data before completing the import. Check that the
          columns are correctly mapped and the data looks accurate.
        </p>
      </div>

      {/* Import Summary */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">
          Import Summary
        </h2>
        <p className="text-sm text-muted-foreground">
          Overview of your data import
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-foreground">
              Total Records
            </h4>
            <div className="text-2xl font-semibold text-foreground">
              {data.length}
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium text-foreground">
              Amount Columns
            </h4>
            <div className="flex flex-wrap gap-1">
              {mapping.amountColumns.map((column) => (
                <Badge
                  key={column}
                  className="border-transparent bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                >
                  <DollarSign className="w-3 h-3 mr-1" />
                  {column}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium text-foreground">
              Custom Fields
            </h4>
            <div className="text-sm text-muted-foreground">
              {Object.keys(mapping.customFields).length} custom fields mapped
            </div>
          </div>
        </div>

        <Separator className="bg-border" />

        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground">
            Field Mappings
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-foreground">
            <div className="space-y-2">
              <div className="flex items-center gap-6">
                <span>Transaction Number:</span>
                <Badge variant="secondary">
                  {mapping.transactionNumber ?? "—"}
                </Badge>
              </div>
              <div className="flex items-center gap-6">
                <span>Description:</span>
                <Badge variant="secondary">{mapping.description ?? "—"}</Badge>
              </div>
              <div className="flex items-center gap-6">
                <span>Date:</span>
                <Badge variant="secondary">{mapping.date ?? "—"}</Badge>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-6">
                <span>Amount:</span>
                <Badge variant="secondary">
                  {mapping.amountColumns && mapping.amountColumns.length
                    ? mapping.amountColumns.join(", ")
                    : "—"}
                </Badge>
              </div>
              <div className="flex items-center gap-6">
                <span>Custom 1:</span>
                <Badge variant="secondary">{customFieldList[0] ?? "—"}</Badge>
              </div>
              <div className="flex items-center gap-6">
                <span>Custom 2:</span>
                <Badge variant="secondary">{customFieldList[1] ?? "—"}</Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Data Preview */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Data Preview</h2>
        <p className="text-sm text-muted-foreground">
          First {Math.min(10, data.length)} of {data.length} records
        </p>

        {data.length === 0 ? (
          <Alert className="border-border bg-muted/30 text-foreground">
            <AlertDescription className="text-sm">
              No data records found. Please check your CSV file and column
              mappings.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden bg-background">
            <div className="max-h-96 overflow-auto">
              <div className="min-w-full">
                <div className="flex bg-muted/50 border-b border-border sticky top-0 z-10">
                  <div className="w-12 flex-shrink-0 bg-muted border-r border-border flex items-center justify-center py-3 text-xs text-muted-foreground font-medium">
                    #
                  </div>
                  <div className="flex-1 flex min-w-0">
                    <div className="w-32 flex-shrink-0 border-r border-border px-3 py-3 text-left text-xs font-medium text-muted-foreground">
                      Transaction #
                    </div>
                    <div className="w-48 flex-shrink-0 border-r border-border px-3 py-3 text-left text-xs font-medium text-muted-foreground">
                      Description
                    </div>
                    <div className="w-28 flex-shrink-0 border-r border-border px-3 py-3 text-left text-xs font-medium text-muted-foreground">
                      Date
                    </div>
                    <div className="w-24 flex-shrink-0 border-r border-border px-3 py-3 text-right text-xs font-medium text-muted-foreground">
                      Amount
                    </div>
                    {Object.entries(mapping.customFields).map(
                      ([fieldName, columnName], index) => (
                        <div
                          key={fieldName}
                          className={`w-32 flex-shrink-0 px-3 py-3 text-left text-xs font-medium text-muted-foreground ${
                            index < Object.keys(mapping.customFields).length - 1
                              ? "border-r border-border"
                              : ""
                          }`}
                        >
                          {columnName}
                        </div>
                      )
                    )}
                  </div>
                </div>

                {previewData.map((record, index) => (
                  <div
                    key={index}
                    className="flex border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                  >
                    <div className="w-12 flex-shrink-0 bg-muted/30 border-r border-border flex items-center justify-center py-2 text-xs text-muted-foreground font-medium">
                      {index + 1}
                    </div>
                    <div className="flex-1 flex min-w-0">
                      <div className="w-32 flex-shrink-0 border-r border-border px-3 py-2 text-left text-sm truncate">
                        {record.transactionNumber || "—"}
                      </div>
                      <div className="w-48 flex-shrink-0 border-r border-border px-3 py-2 text-left text-sm truncate">
                        {record.description || "—"}
                      </div>
                      <div className="w-28 flex-shrink-0 border-r border-border px-3 py-2 text-left text-sm truncate">
                        {record.date || "—"}
                      </div>
                      <div
                        className={`w-24 flex-shrink-0 border-r border-border px-3 py-2 text-right text-sm font-mono ${getAmountClass(
                          Number(record.amount ?? 0)
                        )}`}
                      >
                        {record.formattedAmount || "$0.00"}
                      </div>
                      {Object.entries(mapping.customFields).map(
                        ([fieldName, columnName], fieldIndex) => (
                          <div
                            key={fieldName}
                            className={`w-32 flex-shrink-0 px-3 py-2 text-left text-sm truncate ${
                              fieldIndex <
                              Object.keys(mapping.customFields).length - 1
                                ? "border-r border-border"
                                : ""
                            }`}
                          >
                            {getCustomFieldValue(record, columnName)}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                ))}

                {data.length > 10 && (
                  <div className="flex border-b border-border bg-muted/30">
                    <div className="w-12 flex-shrink-0 bg-muted border-r border-border flex items-center justify-center py-2">
                      <span className="text-xs text-muted-foreground">⋮</span>
                    </div>
                    <div className="flex-1 px-3 py-2 text-sm text-muted-foreground italic text-center">
                      ... and {data.length - 10} more rows
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {data.length > 0 && (
        <Alert className="border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
          <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-green-800 dark:text-green-300">
            <strong>Ready to import!</strong> Your CSV data has been
            successfully processed and mapped. Click &quot;Complete Import&quot;
            to finish the process.
          </AlertDescription>
        </Alert>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-6 border-t border-border">
        <Button variant="outline" onClick={onBack} disabled={loading}>
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back to Preview
        </Button>

        <div className="flex gap-2 items-center">
          {onCancel && (
            <Button variant="outline" onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
          )}
          <Button
            onClick={handleImport}
            disabled={
              data.length === 0 ||
              loading ||
              resolvingUserId ||
              !effectiveUserId
            }
            className="min-w-[140px] gap-2"
          >
            {loading ? (
              "Uploading..."
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Complete Import
              </>
            )}
          </Button>
          {resolvingUserId && (
            <span className="flex items-center gap-2 text-sm text-muted-foreground ml-2">
              <svg
                className="animate-spin h-4 w-4 text-muted-foreground"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                ></path>
              </svg>
              Resolving authentication...
            </span>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            <strong>Error:</strong> {error}
          </AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
          <AlertDescription className="text-green-800 dark:text-green-300">
            <strong>Import successful!</strong>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
