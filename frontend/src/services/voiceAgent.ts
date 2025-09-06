import { OpenAI } from 'openai';
import type { VoiceAgentConfig } from '../types/conversation';

// Type declarations for Web Speech API
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

const DEFAULT_CONFIG = {
  model: 'gpt-3.5-turbo', // Default to cheaper model
  maxTokens: 150, // Keep responses concise
  temperature: 0.7, // Balanced creativity
};

class VoiceAgentService {
  private openai: OpenAI;
  private recognition: any = null;
  private isListening = false;
  private config: Required<VoiceAgentConfig>;
  private silenceTimer: NodeJS.Timeout | null = null;
  
  // Event handlers with default no-op functions
  public onInterimResult: (transcript: string) => void = () => {};
  public onFinalResult: (transcript: string) => void = () => {};
  public onError: (error: string) => void = () => {};
  public onPromptGenerated: (prompt: string) => void = () => {};

  constructor(config: VoiceAgentConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    this.openai = new OpenAI({
      apiKey: config.apiKey,
      dangerouslyAllowBrowser: true
    });

    this.initializeRecognition();
  }

  private initializeRecognition() {
    if (typeof window === 'undefined') return;
    
    try {
      console.log('🔧 Initializing speech recognition...');
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        console.error('❌ Speech recognition not supported');
        this.onError('Speech recognition not supported');
        return;
      }

      console.log('✅ Speech recognition supported:', SpeechRecognition.name);
      
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';
      
      this.recognition.onresult = this.handleRecognitionResult.bind(this);
      this.recognition.onerror = this.handleRecognitionError.bind(this);
      this.recognition.onend = this.handleRecognitionEnd.bind(this);
      
      console.log('🎯 Speech recognition initialized successfully');
      
    } catch (error) {
      console.error('🚨 Failed to initialize speech recognition:', error);
      this.onError('Speech recognition not available in this browser');
    }
  }

  private handleRecognitionResult(event: any) {
    if (!this.isListening) return;
    
    let finalTranscript = '';
    let interimTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript + ' ';
      } else {
        interimTranscript += transcript;
      }
    }

    console.log('🎤 Speech Recognition:', {
      final: finalTranscript.trim(),
      interim: interimTranscript,
      confidence: event.results[event.resultIndex]?.[0]?.confidence
    });

    if (finalTranscript) {
      console.log('🎯 Final transcript:', finalTranscript.trim());
      this.onFinalResult(finalTranscript.trim());
    } else if (interimTranscript) {
      console.log('🔄 Interim transcript:', interimTranscript);
      this.onInterimResult(interimTranscript);
    }

    this.resetSilenceTimer();
  }

  private handleRecognitionError(event: any) {
    console.error('🎤 Speech Recognition Error:', {
      error: event.error,
      message: event.message || 'Unknown error'
    });
    
    const error = event.error === 'no-speech' 
      ? 'No speech detected' 
      : `Speech recognition error: ${event.error}`;
    
    this.onError(error);
    this.stopListening();
  }

  private handleRecognitionEnd() {
    if (this.isListening) {
      this.recognition?.start();
    }
  }

  private resetSilenceTimer() {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = setTimeout(() => {
      this.stopListening();
    }, 2000); // 2 seconds of silence
  }

  async startListening(): Promise<string> {
    if (!this.recognition) {
      throw new Error('Speech recognition not initialized');
    }

    if (this.isListening) {
      await this.stopListening();
    }

    this.isListening = true;
    this.recognition.start();
    return '';
  }

  async stopListening(): Promise<void> {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }

  async generateThumbnailPrompt(transcript: string): Promise<string> {
    if (!transcript.trim()) {
      console.log('🎤 Empty transcript received, skipping generation');
      return '';
    }

    console.log('🎤 Generating prompt for transcript:', transcript.substring(0, 50) + '...');
    console.log('🤖 OpenAI Config:', { model: this.config.model, maxTokens: this.config.maxTokens });

    try {
      const response = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: `You are a YouTube thumbnail prompt generator. Create a concise, visually descriptive prompt based on: ${transcript}`
          }
        ],
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
      }, {
        timeout: 15000, // 15 second timeout
        maxRetries: 1
      });

      const generatedText = response.choices[0]?.message?.content?.trim() || '';
      console.log('✅ Generated prompt:', generatedText);
      this.onPromptGenerated(generatedText);
      return generatedText;
      
    } catch (error: any) {
      console.error('🚨 OpenAI API Error:', {
        message: error.message,
        status: error.status,
        code: error.code,
        type: error.type
      });
      
      if (error.status === 401) {
        this.onError('Invalid API key. Please check your OpenAI API key.');
      } else if (error.status === 429) {
        this.onError('Rate limit exceeded. Please try again later.');
      } else if (error.code === 'ECONNABORTED') {
        this.onError('Network timeout. Please check your connection.');
      } else {
        this.onError(`API Error: ${error.message || 'Failed to generate prompt'}`);
      }
      return '';
    }
  }

  // Cleanup resources
  cleanup() {
    this.stopListening();
    if (this.recognition) {
      this.recognition.abort();
      this.recognition = null;
    }
  }
}

export default VoiceAgentService;
