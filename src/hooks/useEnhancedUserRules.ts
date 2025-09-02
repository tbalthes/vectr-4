/**
 * Enhanced User Rules Hook - Supports complex AND/OR conditions like Monarch Money
 */
import { useState, useEffect, useCallback } from "react";

// Type definitions (matching backend)
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

interface BulkUpdateItem {
  id: string;
  [key: string]: unknown;
}

interface BulkUpdateResult {
  id: string;
  success: boolean;
  error?: string;
}

interface ExportRulesResponse {
  rules: Omit<
    EnhancedUserRule,
    "id" | "user_id" | "created_at" | "updated_at"
  >[];
}

interface ImportRuleData {
  name: string;
  description?: string;
  enabled: boolean;
  priority: number;
  conditions: RuleConditions;
  actions: RuleActions;
}

interface ApiError {
  response?: {
    data?: {
      detail?: string;
    };
  };
  message?: string;
}

interface UseEnhancedUserRulesOptions {
  userId: string;
  autoFetch?: boolean;
}

interface UseEnhancedUserRulesReturn {
  rules: EnhancedUserRule[];
  loading: boolean;
  error: string | null;
  totalCount: number;

  // CRUD operations
  fetchRules: (options?: {
    search?: string;
    enabled?: boolean;
    page?: number;
    page_size?: number;
  }) => Promise<void>;
  createRule: (
    rule: Omit<EnhancedUserRule, "id" | "created_at" | "updated_at">
  ) => Promise<EnhancedUserRule>;
  updateRule: (
    ruleId: string,
    updates: Partial<
      Omit<EnhancedUserRule, "id" | "user_id" | "created_at" | "updated_at">
    >
  ) => Promise<EnhancedUserRule>;
  deleteRule: (ruleId: string) => Promise<void>;

  // Preview functionality
  previewRule: (
    conditions: RuleConditions,
    actions: RuleActions,
    limit?: number
  ) => Promise<RulePreviewResponse>;

  // Bulk operations
  reorderRules: (ruleIds: string[]) => Promise<void>;
  bulkUpdateRules: (updates: BulkUpdateItem[]) => Promise<void>;

  // Import/Export
  exportRules: () => Promise<ExportRulesResponse>;
  importRules: (rules: ImportRuleData[]) => Promise<{ imported_count: number }>;
}

const API_BASE =
  process.env.NODE_ENV === "production"
    ? "https://your-api-domain.com/api"
    : "/api/user-rules";

