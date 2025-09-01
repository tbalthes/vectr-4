"use client";

import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MonarchStyleRuleBuilder } from '@/components/private/rules/MonarchStyleRuleBuilder';
import { useCategories } from '@/hooks/useCategories';
import { useRouter } from 'next/navigation';
import { useEnhancedUserRules } from '@/hooks/useEnhancedUserRules';
import { useAuth } from '@/hooks/useAuth';

export default function CreateRulePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { categories, loading: categoriesLoading } = useCategories();
  const { createRule } = useEnhancedUserRules({ 
    userId: user?.id || '',
    autoFetch: false 
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSaveRule = async (ruleData: any) => {
    if (!user?.id) {
      console.error('No authenticated user');
      return;
    }

    try {
      await createRule({ ...ruleData, user_id: user.id });
      router.push('/private/rules/enhanced');
    } catch (error) {
      console.error('Failed to create rule:', error);
    }
  };

  const handleCancel = () => {
    router.push('/private/rules/enhanced');
  };

  if (authLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading user session...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center text-red-600">Please log in to create rules</div>
      </div>
    );
  }

  if (categoriesLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading categories...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="p-2"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Create New Rule</h1>
              <p className="text-sm text-gray-600 mt-1">
                Create a new rule to automatically categorize your transactions
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <MonarchStyleRuleBuilder
              rule={null}
              onSave={handleSaveRule}
              onCancel={handleCancel}
              categories={categories}
              userId={user.id}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
