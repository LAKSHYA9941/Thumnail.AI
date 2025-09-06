import { useEffect } from 'react';
import { Mic, MicOff, Loader2, Play, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useOpenAIRealtimeVoice } from '@/hooks/useOpenAIRealtimeVoice';

interface VoiceAgentButtonProps {
  onPromptGenerated: (prompt: string) => void;
  apiKey: string;
  disabled?: boolean;
}

export default function VoiceAgentButton({
  onPromptGenerated,
  apiKey,
  disabled = false
}: VoiceAgentButtonProps) {
  const {
    isListening,
    isRecording,
    isProcessing,
    initializeAgent,
    startConversation,
    startRecording,
    stopAndSubmit,
    stopConversation,
    currentText,
    currentQuestion,
    status
  } = useOpenAIRealtimeVoice({
    onPromptGenerated,
    apiKey
  });

  useEffect(() => {
    initializeAgent();
    console.log('🎤 Voice Agent Ready! Click "Voice" to start, then describe your thumbnail idea');
  }, [initializeAgent]);

  return (
    <div className="flex flex-col space-y-2 w-full">
      <div className="flex items-center space-x-2">
        {!isListening ? (
          <Button
            variant="outline"
            size="sm"
            onClick={startConversation}
            disabled={disabled || isProcessing}
            title="Start a guided voice chat to craft your prompt"
          >
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            <span className="ml-2 hidden sm:inline">Start Voice</span>
          </Button>
        ) : (
          <>
            {!isRecording ? (
              <Button
                variant="default"
                size="sm"
                onClick={startRecording}
                disabled={disabled || isProcessing}
                title="Start recording your answer"
              >
                <Mic className="w-4 h-4" />
                <span className="ml-2 hidden sm:inline">Record</span>
              </Button>
            ) : (
              <Button
                variant="destructive"
                size="sm"
                onClick={stopAndSubmit}
                disabled={disabled}
                title="Stop recording and submit answer"
              >
                <MicOff className="w-4 h-4" />
                <span className="ml-2 hidden sm:inline">Stop & Submit</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={stopConversation}
              disabled={disabled || isProcessing}
              title="End the voice conversation"
            >
              <Square className="w-4 h-4" />
              <span className="ml-2 hidden sm:inline">End</span>
            </Button>
          </>
        )}

        {status && (
          <Badge variant="outline" className="truncate max-w-[180px]">{status}</Badge>
        )}
      </div>

      {isListening && (
        <div className="text-xs text-gray-500 text-left">
          {currentQuestion ? (
            <>
              <span className="font-medium text-gray-300">Assistant asks:</span> {currentQuestion}
            </>
          ) : (
            <span>Answer the question and press "Stop & Submit".</span>
          )}
        </div>
      )}

      {currentText && (
        <div className="text-[11px] text-gray-400 ">You said: "{currentText}"</div>
      )}
    </div>
  );
}
