"use client";

import React, { useState } from "react";
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
  formatCurrency,
  type ColumnMapping,
  type HeaderDetectionResult,
} from "@/components/private/csv-uploader/csv-utils";
import userProfile from "@/data/user-data";
import { useRouter } from "next/navigation";

export default function UploadPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [selectedHeaderRow, setSelectedHeaderRow] = useState<number>(0);
  const [headerDetection, setHeaderDetection] =
    useState<HeaderDetectionResult | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({
    amountColumns: [],
    customFields: {},
  });

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

  const handleMappingComplete = (finalMapping: ColumnMapping) => {
    setMapping(finalMapping);
    setCurrentStep(3);
  };

  const handlePreviewComplete = () => {
    setCurrentStep(4);
  };

  const handleUploadComplete = () => {
    // Navigate back to dashboard
    router.push("/private/dashboard");
  };

  const transformDataForPreview = (): Array<
    Record<string, string | number | undefined>
  > => {
    if (!csvData.length || !mapping.description || !mapping.date) return [];

    const dataRows = csvData.slice(selectedHeaderRow + 1);
    const headers = csvData[selectedHeaderRow] || [];

    return dataRows.slice(0, 10).map((row, index) => {
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

      record.amount = combineAmounts(amounts, headers);

      // Add custom fields
      Object.entries(mapping.customFields).forEach(
        ([fieldName, columnName]) => {
          const colIndex = headers.indexOf(columnName);
          if (colIndex >= 0) {
            record[fieldName] = row[colIndex];
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
        <div className="flex items-center justify-between mb-4">
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
      <Card>
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
            <PreviewStep
              data={transformDataForPreview()}
              mapping={mapping}
              user_id={userProfile.user_id}
              account_id={userProfile.account_id}
              onComplete={handleUploadComplete}
              onBack={() => setCurrentStep(3)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
