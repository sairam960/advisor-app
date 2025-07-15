'use client';

import { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import ContextPanel from './ContextPanel';

export default function ChatInterface() {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [showContext, setShowContext] = useState(false);
  const [activeContext, setActiveContext] = useState([]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const newSessionId = uuidv4();
    setSessionId(newSessionId);
    setMessages([
      {
        id: uuidv4(),
        type: 'system',
        content: 'Welcome! I\'m your AI advisor. How can I help you today?',
        timestamp: new Date().toISOString(),
      },
    ]);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = {
      id: uuidv4(),
      type: 'user',
      content: inputMessage.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await axios.post('/api/chat', {
        message: userMessage.content,
        sessionId,
      });

      const assistantMessage = {
        id: uuidv4(),
        type: 'assistant',
        content: response.data.response,
        timestamp: response.data.timestamp,
        contextUsed: response.data.contextUsed,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = {
        id: uuidv4(),
        type: 'system',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearConversation = async () => {
    try {
      await axios.delete(`/api/chat/${sessionId}`);
      const newSessionId = uuidv4();
      setSessionId(newSessionId);
      setMessages([
        {
          id: uuidv4(),
          type: 'system',
          content: 'Conversation cleared. How can I help you?',
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch (error) {
      console.error('Error clearing conversation:', error);
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={`chat-layout ${showContext ? 'with-context' : ''}`}>
      <div className="chat-container">
        <div className="messages">
          {messages.map((message) => (
            <div key={message.id} className={`message ${message.type}`}>
              <div>{message.content}</div>
              <div style={{ fontSize: '0.8em', opacity: 0.7, marginTop: '5px' }}>
                {formatTimestamp(message.timestamp)}
                {message.contextUsed && (
                  <span className="context-indicator"> • Context used</span>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="message assistant">
              <div className="loading">
                <div className="spinner"></div>
                <span>AI is thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="controls">
          <button onClick={clearConversation} className="clear-button">
            Clear Conversation
          </button>
          <button 
            onClick={() => setShowContext(!showContext)} 
            className={`context-toggle ${showContext ? 'active' : ''}`}
          >
            Context ({activeContext.length})
          </button>
          <div className="session-info">
            Session: {sessionId.slice(0, 8)}...
          </div>
        </div>

        <div className="input-container">
          <form onSubmit={sendMessage} className="input-form">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Type your message here..."
              className="message-input"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !inputMessage.trim()}
              className="send-button"
            >
              Send
            </button>
          </form>
        </div>
      </div>

      {showContext && (
        <div className="context-sidebar">
          <ContextPanel 
            sessionId={sessionId} 
            onContextChange={setActiveContext}
          />
        </div>
      )}
    </div>
  );
}