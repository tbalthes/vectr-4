import React from "react";
import { SupabaseClient } from "@supabase/supabase-js";
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
    return "text-zinc-500 dark:text-zinc-400";
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
            const isSystemField = key.startsWith('_') ||
                                 key.toLowerCase().includes('rowindex') ||
                                 key.toLowerCase().includes('formattedamount') ||
                                 key.toLowerCase().includes('index');
                                 
            if (!isSystemField && value !== undefined && value !== null && value !== "") {
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
      <Card className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm">
        <CardHeader className="p-6">
          <CardTitle className="flex items-center gap-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            <Eye className="w-5 h-5" />
            Preview Import
          </CardTitle>
          <CardDescription className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Review your mapped data before completing the import. Check that the
            columns are correctly mapped and the data looks accurate.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 pt-0 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                Total Records
              </h4>
              <div className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                {data.length}
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
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
              <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                Custom Fields
              </h4>
              <div className="text-sm text-zinc-500 dark:text-zinc-400">
                {Object.keys(mapping.customFields).length} custom fields mapped
              </div>
            </div>
          </div>

          <Separator className="bg-zinc-200 dark:bg-zinc-800" />

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
              Field Mappings
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-zinc-800 dark:text-zinc-200">
              <div className="space-y-2">
                <div className="flex items-center gap-6">
                  <span>Transaction Number:</span>
                  <Badge className="border-zinc-200 dark:border-zinc-700">
                    {mapping.transactionNumber ?? "—"}
                  </Badge>
                </div>
                <div className="flex items-center gap-6">
                  <span>Description:</span>
                  <Badge className="border-zinc-200 dark:border-zinc-700">
                    {mapping.description ?? "—"}
                  </Badge>
                </div>
                <div className="flex items-center gap-6">
                  <span>Date:</span>
                  <Badge className="border-zinc-200 dark:border-zinc-700">
                    {mapping.date ?? "—"}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-6">
                  <span>Amount:</span>
                  <Badge className="border-zinc-200 dark:border-zinc-700">
                    {mapping.amountColumns && mapping.amountColumns.length
                      ? mapping.amountColumns.join(", ")
                      : "—"}
                  </Badge>
                </div>
                <div className="flex items-center gap-6">
                  <span>Custom 1:</span>
                  <Badge className="border-zinc-200 dark:border-zinc-700">
                    {customFieldList[0] ?? "—"}
                  </Badge>
                </div>
                <div className="flex items-center gap-6">
                  <span>Custom 2:</span>
                  <Badge className="border-zinc-200 dark:border-zinc-700">
                    {customFieldList[1] ?? "—"}
                  </Badge>
                </div>

                {/* Keep dynamic custom fields list below if needed
                {Object.keys(mapping.customFields).length > 0 && (
                  <div className="space-y-2 pt-2">
                    <h5 className="text-sm font-medium">Custom Fields:</h5>
                    {Object.entries(mapping.customFields).map(
                      ([fieldName, columnName]) => (
                        <div
                          key={fieldName}
                          className="flex items-center gap-6"
                        >
                          <span className="text-sm">{fieldName}:</span>
                          <Badge className="border-transparent bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50">
                            {columnName}
                          </Badge>
                        </div>
                      )
                    )}
                  </div>
                )}
                */}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm">
        <CardHeader className="p-6">
          <CardTitle className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Data Preview
          </CardTitle>
          <CardDescription className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            First {Math.min(10, data.length)} of {data.length} records
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          {data.length === 0 ? (
            <Alert className="relative w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 p-4 text-zinc-900 dark:text-zinc-50">
              <AlertDescription className="text-sm">
                No data records found. Please check your CSV file and column
                mappings.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-950">
              <div className="max-h-96 overflow-auto">
                <div className="min-w-full">
                  <div className="flex bg-zinc-100 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10">
                    <div className="w-12 flex-shrink-0 bg-zinc-100 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex items-center justify-center py-3 text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                      #
                    </div>
                    <div className="flex-1 flex min-w-0">
                      <div className="w-32 flex-shrink-0 border-r border-zinc-200 dark:border-zinc-800 px-3 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        Transaction #
                      </div>
                      <div className="w-48 flex-shrink-0 border-r border-zinc-200 dark:border-zinc-800 px-3 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        Description
                      </div>
                      <div className="w-28 flex-shrink-0 border-r border-zinc-200 dark:border-zinc-800 px-3 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        Date
                      </div>
                      <div className="w-24 flex-shrink-0 border-r border-zinc-200 dark:border-zinc-800 px-3 py-3 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        Amount
                      </div>
                      {Object.entries(mapping.customFields).map(
                        ([fieldName, columnName], index) => (
                          <div
                            key={fieldName}
                            className={`w-32 flex-shrink-0 px-3 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 ${
                              index <
                              Object.keys(mapping.customFields).length - 1
                                ? "border-r border-zinc-200 dark:border-zinc-800"
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
                      className="flex border-b border-zinc-200 dark:border-zinc-800 last:border-b-0 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors"
                    >
                      <div className="w-12 flex-shrink-0 bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex items-center justify-center py-2 text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                        {index + 1}
                      </div>
                      <div className="flex-1 flex min-w-0">
                        <div className="w-32 flex-shrink-0 border-r border-zinc-200 dark:border-zinc-800 px-3 py-2 text-left text-sm truncate">
                          {record.transactionNumber || "—"}
                        </div>
                        <div className="w-48 flex-shrink-0 border-r border-zinc-200 dark:border-zinc-800 px-3 py-2 text-left text-sm truncate">
                          {record.description || "—"}
                        </div>
                        <div className="w-28 flex-shrink-0 border-r border-zinc-200 dark:border-zinc-800 px-3 py-2 text-left text-sm truncate">
                          {record.date || "—"}
                        </div>
                        <div
                          className={`w-24 flex-shrink-0 border-r border-zinc-200 dark:border-zinc-800 px-3 py-2 text-right text-sm font-mono ${getAmountClass(
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
                                  ? "border-r border-zinc-200 dark:border-zinc-800"
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
                    <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                      <div className="w-12 flex-shrink-0 bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex items-center justify-center py-2">
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          ⋮
                        </span>
                      </div>
                      <div className="flex-1 px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400 italic text-center">
                        ... and {data.length - 10} more rows
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {data.length > 0 && (
        <Alert className="relative w-full rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300">
          <CheckCircle className="w-4 h-4 absolute left-4 top-3.5" />
          <AlertDescription className="ml-6">
            <strong>Ready to import!</strong> Your CSV data has been
            successfully processed and mapped. Click &quot;Complete Import&quot;
            to finish the process.
          </AlertDescription>
        </Alert>
      )}

      {/* Navigation */}
      <div className="sticky bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 pt-4 pb-4 z-20 flex justify-between border-t border-zinc-200 dark:border-zinc-800 mt-8">
        <Button
          variant="outline"
          onClick={onBack}
          className="gap-2"
          disabled={loading}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back to Mapping
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
            <span className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 ml-2">
              <svg className="animate-spin h-4 w-4 text-zinc-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
              </svg>
              Resolving authentication...
            </span>
          )}
        </div>
      </div>
      {error && (
        <Alert className="relative w-full rounded-lg border border-red-500 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300 mt-4">
          <AlertDescription>
            <strong>Error:</strong> {error}
          </AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="relative w-full rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300 mt-4">
          <AlertDescription>
            <strong>Import successful!</strong>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
