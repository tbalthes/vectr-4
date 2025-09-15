'use client';

import * as React from 'react';
import { Sparkles, Lightbulb, Target } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/utils';

export interface SuggestionItem {
  id: string;
  text: string;
  category?: 'prompt' | 'question' | 'action' | 'analysis';
  confidence?: number;
}

export interface SuggestionProps {
  suggestions: SuggestionItem[];
  onSelect: (suggestion: SuggestionItem) => void;
  className?: string;
  maxVisible?: number;
  showCategories?: boolean;
  showConfidence?: boolean;
}

const getCategoryIcon = (category?: string) => {
  switch (category) {
    case 'question':
      return <Lightbulb className="h-3 w-3" />;
    case 'action':
      return <Target className="h-3 w-3" />;
    case 'analysis':
      return <Sparkles className="h-3 w-3" />;
    default:
      return <Sparkles className="h-3 w-3" />;
  }
};

const _getCategoryColor = (category?: string) => {
  switch (category) {
    case 'question':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'action':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'analysis':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const SuggestionPill: React.FC<{
  suggestion: SuggestionItem;
  onSelect: () => void;
  showCategory?: boolean;
  showConfidence?: boolean;
}> = ({ suggestion, onSelect, showCategory = false, showConfidence = false }) => {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'inline-flex items-center dark:bg-muted-foreground space-x-2 px-3 py-1.5 rounded-full',
        'bg-secondary hover:bg-secondary/80 text-secondary-foreground',
        'text-sm transition-all duration-200 hover:scale-105',
        'border border-border focus:outline-none focus:ring-2 focus:ring-ring',
      )}
    >
      {showCategory && getCategoryIcon(suggestion.category)}
      <span className="truncate max-w-48">{suggestion.text}</span>
      {showConfidence && suggestion.confidence && (
        <Badge variant="outline" className="text-xs">
          {Math.round(suggestion.confidence * 100)}%
        </Badge>
      )}
    </button>
  );
};

const Suggestion: React.FC<SuggestionProps> = ({
  suggestions,
  onSelect,
  className,
  maxVisible = 6,
  showCategories = true,
  showConfidence = false,
}) => {
  const visibleSuggestions = suggestions.slice(0, maxVisible);
  const hasMore = suggestions.length > maxVisible;

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center space-x-2">
        <Sparkles className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">Suggested prompts</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {visibleSuggestions.map((suggestion) => (
          <SuggestionPill
            key={suggestion.id}
            suggestion={suggestion}
            onSelect={() => onSelect(suggestion)}
            showCategory={showCategories}
            showConfidence={showConfidence}
          />
        ))}

        {hasMore && (
          <Badge variant="outline" className="px-3 py-1.5 text-sm">
            +{suggestions.length - maxVisible} more
          </Badge>
        )}
      </div>
    </div>
  );
};

export default Suggestion;
