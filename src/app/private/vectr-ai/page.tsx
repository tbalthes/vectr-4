"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Bot, Sparkles } from "lucide-react";
import { aiInsights, chatHistory, financialGoals } from "@/data/vectrai-data";
import InsightsCard from "@/components/private/vectr-ai/InsightsCard";
import ChatInterface from "@/components/private/vectr-ai/ChatInterface";
import GoalTrackingCard from "@/components/private/vectr-ai/GoalTrackingCard";
import PredictionsCard from "@/components/private/vectr-ai/PredictionsCard";
import TabSelector from "@/components/private/vectr-ai/TabSelector";

  export default function VectrAI() {
    const [tab, setTab] = useState("insights");
    const [chatMessage, setChatMessage] = useState("");
    const [isTyping, setIsTyping] = useState(false);

    const getImpactColor = (impact: string) => {
      switch (impact) {
        case "high":
          return "bg-red-100 text-red-800 border-red-200";
        case "medium":
          return "bg-yellow-100 text-yellow-800 border-yellow-200";
        case "low":
          return "bg-green-100 text-green-800 border-green-200";
        default:
          return "bg-gray-100 text-gray-800 border-gray-200";
      }
    };

    const getStatusColor = (status: string) => {
      switch (status) {
        case "completed":
          return "text-green-600 bg-green-50";
        case "on-track":
          return "text-blue-600 bg-blue-50";
        case "behind":
          return "text-red-600 bg-red-50";
        default:
          return "text-gray-600 bg-gray-50";
      }
    };

    const handleSendMessage = () => {
      if (!chatMessage.trim()) return;
      setChatMessage("");
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
      }, 2000);
    };

    return (
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-2xl font-semibold text-gray-900">Vectr AI</h1>
              <Badge className="bg-purple-100 text-purple-700">
                <Sparkles size={16} strokeWidth={0.75} absoluteStrokeWidth className="mr-1 h-3 w-3" />
                New
              </Badge>
            </div>
            <p className="text-gray-600">
              Your AI-powered financial assistant providing personalized insights and recommendations
            </p>
          </div>
        </div>

        <TabSelector value={tab} onValueChange={setTab} />

        {tab === "insights" && (
          <InsightsCard aiInsights={aiInsights} getImpactColor={getImpactColor} />
        )}
        {tab === "chat" && (
          <ChatInterface
            chatHistory={chatHistory}
            chatMessage={chatMessage}
            setChatMessage={setChatMessage}
            isTyping={isTyping}
            handleSendMessage={handleSendMessage}
          />
        )}
        {tab === "goals" && (
          <GoalTrackingCard financialGoals={financialGoals} getStatusColor={getStatusColor} />
        )}
        {tab === "predictions" && <PredictionsCard />}
      </div>
    );
  }
