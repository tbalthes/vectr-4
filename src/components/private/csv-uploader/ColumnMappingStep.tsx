import React, { useState } from "react";
import { Button } from "../../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../ui/card";
import { Alert, AlertDescription } from "../../ui/alert";
import { Label } from "../../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import { Checkbox } from "../../ui/checkbox";
import {
  ChevronLeft,
  Settings,
  AlertCircle,
  CheckCircle,
  X,
} from "lucide-react";
import { type ColumnMapping, hasBalanceColumn } from "./csv-utils";

interface ColumnMappingStepProps {
  headers: string[];
  mapping: ColumnMapping;
  onMappingChange: (mapping: ColumnMapping) => void;
  onComplete: (mapping: ColumnMapping) => void;
  onBack: () => void;
  rawRows?: string[][];
  selectedHeaderRow?: number;
}

export function ColumnMappingStep({
  headers,
  mapping,
  onMappingChange,
  onComplete,
  onBack,
  rawRows = [],
  selectedHeaderRow = 0,
}: ColumnMappingStepProps) {
  // Detect balance column
  const hasBalance = hasBalanceColumn(headers);

  // Local state for form values
  const [transactionNumber, setTransactionNumber] = useState(
    mapping.transactionNumber || ""
  );
  const [description, setDescription] = useState(mapping.description || "");
  const [date, setDate] = useState(mapping.date || "");
  const [amountColumns, setAmountColumns] = useState<string[]>(
    mapping.amountColumns || []
  );
  const [balance, setBalance] = useState(mapping.balance || "");
  const [customFields, setCustomFields] = useState<string[]>(
    Object.values(mapping.customFields)
  );

  // Validate if a header is a valid amount column
  const isValidAmountColumn = (header: string): boolean => {
    if (!header) return false;

    const lowerHeader = header.toLowerCase();
    const hasAmountKeyword =
      lowerHeader.includes("amount") ||
      lowerHeader.includes("credit") ||
      lowerHeader.includes("debit");

    if (!hasAmountKeyword) return false;

    const colIndex = headers.indexOf(header);
    if (colIndex === -1 || !rawRows.length) return true;

    const sampleRows = rawRows.slice(
      selectedHeaderRow + 1,
      selectedHeaderRow + 6
    );
    const sampleValues = sampleRows
      .map((row) => (row[colIndex] || "").toString().trim())
      .filter(Boolean);

    if (sampleValues.length === 0) return true;

    const numericCount = sampleValues.filter((value) => {
      const cleanValue = value.replace(/[$,\s]/g, "");
      return /^-?\d*\.?\d+$/.test(cleanValue) && !isNaN(parseFloat(cleanValue));
    }).length;

    return numericCount >= Math.ceil(sampleValues.length * 0.5);
  };

  const getValidAmountColumns = () => {
    return headers.filter(
      (h) =>
        !customFields.includes(h) &&
        h !== transactionNumber &&
        h !== description &&
        h !== date &&
        h !== balance &&
        isValidAmountColumn(h)
    );
  };

  // Update mapping when fields change, but debounce to prevent infinite loops
  const updateMapping = () => {
    const newMapping: ColumnMapping = {
      transactionNumber: transactionNumber || undefined,
      description: description || undefined,
      date: date || undefined,
      amountColumns: amountColumns,
      ...(hasBalance ? { balance: balance || undefined } : {}),
      customFields: customFields.reduce((acc, field, index) => {
        acc[`custom_${index + 1}`] = field;
        return acc;
      }, {} as { [key: string]: string }),
    };

    // Only call onMappingChange if something actually changed
    if (JSON.stringify(newMapping) !== JSON.stringify(mapping)) {
      onMappingChange(newMapping);
    }
  };

  // Wrapper functions to update state and mapping
  const handleTransactionNumberChange = (value: string) => {
    setTransactionNumber(value);
    setTimeout(updateMapping, 0);
  };

  const handleDescriptionChange = (value: string) => {
    setDescription(value);
    setTimeout(updateMapping, 0);
  };

  const handleDateChange = (value: string) => {
    setDate(value);
    setTimeout(updateMapping, 0);
  };

  const handleBalanceChange = (value: string) => {
    setBalance(value);
    setTimeout(updateMapping, 0);
  };

  const getAvailableHeaders = (currentValue: string = "") => {
    const used = [
      transactionNumber,
      description,
      date,
      balance,
      ...customFields,
      ...amountColumns,
    ].filter((v) => v && v !== currentValue);
    return headers.filter((h) => !used.includes(h));
  };

  const getRemainingHeaders = () => {
    const used = [
      transactionNumber,
      description,
      date,
      balance,
      ...customFields,
      ...amountColumns,
    ].filter(Boolean);
    return headers.filter((h) => !used.includes(h));
  };

  const handleAmountColumnToggle = (header: string, checked: boolean) => {
    let newAmountColumns: string[];
    if (checked) {
      newAmountColumns = [...amountColumns, header];
      setAmountColumns(newAmountColumns);
    } else {
      newAmountColumns = amountColumns.filter((h) => h !== header);
      setAmountColumns(newAmountColumns);
    }
    setTimeout(() => {
      onMappingChange({
        transactionNumber: transactionNumber,
        description: description,
        date: date,
        balance: balance,
        amountColumns: newAmountColumns,
        customFields: customFields.reduce((acc, field, index) => {
          acc[`custom_${index + 1}`] = field;
          return acc;
        }, {} as { [key: string]: string }),
      });
    }, 0);
  };

  const handleCustomFieldToggle = (header: string, checked: boolean) => {
    let newCustomFields: string[];
    if (checked && customFields.length < 2) {
      newCustomFields = [...customFields, header];
      setCustomFields(newCustomFields);
    } else if (!checked) {
      newCustomFields = customFields.filter((h) => h !== header);
      setCustomFields(newCustomFields);
    } else {
      return; // No change
    }
    setTimeout(() => {
      onMappingChange({
        transactionNumber: transactionNumber,
        description: description,
        date: date,
        balance: balance,
        amountColumns: amountColumns,
        customFields: newCustomFields.reduce((acc, field, index) => {
          acc[`custom_${index + 1}`] = field;
          return acc;
        }, {} as { [key: string]: string }),
      });
    }, 0);
  };

  const handleRemoveCustomField = (header: string) => {
    const newCustomFields = customFields.filter((h) => h !== header);
    setCustomFields(newCustomFields);
    setTimeout(() => {
      onMappingChange({
        transactionNumber: transactionNumber,
        description: description,
        date: date,
        balance: balance,
        amountColumns: amountColumns,
        customFields: newCustomFields.reduce((acc, field, index) => {
          acc[`custom_${index + 1}`] = field;
          return acc;
        }, {} as { [key: string]: string }),
      });
    }, 0);
  };

  const remainingHeaders = getRemainingHeaders();
  const validAmountColumns = getValidAmountColumns();
  const isFormValid =
    transactionNumber &&
    description &&
    date &&
    amountColumns.length > 0 &&
    (!hasBalance || balance);

  // Base classes for form elements to avoid repetition
  const selectTriggerClasses =
    "flex h-10 w-full items-center justify-between rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:ring-offset-zinc-950 dark:placeholder:text-zinc-400 dark:focus:ring-zinc-300";
  const destructiveBorderClasses = "border-red-500 dark:border-red-700";

  return (
    <div className="space-y-6">
      <Card className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm">
        <CardHeader className="p-6">
          <CardTitle className="flex items-center gap-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            <Settings className="w-5 h-5" />
            Column Mapping
          </CardTitle>
          <CardDescription className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Map your CSV columns to the required transaction fields.
            {hasBalance &&
              " We detected a balance column which is required for this import."}
            {
              " For Amount, only columns containing &apos;amount&apos;, &apos;credit&apos;, or &apos;debit&apos; with numeric data are allowed."
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 pt-0 space-y-6">
          <div className="space-y-4">
            <h4 className="font-medium text-zinc-900 dark:text-zinc-50">
              Required Fields
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  Transaction Number <span className="text-red-500">*</span>
                  {transactionNumber && (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  )}
                </Label>
                <Select
                  value={transactionNumber}
                  onValueChange={handleTransactionNumberChange}
                >
                  <SelectTrigger
                    className={`${selectTriggerClasses} ${
                      !transactionNumber ? destructiveBorderClasses : ""
                    }`}
                  >
                    <SelectValue placeholder="Select column..." />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                    {getAvailableHeaders(transactionNumber).map((header) => (
                      <SelectItem key={header} value={header}>
                        {header || `Column ${headers.indexOf(header) + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  Description <span className="text-red-500">*</span>
                  {description && (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  )}
                </Label>
                <Select
                  value={description}
                  onValueChange={handleDescriptionChange}
                >
                  <SelectTrigger
                    className={`${selectTriggerClasses} ${
                      !description ? destructiveBorderClasses : ""
                    }`}
                  >
                    <SelectValue placeholder="Select column..." />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                    {getAvailableHeaders(description).map((header) => (
                      <SelectItem key={header} value={header}>
                        {header || `Column ${headers.indexOf(header) + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  Date <span className="text-red-500">*</span>
                  {date && <CheckCircle className="w-4 h-4 text-green-600" />}
                </Label>
                <Select value={date} onValueChange={handleDateChange}>
                  <SelectTrigger
                    className={`${selectTriggerClasses} ${
                      !date ? destructiveBorderClasses : ""
                    }`}
                  >
                    <SelectValue placeholder="Select column..." />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                    {getAvailableHeaders(date).map((header) => (
                      <SelectItem key={header} value={header}>
                        {header || `Column ${headers.indexOf(header) + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {hasBalance && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    Balance <span className="text-red-500">*</span>
                    {balance && (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    )}
                  </Label>
                  <Select value={balance} onValueChange={handleBalanceChange}>
                    <SelectTrigger
                      className={`${selectTriggerClasses} ${
                        !balance ? destructiveBorderClasses : ""
                      }`}
                    >
                      <SelectValue placeholder="Select column..." />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                      {getAvailableHeaders(balance).map((header) => (
                        <SelectItem key={header} value={header}>
                          {header || `Column ${headers.indexOf(header) + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Label className="flex items-center gap-2 text-sm font-medium">
                Amount Columns <span className="text-red-500">*</span>
                {amountColumns.length > 0 && (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                )}
              </Label>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Select one or more amount columns. Only columns containing
                &apos;amount&apos;, &apos;credit&apos;, or &apos;debit&apos;
                with numeric data are shown.
              </p>

              {validAmountColumns.length > 0 ? (
                <div
                  className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-3 border rounded-lg ${
                    amountColumns.length === 0
                      ? "border-red-500 bg-red-50 dark:border-red-900 dark:bg-red-900/20"
                      : "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
                  }`}
                >
                  {validAmountColumns.map((header) => (
                    <div key={header} className="flex items-center space-x-2">
                      <Checkbox
                        id={`amount-${header}`}
                        checked={amountColumns.includes(header)}
                        onCheckedChange={(checked) =>
                          handleAmountColumnToggle(header, !!checked)
                        }
                      />
                      <Label
                        htmlFor={`amount-${header}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {header || `Column ${headers.indexOf(header) + 1}`}
                      </Label>
                    </div>
                  ))}
                </div>
              ) : (
                <Alert className="relative w-full rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300">
                  <AlertCircle className="w-4 h-4 absolute left-4 top-3.5" />
                  <AlertDescription className="ml-6">
                    <strong>No valid amount columns found.</strong> Please
                    ensure your CSV has columns with &apos;amount&apos;,
                    &apos;credit&apos;, or &apos;debit&apos; in the header that
                    contain numeric data.
                  </AlertDescription>
                </Alert>
              )}

              {amountColumns.length > 0 && (
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  Selected: {amountColumns.join(", ")}
                  {amountColumns.length > 1 &&
                    " (will be combined into single Amount)"}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-medium text-zinc-900 dark:text-zinc-50">
              Custom Fields
            </h4>

            {customFields.length > 0 && (
              <div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">
                  Selected custom fields (click × to remove):
                </p>
                <div className="flex flex-wrap gap-2">
                  {customFields.map((field) => (
                    <div
                      key={field}
                      className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-md"
                    >
                      <span className="text-sm text-zinc-800 dark:text-zinc-200">
                        {field}
                      </span>
                      <button
                        className="flex items-center justify-center h-4 w-4 p-0 rounded-full hover:bg-red-500 hover:text-white dark:hover:bg-red-700"
                        onClick={() => handleRemoveCustomField(field)}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {remainingHeaders.length > 0 && customFields.length < 2 && (
              <div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">
                  Select up to {2 - customFields.length} additional column
                  {2 - customFields.length !== 1 ? "s" : ""} to include in your
                  import:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {remainingHeaders.map((header) => (
                    <div key={header} className="flex items-center space-x-2">
                      <Checkbox
                        id={header}
                        checked={false}
                        disabled={customFields.length >= 2}
                        onCheckedChange={(checked) =>
                          handleCustomFieldToggle(header, !!checked)
                        }
                      />
                      <Label
                        htmlFor={header}
                        className={`text-sm font-normal cursor-pointer ${
                          customFields.length >= 2
                            ? "text-zinc-400 dark:text-zinc-600"
                            : ""
                        }`}
                      >
                        {header || `Column ${headers.indexOf(header) + 1}`}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {customFields.length >= 2 && remainingHeaders.length > 0 && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Maximum of 2 custom fields reached. Remove a field above to add
                a different one.
              </p>
            )}

            {remainingHeaders.length === 0 && customFields.length === 0 && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                All columns have been mapped to required fields.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {!isFormValid && (
        <Alert className="relative w-full rounded-lg border border-red-500 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
          <AlertCircle className="w-4 h-4 absolute left-4 top-3.5" />
          <AlertDescription className="ml-6">
            <strong>Please complete all required field mappings:</strong>
            <ul className="list-disc list-inside mt-2">
              {!transactionNumber && <li>Transaction Number is required</li>}
              {!description && <li>Description is required</li>}
              {!date && <li>Date is required</li>}
              {amountColumns.length === 0 && (
                <li>At least one Amount column is required</li>
              )}
              {hasBalance && !balance && <li>Balance is required</li>}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between">
        <Button
          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-zinc-200 bg-white hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800 dark:ring-offset-zinc-950 dark:bg-zinc-950 dark:hover:bg-zinc-800 dark:hover:text-zinc-50 h-10 px-4 py-2"
          onClick={onBack}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back to Headers
        </Button>

        {/* Only call onComplete on button click, never in render or effect */}
        <Button
          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-zinc-900 text-zinc-50 hover:bg-zinc-900/90 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-50/90 h-10 px-4 py-2"
          onClick={() => onComplete(mapping)}
          disabled={!isFormValid}
        >
          Continue to Preview
          <CheckCircle className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
