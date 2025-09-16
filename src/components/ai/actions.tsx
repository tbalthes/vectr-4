'use client';

import * as React from 'react';
import { Bold, Italic, Code, Link, List, Copy, Zap } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/utils';

export interface ActionProps {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  size?: 'default' | 'sm' | 'lg';
  disabled?: boolean;
}

export interface ActionsProps {
  actions: ActionProps[];
  className?: string;
  compact?: boolean;
}

const QuickActions: React.FC<ActionsProps> = ({ actions, className, compact = false }) => {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {actions.map((action, index) => (
        <Button
          key={index}
          variant={action.variant || 'ghost'}
          size={compact ? 'sm' : action.size || 'default'}
          onClick={action.onClick}
          disabled={action.disabled}
          className={cn('h-8 px-2 transition-all duration-200', compact && 'h-7 text-xs')}
        >
          {action.icon && <span className="mr-1">{action.icon}</span>}
          {action.label}
        </Button>
      ))}
    </div>
  );
};

const FormatActions: React.FC<Pick<ActionsProps, 'className' | 'compact'>> = ({
  className,
  compact = false,
}) => {
  const formatActions: ActionProps[] = [
    {
      label: 'Bold',
      icon: <Bold className={cn('h-3 w-3', compact && 'h-2.5 w-2.5')} />,
      onClick: () => console.log('Bold'),
    },
    {
      label: 'Italic',
      icon: <Italic className={cn('h-3 w-3', compact && 'h-2.5 w-2.5')} />,
      onClick: () => console.log('Italic'),
    },
    {
      label: 'Code',
      icon: <Code className={cn('h-3 w-3', compact && 'h-2.5 w-2.5')} />,
      onClick: () => console.log('Code'),
    },
    {
      label: 'Link',
      icon: <Link className={cn('h-3 w-3', compact && 'h-2.5 w-2.5')} />,
      onClick: () => console.log('Link'),
    },
    {
      label: 'List',
      icon: <List className={cn('h-3 w-3', compact && 'h-2.5 w-2.5')} />,
      onClick: () => console.log('List'),
    },
  ];

  return <QuickActions actions={formatActions} className={className} compact={compact} />;
};

const MessageActions: React.FC<Pick<ActionsProps, 'className'>> = ({ className }) => {
  const messageActions: ActionProps[] = [
    {
      label: 'Copy',
      icon: <Copy className="h-3 w-3" />,
      onClick: () => console.log('Copy'),
      variant: 'ghost',
    },
    {
      label: 'Regenerate',
      icon: <Zap className="h-3 w-3" />,
      onClick: () => console.log('Regenerate'),
      variant: 'ghost',
    },
  ];

  return (
    <div className={cn('opacity-0 group-hover:opacity-100 transition-opacity', className)}>
      <QuickActions actions={messageActions} compact />
    </div>
  );
};

const Actions = {
  Quick: QuickActions,
  Format: FormatActions,
  Message: MessageActions,
};

export default Actions;
