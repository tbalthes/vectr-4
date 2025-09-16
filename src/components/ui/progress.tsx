'use client';

import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';

import { cn } from '@/lib/utils/utils';

interface ProgressProps extends React.ComponentProps<typeof ProgressPrimitive.Root> {
  value?: number;
}

function Progress({ className, value, ...props }: ProgressProps) {
  return (
    <ProgressPrimitive.Root
      className={cn(
        'relative h-2 w-full overflow-hidden rounded-full bg-[var(--progress-background)]',
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className="h-full w-full flex-1 bg-[var(--progress)] transition-all"
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
