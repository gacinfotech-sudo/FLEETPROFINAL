// ============================================================================
// AI ASSISTANT SERVICE - Multi-turn conversation engine
// Phase 5: Milestone 1 - AI & ML Enhancements
// ============================================================================

import {
  Conversation,
  ConversationMessage,
  ConversationIntentType,
  SentimentType,
  AIAssistantContext,
} from '../types/ai-ml.types';

/**
 * AIAssistantService: Multi-turn conversation engine with NLP capabilities
 * - Context awareness (user, tenant, conversation history)
 * - Intent detection and classification
 * - Response generation from templates + LLM
 * - Sentiment analysis and frustration detection
 * - Handoff to human support when needed
 */
export class AIAssistantService {
  private conversationStore: Map<string, Conversation> = new Map();
  private messageHistory: ConversationMessage[] = [];
  private faqDatabase: Map<string, string> = this.initializeFAQs();
  private troubleshootingGuides: Map<string, string[]> = this.initializeTroubleshooting();

  constructor() {
    this.initializeService();
  }

  // ========================================================================
  // INITIALIZATION
  // ========================================================================

  private initializeService(): void {
    console.log('[AIAssistant] Service initialized');
  }

  private initializeFAQs(): Map<string, string> {
    return new Map([
      ['password_reset', 'To reset your password, click "Forgot Password" on the login page and follow the email instructions.'],
      ['subscription_types', 'We offer three subscription tiers: Starter, Professional, and Enterprise.'],
      ['billing_cycle', 'Billing occurs monthly on your account anniversary date.'],
      ['data_export', 'You can export your data from Settings > Data Export in CSV or JSON format.'],
      ['api_documentation', 'Visit our API docs at https://docs.api.example.com'],
      ['account_upgrade', 'Upgrade your account from Settings > Billing > Change Plan.'],
      ['team_collaboration', 'Invite team members via Settings > Team > Invite User with their email.'],
      ['data_security', 'All data is encrypted at rest and in transit using AES-256 encryption.'],
      ['two_factor_auth', 'Enable 2FA from Settings > Security for additional account protection.'],
      ['payment_methods', 'We accept credit cards, debit cards, and wire transfers.'],
    ]);
  }

  private initializeTroubleshooting(): Map<string, string[]> {
    return new Map([
      ['login_issues', [
        'Clear browser cache and cookies',
        'Try logging in with a different browser',
        'Reset your password',
        'Contact support if issues persist',
      ]],
      ['slow_performance', [
        'Check your internet connection speed',
        'Disable browser extensions',
        'Try using a different browser',
        'Update to the latest app version',
      ]],
      ['data_sync_problems', [
        'Ensure you have a stable internet connection',
        'Log out and log back in',
        'Clear app cache',
        'Reinstall the app if on mobile',
      ]],
      ['payment_declined', [
        'Verify card details are correct',
        'Check card expiration date',
        'Contact your bank to authorize the transaction',
        'Try a different payment method',
      ]],
      ['integration_failures', [
        'Verify API key is correct',
        'Check webhook URL is accessible',
        'Review integration logs for errors',
        'Contact support with error logs',
      ]],
    ]);
  }

  // ========================================================================
  // CONVERSATION MANAGEMENT
  // ========================================================================

  /**
   * Create a new conversation
   */
  async createConversation(
    tenantId: string,
    userId: string,
    initialMessage?: string
  ): Promise<Conversation> {
    const conversationId = this.generateConversationId();
    const firstMessage: ConversationMessage | null = initialMessage
      ? {
          id: this.generateMessageId(),
          conversationId,
          role: 'user',
          content: initialMessage,
          timestamp: new Date(),
          sentiment: await this.analyzeSentiment(initialMessage),
        }
      : null;

    const conversation: Conversation = {
      id: conversationId,
      tenantId,
      userId,
      messages: firstMessage ? [firstMessage] : [],
      intent: ConversationIntentType.OTHER,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastMessageAt: new Date(),
    };

    this.conversationStore.set(conversationId, conversation);
    return conversation;
  }

