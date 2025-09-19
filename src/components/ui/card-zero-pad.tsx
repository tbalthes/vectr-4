import * as React from 'react';

import { cn } from '@/lib/utils/utils';

function CardNp({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-np"
      className={cn(
        'text-foreground flex flex-col content-evenly rounded-xl border border-border shadow-md',
        className,
      )}
      {...props}
    />
  );
}

function CardNpHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-np-header"
      className={cn(
        '@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-0 has-data-[slot=card-np-action]:grid-cols-[1fr_auto] [.border-b]:pb-6',
        className,
      )}
      {...props}
    />
  );
}

function CardNpTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-np-title"
      className={cn('leading-none font-semibold', className)}
      {...props}
    />
  );
}

function CardNpDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-np-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  );
}

function CardNpAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-np-action"
      className={cn('col-start-2 row-span-2 row-start-1 self-start justify-self-end', className)}
      {...props}
    />
  );
}

function CardNpContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-np-content" className={cn('px-0', className)} {...props} />;
}

function CardNpFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-np-footer"
      className={cn('flex items-center px-0 [.border-t]:pt-6', className)}
      {...props}
    />
  );
}

export {
  CardNp,
  CardNpHeader,
  CardNpFooter,
  CardNpTitle,
  CardNpAction,
  CardNpDescription,
  CardNpContent,
};
