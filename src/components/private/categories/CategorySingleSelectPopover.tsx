'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ChevronDown, ChevronRight, Search, Check, X, Plus } from 'lucide-react';

import CreateCategoryModal from './CreateCategoryModal';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils/utils';
import CategoryIcon from '@/components/private/transactions/enhanced_table/CategoryIcon';

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
  const isSelected = selectedId === category.category_id;
  const isExpanded = expandedIds.has(category.category_id);
  const hasChildren = category.children.length > 0;
  const matchesSearch = searchQuery
    ? category.name.toLowerCase().includes(searchQuery.toLowerCase())
    : true;

  const hasMatchingDescendants = useMemo(() => {
    if (!searchQuery) {
      return false;
    }
    const checkDescendants = (cats: Category[]): boolean =>
      cats.some(
        (cat) =>
          cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          checkDescendants(cat.children),
      );
    return checkDescendants(category.children);
  }, [category.children, searchQuery]);

  const shouldShow = !searchQuery || matchesSearch || hasMatchingDescendants;
  if (!shouldShow) {
    return null;
  }

  return (
    <div className="select-none">
      <div
        className={cn(
          'flex items-center gap-2 py-2 px-2 hover:bg-muted/50 cursor-pointer rounded-sm transition-colors duration-150',
          isSelected && 'bg-primary/10 border-l-2 border-l-primary',
        )}
        style={{ marginLeft: `${Math.max(0, category.depth) * 16}px` }}
        onClick={() => onSelect(category.category_id)}
      >
        {/* Expand/Collapse Button space reserved for alignment */}
        <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
          {hasChildren && (
            <button
              className="p-0.5 rounded hover:bg-muted transition-colors"
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

        {/* Selection Indicator (only show when selected) */}
        {isSelected ? (
          <div className="flex-shrink-0 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
            <Check className="h-2.5 w-2.5 text-primary-foreground" />
          </div>
        ) : (
          // keep spacing without showing dots
          <div className="flex-shrink-0 w-4 h-4" />
        )}

        {/* Category Icon */}
        <CategoryIcon
          iconName={category.icon}
          className="w-4 h-4 flex-shrink-0"
          style={{ color: '#6700EE' }}
        />

        {/* Category Name */}
        <span
          className={cn(
            'flex-1 text-sm font-medium truncate',
            isSelected ? 'text-primary' : 'text-foreground',
            matchesSearch && searchQuery && 'bg-yellow-100 dark:bg-yellow-900/30 px-1 rounded',
          )}
        >
          {category.name}
        </span>

        {/* Count */}
        {showCounts && typeof category.transaction_count === 'number' && (
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {category.transaction_count}
          </span>
        )}
      </div>

      {hasChildren && (
        <div
          className={`overflow-hidden transition-all duration-200 ease-in-out ${
            isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          {isExpanded && (
            <div className="space-y-1 mt-1">
              {category.children.map((child) => (
                <CategoryNode
                  key={child.category_id}
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
      )}
    </div>
  );
}

export default function CategorySingleSelectPopover({
  value = null,
  onChange,
  userId,
  placeholder = 'Select a category...',
  className,
  disabled = false,
  showTransactionCounts = false,
}: CategorySingleSelectProps) {
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (userId) {
        params.append('user_id', userId);
      }
      if (showTransactionCounts) {
        params.append('include_counts', 'true');
      }
      const url = `/api/categories/tree?${params}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to load categories: ${res.statusText}`);
      }
      const data: CategoryTreeResponse = await res.json();
      setCategories(data.categories);
      // Start with all categories collapsed for better UX
      // const firstLevelIds = data.categories.map((cat) => cat.category_id);
      // setExpandedIds(new Set(firstLevelIds)); // Keep collapsed for better performance and UX
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load categories');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [userId, showTransactionCounts]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  // Ensure parents of selected value are expanded
  useEffect(() => {
    if (!value || categories.length === 0) {
      return;
    }
    const newExpanded = new Set<string>();
    const findPath = (id: string, cats: Category[], path: string[] = []): string[] | null => {
      for (const cat of cats) {
        const currentPath = [...path, cat.category_id];
        if (cat.category_id === id) {
          return currentPath.slice(0, -1);
        }
        if (cat.children.length) {
          const found = findPath(id, cat.children, currentPath);
          if (found) {
            return found;
          }
        }
      }
      return null;
    };
    const path = findPath(value, categories);
    if (path) {
      path.forEach((pid) => newExpanded.add(pid));
    }
    setExpandedIds((prev) => new Set([...prev, ...newExpanded]));
  }, [value, categories]);

  const getCategoryById = useCallback(
    (id: string): Category | null => {
      const search = (cats: Category[]): Category | null => {
        for (const cat of cats) {
          if (cat.category_id === id) {
            return cat;
          }
          const found = search(cat.children);
          if (found) {
            return found;
          }
        }
        return null;
      };
      return search(categories);
    },
    [categories],
  );

  const selectedName = useMemo(() => {
    if (!value) {
      return placeholder;
    }
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
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedIds(next);
  };

  const clear = () => {
    onChange(null, null);
  };

  const handleCreateCategory = () => {
    setShowCreateModal(true);
    setOpen(false);
  };

  const handleCategoryCreated = (newCategory: Category) => {
    console.log('New category created:', newCategory);
    // Reload categories to include the new one
    void loadCategories();
    // Optionally select the new category
    console.log('Setting selected category to:', newCategory.category_id);
    onChange(newCategory.category_id, newCategory);
    // Close the create modal
    setShowCreateModal(false);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-full justify-between font-normal',
              !value && 'text-gray-500',
              className,
            )}
            disabled={disabled}
          >
            <span className="truncate flex items-center gap-2">
              {/* Show icon if possible */}
              {value && (
                <CategoryIcon
                  iconName={getCategoryById(value || '')?.icon}
                  className="w-4 h-4 flex-shrink-0"
                  style={{ color: '#6700EE' }}
                />
              )}
              {selectedName}
            </span>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[360px] max-w-[calc(100vw-24px)] max-h-[60vh] p-0 flex flex-col"
          align="start"
          side="bottom"
          sideOffset={6}
          collisionPadding={12}
          onWheel={(e) => {
            // Allow wheel events to reach the scroll container
            e.stopPropagation();
          }}
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
          <div className="flex-1 overflow-hidden">
            <div
              className="max-h-[35vh] overflow-y-auto"
              onWheel={(e) => {
                e.stopPropagation();
                e.preventDefault();
                const target = e.currentTarget;
                const scrollAmount = e.deltaY * 0.5; // Slower, smoother scrolling
                target.scrollTop += scrollAmount;
              }}
              style={{
                scrollBehavior: 'smooth',
                scrollbarWidth: 'thin',
                scrollbarColor: 'hsl(var(--muted)) transparent',
              }}
            >
              <div className="px-2 py-2 space-y-0.5" tabIndex={0} style={{ outline: 'none' }}>
                {loading && <div className="text-center py-8">Loading categories...</div>}
                {error && (
                  <div className="text-center py-8">
                    <div className="text-red-500 mb-2">Error loading categories</div>
                    <Button variant="outline" size="sm" onClick={() => void loadCategories()}>
                      Try Again
                    </Button>
                  </div>
                )}
                {!loading && !error && categories.length === 0 && (
                  <div className="text-center py-8">No categories found</div>
                )}
                {!loading && !error && categories.length > 0 && (
                  <div className="space-y-1">
                    {/* Create new category option */}
                    {searchQuery && (
                      <div className="mb-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCreateCategory}
                          className="w-full justify-start gap-2 text-primary"
                        >
                          <Plus className="h-4 w-4" />
                          Create &ldquo;{searchQuery}&rdquo;
                        </Button>
                      </div>
                    )}

                    {categories.map((category) => (
                      <CategoryNode
                        key={category.category_id}
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
            </div>
          </div>
          <div className="px-2 py-1 bg-background border-t border-border/50 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={clear}
              className="h-7 px-2 text-xs hover:bg-muted"
            >
              <X className="h-3 w-3 mr-1" />
              Clear
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Create Category Modal */}
      <CreateCategoryModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCategoryCreated}
        userId={userId}
        initialName={searchQuery}
      />
    </>
  );
}
