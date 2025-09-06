import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, FileText, CheckCircle } from "lucide-react";
import { type HeaderDetectionResult } from "./csv-utils";

interface HeaderDetectionStepProps {
  rows: string[][];
  headerDetection: HeaderDetectionResult;
  selectedHeaderRow: number;
  onHeaderSelect: (headerRowIndex: number) => void;
  onContinue: (headerRowIndex: number) => void;
  onBack: () => void;
}

export function HeaderDetectionStep({
  rows,
  headerDetection,
  selectedHeaderRow,
  onHeaderSelect,
  onContinue,
  onBack,
}: HeaderDetectionStepProps) {
  const handleRowSelect = (rowIndex: number) => {
    onHeaderSelect(rowIndex);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 15) return "bg-green-100 text-green-800 border-green-300";
    if (confidence >= 5)
      return "bg-yellow-100 text-yellow-800 border-yellow-300";
    return "bg-red-100 text-red-800 border-red-300";
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 15) return "High Confidence";
    if (confidence >= 5) return "Medium Confidence";
    return "Low Confidence";
  };

  // Show first 10 rows for header selection
  const previewRows = rows.slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <FileText className="w-8 h-8" />
          Header Detection
        </h1>
        <p className="text-muted-foreground mt-2">
          We&apos;ve analyzed your CSV file to identify the header row. Please
          verify or select the correct row that contains your column headers.
        </p>
      </div>

      {/* Content */}
      <div className="space-y-4">
        {/* Auto-detection result */}
        <Alert>
          <CheckCircle className="w-4 h-4" />
          <AlertDescription>
            <div className="flex items-center gap-3">
              <span>
                <strong>Auto-detected header:</strong> Row{" "}
                {headerDetection.headerRowIndex + 1}
              </span>
              <Badge className={getConfidenceColor(headerDetection.confidence)}>
                {getConfidenceLabel(headerDetection.confidence)}
              </Badge>
            </div>
          </AlertDescription>
        </Alert>

        {/* Row selection */}
        <div className="space-y-4">
          <Label>Select the row that contains your column headers:</Label>

          <div className="border rounded-lg text-gray-700 overflow-hidden">
            <div className="max-h-96 overflow-auto">
              {/* Excel-style spreadsheet with proper scrolling */}
              <div className="relative">
                {/* Generate column letters */}
                {(() => {
                  const maxColumns = Math.max(
                    ...previewRows.map((row) => row.length)
                  );
                  const columnLetters: string[] = [];
                  for (let i = 0; i < maxColumns; i++) {
                    columnLetters.push(String.fromCharCode(65 + i)); // A, B, C, etc.
                  }

                  return (
                    <div className="relative">
                      {/* Scrollable container */}
                      <div className="overflow-x-auto">
                        <div className="min-w-full relative">
                          {/* Header row with column letters - sticky */}
                          <div className="flex bg-gray-100 border-b border-gray-300 sticky top-0 z-20">
                            {/* Fixed row number header */}
                            <div className="w-8 h-6 flex-shrink-0 bg-gray-200 border-r border-gray-300 flex items-center justify-center text-xs font-medium text-gray-600 sticky left-0 z-30"></div>
                            {/* Column letters */}
                            {columnLetters.map((letter) => (
                              <div
                                key={letter}
                                className="w-20 h-6 flex-shrink-0 bg-gray-100 border-r border-gray-300 flex items-center justify-center text-xs font-medium text-gray-600"
                              >
                                {letter}
                              </div>
                            ))}
                          </div>

                          {/* Data rows */}
                          {previewRows.map((row, rowIndex) => (
                            <div
                              key={rowIndex}
                              className={`flex border-b border-gray-300 cursor-pointer hover:bg-gray-50 ${
                                rowIndex === selectedHeaderRow
                                  ? "bg-blue-50"
                                  : "bg-white"
                              }`}
                              onClick={() => handleRowSelect(rowIndex)}
                            >
                              {/* Fixed row number with dot indicator */}
                              <div className="w-8 h-6 flex-shrink-0 bg-gray-100 border-r border-gray-300 flex items-center justify-center text-xs font-medium text-gray-600 sticky left-0 z-10">
                                {rowIndex === selectedHeaderRow && (
                                  <div className="absolute left-0.5 w-1 h-1 bg-blue-600 rounded-full"></div>
                                )}
                                <span
                                  className={
                                    rowIndex === selectedHeaderRow
                                      ? "ml-1.5"
                                      : ""
                                  }
                                >
                                  {rowIndex + 1}
                                </span>
                              </div>
                              {/* Scrollable cell data */}
                              {columnLetters.map((letter, cellIndex) => (
                                <div
                                  key={`${rowIndex}-${cellIndex}`}
                                  className={`w-20 h-6 flex-shrink-0 border-r border-gray-300 px-1 flex items-center text-xs truncate ${
                                    rowIndex === selectedHeaderRow
                                      ? "font-semibold"
                                      : ""
                                  }`}
                                  title={row[cellIndex] || ""}
                                >
                                  {row[cellIndex] || ""}
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* Selected header preview */}
        {selectedHeaderRow < rows.length && (
          <div className="space-y-2">
            <Label>Selected headers (Row {selectedHeaderRow + 1}):</Label>
            <div className="p-4 bg-muted/30 rounded-lg">
              <div className="flex flex-wrap gap-2">
                {rows[selectedHeaderRow].map((header, index) => (
                  <Badge
                    key={index}
                    className="bg-primary text-primary-foreground"
                  >
                    {header || `Column ${index + 1}`}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-6 border-t border-zinc-200 dark:border-zinc-800">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back to Upload
        </Button>
        <Button onClick={() => onContinue(selectedHeaderRow)}>
          Continue to Mapping
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
