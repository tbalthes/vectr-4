"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
export interface ChatSessionItem {
  id: string;
  title: string;
  lastMessage?: string;
  updatedAt?: string;
}

interface ChatSidebarProps {
  sessions?: ChatSessionItem[];
  onCreate?: () => void;
  onDelete?: (id: string) => void;
  onSelect?: (id: string) => void;
  className?: string;
  // Controlled open state (optional)
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  // If true, sidebar will close immediately after selecting a session. Default: true
  closeOnSelect?: boolean;
  // Id of session currently loading (shows spinner)
  loadingSessionId?: string | null;
}

export default function ChatSidebar({
  sessions = [],
  onCreate,
  onDelete,
  onSelect,
  className,
  open: openProp,
  onOpenChange,
  closeOnSelect,
  loadingSessionId,
}: ChatSidebarProps) {
  const [open, setOpen] = React.useState(false);
  const controlled = typeof openProp === "boolean";
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    if (!query) return sessions;
    const q = query.toLowerCase();
    return sessions.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        (s.lastMessage || "").toLowerCase().includes(q)
    );
  }, [sessions, query]);

  const setOpenState = (v: boolean) => {
    if (controlled) {
      onOpenChange?.(v);
    } else {
      setOpen(v);
    }
  };

  const isOpen = controlled ? openProp! : open;

  return (
    <Sheet open={isOpen} onOpenChange={setOpenState}>
      <SheetTrigger asChild>
        <Button variant="ghost">Chats</Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className={cn(
          "w-[95vw] max-w-[400px] p-0 flex flex-col h-[98vh] bg-white dark:bg-zinc-900 border border-border shadow-xl rounded-xl m-2 xs:m-4 focus:outline-none",
          className
        )}
        style={{ background: undefined }}
      >
        {/* Hide the default close button */}
        <style jsx global>{`
          /* Hide the default Sheet close button in the top right */
          .absolute.top-4.right-4[aria-label="Close"],
          .absolute.top-4.right-4 > .sr-only:contains("Close") {
            display: none !important;
          }
          /* Or, more generally: */
          .absolute.top-4.right-4 {
            display: none !important;
          }
        `}</style>
        <SheetHeader className="p-4 border-b border-muted/45">
          <VisuallyHidden>
            <SheetTitle>Chat History</SheetTitle>
          </VisuallyHidden>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Chats</h3>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={onCreate}>
                <Plus className="mr-2 h-4 w-4" /> New
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setOpenState(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </SheetHeader>
        <div className="px-4 py-2">
          <Input
            placeholder="Search chats..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pr-10"
          />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-2">
          <div className="space-y-1">
            {filtered.length === 0 && (
              <div className="text-center text-muted-foreground py-8 text-sm opacity-80 select-none">
                No chats yet. Start a new conversation!
              </div>
            )}
            {filtered.map((s) => (
              <div
                key={s.id}
                className={cn(
                  "flex items-center group justify-between px-3 py-2 rounded-lg transition-colors cursor-pointer border border-transparent",
                  loadingSessionId === s.id
                    ? "opacity-60 pointer-events-none"
                    : "hover:bg-accent/60 hover:border-accent"
                )}
                tabIndex={0}
                onClick={() => {
                  onSelect?.(s.id);
                  const shouldClose = closeOnSelect ?? true;
                  if (shouldClose) setOpenState(false);
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate group-hover:text-primary">
                    {s.title}
                  </div>
                  {s.lastMessage && (
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {s.lastMessage}
                    </div>
                  )}
                </div>
                <div className="ml-2 flex items-center gap-1">
                  {loadingSessionId === s.id ? (
                    <div className="text-muted-foreground text-xs">
                      Loading...
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete?.(s.id);
                      }}
                      aria-label="Delete chat"
                      className="text-muted-foreground hover:text-red-500 transition-colors p-1 rounded"
                    >
                      <Trash className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="p-4 border-t border-muted/30 text-xs text-muted-foreground text-center bg-white dark:bg-zinc-900">
          Your chats are saved to your account. You can export them anytime.
        </div>
      </SheetContent>
    </Sheet>
  );
}
