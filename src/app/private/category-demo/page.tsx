"use client";

import { useState } from "react";

import { CategoryTreePicker } from "@/components/private/categories/CategoryTreePicker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Category {
  id: string;
  name: string;
  icon?: string;
  parent_id?: string;
  parent_name?: string;
}

export default function CategoryPickerDemo() {
  const [singleSelected, setSingleSelected] = useState<string[]>([]);
  const [singleSelectedCategories, setSingleSelectedCategories] = useState<
    Category[]
  >([]);
  const [multiSelected, setMultiSelected] = useState<string[]>([]);
  const [multiSelectedCategories, setMultiSelectedCategories] = useState<
    Category[]
  >([]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Category Tree Picker Demo</h1>
        <p className="text-gray-600">
          Test the hierarchical category picker component
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Single Select Demo */}
        <Card>
          <CardHeader>
            <CardTitle>Single Select Mode</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CategoryTreePicker
              selectedCategoryIds={singleSelected}
              onCategoriesChange={(ids, categories) => {
                setSingleSelected(ids);
                setSingleSelectedCategories(categories);
              }}
              multiSelect={false}
              placeholder="Choose a category..."
              showTransactionCounts={true}
            />

            <div className="p-3 bg-gray-50 rounded">
              <div className="text-sm font-medium mb-1">Selected IDs:</div>
              <pre className="text-xs text-gray-600 mb-2">
                {JSON.stringify(singleSelected, null, 2)}
              </pre>
              <div className="text-sm font-medium mb-1">
                Selected Categories:
              </div>
              <pre className="text-xs text-gray-600">
                {JSON.stringify(singleSelectedCategories, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* Multi Select Demo */}
        <Card>
          <CardHeader>
            <CardTitle>Multi Select Mode</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CategoryTreePicker
              selectedCategoryIds={multiSelected}
              onCategoriesChange={(ids, categories) => {
                setMultiSelected(ids);
                setMultiSelectedCategories(categories);
              }}
              multiSelect={true}
              placeholder="Choose categories..."
              showTransactionCounts={true}
            />

            <div className="p-3 bg-gray-50 rounded">
              <div className="text-sm font-medium mb-1">Selected IDs:</div>
              <pre className="text-xs text-gray-600 mb-2">
                {JSON.stringify(multiSelected, null, 2)}
              </pre>
              <div className="text-sm font-medium mb-1">
                Selected Categories:
              </div>
              <pre className="text-xs text-gray-600">
                {JSON.stringify(multiSelectedCategories, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feature Showcase */}
      <Card>
        <CardHeader>
          <CardTitle>Features</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              Hierarchical tree structure with expand/collapse
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              Real-time search with highlighting
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              Single and multi-select modes
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              Auto-expand parents of selected categories
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              Optional transaction counts display
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              Category icons and visual hierarchy
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
