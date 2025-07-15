import './globals.css';

export const metadata = {
  title: 'AI Advisor Chatbot',
  description: 'Production-scale chatbot application powered by OpenAI',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}