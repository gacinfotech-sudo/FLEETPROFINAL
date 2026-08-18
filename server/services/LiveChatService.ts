/**
 * LIVE CHAT SERVICE
 * Real-time chat with WebSocket support, routing, and transcripts
 */

import mongoose from 'mongoose';

export interface IChatMessage {
  tenantId: string | mongoose.Types.ObjectId;
  conversationId: string;
  senderId: string;
  senderType: 'customer' | 'agent' | 'system';
  senderName: string;
  message: string;
  attachments: string[];
  sentiment?: 'positive' | 'neutral' | 'negative';
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface IConversation {
  tenantId: string | mongoose.Types.ObjectId;
  conversationId: string;
  customerId?: mongoose.Types.ObjectId;
  customerName: string;
  customerPhone: string;
  assignedAgentId?: string;
  assignedAgentName?: string;
  status: 'active' | 'waiting' | 'transferred' | 'closed';
  queuePosition?: number;
  messageCount: number;
  firstMessageAt: Date;
  lastMessageAt: Date;
  closedAt?: Date;
  rating?: number;
  feedback?: string;
  canvasState?: Record<string, any>;
  createdAt: Date;
}

const MessageSchema = new mongoose.Schema<IChatMessage>({
  tenantId: { type: mongoose.Schema.Types.Mixed, required: true, index: true },
  conversationId: { type: String, required: true, index: true },
  senderId: { type: String, required: true },
  senderType: { type: String, enum: ['customer', 'agent', 'system'], required: true },
  senderName: { type: String, required: true },
  message: { type: String, required: true },
  attachments: { type: [String], default: [] },
  sentiment: { type: String, enum: ['positive', 'neutral', 'negative'] },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now, index: true },
});

const ConversationSchema = new mongoose.Schema<IConversation>({
  tenantId: { type: mongoose.Schema.Types.Mixed, required: true, index: true },
  conversationId: { type: String, required: true, unique: true },
  customerId: { type: mongoose.Schema.Types.ObjectId },
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  assignedAgentId: { type: String },
  assignedAgentName: { type: String },
  status: { type: String, enum: ['active', 'waiting', 'transferred', 'closed'], default: 'waiting' },
  queuePosition: { type: Number },
  messageCount: { type: Number, default: 0 },
  firstMessageAt: { type: Date, default: Date.now },
  lastMessageAt: { type: Date, default: Date.now },
  closedAt: { type: Date },
  rating: { type: Number, min: 1, max: 5 },
  feedback: { type: String },
  canvasState: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now },
});

ConversationSchema.index({ tenantId: 1, status: 1 });
ConversationSchema.index({ tenantId: 1, assignedAgentId: 1 });

export const ChatMessage = mongoose.model<IChatMessage>('LiveChatMessage', MessageSchema);
export const Conversation = mongoose.model<IConversation>('LiveChatConversation', ConversationSchema);

