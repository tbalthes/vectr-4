"use client";

import * as React from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/utils";

export interface ReasoningProps {
  children: React.ReactNode;
  isStreaming?: boolean;
  title?: string;
  className?: string;
  defaultOpen?: boolean;
  hideWhenEmpty?: boolean;
}

const Reasoning: React.FC<ReasoningProps> = ({
  children,
  isStreaming = false,
  title = "Thinking",
  className,
  defaultOpen = false,
  hideWhenEmpty = true,
}) => {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);
  const ChevronIcon = isOpen ? ChevronDown : ChevronRight;

  // Auto-collapse when streaming is done
  React.useEffect(() => {
    if (!isStreaming && !defaultOpen) {
      setIsOpen(false);
    }
  }, [isStreaming, defaultOpen]);

  const hasContent =
    React.isValidElement(children) ||
    (typeof children === "string" && children.trim().length > 0);

  if (hideWhenEmpty && !hasContent) {
    return null;
  }

  return (
    <div
      className={cn("border rounded-lg overflow-hidden bg-muted/30", className)}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
            <div className="flex items-center space-x-2">
              <Brain className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">{title}</span>
              {isStreaming && (
                <div className="flex space-x-1">
                  <div
                    className="w-1 h-1 bg-current rounded-full animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <div
                    className="w-1 h-1 bg-current rounded-full animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <div
                    className="w-1 h-1 bg-current rounded-full animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2">
              {!isOpen && hasContent && (
                <Badge variant="secondary" className="text-xs">
                  Click to expand
                </Badge>
              )}
              {hasContent && (
                <ChevronIcon
                  className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    isOpen && "transform rotate-180"
                  )}
                />
              )}
            </div>
          </button>
        </CollapsibleTrigger>

        {hasContent && (
          <CollapsibleContent className="border-t">
            <div className="p-4">
              <div className="text-sm space-y-2">
                {isStreaming ? (
                  <div className="flex items-start space-x-2">
                    <span className="flex-shrink-0">•</span>
                    <span>{children}</span>
                    <span className="inline-block w-2 h-4 bg-current animate-pulse ml-1" />
                  </div>
                ) : (
                  <div className="prose prose-sm max-w-none">{children}</div>
                )}
              </div>
            </div>
          </CollapsibleContent>
        )}
      </Collapsible>
    </div>
  );
};

export default Reasoning;
