// src/components/private/transactions/filters/DateRangePicker.tsx
'use client';

import React, { useState } from 'react';
import { Calendar } from 'lucide-react';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface DateRange {
  from?: Date;
  to?: Date;
  preset?:
    | 'last7days'
    | 'last30days'
    | 'last90days'
    | 'thisMonth'
    | 'lastMonth'
    | 'thisYear'
    | 'custom';
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (dateRange: DateRange) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const presets = [
  { value: 'last7days', label: 'Last 7 Days' },
  { value: 'last30days', label: 'Last 30 Days' },
  { value: 'last90days', label: 'Last 90 Days' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'thisYear', label: 'This Year' },
];

export function DateRangePicker({
  value,
  onChange,
  placeholder = 'Select date range...',
  className,
  disabled = false,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');

  const applyPreset = (presetValue: string) => {
    const now = new Date();
    let from: Date | undefined;
    let to: Date = now;

    switch (presetValue) {
      case 'last7days':
        from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'last30days':
        from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'last90days':
        from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'thisMonth':
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'lastMonth':
        from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        to = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'thisYear':
        from = new Date(now.getFullYear(), 0, 1);
        break;
    }

    onChange({
      from,
      to,
      preset: presetValue as DateRange['preset'],
    });
    setIsOpen(false);
  };

  const applyCustomRange = () => {
    const from = customFrom ? new Date(customFrom) : undefined;
    const to = customTo ? new Date(customTo) : undefined;

    onChange({
      from,
      to,
      preset: 'custom',
    });
    setIsOpen(false);
  };

  const clearSelection = () => {
    onChange({});
    setCustomFrom('');
    setCustomTo('');
    setIsOpen(false);
  };

  const getDisplayText = () => {
    if (value.preset && value.preset !== 'custom') {
      const preset = presets.find((p) => p.value === value.preset);
      return preset?.label || '';
    }

    if (value.from && value.to) {
      return `${format(value.from, 'MMM dd')} - ${format(value.to, 'MMM dd')}`;
    }

    if (value.from) {
      return `From ${format(value.from, 'MMM dd, yyyy')}`;
    }

    if (value.to) {
      return `Until ${format(value.to, 'MMM dd, yyyy')}`;
    }

    return '';
  };

  const hasSelection = value.from || value.to || value.preset;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'justify-start text-left font-normal',
            !hasSelection && 'text-muted-foreground',
            className,
          )}
          disabled={disabled}
        >
          <Calendar className="mr-2 h-4 w-4" />
          {hasSelection ? getDisplayText() : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Quick Select</h4>
            <div className="grid grid-cols-2 gap-2">
              {presets.map((preset) => (
                <Button
                  key={preset.value}
                  variant={value.preset === preset.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => applyPreset(preset.value)}
                  className="text-xs"
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <h4 className="font-medium text-sm">Custom Range</h4>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-muted-foreground">From</label>
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">To</label>
                <Input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={applyCustomRange}
                  disabled={!customFrom && !customTo}
                  className="flex-1 text-white"
                >
                  Apply
                </Button>
                <Button size="sm" variant="outline" onClick={clearSelection} className="flex-1">
                  Clear
                </Button>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
