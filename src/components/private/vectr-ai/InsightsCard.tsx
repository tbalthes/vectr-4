'use client';

import React from 'react';
import { Lightbulb } from 'lucide-react';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { AIInsight } from '@/types/vectrai';

interface InsightsCardProps {
  aiInsights: AIInsight[];
  getImpactColor: (impact: string) => string;
}

export default function InsightsCard({ aiInsights, getImpactColor }: InsightsCardProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {aiInsights.map((insight) => (
        <Card key={insight.id} className="relative">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-start">
              <div className="flex items-center space-x-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                <CardTitle className="text-lg">{insight.title}</CardTitle>
              </div>
              <Badge className={`text-xs ${getImpactColor(insight.impact)}`}>
                {insight.impact} impact
              </Badge>
            </div>
            <CardDescription className="text-sm mt-2">{insight.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Potential Savings</span>
                <span className="font-semibold text-green-600">${insight.savings}/month</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">AI Confidence</span>
                <div className="flex items-center space-x-2">
                  <Progress value={insight.confidence} className="w-16 h-2" />
                  <span className="text-sm font-medium">{insight.confidence}%</span>
                </div>
              </div>
              <div className="flex space-x-2 pt-2">
                <Button size="sm" className="flex-1">
                  Apply Suggestion
                </Button>
                <Button size="sm" variant="outline">
                  Tell Me More
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
