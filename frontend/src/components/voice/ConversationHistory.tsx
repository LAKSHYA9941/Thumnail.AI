import { useState, useEffect } from 'react';
import { Trash2, Download, Search, Clock, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import conversationStorage from '@/services/conversationStorage';
import type { StoredConversation } from '@/services/conversationStorage';

interface ConversationHistoryProps {
  onLoadConversation: (prompt: string) => void;
  className?: string;
}

export default function ConversationHistory({ onLoadConversation, className }: ConversationHistoryProps) {
  const [conversations, setConversations] = useState<StoredConversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, storageUsed: '0 KB' });

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = () => {
    try {
      const allConversations = conversationStorage.getAllConversations();
      const storageStats = conversationStorage.getStorageStats();
      
      setConversations(allConversations);
      setStats({
        total: storageStats.totalConversations,
        storageUsed: storageStats.storageUsed
      });
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      conv.metadata.title.toLowerCase().includes(query) ||
      conv.messages.some(msg => msg.content.toLowerCase().includes(query)) ||
      conv.metadata.voiceTranscript?.toLowerCase().includes(query) ||
      conv.metadata.generatedPrompt?.toLowerCase().includes(query)
    );
  });

  const handleDelete = async (sessionId: string) => {
    try {
      await conversationStorage.deleteConversation(sessionId);
      loadConversations();
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  const handleLoadPrompt = (conversation: StoredConversation) => {
    const assistantMessages = conversation.messages.filter((m: { role: string }) => m.role === 'assistant');
    const lastAssistantMessage = assistantMessages[assistantMessages.length - 1];
    if (lastAssistantMessage) {
      onLoadConversation(lastAssistantMessage.content);
    }
  };

  const handleExport = (conversation: StoredConversation) => {
    try {
      const data = conversationStorage.exportConversation(conversation.id);
      if (data) {
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `conversation-${conversation.id}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to export conversation:', error);
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MessageSquare className="w-5 h-5" />
            <span>Voice Conversations</span>
          </div>
          <Badge variant="secondary">
            {stats.total} conversations
          </Badge>
        </CardTitle>
        <p className="text-sm text-gray-500">
          Browse and reuse prompts from previous voice sessions
        </p>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Stats */}
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>{filteredConversations.length} results</span>
            <span>{stats.storageUsed} used</span>
          </div>

          {/* Conversations List */}
          <ScrollArea className="h-96">
            {filteredConversations.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {conversations.length === 0 
                  ? "No voice conversations yet. Start by clicking the voice button in the chat!"
                  : "No conversations match your search."
                }
              </div>
            ) : (
              <div className="space-y-3">
                {filteredConversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">
                          {conversation.metadata.title}
                        </h4>
                        <div className="flex items-center space-x-2 text-xs text-gray-500 mt-1">
                          <Clock className="w-3 h-3" />
                          <span>{formatDate(conversation.metadata.createdAt)}</span>
                          {conversation.metadata.sessionDuration && (
                            <>
                              <span>•</span>
                              <span>{formatDuration(conversation.metadata.sessionDuration)}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleExport(conversation)}
                          title="Export conversation"
                        >
                          <Download className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(conversation.id)}
                          title="Delete conversation"
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>

                    {conversation.metadata.voiceTranscript && (
                      <div className="mb-2">
                        <p className="text-xs text-gray-600">
                          <strong>Voice:</strong> "{conversation.metadata.voiceTranscript}"
                        </p>
                      </div>
                    )}

                    {conversation.metadata.generatedPrompt && (
                      <div className="mb-3">
                        <p className="text-xs text-gray-600">
                          <strong>Prompt:</strong> {conversation.metadata.generatedPrompt}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        {conversation.messages.length} messages
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleLoadPrompt(conversation)}
                        className="text-xs"
                      >
                        Use Prompt
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}
