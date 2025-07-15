import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import dotenv from 'dotenv';
import { ChatOpenAI } from 'langchain/chat_models/openai';
import { ConversationChain } from 'langchain/chains';
import { v4 as uuidv4 } from 'uuid';

// Database imports
import db from './database/connection.js';
import { runMigration } from './database/migrate.js';
import PostgresChatMemory from './database/memory.js';
import { ConversationModel, MessageModel } from './database/models.js';
import ContextService from './context/contextService.js';

dotenv.config();

const fastify = Fastify({
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty'
    }
  }
});

// Store conversation chains per session
const conversationChains = new Map();

// Register CORS
await fastify.register(cors, {
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
});

// Register rate limiting
await fastify.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute'
});

// Initialize database
const initializeDatabase = async () => {
  try {
    const isConnected = await db.testConnection();
    if (!isConnected) {
      throw new Error('Failed to connect to PostgreSQL database');
    }
    
    // Run migrations
    await runMigration();
    fastify.log.info('Database initialized successfully');
  } catch (error) {
    fastify.log.error('Database initialization failed:', error);
    throw error;
  }
};

// Initialize OpenAI chat model
const initializeChatModel = () => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }
  
  return new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: 'gpt-3.5-turbo',
    temperature: 0.7,
  });
};

// Get or create conversation chain for session
const getConversationChain = async (sessionId) => {
  if (!conversationChains.has(sessionId)) {
    const model = initializeChatModel();
    const memory = new PostgresChatMemory(sessionId, {
      contextEnabled: true,
      maxTokenLimit: 4000
    });
    const chain = new ConversationChain({ llm: model, memory });
    conversationChains.set(sessionId, chain);
  }
  return conversationChains.get(sessionId);
};

// Health check endpoint
fastify.get('/health', async (request, reply) => {
  const dbStatus = await db.testConnection();
  return { 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: dbStatus ? 'connected' : 'disconnected'
  };
});

// Chat endpoint with context
fastify.post('/api/chat', async (request, reply) => {
  try {
    const { message, sessionId = uuidv4() } = request.body;
    
    if (!message) {
      return reply.code(400).send({ error: 'Message is required' });
    }

    // Get conversation chain with PostgreSQL memory
    const chain = await getConversationChain(sessionId);
    
    // Get context for this conversation
    const contextResult = await ContextService.getConversationContext(sessionId);
    let contextPrompt = '';
    
    if (contextResult.success && contextResult.contextDocuments.length > 0) {
      const contextText = contextResult.contextDocuments
        .slice(0, 3) // Use top 3 most relevant
        .map(doc => `${doc.title}: ${doc.content}`)
        .join('\n\n');
      
      contextPrompt = `\n\nContext Information:\n${contextText}\n\nPlease use this context when relevant to answer the user's question.\n\n`;
    }

    // Combine user message with context
    const enhancedMessage = contextPrompt + message;
    
    // Get AI response
    const response = await chain.call({ input: enhancedMessage });

    return {
      response: response.response,
      sessionId,
      timestamp: new Date().toISOString(),
      contextUsed: contextResult.contextDocuments?.length > 0
    };
  } catch (error) {
    fastify.log.error(error);
    return reply.code(500).send({ 
      error: 'Failed to process chat message',
      details: error.message 
    });
  }
});

// Clear conversation endpoint
fastify.delete('/api/chat/:sessionId', async (request, reply) => {
  const { sessionId } = request.params;
  
  try {
    // Clear from memory
    if (conversationChains.has(sessionId)) {
      const chain = conversationChains.get(sessionId);
      await chain.memory.clear();
      conversationChains.delete(sessionId);
    }
    
    return { message: 'Conversation cleared', sessionId };
  } catch (error) {
    fastify.log.error('Error clearing conversation:', error);
    return reply.code(500).send({ error: 'Failed to clear conversation' });
  }
});

