import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: './backend/.env' });

const { Client } = pg;

async function setupDatabase() {
  // First connect to postgres database to create our database
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: 'postgres' // Connect to default postgres database first
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL server');

    // Check if database exists
    const dbName = process.env.DB_NAME || 'advisor_chat';
    const result = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName]
    );

    if (result.rows.length === 0) {
      // Create database
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`✅ Database "${dbName}" created successfully`);
    } else {
      console.log(`✅ Database "${dbName}" already exists`);
    }

    await client.end();
    console.log('Database setup completed successfully!');
    console.log('You can now run: npm run dev');
    
  } catch (error) {
    console.error('Database setup failed:', error.message);
    console.log('\nPlease make sure:');
    console.log('1. PostgreSQL is running');
    console.log('2. Your credentials in backend/.env are correct');
    console.log('3. The postgres user has permission to create databases');
    process.exit(1);
  }
}

setupDatabase();