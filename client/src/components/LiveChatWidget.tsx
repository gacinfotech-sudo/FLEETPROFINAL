/**
 * LIVE CHAT WIDGET
 * Real-time chat interface for customers
 */

import React, { useState, useEffect, useRef } from 'react';

interface Message {
  senderId: string;
  senderType: 'customer' | 'agent' | 'system';
  senderName: string;
  message: string;
  createdAt: Date;
}

interface Conversation {
  conversationId: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  assignedAgentName?: string;
  status: 'active' | 'waiting' | 'transferred' | 'closed';
  messageCount: number;
}

export const LiveChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [showForm, setShowForm] = useState(true);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const startConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/support/chat/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          customerPhone,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setConversation(data);
        setShowForm(false);
        setMessages([]);

        // Add welcome message
        setMessages([
          {
            senderId: 'system',
            senderType: 'system',
            senderName: 'Support Team',
            message: 'Welcome! How can we help you today?',
            createdAt: new Date(),
          },
        ]);
      }
    } catch (error) {
      console.error('Error starting conversation:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !conversation) return;

    const newMessage: Message = {
      senderId: 'customer',
      senderType: 'customer',
      senderName: customerName,
      message: inputValue,
      createdAt: new Date(),
    };

    setMessages([...messages, newMessage]);
    setInputValue('');

    try {
      await fetch('/api/support/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: conversation.conversationId,
          ...newMessage,
        }),
      });
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const closeChat = async () => {
    if (conversation) {
      try {
        await fetch(`/api/support/chat/${conversation.conversationId}/close`, {
          method: 'POST',
        });
      } catch (error) {
        console.error('Error closing chat:', error);
      }
    }
    setIsOpen(false);
    setConversation(null);
    setMessages([]);
    setShowForm(true);
    setCustomerName('');
    setCustomerPhone('');
  };

  return (
    <div className="fixed bottom-4 right-4 z-40">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg flex items-center gap-2 transition"
        >
          <ChatIcon />
          <span>Chat with us</span>
        </button>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-96 max-w-full flex flex-col max-h-96 border dark:border-gray-600">
          {/* Header */}
          <div className="bg-blue-600 text-white p-4 rounded-t-lg flex justify-between items-center">
            <div>
              <h3 className="font-semibold">Live Chat</h3>
              {conversation && (
                <p className="text-xs opacity-90">
                  {conversation.status === 'waiting' ? 'Connecting...' : `Agent: ${conversation.assignedAgentName || 'Connecting...'}`}
                </p>
              )}
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="hover:bg-blue-700 p-1 rounded transition"
            >
              −
            </button>
          </div>

          {/* Chat Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-900">
            {showForm ? (
              <form onSubmit={startConversation} className="space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Please provide your details to start chatting
                </p>
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Your name"
                    required
                    className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Phone</label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+91 XXXXX XXXXX"
                    required
                    className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded text-sm font-medium disabled:opacity-50"
                >
                  {loading ? 'Starting...' : 'Start Chat'}
                </button>
              </form>
            ) : (
              <>
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.senderType === 'customer' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs rounded-lg px-3 py-2 text-sm ${
                        msg.senderType === 'customer'
                          ? 'bg-blue-600 text-white'
                          : msg.senderType === 'agent'
                          ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                          : 'bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white italic'
                      }`}
                    >
                      {msg.senderType !== 'customer' && (
                        <p className="text-xs font-semibold opacity-75 mb-1">{msg.senderName}</p>
                      )}
                      <p>{msg.message}</p>
                      <p className="text-xs opacity-50 mt-1">
                        {new Date(msg.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input Area */}
          {!showForm && conversation?.status !== 'closed' && (
            <form onSubmit={sendMessage} className="border-t dark:border-gray-600 p-3 bg-white dark:bg-gray-800 rounded-b-lg flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600"
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
                disabled={!inputValue.trim()}
              >
                Send
              </button>
            </form>
          )}

          {/* Close Button */}
          {!showForm && conversation?.status === 'closed' && (
            <div className="p-3 bg-red-50 dark:bg-red-900 border-t dark:border-red-800">
              <p className="text-sm text-red-800 dark:text-red-200 mb-2">Chat ended</p>
              <button
                onClick={closeChat}
                className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded text-sm font-medium"
              >
                Close
              </button>
            </div>
          )}

          {/* Minimize Button */}
          <div className="border-t dark:border-gray-600 px-4 py-2 flex justify-between items-center bg-gray-50 dark:bg-gray-800">
            <p className="text-xs text-gray-600 dark:text-gray-400">Messages: {messages.length}</p>
            <button
              onClick={closeChat}
              className="text-red-600 hover:text-red-700 text-xs font-medium"
            >
              Close Chat
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const ChatIcon: React.FC = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

export default LiveChatWidget;
