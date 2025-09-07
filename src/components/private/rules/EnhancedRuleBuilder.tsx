/**
 * Enhanced Rule Builder - Supports complex AND/OR conditions like Monarch Money
 */
import React, { useState, useEffect } from "react";
import { Plus, X, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Type definitions
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
  id?: string;
  user_id: string;
  name: string;
  description?: string;
  enabled: boolean;
  priority: number;
  conditions: RuleConditions;
  actions: RuleActions;
}

interface EnhancedRuleBuilderProps {
  rule?: EnhancedUserRule;
  onSave: (rule: Omit<EnhancedUserRule, "id">) => void;
  onCancel: () => void;
  categories: Array<{ category_id: string; name: string; color?: string }>;
  userId: string;
}

// Field options for user-friendly display
const FIELD_OPTIONS = [
  { value: "description", label: "Description" },
  { value: "merchant", label: "Merchant Name" },
  { value: "amount", label: "Amount" },
];

// Operator options by field type
const TEXT_OPERATORS = [
  { value: "contains", label: "contains" },
  { value: "equals", label: "exactly matches" },
  { value: "starts_with", label: "starts with" },
  { value: "ends_with", label: "ends with" },
];

const AMOUNT_OPERATORS = [
  { value: "equals", label: "equals" },
  { value: "greater_than", label: "greater than" },
  { value: "less_than", label: "less than" },
];

