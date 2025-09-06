import { useState, useCallback, useRef } from 'react';
import VoiceAgentService from '@/services/voiceAgent';
import type { ConversationMessage } from '@/types/conversation';

interface UseVoiceAgentProps {
  onPromptGenerated: (prompt: string) => void;
  apiKey: string;
}

interface VoiceAgentState {
  isInitialized: boolean;
  isListening: boolean;
  isProcessing: boolean;
  transcript: string;
  generatedPrompt: string;
  error: string | null;
  conversationHistory: ConversationMessage[];
}

export const useVoiceAgent = ({ onPromptGenerated, apiKey }: UseVoiceAgentProps) => {
  const [state, setState] = useState<VoiceAgentState>({
    isInitialized: false,
    isListening: false,
    isProcessing: false,
    transcript: '',
    generatedPrompt: '',
    error: null,
    conversationHistory: []
  });

  const voiceAgentRef = useRef<VoiceAgentService | null>(null);
  const sessionMessagesRef = useRef<ConversationMessage[]>([]);

  // Manual initialization
  const initializeAgent = useCallback(async () => {
    if (!apiKey) {
      setState(prev => ({ ...prev, error: 'API key is required' }));
      return;
    }

    try {
      setState(prev => ({ ...prev, error: null, isProcessing: true }));
      
      voiceAgentRef.current = new VoiceAgentService({
        apiKey,
        maxTokens: 200,
        model: 'gpt-4o-mini' // Cost-effective model
      });

      // Set up event handlers
      voiceAgentRef.current.onInterimResult = (transcript: string) => {
        setState(prev => ({ ...prev, transcript }));
      };

      voiceAgentRef.current.onFinalResult = (transcript: string) => {
        setState(prev => ({ ...prev, transcript }));
      };

      voiceAgentRef.current.onError = (error: string) => {
        setState(prev => ({ ...prev, error, isListening: false, isProcessing: false }));
      };

      setState(prev => ({ ...prev, isInitialized: true, isProcessing: false }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to initialize voice agent',
        isProcessing: false 
      }));
    }
  }, [apiKey]);

  // Manual shutdown
  const shutdownAgent = useCallback(async () => {
    try {
      if (voiceAgentRef.current) {
        voiceAgentRef.current.cleanup();
        voiceAgentRef.current = null;
      }
      sessionMessagesRef.current = [];
      setState(prev => ({ 
        ...prev, 
        isInitialized: false,
        isListening: false,
        isProcessing: false,
        transcript: '',
        conversationHistory: [],
        error: null
      }));
    } catch (error) {
      console.error('Error shutting down voice agent:', error);
    }
  }, []);

  const startListening = useCallback(async () => {
    if (!voiceAgentRef.current || !state.isInitialized) {
      setState(prev => ({ ...prev, error: 'Voice agent not initialized. Please initialize first.' }));
      return;
    }

    try {
      setState(prev => ({ 
        ...prev, 
        isListening: true, 
        error: null,
        transcript: ''
      }));

      const transcript = await voiceAgentRef.current.startListening();
      
      if (transcript.trim()) {
        // Add user message to session
        const userMessage: ConversationMessage = {
          role: 'user',
          content: transcript,
          timestamp: Date.now()
        };
        sessionMessagesRef.current.push(userMessage);
        
        // Automatically generate prompt from transcript
        try {
          const prompt = await voiceAgentRef.current.generateThumbnailPrompt(transcript);
          setState(prev => ({ 
            ...prev, 
            transcript, 
            generatedPrompt: prompt,
            isProcessing: false,
            conversationHistory: [...sessionMessagesRef.current]
          }));
          onPromptGenerated?.(prompt);
        } catch (error) {
          setState(prev => ({ 
            ...prev, 
            transcript, 
            isProcessing: false,
            error: 'Failed to generate prompt from speech'
          }));
        }
      } else {
        setState(prev => ({ 
          ...prev, 
          transcript: '',
          isProcessing: false
        }));
      }
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to start listening',
        isListening: false
      }));
    } finally {
      setState(prev => ({ ...prev, isListening: false }));
    }
  }, [state.isInitialized]);

  const stopListening = useCallback(async () => {
    try {
      if (voiceAgentRef.current) {
        await voiceAgentRef.current.stopListening();
      }
      setState(prev => ({ ...prev, isListening: false }));
    } catch (error) {
      console.error('Error stopping voice agent:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to stop voice agent',
        isListening: false
      }));
    }
  }, []);

  // Streamlined prompt generation from conversation
  const generatePromptFromConversation = useCallback(async () => {
    if (!voiceAgentRef.current || sessionMessagesRef.current.length === 0) {
      setState(prev => ({ ...prev, error: 'No conversation to generate prompt from' }));
      return;
    }

    setState(prev => ({ ...prev, isProcessing: true, error: null }));
    
    try {
      // Create a concise context from conversation
      const conversationContext = sessionMessagesRef.current
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');

      const prompt = await voiceAgentRef.current.generateThumbnailPrompt(conversationContext);
      
      // Add assistant message to session
      const assistantMessage: ConversationMessage = {
        role: 'assistant',
        content: prompt,
        timestamp: Date.now()
      };
      sessionMessagesRef.current.push(assistantMessage);
      
      setState(prev => ({ 
        ...prev, 
        generatedPrompt: prompt, 
        isProcessing: false,
        conversationHistory: [...sessionMessagesRef.current]
      }));
      
      onPromptGenerated?.(prompt);
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to generate prompt',
        isProcessing: false 
      }));
    }
  }, [onPromptGenerated]);

  const clearConversation = useCallback(() => {
    sessionMessagesRef.current = [];
    setState(prev => ({ 
      ...prev, 
      generatedPrompt: '', 
      transcript: '', 
      conversationHistory: [],
      error: null
    }));
  }, []);



  return {
    ...state,
    initializeAgent,
    shutdownAgent,
    startListening,
    stopListening,
    generatePromptFromConversation,
    clearConversation,
    isSupported: typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition),
    isAvailable: !!apiKey && apiKey.trim().length > 0
  };
};