export class LiveChatService {
  /**
   * Start a new chat conversation
   */
  static async startConversation(input: Omit<IConversation, 'createdAt' | 'conversationId' | 'messageCount'>): Promise<IConversation> {
    try {
      const conversationId = `CHT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const conversation = new Conversation({
        ...input,
        conversationId,
        messageCount: 0,
        status: 'waiting',
      });
      await conversation.save();
      return conversation.toObject();
    } catch (error) {
      console.error('Error starting conversation:', error);
      throw new Error('Failed to start conversation');
    }
  }

  /**
   * Add message to conversation
   */
  static async addMessage(conversationId: string, message: IChatMessage): Promise<IChatMessage> {
    try {
      const chatMessage = new ChatMessage(message);
      await chatMessage.save();

      await Conversation.findOneAndUpdate(
        { conversationId },
        {
          $inc: { messageCount: 1 },
          lastMessageAt: new Date(),
        }
      );

      return chatMessage.toObject();
    } catch (error) {
      console.error('Error adding message:', error);
      throw new Error('Failed to add message');
    }
  }

  /**
   * Route chat to available agent
   */
  static async routeToAgent(conversationId: string, agentId: string, agentName: string): Promise<IConversation | null> {
    try {
      const updated = await Conversation.findOneAndUpdate(
        { conversationId },
        {
          assignedAgentId: agentId,
          assignedAgentName: agentName,
          status: 'active',
          queuePosition: undefined,
        },
        { new: true }
      );
      return updated ? updated.toObject() : null;
    } catch (error) {
      console.error('Error routing chat:', error);
      throw new Error('Failed to route chat');
    }
  }

  /**
   * Get chat history
   */
  static async getChatHistory(conversationId: string, limit: number = 100): Promise<IChatMessage[]> {
    try {
      const messages = await ChatMessage.find({ conversationId })
        .sort({ createdAt: -1 })
        .limit(limit);

      return messages.map(m => m.toObject());
    } catch (error) {
      console.error('Error fetching chat history:', error);
      throw new Error('Failed to fetch chat history');
    }
  }

  /**
   * Close chat conversation
   */
  static async closeConversation(conversationId: string, rating?: number, feedback?: string): Promise<IConversation | null> {
    try {
      const updated = await Conversation.findOneAndUpdate(
        { conversationId },
        {
          status: 'closed',
          closedAt: new Date(),
          rating,
          feedback,
        },
        { new: true }
      );
      return updated ? updated.toObject() : null;
    } catch (error) {
      console.error('Error closing conversation:', error);
      throw new Error('Failed to close conversation');
    }
  }

  /**
   * Get conversation details
   */
  static async getConversation(conversationId: string): Promise<IConversation | null> {
    try {
      const conversation = await Conversation.findOne({ conversationId });
      return conversation ? conversation.toObject() : null;
    } catch (error) {
      console.error('Error fetching conversation:', error);
      throw new Error('Failed to fetch conversation');
    }
  }

  /**
   * Get active conversations for agent
   */
  static async getAgentConversations(tenantId: string, agentId: string): Promise<IConversation[]> {
    try {
      const conversations = await Conversation.find({
        tenantId,
        assignedAgentId: agentId,
        status: { $in: ['active', 'waiting'] },
      }).sort({ lastMessageAt: -1 });

      return conversations.map(c => c.toObject());
    } catch (error) {
      console.error('Error fetching agent conversations:', error);
      throw new Error('Failed to fetch conversations');
    }
  }

  /**
   * Get chat queue (waiting conversations)
   */
  static async getChatQueue(tenantId: string): Promise<IConversation[]> {
    try {
      const conversations = await Conversation.find({
        tenantId,
        status: 'waiting',
      }).sort({ createdAt: 1 });

      return conversations.map(c => c.toObject());
    } catch (error) {
      console.error('Error fetching chat queue:', error);
      throw new Error('Failed to fetch chat queue');
    }
  }

  /**
   * Export chat transcript
   */
  static async exportTranscript(conversationId: string, format: 'text' | 'pdf' = 'text'): Promise<string> {
    try {
      const conversation = await Conversation.findOne({ conversationId });
      const messages = await ChatMessage.find({ conversationId }).sort({ createdAt: 1 });

      if (!conversation) throw new Error('Conversation not found');

      let transcript = `Chat Transcript\n`;
      transcript += `Customer: ${conversation.customerName} (${conversation.customerPhone})\n`;
      transcript += `Date: ${conversation.createdAt.toISOString()}\n`;
      transcript += `Duration: ${conversation.closedAt ? (conversation.closedAt.getTime() - conversation.createdAt.getTime()) / 1000 + 's' : 'Ongoing'}\n\n`;

      messages.forEach(msg => {
        const time = msg.createdAt.toISOString();
        transcript += `[${time}] ${msg.senderName} (${msg.senderType}): ${msg.message}\n`;
      });

      return transcript;
    } catch (error) {
      console.error('Error exporting transcript:', error);
      throw new Error('Failed to export transcript');
    }
  }

  /**
   * Analyze chat sentiment (simple implementation)
   */
  static async analyzeSentiment(message: string): Promise<'positive' | 'neutral' | 'negative'> {
    const positiveKeywords = ['good', 'excellent', 'great', 'thank', 'appreciate', 'solved', 'fixed'];
    const negativeKeywords = ['bad', 'terrible', 'hate', 'broken', 'problem', 'issue', 'angry', 'frustrated'];

    const messageLower = message.toLowerCase();
    let posCount = 0;
    let negCount = 0;

    positiveKeywords.forEach(kw => {
      if (messageLower.includes(kw)) posCount++;
    });

    negativeKeywords.forEach(kw => {
      if (messageLower.includes(kw)) negCount++;
    });

    if (posCount > negCount) return 'positive';
    if (negCount > posCount) return 'negative';
    return 'neutral';
  }
}
