# AI Advisor Chatbot

A production-scale chatbot application built with Next.js frontend and Fastify backend, powered by OpenAI and LangChain for intelligent conversations with memory.

## Features

- 🤖 OpenAI GPT-3.5-turbo integration
- 🧠 Conversation memory using LangChain
- 🚀 Fast Fastify backend API
- ⚛️ Modern Next.js frontend
- 🔒 Rate limiting and CORS protection
- 📱 Responsive chat interface
- 💾 Session-based conversation persistence

## Architecture

```
advisor-app/
├── frontend/          # Next.js React application
│   ├── src/
│   │   ├── app/       # App Router pages
│   │   └── components/ # React components
│   └── package.json
├── backend/           # Fastify API server
│   ├── src/
│   │   └── server.js  # Main server file
│   └── package.json
└── package.json       # Root workspace config
```

## Prerequisites

- Node.js 18+ 
- npm or yarn
- OpenAI API key

## Setup

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   # Copy example env file
   cp backend/.env.example backend/.env
   
   # Edit backend/.env and add your OpenAI API key:
   OPENAI_API_KEY=your_openai_api_key_here
   ```

3. **Start development servers:**
   ```bash
   npm run dev
   ```

   This starts both frontend (http://localhost:3000) and backend (http://localhost:8080) concurrently.

## Available Scripts

- `npm run dev` - Start both frontend and backend in development mode
- `npm run dev:frontend` - Start only frontend development server
- `npm run dev:backend` - Start only backend development server
- `npm run build` - Build both applications for production
- `npm run start` - Start both applications in production mode

## API Endpoints

### POST /api/chat
Send a chat message and receive AI response.

**Request:**
```json
{
  "message": "Hello, how are you?",
  "sessionId": "optional-session-id"
}
```

**Response:**
```json
{
  "response": "Hello! I'm doing well, thank you for asking. How can I help you today?",
  "sessionId": "uuid-session-id",
  "timestamp": "2023-12-07T10:30:00.000Z"
}
```

### DELETE /api/chat/:sessionId
Clear conversation history for a session.

### GET /api/chat/:sessionId/history
Get conversation history for a session.

### GET /health
Health check endpoint.

## Environment Variables

### Backend (.env)
- `OPENAI_API_KEY` - Your OpenAI API key (required)
- `PORT` - Server port (default: 8080)
- `HOST` - Server host (default: 0.0.0.0)

## Production Deployment

1. **Build applications:**
   ```bash
   npm run build
   ```

2. **Start in production mode:**
   ```bash
   npm run start
   ```

3. **Environment setup:**
   - Set `NODE_ENV=production`
   - Configure proper CORS origins in backend
   - Set up reverse proxy (nginx/Apache)
   - Configure SSL certificates

## Tech Stack

### Frontend
- Next.js 14 with App Router
- React 18
- Axios for API calls
- CSS3 with responsive design

### Backend  
- Fastify web framework
- OpenAI API integration
- LangChain for conversation management
- Rate limiting and CORS protection
- Structured logging

## License

MIT