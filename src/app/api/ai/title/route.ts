import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    // Ask the model to produce a short chat title
    const prompt = `Create a concise chat title (3-6 words) for this user conversation. Keep it specific and descriptive. Conversation: ${message}`;

    // Use chat API and extract text safely from possible structured response
    const chat = model.startChat();

    // Use streaming API to get plain text reliably
    try {
      const result = await chat.sendMessageStream(prompt);
      let accumulated = '';
      for await (const chunk of result.stream) {
        const t = chunk.text();
        if (t) {
          accumulated += t;
        }
      }

      const title = (accumulated || 'New Chat').trim().split('\n')[0].slice(0, 100);
      return NextResponse.json({ title });
    } catch (err) {
      console.error('Title streaming error:', err);
      return NextResponse.json({ error: 'Failed to generate title' }, { status: 500 });
    }
  } catch (err) {
    console.error('Title generation error:', err);
    return NextResponse.json({ error: 'Failed to generate title' }, { status: 500 });
  }
}