export function useEnhancedUserRules({
  userId,
  autoFetch = true,
}: UseEnhancedUserRulesOptions): UseEnhancedUserRulesReturn {
  const [rules, setRules] = useState<EnhancedUserRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  // Notification function (you can replace with your preferred notification system)
  const notify = useCallback(
    (message: string, type: "success" | "error" | "info" = "info") => {
      console.log(`[${type.toUpperCase()}] ${message}`);
      // You can integrate with toast notifications here
    },
    []
  );

  // Handle API errors
  const handleApiError = useCallback(
    (error: unknown, defaultMessage: string) => {
      let message = defaultMessage;

      if (error && typeof error === "object") {
        const apiError = error as ApiError;
        message =
          apiError.response?.data?.detail || apiError.message || defaultMessage;
      } else if (typeof error === "string") {
        message = error;
      }

      setError(message);
      notify(message, "error");
      throw new Error(message);
    },
    [notify]
  );

  // Fetch rules
  const fetchRules = useCallback(
    async (
      options: {
        search?: string;
        enabled?: boolean;
        page?: number;
        page_size?: number;
      } = {}
    ) => {
      if (!userId) return;

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          user_id: userId,
          page: (options.page || 1).toString(),
          page_size: (options.page_size || 50).toString(),
          order_by: "priority",
          order: "asc",
        });

        if (options.search) params.append("search", options.search);
        if (options.enabled !== undefined)
          params.append("enabled", options.enabled.toString());

        const response = await fetch(`${API_BASE}/user-rules-v2?${params}`, {
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        setRules(data.rules || []);
        setTotalCount(data.total || 0);
      } catch (error) {
        handleApiError(error, "Failed to fetch rules");
      } finally {
        setLoading(false);
      }
    },
    [userId, handleApiError]
  );

  // Create rule
  const createRule = useCallback(
    async (
      rule: Omit<EnhancedUserRule, "id" | "created_at" | "updated_at">
    ): Promise<EnhancedUserRule> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE}/user-rules-v2`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(rule),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const newRule = await response.json();
        setRules((prev) =>
          [...prev, newRule].sort((a, b) => a.priority - b.priority)
        );
        setTotalCount((prev) => prev + 1);

        notify(`Rule "${newRule.name}" created successfully`, "success");
        return newRule;
      } catch (error) {
        handleApiError(error, "Failed to create rule");
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [handleApiError, notify]
  );

  // Update rule
  const updateRule = useCallback(
    async (
      ruleId: string,
      updates: Partial<
        Omit<EnhancedUserRule, "id" | "user_id" | "created_at" | "updated_at">
      >
    ): Promise<EnhancedUserRule> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${API_BASE}/user-rules-v2/${ruleId}?user_id=${userId}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(updates),
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const updatedRule = await response.json();
        setRules((prev) =>
          prev
            .map((rule) => (rule.id === ruleId ? updatedRule : rule))
            .sort((a, b) => a.priority - b.priority)
        );

        notify(`Rule "${updatedRule.name}" updated successfully`, "success");
        return updatedRule;
      } catch (error) {
        handleApiError(error, "Failed to update rule");
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [userId, handleApiError, notify]
  );

  // Delete rule
  const deleteRule = useCallback(
    async (ruleId: string): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${API_BASE}/user-rules-v2/${ruleId}?user_id=${userId}`,
          {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        setRules((prev) => prev.filter((rule) => rule.id !== ruleId));
        setTotalCount((prev) => prev - 1);

        notify("Rule deleted successfully", "success");
      } catch (error) {
        handleApiError(error, "Failed to delete rule");
      } finally {
        setLoading(false);
      }
    },
    [userId, handleApiError, notify]
  );

  // Preview rule
  const previewRule = useCallback(
    async (
      conditions: RuleConditions,
      actions: RuleActions,
      limit: number = 10
    ): Promise<RulePreviewResponse> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE}/user-rules-v2/preview`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: userId,
            conditions,
            actions,
            limit,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const previewData = await response.json();
        return previewData;
      } catch (error) {
        handleApiError(error, "Failed to preview rule");
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [userId, handleApiError]
  );

  // Reorder rules
  const reorderRules = useCallback(
    async (ruleIds: string[]): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE}/user-rules-v2/reorder`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: userId,
            rule_ids: ruleIds,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Refresh rules to get updated priorities
        await fetchRules();
        notify("Rules reordered successfully", "success");
      } catch (error) {
        handleApiError(error, "Failed to reorder rules");
      } finally {
        setLoading(false);
      }
    },
    [userId, fetchRules, handleApiError, notify]
  );

  // Bulk update rules
  const bulkUpdateRules = useCallback(
    async (updates: BulkUpdateItem[]): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE}/user-rules-v2/bulk`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: userId,
            updates,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        const successCount = result.results.filter(
          (r: BulkUpdateResult) => r.success
        ).length;

        // Refresh rules to get updated data
        await fetchRules();
        notify(`${successCount} rules updated successfully`, "success");
      } catch (error) {
        handleApiError(error, "Failed to bulk update rules");
      } finally {
        setLoading(false);
      }
    },
    [userId, fetchRules, handleApiError, notify]
  );

  // Export rules
  const exportRules = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE}/user-rules-v2/export?user_id=${userId}`,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      notify(`${data.rules.length} rules exported`, "success");
      return data;
    } catch (error) {
      handleApiError(error, "Failed to export rules");
      throw error;
    } finally {
      setLoading(false);
    }
  }, [userId, handleApiError, notify]);

  // Import rules
  const importRules = useCallback(
    async (rules: ImportRuleData[]): Promise<{ imported_count: number }> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE}/user-rules-v2/import`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: userId,
            rules,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        // Refresh rules to show imported data
        await fetchRules();
        notify(result.message, "success");

        return {
          imported_count: parseInt(result.message.match(/\d+/)?.[0] || "0"),
        };
      } catch (error) {
        handleApiError(error, "Failed to import rules");
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [userId, fetchRules, handleApiError, notify]
  );

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (autoFetch && userId) {
      fetchRules();
    }
  }, [autoFetch, userId, fetchRules]);

  return {
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
  };
}
