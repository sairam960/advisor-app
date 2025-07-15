# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a production-scale chatbot application with:
- **Frontend**: Next.js 14 with App Router (React 18)
- **Backend**: Fastify API server with OpenAI integration
- **AI**: OpenAI GPT-3.5-turbo with LangChain conversation management
- **Architecture**: Monorepo with workspaces for frontend and backend

## Development Commands

### Start Development Environment
```bash
npm run dev              # Start both frontend and backend
npm run dev:frontend     # Start only frontend (localhost:3000)
npm run dev:backend      # Start only backend (localhost:8081)
npm run setup-db         # Create PostgreSQL database
```

### Individual Services
```bash
# Frontend (from frontend/)
npm run dev              # Development server
npm run build            # Production build
npm run start            # Production server

# Backend (from backend/)
npm run dev              # Development with nodemon
npm run start            # Production server
```

### Root Level Commands
```bash
npm install              # Install all dependencies (workspaces)
npm run build            # Build both applications
npm run start            # Start both in production mode
```

## Architecture

### Backend (Fastify + LangChain)
- **Entry point**: `backend/src/server.js`
- **Conversation management**: LangChain with BufferMemory per session
- **API endpoints**: 
  - `POST /api/chat` - Send messages
  - `DELETE /api/chat/:sessionId` - Clear conversation
  - `GET /api/chat/:sessionId/history` - Get history
  - `GET /health` - Health check
- **Features**: Rate limiting, CORS, structured logging, session management

### Frontend (Next.js App Router)
- **Entry point**: `frontend/src/app/page.js`
- **Main component**: `frontend/src/components/ChatInterface.js`
- **API proxy**: Configured in `next.config.js` to proxy `/api/*` to backend
- **Features**: Real-time chat UI, session management, responsive design

### Key Files
- `backend/src/server.js` - Main Fastify server with OpenAI/LangChain integration
- `frontend/src/components/ChatInterface.js` - Main chat React component
- `frontend/src/app/globals.css` - Complete chat UI styling
- `backend/.env` - Environment variables (OpenAI API key)

## Environment Setup

1. **Required environment variables** (in `backend/.env`):
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   PORT=8080
   HOST=0.0.0.0
   ```

2. **Development setup**:
   ```bash
   npm install
   cp backend/.env.example backend/.env
   # Edit backend/.env with your OpenAI API key
   npm run dev
   ```

## Conversation Flow

1. Frontend sends user message to `POST /api/chat`
2. Backend retrieves/creates LangChain conversation chain for sessionId
3. Message processed through OpenAI with conversation memory
4. Response returned with sessionId for conversation continuity
5. Frontend displays response and maintains session context

## Production Considerations

- Rate limiting: 100 requests per minute per IP
- CORS configured for localhost:3000 in development
- Structured logging with Pino
- Session-based conversation memory (in-memory, scales to Redis for production)
- Error handling with proper HTTP status codes
- Input validation and sanitization