  /**
   * Get conversation by ID
   */
  async getConversation(conversationId: string): Promise<Conversation | null> {
    return this.conversationStore.get(conversationId) || null;
  }

  /**
   * Add message to conversation and generate response
   */
  async addMessageAndRespond(
    conversationId: string,
    userMessage: string
  ): Promise<{ userMessage: ConversationMessage; assistantMessage: ConversationMessage }> {
    const conversation = await this.getConversation(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    // Create user message
    const userMsg: ConversationMessage = {
      id: this.generateMessageId(),
      conversationId,
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
      sentiment: await this.analyzeSentiment(userMessage),
    };

    conversation.messages.push(userMsg);

    // Detect intent
    const intent = await this.detectIntent(userMessage);
    conversation.intent = intent;

    // Check if escalation needed
    if (userMsg.sentiment === SentimentType.FRUSTRATED || userMsg.sentiment === SentimentType.URGENT) {
      conversation.status = 'escalated';
      conversation.escalatedToSupport = true;
      conversation.escalationReason = 'User frustration or urgency detected';
    }

    // Generate assistant response
    let assistantContent = '';
    if (conversation.escalatedToSupport) {
      assistantContent =
        'I understand your concern. Let me connect you with our support team who can help you better. A representative will be with you shortly.';
    } else {
      assistantContent = await this.generateResponse(userMessage, intent, conversation);
    }

    const assistantMsg: ConversationMessage = {
      id: this.generateMessageId(),
      conversationId,
      role: 'assistant',
      content: assistantContent,
      timestamp: new Date(),
    };

    conversation.messages.push(assistantMsg);
    conversation.updatedAt = new Date();
    conversation.lastMessageAt = new Date();

    return { userMessage: userMsg, assistantMessage: assistantMsg };
  }

  // ========================================================================
  // INTENT DETECTION
  // ========================================================================

  /**
   * Detect user intent from message
   */
  private async detectIntent(message: string): Promise<ConversationIntentType> {
    const lowerMessage = message.toLowerCase();

    if (
      lowerMessage.includes('password') ||
      lowerMessage.includes('login') ||
      lowerMessage.includes('account access')
    ) {
      return ConversationIntentType.ACCOUNT_MANAGEMENT;
    }
    if (lowerMessage.includes('how') || lowerMessage.includes('what') || lowerMessage.includes('why')) {
      return ConversationIntentType.FAQ;
    }
    if (lowerMessage.includes('error') || lowerMessage.includes('problem') || lowerMessage.includes('not working')) {
      return ConversationIntentType.TROUBLESHOOTING;
    }
    if (lowerMessage.includes('price') || lowerMessage.includes('cost') || lowerMessage.includes('charge')) {
      return ConversationIntentType.BILLING;
    }
    if (
      lowerMessage.includes('feature') ||
      lowerMessage.includes('capability') ||
      lowerMessage.includes('can i')
    ) {
      return ConversationIntentType.PRODUCT_INQUIRY;
    }
    if (lowerMessage.includes('complaint') || lowerMessage.includes('issue') || lowerMessage.includes('bug')) {
      return ConversationIntentType.COMPLAINT;
    }

    return ConversationIntentType.OTHER;
  }

  // ========================================================================
  // RESPONSE GENERATION
  // ========================================================================

  /**
   * Generate response based on intent and context
   */
  private async generateResponse(
    userMessage: string,
    intent: ConversationIntentType,
    conversation: Conversation
  ): Promise<string> {
    switch (intent) {
      case ConversationIntentType.FAQ:
        return this.generateFAQResponse(userMessage);

      case ConversationIntentType.TROUBLESHOOTING:
        return this.generateTroubleshootingResponse(userMessage);

      case ConversationIntentType.ACCOUNT_MANAGEMENT:
        return this.generateAccountResponse(userMessage);

      case ConversationIntentType.BILLING:
        return this.generateBillingResponse(userMessage);

      case ConversationIntentType.PRODUCT_INQUIRY:
        return this.generateProductResponse(userMessage);

      case ConversationIntentType.COMPLAINT:
        return (
          "I understand your concern. Let me escalate this to our support team for priority handling. They'll reach out to you shortly."
        );

      default:
        return "I'm not sure about that. Could you provide more details? Or I can connect you with a support specialist.";
    }
  }

  private generateFAQResponse(message: string): string {
    for (const [key, answer] of this.faqDatabase) {
      if (message.toLowerCase().includes(key.replace('_', ' '))) {
        return answer;
      }
    }
    return 'I found several articles that might help. Could you be more specific about your question?';
  }

  private generateTroubleshootingResponse(message: string): string {
    for (const [issue, steps] of this.troubleshootingGuides) {
      if (message.toLowerCase().includes(issue.replace('_', ' '))) {
        return `Here are the steps to resolve this:\n${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nLet me know if this helps!`;
      }
    }
    return 'Let me help you troubleshoot this issue. Can you describe the problem in more detail?';
  }

  private generateAccountResponse(message: string): string {
    return 'For account management tasks, you can access Settings > Account from your dashboard. If you need more help, I can connect you with support.';
  }

  private generateBillingResponse(message: string): string {
    return 'For billing inquiries, visit Settings > Billing. You can view invoices, update payment methods, and manage your subscription there.';
  }

  private generateProductResponse(message: string): string {
    return "We have many powerful features! Could you tell me what specific capability you're looking for? I can guide you to the right feature.";
  }

  // ========================================================================
  // SENTIMENT ANALYSIS
  // ========================================================================

  /**
   * Analyze sentiment of message
   */
  private async analyzeSentiment(message: string): Promise<SentimentType> {
    const lowerMessage = message.toLowerCase();

    // Urgent indicators
    if (
      lowerMessage.includes('urgent') ||
      lowerMessage.includes('asap') ||
      lowerMessage.includes('emergency') ||
      lowerMessage.includes('critical')
    ) {
      return SentimentType.URGENT;
    }

    // Frustration indicators
    const frustrationWords = [
      'frustrat',
      'angry',
      'mad',
      'upset',
      'terrible',
      'awful',
      'hate',
      'waste',
      'useless',
    ];
    if (frustrationWords.some(word => lowerMessage.includes(word))) {
      return SentimentType.FRUSTRATED;
    }

    // Positive indicators
    const positiveWords = ['great', 'excellent', 'love', 'thank', 'appreciate', 'perfect', 'amazing'];
    if (positiveWords.some(word => lowerMessage.includes(word))) {
      return SentimentType.POSITIVE;
    }

    // Negative indicators
    const negativeWords = ['bad', 'poor', 'problem', 'issue', 'error', 'fail', 'slow'];
    if (negativeWords.some(word => lowerMessage.includes(word))) {
      return SentimentType.NEGATIVE;
    }

    return SentimentType.NEUTRAL;
  }

  // ========================================================================
  // CONTEXT MANAGEMENT
  // ========================================================================

  /**
   * Build context for conversation
   */
  async buildContext(conversation: Conversation, userProfile?: any): Promise<AIAssistantContext> {
    return {
      userId: conversation.userId,
      tenantId: conversation.tenantId,
      conversationHistory: conversation.messages,
      userProfile,
      conversationMetadata: {
        intent: conversation.intent,
        status: conversation.status,
        messageCount: conversation.messages.length,
      },
    };
  }

  // ========================================================================
  // CONVERSATION LIFECYCLE
  // ========================================================================

  /**
   * Close conversation
   */
  async closeConversation(conversationId: string): Promise<void> {
    const conversation = await this.getConversation(conversationId);
    if (conversation) {
      conversation.status = 'closed';
      conversation.updatedAt = new Date();
    }
  }

  /**
   * Get conversation history for user
   */
  async getConversationHistory(tenantId: string, userId: string): Promise<Conversation[]> {
    return Array.from(this.conversationStore.values()).filter(
      c => c.tenantId === tenantId && c.userId === userId
    );
  }

  // ========================================================================
  // HELPER METHODS
  // ========================================================================

  private generateConversationId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const aiAssistantService = new AIAssistantService();
