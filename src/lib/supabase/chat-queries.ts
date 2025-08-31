import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function createSession(userId: string, title = "New Chat") {
  const { data, error } = await supabase
    .from("chat_sessions")
    .insert({ user_id: userId, title })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function listSessions(userId: string) {
  const { data, error } = await supabase
    .from("chat_sessions")
    .select("id, title, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function saveMessage(
  sessionId: string,
  type: "user" | "ai",
  content: string,
  metadata = {}
) {
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({ session_id: sessionId, type, content, metadata })
    .select("*")
    .single();
  if (error) throw error;
  // update session updated_at
  await supabase
    .from("chat_sessions")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", sessionId);
  return data;
}

export async function loadSessionMessages(sessionId: string) {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, type, content, metadata, timestamp")
    .eq("session_id", sessionId)
    .order("timestamp", { ascending: true });
  if (error) throw error;
  return data;
}

export async function deleteSession(sessionId: string) {
  const { error } = await supabase
    .from("chat_sessions")
    .delete()
    .eq("id", sessionId);
  if (error) throw error;
  return true;
}

export async function updateSessionTitle(sessionId: string, title: string) {
  const { data, error } = await supabase
    .from("chat_sessions")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", sessionId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}