export function EnhancedRuleBuilder({
  rule,
  onSave,
  onCancel,
  categories,
  userId,
}: EnhancedRuleBuilderProps) {
  // Form state
  const [name, setName] = useState(rule?.name || "");
  const [description, setDescription] = useState(rule?.description || "");
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);
  const [priority, setPriority] = useState(rule?.priority || 100);

  // Rule conditions state
  const [rootOperator, setRootOperator] = useState<"AND" | "OR">(
    rule?.conditions?.operator || "AND"
  );
  const [conditionGroups, setConditionGroups] = useState<RuleConditionGroup[]>(
    rule?.conditions?.groups || [
      {
        operator: "AND",
        conditions: [{ field: "description", operator: "contains", value: "" }],
      },
    ]
  );

  // Rule actions state
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    rule?.actions?.category_id || "no-change"
  );
  const [renameTo, setRenameTo] = useState(rule?.actions?.rename_to || "");
  const [addTags, setAddTags] = useState(
    rule?.actions?.add_tags?.join(", ") || ""
  );
  const [hideTransaction, setHideTransaction] = useState(
    rule?.actions?.hide_transaction || false
  );
  const [needsReview, setNeedsReview] = useState(rule?.actions?.needs_review);

  // Preview state
  const [ruleSummary, setRuleSummary] = useState("");

  // Generate rule summary
  const generateRuleSummary = React.useCallback((): string => {
    const formatCondition = (cond: RuleCondition): string => {
      const field =
        FIELD_OPTIONS.find((f) => f.value === cond.field)?.label || cond.field;
      const operator =
        cond.field === "amount"
          ? AMOUNT_OPERATORS.find((o) => o.value === cond.operator)?.label ||
            cond.operator
          : TEXT_OPERATORS.find((o) => o.value === cond.operator)?.label ||
            cond.operator;

      return `${field} ${operator} '${cond.value}'`;
    };

    const formatGroup = (group: RuleConditionGroup): string => {
      if (group.conditions.length === 1) {
        return formatCondition(group.conditions[0]);
      } else {
        const formatted = group.conditions.map(formatCondition);
        return `(${formatted.join(` ${group.operator} `)})`;
      }
    };

    // Format conditions
    let conditionsText: string;
    if (conditionGroups.length === 1) {
      conditionsText = formatGroup(conditionGroups[0]);
    } else {
      const formatted = conditionGroups.map(formatGroup);
      conditionsText = formatted.join(` ${rootOperator} `);
    }

    // Format actions
    const actionsParts: string[] = [];
    if (selectedCategoryId && selectedCategoryId !== "no-change") {
      const category = categories.find((c) => c.category_id === selectedCategoryId);
      actionsParts.push(`categorize as ${category?.name || "Unknown"}`);
    }
    if (renameTo) {
      actionsParts.push(`rename to '${renameTo}'`);
    }
    if (addTags) {
      actionsParts.push(`add tags: ${addTags}`);
    }
    if (hideTransaction) {
      actionsParts.push("hide transaction");
    }

    const actionsText =
      actionsParts.length > 0 ? actionsParts.join(", ") : "categorize";

    return `If ${conditionsText} then ${actionsText}`;
  }, [
    rootOperator,
    conditionGroups,
    selectedCategoryId,
    renameTo,
    addTags,
    hideTransaction,
    categories,
  ]);

  useEffect(() => {
    const summary = generateRuleSummary();
    setRuleSummary(summary);
  }, [generateRuleSummary]);

  // Add condition to a group
  const addCondition = (groupIndex: number) => {
    const newGroups = [...conditionGroups];
    newGroups[groupIndex].conditions.push({
      field: "description",
      operator: "contains",
      value: "",
    });
    setConditionGroups(newGroups);
  };

  // Remove condition from a group
  const removeCondition = (groupIndex: number, conditionIndex: number) => {
    const newGroups = [...conditionGroups];
    newGroups[groupIndex].conditions.splice(conditionIndex, 1);

    // Remove group if no conditions left
    if (newGroups[groupIndex].conditions.length === 0) {
      newGroups.splice(groupIndex, 1);
    }

    // Ensure at least one group exists
    if (newGroups.length === 0) {
      newGroups.push({
        operator: "AND",
        conditions: [{ field: "description", operator: "contains", value: "" }],
      });
    }

    setConditionGroups(newGroups);
  };

  // Update condition
  const updateCondition = (
    groupIndex: number,
    conditionIndex: number,
    field: keyof RuleCondition,
    value: string | number | boolean
  ) => {
    const newGroups = [...conditionGroups];
    newGroups[groupIndex].conditions[conditionIndex] = {
      ...newGroups[groupIndex].conditions[conditionIndex],
      [field]: value,
    };
    setConditionGroups(newGroups);
  };

  // Add condition group
  const addConditionGroup = () => {
    setConditionGroups([
      ...conditionGroups,
      {
        operator: "AND",
        conditions: [{ field: "description", operator: "contains", value: "" }],
      },
    ]);
  };

  // Remove condition group
  const removeConditionGroup = (groupIndex: number) => {
    const newGroups = [...conditionGroups];
    newGroups.splice(groupIndex, 1);

    // Ensure at least one group exists
    if (newGroups.length === 0) {
      newGroups.push({
        operator: "AND",
        conditions: [{ field: "description", operator: "contains", value: "" }],
      });
    }

    setConditionGroups(newGroups);
  };

  // Update group operator
  const updateGroupOperator = (groupIndex: number, operator: "AND" | "OR") => {
    const newGroups = [...conditionGroups];
    newGroups[groupIndex].operator = operator;
    setConditionGroups(newGroups);
  };

  // Handle save
  const handleSave = () => {
    if (!name.trim()) {
      alert("Please enter a rule name");
      return;
    }

    // Validate conditions
    const hasValidConditions = conditionGroups.some((group) =>
      group.conditions.some((cond) => cond.value.toString().trim() !== "")
    );

    if (!hasValidConditions) {
      alert("Please add at least one condition with a value");
      return;
    }

    const ruleData: Omit<EnhancedUserRule, "id"> = {
      user_id: userId,
      name: name.trim(),
      description: description.trim() || undefined,
      enabled,
      priority,
      conditions: {
        operator: rootOperator,
        groups: conditionGroups,
      },
      actions: {
        category_id:
          selectedCategoryId && selectedCategoryId !== "no-change"
            ? selectedCategoryId
            : undefined,
        rename_to: renameTo.trim() || undefined,
        add_tags: addTags.trim()
          ? addTags
              .split(",")
              .map((tag) => tag.trim())
              .filter((tag) => tag)
          : undefined,
        hide_transaction: hideTransaction,
        needs_review: needsReview,
      },
    };

    onSave(ruleData);
  };

  return (
    <div className="space-y-6">
      {/* Rule Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Rule Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-400">
            <p className="text-sm font-medium text-blue-900">{ruleSummary}</p>
          </div>
        </CardContent>
      </Card>

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Rule Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Rule Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Categorize Payroll Deposits"
                className="w-full"
              />
            </div>
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Input
                id="priority"
                type="number"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                placeholder="100"
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                Lower numbers = higher priority
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description of what this rule does"
              rows={2}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
            <Label htmlFor="enabled">Rule enabled</Label>
          </div>
        </CardContent>
      </Card>

      {/* Conditions */}
      <Card>
        <CardHeader>
          <CardTitle>Conditions</CardTitle>
          <p className="text-sm text-gray-600">
            Define when this rule should apply
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Root Operator */}
          {conditionGroups.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <Label className="text-sm font-medium">Match</Label>
              <Select
                value={rootOperator}
                onValueChange={(value: "AND" | "OR") => setRootOperator(value)}
              >
                <SelectTrigger className="w-20 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AND">ALL</SelectItem>
                  <SelectItem value="OR">ANY</SelectItem>
                </SelectContent>
              </Select>
              <Label className="text-sm">
                of the following condition groups:
              </Label>
            </div>
          )}

          {/* Condition Groups */}
          {conditionGroups.map((group, groupIndex) => (
            <div key={groupIndex} className="border rounded-lg p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-2 sm:space-y-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">Group {groupIndex + 1}</Badge>
                  {group.conditions.length > 1 && (
                    <>
                      <Label className="text-sm">Match</Label>
                      <Select
                        value={group.operator}
                        onValueChange={(value: "AND" | "OR") =>
                          updateGroupOperator(groupIndex, value)
                        }
                      >
                        <SelectTrigger className="w-20 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AND">ALL</SelectItem>
                          <SelectItem value="OR">ANY</SelectItem>
                        </SelectContent>
                      </Select>
                      <Label className="text-sm">conditions:</Label>
                    </>
                  )}
                </div>
                {conditionGroups.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeConditionGroup(groupIndex)}
                    className="text-red-600 hover:text-red-700 self-end sm:self-center"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Conditions within group */}
              {group.conditions.map((condition, conditionIndex) => (
                <div
                  key={conditionIndex}
                  className="space-y-3 p-4 border rounded-lg bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <GripVertical className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-700">
                        Condition {conditionIndex + 1}
                      </span>
                    </div>
                    {group.conditions.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          removeCondition(groupIndex, conditionIndex)
                        }
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <Label>Field</Label>
                      <Select
                        value={condition.field}
                        onValueChange={(value) =>
                          updateCondition(
                            groupIndex,
                            conditionIndex,
                            "field",
                            value
                          )
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FIELD_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Operator</Label>
                      <Select
                        value={condition.operator}
                        onValueChange={(value) =>
                          updateCondition(
                            groupIndex,
                            conditionIndex,
                            "operator",
                            value
                          )
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(condition.field === "amount"
                            ? AMOUNT_OPERATORS
                            : TEXT_OPERATORS
                          ).map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Value</Label>
                      <Input
                        type={condition.field === "amount" ? "number" : "text"}
                        value={condition.value}
                        onChange={(e) => {
                          const value =
                            condition.field === "amount"
                              ? Number(e.target.value)
                              : e.target.value;
                          updateCondition(
                            groupIndex,
                            conditionIndex,
                            "value",
                            value
                          );
                        }}
                        placeholder={
                          condition.field === "amount"
                            ? "0.00"
                            : "Enter text..."
                        }
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {/* Add condition to group */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => addCondition(groupIndex)}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Condition
              </Button>
            </div>
          ))}

          {/* Add condition group */}
          <Button
            variant="outline"
            onClick={addConditionGroup}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Condition Group
          </Button>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <p className="text-sm text-gray-600">
            What to do when conditions match
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="category">Category</Label>
              <Select
                value={selectedCategoryId}
                onValueChange={setSelectedCategoryId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no-change">No category change</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.category_id} value={category.category_id}>
                      <div className="flex items-center space-x-2">
                        {category.color && (
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: category.color }}
                          />
                        )}
                        <span>{category.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="renameTo">Rename Description</Label>
              <Input
                id="renameTo"
                value={renameTo}
                onChange={(e) => setRenameTo(e.target.value)}
                placeholder="New description (optional)"
                className="w-full"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="tags">Add Tags</Label>
            <Input
              id="tags"
              value={addTags}
              onChange={(e) => setAddTags(e.target.value)}
              placeholder="tag1, tag2, tag3 (optional)"
              className="w-full"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Switch
                id="hideTransaction"
                checked={hideTransaction}
                onCheckedChange={setHideTransaction}
              />
              <Label htmlFor="hideTransaction">
                Hide transaction from main view
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="needsReview"
                checked={needsReview ?? false}
                onCheckedChange={(checked) =>
                  setNeedsReview(checked ? true : undefined)
                }
              />
              <Label htmlFor="needsReview">
                Mark transaction as needing review
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-4 pt-4 border-t">
        <Button
          variant="outline"
          onClick={onCancel}
          className="w-full sm:w-auto"
        >
          Cancel
        </Button>
        <Button onClick={handleSave} className="w-full sm:w-auto">
          Save Rule
        </Button>
      </div>
    </div>
  );
}
