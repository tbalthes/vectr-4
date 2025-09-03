"use client";

import * as React from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils/utils";

export interface MessageProps {
  from: "user" | "assistant" | "system" | "tool";
  timestamp?: string;
  className?: string;
  children?: React.ReactNode;
}

export interface MessageContentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface MessageHeaderProps {
  from: MessageProps["from"];
  timestamp?: string;
  className?: string;
}

const getRoleConfig = (role: MessageProps["from"]) => {
  switch (role) {
    case "user":
      return {
        icon: User,
        label: "You",
        className: "bg-blue-100 text-blue-800 border-blue-200",
      };
    case "assistant":
      return {
        icon: Bot,
        label: "Vectr AI",
        className: "bg-purple-100 text-purple-800 border-purple-200",
      };
    case "tool":
      return {
        icon: Bot,
        label: "Tool",
        className: "bg-green-100 text-green-800 border-green-200",
      };
    case "system":
    default:
      return {
        icon: Bot,
        label: "System",
        className: "bg-gray-100 text-gray-800 border-gray-200",
      };
  }
};

export const MessageHeader: React.FC<MessageHeaderProps> = ({
  from,
  timestamp,
  className,
}) => {
  const config = getRoleConfig(from);
  const Icon = config.icon;

  return (
    <div className={cn("flex items-center space-x-3", className)}>
      <Avatar className="h-8 w-8">
        <AvatarFallback className="h-8 w-8">
          <Icon className="h-4 w-4" />
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2">
        <Badge variant="outline" className={cn("text-xs", config.className)}>
          <Icon className="mr-1 h-3 w-3" />
          {config.label}
        </Badge>
        {timestamp && (
          <span className="text-xs text-muted-foreground">{timestamp}</span>
        )}
      </div>
    </div>
  );
};

const Message: React.FC<MessageProps> = ({
  from,
  timestamp,
  className,
  children,
}) => {
  const isUser = from === "user";

  return (
    <div className={cn("group relative mb-6", className)}>
      <div
        className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}
      >
        {/* Avatar */}
        <div className="flex-shrink-0">
          <Avatar className="h-8 w-8">
            <AvatarFallback
              className={cn(
                "h-8 w-8",
                isUser ? "bg-blue-500 text-white" : "bg-purple-500 text-white"
              )}
            >
              {isUser ? (
                <User className="h-4 w-4" />
              ) : (
                <Bot className="h-4 w-4" />
              )}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Message Content */}
        <div
          className={cn(
            "flex-1 min-w-0 max-w-[80%]",
            isUser ? "items-end" : "items-start"
          )}
        >
          {/* Header with name and timestamp */}
          <div
            className={cn(
              "flex items-center gap-2 mb-1",
              isUser ? "justify-end" : "justify-start"
            )}
          >
            <span className="text-sm font-medium text-foreground">
              {isUser ? "You" : "Assistant"}
            </span>
            {timestamp && (
              <span className="text-xs text-muted-foreground">{timestamp}</span>
            )}
          </div>

          {/* Message Bubble */}
          <div
            className={cn(
              "rounded-2xl px-4 py-3 shadow-sm",
              isUser
                ? "bg-blue-500 text-white ml-8"
                : "bg-secondary text-foreground mr-8"
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

const MessageContent: React.FC<MessageContentProps> = ({
  className,
  children,
}) => {
  return <div className={cn("space-y-2", className)}>{children}</div>;
};

export { Message, MessageContent };
