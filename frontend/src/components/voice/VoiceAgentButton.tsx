import { useEffect } from 'react';
import { Mic, MicOff, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useVoiceAgent } from '@/hooks/useVoiceAgent';

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
    isInitialized,
    isListening,
    isProcessing,
    transcript,
    generatedPrompt,
    error,
    initializeAgent,
    startListening,
    stopListening,
    isSupported,
    isAvailable
  } = useVoiceAgent({
    onPromptGenerated,
    apiKey
  });

  useEffect(() => {
    if (generatedPrompt && generatedPrompt.trim()) {
      onPromptGenerated(generatedPrompt);
    }
  }, [generatedPrompt, onPromptGenerated]);


  const handleVoiceClick = async () => {
    if (!isInitialized) {
      try {
        await initializeAgent();
      } catch (err) {
        console.error('Failed to initialize voice agent:', err);
      }
      return;
    }

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

  const handleApplyPrompt = () => {
    // The prompt is already applied via onPromptGenerated callback
    // No additional action needed
  };

  const getButtonVariant = () => {
    if (!isSupported) return 'secondary';
    if (!isAvailable) return 'secondary';
    if (isListening) return 'destructive';
    if (generatedPrompt) return 'default';
    return 'outline';
  };

  const getButtonText = () => {
    if (!isSupported) return 'Not Supported';
    if (!isAvailable) return 'API Error';
    if (!isInitialized) return 'Initialize';
    if (isProcessing) return 'Processing...';
    if (isListening) return 'Listening...';
    if (generatedPrompt) return 'Use Prompt';
    return 'Voice';
  };

  const getButtonIcon = () => {
    if (isProcessing) return <Loader2 className="w-4 h-4 animate-spin" />;
    if (isListening) return <MicOff className="w-4 h-4" />;
    return <Mic className="w-4 h-4" />;
  };

  const tooltipContent = () => {
    if (!isSupported) return "Speech recognition not supported. Try Chrome/Edge";
    if (!isAvailable) return "OpenAI API unavailable or credits exhausted";
    if (!isInitialized) return "Click to initialize voice agent";
    if (isListening) return "Click to stop listening";
    if (generatedPrompt) return "Click to use generated prompt";
    return "Click to start voice input";
  };

  const isButtonDisabled = disabled || !isSupported || !isAvailable;

  return (
    <div className="flex items-center space-x-2">
      <div className="relative group">
        <Button
          variant={getButtonVariant()}
          size="sm"
          onClick={generatedPrompt ? handleApplyPrompt : handleVoiceClick}
          disabled={isButtonDisabled}
          className="relative"
          title={tooltipContent()}
        >
          {getButtonIcon()}
          <span className="ml-2 hidden sm:inline">{getButtonText()}</span>
          {isListening && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
          )}
        </Button>
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
          {tooltipContent()}
        </div>
      </div>

      {transcript && (
        <Badge variant="outline" className="max-w-xs truncate">
          "{transcript}"
        </Badge>
      )}

      {error && (
        <div className="flex items-center text-red-500 text-sm">
          <AlertCircle className="w-4 h-4 mr-1" />
          {error}
        </div>
      )}

      {generatedPrompt && (
        <div className="text-sm text-green-600 ml-2">
          ✓ Prompt ready
        </div>
      )}
    </div>
  );
}
