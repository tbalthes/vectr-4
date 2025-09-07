// src/components/private/transactions/filters/AdvancedFilterPanel.tsx
"use client";

import React, { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import {
  X,
  Filter,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  DollarSign,
  Building2,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMerchants } from "@/hooks/useMerchants";
import { LucideIcon } from "@/components/ui/LucideIcon";

// Component for merchant logo with reliable fallback
interface MerchantLogoProps {
  merchant: {
    id: string;
    name: string;
    logo_url?: string | null;
  };
}

function MerchantLogo({ merchant }: MerchantLogoProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Reset state when merchant changes
  useEffect(() => {
    setImageError(false);
    setImageLoaded(false);
  }, [merchant.id, merchant.logo_url]);

  const hasValidUrl = isValidImageUrl(merchant.logo_url || null);
  const showFallback = !hasValidUrl || imageError;

  if (showFallback) {
    return (
      <div className="w-5 h-5 rounded bg-white flex items-center justify-center flex-shrink-0">
        <Building2 className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="w-5 h-5 flex-shrink-0 relative">
      <Image
        src={
          merchant.logo_url!.startsWith("http:")
            ? merchant.logo_url!.replace("http:", "https:")
            : merchant.logo_url!
        }
        alt={merchant.name}
        width={20}
        height={20}
        className="rounded object-cover w-full h-full"
        onError={() => {
          setImageError(true);
        }}
        onLoad={() => {
          setImageLoaded(true);
        }}
      />
      {/* Show fallback while loading */}
      {!imageLoaded && !imageError && (
        <div className="absolute inset-0 rounded bg-muted flex items-center justify-center">
          <Building2 className="h-3 w-3 text-muted-foreground animate-pulse" />
        </div>
      )}
    </div>
  );
}

// Helper function to validate image URLs
const isValidImageUrl = (url: string | null): boolean => {
  if (!url || url.trim() === "" || url === "null" || url === "undefined") {
    return false;
  }
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// Extended category interface with parent info for tree structure
interface TreeCategory {
  category_id: string;
  name: string;
  icon?: string;
  parent_id?: string;
  children: TreeCategory[];
  depth: number;
}

export interface AdvancedFilterState {
  selectedCategories: string[];
  selectedMerchants: string[];
  selectedAccounts: string[];
  selectedTags: string[];
  selectedGoals: string[];
  amountMin?: number;
  amountMax?: number;
  amountType: "all" | "income" | "expense";
  dateRange: {
    from?: Date;
    to?: Date;
  };
  otherFilters: {
    needsReview: boolean;
    hasAttachments: boolean;
    isRecurring: boolean;
    hasNotes: boolean;
    uncategorized: boolean;
  };
}

interface AdvancedFilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  filters: AdvancedFilterState;
  onFiltersChange: (filters: AdvancedFilterState) => void;
  onApply: () => void;
  onClear: () => void;
  userId?: string;
}

interface FilterSectionProps {
  title: string;
  icon: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  count?: number;
}

function FilterSection({
  title,
  icon,
  isExpanded,
  onToggle,
  children,
  count,
}: FilterSectionProps) {
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {icon}
          <span className="font-medium">{title}</span>
          {count !== undefined && count > 0 && (
            <Badge variant="secondary" className="text-xs">
              {count}
            </Badge>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {isExpanded && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

export function AdvancedFilterPanel({
  isOpen,
  onClose,
  filters,
  onFiltersChange,
  onApply,
  onClear,
  userId,
}: AdvancedFilterPanelProps) {
  // Fetch real data from APIs
  const { merchants, loading: merchantsLoading } = useMerchants();

  // State for tree categories
  const [treeCategories, setTreeCategories] = useState<TreeCategory[]>([]);
  const [loadingTreeCategories, setLoadingTreeCategories] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set()
  );

  // Load tree categories
  useEffect(() => {
    const loadTreeCategories = async () => {
      try {
        setLoadingTreeCategories(true);

        // Build URL with userId parameter if available
        const params = new URLSearchParams();
        if (userId) {
          params.append("user_id", userId);
        }

        const url = `/api/categories/tree${
          params.toString() ? `?${params.toString()}` : ""
        }`;
        console.log("Loading categories from:", url);

        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to load categories tree");
        const data = await response.json();

        console.log(
          "Loaded categories:",
          data.categories?.length || 0,
          "categories"
        );
        setTreeCategories(data.categories || []);

        // Start with all categories collapsed by default
        setExpandedCategories(new Set<string>());
      } catch (error) {
        console.error("Error loading tree categories:", error);
        setTreeCategories([]);
      } finally {
        setLoadingTreeCategories(false);
      }
    };

    if (isOpen) {
      loadTreeCategories();
    }
  }, [isOpen, userId]);

  const [expandedSections, setExpandedSections] = useState({
    categories: true,
    merchants: false,
    accounts: false,
    tags: false,
    goals: false,
    amount: false,
    other: false,
  });

  const toggleSection = useCallback(
    (section: keyof typeof expandedSections) => {
      setExpandedSections((prev) => ({
        ...prev,
        [section]: !prev[section],
      }));
    },
    []
  );

  // Helper function to get all children category names recursively
  const getAllChildrenNames = (category: TreeCategory): string[] => {
    const children: string[] = [];
    const traverse = (cat: TreeCategory) => {
      if (cat.children && cat.children.length > 0) {
        cat.children.forEach((child) => {
          children.push(child.name);
          traverse(child);
        });
      }
    };
    traverse(category);
    return children;
  };

  // Helper function to check if all children are selected
  const areAllChildrenSelected = (category: TreeCategory): boolean => {
    const childrenNames = getAllChildrenNames(category);
    return (
      childrenNames.length > 0 &&
      childrenNames.every((name) => filters.selectedCategories.includes(name))
    );
  };

  // Helper function to check if some children are selected (for indeterminate state)
  const areSomeChildrenSelected = (category: TreeCategory): boolean => {
    const childrenNames = getAllChildrenNames(category);
    return (
      childrenNames.length > 0 &&
      childrenNames.some((name) => filters.selectedCategories.includes(name))
    );
  };

  // Helper function to toggle category expansion
  const toggleCategoryExpansion = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  // Enhanced category toggle with parent-child logic
  const handleCategoryToggleWithChildren = (category: TreeCategory) => {
    const isSelected = filters.selectedCategories.includes(category.name);
    const childrenNames = getAllChildrenNames(category);

    let newSelected: string[];

    if (isSelected) {
      // If parent is selected, unselect parent and all children
      newSelected = filters.selectedCategories.filter(
        (name) => name !== category.name && !childrenNames.includes(name)
      );
    } else {
      // If parent is not selected, select parent and all children
      newSelected = [
        ...filters.selectedCategories.filter(
          (name) => name !== category.name && !childrenNames.includes(name)
        ),
        category.name,
        ...childrenNames,
      ];
    }

    updateFilters({ selectedCategories: newSelected });
  };

  // Helper function to flatten tree categories
  const flattenTreeCategories = (
    categories: TreeCategory[]
  ): TreeCategory[] => {
    const flattened: TreeCategory[] = [];
    const traverse = (cats: TreeCategory[]) => {
      cats.forEach((cat) => {
        flattened.push(cat);
        if (cat.children && cat.children.length > 0) {
          traverse(cat.children);
        }
      });
    };
    traverse(categories);
    return flattened;
  };

  // Helper function to render category tree with collapsible functionality
  const renderCategoryTree = (
    categories: TreeCategory[],
    depth = 0
  ): React.ReactNode => {
    return categories.map((category) => {
      const hasChildren = category.children && category.children.length > 0;
      const isExpanded = expandedCategories.has(category.category_id);
      const isSelected = filters.selectedCategories.includes(category.name);
      const someChildrenSelected =
        hasChildren && areSomeChildrenSelected(category);
      const allChildrenSelected =
        hasChildren && areAllChildrenSelected(category);

      // Determine checkbox state
      const checkboxState = isSelected
        ? "checked"
        : someChildrenSelected && !allChildrenSelected
        ? "indeterminate"
        : "unchecked";

      return (
        <div key={category.category_id} className="space-y-0.5">
          {/* Category Item */}
          <div
            className="flex items-center space-x-2 py-1 px-1 rounded hover:bg-muted/30 transition-colors"
            style={{ marginLeft: `${depth * 16}px` }}
          >
            {/* Expand/Collapse button for parent categories */}
            {hasChildren ? (
              <button
                onClick={() => toggleCategoryExpansion(category.category_id)}
                className="flex-shrink-0 p-0.5 hover:bg-muted rounded transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                )}
              </button>
            ) : (
              <div className="flex-shrink-0 w-4 h-4" />
            )}

            <div className="relative flex-shrink-0 w-4 h-4">
              <Checkbox
                id={category.category_id}
                checked={checkboxState === "checked"}
                onCheckedChange={() => {
                  if (hasChildren) {
                    handleCategoryToggleWithChildren(category);
                  } else {
                    handleCategoryToggle(category.name);
                  }
                }}
                className="w-4 h-4"
              />
              {/* Visual indicator for indeterminate state */}
              {checkboxState === "indeterminate" && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-2 h-0.5 bg-primary rounded-sm" />
                </div>
              )}
            </div>
            <label
              htmlFor={category.category_id}
              className="flex items-center gap-2 text-sm cursor-pointer flex-1"
            >
              <LucideIcon
                name={category.icon || "tag"}
                className="h-4 w-4 text-[#6700EE]"
              />
              <span className={depth === 0 ? "font-medium" : ""}>
                {category.name}
              </span>
            </label>
          </div>

          {/* Render children if expanded */}
          {hasChildren && (
            <div
              className={`overflow-hidden transition-all duration-200 ease-in-out ${
                isExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
              }`}
            >
              {isExpanded && (
                <div className="space-y-1">
                  {renderCategoryTree(category.children, depth + 1)}
                </div>
              )}
            </div>
          )}
        </div>
      );
    });
  };

  const updateFilters = useCallback(
    (updates: Partial<AdvancedFilterState>) => {
      onFiltersChange({ ...filters, ...updates });
    },
    [filters, onFiltersChange]
  );

  const handleCategoryToggle = useCallback(
    (categoryId: string) => {
      const newSelected = filters.selectedCategories.includes(categoryId)
        ? filters.selectedCategories.filter((id) => id !== categoryId)
        : [...filters.selectedCategories, categoryId];

      updateFilters({ selectedCategories: newSelected });
    },
    [filters.selectedCategories, updateFilters]
  );

  const handleMerchantToggle = useCallback(
    (merchantId: string) => {
      const newSelected = filters.selectedMerchants.includes(merchantId)
        ? filters.selectedMerchants.filter((id) => id !== merchantId)
        : [...filters.selectedMerchants, merchantId];

      updateFilters({ selectedMerchants: newSelected });
    },
    [filters.selectedMerchants, updateFilters]
  );

  const handleSelectAll = useCallback(
    (section: "categories" | "merchants" | "accounts" | "tags" | "goals") => {
      switch (section) {
        case "categories":
          const allCategoryIds = flattenTreeCategories(treeCategories).map(
            (c) => c.name
          );
          updateFilters({
            selectedCategories:
              filters.selectedCategories.length === allCategoryIds.length
                ? []
                : allCategoryIds,
          });
          break;
        case "merchants":
          const allMerchantIds = merchants.map((m) => m.name);
          updateFilters({
            selectedMerchants:
              filters.selectedMerchants.length === allMerchantIds.length
                ? []
                : allMerchantIds,
          });
          break;
        // Add other cases as needed
      }
    },
    [filters, updateFilters, treeCategories, merchants]
  );

  const getSelectedCount = useCallback(() => {
    return (
      filters.selectedCategories.length +
      filters.selectedMerchants.length +
      filters.selectedAccounts.length +
      filters.selectedTags.length +
      filters.selectedGoals.length +
      (filters.amountMin !== undefined || filters.amountMax !== undefined
        ? 1
        : 0) +
      Object.values(filters.otherFilters).filter(Boolean).length
    );
  }, [filters]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex">
      <div className="ml-auto w-96 bg-background shadow-xl border-l">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Filters</h2>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Filter Status */}
          <div className="px-4 py-2 bg-muted/30 border-b">
            <div className="text-sm text-muted-foreground">
              {getSelectedCount()} filters selected
            </div>
            {filters.selectedCategories.length > 0 && (
              <div className="text-xs text-muted-foreground mt-1">
                Categories: {filters.selectedCategories.slice(0, 3).join(", ")}
                {filters.selectedCategories.length > 3 &&
                  ` +${filters.selectedCategories.length - 3} more`}
              </div>
            )}
            {filters.selectedMerchants.length > 0 && (
              <div className="text-xs text-muted-foreground mt-1">
                Merchants: {filters.selectedMerchants.slice(0, 3).join(", ")}
                {filters.selectedMerchants.length > 3 &&
                  ` +${filters.selectedMerchants.length - 3} more`}
              </div>
            )}
          </div>

          {/* Filter Sections */}
          <ScrollArea className="flex-1">
            {/* Categories */}
            <FilterSection
              title="Categories"
              icon={<Tag className="h-4 w-4 text-muted-foreground" />}
              isExpanded={expandedSections.categories}
              onToggle={() => toggleSection("categories")}
              count={filters.selectedCategories.length}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSelectAll("categories")}
                    className="text-xs"
                  >
                    {filters.selectedCategories.length ===
                    flattenTreeCategories(treeCategories).length
                      ? "Deselect All"
                      : "Select All"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const allParentIds = new Set<string>();
                      const findParents = (categories: TreeCategory[]) => {
                        categories.forEach((cat) => {
                          if (cat.children && cat.children.length > 0) {
                            allParentIds.add(cat.category_id);
                            findParents(cat.children);
                          }
                        });
                      };
                      findParents(treeCategories);

                      // Toggle between expand all and collapse all
                      const allExpanded = Array.from(allParentIds).every((id) =>
                        expandedCategories.has(id)
                      );
                      setExpandedCategories(
                        allExpanded ? new Set() : allParentIds
                      );
                    }}
                    className="text-xs"
                  >
                    {expandedCategories.size > 0
                      ? "Collapse All"
                      : "Expand All"}
                  </Button>
                </div>
                <div className="space-y-1 max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
                  {loadingTreeCategories ? (
                    <div className="text-sm text-muted-foreground p-2">
                      Loading categories...
                    </div>
                  ) : treeCategories.length === 0 ? (
                    <div className="text-sm text-muted-foreground p-2">
                      No categories found
                    </div>
                  ) : (
                    <div className="space-y-1 pb-2">
                      {renderCategoryTree(treeCategories)}
                    </div>
                  )}
                </div>
              </div>
            </FilterSection>

            {/* Merchants */}
            <FilterSection
              title="Merchants"
              icon={<Building2 className="h-4 w-4 text-muted-foreground" />}
              isExpanded={expandedSections.merchants}
              onToggle={() => toggleSection("merchants")}
              count={filters.selectedMerchants.length}
            >
              <div className="space-y-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSelectAll("merchants")}
                  className="text-xs"
                >
                  {filters.selectedMerchants.length === merchants.length
                    ? "Deselect All"
                    : "Select All"}
                </Button>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {merchantsLoading ? (
                    <div className="text-sm text-muted-foreground">
                      Loading merchants...
                    </div>
                  ) : merchants.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      No merchants found
                    </div>
                  ) : (
                    merchants.map((merchant) => (
                      <div
                        key={merchant.id}
                        className="flex items-center space-x-2"
                      >
                        <Checkbox
                          id={merchant.id}
                          checked={filters.selectedMerchants.includes(
                            merchant.name
                          )}
                          onCheckedChange={() =>
                            handleMerchantToggle(merchant.name)
                          }
                        />
                        <label
                          htmlFor={merchant.id}
                          className="flex items-center gap-2 text-sm cursor-pointer flex-1"
                        >
                          <div className="flex items-center gap-2 flex-1">
                            <MerchantLogo merchant={merchant} />
                            <span className="flex-1">{merchant.name}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            ({merchant.transaction_count})
                          </span>
                        </label>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </FilterSection>

            {/* Amount */}
            <FilterSection
              title="Amount"
              icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
              isExpanded={expandedSections.amount}
              onToggle={() => toggleSection("amount")}
              count={
                filters.amountMin !== undefined ||
                filters.amountMax !== undefined
                  ? 1
                  : 0
              }
            >
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">
                      Min Amount
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-3 text-sm text-muted-foreground">
                        $
                      </span>
                      <Input
                        type="number"
                        step="0.50"
                        min="0"
                        placeholder="0.00"
                        className="pl-7"
                        value={
                          filters.amountMin !== undefined
                            ? filters.amountMin.toFixed(2)
                            : ""
                        }
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === "") {
                            updateFilters({ amountMin: undefined });
                          } else {
                            const numValue = parseFloat(value);
                            if (!isNaN(numValue) && numValue >= 0) {
                              updateFilters({ amountMin: numValue });
                            }
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">
                      Max Amount
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-3 text-sm text-muted-foreground">
                        $
                      </span>
                      <Input
                        type="number"
                        step="0.50"
                        min="0"
                        placeholder="0.00"
                        className="pl-7"
                        value={
                          filters.amountMax !== undefined
                            ? filters.amountMax.toFixed(2)
                            : ""
                        }
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === "") {
                            updateFilters({ amountMax: undefined });
                          } else {
                            const numValue = parseFloat(value);
                            if (!isNaN(numValue) && numValue >= 0) {
                              updateFilters({ amountMax: numValue });
                            }
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Type</label>
                  <div className="grid grid-cols-3 gap-1">
                    {["all", "income", "expense"].map((type) => (
                      <Button
                        key={type}
                        variant={
                          filters.amountType === type ? "default" : "outline"
                        }
                        size="sm"
                        onClick={() =>
                          updateFilters({
                            amountType: type as "all" | "income" | "expense",
                          })
                        }
                        className="text-xs"
                      >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </FilterSection>

            {/* Other Filters */}
            <FilterSection
              title="Other"
              icon={<Filter className="h-4 w-4 text-muted-foreground" />}
              isExpanded={expandedSections.other}
              onToggle={() => toggleSection("other")}
              count={Object.values(filters.otherFilters).filter(Boolean).length}
            >
              <div className="space-y-2">
                {Object.entries({
                  needsReview: "Needs Review",
                  hasAttachments: "Has Attachments",
                  isRecurring: "Recurring",
                  hasNotes: "Has Notes",
                  uncategorized: "Uncategorized",
                }).map(([key, label]) => (
                  <div key={key} className="flex items-center space-x-2">
                    <Checkbox
                      id={key}
                      checked={
                        filters.otherFilters[
                          key as keyof typeof filters.otherFilters
                        ]
                      }
                      onCheckedChange={(checked) =>
                        updateFilters({
                          otherFilters: {
                            ...filters.otherFilters,
                            [key]: checked as boolean,
                          },
                        })
                      }
                    />
                    <label htmlFor={key} className="text-sm cursor-pointer">
                      {label}
                    </label>
                  </div>
                ))}
              </div>
            </FilterSection>
          </ScrollArea>

          {/* Footer Actions */}
          <div className="p-4 border-t bg-muted/30">
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClear} className="flex-1">
                Clear
              </Button>
              <Button onClick={onApply} className="flex-1">
                Apply
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
