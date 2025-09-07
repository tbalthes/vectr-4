"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search } from "lucide-react";
import { DynamicIcon, iconNames, IconName } from "lucide-react/dynamic";
import { cn } from "@/lib/utils/utils";

interface Category {
  category_id: string;
  name: string;
  icon?: string;
  parent_id?: string;
  children: Category[];
  depth: number;
}

interface CategoryTreeResponse {
  categories: Category[];
  total_count: number;
  max_depth: number;
}

interface CreateCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (category: Category) => void;
  userId?: string;
  initialName?: string;
}

// Mapping of parent category names to their codes
const PARENT_CATEGORY_CODES: Record<string, string> = {
  "Entertainment": "ENTERTAINMENT",
  "Food & Dining": "FOOD_DINING",
  "Transportation": "TRANSPORTATION", 
  "Shopping": "SHOPPING",
  "Home & Garden": "HOME_IMPROVEMENT",
  "Bills & Utilities": "UTILITIES",
  "Healthcare": "HEALTHCARE",
  "Financial Services": "BANK_FEES",
  "Travel": "TRAVEL",
  "Business": "BUSINESS",
  "Education": "EDUCATION",
  "Personal Care": "PERSONAL_CARE",
  "Gifts & Donations": "GIFTS_DONATIONS",
  "Transfer In": "TRANSFER_IN",
  "Transfer Out": "TRANSFER_OUT",
  // Add more mappings as needed
};

// Get all available Lucide icon names using the official API
const getAllLucideIcons = (): IconName[] => {
  return iconNames.sort();
};

// Common icon categories for quick access - using basic icons that definitely exist
const SUGGESTED_ICONS = {
  "Most Popular": [
    "home", "heart", "search", "settings", "user", "mail", "phone", "calendar",
    "camera", "music", "shopping-cart", "car", "coffee", "gift", "star", "plus"
  ],
  "Money & Finance": [
    "dollar-sign", "credit-card", "calculator", "trending-up", "trending-down", 
    "coins", "receipt", "banknote", "wallet", "briefcase", "building"
  ],
  "Transportation": [
    "car", "bus", "train", "plane", "bike", "fuel", "map-pin", "navigation",
    "ship", "truck", "compass", "map"
  ],
  "Food & Dining": [
    "utensils", "coffee", "wine", "apple", "pizza", "soup", "cookie", "cake", "cherry"
  ],
  "Shopping": [
    "shopping-cart", "shopping-bag", "store", "package", "gift", "tag", "shirt"
  ],
  "Home & Living": [
    "home", "bed", "lightbulb", "wifi", "tv", "sofa", "wrench", "key", "lock"
  ],
  "Health": [
    "heart", "activity", "pill", "shield", "smile", "brain", "eye", "zap"
  ],
  "Work & Education": [
    "book-open", "laptop", "award", "building", "book", "briefcase", "monitor"
  ],
  "Entertainment": [
    "film", "headphones", "ticket", "music", "radio", "play", "pause", "camera"
  ]
};

