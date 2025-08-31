"use client";

import * as React from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  Circle,
  Clock,
  File,
  ChevronDown,
  ChevronRight,
  Folder,
} from "lucide-react";
import { cn } from "@/lib/utils/utils";

export interface TaskItem {
  id: string;
  title: string;
  description?: string;
  status: "pending" | "in-progress" | "completed" | "cancelled";
  priority?: "low" | "medium" | "high";
  files?: string[];
  category?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface TaskProps {
  task: TaskItem;
  onToggleStatus: (taskId: string) => void;
  onSelectFile?: (filePath: string) => void;
  className?: string;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case "completed":
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case "in-progress":
      return <Clock className="h-4 w-4 text-blue-600 animate-spin" />;
    case "cancelled":
      return <Circle className="h-4 w-4 text-red-600" />;
    default:
      return <Circle className="h-4 w-4 text-gray-400" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-800 border-green-200";
    case "in-progress":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "cancelled":
      return "bg-red-100 text-red-800 border-red-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

const getPriorityColor = (priority?: string) => {
  switch (priority) {
    case "high":
      return "bg-red-100 text-red-800 border-red-200";
    case "medium":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

const Task: React.FC<TaskProps> = ({
  task,
  onToggleStatus,
  onSelectFile,
  className,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const hasDetails = task.description || (task.files && task.files.length > 0);

  return (
    <div className={cn("border rounded-lg", className)}>
      <div className="flex items-center justify-between p-3 bg-muted/30">
        <div className="flex items-center space-x-3 flex-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleStatus(task.id)}
            className="h-6 w-6 p-0 hover:bg-transparent"
          >
            {getStatusIcon(task.status)}
          </Button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <span
                className={cn(
                  "font-medium text-sm truncate",
                  task.status === "completed" &&
                    "line-through text-muted-foreground"
                )}
              >
                {task.title}
              </span>

              <Badge
                variant="outline"
                className={cn("text-xs", getStatusColor(task.status))}
              >
                {task.status}
              </Badge>

              {task.priority && task.priority !== "low" && (
                <Badge
                  variant="outline"
                  className={cn("text-xs", getPriorityColor(task.priority))}
                >
                  {task.priority}
                </Badge>
              )}

              {task.category && (
                <Badge variant="secondary" className="text-xs">
                  {task.category}
                </Badge>
              )}
            </div>

            <p className="text-xs text-muted-foreground mt-1">
              {task.createdAt.toLocaleDateString()}
            </p>
          </div>
        </div>

        {hasDetails && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(!isOpen)}
            className="h-6 w-6 p-0 hover:bg-transparent"
          >
            {isOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      {hasDetails && (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleContent className="border-t">
            <div className="p-4 space-y-3">
              {task.description && (
                <p className="text-sm text-muted-foreground">
                  {task.description}
                </p>
              )}

              {task.files && task.files.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Folder className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Files</span>
                  </div>
                  <div className="space-y-1">
                    {task.files.map((file, index) => (
                      <button
                        key={index}
                        onClick={() => onSelectFile?.(file)}
                        className="flex items-center space-x-2 w-full p-2 text-sm rounded hover:bg-muted/50 transition-colors text-left"
                      >
                        <File className="h-3 w-3 text-muted-foreground" />
                        <span className="truncate">{file}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
};

export default Task;
