'use client';
// suggestion UI temporarily disabled for debugging
// import type { SuggestionItem } from "@/components/ai/suggestion";
// suggestion UI temporarily disabled for debugging

import React, { useState, useRef, useEffect, useContext } from 'react';
import { Bot, Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import PageHeader from '@/components/private/PageHeader';
// CardNp intentionally omitted; kept UI minimal for now
import {
  Message,
  MessageContent,
  Response,
  Conversation,
  ConversationContent,
  PromptInput,
  // Reasoning and Sources intentionally omitted in this page
  Loader,
} from '@/components/ai';
import ChatSidebar from '@/components/ai/chat-sidebar';
import type { ChatSession, ChatContextValue } from '@/contexts/ChatContext';
import { ChatProvider, ChatContext } from '@/contexts/ChatContext';
import {
  updateSessionTitle as updateSessionTitleQuery,
  listSessions as listSessionsQuery,
} from '@/lib/supabase/chat-queries';
import { useAuth } from '@/contexts/AuthContext';

interface ChatMessage {
  id: number;
  type: 'ai' | 'user';
  message: string;
  timestamp: string;
  isStreaming?: boolean;
  isThinking?: boolean;
  components?: {
    tool?: boolean;
    reasoning?: boolean;
    sources?: boolean;
    suggestion?: boolean;
    task?: boolean;
  };
}
function VectrAIPage() {
  // State and refs
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatMessage, setChatMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [dbStatus, setDbStatus] = useState<string>(''); // Debug state for database status
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  // Prevent duplicate rapid submissions of the same message (e.g., double-clicks)
  const lastSentRef = useRef<{ text: string; ts: number } | null>(null);
  // Prevent concurrent title generation for same session (moved into VectrAIWithContext scope)

  // suggestions temporarily disabled

  // sources intentionally removed from this view; ChatSidebar will fetch sessions separately

  // Send message logic
  const sendMessage = async (message: string) => {
    const trimmed = message.trim();
    // ignore empty or currently-streaming
    if (!trimmed || isStreaming) {
      return;
    }

    // ignore rapid duplicate sends of the same text within 2s
    const now = Date.now();
    if (
      lastSentRef.current &&
      lastSentRef.current.text === trimmed &&
      now - lastSentRef.current.ts < 2000
    ) {
      console.log('Ignoring duplicate rapid send:', trimmed);
      return;
    }
    // mark as sent
    lastSentRef.current = { text: trimmed, ts: now };

    setShowWelcome(false);

    // Step 1: Add user message first
    const userMessageId = Date.now();
    const userMessage: ChatMessage = {
      id: userMessageId,
      type: 'user',
      message: message.trim(),
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setChatMessage('');
    setIsStreaming(true);

    // Step 2: Wait a moment, then add AI "thinking" placeholder
    await new Promise((resolve) => setTimeout(resolve, 600));

    const aiMessageId = userMessageId + 1000;
    const aiThinkingMessage: ChatMessage = {
      id: aiMessageId,
      type: 'ai',
      message: '',
      timestamp: '',
      isThinking: true,
      isStreaming: false,
    };

    setChatMessages((prev) => [...prev, aiThinkingMessage]);

    // Step 3: Wait a bit more, then start the actual API request
    await new Promise((resolve) => setTimeout(resolve, 1200));

    // Prepare to send request to backend
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          message: message.trim(),
          history: chatMessages.slice(-10), // Send last 10 messages for context
        }),
        signal: abortControllerRef.current.signal,
      });

      // Handle streaming response
      if (!response.ok) {
        // Try to surface backend error details
        try {
          const errJson = await response.json();
          throw new Error(errJson?.error || errJson?.details || 'Server error');
        } catch {
          throw new Error('Server error');
        }
      }

      // Handle streaming response
      const reader = response.body!.getReader();
      let accumulatedMessage = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            // Server may emit a debug line describing planner requests/fetchSummary
            if (parsed.debug) {
              console.log('Planner debug:', parsed.debug);
              try {
                const rq: number = parsed.debug.requestsCount ?? 0;
                const fetchSummaryArr = (parsed.debug.fetchSummary || []) as { status?: string }[];
                const ok = fetchSummaryArr.filter((f) => f.status === 'ok').length;
                const failed = fetchSummaryArr.filter((f) => f.status === 'failed').length;
                const skipped = fetchSummaryArr.filter((f) => f.status === 'skipped').length;
                setDbStatus(
                  `Analytics: requests=${rq}, ok=${ok}, failed=${failed}, skipped=${skipped}`,
                );
              } catch {
                // ignore
              }
              continue;
            }

            if (parsed.content) {
              accumulatedMessage += parsed.content;

              // Update the message - transition from thinking to streaming
              setChatMessages((prev) =>
                prev.map((msg) =>
                  msg.id === aiMessageId
                    ? {
                        ...msg,
                        message: accumulatedMessage,
                        isThinking: false,
                        isStreaming: true,
                      }
                    : msg,
                ),
              );
            } else if (parsed.done) {
              // Streaming is complete
              break;
            } else if (parsed.error) {
              throw new Error(parsed.error);
            }
          } catch {
            // Ignore JSON parsing errors for partial chunks
          }
        }
      }

      // Finalize the AI message
      setChatMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === aiMessageId) {
            return {
              ...msg,
              message: accumulatedMessage,
              timestamp: new Date().toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              }),
              isStreaming: false,
              isThinking: false,
            };
          }
          return msg;
        }),
      );

      // Return the final AI message content for database saving
      return accumulatedMessage;
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Request was cancelled, remove the placeholder message
        setChatMessages((prev) => prev.filter((msg) => msg.id !== aiMessageId));
      } else {
        console.error('Error sending message:', error);
        // Show backend error message if available
        const errorMsg =
          error instanceof Error
            ? error.message
            : "I apologize, but I'm having trouble connecting right now. Please try again in a moment.";
        setChatMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMessageId
              ? {
                  ...msg,
                  message: errorMsg,
                  timestamp: new Date().toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                  isStreaming: false,
                  isThinking: false,
                }
              : msg,
          ),
        );
      }
      return undefined; // Return undefined on error
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return (
    <ChatProvider>
      <VectrAIWithContext
        chatMessages={chatMessages}
        setChatMessages={setChatMessages}
        chatMessage={chatMessage}
        setChatMessage={setChatMessage}
        isStreaming={isStreaming}
        showWelcome={showWelcome}
        messagesEndRef={messagesEndRef}
        sendMessage={sendMessage}
        dbStatus={dbStatus}
        setDbStatus={setDbStatus}
        loadingSessionId={loadingSessionId}
        setLoadingSessionId={setLoadingSessionId}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />
    </ChatProvider>
  );
}

