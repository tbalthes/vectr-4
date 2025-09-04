"use client";

import * as React from "react";
import {
  createSession as createSessionQuery,
  listSessions as listSessionsQuery,
  saveMessage as saveMessageQuery,
  loadSessionMessages as loadSessionMessagesQuery,
  deleteSession as deleteSessionQuery,
} from "@/lib/supabase/chat-queries";
import { useAuth } from "@/hooks/useAuth";

export interface ChatSession {
  id: string;
  title: string;
  updated_at?: string;
}

export interface ChatMessage {
  id?: string;
  type: "user" | "ai";
  content: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
}

export const ChatContext = React.createContext<Record<string, unknown> | null>(
  null
);
export interface ChatContextValue {
  sessions: ChatSession[];
  fetchSessions: () => Promise<void>;
  createNewSession: (title?: string) => Promise<ChatSession | null>;
  openSession: (sessionId?: string) => Promise<ChatMessage[] | null> | null;
  addMessage: (sessionId: string, msg: ChatMessage) => Promise<ChatMessage>;
  removeSession: (sessionId: string) => Promise<void>;
  currentSession: ChatSession | null;
  messages: ChatMessage[];
  loading: boolean;
  setSessions: React.Dispatch<React.SetStateAction<ChatSession[]>>;
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [sessions, setSessions] = React.useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] =
    React.useState<ChatSession | null>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [loading, setLoading] = React.useState(false);

  // Get the authenticated user
  const { userId, user, loading: authLoading } = useAuth();

  // Debug auth state
  React.useEffect(() => {
    console.log("ChatContext auth state:", {
      userId,
      hasUser: !!user,
      authLoading,
      userEmail: user?.email,
    });
  }, [userId, user, authLoading]);

  const fetchSessions = React.useCallback(async () => {
    console.log("ChatContext fetchSessions called with userId:", userId);
    try {
      if (!userId) {
        console.log("No userId available, skipping fetch");
        return;
      }
      const res = await listSessionsQuery(userId);
      console.log("Sessions fetched successfully:", res);
      setSessions(res || []);
    } catch (err) {
      console.error("fetchSessions error:", err);
    }
  }, [userId]);

  // Auto-fetch sessions when userId becomes available
  React.useEffect(() => {
    if (userId) {
      fetchSessions();
    }
  }, [userId, fetchSessions]);

  const createNewSession = React.useCallback(
    async (title?: string) => {
      console.log("ChatContext createNewSession called with:", {
        userId,
        title,
        userIdType: typeof userId,
        userIdLength: userId?.length,
      });
      if (!userId) {
        console.log("No userId available, returning null");
        return null;
      }
      try {
        const res = await createSessionQuery(userId, title || "New Chat");
        console.log("Session created successfully:", res);
        await fetchSessions();
        return res;
      } catch (err) {
        console.error("createNewSession error:", err);
        throw err;
      }
    },
    [userId, fetchSessions]
  );

  const openSession = React.useCallback(
    async (sessionId?: string) => {
      if (!sessionId) return null;
      setLoading(true);
      try {
        const msgs = await loadSessionMessagesQuery(sessionId);
        setMessages(msgs || []);
        const s = sessions.find((x) => x.id === sessionId) || null;
        setCurrentSession(s);
        return msgs || [];
      } finally {
        setLoading(false);
      }
    },
    [sessions]
  );

  const addMessage = React.useCallback(
    async (sessionId: string, msg: ChatMessage) => {
      console.log("ChatContext addMessage called with:", { sessionId, msg });
      try {
        const saved = await saveMessageQuery(
          sessionId,
          msg.type,
          msg.content,
          msg.metadata || {}
        );
        console.log("Message saved successfully:", saved);
        setMessages((prev) => [...prev, saved]);
        return saved;
      } catch (err) {
        console.error("addMessage error:", err);
        throw err; // Re-throw so the calling code can catch it
      }
    },
    []
  );

  const removeSession = React.useCallback(
    async (sessionId: string) => {
      try {
        await deleteSessionQuery(sessionId);
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        if (currentSession?.id === sessionId) {
          setCurrentSession(null);
          setMessages([]);
        }
      } catch (err) {
        console.error("removeSession", err);
      }
    },
    [currentSession]
  );

  return (
    <ChatContext.Provider
      value={{
        sessions,
        fetchSessions,
        createNewSession,
        openSession,
        addMessage,
        removeSession,
        currentSession,
        messages,
        loading,
        setSessions,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}
