"use client";

import React, { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  Settings,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Copy,
  Eye,
  GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";

import { useEnhancedUserRules } from "@/hooks/useEnhancedUserRules";
import { useCategories } from "@/hooks/useCategories";
import { useAuth } from "@/hooks/useAuth";

// Type definitions for rule structure
interface RuleCondition {
  field: string;
  operator: string;
  value: string | number;
  case_sensitive?: boolean;
}

interface RuleConditionGroup {
  operator: "AND" | "OR";
  conditions: RuleCondition[];
}

interface RuleConditions {
  operator: "AND" | "OR";
  groups: RuleConditionGroup[];
}

interface RuleActions {
  category_id?: string;
  rename_to?: string;
  add_tags?: string[];
  hide_transaction?: boolean;
  needs_review?: boolean;
  confidence_override?: number;
}

// Minimal local copy for internal state (kept for reference)
interface EnhancedUserRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  priority: number;
  conditions: RuleConditions;
  actions: RuleActions;
}

interface TransactionMatch {
  transaction_id: string;
  date: string;
  description: string;
  clean_description?: string;
  merchant_name?: string;
  amount: number;
  current_category_name?: string;
  matched_category_name?: string;
  confidence: number;
  match_method: string;
}

interface RulePreviewResponse {
  rule_summary: string;
  total_transactions_checked: number;
  matching_transactions: TransactionMatch[];
  would_override_count: number;
  sample_limit_reached: boolean;
}

