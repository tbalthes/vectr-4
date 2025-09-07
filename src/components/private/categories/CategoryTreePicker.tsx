"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { ChevronDown, ChevronRight, Search, Check, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils/utils";
import CategoryIcon from "@/components/private/transactions/enhanced_table/CategoryIcon";

interface Category {
  category_id: string; // Updated to match backend response
  name: string;
  icon?: string;
  parent_id?: string;
  parent_name?: string;
  children: Category[];
  depth: number;
  transaction_count?: number;
}

interface CategoryTreeResponse {
  categories: Category[];
  total_count: number;
  max_depth: number;
}

interface CategoryTreePickerProps {
  selectedCategoryIds?: string[];
  onCategoriesChange: (categoryIds: string[], categories: Category[]) => void;
  userId?: string;
  multiSelect?: boolean;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  showTransactionCounts?: boolean;
}

interface CategoryNodeProps {
  category: Category;
  selectedIds: string[];
  onToggle: (categoryId: string) => void;
  searchQuery: string;
  expandedIds: Set<string>;
  onExpand: (categoryId: string) => void;
  multiSelect: boolean;
  showCounts: boolean;
}

function CategoryNode({
  category,
  selectedIds,
  onToggle,
  searchQuery,
  expandedIds,
  onExpand,
  multiSelect,
  showCounts,
}: CategoryNodeProps) {
  const isSelected = selectedIds.includes(category.category_id);
  const isExpanded = expandedIds.has(category.category_id);
  const hasChildren = category.children.length > 0;
  const matchesSearch = searchQuery
    ? category.name.toLowerCase().includes(searchQuery.toLowerCase())
    : true;

  // Check if any descendants match the search
  const hasMatchingDescendants = useMemo(() => {
    if (!searchQuery) return false;

    const checkDescendants = (cats: Category[]): boolean => {
      return cats.some(
        (cat) =>
          cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          checkDescendants(cat.children)
      );
    };

    return checkDescendants(category.children);
  }, [category.children, searchQuery]);

  // Show node if it matches search or has matching descendants
  const shouldShow = !searchQuery || matchesSearch || hasMatchingDescendants;

  if (!shouldShow) return null;

  return (
    <div className="select-none">
      <div
        className={cn(
          "flex items-center gap-2 py-2 px-3 hover:border cursor-pointer rounded-md transition-colors",
          isSelected && "bg-blue-50 border-l-2 border-l-blue-500"
        )}
        style={{ paddingLeft: `${12 + Math.max(0, category.depth) * 20}px` }}
        onClick={() => onToggle(category.category_id)}
      >
        {/* Expand/Collapse Button - Always reserve space */}
        <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
          {hasChildren && (
            <button
              className="p-1 hover:bg-gray-200 rounded"
              onClick={(e) => {
                e.stopPropagation();
                onExpand(category.category_id);
              }}
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
          )}
        </div>

        {/* Selection Indicator */}
        <div
          className={cn(
            "flex-shrink-0 w-4 h-4 border-2 rounded flex items-center justify-center",
            isSelected
              ? "bg-blue-500 border-blue-500"
              : "border-gray-300 hover:border-gray-400",
            !multiSelect && "rounded-full"
          )}
        >
          {isSelected && <Check className="h-3 w-3 text-white" />}
        </div>

        {/* Category Icon */}
        <CategoryIcon
          iconName={category.icon}
          className="w-4 h-4 flex-shrink-0"
          style={{ color: "#6700EE" }}
        />

        {/* Category Name */}
        <span
          className={cn(
            "flex-1 text-xs font-light",
            isSelected ? "text-blue-700" : "dark:text-gray-200",
            matchesSearch && searchQuery && "px-1 rounded"
          )}
        >
          {category.name}
        </span>

        {/* Transaction Count */}
        {showCounts && category.transaction_count !== undefined && (
          <Badge variant="secondary" className="text-xs">
            {category.transaction_count}
          </Badge>
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="ml-2">
          {category.children.map((child) => (
            <CategoryNode
              key={child.category_id}
              category={child}
              selectedIds={selectedIds}
              onToggle={onToggle}
              searchQuery={searchQuery}
              expandedIds={expandedIds}
              onExpand={onExpand}
              multiSelect={multiSelect}
              showCounts={showCounts}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function CategoryTreePicker({
  selectedCategoryIds = [],
  onCategoriesChange,
  userId,
  multiSelect = false,
  placeholder = "Select categories...",
  className,
  disabled = false,
  showTransactionCounts = false,
}: CategoryTreePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Load categories on mount and when userId changes
  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (userId) params.append("user_id", userId);
      if (showTransactionCounts) params.append("include_counts", "true");

      // Add cache busting parameter to force fresh data
      params.append("_t", Date.now().toString());

      const response = await fetch(`/api/categories/tree?${params}`);
      if (!response.ok) {
        throw new Error(`Failed to load categories: ${response.statusText}`);
      }

      const data: CategoryTreeResponse = await response.json();
      console.log(
        "🐛 DEBUG: Loaded categories tree:",
        data.categories.length,
        "root categories"
      );
      console.log(
        "🐛 DEBUG: General categories:",
        data.categories
          .filter((c) => c.name.includes("General"))
          .map((c) => ({
            name: c.name,
            childrenCount: c.children.length,
            children: c.children.map((ch) => ch.name),
          }))
      );

      setCategories(data.categories);

      // Auto-expand first level by default
      const firstLevelIds = data.categories.map((cat) => cat.category_id);
      setExpandedIds(new Set(firstLevelIds));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load categories"
      );
      console.error("Error loading categories:", err);
    } finally {
      setLoading(false);
    }
  }, [userId, showTransactionCounts]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Auto-expand parents of selected categories
  useEffect(() => {
    if (selectedCategoryIds.length > 0 && categories.length > 0) {
      const newExpandedIds = new Set<string>();

      const findParentPath = (
        targetId: string,
        currentCats: Category[],
        path: string[] = []
      ): string[] | null => {
        for (const cat of currentCats) {
          const currentPath = [...path, cat.category_id];
          if (cat.category_id === targetId) {
            return currentPath.slice(0, -1); // Exclude the target itself
          }
          if (cat.children.length > 0) {
            const found = findParentPath(targetId, cat.children, currentPath);
            if (found) return found;
          }
        }
        return null;
      };

      selectedCategoryIds.forEach((id) => {
        const parentPath = findParentPath(id, categories);
        if (parentPath) {
          parentPath.forEach((parentId) => newExpandedIds.add(parentId));
        }
      });

      setExpandedIds((prevExpanded) => {
        const combined = new Set([...prevExpanded, ...newExpandedIds]);
        return combined;
      });
    }
  }, [selectedCategoryIds, categories]);

  // Helper function to get categories by IDs
  const getCategoriesByIds = useCallback(
    (categoryIds: string[]): Category[] => {
      const result: Category[] = [];
      const findCategory = (id: string, cats: Category[]): Category | null => {
        for (const cat of cats) {
          if (cat.category_id === id) return cat;
          const found = findCategory(id, cat.children);
          if (found) return found;
        }
        return null;
      };

      categoryIds.forEach((id) => {
        const category = findCategory(id, categories);
        if (category) result.push(category);
      });

      return result;
    },
    [categories]
  );

  const handleCategoryToggle = (categoryId: string) => {
    if (multiSelect) {
      const newSelection = selectedCategoryIds.includes(categoryId)
        ? selectedCategoryIds.filter((id) => id !== categoryId)
        : [...selectedCategoryIds, categoryId];
      const selectedCategories = getCategoriesByIds(newSelection);
      onCategoriesChange(newSelection, selectedCategories);
    } else {
      const selectedCategories = getCategoriesByIds([categoryId]);
      onCategoriesChange([categoryId], selectedCategories);
      setIsOpen(false);
    }
  };

  const handleExpand = (categoryId: string) => {
    console.log("🐛 DEBUG: handleExpand called with:", categoryId);
    console.log("🐛 DEBUG: Current expandedIds:", Array.from(expandedIds));

    const category = findCategoryById(categoryId);
    console.log("🐛 DEBUG: Found category for expand:", category?.name);

    const newExpandedIds = new Set(expandedIds);
    if (newExpandedIds.has(categoryId)) {
      console.log("🐛 DEBUG: Collapsing category:", categoryId);
      newExpandedIds.delete(categoryId);
    } else {
      console.log("🐛 DEBUG: Expanding category:", categoryId);
      newExpandedIds.add(categoryId);
    }
    console.log("🐛 DEBUG: New expandedIds:", Array.from(newExpandedIds));
    setExpandedIds(newExpandedIds);
  };

  // Helper function to find category by ID in the tree
  const findCategoryById = (id: string): Category | null => {
    const searchInCategories = (cats: Category[]): Category | null => {
      for (const cat of cats) {
        if (cat.category_id === id) return cat;
        const found = searchInCategories(cat.children);
        if (found) return found;
      }
      return null;
    };
    return searchInCategories(categories);
  };

  const clearSelection = () => {
    onCategoriesChange([], []);
  };

  const getSelectedCategoryNames = () => {
    const findCategoryName = (id: string, cats: Category[]): string | null => {
      for (const cat of cats) {
        if (cat.category_id === id) return cat.name;
        const found = findCategoryName(id, cat.children);
        if (found) return found;
      }
      return null;
    };

    return selectedCategoryIds
      .map((id) => findCategoryName(id, categories))
      .filter(Boolean) as string[];
  };

  const selectedNames = getSelectedCategoryNames();
  const displayText =
    selectedNames.length > 0 ? selectedNames.join(", ") : placeholder;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-between font-normal",
            selectedNames.length === 0 && "text-gray-500",
            className
          )}
          disabled={disabled}
        >
          <span className="truncate">{displayText}</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md max-h-[600px] p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="flex items-center justify-between">
            {multiSelect ? "Select Categories" : "Select Category"}
            {selectedNames.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                className="h-8 px-2 text-gray-500 hover:text-gray-700"
              >
                <X className="h-4 w-4" />
                Clear
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-200 h-4 w-4" />
            <Input
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Selected Categories Summary */}
        {multiSelect && selectedNames.length > 0 && (
          <div className="px-6 pb-4">
            <div className="text-sm text-gray-600 mb-2">
              Selected ({selectedNames.length}):
            </div>
            <div className="flex flex-wrap gap-1">
              {selectedNames.map((name, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <ScrollArea className="flex-1 max-h-80">
          <div className="px-6 pb-6">
            {loading && (
              <div className="text-center py-8 text-gray-500">
                Loading categories...
              </div>
            )}

            {error && (
              <div className="text-center py-8">
                <div className="text-red-500 mb-2">
                  Error loading categories
                </div>
                <Button variant="outline" size="sm" onClick={loadCategories}>
                  Try Again
                </Button>
              </div>
            )}

            {!loading && !error && categories.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No categories found
              </div>
            )}

            {!loading && !error && categories.length > 0 && (
              <div className="space-y-1">
                {categories.map((category) => (
                  <CategoryNode
                    key={category.category_id}
                    category={category}
                    selectedIds={selectedCategoryIds}
                    onToggle={handleCategoryToggle}
                    searchQuery={searchQuery}
                    expandedIds={expandedIds}
                    onExpand={handleExpand}
                    multiSelect={multiSelect}
                    showCounts={showTransactionCounts}
                  />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export default CategoryTreePicker;
