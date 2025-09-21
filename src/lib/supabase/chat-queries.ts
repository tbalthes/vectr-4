import { supabase } from '@/lib/supabase/supabase';

export async function createSession(userId: string, title = 'New Chat') {
  // Use the provided userId since we're passing authenticated user's ID from context
  console.log('createSession called with userId:', userId);

  // Double-check that we have an authenticated session
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  console.log('Current session in createSession:', session?.user?.id, 'Error:', sessionError);

  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({ user_id: userId, title })
    .select('*')
    .single();

  if (error) {
    console.error('Insert error details:', error);
    throw error;
  }
  return data;
}

export async function listSessions(userId: string) {
  const { data, error } = await supabase
    .from('chat_sessions')
    .select('id, title, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) {
    throw error;
  }
  return data;
}

export async function saveMessage(
  sessionId: string,
  type: 'user' | 'ai',
  content: string,
  metadata = {},
) {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({ session_id: sessionId, type, content, metadata })
    .select('*')
    .single();
  if (error) {
    throw error;
  }
  // update session updated_at
  await supabase
    .from('chat_sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', sessionId);
  return data;
}

export async function loadSessionMessages(sessionId: string) {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, type, content, metadata, timestamp')
    .eq('session_id', sessionId)
    .order('timestamp', { ascending: true });
  if (error) {
    throw error;
  }
  return data;
}

export async function deleteSession(sessionId: string) {
  const { error } = await supabase.from('chat_sessions').delete().eq('id', sessionId);
  if (error) {
    throw error;
  }
  return true;
}

export async function updateSessionTitle(sessionId: string, title: string) {
  const { data, error } = await supabase
    .from('chat_sessions')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('id', sessionId)
    .select('*')
    .single();

  if (error) {
    throw error;
  }
  return data;
}
