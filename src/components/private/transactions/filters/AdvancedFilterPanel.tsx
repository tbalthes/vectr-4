// src/components/private/transactions/filters/AdvancedFilterPanel.tsx
"use client";

import React, { useState, useCallback } from "react";
import Image from "next/image";
import {
  X,
  Filter,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Building2,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCategories } from "@/hooks/useCategories";
import { useMerchants } from "@/hooks/useMerchants";
import { LucideIcon } from "@/components/ui/LucideIcon";

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
  };
}

interface AdvancedFilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  filters: AdvancedFilterState;
  onFiltersChange: (filters: AdvancedFilterState) => void;
  onApply: () => void;
  onClear: () => void;
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
}: AdvancedFilterPanelProps) {
  // Fetch real data from APIs
  const { categories, loading: categoriesLoading } = useCategories();
  const { merchants, loading: merchantsLoading } = useMerchants();

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
          const allCategoryIds = categories.map((c) => c.name);
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
    [filters, updateFilters, categories, merchants]
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
                    {filters.selectedCategories.length === categories.length
                      ? "Deselect All"
                      : "Select All"}
                  </Button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {categoriesLoading ? (
                    <div className="text-sm text-muted-foreground">
                      Loading categories...
                    </div>
                  ) : categories.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      No categories found
                    </div>
                  ) : (
                    categories.map((category) => (
                      <div
                        key={category.id}
                        className="flex items-center space-x-2"
                      >
                        <Checkbox
                          id={category.id}
                          checked={filters.selectedCategories.includes(
                            category.name
                          )}
                          onCheckedChange={() =>
                            handleCategoryToggle(category.name)
                          }
                        />
                        <label
                          htmlFor={category.id}
                          className="flex items-center gap-2 text-sm cursor-pointer flex-1"
                        >
                          <LucideIcon
                            name={category.icon || ""}
                            className="h-4 w-4 text-[#6700EE]"
                          />
                          <span>{category.name}</span>
                        </label>
                      </div>
                    ))
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
                            {isValidImageUrl(merchant.logo_url) ? (
                              <Image
                                src={
                                  merchant.logo_url!.startsWith("http:")
                                    ? merchant.logo_url!.replace(
                                        "http:",
                                        "https:"
                                      )
                                    : merchant.logo_url!
                                }
                                alt={merchant.name}
                                width={20}
                                height={20}
                                className="rounded object-cover flex-shrink-0"
                                onError={(e) => {
                                  console.log(
                                    "Merchant logo load error:",
                                    merchant.logo_url
                                  );
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                            ) : (
                              <div className="w-5 h-5 rounded bg-muted flex items-center justify-center flex-shrink-0">
                                <Building2 className="h-3 w-3 text-muted-foreground" />
                              </div>
                            )}
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
