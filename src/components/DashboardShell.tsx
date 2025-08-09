"use client";

import React, { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Dashboard } from "./Dashboard";
import { Transactions } from "./Transactions";
import { Budgets } from "./Budgets";
import { Accounts } from "./Accounts";
import { VectrAI } from "./VectrAI";

export default function DashboardShell() {
  const [activeTab, setActiveTab] = useState("dashboard");

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <Dashboard />;
      case "transactions":
        return <Transactions />;
      case "budgets":
        return <Budgets />;
      case "accounts":
        return <Accounts />;
      case "vectr-ai":
        return <VectrAI />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-background-subtle">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="flex-1 overflow-auto">{renderContent()}</main>
    </div>
  );
}