// Get conversation history endpoint
fastify.get('/api/chat/:sessionId/history', async (request, reply) => {
  const { sessionId } = request.params;
  
  try {
    const messages = await MessageModel.findByConversation(sessionId);
    const contextResult = await ContextService.getConversationContext(sessionId);
    
    return { 
      sessionId, 
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.created_at
      })),
      context: contextResult.contextDocuments || []
    };
  } catch (error) {
    fastify.log.error('Error fetching conversation history:', error);
    return reply.code(500).send({ error: 'Failed to fetch conversation history' });
  }
});

// Context management endpoints
fastify.post('/api/context/documents', async (request, reply) => {
  try {
    const { title, content, metadata = {} } = request.body;
    
    fastify.log.info('Received document creation request:', { title, content: content?.substring(0, 100) + '...' });
    
    if (!title || !content) {
      fastify.log.warn('Missing required fields:', { title: !!title, content: !!content });
      return reply.code(400).send({ error: 'Title and content are required' });
    }
    
    const result = await ContextService.addDocument(title, content, metadata);
    
    fastify.log.info('Document creation result:', { success: result.success });
    
    if (result.success) {
      return result;
    } else {
      return reply.code(500).send(result);
    }
  } catch (error) {
    fastify.log.error('Error adding context document:', error);
    return reply.code(500).send({ error: 'Failed to add context document' });
  }
});

fastify.get('/api/context/documents', async (request, reply) => {
  try {
    const { search, limit = 50 } = request.query;
    
    let result;
    if (search) {
      result = await ContextService.searchDocuments(search, parseInt(limit));
    } else {
      result = await ContextService.getAllDocuments(parseInt(limit));
    }
    
    return result;
  } catch (error) {
    fastify.log.error('Error fetching context documents:', error);
    return reply.code(500).send({ error: 'Failed to fetch context documents' });
  }
});

fastify.delete('/api/context/documents/:documentId', async (request, reply) => {
  try {
    const { documentId } = request.params;
    const result = await ContextService.deleteDocument(documentId);
    
    if (result.success) {
      return result;
    } else {
      return reply.code(500).send(result);
    }
  } catch (error) {
    fastify.log.error('Error deleting context document:', error);
    return reply.code(500).send({ error: 'Failed to delete context document' });
  }
});

fastify.post('/api/chat/:sessionId/context', async (request, reply) => {
  try {
    const { sessionId } = request.params;
    const { documentIds, relevanceScore = 0.8 } = request.body;
    
    if (!documentIds || !Array.isArray(documentIds)) {
      return reply.code(400).send({ error: 'documentIds array is required' });
    }
    
    const result = await ContextService.addContextToConversation(sessionId, documentIds, relevanceScore);
    return result;
  } catch (error) {
    fastify.log.error('Error adding context to conversation:', error);
    return reply.code(500).send({ error: 'Failed to add context to conversation' });
  }
});

fastify.get('/api/chat/:sessionId/context', async (request, reply) => {
  try {
    const { sessionId } = request.params;
    const result = await ContextService.getConversationContext(sessionId);
    return result;
  } catch (error) {
    fastify.log.error('Error fetching conversation context:', error);
    return reply.code(500).send({ error: 'Failed to fetch conversation context' });
  }
});

fastify.delete('/api/chat/:sessionId/context/:documentId', async (request, reply) => {
  try {
    const { sessionId, documentId } = request.params;
    const result = await ContextService.removeContextFromConversation(sessionId, documentId);
    return result;
  } catch (error) {
    fastify.log.error('Error removing context from conversation:', error);
    return reply.code(500).send({ error: 'Failed to remove context from conversation' });
  }
});

// Start server
const start = async () => {
  try {
    // Initialize database first
    await initializeDatabase();
    
    const port = process.env.PORT || 8080;
    const host = process.env.HOST || '0.0.0.0';
    
    await fastify.listen({ port, host });
    fastify.log.info(`Server listening on http://${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  fastify.log.info('Received SIGINT, shutting down gracefully');
  await db.close();
  process.exit(0);
});

start();