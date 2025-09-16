'use client';

import React from 'react';
import { Search } from 'lucide-react';

import { Input } from '@/components/ui/input';

interface SearchInputProps {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function SearchInput({
  placeholder = 'Search...',
  value = '',
  onChange,
  className = '',
  size = 'md',
}: SearchInputProps) {
  const sizeClasses = {
    sm: 'h-8 text-xs min-w-[140px]',
    md: 'h-9 text-sm min-w-[180px]',
    lg: 'h-10 text-base min-w-[220px]',
  };

  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className={`pl-10 bg-input border-input focus-visible:ring-ring shadow-sm ${sizeClasses[size]}`}
      />
    </div>
  );
}
