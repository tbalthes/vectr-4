import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { RulePreviewResponse, TransactionMatch } from "@/types/rules";

// Format currency utility
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

interface RulePreviewPanelProps {
  preview: RulePreviewResponse | null;
  loading?: boolean;
  error?: string | null;
}

export function RulePreviewPanel({
  preview,
  loading,
  error,
}: RulePreviewPanelProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-sm text-gray-600">Testing rule...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-6">
          <div className="flex items-center space-x-2 text-red-700">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">Preview Error</span>
          </div>
          <p className="mt-2 text-sm text-red-600">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!preview) {
    return (
      <Card className="border-gray-200 bg-gray-50">
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              Click &ldquo;Preview Rule&rdquo; to test against your recent
              transactions
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const {
    rule_summary,
    total_transactions_checked,
    matching_transactions,
    would_override_count,
    sample_limit_reached,
  } = preview;

  return (
    <div className="space-y-4">
      {/* Rule Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Rule Preview Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Rule Description */}
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm font-medium text-blue-900">
                {rule_summary}
              </p>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {total_transactions_checked}
                </div>
                <div className="text-sm text-gray-600">
                  Transactions Checked
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {matching_transactions.length}
                </div>
                <div className="text-sm text-gray-600">Matches Found</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {would_override_count}
                </div>
                <div className="text-sm text-gray-600">Would Override</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {total_transactions_checked > 0
                    ? Math.round(
                        (matching_transactions.length /
                          total_transactions_checked) *
                          100
                      )
                    : 0}
                  %
                </div>
                <div className="text-sm text-gray-600">Match Rate</div>
              </div>
            </div>

            {sample_limit_reached && (
              <div className="flex items-center space-x-2 text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">
                  Sample limit reached. Results may not include all matches.
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Matching Transactions */}
      {matching_transactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Matching Transactions</CardTitle>
            <p className="text-sm text-gray-600">
              Showing {matching_transactions.length} sample transactions that
              match this rule
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {matching_transactions.map((transaction) => (
                <TransactionMatchCard
                  key={transaction.transaction_id}
                  transaction={transaction}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Matches */}
      {matching_transactions.length === 0 && (
        <Card className="border-gray-200">
          <CardContent className="p-6 text-center">
            <div className="text-gray-500">
              <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                No transactions match this rule in the recent sample.
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Try adjusting the rule criteria or check if you have recent
                transactions.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface TransactionMatchCardProps {
  transaction: TransactionMatch;
}

function TransactionMatchCard({ transaction }: TransactionMatchCardProps) {
  const isOverride =
    transaction.current_category_name !== transaction.matched_category_name;
  const isPositive = transaction.amount > 0;

  return (
    <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2">
          <p className="text-sm font-medium text-gray-900 truncate">
            {transaction.clean_description || transaction.description}
          </p>
          {transaction.merchant_name && (
            <Badge variant="secondary" className="text-xs">
              {transaction.merchant_name}
            </Badge>
          )}
        </div>

        <div className="flex items-center space-x-4 mt-1">
          <span className="text-xs text-gray-500">{transaction.date}</span>

          {/* Category Change Indicator */}
          <div className="flex items-center space-x-1 text-xs">
            {isOverride ? (
              <>
                <span className="text-gray-500">
                  {transaction.current_category_name || "Uncategorized"}
                </span>
                <span className="text-gray-400">→</span>
                <span className="text-green-600 font-medium">
                  {transaction.matched_category_name}
                </span>
                <Badge
                  variant="outline"
                  className="text-orange-600 border-orange-300"
                >
                  Override
                </Badge>
              </>
            ) : (
              <span className="text-gray-600">
                {transaction.matched_category_name}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-2 ml-4">
        <div
          className={`flex items-center ${
            isPositive ? "text-green-600" : "text-red-600"
          }`}
        >
          {isPositive ? (
            <TrendingUp className="h-4 w-4 mr-1" />
          ) : (
            <TrendingDown className="h-4 w-4 mr-1" />
          )}
          <span className="text-sm font-medium">
            {formatCurrency(Math.abs(transaction.amount))}
          </span>
        </div>

        <Badge variant="outline" className="text-xs">
          {Math.round(transaction.confidence * 100)}%
        </Badge>
      </div>
    </div>
  );
}
