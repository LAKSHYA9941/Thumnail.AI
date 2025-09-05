import { useState, useCallback, useRef, useEffect } from 'react';
import VoiceAgentService from '@/services/voiceAgent';
import conversationStorage from '@/services/conversationStorage';

interface UseVoiceAgentProps {
  onPromptGenerated: (prompt: string) => void;
  apiKey: string;
}

interface VoiceAgentState {
  isListening: boolean;
  isProcessing: boolean;
  transcript: string;
  generatedPrompt: string;
  error: string | null;
  currentSessionId: string | null;
  conversationHistory: any[];
}

export const useVoiceAgent = ({ onPromptGenerated, apiKey }: UseVoiceAgentProps) => {
  const [state, setState] = useState<VoiceAgentState>({
    isListening: false,
    isProcessing: false,
    transcript: '',
    generatedPrompt: '',
    error: null,
    currentSessionId: null,
    conversationHistory: []
  });

  const voiceAgentRef = useRef<VoiceAgentService | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize voice agent
  useEffect(() => {
    if (apiKey && !voiceAgentRef.current) {
      try {
        voiceAgentRef.current = new VoiceAgentService({
          apiKey,
          maxTokens: 150,
          model: 'gpt-3.5-turbo'
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
      } catch (error) {
        setState(prev => ({ ...prev, error: 'Failed to initialize voice agent' }));
      }
    }

    return () => {
      if (voiceAgentRef.current) {
        voiceAgentRef.current.endSession();
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [apiKey]);

  const startListening = useCallback(async () => {
    if (!voiceAgentRef.current) {
      setState(prev => ({ ...prev, error: 'Voice agent not initialized' }));
      return;
    }

    try {
      setState(prev => ({ 
        ...prev, 
        isListening: true, 
        error: null,
        transcript: '',
        generatedPrompt: '' 
      }));

      // Start new session
      const sessionId = await voiceAgentRef.current.startSession();
      setState(prev => ({ ...prev, currentSessionId: sessionId }));

      // Start listening
      const transcript = await voiceAgentRef.current.startListening();
      
      if (transcript.trim()) {
        setState(prev => ({ ...prev, transcript, isProcessing: true }));
        
        // Save user message
        voiceAgentRef.current.addMessage('user', transcript);

        // Generate prompt
        const prompt = await voiceAgentRef.current.generatePromptFromVoice(transcript);
        setState(prev => ({ ...prev, generatedPrompt: prompt, isProcessing: false }));

        // Save assistant message
        voiceAgentRef.current.addMessage('assistant', prompt);

        // Save to conversation storage
        const session = voiceAgentRef.current.getCurrentSession();
        if (session) {
          await conversationStorage.saveConversation(sessionId, session.messages, {
            voiceTranscript: transcript,
            generatedPrompt: prompt
          });
        }

        // Trigger callback
        onPromptGenerated?.(prompt);
      }

    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Unknown error',
        isListening: false,
        isProcessing: false 
      }));
    } finally {
      setState(prev => ({ ...prev, isListening: false }));
    }
  }, [onPromptGenerated]);

  const stopListening = useCallback(() => {
    if (voiceAgentRef.current) {
      voiceAgentRef.current.stopListening();
    }
    setState(prev => ({ ...prev, isListening: false }));
  }, []);

  const applyGeneratedPrompt = useCallback(() => {
    if (state.generatedPrompt) {
      onPromptGenerated?.(state.generatedPrompt);
    }
  }, [state.generatedPrompt, onPromptGenerated]);

  const clearGeneratedPrompt = useCallback(() => {
    setState(prev => ({ ...prev, generatedPrompt: '', transcript: '' }));
  }, []);

  const regeneratePrompt = useCallback(async (transcript: string) => {
    if (!voiceAgentRef.current) return;

    setState(prev => ({ ...prev, isProcessing: true, error: null }));
    
    try {
      const newPrompt = await voiceAgentRef.current.generatePromptFromVoice(transcript);
      setState(prev => ({ ...prev, generatedPrompt: newPrompt, isProcessing: false }));
      onPromptGenerated?.(newPrompt);
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to regenerate prompt',
        isProcessing: false 
      }));
    }
  }, [onPromptGenerated]);

  const loadConversation = useCallback(async (sessionId: string) => {
    try {
      const conversation = conversationStorage.getConversation(sessionId);
      if (conversation && conversation.messages.length > 0) {
        const lastMessage = conversation.messages[conversation.messages.length - 1];
        if (lastMessage.role === 'assistant') {
          setState(prev => ({ 
            ...prev, 
            generatedPrompt: lastMessage.content,
            conversationHistory: conversation.messages
          }));
        }
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  }, []);

  const getRecentConversations = useCallback(() => {
    return conversationStorage.getRecentConversations(10);
  }, []);

  const deleteConversation = useCallback(async (sessionId: string) => {
    return conversationStorage.deleteConversation(sessionId);
  }, []);

  const clearAllConversations = useCallback(async () => {
    return conversationStorage.clearAllConversations();
  }, []);

  const checkApiAvailability = useCallback(async () => {
    if (!voiceAgentRef.current) return false;
    return voiceAgentRef.current.checkApiCredits();
  }, []);

  const getEstimatedCost = useCallback((text: string) => {
    if (!voiceAgentRef.current) return 0;
    return voiceAgentRef.current.getEstimatedCost(text);
  }, []);

  return {
    // State
    ...state,
    
    // Actions
    startListening,
    stopListening,
    applyGeneratedPrompt,
    clearGeneratedPrompt,
    regeneratePrompt,
    loadConversation,
    getRecentConversations,
    deleteConversation,
    clearAllConversations,
    checkApiAvailability,
    getEstimatedCost,
    
    // Utilities
    isSupported: !!((window as any).webkitSpeechRecognition || (window as any).SpeechRecognition)
  };
};
