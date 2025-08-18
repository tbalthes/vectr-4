// CSVUploadSheet.tsx
import {
  WideSheet,
  WideSheetContent,
  WideSheetTitle,
} from "@/components/ui/WideSheet";
import { useState, useMemo, useCallback } from "react";
import { FileUploadStep } from "./FileUploadStep";
import { HeaderDetectionStep } from "./HeaderDetectionStep";
import { ColumnMappingStep } from "./ColumnMappingStep";
import { PreviewStep } from "./PreviewStep";
import userProfile from "../../../data/user-data";
import {
  parseCSV,
  detectHeaderRow,
  combineAmounts,
  ColumnMapping,
  HeaderDetectionResult,
} from "./csv-utils";

type Step = 0 | 1 | 2 | 3;

export function CSVUploadSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [step, setStep] = useState<Step>(0);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [headerDetection, setHeaderDetection] =
    useState<HeaderDetectionResult | null>(null);
  const [selectedHeaderRow, setSelectedHeaderRow] = useState<number>(0);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    amountColumns: [],
    customFields: {},
  });

  // Reset state when sheet closes
  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setStep(0);
      setRawRows([]);
      setHeaderDetection(null);
      setSelectedHeaderRow(0);
      setHeaders([]);
      setMapping({ amountColumns: [], customFields: {} });
    }
  };

  // Handler invoked by FileUploadStep
  const handleFileUpload = (file: File, content: string) => {
    const rows = parseCSV(content);
    setRawRows(rows);

    const detection = detectHeaderRow(rows);
    setHeaderDetection(detection);
    setSelectedHeaderRow(detection.headerRowIndex || 0);

    // Use detected headers if available
    setHeaders(detection.headers || rows[0] || []);
    setStep(1);
  };

  // Build preview data for PreviewStep based on current mapping (memoized)
  const previewData = useMemo(() => {
    if (!rawRows.length || !mapping || mapping.amountColumns.length === 0)
      return [];

    const start = selectedHeaderRow + 1;
    const dataRows = rawRows.slice(start, start + 1000); // limit preview size

    return dataRows.map((row) => {
      const record: Record<string, string | number | undefined> = {};
      if (mapping.transactionNumber) {
        const colName = mapping.transactionNumber as string;
        const i = headers.indexOf(colName);
        record.transactionNumber = i >= 0 ? row[i] || "" : "";
      }
      if (mapping.description) {
        const colName = mapping.description as string;
        const i = headers.indexOf(colName);
        record.description = i >= 0 ? row[i] || "" : "";
      }
      if (mapping.date) {
        const colName = mapping.date as string;
        const i = headers.indexOf(colName);
        record.date = i >= 0 ? row[i] || "" : "";
      }

      // combine amount columns
      const amounts: { [col: string]: string } = {};
      (mapping.amountColumns || []).forEach((col: string) => {
        const i = headers.indexOf(col);
        amounts[col] = i >= 0 ? row[i] || "" : "";
      });
      record.amount = combineAmounts(amounts, headers);

      if (mapping.balance) {
        const colName = mapping.balance as string;
        const i = headers.indexOf(colName);
        record.balance = i >= 0 ? row[i] || "" : "";
      }

      // custom fields
      Object.entries(mapping.customFields || {}).forEach(([k, col]) => {
        const i = headers.indexOf(col);
        record[k] = i >= 0 ? row[i] || "" : "";
      });

      return record;
    });
  }, [rawRows, mapping, selectedHeaderRow, headers]);

  return (
    <WideSheet open={open} onOpenChange={handleOpenChange}>
      <WideSheetContent
        side="right"
        className="bg-white dark:bg-zinc-900 px-10 py-8"
      >
        <WideSheetTitle>Upload Transactions CSV</WideSheetTitle>
        {step === 0 && <FileUploadStep onFileUpload={handleFileUpload} />}

        {step === 1 && headerDetection && (
          <HeaderDetectionStep
            rows={rawRows}
            headerDetection={headerDetection}
            selectedHeaderRow={selectedHeaderRow}
            onHeaderSelect={(rowIndex: number) =>
              setSelectedHeaderRow(rowIndex)
            }
            onContinue={(rowIndex: number) => {
              // set headers from selected row and move to mapping
              setHeaders(rawRows[rowIndex] || []);
              setSelectedHeaderRow(rowIndex);
              setStep(2);
            }}
            onBack={() => setStep(0)}
          />
        )}

        {step === 2 && (
          <ColumnMappingStep
            headers={headers}
            mapping={mapping}
            rawRows={rawRows}
            selectedHeaderRow={selectedHeaderRow}
            onMappingChange={setMapping}
            onComplete={(m: ColumnMapping) => {
              setMapping(m);
              setStep(3);
            }}
            onBack={() => setStep(1)}
          />
        )}

        {step === 3 && (
          <PreviewStep
            data={previewData}
            mapping={mapping}
            user_id={userProfile.user_id}
            account_id={userProfile.account_id}
            onBack={() => setStep(2)}
            onComplete={() => {
              handleOpenChange(false);
            }}
            onCancel={() => setStep(0)}
          />
        )}
      </WideSheetContent>
    </WideSheet>
  );
}
