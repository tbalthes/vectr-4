/**
 * MonarchStyle Rule Builder - Matches Monarch Money's interface
 */
import React, { useState, useEffect } from "react";
import { Plus, X, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MerchantPicker } from "@/components/private/merchants/MerchantPicker";
import CategorySingleSelectPopover from "@/components/private/categories/CategorySingleSelectPopover";

// (Removed unused local Merchant/MerchantCategory interfaces)

// Interfaces
interface MonarchRuleCondition {
  id: string;
  type:
    | "merchant"
    | "amount"
    | "category"
    | "description"
    | "accounts"
    | "date";
  operator: string;
  value: string;
  enabled: boolean;
}

interface MonarchRuleAction {
  id: string;
  type:
    | "rename_merchant"
    | "update_category"
    | "add_tags"
    | "hide_transaction"
    | "review_status"
    | "link_to_goal"
    | "split_transaction";
  value: string;
  enabled: boolean;
}

interface RuleData {
  user_id: string;
  name: string;
  enabled: boolean;
  priority: number;
  conditions: {
    operator: "AND" | "OR" | string;
    groups: Array<{
      operator: "AND" | "OR" | string;
      conditions: Array<{
        field: string;
        operator: string;
        value: string | number;
      }>;
    }>;
  };
  actions: {
    category_id?: string;
    rename_to?: string;
    add_tags?: string[];
    hide_transaction?: boolean;
    needs_review?: boolean;
  };
}

interface MonarchRuleBuilderProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rule?: Record<string, any> | null; // More flexible to handle existing rule types
  onSave: (rule: RuleData) => void;
  onCancel: () => void;
  userId: string;
}

