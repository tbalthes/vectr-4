export async function GET() {
  const API_KEY = process.env.GEMINI_API_KEY;
  const NODE_ENV = process.env.NODE_ENV;

  return Response.json({
    geminiApiKeyConfigured: !!API_KEY,
    nodeEnv: NODE_ENV,
    apiKeyFirstChars: API_KEY ? API_KEY.substring(0, 8) + '...' : null,
    timestamp: new Date().toISOString()
  });
}