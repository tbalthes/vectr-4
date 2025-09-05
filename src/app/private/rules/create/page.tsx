"use client";

import React from "react";
// no header/action buttons here; layout provides header
import { MonarchStyleRuleBuilder } from "@/components/private/rules/MonarchStyleRuleBuilder";
import { useCategories } from "@/hooks/useCategories";
import { useRouter } from "next/navigation";
import { useEnhancedUserRules } from "@/hooks/useEnhancedUserRules";
import { useAuth } from "@/contexts/AuthContext";

export default function CreateRulePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { loading: categoriesLoading } = useCategories(user?.id);
  const { createRule } = useEnhancedUserRules({
    userId: user?.id || "",
    autoFetch: false,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSaveRule = async (ruleData: any) => {
    if (!user?.id) {
      console.error("No authenticated user");
      return;
    }

    try {
      await createRule({ ...ruleData, user_id: user.id });
      router.push("/private/rules");
    } catch (error) {
      console.error("Failed to create rule:", error);
    }
  };

  const handleCancel = () => {
    router.push("/private/rules");
  };

  if (authLoading) {
    return (
      <div className="text-center py-8">
        <div className="text-center">Loading user session...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-8">
        <div className="text-center text-red-600">
          Please log in to create rules
        </div>
      </div>
    );
  }

  if (categoriesLoading) {
    return (
      <div className="text-center py-8">
        <div className="text-center">Loading categories...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <MonarchStyleRuleBuilder
        rule={null}
        onSave={handleSaveRule}
        onCancel={handleCancel}
        userId={user.id}
      />
    </div>
  );
}
