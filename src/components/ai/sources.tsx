'use client';

import * as React from 'react';
import { BookOpen, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/utils';

export interface Source {
  id: string;
  title: string;
  url?: string;
  description?: string;
  relevance?: number;
}

export interface SourcesProps {
  sources: Source[];
  className?: string;
  defaultOpen?: boolean;
  title?: string;
}

const Sources: React.FC<SourcesProps> = ({
  sources,
  className,
  defaultOpen = false,
  title = 'Sources',
}) => {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);
  const ChevronIcon = isOpen ? ChevronDown : ChevronRight;

  if (!sources || sources.length === 0) {
    return null;
  }

  return (
    <div className={cn('border rounded-lg overflow-hidden', className)}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between p-3 border-b hover:bg-muted/50 transition-colors">
            <div className="flex items-center space-x-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">{title}</span>
              <Badge variant="secondary" className="text-xs">
                {sources.length}
              </Badge>
            </div>

            <div className="flex items-center space-x-2">
              <ChevronIcon className="h-4 w-4 transition-transform duration-200" />
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-4 space-y-2">
            {sources.map((source, index) => (
              <div
                key={source.id || index}
                className={cn(
                  'flex items-start space-x-3 p-2 rounded-md',
                  source.url ? 'hover:bg-muted/50 cursor-pointer' : 'cursor-default',
                )}
                onClick={() => source.url && window.open(source.url, '_blank')}
              >
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                  {index + 1}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="font-medium text-sm truncate">{source.title}</span>
                    {source.url && (
                      <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    )}
                    {source.relevance && source.relevance > 0.8 && (
                      <Badge variant="outline" className="text-xs border-green-200 text-green-700">
                        High relevance
                      </Badge>
                    )}
                  </div>

                  {source.description && (
                    <p className="text-sm text-muted-foreground mb-1">{source.description}</p>
                  )}

                  {source.url && (
                    <p className="text-xs text-blue-600 hover:underline truncate">{source.url}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default Sources;
