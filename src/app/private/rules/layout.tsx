'use client';

import React from 'react';
import { Plus, Download, Upload } from 'lucide-react';
import Link from 'next/link';
import { useSelectedLayoutSegments } from 'next/navigation';

import PageHeader from '@/components/private/PageHeader';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useEnhancedUserRules } from '@/hooks/useEnhancedUserRules';

export default function RulesLayout({ children }: { children: React.ReactNode }) {
  const segments = useSelectedLayoutSegments();
  const { user, loading: authLoading } = useAuth();
  const { exportRules, importRules } = useEnhancedUserRules({
    userId: user?.id || '',
    autoFetch: false,
  });

  const showListActions = !segments || segments.length === 0;

  const handleExportRules = async () => {
    try {
      const exportData = await exportRules();
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'user-rules-export.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export rules:', error);
    }
  };

  const handleImportRules = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const text = await file.text();
      const importData = JSON.parse(text);
      await importRules(importData.rules || importData);
    } catch (error) {
      console.error('Failed to import rules:', error);
    }
  };

  return (
    <>
      <PageHeader
        title="Transaction Rules"
        subtitle="Automatically categorize and organize your transactions with powerful rules"
        actions={
          showListActions && !authLoading && user ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  void handleExportRules();
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <label>
                <Button variant="outline" asChild>
                  <span>
                    <Upload className="h-4 w-4 mr-2" />
                    Import
                  </span>
                </Button>
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => {
                    void handleImportRules(e);
                  }}
                />
              </label>
              <Button asChild>
                <Link href="/private/rules/create">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Rule
                </Link>
              </Button>
            </div>
          ) : undefined
        }
      />
      <div className="flex-1  space-y-6 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto animate-fade-in">
        {children}
      </div>
    </>
  );
}
