"use client";

import * as React from "react";
import { cn } from "@/lib/utils/utils";

export interface ConversationProps {
  children?: React.ReactNode;
  className?: string;
  maxHeight?: string;
  autoScroll?: boolean;
}

interface ConversationContentProps {
  children?: React.ReactNode;
  className?: string;
}

export const Conversation: React.FC<ConversationProps> = ({
  children,
  className,
  maxHeight,
  autoScroll = true,
}) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [isScrolledToBottom, setIsScrolledToBottom] = React.useState(true);

  React.useEffect(() => {
    if (autoScroll && scrollRef.current && isScrolledToBottom) {
      const scrollElement = scrollRef.current;
      scrollElement.scrollTop = scrollElement.scrollHeight;
    }
  }, [children, autoScroll, isScrolledToBottom]);

  const handleScroll = React.useCallback(() => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10; // 10px threshold
      setIsScrolledToBottom(isAtBottom);
    }
  }, []);

  const scrollToBottom = React.useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setIsScrolledToBottom(true);
    }
  }, []);

  return (
    <div className={cn("flex flex-col min-h-0", className)}>
      <div
        ref={scrollRef}
        className={cn(
          maxHeight
            ? "overflow-y-auto scroll-smooth"
            : "flex-1 overflow-y-auto scroll-smooth",
          "scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent"
        )}
        style={maxHeight ? { maxHeight } : undefined}
        onScroll={handleScroll}
      >
        <div className="flex flex-col space-y-1 p-4 pb-6">{children}</div>
      </div>

      {/* Scroll to bottom indicator */}
      {autoScroll && !isScrolledToBottom && (
        <div className="relative">
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
            <button
              onClick={scrollToBottom}
              className={cn(
                "flex items-center justify-center",
                "w-8 h-8 rounded-full",
                "bg-primary text-primary-foreground",
                "shadow-lg hover:shadow-xl",
                "transition-all duration-200",
                "focus:outline-none focus:ring-2 focus:ring-primary-foreground/50"
              )}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 14l-7 7m0 0l-7-7m7 7V3"
                />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const ConversationContent: React.FC<ConversationContentProps> = ({
  children,
  className,
}) => {
  return <div className={cn("space-y-4", className)}>{children}</div>;
};

export { Conversation as default };
