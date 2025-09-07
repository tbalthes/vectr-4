import React, { useState, useCallback, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, Eye, Save, RotateCcw, X } from "lucide-react";
import CategorySingleSelectPopover from "@/components/private/categories/CategorySingleSelectPopover";
import { RulePreviewPanel } from "./RulePreviewPanel";
import {
  UserRule,
  UserRuleCreate,
  UserRuleUpdate,
  RulePreviewRequest,
  RulePreviewResponse,
  RuleFormErrors,
  MATCH_FIELDS,
  MATCH_OPERATORS,
  MatchField,
  MatchOperator,
} from "@/types/rules";

interface RuleBuilderProps {
  rule?: UserRule | null; // For editing existing rules
  userId: string;
  onSave?: (rule: UserRule) => void;
  onCancel?: () => void;
  className?: string;
}

interface RuleFormData {
  match_field: MatchField;
  match_operator: MatchOperator;
  match_value: string;
  category_id: string;
  priority: number;
  enabled: boolean;
  amount_min: string;
  amount_max: string;
  date_from: string;
  date_to: string;
  description: string;
}

const initialFormData: RuleFormData = {
  match_field: "description",
  match_operator: "contains",
  match_value: "",
  category_id: "",
  priority: 100,
  enabled: true,
  amount_min: "",
  amount_max: "",
  date_from: "",
  date_to: "",
  description: "",
};

