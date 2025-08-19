"use client";

import React, { useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileUploadStep } from "@/components/private/csv-uploader/FileUploadStep";
import { HeaderDetectionStep } from "@/components/private/csv-uploader/HeaderDetectionStep";
import { ColumnMappingStep } from "@/components/private/csv-uploader/ColumnMappingStep";
import { DataPreviewStep } from "@/components/private/csv-uploader/DataPreviewStep";
import { PreviewStep } from "@/components/private/csv-uploader/PreviewStep";
import PageHeader from "@/components/private/PageHeader";
import { ArrowLeft, Download } from "lucide-react";
import {
  detectHeaderRow,
  getColumnSuggestions,
  parseCSV,
  combineAmounts,
  type ColumnMapping,
  type HeaderDetectionResult,
} from "@/components/private/csv-uploader/csv-utils";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export default function UploadPage() {
  const router = useRouter();
  const { user, userId, loading: authLoading } = useAuth();
  const [authUserId, setAuthUserId] = useState<string | null>(userId || null);
  const supabaseClient = createClientComponentClient();

  const [currentStep, setCurrentStep] = useState(0);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [selectedHeaderRow, setSelectedHeaderRow] = useState<number>(0);
  const [headerDetection, setHeaderDetection] =
    useState<HeaderDetectionResult | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({
    amountColumns: [],
    customFields: {},
  });
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");

  const handleFileUploaded = (file: File, content: string) => {
    // Parse the CSV content
    const data = parseCSV(content);
    setCsvData(data);

    // Auto-detect headers
    const headerResult = detectHeaderRow(data);
    setHeaderDetection(headerResult);
    setSelectedHeaderRow(headerResult.headerRowIndex);

    // Auto-detect column mapping
    const headers = data[headerResult.headerRowIndex] || [];
    const autoMapping = getColumnSuggestions(headers);
    setMapping({
      amountColumns: autoMapping.amountColumns || [],
      customFields: {},
      ...autoMapping,
    });

    setCurrentStep(1);
  };

  const handleHeaderSelected = (headerRowIndex: number) => {
    setSelectedHeaderRow(headerRowIndex);

    // Re-detect column mapping with new headers
    const headers = csvData[headerRowIndex] || [];
    const autoMapping = getColumnSuggestions(headers);
    setMapping({
      amountColumns: autoMapping.amountColumns || [],
      customFields: {},
      ...autoMapping,
    });

    setCurrentStep(2);
  };

  const handleMappingComplete = (
    finalMapping: ColumnMapping,
    accountId: string
  ) => {
    setMapping(finalMapping);
    setSelectedAccountId(accountId);
    console.log("Selected account ID:", accountId);
    setCurrentStep(3);
  };

  // Keep local copy of authenticated user id to avoid transient null during navigation
  React.useEffect(() => {
    if (userId) setAuthUserId(userId);
    // Fallback: if we don't have a userId yet, try fetching directly from Supabase client
    if (!userId && !authUserId) {
      (async () => {
        try {
          const { data } = await supabaseClient.auth.getUser();
          const fetchedUser = data?.user;
          if (fetchedUser?.id) setAuthUserId(fetchedUser.id);
        } catch (err) {
          // ignore - user likely not signed in
        }
      })();
    }
  }, [userId]);

  const handlePreviewComplete = () => {
    setCurrentStep(4);
  };

  const handleUploadComplete = () => {
    // Navigate back to dashboard
    router.push("/private/dashboard");
  };

  const transformDataForPreview = (
    limitRows: boolean = true
  ): Array<Record<string, string | number | undefined>> => {
    if (!csvData.length || !mapping.description || !mapping.date) return [];

    const dataRows = csvData.slice(selectedHeaderRow + 1);
    const headers = csvData[selectedHeaderRow] || [];

    // Process all rows or limit to 10 for preview
    const rowsToProcess = limitRows ? dataRows.slice(0, 10) : dataRows;

    return rowsToProcess.map((row, index) => {
      const record: Record<string, string | number | undefined> = {
        _rowIndex: index,
      };

      // Map required fields
      if (mapping.transactionNumber) {
        const colIndex = headers.indexOf(mapping.transactionNumber);
        record.transactionNumber = colIndex >= 0 ? row[colIndex] : "";
      }

      if (mapping.description) {
        const colIndex = headers.indexOf(mapping.description);
        record.description = colIndex >= 0 ? row[colIndex] : "";
      }

      if (mapping.date) {
        const colIndex = headers.indexOf(mapping.date);
        record.date = colIndex >= 0 ? row[colIndex] : "";
      }

      if (mapping.balance) {
        const colIndex = headers.indexOf(mapping.balance);
        record.balance = colIndex >= 0 ? row[colIndex] : "";
      }

      // Calculate amount from amount columns
      const amounts: { [column: string]: string } = {};
      mapping.amountColumns.forEach((columnName) => {
        const colIndex = headers.indexOf(columnName);
        if (colIndex >= 0) {
          amounts[columnName] = row[colIndex] || "";
        }
      });

      const combinedAmount = combineAmounts(amounts, headers);
      record.amount = combinedAmount;

      // Add formatted amount for display
      record.formattedAmount = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(combinedAmount);

      // Add custom fields
      Object.entries(mapping.customFields).forEach(
        ([fieldName, columnName]) => {
          const colIndex = headers.indexOf(columnName);
          if (colIndex >= 0) {
            record[columnName] = row[colIndex];
          }
        }
      );

      return record;
    });
  };

  const headers = csvData[selectedHeaderRow] || [];

  const steps = [
    "Upload File",
    "Detect Headers",
    "Map Columns",
    "Preview Data",
    "Complete Import",
  ];

  // Only show loading state if we've been loading for a while
  if (authLoading && !userId) {
    return (
      <div className="flex-1 space-y-6 p-6 animate-fade-in">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-6 animate-fade-in">
      {/* Header */}
      <PageHeader
        title="Upload Transactions"
        subtitle="Import transactions from a CSV file and map them to your account"
        actions={
          <div className="flex items-center space-x-3">
            <Button variant="outline" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Template
            </Button>
          </div>
        }
      />

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4 space-y-4">
          {steps.map((step, index) => (
            <div key={index} className="flex items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full border-2 text-sm font-medium ${
                  index <= currentStep
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border"
                }`}
              >
                {index + 1}
              </div>
              <span
                className={`ml-2 text-sm font-medium ${
                  index <= currentStep
                    ? "text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {step}
              </span>
              {index < steps.length - 1 && (
                <div
                  className={`w-12 h-0.5 ml-4 ${
                    index < currentStep ? "bg-primary" : "bg-border"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Upload Content */}
      <CardContent className="p-6">
        {currentStep === 0 && (
          <FileUploadStep onFileUpload={handleFileUploaded} />
        )}

        {currentStep === 1 && headerDetection && (
          <HeaderDetectionStep
            rows={csvData}
            headerDetection={headerDetection}
            selectedHeaderRow={selectedHeaderRow}
            onHeaderSelect={(headerRowIndex) => {
              setSelectedHeaderRow(headerRowIndex);
              // Re-detect column mapping with new headers
              const headers = csvData[headerRowIndex] || [];
              const autoMapping = getColumnSuggestions(headers);
              setMapping({
                amountColumns: autoMapping.amountColumns || [],
                customFields: {},
                ...autoMapping,
              });
            }}
            onContinue={handleHeaderSelected}
            onBack={() => setCurrentStep(0)}
          />
        )}

        {currentStep === 2 && (
          <ColumnMappingStep
            headers={headers}
            mapping={mapping}
            onMappingChange={setMapping}
            onComplete={handleMappingComplete}
            onBack={() => setCurrentStep(1)}
            rawRows={csvData}
            selectedHeaderRow={selectedHeaderRow}
          />
        )}

        {currentStep === 3 && (
          <DataPreviewStep
            data={transformDataForPreview()}
            mapping={mapping}
            onContinue={handlePreviewComplete}
            onBack={() => setCurrentStep(2)}
          />
        )}

        {currentStep === 4 && (
          <>
            {selectedAccountId ? (
              <PreviewStep
                data={transformDataForPreview(false)}
                mapping={mapping}
                user_id={authUserId || userId || ""}
                account_id={selectedAccountId}
                onComplete={handleUploadComplete}
                onBack={() => setCurrentStep(3)}
              />
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  No account selected. Please go back and select an account.
                </p>
                <Button onClick={() => setCurrentStep(2)} variant="outline">
                  Go Back to Column Mapping
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </div>
  );
}
