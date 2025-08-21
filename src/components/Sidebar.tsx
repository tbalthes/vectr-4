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
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export function Sidebar({
  open = true,
  onClose,
  collapsible = true,
  collapsed = false,
  onToggleCollapse,
}: {
  open?: boolean;
  onClose?: () => void;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

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
    // Responsive: show/hide sidebar on mobile
    <div
      className={`h-screen fixed top-0 left-0 bg-white border-r border-slate-200 flex flex-col z-30 transition-all duration-200
        ${open ? "translate-x-0" : "-translate-x-full"}
        md:translate-x-0`}
      style={{
        width: collapsed
          ? "var(--sidebar-collapsed-width)"
          : "var(--sidebar-width)",
      }}
    >
      {/* Overlay for mobile */}
      {open && onClose && (
        <div
          className="fixed inset-0 bg-black/30 z-20 md:hidden"
          onClick={onClose}
          aria-label="Close sidebar overlay"
        />
      )}
      {/* Premium Logo and Toggle */}
      <div
        className={`h-16 flex items-center justify-between px-4 border-b border-slate-200 bg-gradient-to-r from-violet-50/60 to-purple-50/40 ${
          collapsed ? "justify-center" : ""
        }`}
      >
        {!collapsed && (
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
        )}
        {collapsible && (
          <button
            onClick={onToggleCollapse}
            className={`${
              collapsed
                ? "w-8 h-8 rounded-lg flex items-center justify-center shadow-md bg-gradient-to-br from-violet-600 via-violet-700 to-purple-600 ring-1 ring-white/80"
                : "p-2 rounded-md hover:bg-slate-100 transition-colors border border-slate-200"
            }`}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4 text-white" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        )}
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
              } ${collapsed ? "justify-center" : ""}`}
            >
              <item.icon className="h-4 w-4" />
              {!collapsed && (
                <>
                  <span className="ml-3">{item.label}</span>
                  {item.badge && (
                    <Badge className="ml-2 bg-yellow-100 text-yellow-800 text-xs">
                      {item.badge}
                    </Badge>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>
      <Separator />
      {/* Bottom Section */}
      <div
        className={`p-3 space-y-1 ${
          collapsed ? "flex flex-col items-center" : ""
        }`}
      >
        <Button
          variant="ghost"
          className={`h-8 px-3 text-xs text-gray-600 hover:text-black hover:bg-slate-50 ${
            collapsed ? "w-auto justify-center" : "w-full justify-start"
          }`}
        >
          <Settings className={`h-3 w-3 ${collapsed ? "" : "mr-2"}`} />
          {!collapsed && "Settings"}
        </Button>
        <Button
          variant="ghost"
          className={`h-8 px-3 text-xs text-gray-600 hover:text-black hover:bg-slate-50 ${
            collapsed ? "w-auto justify-center" : "w-full justify-start"
          }`}
        >
          <HelpCircle className={`h-3 w-3 ${collapsed ? "" : "mr-2"}`} />
          {!collapsed && "Help"}
        </Button>
        <Button
          variant="ghost"
          className={`h-8 px-3 text-xs text-gray-600 hover:text-black hover:bg-slate-50 ${
            collapsed ? "w-auto justify-center" : "w-full justify-start"
          }`}
          onClick={signOut}
        >
          <LogOut className={`h-3 w-3 ${collapsed ? "" : "mr-2"}`} />
          {!collapsed && "Sign Out"}
        </Button>
      </div>

      <Separator />

      {/* User Profile */}
      <div className={`p-3 ${collapsed ? "flex justify-center" : ""}`}>
        <div
          className={`flex items-center p-2 rounded-md hover:bg-slate-50 transition-colors cursor-pointer ${
            collapsed ? "justify-center" : "space-x-2"
          }`}
        >
          <div className="w-6 h-6 bg-violet-100 rounded-full flex items-center justify-center">
            <User className="h-3 w-3 text-violet-700" />
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-black truncate">
                {user?.email || "Guest"}
              </p>
              <p className="text-xs text-gray-600 truncate">
                {user?.id || "Not logged in"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