export function MonarchStyleRuleBuilder({
  rule,
  onSave,
  onCancel,
  userId,
}: MonarchRuleBuilderProps) {
  // Basic rule info
  const [ruleName, setRuleName] = useState(rule?.name || "");
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);

  // Preview state
  const [previewCount, setPreviewCount] = useState<number>(0);
  const [runOnPast, setRunOnPast] = useState<boolean>(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Conditions
  const [conditions, setConditions] = useState<MonarchRuleCondition[]>(() => {
    if (rule?.conditions?.groups?.[0]?.conditions) {
      // Map database field names back to UI condition types
      const mapFieldToConditionType = (
        field: string
      ): MonarchRuleCondition["type"] => {
        switch (field) {
          case "merchant":
            return "merchant";
          case "description":
            return "description";
          case "amount":
            return "amount";
          case "category":
            return "category";
          case "accounts":
            return "accounts";
          case "date":
            return "date";
          default:
            return "description"; // fallback
        }
      };

      return rule.conditions.groups[0].conditions.map(
        (
          condition: {
            field: string;
            operator: string;
            value: string | number;
          },
          index: number
        ) => {
          const conditionValue = String(condition.value);

          return {
            id: index.toString(),
            type: mapFieldToConditionType(condition.field),
            operator: condition.operator,
            value: conditionValue, // Keep the original value, let the render function handle UUIDs
            enabled: true,
          };
        }
      );
    }
    return [
      {
        id: "1",
        type: "description",
        operator: "contains",
        value: "",
        enabled: true,
      },
    ];
  });

  // Group operator (AND/OR) between condition boxes
  const [groupOperator, setGroupOperator] = useState<"AND" | "OR">(
    rule?.conditions?.groups?.[0]?.operator === "OR" ? "OR" : "AND"
  );

  // Actions
  const [actions, setActions] = useState<MonarchRuleAction[]>(() => {
    const actionsList: MonarchRuleAction[] = [];

    if (rule?.actions?.category_id) {
      actionsList.push({
        id: "1",
        type: "update_category",
        value: rule.actions.category_id,
        enabled: true,
      });
    }

    if (rule?.actions?.rename_to) {
      actionsList.push({
        id: "2",
        type: "rename_merchant",
        value: rule.actions.rename_to,
        enabled: true,
      });
    }

    if (rule?.actions?.add_tags?.length) {
      actionsList.push({
        id: "3",
        type: "add_tags",
        value: rule.actions.add_tags.join(", "),
        enabled: true,
      });
    }

    if (rule?.actions?.hide_transaction) {
      actionsList.push({
        id: "4",
        type: "hide_transaction",
        value: "true",
        enabled: true,
      });
    }

    if (rule?.actions?.needs_review) {
      actionsList.push({
        id: "5",
        type: "review_status",
        value: "true",
        enabled: true,
      });
    }

    if (actionsList.length === 0) {
      actionsList.push({
        id: "1",
        type: "update_category",
        value: "",
        enabled: true,
      });
    }

    return actionsList;
  });

  const addCondition = (type: MonarchRuleCondition["type"]) => {
    const newCondition: MonarchRuleCondition = {
      id: Date.now().toString(),
      type,
      operator: getDefaultOperator(type),
      value: "",
      enabled: true,
    };
    setConditions([...conditions, newCondition]);
  };

  const removeCondition = (id: string) => {
    setConditions(conditions.filter((c) => c.id !== id));
  };

  const updateCondition = (
    id: string,
    updates: Partial<MonarchRuleCondition>
  ) => {
    setConditions(
      conditions.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  };

  const addAction = (type: MonarchRuleAction["type"]) => {
    const newAction: MonarchRuleAction = {
      id: Date.now().toString(),
      type,
      value: "",
      enabled: true,
    };
    setActions([...actions, newAction]);
  };

  const removeAction = (id: string) => {
    setActions(actions.filter((a) => a.id !== id));
  };

  const updateAction = (id: string, updates: Partial<MonarchRuleAction>) => {
    setActions(actions.map((a) => (a.id === id ? { ...a, ...updates } : a)));
  };

  const getDefaultOperator = (type: MonarchRuleCondition["type"]): string => {
    switch (type) {
      case "merchant":
      case "description":
        return "contains";
      case "amount":
        return "equals";
      case "category":
        return "equals";
      case "accounts":
        return "equals";
      case "date":
        return "after";
      default:
        return "contains";
    }
  };

  const getOperatorOptions = (type: MonarchRuleCondition["type"]) => {
    switch (type) {
      case "merchant":
      case "description":
        return [
          { value: "contains", label: "contains" },
          { value: "equals", label: "is exactly" },
          { value: "starts_with", label: "starts with" },
          { value: "ends_with", label: "ends with" },
          { value: "not_contains", label: "does not contain" },
        ];
      case "amount":
        return [
          { value: "equals", label: "equals" },
          { value: "greater_than", label: "greater than" },
          { value: "less_than", label: "less than" },
          { value: "between", label: "between" },
        ];
      case "category":
      case "accounts":
        return [
          { value: "equals", label: "is" },
          { value: "contains", label: "contains" },
        ];
      case "date":
        return [
          { value: "after", label: "after" },
          { value: "before", label: "before" },
          { value: "on", label: "on" },
          { value: "between", label: "between" },
        ];
      default:
        return [];
    }
  };

  const renderConditionValue = (condition: MonarchRuleCondition) => {
    switch (condition.type) {
      case "merchant":
        // Check if the value looks like a UUID (merchant ID)
        const isUUID =
          condition.value &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            condition.value
          );

        return (
          <div className="md:col-span-2 min-w-[18rem] md:min-w-[24rem]">
            <MerchantPicker
              selectedMerchant={
                condition.value && !isUUID
                  ? {
                      id: condition.value,
                      name: condition.value,
                      logoUrl: null,
                      category: null,
                    }
                  : null
              }
              onMerchantSelect={(merchant) =>
                updateCondition(condition.id, { value: merchant?.name || "" })
              }
              placeholder={
                isUUID
                  ? "Merchant ID stored - please reselect"
                  : "Select merchant..."
              }
              className="w-full"
            />
          </div>
        );
      case "category":
        // Check if the value looks like a UUID (category ID)
        const isCategoryUUID =
          condition.value &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            condition.value
          );

        return (
          <div className="md:col-span-2 min-w-[18rem] md:min-w-[24rem]">
            <CategorySingleSelectPopover
              value={isCategoryUUID ? (condition.value as string) : null}
              userId={userId}
              onChange={(id, cat) => {
                const categoryName = cat?.name || id || "";
                updateCondition(condition.id, { value: categoryName });
              }}
              placeholder={
                condition.value && !isCategoryUUID
                  ? `Selected: ${condition.value}`
                  : "Select category..."
              }
              className="w-full"
            />
          </div>
        );
      case "amount":
        return (
          <Input
            type="number"
            step="0.01"
            value={condition.value}
            onChange={(e) =>
              updateCondition(condition.id, { value: e.target.value })
            }
            placeholder="0.00"
            className="w-full"
          />
        );
      case "description":
        return (
          <Input
            value={condition.value}
            onChange={(e) =>
              updateCondition(condition.id, { value: e.target.value })
            }
            placeholder="Enter text..."
            className="w-full"
          />
        );
      case "accounts":
        return (
          <Select
            value={condition.value}
            onValueChange={(value) => updateCondition(condition.id, { value })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select account..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="checking">Checking Account</SelectItem>
              <SelectItem value="savings">Savings Account</SelectItem>
              <SelectItem value="credit">Credit Card</SelectItem>
            </SelectContent>
          </Select>
        );
      case "date":
        return (
          <Input
            type="date"
            value={condition.value}
            onChange={(e) =>
              updateCondition(condition.id, { value: e.target.value })
            }
            className="w-full"
          />
        );
      default:
        return null;
    }
  };

  const renderActionValue = (action: MonarchRuleAction) => {
    switch (action.type) {
      case "rename_merchant":
        return (
          <Input
            value={action.value}
            onChange={(e) => updateAction(action.id, { value: e.target.value })}
            placeholder="New merchant name"
            className="w-full"
          />
        );
      case "update_category":
        return (
          <CategorySingleSelectPopover
            value={action.value || null}
            userId={userId}
            onChange={(id) => updateAction(action.id, { value: id || "" })}
            placeholder="Select category..."
            className="w-full"
          />
        );
      case "review_status":
        return (
          <Select
            value={action.value}
            onValueChange={(value) => updateAction(action.id, { value })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Review status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="reviewed">Mark as reviewed</SelectItem>
              <SelectItem value="needs_review">Mark as needs review</SelectItem>
            </SelectContent>
          </Select>
        );
      case "add_tags":
        return (
          <Input
            value={action.value}
            onChange={(e) => updateAction(action.id, { value: e.target.value })}
            placeholder="tag1, tag2, tag3"
            className="w-full"
          />
        );
      default:
        return null;
    }
  };

  const conditionTypes = [
    { value: "merchant", label: "Merchant" },
    { value: "amount", label: "Amount" },
    { value: "category", label: "Category" },
    { value: "description", label: "Description" },
    { value: "accounts", label: "Accounts" },
    { value: "date", label: "Date" },
  ];

  const actionTypes = [
    { value: "rename_merchant", label: "Rename merchant" },
    { value: "update_category", label: "Update category" },
    { value: "add_tags", label: "Add tags" },
    { value: "hide_transaction", label: "Hide transaction" },
    { value: "review_status", label: "Review status" },
    { value: "link_to_goal", label: "Link to goal" },
    { value: "split_transaction", label: "Split transaction" },
  ];

  const handlePreview = async () => {
    if (
      !ruleName.trim() ||
      conditions.filter((c) => c.enabled && c.value).length === 0
    ) {
      setPreviewCount(0);
      return;
    }

    setIsLoadingPreview(true);
    try {
      const mapConditionTypeToField = (type: string): string => {
        switch (type) {
          case "merchant":
            return "merchant";
          case "description":
            return "description";
          case "amount":
            return "amount";
          case "category":
            return "category";
          case "accounts":
            return "accounts";
          case "date":
            return "date";
          default:
            return "description";
        }
      };

      const previewData = {
        user_id: userId,
        conditions: {
          operator: "AND",
          groups: [
            {
              operator: groupOperator,
              conditions: conditions
                .filter((c) => c.enabled && c.value)
                .map((c) => ({
                  field: mapConditionTypeToField(c.type),
                  operator: c.operator,
                  value:
                    c.type === "amount"
                      ? ((): number | string => {
                          const num = parseFloat(String(c.value));
                          return isNaN(num) ? String(c.value) : num;
                        })()
                      : c.value,
                })),
            },
          ],
        },
        actions: {
          category_id: actions.find(
            (a) => a.type === "update_category" && a.enabled
          )?.value,
        },
        limit: 100,
      };

      const response = await fetch("/api/user-rules/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(previewData),
      });

      if (response.ok) {
        const data = await response.json();
        setPreviewCount(data.matching_transactions?.length || 0);
      } else {
        setPreviewCount(0);
      }
    } catch (error) {
      console.error("Preview error:", error);
      setPreviewCount(0);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Auto-preview when conditions change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      handlePreview();
    }, 500); // Debounce
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conditions, groupOperator, actions, userId]);
  // Save handler (async because of fetch)
  const handleSave = async () => {
    // Map UI condition types to actual database field names
    const mapConditionTypeToField = (type: string): string => {
      switch (type) {
        case "merchant":
          return "merchant"; // Backend supports "merchant" field
        case "description":
          return "description"; // Original transaction description
        case "amount":
          return "amount";
        case "category":
          return "category"; // Backend now supports "category" field
        case "accounts":
          return "accounts"; // Backend now supports "accounts" field
        case "date":
          return "date"; // Backend now supports "date" field
        default:
          return "description";
      }
    };

    // Get next available priority to avoid unique constraint violation
    let nextPriority = 100;
    try {
      const response = await fetch(`/api/user-rules?user_id=${userId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.rules && data.rules.length > 0) {
          const maxPriority = Math.max(
            ...data.rules.map((r: { priority?: number }) => r.priority || 0)
          );
          nextPriority = maxPriority + 10;
        }
      }
    } catch (error) {
      console.warn(
        "Could not fetch existing rules for priority calculation:",
        error
      );
      // Use random priority as fallback to avoid conflicts
      nextPriority = Math.floor(Math.random() * 1000000);
    }

    // Convert to the format expected by the backend
    const ruleData = {
      user_id: userId,
      name: ruleName,
      enabled,
      priority: nextPriority,
      conditions: {
        operator: "AND",
        groups: [
          {
            operator: groupOperator,
            conditions: conditions
              .filter((c) => c.enabled)
              .map((c) => ({
                field: mapConditionTypeToField(c.type),
                operator: c.operator,
                value:
                  c.type === "amount"
                    ? ((): number | string => {
                        const num = parseFloat(String(c.value));
                        return isNaN(num) ? String(c.value) : num;
                      })()
                    : c.value,
              })),
          },
        ],
      },
      actions: {
        category_id: actions.find(
          (a) => a.type === "update_category" && a.enabled
        )?.value,
        rename_to: actions.find(
          (a) => a.type === "rename_merchant" && a.enabled
        )?.value,
        add_tags: actions
          .find((a) => a.type === "add_tags" && a.enabled)
          ?.value?.split(",")
          .map((t: string) => t.trim()),
        hide_transaction: actions.some(
          (a) => a.type === "hide_transaction" && a.enabled
        ),
        // Review status mapping -> needs_review boolean
        ...(() => {
          const rv = actions.find(
            (a) => a.type === "review_status" && a.enabled
          )?.value;
          return rv ? { needs_review: rv === "needs_review" } : {};
        })(),
      },
      run_on_past: runOnPast,
    };

    onSave(ruleData);
  };

  return (
    <div className="p-6 space-y-6 max-w-none">
      {/* Rule Name and Settings */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="ruleName" className="text-sm font-medium">
            Rule Name
          </Label>
          <Input
            id="ruleName"
            value={ruleName}
            onChange={(e) => setRuleName(e.target.value)}
            placeholder="Enter rule name..."
            className="w-full mt-1"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Switch id="enabled" checked={enabled} onCheckedChange={setEnabled} />
          <Label htmlFor="enabled" className="text-sm font-medium">
            Rule enabled
          </Label>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Conditions */}
        <Card className="bg-card shadow-xl text-card-foreground">
          <CardHeader>
            <CardTitle className="text-lg">
              If transaction matches criteria...
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {conditions.map((condition, idx) => (
              <React.Fragment key={condition.id}>
                <div className="p-4 border rounded-lg space-y-3 bg-background/50 border-border dark:bg-neutral-900 dark:border-neutral-800">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="capitalize">
                      {condition.type}
                    </Badge>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={condition.enabled}
                        onCheckedChange={(enabled) =>
                          updateCondition(condition.id, { enabled })
                        }
                      />
                      {conditions.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCondition(condition.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <Select
                      value={condition.type}
                      onValueChange={(value: MonarchRuleCondition["type"]) =>
                        updateCondition(condition.id, {
                          type: value,
                          operator: getDefaultOperator(value),
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {conditionTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={condition.operator}
                      onValueChange={(value) =>
                        updateCondition(condition.id, { operator: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {getOperatorOptions(condition.type).map((op) => (
                          <SelectItem key={op.value} value={op.value}>
                            {op.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {renderConditionValue(condition)}
                  </div>
                </div>

                {/* AND/OR toggle between boxes (rendered between condition cards) */}
                {idx < conditions.length - 1 && (
                  <div className="flex items-center justify-center">
                    <div className="inline-flex">
                      <Button
                        type="button"
                        variant={groupOperator === "AND" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setGroupOperator("AND")}
                        className={`${
                          groupOperator === "AND"
                            ? "border shadow-sm -translate-y-px text-white"
                            : "text-muted-foreground"
                        } px-1`}
                      >
                        AND
                      </Button>
                      <Button
                        type="button"
                        variant={groupOperator === "OR" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setGroupOperator("OR")}
                        className={`${
                          groupOperator === "OR"
                            ? "border shadow-sm -translate-y-px text-white"
                            : "text-muted-foreground"
                        } ml-1 px-2`}
                      >
                        OR
                      </Button>
                    </div>
                  </div>
                )}
              </React.Fragment>
            ))}

            {/* Add Condition Buttons */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {conditionTypes.map((type) => (
                <Button
                  key={type.value}
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    addCondition(type.value as MonarchRuleCondition["type"])
                  }
                  className="text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {type.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Right Column - Actions */}
        <Card className="bg-card text-card-foreground shadow-xl">
          <CardHeader>
            <CardTitle className="text-lg">
              Then apply these updates...
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {actions.map((action) => (
              <div
                key={action.id}
                className="p-4 border rounded-lg space-y-3 bg-background/50 border-border dark:bg-neutral-900 dark:border-neutral-800"
              >
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="capitalize">
                    {action.type.replace("_", " ")}
                  </Badge>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={action.enabled}
                      onCheckedChange={(enabled) =>
                        updateAction(action.id, { enabled })
                      }
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAction(action.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Select
                    value={action.type}
                    onValueChange={(value: MonarchRuleAction["type"]) =>
                      updateAction(action.id, { type: value, value: "" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {actionTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {renderActionValue(action)}
                </div>
              </div>
            ))}

            {/* Add Action Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {actionTypes.map((type) => (
                <Button
                  key={type.value}
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    addAction(type.value as MonarchRuleAction["type"])
                  }
                  className="text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {type.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-center space-y-2 sm:space-y-0 sm:space-x-4 pt-4 border-t">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreview}
              disabled={isLoadingPreview}
            >
              <Eye className="h-4 w-4 mr-2" />
              Preview changes
            </Button>
            <span className="text-xs text-gray-500">
              {isLoadingPreview ? "..." : previewCount}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="runOnPast"
              checked={runOnPast}
              onCheckedChange={(v) => setRunOnPast(Boolean(v))}
            />
            <Label htmlFor="runOnPast" className="text-xs text-gray-200">
              Run rule on past transactions
            </Label>
          </div>
        </div>

        <div className="flex space-x-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!ruleName.trim()}>
            Save Rule
          </Button>
        </div>
      </div>
    </div>
  );
}
