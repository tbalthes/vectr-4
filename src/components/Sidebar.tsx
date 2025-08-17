"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import {
  LayoutDashboard,
  Receipt,
  PiggyBank,
  CreditCard,
  Bot,
  Settings,
  HelpCircle,
  User,
} from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();
  const navItems = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      href: "/private/dashboard",
    },
    {
      id: "transactions",
      label: "Transactions",
      icon: Receipt,
      href: "/private/transactions",
    },
    {
      id: "budgets",
      label: "Budgets",
      icon: PiggyBank,
      href: "/private/budgets",
    },
    {
      id: "accounts",
      label: "Accounts",
      icon: CreditCard,
      href: "/private/accounts",
    },
    {
      id: "vectr-ai",
      label: "Vectr AI",
      icon: Bot,
      href: "/private/vectr-ai",
      badge: "New",
    },
  ];

  return (
    <div
      className="w-64 bg-white border-r border-slate-200 flex flex-col h-full"
      style={{ width: "var(--sidebar-width)" }}
    >
      {/* Premium Logo */}
      <div className="h-16 flex items-center px-4 border-b border-slate-200 bg-gradient-to-r from-violet-50/60 to-purple-50/40">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-md bg-gradient-to-br from-violet-600 via-violet-700 to-purple-600 ring-1 ring-white/80">
              <span className="text-white font-bold text-sm drop-shadow-sm tracking-tight select-none">
                V
              </span>
            </div>
          </div>
          <div>
            <div className="font-semibold text-sm text-black">Vectr</div>
            <div className="text-xs text-gray-600">Finance Suite</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`flex items-center px-3 py-2 rounded-md transition-colors font-medium text-sm ${
                isActive
                  ? "bg-violet-50 text-violet-700 border border-violet-200"
                  : "text-black hover:bg-slate-50 hover:text-black"
              }`}
            >
              <item.icon className="h-4 w-4 mr-3" />
              {item.label}
              {item.badge && (
                <Badge className="ml-2 bg-yellow-100 text-yellow-800 text-xs">
                  {item.badge}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>
      <Separator />
      {/* Bottom Section */}
      <div className="p-3 space-y-1">
        <Button
          variant="ghost"
          className="w-full justify-start h-8 px-3 text-xs text-gray-600 hover:text-black hover:bg-slate-50"
        >
          <Settings className="mr-2 h-3 w-3" />
          Settings
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start h-8 px-3 text-xs text-gray-600 hover:text-black hover:bg-slate-50"
        >
          <HelpCircle className="mr-2 h-3 w-3" />
          Help
        </Button>
      </div>

      <Separator />

      {/* User Profile */}
      <div className="p-3">
        <div className="flex items-center space-x-2 p-2 rounded-md hover:bg-slate-50 transition-colors cursor-pointer">
          <div className="w-6 h-6 bg-violet-100 rounded-full flex items-center justify-center">
            <User className="h-3 w-3 text-violet-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-black truncate">John Doe</p>
            <p className="text-xs text-gray-600 truncate">john@example.com</p>
          </div>
        </div>
      </div>
    </div>
  );
}
