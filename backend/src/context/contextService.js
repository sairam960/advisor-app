import { ContextDocumentModel, ConversationContextModel } from '../database/models.js';

export class ContextService {
  static async addDocument(title, content, metadata = {}) {
    try {
      console.log('ContextService.addDocument called with:', { title, content: content?.substring(0, 100) + '...', metadata });
      const document = await ContextDocumentModel.create(title, content, metadata);
      console.log('Document created successfully:', document?.id);
      return {
        success: true,
        document,
        message: 'Context document added successfully'
      };
    } catch (error) {
      console.error('Error in ContextService.addDocument:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  static async searchDocuments(query, limit = 10) {
    try {
      const documents = await ContextDocumentModel.search(query, limit);
      return {
        success: true,
        documents,
        count: documents.length
      };
    } catch (error) {
      console.error('Error searching context documents:', error);
      return {
        success: false,
        error: error.message,
        documents: []
      };
    }
  }

  static async getAllDocuments(limit = 100) {
    try {
      const documents = await ContextDocumentModel.findAll(limit);
      return {
        success: true,
        documents,
        count: documents.length
      };
    } catch (error) {
      console.error('Error fetching context documents:', error);
      return {
        success: false,
        error: error.message,
        documents: []
      };
    }
  }

  static async deleteDocument(documentId) {
    try {
      await ContextDocumentModel.delete(documentId);
      return {
        success: true,
        message: 'Context document deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting context document:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  static async addContextToConversation(conversationId, documentIds, relevanceScore = 0.8) {
    try {
      for (const documentId of documentIds) {
        await ConversationContextModel.addContext(conversationId, documentId, relevanceScore);
      }
      
      return {
        success: true,
        message: `Added ${documentIds.length} context document(s) to conversation`
      };
    } catch (error) {
      console.error('Error adding context to conversation:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  static async getConversationContext(conversationId) {
    try {
      const contextDocuments = await ConversationContextModel.getContextForConversation(conversationId);
      return {
        success: true,
        contextDocuments,
        count: contextDocuments.length
      };
    } catch (error) {
      console.error('Error fetching conversation context:', error);
      return {
        success: false,
        error: error.message,
        contextDocuments: []
      };
    }
  }

  static async removeContextFromConversation(conversationId, documentId) {
    try {
      await ConversationContextModel.removeContext(conversationId, documentId);
      return {
        success: true,
        message: 'Context removed from conversation'
      };
    } catch (error) {
      console.error('Error removing context from conversation:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  static async findRelevantContext(query, conversationId = null, limit = 5) {
    try {
      // Search for relevant documents
      let relevantDocs = await ContextDocumentModel.search(query, limit);
      
      // If conversation ID is provided, prioritize documents already in conversation
      if (conversationId) {
        const conversationContext = await ConversationContextModel.getContextForConversation(conversationId);
        const conversationDocIds = conversationContext.map(doc => doc.id);
        
        // Boost relevance for documents already in conversation
        relevantDocs = relevantDocs.map(doc => ({
          ...doc,
          rank: conversationDocIds.includes(doc.id) ? doc.rank * 1.5 : doc.rank
        }));
        
        // Re-sort by adjusted rank
        relevantDocs.sort((a, b) => b.rank - a.rank);
      }
      
      return {
        success: true,
        documents: relevantDocs,
        count: relevantDocs.length
      };
    } catch (error) {
      console.error('Error finding relevant context:', error);
      return {
        success: false,
        error: error.message,
        documents: []
      };
    }
  }

  static async generateContextSummary(conversationId) {
    try {
      const contextDocs = await ConversationContextModel.getContextForConversation(conversationId);
      
      if (contextDocs.length === 0) {
        return {
          success: true,
          summary: 'No context documents attached to this conversation.'
        };
      }

      const summary = contextDocs
        .slice(0, 3) // Top 3 most relevant
        .map(doc => `• ${doc.title}: ${doc.content.substring(0, 100)}...`)
        .join('\n');

      return {
        success: true,
        summary: `Active Context (${contextDocs.length} documents):\n${summary}`,
        documentCount: contextDocs.length
      };
    } catch (error) {
      console.error('Error generating context summary:', error);
      return {
        success: false,
        error: error.message,
        summary: 'Error generating context summary'
      };
    }
  }
}

export default ContextService;