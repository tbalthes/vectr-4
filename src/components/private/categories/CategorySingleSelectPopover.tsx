"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { ChevronDown, ChevronRight, Search, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils/utils";
import CategoryIcon from "@/components/private/transactions/enhanced_table/CategoryIcon";

interface Category {
  id: string;
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

export interface CategorySingleSelectProps {
  value?: string | null;
  onChange: (categoryId: string | null, category?: Category | null) => void;
  userId?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  showTransactionCounts?: boolean;
}

interface CategoryNodeProps {
  category: Category;
  selectedId: string | null;
  onSelect: (categoryId: string) => void;
  searchQuery: string;
  expandedIds: Set<string>;
  onExpand: (categoryId: string) => void;
  showCounts: boolean;
}

function CategoryNode({
  category,
  selectedId,
  onSelect,
  searchQuery,
  expandedIds,
  onExpand,
  showCounts,
}: CategoryNodeProps) {
  const isSelected = selectedId === category.id;
  const isExpanded = expandedIds.has(category.id);
  const hasChildren = category.children.length > 0;
  const matchesSearch = searchQuery
    ? category.name.toLowerCase().includes(searchQuery.toLowerCase())
    : true;

  const hasMatchingDescendants = useMemo(() => {
    if (!searchQuery) return false;
    const checkDescendants = (cats: Category[]): boolean =>
      cats.some(
        (cat) =>
          cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          checkDescendants(cat.children)
      );
    return checkDescendants(category.children);
  }, [category.children, searchQuery]);

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
        onClick={() => onSelect(category.id)}
      >
        {/* Expand/Collapse Button space reserved for alignment */}
        <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
          {hasChildren && (
            <button
              className="p-1 rounded"
              onClick={(e) => {
                e.stopPropagation();
                onExpand(category.id);
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

        {/* Selection Indicator (only show when selected) */}
        {isSelected ? (
          <div className="flex-shrink-0 w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
            <Check className="h-3 w-3 text-grey-50" />
          </div>
        ) : (
          // keep spacing without showing dots
          <div className="flex-shrink-0 w-4 h-4" />
        )}

        {/* Category Icon */}
        <CategoryIcon iconName={category.icon} className="w-4 h-4 flex-shrink-0" style={{ color: "#6700EE" }} />

        {/* Category Name */}
        <span
          className={cn(
            "flex-1 text-xs font-semibold",
            isSelected ? "text-blue-700" : "dark:text-gray-50",
            matchesSearch && searchQuery && "px-1 rounded"
          )}
        >
          {category.name}
        </span>

        {/* Count */}
        {showCounts && typeof category.transaction_count === "number" && (
          <span className="text-[10px] text-gray-500">{category.transaction_count}</span>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div className="ml-2">
          {category.children.map((child) => (
            <CategoryNode
              key={child.id}
              category={child}
              selectedId={selectedId}
              onSelect={onSelect}
              searchQuery={searchQuery}
              expandedIds={expandedIds}
              onExpand={onExpand}
              showCounts={showCounts}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CategorySingleSelectPopover({
  value = null,
  onChange,
  userId,
  placeholder = "Select a category...",
  className,
  disabled = false,
  showTransactionCounts = false,
}: CategorySingleSelectProps) {
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (userId) params.append("user_id", userId);
      if (showTransactionCounts) params.append("include_counts", "true");
      const res = await fetch(`/api/categories/tree?${params}`);
      if (!res.ok) throw new Error(`Failed to load categories: ${res.statusText}`);
  const data: CategoryTreeResponse = await res.json();
  setCategories(data.categories);
  // Default: keep all parents collapsed initially
  setExpandedIds(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load categories");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [userId, showTransactionCounts]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Ensure parents of selected value are expanded
  useEffect(() => {
    if (!value || categories.length === 0) return;
    const newExpanded = new Set<string>();
    const findPath = (id: string, cats: Category[], path: string[] = []): string[] | null => {
      for (const cat of cats) {
        const currentPath = [...path, cat.id];
        if (cat.id === id) return currentPath.slice(0, -1);
        if (cat.children.length) {
          const found = findPath(id, cat.children, currentPath);
          if (found) return found;
        }
      }
      return null;
    };
    const path = findPath(value, categories);
    if (path) path.forEach((pid) => newExpanded.add(pid));
    setExpandedIds((prev) => new Set([...prev, ...newExpanded]));
  }, [value, categories]);

  const getCategoryById = useCallback((id: string): Category | null => {
    const search = (cats: Category[]): Category | null => {
      for (const cat of cats) {
        if (cat.id === id) return cat;
        const found = search(cat.children);
        if (found) return found;
      }
      return null;
    };
    return search(categories);
  }, [categories]);

  const selectedName = useMemo(() => {
    if (!value) return placeholder;
    const cat = getCategoryById(value);
    return cat ? cat.name : placeholder;
  }, [value, getCategoryById, placeholder]);

  const onSelect = (id: string) => {
    const cat = getCategoryById(id);
    onChange(id, cat);
    setOpen(false);
  };

  const onExpand = (id: string) => {
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpandedIds(next);
  };

  const clear = () => {
    onChange(null, null);
  };

  return (
  <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-gray-500",
            className
          )}
          disabled={disabled}
        >
          <span className="truncate flex items-center gap-2">
            {/* Show icon if possible */}
            {value && (
              <CategoryIcon
                iconName={getCategoryById(value || "")?.icon}
                className="w-4 h-4 flex-shrink-0"
                style={{ color: "#6700EE" }}
              />
            )}
            {selectedName}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[360px] max-w-[calc(100vw-24px)] max-h-[80vh] overflow-hidden overflow-x-hidden p-0 flex flex-col"
        align="start"
        side="bottom"
        sideOffset={6}
        collisionPadding={12}
      >
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2  h-4 w-4" />
            <Input
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <ScrollArea className="flex-1 max-h-[30vh] overflow-y-auto overflow-x-hidden">
          <div className="px-2 py-2 min-w-0">
            {loading && (
              <div className="text-center py-8 ">Loading categories...</div>
            )}
            {error && (
              <div className="text-center py-8">
                <div className="text-red-500 mb-2">Error loading categories</div>
                <Button variant="outline" size="sm" onClick={loadCategories}>
                  Try Again
                </Button>
              </div>
            )}
            {!loading && !error && categories.length === 0 && (
              <div className="text-center py-8 ">No categories found</div>
            )}
            {!loading && !error && categories.length > 0 && (
              <div className="space-y-1">
                {categories.map((category) => (
                  <CategoryNode
                    key={category.id}
                    category={category}
                    selectedId={value || null}
                    onSelect={onSelect}
                    searchQuery={searchQuery}
                    expandedIds={expandedIds}
                    onExpand={onExpand}
                    showCounts={showTransactionCounts}
                  />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
        <div className="p-2 border-t flex justify-end">
          <Button variant="ghost" size="sm" onClick={clear} className="h-8 px-2  hover:bg-accent">
            <X className="h-4 w-4" />
            Clear
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
