import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileText, AlertCircle } from "lucide-react";

interface FileUploadStepProps {
  onFileUpload: (file: File, content: string) => void;
}

function getDropzoneClassName(isDragging: boolean, isLoading: boolean) {
  const base =
    "border-2 border-dashed rounded-lg p-8 text-center transition-colors";
  const drag =
    isDragging
      ? "border-zinc-900 bg-zinc-900/5 dark:border-zinc-300 dark:bg-zinc-300/5"
      : "border-zinc-200 hover:border-zinc-900/50 dark:border-zinc-800 dark:hover:border-zinc-300/50";
  const loading = isLoading ? "opacity-50 pointer-events-none" : "";
  return [base, drag, loading].join(" ");
}

export function FileUploadStep({ onFileUpload }: FileUploadStepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (file: File) => {
    setError(null);
    setIsLoading(true);

    try {
      // Validate file type
      if (!file.name.toLowerCase().endsWith(".csv")) {
        throw new Error("Please select a CSV file");
      }

      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        throw new Error("File size must be less than 10MB");
      }

      // Read file content
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target && typeof e.target.result === "string") {
            resolve(e.target.result);
          } else {
            reject(new Error("Failed to read file content"));
          }
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsText(file);
      });

      // Basic validation
      if (!content.trim()) {
        throw new Error("The CSV file appears to be empty");
      }

      onFileUpload(file, content);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An error occurred while reading the file");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files && e.target.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files.length > 1) {
      setError("Please drop only one file at a time.");
      return;
    }

    const file = e.dataTransfer.files[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith(".csv")) {
        setError("Only CSV files are accepted. Please drop a .csv file.");
        return;
      }
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  return (
    <div className="space-y-6">
      {error && (
        <Alert className="relative w-full rounded-lg border border-red-500 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300 mb-4">
          <AlertCircle className="w-4 h-4 absolute left-4 top-3.5" />
          <AlertDescription className="ml-6">{error}</AlertDescription>
        </Alert>
      )}
      <div
        className={getDropzoneClassName(isDragging, isLoading)}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !isLoading && fileInputRef.current?.click()}
        style={{ cursor: isLoading ? "not-allowed" : "pointer" }}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
            <FileText className="w-8 h-8 text-zinc-900 dark:text-zinc-50" />
          </div>

          <div className="space-y-1">
            <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
              Drag and drop your CSV file here
            </h3>
            <p className="text-zinc-500 dark:text-zinc-400">
              or click to browse
            </p>
          </div>

          <Button
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-zinc-900 text-zinc-50 hover:bg-zinc-900/90 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-50/90 h-10 px-4 py-2 mt-2"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            disabled={isLoading}
          >
            {isLoading ? "Reading file..." : "Choose File"}
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileInputChange}
            disabled={isLoading}
          />
        </div>
      </div>

      <Card className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm">
        <CardHeader className="p-6">
          <CardTitle className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Supported Formats
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 pt-0 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium text-zinc-900 dark:text-zinc-50">
                File Requirements
              </h4>
              <ul className="text-zinc-500 dark:text-zinc-400 space-y-1 text-sm list-disc list-inside">
                <li>CSV format (.csv)</li>
                <li>Maximum 10MB file size</li>
                <li>UTF-8 or ASCII encoding</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-zinc-900 dark:text-zinc-50">
                Common Sources
              </h4>
              <ul className="text-zinc-500 dark:text-zinc-400 space-y-1 text-sm list-disc list-inside">
                <li>Bank statements</li>
                <li>Credit card statements</li>
                <li>PayPal exports</li>
                <li>Accounting software exports</li>
              </ul>
            </div>
          </div>

          <Alert className="relative w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 p-4 text-zinc-900 dark:text-zinc-50">
            <AlertDescription className="text-sm">
              <strong>Note:</strong> Different banks format their CSV files
              differently. Our intelligent header detection will help identify
              the correct columns automatically, but you&#39;ll have a chance to
              review and adjust the mapping.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
