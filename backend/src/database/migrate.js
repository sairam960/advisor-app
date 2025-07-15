import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  try {
    console.log('Starting database migration...');
    
    // Test connection first
    const isConnected = await db.testConnection();
    if (!isConnected) {
      throw new Error('Unable to connect to database');
    }

    // Read and execute schema
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = await fs.readFile(schemaPath, 'utf8');
    
    // Execute each statement separately
    const statements = [
      // Enable UUID extension
      'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"',
      
      // Create tables
      `CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE,
        name VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      
      `CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255),
        context_summary TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      
      `CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        context_used JSONB,
        tokens_used INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      
      `CREATE TABLE IF NOT EXISTS context_documents (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      
      `CREATE TABLE IF NOT EXISTS conversation_context (
        conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
        context_document_id UUID REFERENCES context_documents(id) ON DELETE CASCADE,
        relevance_score FLOAT,
        added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        PRIMARY KEY (conversation_id, context_document_id)
      )`,
      
      // Create indexes
      'CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id)',
      'CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at)',
      
      // Create function
      `CREATE OR REPLACE FUNCTION update_updated_at_column()
       RETURNS TRIGGER AS $$
       BEGIN
           NEW.updated_at = NOW();
           RETURN NEW;
       END;
       $$ language 'plpgsql'`,
       
      // Create triggers
      'DROP TRIGGER IF EXISTS update_users_updated_at ON users',
      'CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
      'DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations',
      'CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
      'DROP TRIGGER IF EXISTS update_context_documents_updated_at ON context_documents',
      'CREATE TRIGGER update_context_documents_updated_at BEFORE UPDATE ON context_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()'
    ];

    for (const statement of statements) {
      try {
        await db.query(statement);
        console.log('✓ Executed:', statement.substring(0, 60).replace(/\n/g, ' ') + '...');
      } catch (error) {
        if (error.message.includes('already exists') || error.message.includes('does not exist')) {
          console.log('⚠ Skipped:', statement.substring(0, 60).replace(/\n/g, ' ') + '...');
        } else {
          console.error('❌ Error:', error.message);
          throw error;
        }
      }
    }

    console.log('✅ Database migration completed successfully!');
    
    // Insert sample context documents
    await insertSampleContext();
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

async function insertSampleContext() {
  try {
    console.log('Inserting sample context documents...');
    
    const sampleDocs = [
      {
        title: 'AI Assistant Guidelines',
        content: 'I am an AI assistant designed to be helpful, harmless, and honest. I can help with a wide variety of tasks including answering questions, writing, analysis, math, coding, and creative tasks.',
        metadata: { type: 'guidelines', priority: 'high' }
      },
      {
        title: 'Technical Support',
        content: 'For technical issues, please provide detailed information about your problem including error messages, steps to reproduce, and your system configuration.',
        metadata: { type: 'support', category: 'technical' }
      },
      {
        title: 'Company Information',
        content: 'We are a technology company focused on building AI-powered solutions to help businesses improve efficiency and customer experience.',
        metadata: { type: 'company', department: 'general' }
      }
    ];

    for (const doc of sampleDocs) {
      await db.query(`
        INSERT INTO context_documents (title, content, metadata)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING
      `, [doc.title, doc.content, JSON.stringify(doc.metadata)]);
    }

    console.log('✅ Sample context documents inserted!');
  } catch (error) {
    console.error('❌ Failed to insert sample context:', error.message);
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { runMigration };