import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

const SYSTEM_PROMPT = `
You are a mental health support assistant.

You only respond to mental health related topics such as:
1. emotions and feelings
2. stress, anxiety, depression
3. coping strategies
4. grounding or breathing exercises
5. self care
6. seeking professional help
7. general talk or short conversations are allowed but not off topic.
8. sometimes they are feeling to talk to someone you can, but remember to only respond to topics listed above.

If the user asks about any topic outside mental health,
reply with exactly:

"Sorry this is out of scope. I can only help with mental health related topics."

Do not answer anything else.
`;

export async function sendMessage(
  message: string,
  chatHistory: Array<{ role: string; parts: string }> = []
) {
  if (!API_KEY) {
    throw new Error('API key not configured');
  }

  const genAI = new GoogleGenerativeAI(API_KEY);

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: SYSTEM_PROMPT,
  });

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