export default function CreateCategoryModal({
  isOpen,
  onClose,
  onSuccess,
  userId,
  initialName = "",
}: CreateCategoryModalProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("help-circle");
  const [parentId, setParentId] = useState<string>("no-parent");
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [iconSearch, setIconSearch] = useState("");

  // Load categories for parent selection
  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (userId) params.append("user_id", userId);
      const res = await fetch(`/api/categories/tree?${params}`);
      if (!res.ok) throw new Error("Failed to load categories");
      const data: CategoryTreeResponse = await res.json();
      setCategories(data.categories);
    } catch (error) {
      console.error("Error loading categories:", error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (isOpen) {
      loadCategories();
      setName(initialName);
    }
  }, [isOpen, initialName, loadCategories]);

  const handleCreate = async () => {
    if (!name.trim()) return;

    setCreating(true);
    try {
      // Get the parent category info
      const selectedParent = parentId === "no-parent" ? null : categories.find(cat => cat.category_id === parentId);
      
      // Generate the category code
      let categoryCode = name.trim().toUpperCase().replace(/\s+/g, '_');
      if (selectedParent) {
        const parentCode = PARENT_CATEGORY_CODES[selectedParent.name] || selectedParent.name.toUpperCase().replace(/\s+/g, '_');
        categoryCode = `${parentCode}_${categoryCode}`;
      }

      // Check for duplicate category codes
      const existingCategories = categories.flatMap(cat => [cat, ...cat.children]);
      const isDuplicate = existingCategories.some(cat => 
        cat.name.toLowerCase() === name.trim().toLowerCase() && 
        cat.parent_id === (parentId === "no-parent" ? null : parentId)
      );

      if (isDuplicate) {
        alert("A category with this name already exists in the selected parent group.");
        setCreating(false);
        return;
      }

      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        category: categoryCode,
        parent_category: selectedParent ? (PARENT_CATEGORY_CODES[selectedParent.name] || selectedParent.name.toUpperCase().replace(/\s+/g, '_')) : null,
        icon: selectedIcon,
        parent_id: parentId === "no-parent" ? null : parentId,
        user_id: userId, // Pass user_id to ensure user-specific categories
      };

      console.log("Creating category with payload:", payload); // Debug log

      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to create category");
      }

      const newCategory = await response.json();
      onSuccess(newCategory);
      handleClose();
    } catch (error) {
      console.error("Error creating category:", error);
      // You might want to show a toast notification here
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    setName("");
    setDescription("");
    setSelectedIcon("help-circle");
    setParentId("no-parent");
    setIconSearch("");
    onClose();
  };

  // Get only top-level categories for parent selection
  const topLevelCategories = categories.filter(cat => !cat.parent_id);

  // Get icons to display - either search results or suggested icons
  const getIconsToDisplay = (): { [key: string]: string[] } => {
    const allIcons = getAllLucideIcons();
    
    if (iconSearch.trim()) {
      // Filter all icons based on search
      const searchLower = iconSearch.toLowerCase();
      const filteredIcons = allIcons.filter(iconName =>
        iconName.toLowerCase().includes(searchLower)
      );
      
      if (filteredIcons.length > 0) {
        // Show search results without count in header
        const maxResults = 100;
        const results = filteredIcons.slice(0, maxResults);
        return { 
          "Search Results": results 
        };
      } else {
        return { "No Results": [] };
      }
    }
    
    // Show suggested categories when no search - convert to string arrays
    const suggestedAsString: { [key: string]: string[] } = {};
    Object.entries(SUGGESTED_ICONS).forEach(([key, icons]) => {
      suggestedAsString[key] = icons as string[];
    });
    return suggestedAsString;
  };

  const iconsToDisplay = getIconsToDisplay();

  const renderIcon = (iconName: string) => {
    // Validate that iconName is a valid IconName
    if (!iconNames.includes(iconName as IconName)) {
      return (
        <div className="w-6 h-6 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">
          ?
        </div>
      );
    }

    return (
      <DynamicIcon 
        name={iconName as IconName} 
        className="w-6 h-6"
        fallback={() => (
          <div className="w-6 h-6 bg-red-100 rounded flex items-center justify-center text-xs text-red-600">
            !
          </div>
        )}
      />
    );
  };  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Create Category</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden">
          {/* Name Input */}
          <div>
            <Label htmlFor="category-name">Name</Label>
            <Input
              id="category-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter category name"
              className="mt-1"
            />
          </div>

          {/* Description Input */}
          <div>
            <Label htmlFor="category-description">Description (Optional)</Label>
            <Input
              id="category-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter category description"
              className="mt-1"
            />
          </div>

          {/* Icon Preview and Debug */}
          <div>
            <Label>Icon & Name</Label>
            <div className="flex items-center gap-2 mt-1 p-2 border rounded">
              {renderIcon(selectedIcon)}
              <span className="font-medium">{name || "Category Name"}</span>
              <div className="ml-auto text-xs text-muted-foreground">
                {selectedIcon}
              </div>
            </div>
          </div>

          {/* Icon Search */}
          <div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search icons... (e.g., heart, money, car, home)"
                value={iconSearch}
                onChange={(e) => setIconSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Icon Grid */}
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-36" type="always">
              <div className="space-y-4">
                {Object.entries(iconsToDisplay).map(([category, icons]) => {
                  if (icons.length === 0 && category === "No Results") {
                    return (
                      <div key={category} className="text-center py-4 text-muted-foreground">
                        No icons found matching &ldquo;{iconSearch}&rdquo;
                      </div>
                    );
                  }

                  if (icons.length === 0) return null;

                  return (
                    <div key={category}>
                      <h4 className="text-sm font-medium mb-2">{category}</h4>
                      <div className="grid grid-cols-8 gap-1">
                        {icons.map((iconName: string) => (
                          <button
                            key={iconName}
                            type="button"
                            onClick={() => setSelectedIcon(iconName)}
                            className={cn(
                              "rounded hover:border border-primary transition-colors flex items-center justify-center aspect-square",
                              selectedIcon === iconName && "bg-primary text-primary-foreground"
                            )}
                            title={iconName} // Tooltip showing icon name
                          >
                            {renderIcon(iconName)}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Parent Category Selection */}
          <div>
            <Label>Group</Label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                <SelectItem value="no-parent">No parent (top level)</SelectItem>
                {loading ? (
                  <SelectItem value="loading" disabled>Loading categories...</SelectItem>
                ) : (
                  topLevelCategories.map((cat) => (
                    <SelectItem key={cat.category_id} value={cat.category_id}>
                      {cat.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreate} 
            disabled={!name.trim() || creating}
            className="bg-primary hover:bg-primary/90"
          >
            {creating ? "Creating..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
