import { useEffect } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
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
    isProcessing,
    initializeAgent,
    startListening,
    stopListening,
    currentText
  } = useOpenAIRealtimeVoice({
    onPromptGenerated,
    apiKey
  });

  useEffect(() => {
    initializeAgent();
    console.log('🎤 Voice Agent Ready! Click "Voice" to start, then describe your thumbnail idea');
  }, [initializeAgent]);

  const handleVoiceClick = async () => {
    if (isListening) {
      stopListening();
    } else {
      try {
        await startListening();
      } catch (err) {
        console.error('Voice agent error:', err);
      }
    }
  };

  const getButtonText = () => {
    if (isProcessing) return 'Processing...';
    if (isListening) return 'Listening...';
    return 'Voice';
  };

  return (
    <div className="flex flex-col space-y-2">
      <div className="flex items-center space-x-2">
        <Button
          variant={isListening ? "destructive" : "outline"}
          size="sm"
          onClick={handleVoiceClick}
          disabled={disabled || isProcessing}
          className="relative"
          title={isListening ? "Click to stop" : "Click to describe your thumbnail idea"}
        >
          {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : 
           isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          <span className="ml-2 hidden sm:inline">{getButtonText()}</span>
        </Button>

        {currentText && (
          <Badge variant="outline" className="max-w-xs truncate">
            "{currentText}"
          </Badge>
        )}
      </div>
      
      {!isListening && !currentText && (
        <div className="text-xs text-gray-500">
          🎤 Click "Voice" and say: "YouTube thumbnail for [your topic]"
        </div>
      )}
    </div>
  );
}
