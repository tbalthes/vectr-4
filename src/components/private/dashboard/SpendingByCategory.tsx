"use client";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../../ui/card";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

interface Category {
  name: string;
  value: number;
  color: string;
}

interface SpendingByCategoryProps {
  categories: Category[];
}

export function SpendingByCategory({ categories }: SpendingByCategoryProps) {
  return (
    <Card className="card-clean">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">
          Spending by Category
        </CardTitle>
        <CardDescription>This month&apos;s expenses breakdown</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={categories}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
            >
              {categories.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => [`$${value}`, "Amount"]}
              contentStyle={{
                backgroundColor: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="space-y-2 mt-4">
          {categories.slice(0, 4).map((category, index) => (
            <div
              key={index}
              className="flex items-center justify-between text-sm"
            >
              <div className="flex items-center space-x-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: category.color }}
                />
                <span className="text-foreground-muted">{category.name}</span>
              </div>
              <span className="font-medium text-foreground">
                ${category.value}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
