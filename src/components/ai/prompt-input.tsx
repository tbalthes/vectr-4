"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  Loader2,
  Sparkles,
  FileText,
  Image,
  Paperclip,
} from "lucide-react";
import { cn } from "@/lib/utils/utils";

export interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
  maxLength?: number;
  autoResize?: boolean;
  showCharacterCount?: boolean;
  toolbar?: boolean;
  showAttach?: boolean;
  showImage?: boolean;
}

interface ToolbarButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  icon: Icon,
  label,
  onClick,
  disabled = false,
}) => (
  <Button
    variant="ghost"
    size="sm"
    className="h-8 w-8 p-0 hover:bg-muted"
    onClick={onClick}
    disabled={disabled}
    type="button"
  >
    <Icon className="h-4 w-4" />
    <span className="sr-only">{label}</span>
  </Button>
);

export const PromptInput: React.FC<PromptInputProps> = ({
  value,
  onChange,
  onSubmit,
  placeholder = "Type your message...",
  disabled = false,
  isLoading = false,
  className,
  maxLength = 2000,
  autoResize = true,
  showCharacterCount = false,
  toolbar = false,
  showAttach = true,
  showImage = true,
}) => {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = React.useState(false);

  React.useEffect(() => {
    if (autoResize && textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [value, autoResize]);

  const handleSubmit = React.useCallback(() => {
    if (value.trim() && !disabled && !isLoading) {
      onSubmit(value.trim());
      onChange("");
      if (textareaRef.current && autoResize) {
        textareaRef.current.style.height = "auto";
      }
    }
  }, [value, onChange, onSubmit, disabled, isLoading, autoResize]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter") {
        if (e.shiftKey) {
          // Allow new line with Shift+Enter
          return;
        } else {
          // Submit with Enter
          e.preventDefault();
          handleSubmit();
        }
      }
    },
    [handleSubmit]
  );

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      if (newValue.length <= maxLength) {
        onChange(newValue);
      }
    },
    [onChange, maxLength]
  );

  const handleAttachment = React.useCallback(() => {
    // TODO: Implement file attachment
    console.log("File attachment clicked");
  }, []);

  const handleImage = React.useCallback(() => {
    // TODO: Implement image attachment
    console.log("Image attachment clicked");
  }, []);

  const isDisabled = disabled || isLoading;
  const isSubmitDisabled = !value.trim() || isDisabled;

  return (
    <div className={cn("relative space-y-2", className)}>
      {/* Toolbar */}
      {toolbar && (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1">
            {showAttach && (
              <ToolbarButton
                icon={Paperclip}
                label="Attach file"
                onClick={handleAttachment}
                disabled={isDisabled}
              />
            )}
            {showImage && (
              <ToolbarButton
                icon={Image}
                label="Attach image"
                onClick={handleImage}
                disabled={isDisabled}
              />
            )}
          </div>

          <div className="flex items-center space-x-2">
            {showCharacterCount && (
              <Badge variant="outline" className="text-xs">
                {value.length}/{maxLength}
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Input Container */}
      <div
        className={cn(
          "relative flex items-end space-x-2 rounded-lg border bg-background p-3",
          "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
          "transition-all duration-200",
          isFocused && "ring-2 ring-ring ring-offset-2"
        )}
      >
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          disabled={isDisabled}
          className={cn(
            "min-h-[44px] max-h-[120px] resize-none border-0 p-0",
            "focus-visible:ring-0 focus-visible:ring-offset-0",
            "placeholder:text-muted-foreground",
            "text-sm"
          )}
          style={
            autoResize
              ? {
                  height: "auto",
                  minHeight: "44px",
                }
              : undefined
          }
        />

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={isSubmitDisabled}
          size="sm"
          className={cn(
            "h-8 w-8 p-0 flex-shrink-0",
            "transition-all duration-200",
            isSubmitDisabled ? "opacity-50" : "hover:scale-105"
          )}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          <span className="sr-only">Send message</span>
        </Button>
      </div>

      {/* AI Enhancement Badge */}
      <div className="flex items-center justify-center">
        <Badge
          variant="secondary"
          className="flex items-center space-x-1 px-2 py-1 text-xs"
        >
          <Sparkles className="h-3 w-3" />
          <span>Powered by AI</span>
        </Badge>
      </div>
    </div>
  );
};

export default PromptInput;
