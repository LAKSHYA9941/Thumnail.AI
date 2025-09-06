import { useState, useCallback, useRef } from 'react';
import { OpenAIRealtimeAgent } from '@/services/OpenAIRealtimeAgent';

interface UseOpenAIRealtimeVoiceProps {
  onPromptGenerated: (prompt: string) => void;
  apiKey: string;
}

interface UseOpenAIRealtimeVoiceState {
  isListening: boolean;
  isRecording: boolean;
  isProcessing: boolean;
  error: string | null;
  currentText: string;
  currentQuestion: string | null;
  status: string;
}

export const useOpenAIRealtimeVoice = ({ 
  onPromptGenerated, 
  apiKey 
}: UseOpenAIRealtimeVoiceProps) => {
  const [state, setState] = useState<UseOpenAIRealtimeVoiceState>({
    isListening: false,
    isRecording: false,
    isProcessing: false,
    error: null,
    currentText: '',
    currentQuestion: null,
    status: 'Idle'
  });

  const agentRef = useRef<OpenAIRealtimeAgent | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

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
        setState(prev => ({ ...prev, status }));
      }
    });

    setState(prev => ({ ...prev, error: null }));
  }, [apiKey, onPromptGenerated]);

  // Start a guided conversation: agent asks first question via TTS
  const startConversation = useCallback(async () => {
    if (!agentRef.current) initializeAgent();
    if (!agentRef.current) return;

    try {
      setState(prev => ({ ...prev, isListening: true, error: null }));
      await agentRef.current.startConversation();
      setState(prev => ({ ...prev, currentQuestion: agentRef.current!.getCurrentQuestion() }));
    } catch (err) {
      console.error('Failed to start conversation', err);
      setState(prev => ({ ...prev, isListening: false, error: 'Failed to start voice conversation' }));
    }
  }, [initializeAgent]);

  // Prepare microphone and start recording one answer
  const startRecording = useCallback(async () => {
    try {
      if (!mediaStreamRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
      }

      // Prefer webm/opus if available, browser will choose best
      let options: MediaRecorderOptions | undefined;
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          options = { mimeType: 'audio/webm;codecs=opus' };
        } else if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/webm')) {
          options = { mimeType: 'audio/webm' };
        } else if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/mp4')) {
          options = { mimeType: 'audio/mp4' };
        } else {
          options = undefined;
        }
      }
      const recorder = new MediaRecorder(mediaStreamRef.current!, options);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        // handled in stopAndSubmit
      };
      mediaRecorderRef.current = recorder;
      recorder.start();

      setState(prev => ({ ...prev, isRecording: true, error: null, currentText: '' }));
    } catch (err) {
      console.error('Mic error', err);
      setState(prev => ({ ...prev, error: 'Microphone permission denied or unsupported' }));
    }
  }, []);

  // Stop recording, transcribe, and advance the conversation
  const stopAndSubmit = useCallback(async () => {
    if (!agentRef.current || !mediaRecorderRef.current) return;

    const recorder = mediaRecorderRef.current;
    if (recorder.state !== 'inactive') {
      recorder.stop();
    }

    setState(prev => ({ ...prev, isRecording: false, isProcessing: true }));

    // Wait a tick to ensure dataavailable fired
    await new Promise((r) => setTimeout(r, 50));

    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    chunksRef.current = [];

    try {
      const text = await agentRef.current.transcribeAudio(blob);
      if (text) {
        setState(prev => ({ ...prev, currentText: text }));
      }

      const result = await agentRef.current.ingestAnswer(text || '');
      if (!result.done) {
        setState(prev => ({ ...prev, currentQuestion: result.question || null, isProcessing: false }));
      } else {
        setState(prev => ({ ...prev, currentQuestion: null, isProcessing: false, isListening: false }));
      }
    } catch (err) {
      console.error('Submit answer error', err);
      setState(prev => ({ ...prev, error: 'Failed to process answer', isProcessing: false }));
    }
  }, []);

  const stopConversation = useCallback(async () => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
        mediaStreamRef.current = null;
      }
      agentRef.current?.stopListening();
    } finally {
      setState(prev => ({ ...prev, isListening: false, isRecording: false, isProcessing: false }));
    }
  }, []);

  return {
    ...state,
    initializeAgent,
    startConversation,
    startRecording,
    stopAndSubmit,
    stopConversation
  };
};
