'use client';

import React from 'react';
import { MessageSquare, Send } from 'lucide-react';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { ChatMessage } from '@/types/vectrai';

interface ChatInterfaceProps {
  chatHistory: ChatMessage[];
  chatMessage: string;
  setChatMessage: (msg: string) => void;
  isTyping: boolean;
  handleSendMessage: () => void;
}

export default function ChatInterface({
  chatHistory,
  chatMessage,
  setChatMessage,
  isTyping,
  handleSendMessage,
}: ChatInterfaceProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center">
          <MessageSquare className="mr-2 h-5 w-5" />
          Chat with Vectr AI
        </CardTitle>
        <CardDescription>
          Ask questions about your finances, get personalized advice, or request analysis
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto mb-4">
          {chatHistory.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  message.type === 'user' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-900'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                <p
                  className={`text-xs mt-1 ${
                    message.type === 'user' ? 'text-purple-200' : 'text-gray-500'
                  }`}
                >
                  {message.timestamp}
                </p>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-900 px-4 py-2 rounded-lg">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: '0.1s' }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: '0.2s' }}
                  ></div>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="flex space-x-2">
          <Input
            placeholder="Ask Vectr AI anything about your finances..."
            value={chatMessage}
            onChange={(e) => setChatMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          />
          <Button onClick={handleSendMessage}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
