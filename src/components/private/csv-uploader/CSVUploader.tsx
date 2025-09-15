import React from 'react';
import { ChevronLeft, Eye, Download, CheckCircle, DollarSign } from 'lucide-react';

import { type ColumnMapping } from './csv-utils';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

interface PreviewStepProps {
  data: Record<string, string | number | undefined>[];
  mapping: ColumnMapping;
  user_id: string;
  account_id: string;
  onComplete: () => void;
  onBack: () => void;
  onCancel?: () => void;
}

export function PreviewStep({
  data,
  mapping,
  user_id,
  account_id,
  onComplete,
  onBack,
  onCancel,
}: PreviewStepProps) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  const previewData = data.slice(0, 10);

  const getCustomFieldValue = (
    record: Record<string, string | number | undefined>,
    fieldName: string,
  ) => {
    return record[fieldName] || '—';
  };

  const getAmountClass = (amount: number) => {
    if (amount > 0) {
      return 'text-green-600 dark:text-green-500';
    }
    if (amount < 0) {
      return 'text-red-600 dark:text-red-500';
    }
    return 'text-zinc-500 dark:text-zinc-400';
  };

  const handleImport = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const payload = {
        user_id,
        account_id,
        transactions: data.map((row) => {
          const {
            transactionNumber,
            description,
            date,
            amount,
            balance,
            // formattedAmount, // Exclude system fields
            ...rest
          } = row;

          // Build user_metadata from custom fields mapping
          const user_metadata: Record<string, string | number | boolean> = {};

          // Add custom fields from mapping configuration
          Object.entries(mapping.customFields).forEach(([fieldKey, columnName]) => {
            const value = row[columnName];
            if (value !== null && value !== undefined && value !== '') {
              user_metadata[fieldKey] = value;
            }
          });

          // Add any additional fields that aren't system fields
          Object.entries(rest).forEach(([key, value]) => {
            // Skip system fields that shouldn't be in custom fields
            const isSystemField =
              key.startsWith('_') ||
              key.toLowerCase().includes('rowindex') ||
              key.toLowerCase().includes('formattedamount') ||
              key.toLowerCase().includes('index') ||
              key.toLowerCase().includes('system') ||
              Object.keys(mapping.customFields).includes(key);

            if (!isSystemField && value !== null && value !== undefined && value !== '') {
              user_metadata[key] = value;
            }
          });

          return {
            transaction_number: transactionNumber,
            description,
            date,
            amount,
            balance,
            user_metadata,
          };
        }),
      };
      const res = await fetch('http://127.0.0.1:8000/transactions/transaction-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || `HTTP ${res.status}`);
      }
      setSuccess(true);
      onComplete();
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(e.message || 'Upload failed');
      } else {
        setError('Upload failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-">
      <Card className="rounded-lg">
        <CardHeader className="p-6">
          <CardTitle className="flex items-center gap-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            <Eye className="w-5 h-5" />
            Preview Import
          </CardTitle>
          <CardDescription className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Review your mapped data before completing the import. Check that the columns are
            correctly mapped and the data looks accurate.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 pt-0 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Total Records</h4>
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
              <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Custom Fields</h4>
              <div className="text-sm text-zinc-500 dark:text-zinc-400">
                {Object.keys(mapping.customFields).length} custom fields mapped
              </div>
            </div>
          </div>

          <Separator className="bg-zinc-200 dark:bg-zinc-800" />

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Field Mappings</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-zinc-800 dark:text-zinc-200">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span>Transaction Number:</span>
                  <Badge className="border-zinc-200 dark:border-zinc-700">
                    {mapping.transactionNumber}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Description:</span>
                  <Badge className="border-zinc-200 dark:border-zinc-700">
                    {mapping.description}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Date:</span>
                  <Badge className="border-zinc-200 dark:border-zinc-700">{mapping.date}</Badge>
                </div>
              </div>

              {Object.keys(mapping.customFields).length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-sm font-medium">Custom Fields:</h5>
                  {Object.entries(mapping.customFields).map(([fieldName, columnName]) => (
                    <div key={fieldName} className="flex justify-between items-center">
                      <span className="text-sm">{fieldName}:</span>
                      <Badge className="border-transparent bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50">
                        {columnName}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-lg">
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
                No data records found. Please check your CSV file and column mappings.
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
                      {Object.keys(mapping.customFields).map((fieldName, index) => (
                        <div
                          key={fieldName}
                          className={`w-32 flex-shrink-0 px-3 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 ${
                            index < Object.keys(mapping.customFields).length - 1
                              ? 'border-r border-zinc-200 dark:border-zinc-800'
                              : ''
                          }`}
                        >
                          {fieldName}
                        </div>
                      ))}
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
                          {record.transactionNumber || '—'}
                        </div>
                        <div className="w-48 flex-shrink-0 border-r border-zinc-200 dark:border-zinc-800 px-3 py-2 text-left text-sm truncate">
                          {record.description || '—'}
                        </div>
                        <div className="w-28 flex-shrink-0 border-r border-zinc-200 dark:border-zinc-800 px-3 py-2 text-left text-sm truncate">
                          {record.date || '—'}
                        </div>
                        <div
                          className={`w-24 flex-shrink-0 border-r border-zinc-200 dark:border-zinc-800 px-3 py-2 text-right text-sm font-mono ${getAmountClass(
                            Number(record.amount ?? 0),
                          )}`}
                        >
                          {record.formattedAmount || '$0.00'}
                        </div>
                        {Object.keys(mapping.customFields).map((fieldName, fieldIndex) => (
                          <div
                            key={fieldName}
                            className={`w-32 flex-shrink-0 px-3 py-2 text-left text-sm truncate ${
                              fieldIndex < Object.keys(mapping.customFields).length - 1
                                ? 'border-r border-zinc-200 dark:border-zinc-800'
                                : ''
                            }`}
                          >
                            {getCustomFieldValue(record, fieldName)}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {data.length > 10 && (
                    <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                      <div className="w-12 flex-shrink-0 bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex items-center justify-center py-2">
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">⋮</span>
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
            <strong>Ready to import!</strong> Your CSV data has been successfully processed and
            mapped. Click &quot;Complete Import&quot; to finish the process.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between">
        <Button className="h-10 px-4" onClick={onBack}>
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back to Mapping
        </Button>
        <div className="flex gap-2">
          {onCancel && (
            <Button className="h-10 px-4" onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
          )}
          <Button
            onClick={() => void handleImport()}
            disabled={data.length === 0 || loading}
            className="h-10 px-4"
          >
            {loading ? (
              'Uploading...'
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Complete Import
              </>
            )}
          </Button>
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
