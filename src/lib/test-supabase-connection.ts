import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

console.log("Testing Supabase connection...");
console.log("URL:", supabaseUrl ? "Set" : "Not set");
console.log("KEY:", supabaseKey ? "Set" : "Not set");

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Supabase environment variables are missing!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Test basic connection
async function testConnection() {
  try {
    console.log("Testing basic Supabase connection...");

    // Test chat_sessions table exists and is accessible
    const { data: sessions, error: sessionsError } = await supabase
      .from("chat_sessions")
      .select("id", { count: 'estimated', head: true });

    if (sessionsError) {
      console.error("❌ Error accessing chat_sessions table:", sessionsError);
    } else {
      console.log("✅ Chat sessions table accessible, estimated count:", sessions);
    }

    // Test chat_messages table exists and is accessible
    const { data: messages, error: messagesError } = await supabase
      .from("chat_messages")
      .select("id", { count: 'estimated', head: true });

    if (messagesError) {
      console.error("❌ Error accessing chat_messages table:", messagesError);
    } else {
      console.log("✅ Chat messages table accessible, estimated count:", messages);
    }

  } catch (error) {
    console.error("❌ General Supabase error:", error);
  }
}

testConnection();