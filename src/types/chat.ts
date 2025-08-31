// src/types/chat.ts
export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  is_archived: boolean;
  message_count?: number;
  last_message_preview?: string;
}

export interface PersistedChatMessage {
  id: string;
  session_id: string;
  type: "user" | "ai";
  content: string;
  timestamp: string;
  metadata?: {
    isStreaming?: boolean;
    isThinking?: boolean;
    components?: any;
  };
}
