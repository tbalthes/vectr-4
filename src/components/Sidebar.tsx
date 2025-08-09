import React from "react";
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

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "transactions", label: "Transactions", icon: Receipt },
    { id: "budgets", label: "Budgets", icon: PiggyBank },
    { id: "accounts", label: "Accounts", icon: CreditCard },
    { id: "vectr-ai", label: "Vectr AI", icon: Bot, badge: "New" },
  ];

  return (
    <div
      className="w-64 bg-white border-r border-border flex flex-col h-full"
      style={{ width: "var(--sidebar-width)" }}
    >
      {/* Premium Logo */}
      <div className="h-20 flex items-center px-6 border-b border-border-subtle bg-gradient-to-r from-blue-50/60 to-purple-50/40">
        <div className="flex items-center space-x-4">
          <div className="relative">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl bg-gradient-to-br from-blue-600 via-indigo-500 to-violet-500 ring-2 ring-white/80">
              <span className="text-white font-extrabold text-2xl drop-shadow-lg tracking-tight select-none">
                V
              </span>
            </div>
            <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-success border-2 border-white rounded-full shadow-md animate-pulse"></div>
          </div>
          <div>
              <h1 className="text-2xl font-extrabold bg-gradient-to-r from-blue-700 via-indigo-600 to-violet-500 bg-clip-text text-transparent tracking-tight drop-shadow-sm">
              Vectr
            </h1>
            <p className="text-xs text-muted font-semibold mt-0.5 tracking-wide">
              Finance Suite
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 p-4 py-6">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <Button
                key={item.id}
                variant={isActive ? "default" : "ghost"}
                className={`w-full justify-start h-9 px-3 text-sm transition-smooth ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-none"
                    : "text-foreground-muted hover:text-foreground hover:bg-accent"
                }`}
                onClick={() => setActiveTab(item.id)}
              >
                <Icon className="mr-3 h-4 w-4" />
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge && (
                  <Badge
                    variant="secondary"
                    className="ml-2 text-xs h-5 px-1.5"
                  >
                    {item.badge}
                  </Badge>
                )}
              </Button>
            );
          })}
        </nav>
      </div>

      <Separator />

      {/* Bottom Section */}
      <div className="p-4 space-y-1">
        <Button
          variant="ghost"
          className="w-full justify-start h-9 px-3 text-sm text-foreground-muted hover:text-foreground hover:bg-accent transition-smooth"
        >
          <Settings className="mr-3 h-4 w-4" />
          Settings
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start h-9 px-3 text-sm text-foreground-muted hover:text-foreground hover:bg-accent transition-smooth"
        >
          <HelpCircle className="mr-3 h-4 w-4" />
          Help
        </Button>
      </div>

      <Separator />

      {/* User Profile */}
      <div className="p-4">
        <div className="flex items-center space-x-3 p-2 rounded-lg hover:bg-accent transition-smooth cursor-pointer">
          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
            <User className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              John Doe
            </p>
            <p className="text-xs text-muted truncate">john@example.com</p>
          </div>
        </div>
      </div>
    </div>
  );
}
