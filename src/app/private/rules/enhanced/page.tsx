"use client";

import React, { useState } from "react";
import {
  Plus,
  Settings,
  Upload,
  Download,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Copy,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";

import { MonarchStyleRuleBuilder } from "@/components/private/rules/MonarchStyleRuleBuilder";
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

interface EnhancedUserRule {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  enabled: boolean;
  priority: number;
  conditions: RuleConditions;
  actions: RuleActions;
  created_at?: string;
  updated_at?: string;
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
  const { categories, loading: categoriesLoading } = useCategories();
  const {
    rules,
    loading,
    error,
    totalCount,
    fetchRules,
    createRule,
    updateRule,
    deleteRule,
    previewRule,
    reorderRules,
    bulkUpdateRules,
    exportRules,
    importRules,
  } = useEnhancedUserRules({ 
    userId: user?.id || '',
    autoFetch: !!user?.id 
  });

  // UI State
  const [searchTerm, setSearchTerm] = useState("");
  const [showOnlyEnabled, setShowOnlyEnabled] = useState(false);
  const [selectedRule, setSelectedRule] = useState<EnhancedUserRule | null>(
    null
  );
  const [showRuleBuilder, setShowRuleBuilder] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<RulePreviewResponse | null>(
    null
  );

  // Filter rules based on search and enabled status
  const filteredRules = rules.filter((rule) => {
    const matchesSearch =
      rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rule.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesEnabled = !showOnlyEnabled || rule.enabled;
    return matchesSearch && matchesEnabled;
  });

  // Generate rule summary for display
  const generateRuleSummary = (rule: any): string => {
    const formatCondition = (cond: any): string => {
      const fieldNames: { [key: string]: string } = {
        description: "description",
        merchant: "merchant name",
        amount: "amount",
      };
      const field = fieldNames[cond.field] || cond.field;

      if (cond.operator === "equals") {
        return `${field} exactly matches '${cond.value}'`;
      } else if (cond.operator === "contains") {
        return `${field} contains '${cond.value}'`;
      } else if (cond.operator === "starts_with") {
        return `${field} starts with '${cond.value}'`;
      } else if (cond.operator === "ends_with") {
        return `${field} ends with '${cond.value}'`;
      } else if (cond.operator === "greater_than") {
        return `${field} greater than ${cond.value}`;
      } else if (cond.operator === "less_than") {
        return `${field} less than ${cond.value}`;
      } else {
        return `${field} ${cond.operator} '${cond.value}'`;
      }
    };

    const formatGroup = (group: any): string => {
      if (group.conditions.length === 1) {
        return formatCondition(group.conditions[0]);
      } else {
        const formatted = group.conditions.map(formatCondition);
        return `(${formatted.join(` ${group.operator} `)})`;
      }
    };

    // Format conditions
    let conditionsText: string;
    if (rule.conditions.groups.length === 1) {
      conditionsText = formatGroup(rule.conditions.groups[0]);
    } else {
      const formatted = rule.conditions.groups.map(formatGroup);
      conditionsText = formatted.join(` ${rule.conditions.operator} `);
    }

    // Format actions
    const actionsParts: string[] = [];
    if (rule.actions.category_id) {
      const category = categories.find(
        (c) => c.id === rule.actions.category_id
      );
      actionsParts.push(`categorize as ${category?.name || "Unknown"}`);
    }
    if (rule.actions.rename_to) {
      actionsParts.push(`rename to '${rule.actions.rename_to}'`);
    }
    if (rule.actions.add_tags?.length > 0) {
      actionsParts.push(`add tags: ${rule.actions.add_tags.join(", ")}`);
    }
    if (rule.actions.hide_transaction) {
      actionsParts.push("hide transaction");
    }

    const actionsText =
      actionsParts.length > 0 ? actionsParts.join(", ") : "categorize";

    return `If ${conditionsText} then ${actionsText}`;
  };

  // Handle rule operations
  const handleCreateRule = async (ruleData: any) => {
    try {
      await createRule(ruleData);
      setShowRuleBuilder(false);
    } catch (error) {
      console.error("Failed to create rule:", error);
    }
  };

  const handleUpdateRule = async (ruleData: any) => {
    if (!selectedRule) return;

    try {
      await updateRule(selectedRule.id, ruleData);
      setSelectedRule(null);
      setShowRuleBuilder(false);
    } catch (error) {
      console.error("Failed to update rule:", error);
    }
  };

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

  const handlePreviewRule = async (rule: any) => {
    try {
      const preview = await previewRule(rule.conditions, rule.actions, 10);
      setPreviewData(preview);
      setShowPreview(true);
    } catch (error) {
      console.error("Failed to preview rule:", error);
    }
  };

  const handleExportRules = async () => {
    try {
      const exportData = await exportRules();
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "user-rules-export.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export rules:", error);
    }
  };

  const handleImportRules = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importData = JSON.parse(text);
      await importRules(importData.rules || importData);
    } catch (error) {
      console.error("Failed to import rules:", error);
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
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
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Transaction Rules</h1>
              <p className="text-gray-600 mt-1">
                Automatically categorize and organize your transactions with
                powerful rules
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <Button variant="outline" onClick={handleExportRules}>
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
                  onChange={handleImportRules}
                />
              </label>
              <Button asChild>
                <Link href="/private/rules/create">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Rule
                </Link>
              </Button>
            </div>
          </div>

      {/* Stats Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-4 gap-4">
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
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {Math.round(
                  rules.reduce((sum, r) => sum + r.priority, 0) /
                    rules.length || 0
                )}
              </div>
              <div className="text-sm text-gray-600">Avg Priority</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search rules by name or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
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
          filteredRules.map((rule) => (
            <Card
              key={rule.id}
              className={`transition-all ${!rule.enabled ? "opacity-60" : ""}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex flex-col">
                      <CardTitle className="text-lg">{rule.name}</CardTitle>
                      {rule.description && (
                        <CardDescription className="mt-1">
                          {rule.description}
                        </CardDescription>
                      )}
                    </div>
                    <Badge variant={rule.enabled ? "default" : "secondary"}>
                      {rule.enabled ? "Active" : "Disabled"}
                    </Badge>
                    <Badge variant="outline">Priority {rule.priority}</Badge>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={(enabled) =>
                        handleToggleRule(rule.id, enabled)
                      }
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handlePreviewRule(rule)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Preview
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedRule(rule);
                            setShowRuleBuilder(true);
                          }}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            // Create a copy with incremented priority
                            const ruleCopy = {
                              ...rule,
                              name: `${rule.name} (Copy)`,
                              priority: rule.priority + 1,
                            };
                            delete ruleCopy.id;
                            createRule(ruleCopy);
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
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-900">
                    {generateRuleSummary(rule)}
                  </p>
                </div>
                {rule.actions.category_id && (
                  <div className="mt-3 flex items-center space-x-2">
                    <span className="text-xs text-gray-600">Category:</span>
                    <Badge variant="outline" className="text-xs">
                      <div
                        className="w-2 h-2 rounded-full mr-1"
                        style={{
                          backgroundColor: categories.find(
                            (c) => c.id === rule.actions.category_id
                          )?.color,
                        }}
                      />
                      {
                        categories.find(
                          (c) => c.id === rule.actions.category_id
                        )?.name
                      }
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Rule Builder Sheet */}
      <Sheet open={showRuleBuilder} onOpenChange={setShowRuleBuilder}>
        <SheetContent className="w-full sm:w-[95vw] sm:max-w-4xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {selectedRule ? "Edit Rule" : "Create New Rule"}
            </SheetTitle>
            <SheetDescription>
              {selectedRule
                ? "Modify the rule conditions and actions below"
                : "Create a new rule to automatically categorize your transactions"}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 pb-6">
            <MonarchStyleRuleBuilder
              rule={selectedRule || undefined}
              onSave={selectedRule ? handleUpdateRule : handleCreateRule}
              onCancel={() => {
                setShowRuleBuilder(false);
                setSelectedRule(null);
              }}
              categories={categories}
              userId={user?.id || ''}
            />
          </div>
        </SheetContent>
      </Sheet>

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
                  <div className="text-xs text-gray-600">Would Override</div>
                </div>
              </div>

              {previewData.matching_transactions.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Matching Transactions:</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {previewData.matching_transactions.map((tx: any) => (
                      <div
                        key={tx.transaction_id}
                        className="border rounded p-2 text-sm"
                      >
                        <div className="flex justify-between">
                          <span className="font-medium">{tx.description}</span>
                          <span>${tx.amount.toFixed(2)}</span>
                        </div>
                        <div className="text-gray-600 text-xs mt-1">
                          {tx.date} • {tx.merchant_name || "No merchant"}
                        </div>
                      </div>
                    ))}
                  </div>
                  {previewData.sample_limit_reached && (
                    <p className="text-xs text-gray-600 mt-2">
                      Showing first {previewData.matching_transactions.length}{" "}
                      matches...
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
    </div>
  );
}
