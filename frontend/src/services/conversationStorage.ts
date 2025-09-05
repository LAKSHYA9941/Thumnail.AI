import type { ConversationMessage } from './voiceAgent';

interface StoredConversation {
  id: string;
  messages: ConversationMessage[];
  metadata: {
    title: string;
    createdAt: Date;
    updatedAt: Date;
    sessionDuration?: number;
    voiceTranscript?: string;
    generatedPrompt?: string;
  };
}

class ConversationStorageService {
  private readonly STORAGE_KEY = 'voice_conversations';
  private readonly MAX_CONVERSATIONS = 50;

  constructor() {
    this.initializeStorage();
  }

  private initializeStorage() {
    if (!localStorage.getItem(this.STORAGE_KEY)) {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify([]));
    }
  }

  async saveConversation(
    sessionId: string,
    messages: ConversationMessage[],
    metadata: Partial<StoredConversation['metadata']> = {}
  ): Promise<string> {
    try {
      const conversations = this.getAllConversations();
      
      // Generate title from first user message or use provided
      const firstUserMessage = messages.find(m => m.role === 'user');
      const title = metadata.title || 
        (firstUserMessage ? this.generateTitle(firstUserMessage.content) : 'Voice Session');

      const conversation: StoredConversation = {
        id: sessionId,
        messages,
        metadata: {
          title,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...metadata
        }
      };

      // Add new conversation
      conversations.unshift(conversation);

      // Keep only the most recent conversations
      if (conversations.length > this.MAX_CONVERSATIONS) {
        conversations.splice(this.MAX_CONVERSATIONS);
      }

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(conversations));
      return sessionId;
    } catch (error) {
      console.error('Failed to save conversation:', error);
      throw error;
    }
  }

  getAllConversations(): StoredConversation[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return [];

      const conversations = JSON.parse(stored) as StoredConversation[];
      // Ensure dates are properly parsed
      return conversations.map(conv => ({
        ...conv,
        messages: conv.messages.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        })),
        metadata: {
          ...conv.metadata,
          createdAt: new Date(conv.metadata.createdAt),
          updatedAt: new Date(conv.metadata.updatedAt)
        }
      }));
    } catch (error) {
      console.error('Failed to load conversations:', error);
      return [];
    }
  }

  getConversation(sessionId: string): StoredConversation | null {
    const conversations = this.getAllConversations();
    return conversations.find(conv => conv.id === sessionId) || null;
  }

  deleteConversation(sessionId: string): boolean {
    try {
      const conversations = this.getAllConversations();
      const filtered = conversations.filter(conv => conv.id !== sessionId);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
      return true;
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      return false;
    }
  }

  searchConversations(query: string): StoredConversation[] {
    const conversations = this.getAllConversations();
    const lowerQuery = query.toLowerCase();

    return conversations.filter(conv => 
      conv.metadata.title.toLowerCase().includes(lowerQuery) ||
      conv.messages.some(msg => msg.content.toLowerCase().includes(lowerQuery)) ||
      conv.metadata.voiceTranscript?.toLowerCase().includes(lowerQuery) ||
      conv.metadata.generatedPrompt?.toLowerCase().includes(lowerQuery)
    );
  }

  getRecentConversations(limit: number = 10): StoredConversation[] {
    return this.getAllConversations().slice(0, limit);
  }

  async updateConversationMetadata(
    sessionId: string,
    metadata: Partial<StoredConversation['metadata']>
  ): Promise<boolean> {
    try {
      const conversations = this.getAllConversations();
      const index = conversations.findIndex(conv => conv.id === sessionId);
      
      if (index === -1) return false;

      conversations[index].metadata = {
        ...conversations[index].metadata,
        ...metadata,
        updatedAt: new Date()
      };

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(conversations));
      return true;
    } catch (error) {
      console.error('Failed to update conversation metadata:', error);
      return false;
    }
  }

  private generateTitle(message: string): string {
    // Simple title generation from message
    const words = message.split(' ');
    const titleWords = words.slice(0, 4).join(' ');
    return titleWords.length > 30 ? titleWords.substring(0, 30) + '...' : titleWords;
  }

  exportConversation(sessionId: string): string | null {
    const conversation = this.getConversation(sessionId);
    if (!conversation) return null;

    return JSON.stringify(conversation, null, 2);
  }

  importConversation(jsonData: string): boolean {
    try {
      const conversation = JSON.parse(jsonData) as StoredConversation;
      
      // Validate structure
      if (!conversation.id || !conversation.messages || !conversation.metadata) {
        return false;
      }

      const conversations = this.getAllConversations();
      
      // Check if conversation already exists
      const existingIndex = conversations.findIndex(conv => conv.id === conversation.id);
      if (existingIndex !== -1) {
        conversations[existingIndex] = conversation;
      } else {
        conversations.unshift(conversation);
      }

      // Ensure we don't exceed max conversations
      if (conversations.length > this.MAX_CONVERSATIONS) {
        conversations.splice(this.MAX_CONVERSATIONS);
      }

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(conversations));
      return true;
    } catch (error) {
      console.error('Failed to import conversation:', error);
      return false;
    }
  }

  getStorageStats(): { totalConversations: number; totalMessages: number; storageUsed: string } {
    const conversations = this.getAllConversations();
    const totalMessages = conversations.reduce((sum, conv) => sum + conv.messages.length, 0);
    
    // Estimate storage used (rough calculation)
    const storageUsed = JSON.stringify(conversations).length;
    const storageUsedKB = (storageUsed / 1024).toFixed(2);

    return {
      totalConversations: conversations.length,
      totalMessages,
      storageUsed: `${storageUsedKB} KB`
    };
  }

  clearAllConversations(): boolean {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify([]));
      return true;
    } catch (error) {
      console.error('Failed to clear conversations:', error);
      return false;
    }
  }
}

// Singleton instance
const conversationStorage = new ConversationStorageService();
export default conversationStorage;
export type { StoredConversation };
