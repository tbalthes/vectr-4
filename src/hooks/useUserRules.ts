"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type {
  UserRule,
  UserRuleUpdate,
  UserRulesListResponse,
} from "@/types/rules";

// Simple notification function
const notify = (
  title: string,
  message: string,
  type: "success" | "error" = "success"
) => {
  console.log(`[${type.toUpperCase()}] ${title}: ${message}`);
  // In the future, this can be replaced with a proper toast system
};

interface UseUserRulesOptions {
  enabled?: boolean;
  search?: string;
  enabledFilter?: boolean | null;
  page?: number;
  pageSize?: number;
  orderBy?: string;
  order?: "asc" | "desc";
}

interface UseUserRulesReturn {
  rules: UserRule[];
  total: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createRule: (
    rule: Omit<UserRule, "id" | "user_id" | "created_at" | "updated_at">
  ) => Promise<UserRule | null>;
  updateRule: (id: string, rule: UserRuleUpdate) => Promise<UserRule | null>;
  deleteRule: (id: string) => Promise<boolean>;
  bulkUpdateRules: (
    updates: Array<{ id: string; updates: UserRuleUpdate }>
  ) => Promise<boolean>;
  reorderRules: (ruleIds: string[]) => Promise<boolean>;
  duplicateRule: (id: string) => Promise<UserRule | null>;
  toggleRule: (id: string) => Promise<boolean>;
  exportRules: () => Promise<string | null>;
  importRules: (
    rules: Omit<UserRule, "id" | "user_id" | "created_at" | "updated_at">[]
  ) => Promise<boolean>;
}

export function useUserRules(
  options: UseUserRulesOptions = {}
): UseUserRulesReturn {
  const {
    enabled = true,
    search = "",
    enabledFilter = null,
    page = 1,
    pageSize = 50,
    orderBy = "priority",
    order = "asc",
  } = options;

  const [rules, setRules] = useState<UserRule[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build query parameters
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (enabledFilter !== null)
      params.append("enabled", enabledFilter.toString());
    params.append("page", page.toString());
    params.append("page_size", pageSize.toString());
    params.append("order_by", orderBy);
    params.append("order", order);
    return params.toString();
  }, [search, enabledFilter, page, pageSize, orderBy, order]);

  // Fetch rules
  const fetchRules = useCallback(async () => {
    if (!enabled) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/user-rules?${queryParams}`);
      if (!response.ok) {
        throw new Error("Failed to fetch rules");
      }

      const data: UserRulesListResponse = await response.json();
      setRules(data.rules);
      setTotal(data.total);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch rules";
      setError(errorMessage);
      notify("Error", errorMessage, "error");
    } finally {
      setIsLoading(false);
    }
  }, [enabled, queryParams]);

  // Auto-fetch on dependency changes
  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  // Create rule
  const createRule = useCallback(
    async (
      ruleData: Omit<UserRule, "id" | "user_id" | "created_at" | "updated_at">
    ): Promise<UserRule | null> => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch("/api/user-rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ruleData),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || "Failed to create rule");
        }

        const newRule: UserRule = await response.json();

        // Optimistic update
        setRules((prev) => [newRule, ...prev]);
        setTotal((prev) => prev + 1);

        notify("Success", "Rule created successfully");
        return newRule;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to create rule";
        setError(errorMessage);
        notify("Error", errorMessage, "error");
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Update rule
  const updateRule = useCallback(
    async (
      id: string,
      ruleUpdate: UserRuleUpdate
    ): Promise<UserRule | null> => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`/api/user-rules/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ruleUpdate),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || "Failed to update rule");
        }

        const updatedRule: UserRule = await response.json();

        // Optimistic update
        setRules((prev) =>
          prev.map((rule) => (rule.id === id ? updatedRule : rule))
        );

        notify("Success", "Rule updated successfully");
        return updatedRule;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to update rule";
        setError(errorMessage);
        notify("Error", errorMessage, "error");
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Delete rule
  const deleteRule = useCallback(async (id: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/user-rules/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to delete rule");
      }

      // Optimistic update
      setRules((prev) => prev.filter((rule) => rule.id !== id));
      setTotal((prev) => prev - 1);

      notify("Success", "Rule deleted successfully");
      return true;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to delete rule";
      setError(errorMessage);
      notify("Error", errorMessage, "error");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Bulk update rules
  const bulkUpdateRules = useCallback(
    async (
      updates: Array<{ id: string; updates: UserRuleUpdate }>
    ): Promise<boolean> => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch("/api/user-rules/bulk", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updates }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || "Failed to bulk update rules");
        }

        // Refetch to get the latest state
        await fetchRules();

        notify("Success", `${updates.length} rules updated successfully`);
        return true;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to bulk update rules";
        setError(errorMessage);
        notify("Error", errorMessage, "error");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchRules]
  );

  // Reorder rules
  const reorderRules = useCallback(
    async (ruleIds: string[]): Promise<boolean> => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch("/api/user-rules/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rule_ids: ruleIds }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || "Failed to reorder rules");
        }

        // Refetch to get the updated priorities
        await fetchRules();

        notify("Success", "Rules reordered successfully");
        return true;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to reorder rules";
        setError(errorMessage);
        notify("Error", errorMessage, "error");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchRules]
  );

  // Duplicate rule
  const duplicateRule = useCallback(
    async (id: string): Promise<UserRule | null> => {
      try {
        const ruleToClone = rules.find((rule) => rule.id === id);
        if (!ruleToClone) {
          throw new Error("Rule not found");
        }

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const {
          id: _,
          user_id,
          created_at,
          updated_at,
          ...ruleData
        } = ruleToClone;
        const duplicatedRule = {
          ...ruleData,
          description: `${ruleData.description || "Rule"} (Copy)`,
          enabled: false, // Disable duplicated rules by default
        };

        return await createRule(duplicatedRule);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to duplicate rule";
        notify("Error", errorMessage, "error");
        return null;
      }
    },
    [rules, createRule]
  );

  // Toggle rule enabled status
  const toggleRule = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const rule = rules.find((r) => r.id === id);
        if (!rule) {
          throw new Error("Rule not found");
        }

        const updated = await updateRule(id, { enabled: !rule.enabled });
        return updated !== null;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to toggle rule";
        notify("Error", errorMessage, "error");
        return false;
      }
    },
    [rules, updateRule]
  );

  // Export rules
  const exportRules = useCallback(async (): Promise<string | null> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/user-rules/export");
      if (!response.ok) {
        throw new Error("Failed to export rules");
      }

      const blob = await response.blob();
      const text = await blob.text();

      notify("Success", "Rules exported successfully");
      return text;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to export rules";
      setError(errorMessage);
      notify("Error", errorMessage, "error");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Import rules
  const importRules = useCallback(
    async (
      rulesToImport: Omit<
        UserRule,
        "id" | "user_id" | "created_at" | "updated_at"
      >[]
    ): Promise<boolean> => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch("/api/user-rules/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rules: rulesToImport }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || "Failed to import rules");
        }

        // Refetch to get all rules including imported ones
        await fetchRules();

        notify(
          "Success",
          `${rulesToImport.length} rules imported successfully`
        );
        return true;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to import rules";
        setError(errorMessage);
        notify("Error", errorMessage, "error");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchRules]
  );

  return {
    rules,
    total,
    isLoading,
    error,
    refetch: fetchRules,
    createRule,
    updateRule,
    deleteRule,
    bulkUpdateRules,
    reorderRules,
    duplicateRule,
    toggleRule,
    exportRules,
    importRules,
  };
}
