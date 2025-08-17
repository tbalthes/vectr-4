"use client";

import React from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TabSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
}

export default function TabSelector({
  value,
  onValueChange,
}: TabSelectorProps) {
  return (
    <Tabs value={value} onValueChange={onValueChange} className="space-y-6">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="insights">AI Insights</TabsTrigger>
        <TabsTrigger value="chat">AI Chat</TabsTrigger>
        <TabsTrigger value="goals">Goal Tracking</TabsTrigger>
        <TabsTrigger value="predictions">Predictions</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
