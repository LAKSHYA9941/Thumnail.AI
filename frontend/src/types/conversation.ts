export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface VoiceSession {
  id: string;
  messages: ConversationMessage[];
  startTime: number;
  isActive: boolean;
}

export interface VoiceAgentConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}
