import ChatInterface from '../components/ChatInterface';

export default function Home() {
  return (
    <div className="container">
      <div className="header">
        <h1>AI Advisor Chatbot</h1>
        <p>Your intelligent conversation partner powered by OpenAI</p>
      </div>
      <ChatInterface />
    </div>
  );
}