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
  PanelRight,
  PanelRightClose,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeToggle } from "./ui/theme-toggle";

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
      className={`h-screen fixed top-0 left-0 bg-background border-r border-border flex flex-col z-30 transition-all duration-200
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
      {/* ...existing code... */}
      {/* Premium Logo and Toggle (rest of your header, if needed) */}
      <div
        className={`h-16 flex items-center px-3 border-b border-border bg-background ${
          collapsed ? "justify-center" : "justify-between"
        }`}
      >
        {/* Header content: logo/text (left), toolbar (right) */}
        {!collapsed ? (
          <>
            <div className="flex items-center flex-1 min-w-0">
              <div className="relative">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-md bg-gradient-to-br from-violet-600 via-violet-700 to-purple-600 ring-1 ring-white/80">
                  <span className="text-white font-bold text-sm drop-shadow-sm tracking-tight select-none">
                    V
                  </span>
                </div>
              </div>
              <div className="font-semibold text-sm text-foreground whitespace-nowrap ml-2">
                Vectr
              </div>
            </div>
            {/* Mini toolbar icons in top right, including collapse button */}
            <div className="flex items-start mb-6">
              {/* <button className="p-[3px] rounded-md border border-transparent hover:border-slate-200 hover:bg-slate-100 transition-colors ml-1">
                <PanelRight className="w-[14px] h-[14px]" />
              </button>
              <button className="p-[3px] rounded-md border border-transparent hover:border-slate-200 hover:bg-slate-100 transition-colors ml-1">
                <Settings className="w-[14px] h-[14px]" />
              </button> */}
              <ThemeToggle className="p-[3px] rounded-md border border-transparent hover:border-border hover:bg-muted transition-colors text-foreground ml-1">
                <HelpCircle className="w-[14px] h-[14px]" />
              </ThemeToggle>
              {/* Collapse/expand button as last icon */}
              {collapsible && (
                <button
                  onClick={onToggleCollapse}
                  className="p-[3px] rounded-md border border-transparent hover:border-border hover:bg-muted transition-colors text-foreground ml-1"
                  aria-label="Collapse sidebar"
                >
                  <PanelRight className="w-[14px] h-[14px]" />
                </button>
              )}
            </div>
          </>
        ) : (
          // Collapsed: only show collapse/expand button centered
          collapsible && (
            <button
              onClick={onToggleCollapse}
              className="w-8 h-8 rounded-lg flex items-center justify-center shadow-md bg-gradient-to-br from-violet-600 via-violet-700 to-purple-600 ring-1 ring-white/80 group"
              aria-label="Expand sidebar"
            >
              {/* Vectr icon by default, PanelRightClose on hover/focus */}
              <span className="group-hover:hidden group-focus:hidden w-4 h-4 rounded flex items-center justify-center bg-gradient-to-br from-violet-600 via-violet-700 to-purple-600">
                <span className="text-white font-bold text-xs select-none">
                  V
                </span>
              </span>
              <PanelRightClose className="h-4 w-4 text-white hidden group-hover:block group-focus:block" />
            </button>
          )
        )}
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 bg-background">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`flex items-center px-3 py-2 rounded-md transition-colors font-medium text-sm ${
                isActive
                  ? "bg-muted text-foreground border border-border"
                  : "text-foreground hover:bg-muted hover:text-foreground border border-transparent"
              } ${collapsed ? "justify-center" : ""}`}
            >
              <item.icon className="h-4 w-4" />
              {!collapsed && (
                <>
                  <span className="ml-3">{item.label}</span>
                  {item.badge && (
                    <Badge className="ml-2 bg-secondary text-secondary-foreground text-xs">
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
        className={`p-3 space-y-1 bg-background ${
          collapsed ? "flex flex-col items-center" : ""
        }`}
      >
        <Button
          variant="ghost"
          className={`h-8 px-3 text-xs text-foreground hover:text-foreground hover:bg-muted ${
            collapsed ? "w-auto justify-center" : "w-full justify-start"
          }`}
        >
          <Settings className={`h-3 w-3 ${collapsed ? "" : "mr-2"}`} />
          {!collapsed && "Settings"}
        </Button>
        <Button
          variant="ghost"
          className={`h-8 px-3 text-xs text-foreground hover:text-foreground hover:bg-muted ${
            collapsed ? "w-auto justify-center" : "w-full justify-start"
          }`}
        >
          <HelpCircle className={`h-3 w-3 ${collapsed ? "" : "mr-2"}`} />
          {!collapsed && "Help"}
        </Button>
        <Button
          variant="ghost"
          className={`h-8 px-3 text-xs text-foreground hover:text-foreground hover:bg-muted ${
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
      <div
        className={`p-3 bg-background ${
          collapsed ? "flex justify-center" : ""
        }`}
      >
        <div
          className={`flex items-center p-2 rounded-md hover:bg-muted transition-colors cursor-pointer ${
            collapsed ? "justify-center" : "space-x-2"
          }`}
        >
          <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center">
            <User className="h-3 w-3 text-foreground" />
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">
                {user?.email || "Guest"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {user?.id || "Not logged in"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