// Move VectrAIWithContext outside of VectrAIPage so it is a valid React component
function VectrAIWithContext({
  chatMessages,
  setChatMessages,
  chatMessage,
  setChatMessage,
  isStreaming,
  showWelcome,
  messagesEndRef,
  sendMessage,
  dbStatus,
  setDbStatus,
  loadingSessionId,
  setLoadingSessionId,
  sidebarOpen,
  setSidebarOpen,
}: {
  chatMessages: ChatMessage[];
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  chatMessage: string;
  setChatMessage: React.Dispatch<React.SetStateAction<string>>;
  isStreaming: boolean;
  showWelcome: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  sendMessage: (msg: string) => Promise<string | undefined>;
  dbStatus: string;
  setDbStatus: React.Dispatch<React.SetStateAction<string>>;
  loadingSessionId: string | null;
  setLoadingSessionId: React.Dispatch<React.SetStateAction<string | null>>;
  sidebarOpen: boolean;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const chatCtx = useContext(ChatContext) as unknown as ChatContextValue | null;
  const auth = useAuth();
  const inFlightTitleRef = useRef<Record<string, boolean>>({});
  const sessionsLoadedRef = useRef(false);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, messagesEndRef]);

  // Load sessions on mount (only once)
  useEffect(() => {
    const userId = auth?.user?.id;
    if (userId && chatCtx?.fetchSessions && !sessionsLoadedRef.current) {
      console.log('Loading sessions for the first time for userId:', userId);
      sessionsLoadedRef.current = true;
      void chatCtx.fetchSessions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.user?.id]);

  const handleCreateSession = async () => {
    try {
      await chatCtx?.createNewSession('New Chat');
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSession = async (id: string) => {
    await chatCtx?.removeSession(id);
  };

  const handleSelectSession = async (id: string) => {
    const msgs = await chatCtx?.openSession(id);
    const mapped = (msgs || []).map(
      (m: { type: string; content: string; timestamp?: string }, idx: number) =>
        ({
          id: idx + 1 + Date.now(),
          type: m.type === 'user' ? 'user' : 'ai',
          message: m.content,
          timestamp: new Date(m.timestamp ?? Date.now()).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        }) as ChatMessage,
    );
    setChatMessages(mapped);
  };

  // Wrap sendMessage to persist chat and generate/update session title
  const handleSend = async (text: string) => {
    let currentSessionId = chatCtx?.currentSession?.id;

    // ensure a session exists
    try {
      const userId = auth?.user?.id;
      if (userId && !currentSessionId) {
        setDbStatus('Creating new session...');
        const s = await chatCtx?.createNewSession('New Chat');
        await chatCtx?.fetchSessions();
        if (s?.id) {
          await chatCtx?.openSession(s.id);
          currentSessionId = s.id;
          setDbStatus('Session created successfully');
        }
      }
      // save user's message
      if (currentSessionId) {
        setDbStatus('Saving user message...');
        await chatCtx?.addMessage(currentSessionId, {
          type: 'user',
          content: text,
        });
        setDbStatus('User message saved');
      }
    } catch (err) {
      console.error('Error creating session or saving user message:', err);
      setDbStatus(`Database error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    // Call existing sendMessage which handles streaming UI and get AI response
    const aiResponse = await sendMessage(text);

    // Save the AI response if we got one
    if (aiResponse && currentSessionId) {
      try {
        setDbStatus('Saving AI response...');
        await chatCtx?.addMessage(currentSessionId, {
          type: 'ai',
          content: aiResponse,
        });
        setDbStatus('AI response saved');

        // Refresh sessions to ensure we have the latest state
        await chatCtx?.fetchSessions();

        // Generate title only if this is the first exchange and current title is default
        console.log('Current sessions after refresh:', chatCtx?.sessions);
        let currentSession = chatCtx?.sessions?.find((s: ChatSession) => s.id === currentSessionId);
        // If context sessions are empty or not found, fetch directly from DB to avoid staleness
        if (!currentSession) {
          try {
            const directList = await listSessionsQuery(auth?.user?.id || '');
            console.log('Directly fetched sessions:', directList);
            currentSession = (directList || []).find(
              (s: ChatSession) => s.id === currentSessionId,
            ) as ChatSession | undefined;
          } catch (e) {
            console.error('Error fetching sessions directly:', e);
          }
        }
        console.log('Found currentSession:', currentSession);

        if (currentSession?.title === 'New Chat') {
          try {
            // avoid concurrent title generation
            if (inFlightTitleRef.current[currentSessionId]) {
              setDbStatus('Title generation already in progress');
            } else {
              inFlightTitleRef.current[currentSessionId] = true;
              setDbStatus('Generating title...');
              console.log('Calling title API with message:', text);
              const res = await fetch('/api/ai/title', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ message: text }),
              });
              console.log('Title API response status:', res.status);
              const json = await res.json();
              console.log('Title API response:', json);

              if (json?.title && currentSessionId) {
                console.log('Updating session title to:', json.title);
                await updateSessionTitleQuery(currentSessionId, json.title);
                // refresh session list to show new title
                await chatCtx?.fetchSessions();
                setDbStatus('Title updated successfully');
              } else {
                setDbStatus('No title returned from API');
              }
              inFlightTitleRef.current[currentSessionId] = false;
            }
          } catch (err) {
            console.error('Error generating/updating session title:', err);
            setDbStatus(`Title error: ${err instanceof Error ? err.message : 'Unknown error'}`);
          }
        } else {
          setDbStatus('Session title already exists, skipping generation');
        }
      } catch (err) {
        console.error('Error saving AI message:', err);
        setDbStatus(`AI save error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    } else {
      setDbStatus('No AI response received to save');
      console.log(
        'No AI response received. currentSessionId:',
        currentSessionId,
        'aiResponse:',
        aiResponse,
      );
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <PageHeader
        title="Vectr AI"
        subtitle="Your intelligent financial assistant powered by Google Gemini"
        actions={
          <div className="flex items-center gap-2">
            <ChatSidebar
              sessions={chatCtx?.sessions}
              onCreate={() => void handleCreateSession()}
              onDelete={(id) => void handleDeleteSession(id)}
              onSelect={(id) =>
                void (async () => {
                  setLoadingSessionId(id);
                  // keep sidebar open while loading
                  setSidebarOpen(true);
                  await handleSelectSession(id);
                  // messages should now be loaded; close sidebar
                  setLoadingSessionId(null);
                  setSidebarOpen(false);
                })()
              }
              open={sidebarOpen}
              onOpenChange={setSidebarOpen}
              closeOnSelect={false}
              loadingSessionId={loadingSessionId}
            />
            <Badge
              variant="outline"
              className="bg-gradient-to-r from-purple-50 to-blue-50 text-purple-700 border-purple-200"
            >
              <Sparkles size={8} className="mr-1" />
              Gemini Pro
            </Badge>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <Bot size={8} className="mr-1" />
              Online
            </Badge>
          </div>
        }
      />

      {/* Debug status bar */}
      {dbStatus && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-2">
          <div className="max-w-4xl mx-auto">
            <span className="text-sm text-yellow-800">Debug: {dbStatus}</span>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {showWelcome && chatMessages.length === 0 && (
          <div className="flex-1 flex flex-col p-6 justify-center pt-4">
            <div className="max-w-4xl mx-auto py-8 text-center space-y-8">
              <div className="text-center space-y-4">
                <h2 className="text-3xl font-bold">Welcome to Vectr AI</h2>
                <p className="text-lg text-gray-600 max-w-2xl">
                  Your intelligent financial assistant is ready to help you analyze spending, create
                  budgets, and make smarter financial decisions. Powered by Google Gemini AI.
                </p>
              </div>
            </div>
          </div>
        )}

        {chatMessages.length > 0 && (
          <div className="flex-1 flex flex-col px-6 pt-4 pb-0 overflow-hidden">
            <Conversation className="flex-1" maxHeight="calc(100vh - 240px)">
              <ConversationContent>
                {chatMessages.map((message) => (
                  <Message
                    key={message.id}
                    from={message.type === 'user' ? 'user' : 'assistant'}
                    timestamp={message.timestamp}
                  >
                    <MessageContent>
                      {message.isThinking ? (
                        <Loader type="typing" size="sm" />
                      ) : (
                        <Response
                          isStreaming={message.isStreaming}
                          showCursor={message.isStreaming}
                        >
                          {message.message}
                        </Response>
                      )}
                    </MessageContent>
                  </Message>
                ))}

                <div ref={messagesEndRef} />
              </ConversationContent>
            </Conversation>
          </div>
        )}

        <div className="border-t bg-background/95 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <PromptInput
              value={chatMessage}
              onChange={setChatMessage}
              onSubmit={(text) => void handleSend(text)}
              disabled={isStreaming}
              placeholder="Ask me anything about your finances..."
              toolbar={false}
              className="w-full"
              maxLength={1000}
              showCharacterCount={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default VectrAIPage;
