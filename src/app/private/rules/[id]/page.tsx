"use client";

import React, { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useEnhancedUserRules } from "@/hooks/useEnhancedUserRules";
import { useCategories } from "@/hooks/useCategories";
import { MonarchStyleRuleBuilder } from "@/components/private/rules/MonarchStyleRuleBuilder";

export default function EditRulePage() {
  const params = useParams();
  const ruleId = Array.isArray(params?.id)
    ? params?.id[0]
    : (params?.id as string);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { loading: categoriesLoading } = useCategories(user?.id);
  const { rules, updateRule } = useEnhancedUserRules({
    userId: user?.id || "",
    autoFetch: true,
  });

  const rule = useMemo(
    () => rules.find((r) => r.id === ruleId) || null,
    [rules, ruleId]
  );

  const handleCancel = () => router.push("/private/rules");

  const handleSave = async (updates: any) => {
    if (!ruleId) return;
    try {
      await updateRule(ruleId, updates);
      router.push("/private/rules");
    } catch (e) {
      console.error("Failed to update rule", e);
    }
  };

  if (authLoading || categoriesLoading) {
    return <div className="text-center py-8">Loading…</div>;
  }
  if (!user) {
    return <div className="text-center py-8">Please log in to edit rules.</div>;
  }
  if (!rule) {
    return <div className="text-center py-8">Rule not found.</div>;
  }

  return (
    <div className="max-w-6xl mx-auto">
      <MonarchStyleRuleBuilder
        rule={rule}
        onSave={handleSave}
        onCancel={handleCancel}
        userId={user.id}
      />
    </div>
  );
}
