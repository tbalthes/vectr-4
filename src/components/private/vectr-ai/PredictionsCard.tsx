"use client";

import React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Calendar, Bot } from "lucide-react";

export default function PredictionsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Calendar className="mr-2 h-5 w-5" />
          Financial Predictions
        </CardTitle>
        <CardDescription>
          AI-powered forecasts based on your spending patterns and financial
          behavior
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Next Month Spending Forecast</h4>
              <div className="text-2xl font-bold text-blue-600 mb-1">
                $2,750
              </div>
              <p className="text-sm text-gray-600">
                5% decrease from this month
              </p>
              <div className="mt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Food & Dining</span>
                  <span className="text-red-600">↑ $720</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Transportation</span>
                  <span className="text-green-600">↓ $280</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Entertainment</span>
                  <span className="text-gray-600">→ $180</span>
                </div>
              </div>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Savings Goal Timeline</h4>
              <div className="text-2xl font-bold text-green-600 mb-1">
                6.2 months
              </div>
              <p className="text-sm text-gray-600">
                To reach $3,000 vacation fund
              </p>
              <div className="mt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Current Rate</span>
                  <span>$300/month</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Recommended Rate</span>
                  <span className="text-blue-600">$450/month</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Time Saved</span>
                  <span className="text-green-600">2.2 months</span>
                </div>
              </div>
            </div>
          </div>
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <Bot className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-800 mb-1">
                  AI Prediction Insight
                </h4>
                <p className="text-sm text-blue-700">
                  Based on your historical data, you typically spend 15% more
                  during summer months. Consider adjusting your budget for
                  June-August to account for vacation and activity expenses.
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
