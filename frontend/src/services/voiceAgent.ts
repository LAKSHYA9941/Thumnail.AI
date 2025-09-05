import { OpenAI } from 'openai';

interface VoiceAgentConfig {
  apiKey: string;
  maxTokens?: number;
  model?: string;
}

interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface VoiceSession {
  id: string;
  messages: ConversationMessage[];
  startTime: Date;
  isActive: boolean;
}

class VoiceAgentService {
  private openai: OpenAI;
  private currentSession: VoiceSession | null = null;
  private recognition: any = null;
  private isListening = false;
  private config: VoiceAgentConfig;

  constructor(config: VoiceAgentConfig) {
    this.config = {
      maxTokens: 150,
      model: 'gpt-3.5-turbo',
      ...config
    };
    
    this.openai = new OpenAI({
      apiKey: config.apiKey,
      dangerouslyAllowBrowser: true
    });

    this.initializeSpeechRecognition();
  }

  private initializeSpeechRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';
    }
  }

  async startListening(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.recognition) {
        reject(new Error('Speech recognition not supported'));
        return;
      }

      if (this.isListening) {
        resolve('');
        return;
      }

      this.isListening = true;
      let finalTranscript = '';

      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        // Update UI with interim results if needed
        if (interimTranscript) {
          this.onInterimResult?.(interimTranscript);
        }
      };

      this.recognition.onerror = (event: any) => {
        this.isListening = false;
        reject(new Error(`Speech recognition error: ${event.error}`));
      };

      this.recognition.onend = () => {
        this.isListening = false;
        resolve(finalTranscript.trim());
      };

      this.recognition.start();
    });
  }

  stopListening() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }

  async generatePromptFromVoice(transcript: string, context?: string): Promise<string> {
    try {
      const systemPrompt = `You are an AI assistant that helps users create effective YouTube thumbnail prompts. 
      Based on the user's voice input, generate a clear, detailed prompt that describes a compelling YouTube thumbnail.
      
      Guidelines:
      - Create specific, visual descriptions
      - Include colors, composition, and style elements
      - Focus on what would make viewers want to click
      - Keep it concise but descriptive
      - Avoid generic descriptions
      
      Context: ${context || 'User wants to create a YouTube thumbnail'}
      
      User said: "${transcript}"
      
      Generate a thumbnail prompt:`;

      const response = await this.openai.chat.completions.create({
        model: this.config.model!,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: transcript }
        ],
        max_tokens: this.config.maxTokens,
        temperature: 0.7
      });

      return response.choices[0]?.message?.content?.trim() || transcript;
    } catch (error) {
      console.error('Error generating prompt:', error);
      return transcript; // Fallback to original transcript
    }
  }

  async startSession(): Promise<string> {
    const sessionId = `voice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.currentSession = {
      id: sessionId,
      messages: [],
      startTime: new Date(),
      isActive: true
    };
    return sessionId;
  }

  endSession() {
    if (this.currentSession) {
      this.currentSession.isActive = false;
      this.stopListening();
    }
  }

  addMessage(role: 'user' | 'assistant', content: string) {
    if (this.currentSession && this.currentSession.isActive) {
      this.currentSession.messages.push({
        role,
        content,
        timestamp: new Date()
      });
    }
  }

  getCurrentSession(): VoiceSession | null {
    return this.currentSession;
  }

  getSessionHistory(): ConversationMessage[] {
    return this.currentSession?.messages || [];
  }

  // Event handlers for UI updates
  onInterimResult?: (transcript: string) => void;
  onFinalResult?: (transcript: string) => void;
  onError?: (error: string) => void;

  // Credit conservation methods
  async checkApiCredits(): Promise<boolean> {
    try {
      // Simple check by making a small request
      await this.openai.models.list();
      return true;
    } catch (error) {
      console.error('API credits check failed:', error);
      return false;
    }
  }

  getEstimatedCost(text: string): number {
    // Rough estimation: ~4 characters per token
    const tokens = Math.ceil(text.length / 4);
    // GPT-3.5-turbo cost: $0.0015 per 1K tokens
    return (tokens / 1000) * 0.0015;
  }
}

export default VoiceAgentService;
export type { VoiceSession, ConversationMessage, VoiceAgentConfig };
