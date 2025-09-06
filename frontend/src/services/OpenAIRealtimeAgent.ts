import { OpenAI } from 'openai';

interface OpenAIRealtimeAgentConfig {
  apiKey: string;
  model?: string;
  onTextUpdate: (text: string) => void;
  onError: (error: string) => void;
  onStatusChange: (status: string) => void;
}

export class OpenAIRealtimeAgent {
  private openai: OpenAI;
  private config: OpenAIRealtimeAgentConfig;
  private isListening = false;
  private currentText = '';

  constructor(config: OpenAIRealtimeAgentConfig) {
    this.config = {
      model: 'gpt-realtime',
      ...config
    };
    
    this.openai = new OpenAI({
      apiKey: this.config.apiKey,
      dangerouslyAllowBrowser: true
    });
  }

  async startListening() {
    if (this.isListening) return;
    
    this.isListening = true;
    this.config.onStatusChange('Listening...');
    
    try {
      // Simulate real-time audio input
      this.config.onStatusChange('Processing speech...');
      
      // In a real implementation, this would use WebRTC for audio streaming
      // For now, we'll use a simplified text-based approach
      
    } catch (error) {
      this.config.onError('Failed to start listening');
      this.isListening = false;
    }
  }

  async processTextInput(text: string) {
    if (!text.trim()) return;
    
    try {
      const response = await this.openai.chat.completions.create({
        model: this.config.model || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a YouTube thumbnail prompt generator. Convert the user\'s speech into a concise, visually descriptive prompt for a YouTube thumbnail. Return only the prompt text, nothing else.'
          },
          {
            role: 'user',
            content: text
          }
        ],
        max_tokens: 100,
        temperature: 0.7
      }, {
        timeout: 15000,
        maxRetries: 1
      });

      const prompt = response.choices[0]?.message?.content?.trim() || '';
      this.currentText = prompt;
      this.config.onTextUpdate(prompt);
      
    } catch (error) {
      console.error('OpenAI Realtime Error:', error);
      this.config.onError('Failed to generate prompt');
    }
  }

  stopListening() {
    this.isListening = false;
    this.config.onStatusChange('Ready');
  }

  getCurrentText() {
    return this.currentText;
  }
}
