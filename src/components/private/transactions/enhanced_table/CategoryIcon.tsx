import React from "react";
import * as Icons from "lucide-react";
import CustomIcons from "@/components/icons/CustomIcons";

interface CategoryIconProps {
  iconName?: string;
  className?: string;
}

// Small alias map for legacy or DB values that don't match lucide exports
const ALIASES: Record<string, string> = {
  CarAlt: "Car",
  House: "Home",
  Rabbit: "Package",
  Recycle: "RefreshCw",
  Burger: "Utensils",
  Plane: "Plane",
  Wrench: "Wrench",
  Utensils: "Utensils",
};

function normalizeIconName(name?: string) {
  if (!name) return "Package";
  const cleaned = name.trim();
  if (ALIASES[cleaned]) return ALIASES[cleaned];
  // Convert kebab/snake/caseless names to PascalCase (best-effort)
  const pascal = cleaned
    .replace(/[_-]+/g, " ")
    .split(" ")
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : ""))
    .join("");
  return pascal || "Package";
}

export default function CategoryIcon({ iconName, className = "w-5 h-5" }: CategoryIconProps) {
  const name = normalizeIconName(iconName);
  // Prefer project-local overrides (so DB values like 'Rabbit' can map directly)
  const Local = (CustomIcons as Record<string, unknown>)[name];
  if (Local) return React.createElement(Local as unknown as IconConstructor, { className });

  const Candidate = (Icons as unknown as Record<string, unknown>)[name];
  const Icon = (Candidate as unknown) ?? (Icons as unknown as Record<string, unknown>).Package;
  if (!Candidate) {
    console.debug("CategoryIcon: falling back to Package for:", name);
  }
  type IconConstructor = (props: Record<string, unknown>) => React.ReactElement | null;
  return Icon ? React.createElement(Icon as unknown as IconConstructor, { className }) : null;
}
