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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

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
      <SheetContent side="right" className={cn("w-[380px] p-4", className)}>
        <SheetHeader>
          <SheetTitle>Chat History</SheetTitle>
        </SheetHeader>
        <div className="flex items-center justify-between mb-4">
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

        <div className="mb-3">
          <Input
            placeholder="Search chats..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pr-10"
          />
        </div>

        <ScrollArea className="h-[60vh]">
          <div className="space-y-2">
            {filtered.length === 0 && (
              <div className="text-sm text-muted-foreground">No chats yet</div>
            )}

            {filtered.map((s) => (
              <div
                key={s.id}
                className="flex items-start justify-between p-3 rounded-lg hover:bg-muted cursor-pointer"
                onClick={() => {
                  onSelect?.(s.id);
                  const shouldClose = closeOnSelect ?? true;
                  if (shouldClose) setOpenState(false);
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{s.title}</div>
                  {s.lastMessage && (
                    <div className="text-xs text-muted-foreground truncate mt-1">
                      {s.lastMessage}
                    </div>
                  )}
                </div>
                <div className="ml-3 flex items-center gap-2">
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
                      className="text-destructive hover:text-destructive/80"
                    >
                      <Trash className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="mt-4 text-xs text-muted-foreground">
          Your chats are saved to your account. You can export them anytime.
        </div>
      </SheetContent>
    </Sheet>
  );
}
