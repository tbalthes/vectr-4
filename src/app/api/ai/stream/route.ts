import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { message, history = [] } = await req.json();

    if (!message) {
      return new Response("Message is required", { status: 400 });
    }

    let model;
    try {
      model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(
        "Model 'gemini-2.5-flash-lite' not found or not supported. Details:",
        errMsg
      );
      return new Response(
        `Model 'gemini-2.5-flash-lite' not found or not supported. Details: ${errMsg}`,
        { status: 500 }
      );
    }

    // Build conversation history for context
    interface HistoryMessage {
      type: "user" | "ai";
      message: string;
    }

    const chatHistory = history.map((msg: HistoryMessage) => ({
      role: msg.type === "user" ? "user" : "model",
      parts: [{ text: msg.message }],
    }));

    const chat = model.startChat({
      history: chatHistory,
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
      },
    });

    // Create a financial AI context prompt
    const contextPrompt = `You are Vectr AI, a sophisticated financial assistant integrated into a personal finance management application. You help users analyze their spending patterns, create budgets, track financial goals, and make informed financial decisions.

Key capabilities:
- Analyze transaction data and spending patterns
- Provide budget recommendations and financial insights
- Help with savings goals and investment planning
- Identify optimization opportunities in spending
- Answer questions about personal finance best practices

Always provide helpful, accurate, and actionable financial advice. Be conversational but professional. When appropriate, suggest specific actions the user can take within their finance app.

User message: ${message}`;

    const result = await chat.sendMessageStream(contextPrompt);

    // Create a readable stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            if (chunkText) {
              const data = JSON.stringify({
                content: chunkText,
                timestamp: new Date().toISOString(),
              });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }

          // Send final message
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        } catch (error) {
          console.error("Streaming error:", error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Gemini API error:", error);
    return new Response("Failed to generate AI response", { status: 500 });
  }
}
