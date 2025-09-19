// src/components/ui/lucide-icon.tsx
'use client';

import React from 'react';
import * as LucideIcons from 'lucide-react';
import type { LucideProps } from 'lucide-react';

interface LucideIconProps {
  name: string;
  className?: string;
  size?: number;
  fallbackIcon?: React.ComponentType<LucideProps>;
}

// Mapping for icon names that don't exist in Lucide or have different names
const iconNameMap: Record<string, string> = {
  Hamburger: 'Sandwich',
  Dog: 'PawPrint',
  SmilePlus: 'SmilePlus',
  CarAlt: 'Car',
  Cannabis: 'Leaf',
  ChartLine: 'TrendingUp',
  House: 'Home',
  Landmark: 'Building',
  None: 'HelpCircle',
  null: 'HelpCircle',
  undefined: 'HelpCircle',
};

export function LucideIcon({
  name,
  className = 'h-4 w-4',
  size,
  fallbackIcon: FallbackIcon = LucideIcons.HelpCircle,
}: LucideIconProps) {
  // Handle empty or invalid icon names
  if (!name || name === 'None' || name === 'null' || name.trim() === '') {
    return <FallbackIcon className={className} size={size} />;
  }

  // Map the icon name if needed
  const mappedName = iconNameMap[name] || name;

  // Try to get the icon from the Lucide icons
  const icons = LucideIcons as unknown as Record<string, React.ComponentType<LucideProps>>;
  const IconComponent = icons[mappedName];

  if (IconComponent && typeof IconComponent === 'function') {
    return <IconComponent className={className} size={size} />;
  }

  // Fallback to a default icon if the specified icon doesn't exist
  console.warn(`Icon "${name}" (mapped to "${mappedName}") not found in Lucide icons`);
  return <FallbackIcon className={className} size={size} />;
}
