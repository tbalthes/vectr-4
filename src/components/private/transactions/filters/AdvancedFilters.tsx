// src/components/private/transactions/filters/AdvancedFilters.tsx
"use client";

import React, { useState, useCallback } from "react";
import {
  Search,
  Filter,
  X,
  Calendar,
  DollarSign,
  Tag,
  Building2,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CategoryTreePicker } from "@/components/private/categories/CategoryTreePicker";
import { cn } from "@/lib/utils";

export interface DateRangeFilter {
  from?: Date;
  to?: Date;
  preset?:
    | "last7days"
    | "last30days"
    | "last90days"
    | "thisMonth"
    | "lastMonth"
    | "thisYear"
    | "custom";
}

export interface AmountRangeFilter {
  min?: number;
  max?: number;
  operator?: "equals" | "greater" | "less" | "between";
}

export interface AdvancedFiltersState {
  searchTerm: string;
  dateRange: DateRangeFilter;
  amountRange: AmountRangeFilter;
  categoryIds: string[];
  merchantIds: string[];
  status: string[];
  needsReview?: boolean;
  manualEdit?: boolean;
}

interface AdvancedFiltersProps {
  filters: AdvancedFiltersState;
  onFiltersChange: (filters: AdvancedFiltersState) => void;
  className?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const statusOptions = [
  { value: "completed", label: "Completed", color: "bg-green-500" },
  { value: "pending", label: "Pending", color: "bg-yellow-500" },
  { value: "needs_review", label: "Needs Review", color: "bg-red-500" },
  { value: "manual_edit", label: "Manual Edit", color: "bg-blue-500" },
];

const amountOperators = [
  { value: "equals", label: "Equals" },
  { value: "greater", label: "Greater than" },
  { value: "less", label: "Less than" },
  { value: "between", label: "Between" },
];

const datePresets = [
  { value: "last7days", label: "Last 7 Days" },
  { value: "last30days", label: "Last 30 Days" },
  { value: "last90days", label: "Last 90 Days" },
  { value: "thisMonth", label: "This Month" },
  { value: "lastMonth", label: "Last Month" },
  { value: "thisYear", label: "This Year" },
];

export function AdvancedFilters({
  filters,
  onFiltersChange,
  className,
  isCollapsed = false,
  onToggleCollapse,
}: AdvancedFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const updateFilters = useCallback(
    (updates: Partial<AdvancedFiltersState>) => {
      onFiltersChange({ ...filters, ...updates });
    },
    [filters, onFiltersChange]
  );

  const clearAllFilters = useCallback(() => {
    onFiltersChange({
      searchTerm: "",
      dateRange: {},
      amountRange: {},
      categoryIds: [],
      merchantIds: [],
      status: [],
    });
  }, [onFiltersChange]);

  const getActiveFilterCount = useCallback(() => {
    let count = 0;
    if (filters.searchTerm) count++;
    if (
      filters.dateRange.from ||
      filters.dateRange.to ||
      filters.dateRange.preset
    )
      count++;
    if (
      filters.amountRange.min !== undefined ||
      filters.amountRange.max !== undefined
    )
      count++;
    if (filters.categoryIds.length > 0) count++;
    if (filters.merchantIds.length > 0) count++;
    if (filters.status.length > 0) count++;
    if (filters.needsReview !== undefined) count++;
    if (filters.manualEdit !== undefined) count++;
    return count;
  }, [filters]);

  const activeFilterCount = getActiveFilterCount();

  if (isCollapsed) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Button
          variant="outline"
          size="sm"
          onClick={onToggleCollapse}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1">
              {activeFilterCount}
            </Badge>
          )}
          <ChevronDown className="h-4 w-4" />
        </Button>

        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="gap-2 text-muted-foreground"
          >
            <RotateCcw className="h-4 w-4" />
            Clear
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <span className="font-semibold">Filters</span>
            {activeFilterCount > 0 && (
              <Badge variant="secondary">{activeFilterCount} active</Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              disabled={activeFilterCount === 0}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Clear All
            </Button>

            {onToggleCollapse && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleCollapse}
                className="gap-2"
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Search Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Search className="h-4 w-4" />
            Search
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search descriptions, merchants, transaction numbers..."
              value={filters.searchTerm}
              onChange={(e) => updateFilters({ searchTerm: e.target.value })}
              className="pl-10"
            />
            {filters.searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1 h-8 w-8 p-0"
                onClick={() => updateFilters({ searchTerm: "" })}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Quick Status Filters */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Status</label>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((status) => {
              const isSelected = filters.status.includes(status.value);
              return (
                <Badge
                  key={status.value}
                  variant={isSelected ? "default" : "outline"}
                  className={cn("cursor-pointer", isSelected && status.color)}
                  onClick={() => {
                    const newStatus = isSelected
                      ? filters.status.filter((s) => s !== status.value)
                      : [...filters.status, status.value];
                    updateFilters({ status: newStatus });
                  }}
                >
                  {status.label}
                </Badge>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* Advanced Filters Toggle */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="gap-2 p-0 h-auto font-normal"
          >
            Advanced Filters
            {showAdvanced ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Advanced Filters */}
        {showAdvanced && (
          <div className="space-y-6 pt-4 border-t">
            {/* Date Range Filter */}
            <div className="space-y-3">
              <label className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Date Range
              </label>

              <div className="grid grid-cols-3 gap-2">
                {datePresets.map((preset) => (
                  <Button
                    key={preset.value}
                    variant={
                      filters.dateRange.preset === preset.value
                        ? "default"
                        : "outline"
                    }
                    size="sm"
                    onClick={() => {
                      const now = new Date();
                      let from: Date | undefined;
                      let to: Date = now;

                      switch (preset.value) {
                        case "last7days":
                          from = new Date(
                            now.getTime() - 7 * 24 * 60 * 60 * 1000
                          );
                          break;
                        case "last30days":
                          from = new Date(
                            now.getTime() - 30 * 24 * 60 * 60 * 1000
                          );
                          break;
                        case "last90days":
                          from = new Date(
                            now.getTime() - 90 * 24 * 60 * 60 * 1000
                          );
                          break;
                        case "thisMonth":
                          from = new Date(now.getFullYear(), now.getMonth(), 1);
                          break;
                        case "lastMonth":
                          from = new Date(
                            now.getFullYear(),
                            now.getMonth() - 1,
                            1
                          );
                          to = new Date(now.getFullYear(), now.getMonth(), 0);
                          break;
                        case "thisYear":
                          from = new Date(now.getFullYear(), 0, 1);
                          break;
                      }

                      updateFilters({
                        dateRange: {
                          from,
                          to,
                          preset: preset.value as DateRangeFilter["preset"],
                        },
                      });
                    }}
                    className="text-xs"
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>

              {/* Custom Date Range */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">From</label>
                  <Input
                    type="date"
                    value={
                      filters.dateRange.from?.toISOString().split("T")[0] || ""
                    }
                    onChange={(e) => {
                      const date = e.target.value
                        ? new Date(e.target.value)
                        : undefined;
                      updateFilters({
                        dateRange: {
                          ...filters.dateRange,
                          from: date,
                          preset: "custom",
                        },
                      });
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">To</label>
                  <Input
                    type="date"
                    value={
                      filters.dateRange.to?.toISOString().split("T")[0] || ""
                    }
                    onChange={(e) => {
                      const date = e.target.value
                        ? new Date(e.target.value)
                        : undefined;
                      updateFilters({
                        dateRange: {
                          ...filters.dateRange,
                          to: date,
                          preset: "custom",
                        },
                      });
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Amount Range Filter */}
            <div className="space-y-3">
              <label className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Amount
              </label>

              <div className="flex items-center gap-2">
                <select
                  value={filters.amountRange.operator || "between"}
                  onChange={(e) =>
                    updateFilters({
                      amountRange: {
                        ...filters.amountRange,
                        operator: e.target
                          .value as AmountRangeFilter["operator"],
                      },
                    })
                  }
                  className="px-3 py-2 border rounded-md text-sm"
                >
                  {amountOperators.map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>

                <Input
                  type="number"
                  placeholder="Min"
                  value={filters.amountRange.min || ""}
                  onChange={(e) =>
                    updateFilters({
                      amountRange: {
                        ...filters.amountRange,
                        min: e.target.value
                          ? parseFloat(e.target.value)
                          : undefined,
                      },
                    })
                  }
                  className="w-24"
                />

                {filters.amountRange.operator === "between" && (
                  <>
                    <span className="text-muted-foreground">to</span>
                    <Input
                      type="number"
                      placeholder="Max"
                      value={filters.amountRange.max || ""}
                      onChange={(e) =>
                        updateFilters({
                          amountRange: {
                            ...filters.amountRange,
                            max: e.target.value
                              ? parseFloat(e.target.value)
                              : undefined,
                          },
                        })
                      }
                      className="w-24"
                    />
                  </>
                )}
              </div>
            </div>

            {/* Category Filter */}
            <div className="space-y-3">
              <label className="text-sm font-medium flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Categories
              </label>

              <CategoryTreePicker
                selectedCategoryIds={filters.categoryIds}
                onCategoriesChange={(categoryIds) => {
                  updateFilters({
                    categoryIds,
                  });
                }}
                multiSelect={true}
                placeholder="Select categories..."
                className="w-full"
              />
            </div>

            {/* Merchant Filter */}
            <div className="space-y-3">
              <label className="text-sm font-medium flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Merchants
              </label>

              <div className="text-sm text-muted-foreground">
                Coming soon: Multi-select merchant filter
              </div>
            </div>
          </div>
        )}

        {/* Active Filter Chips */}
        {activeFilterCount > 0 && (
          <div className="space-y-2">
            <Separator />
            <div className="flex flex-wrap gap-2">
              {filters.searchTerm && (
                <Badge variant="secondary" className="gap-1">
                  Search: {filters.searchTerm}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => updateFilters({ searchTerm: "" })}
                  />
                </Badge>
              )}

              {(filters.dateRange.preset ||
                filters.dateRange.from ||
                filters.dateRange.to) && (
                <Badge variant="secondary" className="gap-1">
                  Date:{" "}
                  {filters.dateRange.preset &&
                  filters.dateRange.preset !== "custom"
                    ? datePresets.find(
                        (p) => p.value === filters.dateRange.preset
                      )?.label || ""
                    : filters.dateRange.from && filters.dateRange.to
                    ? `${filters.dateRange.from.toLocaleDateString()} - ${filters.dateRange.to.toLocaleDateString()}`
                    : filters.dateRange.from
                    ? `From ${filters.dateRange.from.toLocaleDateString()}`
                    : filters.dateRange.to
                    ? `Until ${filters.dateRange.to.toLocaleDateString()}`
                    : ""}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => updateFilters({ dateRange: {} })}
                  />
                </Badge>
              )}

              {filters.status.map((status) => (
                <Badge key={status} variant="secondary" className="gap-1">
                  {statusOptions.find((s) => s.value === status)?.label}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() =>
                      updateFilters({
                        status: filters.status.filter((s) => s !== status),
                      })
                    }
                  />
                </Badge>
              ))}

              {filters.categoryIds.length > 0 && (
                <Badge variant="secondary" className="gap-1">
                  Categories: {filters.categoryIds.length}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => updateFilters({ categoryIds: [] })}
                  />
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
