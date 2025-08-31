"use client";

import * as React from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  Wrench,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils/utils";

export type ToolStatus = "pending" | "running" | "complete" | "failed";

export interface ToolProps {
  name: string;
  status: ToolStatus;
  title?: string;
  description?: string;
  result?: React.ReactNode;
  duration?: string;
  className?: string;
  defaultOpen?: boolean;
}

interface ToolHeaderProps {
  name: string;
  title?: string;
  status: ToolStatus;
  duration?: string;
  isOpen: boolean;
  onToggle: () => void;
}

const getStatusConfig = (status: ToolStatus) => {
  switch (status) {
    case "pending":
      return {
        icon: Clock,
        label: "Pending",
        className: "bg-yellow-100 text-yellow-800 border-yellow-200",
        bgColor: "bg-yellow-50",
        animate: false,
      };
    case "running":
      return {
        icon: Zap,
        label: "Running",
        className: "bg-blue-100 text-blue-800 border-blue-200",
        bgColor: "bg-blue-50",
        animate: true,
      };
    case "complete":
      return {
        icon: CheckCircle,
        label: "Complete",
        className: "bg-green-100 text-green-800 border-green-200",
        bgColor: "bg-green-50",
        animate: false,
      };
    case "failed":
    default:
      return {
        icon: XCircle,
        label: "Failed",
        className: "bg-red-100 text-red-800 border-red-200",
        bgColor: "bg-red-50",
        animate: false,
      };
  }
};

const ToolHeader: React.FC<ToolHeaderProps> = ({
  name,
  title,
  status,
  duration,
  isOpen,
  onToggle,
}) => {
  const config = getStatusConfig(status);
  const Icon = config.icon;
  const ChevronIcon = isOpen ? ChevronDown : ChevronRight;

  return (
    <div
      className={cn(
        "flex items-center justify-between p-3 border rounded-t-lg cursor-pointer hover:bg-muted/50 transition-colors",
        config.bgColor
      )}
    >
      <div className="flex items-center space-x-3">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 hover:bg-transparent"
          onClick={onToggle}
        >
          <ChevronIcon className="h-4 w-4" />
          <span className="sr-only">Toggle tool details</span>
        </Button>

        <Wrench className="h-4 w-4 text-muted-foreground flex-shrink-0" />

        <div className="flex flex-col">
          <div className="flex items-center space-x-2">
            <span className="font-medium text-sm">{title || name}</span>
            <Badge
              variant="outline"
              className={cn("text-xs", config.className)}
            >
              <Icon
                className={cn(
                  "mr-1 h-3 w-3",
                  config.animate && "animate-pulse"
                )}
              />
              {config.label}
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground">{name}</span>
        </div>

        {duration && (
          <Badge variant="secondary" className="text-xs">
            {duration}
          </Badge>
        )}
      </div>
    </div>
  );
};

const Tool: React.FC<ToolProps> = ({
  name,
  status,
  title,
  description,
  result,
  duration,
  className,
  defaultOpen = false,
}) => {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);
  const config = getStatusConfig(status);

  const shouldShowResult = status === "complete" || status === "failed";
  const hasContent = description || result || shouldShowResult;

  return (
    <div className={cn("border rounded-lg overflow-hidden", className)}>
      <ToolHeader
        name={name}
        title={title}
        status={status}
        duration={duration}
        isOpen={isOpen}
        onToggle={() => setIsOpen(!isOpen)}
      />

      {hasContent && (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleContent className="border-t">
            <div className="p-4 space-y-3">
              {description && (
                <p className="text-sm text-muted-foreground">{description}</p>
              )}

              {status === "running" && (
                <div className="flex items-center space-x-2 text-sm">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  <span className="text-muted-foreground">Executing...</span>
                </div>
              )}

              {result && (
                <div className="bg-muted p-3 rounded-md">
                  <h4 className="text-sm font-medium mb-2">Result</h4>
                  <div className="text-sm">{result}</div>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
};

export default Tool;
