import { BaseChatMemory } from 'langchain/memory';
import { HumanMessage, AIMessage, SystemMessage } from 'langchain/schema';
import { ConversationModel, MessageModel, ContextDocumentModel, ConversationContextModel } from './models.js';

export class PostgresChatMemory extends BaseChatMemory {
  constructor(conversationId, options = {}) {
    super({
      returnMessages: true,
      inputKey: 'input',
      outputKey: 'response',
      ...options
    });
    
    this.conversationId = conversationId;
    this.maxTokenLimit = options.maxTokenLimit || 4000;
    this.contextEnabled = options.contextEnabled !== false;
  }

  async loadMemoryVariables() {
    try {
      // Load conversation history
      const messages = await MessageModel.findByConversation(this.conversationId);
      
      // Convert database messages to LangChain format
      const chatHistory = messages.map(msg => {
        switch (msg.role) {
          case 'user':
            return new HumanMessage(msg.content);
          case 'assistant':
            return new AIMessage(msg.content);
          case 'system':
            return new SystemMessage(msg.content);
          default:
            return new HumanMessage(msg.content);
        }
      });

      // Load context documents if enabled
      let contextDocuments = [];
      if (this.contextEnabled) {
        contextDocuments = await ConversationContextModel.getContextForConversation(this.conversationId);
      }

      return {
        history: chatHistory,
        context: contextDocuments
      };
    } catch (error) {
      console.error('Error loading memory:', error);
      return {
        history: [],
        context: []
      };
    }
  }

  async saveContext(inputValues, outputValues) {
    try {
      const input = inputValues[this.inputKey];
      const output = outputValues[this.outputKey];

      // Ensure conversation exists
      let conversation = await ConversationModel.findById(this.conversationId);
      if (!conversation) {
        conversation = await ConversationModel.create(null, 'New Conversation');
      }

      // Save user message
      await MessageModel.create(this.conversationId, 'user', input);

      // Save assistant response
      await MessageModel.create(this.conversationId, 'assistant', output);

      // Update conversation title if it's the first exchange
      if (!conversation.title || conversation.title === 'New Conversation') {
        const title = this.generateConversationTitle(input);
        await ConversationModel.update(this.conversationId, { title });
      }

      // Add relevant context if enabled
      if (this.contextEnabled) {
        await this.addRelevantContext(input);
      }

    } catch (error) {
      console.error('Error saving context:', error);
    }
  }

  async addRelevantContext(userMessage) {
    try {
      // Search for relevant context documents
      const relevantDocs = await ContextDocumentModel.search(userMessage, 3);
      
      // Add context to conversation with relevance scores
      for (const doc of relevantDocs) {
        await ConversationContextModel.addContext(
          this.conversationId, 
          doc.id, 
          doc.rank || 0.5
        );
      }
    } catch (error) {
      console.error('Error adding relevant context:', error);
    }
  }

  generateConversationTitle(firstMessage) {
    // Generate a title from the first message (first 50 characters)
    const title = firstMessage.length > 50 
      ? firstMessage.substring(0, 47) + '...'
      : firstMessage;
    
    return title.replace(/\n/g, ' ').trim();
  }

  async clear() {
    try {
      // Clear conversation messages but keep the conversation record
      const conversation = await ConversationModel.findById(this.conversationId);
      if (conversation) {
        // Delete all messages for this conversation
        await MessageModel.query(`
          DELETE FROM messages WHERE conversation_id = $1
        `, [this.conversationId]);
        
        // Clear conversation context
        await ConversationContextModel.query(`
          DELETE FROM conversation_context WHERE conversation_id = $1
        `, [this.conversationId]);
        
        // Reset conversation title
        await ConversationModel.update(this.conversationId, { 
          title: 'New Conversation',
          context_summary: null 
        });
      }
    } catch (error) {
      console.error('Error clearing memory:', error);
    }
  }

  async getConversationSummary() {
    try {
      const messages = await MessageModel.findByConversation(this.conversationId, 10);
      if (messages.length === 0) return '';

      // Create a simple summary of recent messages
      const recentMessages = messages.slice(-6); // Last 6 messages
      const summary = recentMessages
        .map(msg => `${msg.role}: ${msg.content.substring(0, 100)}...`)
        .join('\n');

      return summary;
    } catch (error) {
      console.error('Error creating conversation summary:', error);
      return '';
    }
  }

  async getContextPrompt() {
    try {
      if (!this.contextEnabled) return '';

      const contextDocs = await ConversationContextModel.getContextForConversation(this.conversationId);
      
      if (contextDocs.length === 0) return '';

      const contextText = contextDocs
        .map(doc => `Title: ${doc.title}\nContent: ${doc.content}`)
        .join('\n\n---\n\n');

      return `\nContext Information:\n${contextText}\n\nPlease use this context to inform your responses when relevant.\n`;
    } catch (error) {
      console.error('Error getting context prompt:', error);
      return '';
    }
  }
}

export default PostgresChatMemory;