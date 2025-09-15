// src/components/private/merchants/MerchantPicker.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Search, Plus, Building2, ChevronDown, X } from "lucide-react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface MerchantCategory {
  id: string;
  name: string;
  icon: string;
}

interface Merchant {
  id: string;
  name: string;
  logoUrl: string | null;
  category: MerchantCategory | null;
}

interface MerchantPickerProps {
  selectedMerchant?: Merchant | null;
  onMerchantSelect: (merchant: Merchant | null) => void;
  onCreateMerchant?: (name: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  allowClear?: boolean;
  maxResults?: number;
}

export function MerchantPicker({
  selectedMerchant,
  onMerchantSelect,
  onCreateMerchant,
  placeholder = "Search merchants...",
  className,
  disabled = false,
  allowClear = true,
  maxResults = 20,
}: MerchantPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch merchants based on search query
  const fetchMerchants = useCallback(
    async (query: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const url = new URL("/api/merchants/search", window.location.origin);
        if (query) {
          url.searchParams.set("q", query);
        }
        url.searchParams.set("limit", maxResults.toString());

        const response = await fetch(url.toString());

        if (!response.ok) {
          throw new Error(`Search failed: ${response.statusText}`);
        }

        const result = await response.json();
        setMerchants(result.data || []);
      } catch (err) {
        console.error("Error fetching merchants:", err);
        setError(
          err instanceof Error ? err.message : "Failed to fetch merchants"
        );
        setMerchants([]);
      } finally {
        setIsLoading(false);
      }
    },
    [maxResults]
  );

  // Trigger search when query changes
  useEffect(() => {
    if (isOpen) {
      void fetchMerchants(searchQuery);
    }
  }, [isOpen, searchQuery, fetchMerchants]);

  // Handle opening dropdown
  const handleOpen = useCallback(() => {
    setIsOpen(true);
    setSearchQuery("");
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  }, []);

  // Handle closing dropdown
  const handleClose = useCallback(() => {
    setIsOpen(false);
    setSearchQuery("");
  }, []);

  // Handle merchant selection
  const handleMerchantSelect = useCallback(
    (merchant: Merchant) => {
      onMerchantSelect(merchant);
      handleClose();
    },
    [onMerchantSelect, handleClose]
  );

  // Handle clear selection
  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onMerchantSelect(null);
    },
    [onMerchantSelect]
  );

  // Handle create new merchant
  const handleCreateMerchant = useCallback(() => {
    if (onCreateMerchant && searchQuery.trim()) {
      onCreateMerchant(searchQuery.trim());
      handleClose();
    }
  }, [onCreateMerchant, searchQuery, handleClose]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, handleClose]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      } else if (e.key === "Enter" && !isOpen) {
        handleOpen();
      }
    },
    [isOpen, handleOpen, handleClose]
  );

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      {/* Trigger Button */}
      <Button
        type="button"
        variant="outline"
        className={cn(
          "w-full justify-between text-left font-normal",
          !selectedMerchant && "text-muted-foreground",
          disabled && "cursor-not-allowed opacity-50"
        )}
        onClick={handleOpen}
        onKeyDown={handleKeyDown}
        disabled={disabled}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Building2 className="h-4 w-4 flex-shrink-0" />
          {selectedMerchant ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {selectedMerchant.logoUrl &&
                selectedMerchant.logoUrl.trim() !== "" &&
                selectedMerchant.logoUrl !== "\\" &&
                (selectedMerchant.logoUrl.startsWith("http://") ||
                  selectedMerchant.logoUrl.startsWith("https://")) && (
                  <Image
                    src={
                      selectedMerchant.logoUrl.startsWith("http:")
                        ? selectedMerchant.logoUrl.replace("http:", "https:")
                        : selectedMerchant.logoUrl
                    }
                    alt={selectedMerchant.name}
                    width={16}
                    height={16}
                    className="rounded object-cover flex-shrink-0"
                    onError={(e) => {
                      console.log(
                        "Selected merchant image load error:",
                        selectedMerchant.logoUrl
                      );
                      e.currentTarget.style.display = "none";
                    }}
                  />
                )}
              <span className="truncate">{selectedMerchant.name}</span>
              {selectedMerchant.category && (
                <Badge variant="secondary" className="text-xs">
                  {selectedMerchant.category.name}
                </Badge>
              )}
            </div>
          ) : (
            <span className="truncate">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {selectedMerchant && allowClear && !disabled && (
            <X
              className="h-4 w-4 text-muted-foreground hover:text-foreground"
              onClick={handleClear}
            />
          )}
          <ChevronDown className="h-4 w-4 flex-shrink-0" />
        </div>
      </Button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-80 overflow-hidden">
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="Search merchants..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                autoComplete="off"
              />
            </div>
          </div>

          <ScrollArea className="max-h-64 overflow-y-auto">
            <div className="p-2">
              {isLoading && (
                <div className="text-center py-4 text-muted-foreground">
                  Searching merchants...
                </div>
              )}

              {error && (
                <div className="text-center py-4 text-destructive text-sm">
                  {error}
                </div>
              )}

              {!isLoading && !error && merchants.length === 0 && (
                <div className="text-center py-4 text-muted-foreground">
                  No merchants found
                  {searchQuery && (
                    <div className="mt-2">
                      {onCreateMerchant && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCreateMerchant}
                          className="gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          Create &ldquo;{searchQuery}&rdquo;
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {!isLoading && !error && merchants.length > 0 && (
                <>
                  {/* Create new merchant option */}
                  {onCreateMerchant && searchQuery && (
                    <div className="mb-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCreateMerchant}
                        className="w-full justify-start gap-2 text-primary"
                      >
                        <Plus className="h-4 w-4" />
                        Create &ldquo;{searchQuery}&rdquo;
                      </Button>
                    </div>
                  )}

                  {/* Merchant list */}
                  <div className="space-y-1">
                    {merchants.map((merchant) => (
                      <button
                        key={merchant.id}
                        className={cn(
                          "w-full text-left p-2 rounded-sm hover:bg-accent transition-colors",
                          "flex items-center gap-3"
                        )}
                        onClick={() => handleMerchantSelect(merchant)}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {merchant.logoUrl &&
                          merchant.logoUrl.trim() !== "" &&
                          merchant.logoUrl !== "\\" &&
                          (merchant.logoUrl.startsWith("http://") ||
                            merchant.logoUrl.startsWith("https://")) ? (
                            <Image
                              src={
                                merchant.logoUrl.startsWith("http:")
                                  ? merchant.logoUrl.replace("http:", "https:")
                                  : merchant.logoUrl
                              }
                              alt={merchant.name}
                              width={24}
                              height={24}
                              className="rounded object-cover flex-shrink-0"
                              onError={(e) => {
                                console.log(
                                  "Image load error:",
                                  merchant.logoUrl
                                );
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="h-6 w-6 rounded bg-white flex items-center justify-center flex-shrink-0">
                              <Building2 className="h-3 w-3" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">
                              {merchant.name}
                            </div>
                            {merchant.category && (
                              <div className="text-xs text-muted-foreground truncate">
                                {merchant.category.name}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
