import { useState, useRef, useEffect } from 'react';
import { ModernCard } from '../ui/ModernLayout';
import { cn } from '~/utils/classNames';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ModernChatInterfaceProps {
  className?: string;
}

export function ModernChatInterface({ className }: ModernChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm Chef, your AI coding assistant. Describe the app you'd like to build and I'll help you create it with a full backend, database, and real-time features.",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'll help you build that! Let me start by creating the project structure and setting up the necessary components...",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
      setIsTyping(false);
    }, 1500);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Chat Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center">
            <span className="text-white text-sm">🍳</span>
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Chef AI</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Full-stack AI assistant</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="text-xs text-slate-500 dark:text-slate-400">Online</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex",
              message.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-4 py-3 shadow-sm",
                message.role === 'user'
                  ? "bg-gradient-to-r from-orange-500 to-red-600 text-white"
                  : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              )}
            >
              <p className="text-sm leading-relaxed">{message.content}</p>
              <p className={cn(
                "text-xs mt-2 opacity-70",
                message.role === 'user' ? "text-white" : "text-slate-500 dark:text-slate-400"
              )}>
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 shadow-sm">
              <div className="flex items-center space-x-1">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">Chef is typing...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-700">
        <div className="flex items-end space-x-3">
          <div className="flex-1">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Describe your app idea or ask for help..."
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400"
              rows={1}
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className={cn(
              "p-3 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl",
              "bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-lg"
            )}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
