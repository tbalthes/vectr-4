import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface CategoryIconProps {
  iconName: string; // e.g., "Utensils", "Car", "ShoppingBag"
  className?: string;
}

// A type guard to ensure the iconName is a valid key in lucide-react and is a component
const isLucideIcon = (icon: unknown): icon is LucideIcon =>
  typeof icon === "function" && !!(icon as { render?: unknown }).render;

const isIconName = (name: string): name is keyof typeof Icons => {
  return (name in Icons) && isLucideIcon(Icons[name as keyof typeof Icons]);
};

// Normalize icon names to match Lucide icon names
const normalizeIconName = (name: string): string => {
  if (!name) return "Package";
  
  // Handle kebab-case to PascalCase conversion
  const pascalCaseName = name
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.substr(1).toLowerCase())
    .join('');
    
  // Map database icon names to Lucide icon names
  const nameMap: Record<string, string> = {
    // Existing mappings
    "Food": "Utensils",
    "Dining": "Utensils",
    "Restaurant": "Utensils",
    "Shopping": "ShoppingCart",
    "Retail": "ShoppingCart",
    "Transport": "Car",
    "Travel": "Plane",
    "Entertainment": "Gamepad",
    "Utilities": "Zap",
    "Health": "Heart",
    "Medical": "Heart",
    "Salary": "DollarSign",
    "Income": "DollarSign",
    "Gift": "Gift",
    "Education": "Book",
    "Home": "Home",
    "Housing": "Home",
    "Groceries": "ShoppingCart",
    "Gas": "Fuel",
    "Fuel": "Fuel",
    "Bank": "Banknote",
    "Finance": "Banknote",
    "Investment": "TrendingUp",
    "Transfer": "Send",
    "Withdrawal": "Download",
    "Deposit": "Upload",
    "ATM": "CreditCard",
    "Online": "Globe",
    "Subscription": "RefreshCw",
    "Other": "Package",
    "Miscellaneous": "Package",
    "Uncategorized": "Package",
    
    // Database kebab-case mappings to Lucide icons
    "CarAlt": "Car",
    "Store": "Store",
    "HandSparkles": "Sparkles",
    "Burger": "Utensils",
    "Plane": "Plane",
    "CreditCard": "CreditCard",
    "FileInvoiceDollar": "FileText",
    "Utensils": "Utensils",
    "DollarSign": "DollarSign",
    "FileInvoice": "FileText",
    "Receipt": "FileText",
    "BanknoteArrowUp": "Banknote",
    "Eye": "Eye"
  };
  
  return nameMap[pascalCaseName] || nameMap[name] || pascalCaseName || "Package";
};

export function CategoryIcon({
  iconName,
  className = "w-5 h-5",
}: CategoryIconProps) {
  // Normalize the icon name to match Lucide icons
  const normalizedName = normalizeIconName(iconName);
  
  // Use the icon name directly from Supabase categories table
  let IconComponent: LucideIcon = Icons.Package;
  
  if (isIconName(normalizedName)) {
    IconComponent = Icons[normalizedName] as LucideIcon;
  }

  return <IconComponent className={className} />;
}