export function RuleBuilder({
  rule,
  userId,
  onSave,
  onCancel,
  className,
}: RuleBuilderProps) {
  const [formData, setFormData] = useState<RuleFormData>(initialFormData);
  const [errors, setErrors] = useState<RuleFormErrors>({});
  const [preview, setPreview] = useState<RulePreviewResponse | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Load existing rule data
  useEffect(() => {
    if (rule) {
      setFormData({
        match_field: rule.match_field as MatchField,
        match_operator: rule.match_operator as MatchOperator,
        match_value: rule.match_value,
        category_id: rule.category_id,
        priority: rule.priority,
        enabled: rule.enabled,
        amount_min: rule.amount_min?.toString() || "",
        amount_max: rule.amount_max?.toString() || "",
        date_from: rule.date_from || "",
        date_to: rule.date_to || "",
        description: rule.description || "",
      });
    }
  }, [rule]);

  // Get available operators based on selected field
  const getAvailableOperators = useCallback((field: MatchField) => {
    if (field === "amount") {
      return MATCH_OPERATORS.numeric;
    }
    return MATCH_OPERATORS.text;
  }, []);

  // Update operator when field changes
  const handleFieldChange = useCallback(
    (field: MatchField) => {
      const operators = getAvailableOperators(field);
      const currentOperator = formData.match_operator;

      // Check if current operator is valid for the new field
      const isValidOperator = operators.some(
        (op) => op.value === currentOperator
      );

      setFormData((prev) => ({
        ...prev,
        match_field: field,
        match_operator: isValidOperator
          ? currentOperator
          : (operators[0].value as MatchOperator),
      }));
    },
    [formData.match_operator, getAvailableOperators]
  );

  // Validate form
  const validateForm = useCallback((): boolean => {
    const newErrors: RuleFormErrors = {};

    if (!formData.match_field) {
      newErrors.match_field = "Field is required";
    }

    if (!formData.match_operator) {
      newErrors.match_operator = "Operator is required";
    }

    if (!formData.match_value.trim()) {
      newErrors.match_value = "Value is required";
    }

    if (!formData.category_id) {
      newErrors.category_id = "Category is required";
    }

    if (formData.priority < 1 || formData.priority > 9999) {
      newErrors.priority = "Priority must be between 1 and 9999";
    }

    // Validate regex if using regex operator
    if (formData.match_operator === "regex" && formData.match_value) {
      try {
        new RegExp(formData.match_value);
      } catch {
        newErrors.match_value = "Invalid regex pattern";
      }
    }

    // Validate numeric values for amount field
    if (formData.match_field === "amount") {
      if (formData.match_operator !== "regex" && formData.match_value) {
        const numValue = parseFloat(formData.match_value);
        if (isNaN(numValue)) {
          newErrors.match_value = "Must be a valid number";
        }
      }
    }

    // Validate amount filters
    if (formData.amount_min) {
      const minValue = parseFloat(formData.amount_min);
      if (isNaN(minValue) || minValue < 0) {
        newErrors.amount_min = "Must be a positive number";
      }
    }

    if (formData.amount_max) {
      const maxValue = parseFloat(formData.amount_max);
      if (isNaN(maxValue) || maxValue < 0) {
        newErrors.amount_max = "Must be a positive number";
      }
    }

    if (formData.amount_min && formData.amount_max) {
      const minValue = parseFloat(formData.amount_min);
      const maxValue = parseFloat(formData.amount_max);
      if (!isNaN(minValue) && !isNaN(maxValue) && minValue >= maxValue) {
        newErrors.amount_max = "Maximum must be greater than minimum";
      }
    }

    // Validate dates
    if (formData.date_from && formData.date_to) {
      if (formData.date_from >= formData.date_to) {
        newErrors.date_to = "End date must be after start date";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  // Handle preview
  const handlePreview = useCallback(async () => {
    if (!validateForm()) {
      return;
    }

    setIsPreviewLoading(true);
    setPreviewError(null);
    setShowPreview(true);

    try {
      const previewRequest: RulePreviewRequest = {
        match_field: formData.match_field,
        match_operator: formData.match_operator,
        match_value: formData.match_value,
        category_id: formData.category_id,
        priority: formData.priority,
        amount_min: formData.amount_min
          ? parseFloat(formData.amount_min)
          : null,
        amount_max: formData.amount_max
          ? parseFloat(formData.amount_max)
          : null,
        date_from: formData.date_from || null,
        date_to: formData.date_to || null,
        description: formData.description || null,
      };

      const response = await fetch(
        `/api/user-rules/preview?user_id=${userId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(previewRequest),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to preview rule");
      }

      const previewData: RulePreviewResponse = await response.json();
      setPreview(previewData);
    } catch (error) {
      console.error("Preview error:", error);
      setPreviewError(
        error instanceof Error ? error.message : "Failed to preview rule"
      );
    } finally {
      setIsPreviewLoading(false);
    }
  }, [formData, userId, validateForm]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);

    try {
      const ruleData: UserRuleCreate | UserRuleUpdate = {
        match_field: formData.match_field,
        match_operator: formData.match_operator,
        match_value: formData.match_value,
        category_id: formData.category_id,
        priority: formData.priority,
        enabled: formData.enabled,
        amount_min: formData.amount_min
          ? parseFloat(formData.amount_min)
          : null,
        amount_max: formData.amount_max
          ? parseFloat(formData.amount_max)
          : null,
        date_from: formData.date_from || null,
        date_to: formData.date_to || null,
        description: formData.description || null,
      };

      const url = rule
        ? `/api/user-rules/${rule.id}?user_id=${userId}`
        : `/api/user-rules`;

      const requestData = rule ? ruleData : { ...ruleData, user_id: userId };

      const response = await fetch(url, {
        method: rule ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to save rule");
      }

      const savedRule: UserRule = await response.json();
      onSave?.(savedRule);
    } catch (error) {
      console.error("Save error:", error);
      // You might want to show a toast or error message here
    } finally {
      setIsSaving(false);
    }
  }, [formData, rule, userId, validateForm, onSave]);

  // Reset form
  const handleReset = useCallback(() => {
    if (rule) {
      setFormData({
        match_field: rule.match_field as MatchField,
        match_operator: rule.match_operator as MatchOperator,
        match_value: rule.match_value,
        category_id: rule.category_id,
        priority: rule.priority,
        enabled: rule.enabled,
        amount_min: rule.amount_min?.toString() || "",
        amount_max: rule.amount_max?.toString() || "",
        date_from: rule.date_from || "",
        date_to: rule.date_to || "",
        description: rule.description || "",
      });
    } else {
      setFormData(initialFormData);
    }
    setErrors({});
    setPreview(null);
    setPreviewError(null);
    setShowPreview(false);
  }, [rule]);

  const availableOperators = getAvailableOperators(formData.match_field);

  return (
    <div className={`space-y-6 ${className || ""}`}>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            {rule ? "Edit Rule" : "Create New Rule"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Main Rule Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Field Selection */}
            <div className="space-y-2">
              <Label htmlFor="match_field">Field to Match</Label>
              <Select
                value={formData.match_field}
                onValueChange={(value) =>
                  handleFieldChange(value as MatchField)
                }
              >
                <SelectTrigger
                  className={errors.match_field ? "border-red-300" : ""}
                >
                  <SelectValue placeholder="Select field" />
                </SelectTrigger>
                <SelectContent>
                  {MATCH_FIELDS.map((field) => (
                    <SelectItem key={field.value} value={field.value}>
                      {field.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.match_field && (
                <p className="text-sm text-red-600 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {errors.match_field}
                </p>
              )}
            </div>

            {/* Operator Selection */}
            <div className="space-y-2">
              <Label htmlFor="match_operator">Operator</Label>
              <Select
                value={formData.match_operator}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    match_operator: value as MatchOperator,
                  }))
                }
              >
                <SelectTrigger
                  className={errors.match_operator ? "border-red-300" : ""}
                >
                  <SelectValue placeholder="Select operator" />
                </SelectTrigger>
                <SelectContent>
                  {availableOperators.map((operator) => (
                    <SelectItem key={operator.value} value={operator.value}>
                      {operator.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.match_operator && (
                <p className="text-sm text-red-600 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {errors.match_operator}
                </p>
              )}
            </div>

            {/* Value Input */}
            <div className="space-y-2">
              <Label htmlFor="match_value">
                Value {formData.match_operator === "regex" && "(Regex Pattern)"}
              </Label>
              <Input
                id="match_value"
                type={formData.match_field === "amount" ? "number" : "text"}
                value={formData.match_value}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    match_value: e.target.value,
                  }))
                }
                placeholder={
                  formData.match_operator === "regex"
                    ? "Enter regex pattern"
                    : formData.match_field === "amount"
                    ? "Enter amount"
                    : "Enter text to match"
                }
                className={errors.match_value ? "border-red-300" : ""}
              />
              {errors.match_value && (
                <p className="text-sm text-red-600 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {errors.match_value}
                </p>
              )}
              {formData.match_operator === "regex" && (
                <p className="text-xs text-gray-500">
                  Use JavaScript regex syntax. Example: ^AMAZON.*$ for
                  transactions starting with AMAZON
                </p>
              )}
            </div>
          </div>

          {/* Category Assignment */}
          <div className="space-y-2">
            <Label>Category Assignment</Label>
            <CategorySingleSelectPopover
              value={formData.category_id || null}
              userId={userId}
              onChange={(id: string | null) =>
                setFormData((prev) => ({ ...prev, category_id: id || "" }))
              }
              placeholder="Select a category for matching transactions"
              className={errors.category_id ? "border-red-300" : ""}
            />
            {errors.category_id && (
              <p className="text-sm text-red-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors.category_id}
              </p>
            )}
          </div>

          {/* Advanced Filters */}
          <div className="space-y-4">
            <Label className="text-base font-medium">Optional Filters</Label>

            {/* Amount Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount_min">Minimum Amount ($)</Label>
                <Input
                  id="amount_min"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount_min}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      amount_min: e.target.value,
                    }))
                  }
                  placeholder="No minimum"
                  className={errors.amount_min ? "border-red-300" : ""}
                />
                {errors.amount_min && (
                  <p className="text-sm text-red-600 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {errors.amount_min}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount_max">Maximum Amount ($)</Label>
                <Input
                  id="amount_max"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount_max}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      amount_max: e.target.value,
                    }))
                  }
                  placeholder="No maximum"
                  className={errors.amount_max ? "border-red-300" : ""}
                />
                {errors.amount_max && (
                  <p className="text-sm text-red-600 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {errors.amount_max}
                  </p>
                )}
              </div>
            </div>

            {/* Date Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date_from">Start Date</Label>
                <Input
                  id="date_from"
                  type="date"
                  value={formData.date_from}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      date_from: e.target.value,
                    }))
                  }
                  className={errors.date_from ? "border-red-300" : ""}
                />
                {errors.date_from && (
                  <p className="text-sm text-red-600 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {errors.date_from}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="date_to">End Date</Label>
                <Input
                  id="date_to"
                  type="date"
                  value={formData.date_to}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      date_to: e.target.value,
                    }))
                  }
                  className={errors.date_to ? "border-red-300" : ""}
                />
                {errors.date_to && (
                  <p className="text-sm text-red-600 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {errors.date_to}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Rule Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Input
                id="priority"
                type="number"
                min="1"
                max="9999"
                value={formData.priority}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    priority: parseInt(e.target.value) || 100,
                  }))
                }
                className={errors.priority ? "border-red-300" : ""}
              />
              {errors.priority && (
                <p className="text-sm text-red-600 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {errors.priority}
                </p>
              )}
              <p className="text-xs text-gray-500">
                Lower numbers = higher priority
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, enabled: checked }))
                }
              />
              <Label htmlFor="enabled">Enabled</Label>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder="Describe what this rule does..."
              className={errors.description ? "border-red-300" : ""}
              rows={2}
            />
            {errors.description && (
              <p className="text-sm text-red-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors.description}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 pt-4 border-t">
            <Button
              onClick={handlePreview}
              disabled={isPreviewLoading}
              variant="outline"
              className="flex items-center space-x-2"
            >
              <Eye className="h-4 w-4" />
              <span>{isPreviewLoading ? "Testing..." : "Preview Rule"}</span>
            </Button>

            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center space-x-2"
            >
              <Save className="h-4 w-4" />
              <span>{isSaving ? "Saving..." : "Save Rule"}</span>
            </Button>

            <Button
              onClick={handleReset}
              variant="outline"
              className="flex items-center space-x-2"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Reset</span>
            </Button>

            {onCancel && (
              <Button
                onClick={onCancel}
                variant="ghost"
                className="flex items-center space-x-2"
              >
                <X className="h-4 w-4" />
                <span>Cancel</span>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preview Panel */}
      {showPreview && (
        <RulePreviewPanel
          preview={preview}
          loading={isPreviewLoading}
          error={previewError}
        />
      )}
    </div>
  );
}
