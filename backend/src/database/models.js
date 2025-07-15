import db from './connection.js';
import { v4 as uuidv4 } from 'uuid';

export class ConversationModel {
  static async create(userId = null, title = null) {
    const query = `
      INSERT INTO conversations (id, user_id, title, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      RETURNING *
    `;
    const conversationId = uuidv4();
    const result = await db.query(query, [conversationId, userId, title]);
    return result.rows[0];
  }

  static async findById(id) {
    const query = 'SELECT * FROM conversations WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rows[0];
  }

  static async update(id, updates) {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    
    const query = `
      UPDATE conversations 
      SET ${setClause}, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await db.query(query, [id, ...values]);
    return result.rows[0];
  }

  static async delete(id) {
    const query = 'DELETE FROM conversations WHERE id = $1';
    await db.query(query, [id]);
  }

  static async getMessages(conversationId) {
    const query = `
      SELECT * FROM messages 
      WHERE conversation_id = $1 
      ORDER BY created_at ASC
    `;
    const result = await db.query(query, [conversationId]);
    return result.rows;
  }
}

export class MessageModel {
  static async create(conversationId, role, content, contextUsed = null, tokensUsed = null) {
    const query = `
      INSERT INTO messages (id, conversation_id, role, content, context_used, tokens_used, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING *
    `;
    const messageId = uuidv4();
    const result = await db.query(query, [
      messageId, 
      conversationId, 
      role, 
      content, 
      contextUsed ? JSON.stringify(contextUsed) : null,
      tokensUsed
    ]);
    return result.rows[0];
  }

  static async findByConversation(conversationId, limit = 50) {
    const query = `
      SELECT * FROM messages 
      WHERE conversation_id = $1 
      ORDER BY created_at DESC
      LIMIT $2
    `;
    const result = await db.query(query, [conversationId, limit]);
    return result.rows.reverse(); // Return in chronological order
  }

  static async getConversationHistory(conversationId) {
    const query = `
      SELECT role, content, created_at, context_used
      FROM messages 
      WHERE conversation_id = $1 
      ORDER BY created_at ASC
    `;
    const result = await db.query(query, [conversationId]);
    return result.rows;
  }
}

export class ContextDocumentModel {
  static async create(title, content, metadata = {}) {
    try {
      console.log('ContextDocumentModel.create called with:', { title, content: content?.substring(0, 50) + '...', metadata });
      
      const query = `
        INSERT INTO context_documents (id, title, content, metadata, created_at, updated_at)
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        RETURNING *
      `;
      const docId = uuidv4();
      
      console.log('Executing query with docId:', docId);
      const result = await db.query(query, [docId, title, content, JSON.stringify(metadata)]);
      
      console.log('Query result:', result.rows[0]);
      return result.rows[0];
    } catch (error) {
      console.error('Error in ContextDocumentModel.create:', error);
      throw error;
    }
  }

  static async findAll(limit = 100) {
    const query = `
      SELECT * FROM context_documents 
      ORDER BY created_at DESC
      LIMIT $1
    `;
    const result = await db.query(query, [limit]);
    return result.rows;
  }

  static async findById(id) {
    const query = 'SELECT * FROM context_documents WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rows[0];
  }

  static async search(searchTerm, limit = 10) {
    const query = `
      SELECT *, 
             ts_rank(to_tsvector('english', title || ' ' || content), plainto_tsquery('english', $1)) as rank
      FROM context_documents 
      WHERE to_tsvector('english', title || ' ' || content) @@ plainto_tsquery('english', $1)
      ORDER BY rank DESC
      LIMIT $2
    `;
    const result = await db.query(query, [searchTerm, limit]);
    return result.rows;
  }

  static async delete(id) {
    const query = 'DELETE FROM context_documents WHERE id = $1';
    await db.query(query, [id]);
  }
}

export class ConversationContextModel {
  static async addContext(conversationId, contextDocumentId, relevanceScore = 1.0) {
    const query = `
      INSERT INTO conversation_context (conversation_id, context_document_id, relevance_score, added_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (conversation_id, context_document_id) 
      DO UPDATE SET relevance_score = $3, added_at = NOW()
    `;
    await db.query(query, [conversationId, contextDocumentId, relevanceScore]);
  }

  static async getContextForConversation(conversationId) {
    const query = `
      SELECT cd.*, cc.relevance_score, cc.added_at
      FROM context_documents cd
      JOIN conversation_context cc ON cd.id = cc.context_document_id
      WHERE cc.conversation_id = $1
      ORDER BY cc.relevance_score DESC, cc.added_at DESC
    `;
    const result = await db.query(query, [conversationId]);
    return result.rows;
  }

  static async removeContext(conversationId, contextDocumentId) {
    const query = 'DELETE FROM conversation_context WHERE conversation_id = $1 AND context_document_id = $2';
    await db.query(query, [conversationId, contextDocumentId]);
  }
}