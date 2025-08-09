import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Progress } from "./ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import {
  Bot,
  Lightbulb,
  TrendingUp,
  Target,
  AlertTriangle,
  MessageSquare,
  Send,
  Sparkles,
  PieChart,
  Calendar,
} from "lucide-react";

const aiInsights = [
  {
    id: 1,
    type: "spending-optimization",
    title: "Optimize Food Spending",
    description:
      "You spent 23% more on dining out this month. Cooking at home 2 more times per week could save you $180/month.",
    impact: "high",
    savings: 180,
    confidence: 92,
    category: "Food & Dining",
  },
  {
    id: 2,
    type: "investment-opportunity",
    title: "Emergency Fund Complete",
    description:
      "Your emergency fund is fully funded! Consider investing the additional $500/month in a diversified portfolio.",
    impact: "medium",
    savings: 500,
    confidence: 88,
    category: "Investment",
  },
  {
    id: 3,
    type: "bill-optimization",
    title: "Subscription Analysis",
    description:
      "You have 3 streaming services costing $45/month. Consolidating to 2 services could save you $180/year.",
    impact: "low",
    savings: 15,
    confidence: 95,
    category: "Entertainment",
  },
];

const chatHistory = [
  {
    id: 1,
    type: "ai",
    message:
      "Hi! I'm Vectr AI. I can help you optimize your finances and answer questions about your spending patterns. What would you like to know?",
    timestamp: "10:00 AM",
  },
  {
    id: 2,
    type: "user",
    message: "Why did my food budget go over this month?",
    timestamp: "10:02 AM",
  },
  {
    id: 3,
    type: "ai",
    message:
      "I analyzed your transactions and found you spent $320 more on dining out compared to last month. The main contributors were:\n\n• 8 additional restaurant visits (+$240)\n• Higher average meal cost (+$80)\n\nWould you like me to suggest some budget-friendly alternatives?",
    timestamp: "10:02 AM",
  },
];

const financialGoals = [
  {
    id: 1,
    title: "Emergency Fund",
    target: 10000,
    current: 10000,
    deadline: "2024-03-01",
    status: "completed",
  },
  {
    id: 2,
    title: "Vacation Fund",
    target: 3000,
    current: 1200,
    deadline: "2024-08-01",
    status: "on-track",
  },
  {
    id: 3,
    title: "New Car Down Payment",
    target: 8000,
    current: 2400,
    deadline: "2024-12-01",
    status: "behind",
  },
];

export function VectrAI() {
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

    // Add user message logic here
    setChatMessage("");
    setIsTyping(true);

    // Simulate AI response
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
            Your AI-powered financial assistant providing personalized insights
            and recommendations
          </p>
        </div>
      </div>

      <Tabs defaultValue="insights" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
          <TabsTrigger value="chat">AI Chat</TabsTrigger>
          <TabsTrigger value="goals">Goal Tracking</TabsTrigger>
          <TabsTrigger value="predictions">Predictions</TabsTrigger>
        </TabsList>

        <TabsContent value="insights" className="space-y-6">
          {/* AI Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {aiInsights.map((insight) => (
              <Card key={insight.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center space-x-2">
                      <Lightbulb className="h-5 w-5 text-yellow-500" />
                      <CardTitle className="text-lg">{insight.title}</CardTitle>
                    </div>
                    <Badge
                      className={`text-xs ${getImpactColor(insight.impact)}`}
                    >
                      {insight.impact} impact
                    </Badge>
                  </div>
                  <CardDescription className="text-sm mt-2">
                    {insight.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">
                        Potential Savings
                      </span>
                      <span className="font-semibold text-green-600">
                        ${insight.savings}/month
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">
                        AI Confidence
                      </span>
                      <div className="flex items-center space-x-2">
                        <Progress
                          value={insight.confidence}
                          className="w-16 h-2"
                        />
                        <span className="text-sm font-medium">
                          {insight.confidence}%
                        </span>
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

          {/* Monthly Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <PieChart className="mr-2 h-5 w-5" />
                AI Monthly Summary
              </CardTitle>
              <CardDescription>
                Vectr AI analyzed your financial data and identified key
                patterns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium">Improved Areas</span>
                  </div>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Reduced utility spending by 15%</li>
                    <li>• Increased savings rate to 22%</li>
                    <li>• Paid credit card on time</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm font-medium">Watch Areas</span>
                  </div>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Food spending increased 23%</li>
                    <li>• Transportation over budget</li>
                    <li>• 3 unused subscriptions active</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Target className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium">Opportunities</span>
                  </div>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Invest extra emergency fund</li>
                    <li>• Refinance car loan at lower rate</li>
                    <li>• Open high-yield savings account</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chat" className="space-y-6">
          <Card className="h-96 flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center">
                <MessageSquare className="mr-2 h-5 w-5" />
                Chat with Vectr AI
              </CardTitle>
              <CardDescription>
                Ask questions about your finances, get personalized advice, or
                request analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <div className="flex-1 space-y-4 overflow-y-auto mb-4">
                {chatHistory.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.type === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        message.type === "user"
                          ? "bg-purple-600 text-white"
                          : "bg-gray-100 text-gray-900"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">
                        {message.message}
                      </p>
                      <p
                        className={`text-xs mt-1 ${
                          message.type === "user"
                            ? "text-purple-200"
                            : "text-gray-500"
                        }`}
                      >
                        {message.timestamp}
                      </p>
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 text-gray-900 px-4 py-2 rounded-lg">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div
                          className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                          style={{ animationDelay: "0.1s" }}
                        ></div>
                        <div
                          className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                          style={{ animationDelay: "0.2s" }}
                        ></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex space-x-2">
                <Input
                  placeholder="Ask Vectr AI anything about your finances..."
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                />
                <Button onClick={handleSendMessage}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick Questions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Questions</CardTitle>
              <CardDescription>
                Common questions you can ask Vectr AI
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  "How can I reduce my monthly expenses?",
                  "What's the best way to increase my savings?",
                  "Should I pay off debt or invest?",
                  "How am I tracking against my budget?",
                  "What are my biggest spending categories?",
                  "When will I reach my savings goal?",
                ].map((question, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className="text-left justify-start h-auto p-3 text-sm"
                    onClick={() => setChatMessage(question)}
                  >
                    {question}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="goals" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {financialGoals.map((goal) => {
              const progress = (goal.current / goal.target) * 100;
              const remaining = goal.target - goal.current;

              return (
                <Card key={goal.id}>
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{goal.title}</CardTitle>
                      <Badge
                        className={`text-xs ${getStatusColor(goal.status)}`}
                      >
                        {goal.status.replace("-", " ")}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-600">Progress</span>
                          <span className="font-medium">
                            ${goal.current} / ${goal.target}
                          </span>
                        </div>
                        <Progress
                          value={Math.min(progress, 100)}
                          className="h-2"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          {progress.toFixed(1)}% complete
                        </p>
                      </div>

                      <div className="flex justify-between items-center pt-2 border-t">
                        <div>
                          <p className="text-xs text-gray-500">Remaining</p>
                          <p className="font-medium">${remaining}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Deadline</p>
                          <p className="font-medium text-sm">{goal.deadline}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="predictions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="mr-2 h-5 w-5" />
                Financial Predictions
              </CardTitle>
              <CardDescription>
                AI-powered forecasts based on your spending patterns and
                financial behavior
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">
                      Next Month Spending Forecast
                    </h4>
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
                        Based on your historical data, you typically spend 15%
                        more during summer months. Consider adjusting your
                        budget for June-August to account for vacation and
                        activity expenses.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
