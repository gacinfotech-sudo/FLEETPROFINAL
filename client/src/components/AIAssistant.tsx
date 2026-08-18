// ============================================================================
// AI ASSISTANT COMPONENT - Interactive chat UI
// Phase 5: Milestone 1 - AI & ML Enhancements
// ============================================================================

import React, { useState, useRef, useEffect } from 'react';
import './AIAssistant.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sentiment?: string;
}

interface AIAssistantProps {
  tenantId: string;
  userId: string;
  onClose?: () => void;
}

/**
 * AIAssistant: Interactive chat component with AI responses
 * - Multi-turn conversations
 * - Real-time message display
 * - Sentiment-aware responses
 * - Support escalation
 * - Conversation history
 */
export const AIAssistant: React.FC<AIAssistantProps> = ({
  tenantId,
  userId,
  onClose,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isEscalated, setIsEscalated] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [conversationId, setConversationId] = useState<string>('');

  // Initialize conversation on mount
  useEffect(() => {
    initializeConversation();
  }, [tenantId, userId]);

  // Auto-scroll to latest message
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const initializeConversation = async () => {
    try {
      // In production, would call API to create conversation
      const newConvId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setConversationId(newConvId);

      // Add welcome message
      const welcomeMessage: Message = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: 'Hello! I\'m your AI Assistant. How can I help you today?',
        timestamp: new Date(),
      };

      setMessages([welcomeMessage]);
    } catch (error) {
      console.error('Failed to initialize conversation:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // In production, would call API to get AI response
      const assistantMessage = await generateAIResponse(inputValue);
      setMessages(prev => [...prev, assistantMessage]);

      // Check if escalation needed
      if (assistantMessage.content.includes('support')) {
        setIsEscalated(true);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again or contact support.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const generateAIResponse = async (userInput: string): Promise<Message> => {
    // Simulate API call with generated response
    return new Promise(resolve => {
      setTimeout(() => {
        let response = '';

        // Simple response generation based on keywords
        const lowerInput = userInput.toLowerCase();

        if (lowerInput.includes('password') || lowerInput.includes('login')) {
          response = 'To reset your password, click "Forgot Password" on the login page and follow the email instructions. Is there anything else I can help you with?';
        } else if (lowerInput.includes('price') || lowerInput.includes('cost')) {
          response = 'For pricing information, visit our pricing page or contact our sales team. Would you like me to connect you with a sales representative?';
        } else if (lowerInput.includes('error') || lowerInput.includes('problem')) {
          response = 'I can help you troubleshoot! Can you provide more details about the error you\'re experiencing?';
        } else if (lowerInput.includes('feature')) {
          response = 'We have many great features! Which specific feature are you interested in learning more about?';
        } else if (
          lowerInput.includes('frustrated') ||
          lowerInput.includes('angry') ||
          lowerInput.includes('upset')
        ) {
          response = 'I understand your frustration. Let me escalate this to our support team for priority handling. A specialist will be with you shortly.';
        } else {
          response = 'Thank you for your message. I\'m here to help! Could you provide more details about what you need?';
        }

        const message: Message = {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: response,
          timestamp: new Date(),
        };

        resolve(message);
      }, 800);
    });
  };

  const handleEscalate = () => {
    const escalationMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'assistant',
      content: 'You\'ll be connected with a support specialist shortly. Thank you for your patience!',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, escalationMessage]);
    setIsEscalated(true);

    // In production, would initiate escalation flow
    setTimeout(() => {
      if (onClose) {
        onClose();
      }
    }, 2000);
  };

  const handleQuickAction = (action: string) => {
    setInputValue(action);
  };

  return (
    <div className="ai-assistant-container">
      <div className="ai-assistant-header">
        <div className="ai-assistant-title">
          <div className="ai-avatar">AI</div>
          <div>
            <h3>AI Assistant</h3>
            <p className={isEscalated ? 'escalated' : 'online'}>
              {isEscalated ? 'Escalated to Support' : 'Online'}
            </p>
          </div>
        </div>
        {onClose && (
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        )}
      </div>

      <div className="ai-assistant-messages">
        {messages.map(message => (
          <div key={message.id} className={`message ${message.role}`}>
            <div className="message-content">
              <p>{message.content}</p>
              <span className="message-time">
                {message.timestamp.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="message assistant">
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {isEscalated ? (
        <div className="ai-assistant-escalated">
          <div className="escalation-notice">
            <p>Your issue has been escalated to our support team.</p>
            <p>Average response time: &lt; 2 minutes</p>
          </div>
        </div>
      ) : (
        <>
          {messages.length <= 1 && (
            <div className="ai-assistant-suggestions">
              <p>Quick actions:</p>
              <div className="suggestion-buttons">
                <button
                  className="suggestion-btn"
                  onClick={() => handleQuickAction('How do I reset my password?')}
                >
                  🔐 Reset Password
                </button>
                <button
                  className="suggestion-btn"
                  onClick={() => handleQuickAction('Tell me about your pricing')}
                >
                  💰 Pricing
                </button>
                <button
                  className="suggestion-btn"
                  onClick={() => handleQuickAction('How do I use the API?')}
                >
                  🔌 API Help
                </button>
                <button
                  className="suggestion-btn"
                  onClick={() => handleQuickAction('I need help with a problem')}
                >
                  🆘 Troubleshooting
                </button>
              </div>
            </div>
          )}

          <div className="ai-assistant-input-area">
            <div className="input-wrapper">
              <input
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyPress={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Type your message..."
                disabled={isLoading || isEscalated}
                className="ai-input"
              />
              <button
                onClick={handleSendMessage}
                disabled={isLoading || !inputValue.trim() || isEscalated}
                className="send-btn"
              >
                {isLoading ? '...' : '→'}
              </button>
            </div>

            {messages.length > 2 && !isEscalated && (
              <button className="escalate-btn" onClick={handleEscalate}>
                Need human support? Connect with an agent
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AIAssistant;
