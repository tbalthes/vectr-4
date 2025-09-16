// src/types/vectrai.ts

export interface AIInsight {
  id: number;
  type: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  savings: number;
  confidence: number;
  category: string;
}

export interface ChatMessage {
  id: number;
  type: 'ai' | 'user';
  message: string;
  timestamp: string;
}

export interface FinancialGoal {
  id: number;
  title: string;
  target: number;
  current: number;
  deadline: string;
  status: 'completed' | 'on-track' | 'behind';
}
