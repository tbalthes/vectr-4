'use client';

import * as React from 'react';
import { Loader2, Sparkles } from 'lucide-react';

import { cn } from '@/lib/utils/utils';

export interface LoaderProps {
  type?: 'spinner' | 'dots' | 'pulse' | 'typing';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  message?: string;
  showMessage?: boolean;
}

const LoaderSpinner: React.FC<Pick<LoaderProps, 'size' | 'className'>> = ({
  size = 'md',
  className,
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return <Loader2 className={cn('animate-spin', sizeClasses[size], className)} />;
};

const LoaderDots: React.FC<Pick<LoaderProps, 'size' | 'className'>> = ({
  size = 'md',
  className,
}) => {
  const dotSize = size === 'sm' ? 'w-1 h-1' : size === 'lg' ? 'w-2 h-2' : 'w-1.5 h-1.5';

  return (
    <div className={cn('flex space-x-1 items-center', className)}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={cn('bg-current rounded-full animate-bounce', dotSize)}
          style={{ animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </div>
  );
};

const LoaderPulse: React.FC<Pick<LoaderProps, 'size' | 'className'>> = ({
  size = 'md',
  className,
}) => {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-4 h-4',
    lg: 'w-6 h-6',
  };

  return (
    <div className={cn('relative', className)}>
      <div
        className={cn(
          'absolute inset-0 rounded-full bg-current opacity-20 animate-ping',
          sizeClasses[size],
        )}
      />
      <div
        className={cn(
          'relative rounded-full bg-current',
          sizeClasses[size],
          size === 'sm' ? 'w-1 h-1' : size === 'lg' ? 'w-4 h-4' : 'w-2 h-2',
        )}
      />
    </div>
  );
};

const LoaderTyping: React.FC<Pick<LoaderProps, 'size' | 'className'>> = ({
  size = 'md',
  className,
}) => {
  return (
    <div className={cn('flex items-center space-x-2', className)}>
      <Sparkles className={cn(size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4')} />
      <span className="text-sm text-muted-foreground">AI is thinking...</span>
      <div className="flex space-x-0.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={cn(
              'bg-current rounded-full animate-ping',
              size === 'sm' ? 'w-0.5 h-0.5' : 'w-1 h-1',
            )}
            style={{
              animationDelay: `${i * 0.15}s`,
              animationDuration: '1s',
            }}
          />
        ))}
      </div>
    </div>
  );
};

const Loader: React.FC<LoaderProps> = ({
  type = 'spinner',
  size = 'md',
  className,
  message,
  showMessage = false,
}) => {
  const renderLoader = () => {
    switch (type) {
      case 'dots':
        return <LoaderDots size={size} className={className} />;
      case 'pulse':
        return <LoaderPulse size={size} className={className} />;
      case 'typing':
        return <LoaderTyping size={size} className={className} />;
      default:
        return <LoaderSpinner size={size} className={className} />;
    }
  };

  if (showMessage && message) {
    return (
      <div className="flex items-center space-x-3 p-4">
        {renderLoader()}
        <span className="text-sm text-muted-foreground">{message}</span>
      </div>
    );
  }

  return renderLoader();
};

export default Loader;
