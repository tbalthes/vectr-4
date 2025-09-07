// src/components/ui/LucideIcon.tsx
import React from "react";
import * as LucideIcons from "lucide-react";

interface LucideIconProps {
  name: string;
  className?: string;
  size?: number;
}

// Helper function to convert kebab-case to PascalCase
function kebabToPascal(str: string): string {
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

export function LucideIcon({
  name,
  className = "h-4 w-4",
  size,
}: LucideIconProps) {
  // Handle the case where the icon name might be null, undefined, or empty
  if (!name || name === "None" || name === "null") {
    return <LucideIcons.HelpCircle className={className} size={size} />;
  }

  // Convert kebab-case to PascalCase (e.g., "heart-crack" -> "HeartCrack")
  const pascalCaseName = name.includes('-') ? kebabToPascal(name) : name;

  // Get the icon component from Lucide Icons
  const icons = LucideIcons as unknown as Record<
    string,
    React.ComponentType<{ className?: string; size?: number }>
  >;
  const IconComponent = icons[pascalCaseName];

  // If the icon doesn't exist, fallback to HelpCircle
  if (!IconComponent) {
    console.warn(`Lucide icon "${name}" (converted to "${pascalCaseName}") not found, using HelpCircle fallback`);
    return <LucideIcons.HelpCircle className={className} size={size} />;
  }

  return <IconComponent className={className} size={size} />;
}