export default function EnhancedRulesPage() {
  const { user, loading: authLoading } = useAuth();
  const { categories } = useCategories(user?.id);
  const {
    rules,
    loading,
    error,
    totalCount,
    // fetchRules,
    createRule,
    updateRule,
    reorderRules,
    deleteRule,
    previewRule,
    // reorderRules,
    // bulkUpdateRules,
    // exportRules,
    // importRules,
  } = useEnhancedUserRules({
    userId: user?.id || "",
    autoFetch: !!user?.id,
  });

  // UI State
  const [searchTerm, setSearchTerm] = useState("");
  const [showOnlyEnabled, setShowOnlyEnabled] = useState(false);
  // Sheet-based builder removed; navigation used instead for create/edit
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<RulePreviewResponse | null>(
    null
  );

  // Drag and Drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      // Build new ordered list of rule ids by moving active id to the index of `over`
      const ids = filteredRules.map((r) => r.id);
      const fromIndex = ids.indexOf(String(active.id));
      const toIndex = ids.indexOf(String(over?.id));

      if (fromIndex === -1 || toIndex === -1) return;

      const newIds = [...ids];
      const [moved] = newIds.splice(fromIndex, 1);
      newIds.splice(toIndex, 0, moved);

      try {
        await reorderRules(newIds);
      } catch (error) {
        console.error("Failed to reorder rules via reorder endpoint:", error);
      }
    }
  };

  // Filter and sort rules based on search and enabled status
  const filteredRules = rules
    .filter((rule) => {
      const matchesSearch =
        rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rule.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesEnabled = !showOnlyEnabled || rule.enabled;
      return matchesSearch && matchesEnabled;
    })
    .sort((a, b) => a.priority - b.priority); // Sort by priority (lower number = higher priority)

  // Generate rule summary for display with styled boxes
  const generateRuleSummary = (rule: EnhancedUserRule): React.ReactNode => {
    // Helper component for styled boxes
    const Box = ({ children }: { children: React.ReactNode }) => (
      <span className="inline-flex items-center px-1 py-0.5 border border-white text-xs font-medium bg-transparent">
        {children}
      </span>
    );

    const formatCondition = (cond: RuleCondition): React.ReactNode => {
      const fieldNames: { [key: string]: string } = {
        description: "Description",
        merchant: "Merchant",
        amount: "Amount",
        category: "Category",
        accounts: "Account",
        date: "Date",
      };
      const field = fieldNames[cond.field] || cond.field;

      if (cond.operator === "equals") {
        return (
          <>
            <Box>{field}</Box> exactly matches <Box>{cond.value}</Box>
          </>
        );
      } else if (cond.operator === "contains") {
        return (
          <>
            <Box>{field}</Box> contains <Box>{cond.value}</Box>
          </>
        );
      } else if (cond.operator === "starts_with") {
        return (
          <>
            <Box>{field}</Box> starts with <Box>{cond.value}</Box>
          </>
        );
      } else if (cond.operator === "ends_with") {
        return (
          <>
            <Box>{field}</Box> ends with <Box>{cond.value}</Box>
          </>
        );
      } else if (cond.operator === "greater_than") {
        const value =
          cond.field === "amount"
            ? `$${parseFloat(String(cond.value)).toFixed(2)}`
            : cond.value;
        return (
          <>
            <Box>{field}</Box> is greater than <Box>{value}</Box>
          </>
        );
      } else if (cond.operator === "less_than") {
        const value =
          cond.field === "amount"
            ? `$${parseFloat(String(cond.value)).toFixed(2)}`
            : cond.value;
        return (
          <>
            <Box>{field}</Box> is less than <Box>{value}</Box>
          </>
        );
      } else {
        return (
          <>
            <Box>{field}</Box> {cond.operator} <Box>{cond.value}</Box>
          </>
        );
      }
    };

    const formatGroup = (group: RuleConditionGroup): React.ReactNode => {
      if (group.conditions.length === 1) {
        return formatCondition(group.conditions[0]);
      } else {
        const formatted = group.conditions.map((cond, index) => (
          <span key={index}>
            {formatCondition(cond)}
            {index < group.conditions.length - 1 && (
              <span className="mx-2 font-bold underline">{group.operator}</span>
            )}
          </span>
        ));
        return <>{formatted}</>;
      }
    };

    // Format conditions
    let conditionsText: React.ReactNode;
    if (rule.conditions.groups.length === 1) {
      conditionsText = formatGroup(rule.conditions.groups[0]);
    } else {
      const formatted = rule.conditions.groups.map((group, index) => (
        <span key={index}>
          {formatGroup(group)}
          {index < rule.conditions.groups.length - 1 && (
            <span className="mx-2 font-bold underline">
              {rule.conditions.operator}
            </span>
          )}
        </span>
      ));
      conditionsText = <>{formatted}</>;
    }

    // Format actions
    let actionText: React.ReactNode = <Box>categorize</Box>;
    if (rule.actions.category_id) {
      // Normalize comparison to string to avoid type mismatches (number vs string ids)
      const category = categories.find(
        (c) => String(c.id) === String(rule.actions.category_id)
      );
      // If name not available, show the id so user sees something useful instead of 'Unknown Category'
      actionText = (
        <Box>{category?.name ?? String(rule.actions.category_id)}</Box>
      );
    }

    return (
      <span className="flex flex-wrap items-center gap-1">
        <span className="font-medium">If</span>
        {conditionsText}
        <span className="font-medium">then categorize as</span>
        {actionText}
      </span>
    );
  };

  // Sortable Rule Card Component
  const SortableRuleCard = ({ rule }: { rule: EnhancedUserRule }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: rule.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`flex items-center gap-3 p-3 border rounded-lg bg-card transition-all ${
          !rule.enabled ? "opacity-60" : ""
        } ${isDragging ? "shadow-lg z-10" : ""} hover:bg-accent/50`}
      >
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-accent rounded flex-shrink-0"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* Rule Name */}
        <div className="flex-shrink-0">
          <span className="font-bold bg-primary text-primary-foreground rounded-full px-3 py-1 text-sm">
            {rule.name}
          </span>
        </div>

        {/* Rule Summary */}
        <div className="flex-1 min-w-0">
          <div className="bg-accent/30 rounded-lg p-2 text-sm">
            {generateRuleSummary(rule)}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-2 flex-shrink-0">
          <Switch
            checked={rule.enabled}
            onCheckedChange={(enabled) => handleToggleRule(rule.id, enabled)}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handlePreviewRule(rule)}>
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/private/rules/${rule.id}`}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleToggleRule(rule.id, !rule.enabled)}
              >
                <Settings className="h-4 w-4 mr-2" />
                {rule.enabled ? "Disable" : "Enable"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  // Create a copy with incremented priority
                  // eslint-disable-next-line @typescript-eslint/no-unused-vars
                  const { id: _id, ...rest } = rule;
                  const ruleCopy = {
                    ...rest,
                    name: `${rule.name} (Copy)`,
                    priority: rule.priority + 1,
                    user_id: user?.id || "",
                  };
                  createRule(
                    ruleCopy as Omit<EnhancedUserRule, "id"> & {
                      user_id: string;
                    }
                  );
                }}
              >
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleDeleteRule(rule.id)}
                className="text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  };

  // Handle rule operations
  // Create/Update handled on dedicated pages now

  const handleDeleteRule = async (ruleId: string) => {
    if (confirm("Are you sure you want to delete this rule?")) {
      try {
        await deleteRule(ruleId);
      } catch (error) {
        console.error("Failed to delete rule:", error);
      }
    }
  };

  const handleToggleRule = async (ruleId: string, enabled: boolean) => {
    try {
      await updateRule(ruleId, { enabled });
    } catch (error) {
      console.error("Failed to toggle rule:", error);
    }
  };

  const handlePreviewRule = async (rule: EnhancedUserRule) => {
    try {
      const preview = await previewRule(rule.conditions, rule.actions, 10);
      setPreviewData(preview);
      setShowPreview(true);
    } catch (error) {
      console.error("Failed to preview rule:", error);
    }
  };

  // Export/Import handled by layout actions

  return (
    <>
      {/* Auth Loading */}
      {authLoading && (
        <div className="text-center py-8">
          <div className="text-lg">Loading user session...</div>
        </div>
      )}

      {/* User Not Authenticated */}
      {!authLoading && !user && (
        <div className="text-center py-8">
          <Alert>
            <AlertDescription>
              Please log in to manage your transaction rules.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Main Content - Only show when user is authenticated */}
      {!authLoading && user && (
        <>
          {/* Stats Card */}
          <Card>
            <CardContent className="p-1">
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {totalCount}
                  </div>
                  <div className="text-sm text-gray-600">Total Rules</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {rules.filter((r) => r.enabled).length}
                  </div>
                  <div className="text-sm text-gray-600">Active Rules</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {rules.filter((r) => !r.enabled).length}
                  </div>
                  <div className="text-sm text-gray-600">Disabled Rules</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Filters */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search rules by name or description..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 border rounded-xl bg-primary-foreground"
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="show-only-enabled"
                    checked={showOnlyEnabled}
                    onCheckedChange={setShowOnlyEnabled}
                  />
                  <label htmlFor="show-only-enabled" className="text-sm">
                    Show only enabled
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Rules List */}
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                <p className="text-gray-600 mt-4">Loading rules...</p>
              </div>
            ) : filteredRules.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No rules found
                  </h3>
                  <p className="text-gray-600 mb-6">
                    {searchTerm || showOnlyEnabled
                      ? "No rules match your current filters"
                      : "Create your first rule to automatically categorize transactions"}
                  </p>
                  {!searchTerm && !showOnlyEnabled && (
                    <Button asChild>
                      <Link href="/private/rules/create">
                        <Plus className="h-4 w-4 mr-2" />
                        Create Your First Rule
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={filteredRules.map((rule) => rule.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {filteredRules.map((rule) => (
                    <SortableRuleCard key={rule.id} rule={rule} />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>

          {/* Sheet removed: create/edit handled on dedicated routes */}

          {/* Preview Dialog */}
          <Dialog open={showPreview} onOpenChange={setShowPreview}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Rule Preview</DialogTitle>
                <DialogDescription>
                  See what transactions would match this rule
                </DialogDescription>
              </DialogHeader>
              {previewData && (
                <div className="space-y-4">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-blue-900">
                      {previewData.rule_summary}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-lg font-bold">
                        {previewData.total_transactions_checked}
                      </div>
                      <div className="text-xs text-gray-600">
                        Transactions Checked
                      </div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-green-600">
                        {previewData.matching_transactions.length}
                      </div>
                      <div className="text-xs text-gray-600">Would Match</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-orange-600">
                        {previewData.would_override_count}
                      </div>
                      <div className="text-xs text-gray-600">
                        Would Override
                      </div>
                    </div>
                  </div>

                  {previewData.matching_transactions.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">
                        Matching Transactions:
                      </h4>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {previewData.matching_transactions.map(
                          (tx: TransactionMatch) => (
                            <div
                              key={tx.transaction_id}
                              className="border rounded p-2 text-sm"
                            >
                              <div className="flex justify-between">
                                <span className="font-medium">
                                  {tx.description}
                                </span>
                                <span>${tx.amount.toFixed(2)}</span>
                              </div>
                              <div className="text-gray-600 text-xs mt-1">
                                {tx.date} • {tx.merchant_name || "No merchant"}
                              </div>
                            </div>
                          )
                        )}
                      </div>
                      {previewData.sample_limit_reached && (
                        <p className="text-xs text-gray-600 mt-2">
                          Showing first{" "}
                          {previewData.matching_transactions.length} matches...
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </DialogContent>
          </Dialog>
        </>
      )}
    </>
  );
}
