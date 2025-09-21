import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase-server';

// This is the crucial line that fixes the issue.
// It tells Next.js to always run this route dynamically on the server.
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const emailValue = formData.get('email');
    const email = typeof emailValue === 'string' ? emailValue : '';
    const passwordValue = formData.get('password');
    const password = typeof passwordValue === 'string' ? passwordValue : '';

    // Prepare predictable JSON body for client fetch response

    const supabase = createSupabaseServerClient();

    console.log('Auth route: attempting sign in for', email);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    console.log('Auth route: signInWithPassword result:', {
      data: !!data,
      session: data?.session ? !!data.session : false,
      error: error?.message,
    });

    if (error) {
      console.warn('Login failed:', error);
      return NextResponse.json(
        { error: typeof error === 'string' ? error : error?.message || JSON.stringify(error) },
        { status: 401 },
      );
    }

    // Return the JSON response we attached cookie writes to. Also include
    // the session and user information so the browser-side Supabase client
    // can update its local session cache immediately.
    // Note: cookies written to `response` will still be sent to the browser.
    return NextResponse.json(
      {
        success: true,
        session: data?.session ?? null,
        user: data?.user ?? null,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error('Auth route unexpected error:', err);
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 });
  }
}
