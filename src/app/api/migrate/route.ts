import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // First, try to create the tables
    const createSessionsQuery = `
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
        title text NOT NULL,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now(),
        is_archived boolean DEFAULT false
      );
      CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
    `;

    const createMessagesQuery = `
      CREATE TABLE IF NOT EXISTS chat_messages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id uuid REFERENCES chat_sessions(id) ON DELETE CASCADE,
        type text NOT NULL CHECK (type IN ('user','ai')),
        content text NOT NULL,
        metadata jsonb DEFAULT '{}'::jsonb,
        created_at timestamptz DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
    `;

    // Use raw SQL execution
    const { data: sessionsResult, error: sessionsError } = await supabase.rpc('exec_sql', {
      query: createSessionsQuery,
    });

    const { data: messagesResult, error: messagesError } = await supabase.rpc('exec_sql', {
      query: createMessagesQuery,
    });

    // Test if we can query the tables
    const { data: _sessions, error: sessionQueryError } = await supabase
      .from('chat_sessions')
      .select('*')
      .limit(1);

    const { data: _messages, error: messageQueryError } = await supabase
      .from('chat_messages')
      .select('*')
      .limit(1);

    return NextResponse.json({
      tablesCreated: {
        sessions: !sessionsError,
        messages: !messagesError,
      },
      sessionsError: sessionsError?.message,
      messagesError: messagesError?.message,
      queryTest: {
        sessionsWork: !sessionQueryError,
        messagesWork: !messageQueryError,
        sessionQueryError: sessionQueryError?.message,
        messageQueryError: messageQueryError?.message,
      },
      sessionsResult,
      messagesResult,
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      {
        error: 'Migration failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
