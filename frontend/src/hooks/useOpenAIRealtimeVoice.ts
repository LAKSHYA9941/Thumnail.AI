import { useState, useCallback, useRef } from 'react';
import { OpenAIRealtimeAgent } from '@/services/OpenAIRealtimeAgent';

interface UseOpenAIRealtimeVoiceProps {
  onPromptGenerated: (prompt: string) => void;
  apiKey: string;
}

interface UseOpenAIRealtimeVoiceState {
  isListening: boolean;
  isProcessing: boolean;
  error: string | null;
  currentText: string;
}

export const useOpenAIRealtimeVoice = ({ 
  onPromptGenerated, 
  apiKey 
}: UseOpenAIRealtimeVoiceProps) => {
  const [state, setState] = useState<UseOpenAIRealtimeVoiceState>({
    isListening: false,
    isProcessing: false,
    error: null,
    currentText: ''
  });

  const agentRef = useRef<OpenAIRealtimeAgent | null>(null);

  const initializeAgent = useCallback(() => {
    if (!apiKey) {
      setState(prev => ({ ...prev, error: 'API key is required' }));
      return;
    }

    agentRef.current = new OpenAIRealtimeAgent({
      apiKey,
      onTextUpdate: (text) => {
        setState(prev => ({ ...prev, currentText: text }));
        onPromptGenerated(text);
      },
      onError: (error) => {
        setState(prev => ({ ...prev, error }));
      },
      onStatusChange: (status) => {
        console.log('🎤 Voice Status:', status);
      }
    });

    setState(prev => ({ ...prev, error: null }));
  }, [apiKey, onPromptGenerated]);

  const startListening = useCallback(async () => {
    if (!agentRef.current) {
      initializeAgent();
    }

    if (!agentRef.current) return;

    setState(prev => ({ ...prev, isListening: true, error: null }));
    
    // Text-based approach: simulate voice input with text
    // In real implementation, this would capture audio and convert to text
    console.log('🎤 Ready for text input (simulating voice)...');
  }, [initializeAgent]);

  const stopListening = useCallback(async () => {
    if (!agentRef.current) return;

    setState(prev => ({ ...prev, isListening: false, isProcessing: false }));
  }, []);

  const processText = useCallback(async (text: string) => {
    if (!agentRef.current) {
      initializeAgent();
    }

    if (!agentRef.current) return;

    setState(prev => ({ ...prev, isProcessing: true, error: null }));
    
    try {
      await agentRef.current.processTextInput(text);
      setState(prev => ({ 
        ...prev, 
        isProcessing: false,
        isListening: false
      }));
    } catch (error) {
      console.error('Error processing text:', error);
      setState(prev => ({ 
        ...prev, 
        isProcessing: false,
        isListening: false,
        error: 'Failed to process text'
      }));
    }
  }, [initializeAgent]);

  return {
    ...state,
    initializeAgent,
    startListening,
    stopListening,
    processText
  };
};
