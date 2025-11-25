import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

export async function sendMessage(message: string, chatHistory: Array<{ role: string; parts: string }> = []) {
  if (!API_KEY) {
    throw new Error('API key not configured');
  }

  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const history = chatHistory.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.parts }],
  }));

  const chat = model.startChat({
    history: history,
  });

  const result = await chat.sendMessage(message);
  const response = await result.response;
  const text = response.text();

  return text;
}