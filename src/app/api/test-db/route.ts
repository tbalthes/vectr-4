import { NextResponse } from 'next/server';

import { supabase } from '@/lib/supabase/chat-queries';

export async function GET() {
  try {
    // Test if tables exist
    const { data: sessions, error: sessionsError } = await supabase
      .from('chat_sessions')
      .select('*')
      .limit(1);

    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('*')
      .limit(1);

    return NextResponse.json({
      tablesExist: !sessionsError && !messagesError,
      sessionsError: sessionsError?.message,
      messagesError: messagesError?.message,
      sessionCount: sessions?.length || 0,
      messageCount: messages?.length || 0,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
