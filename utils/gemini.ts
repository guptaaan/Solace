import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

const SYSTEM_PROMPT_BASE = `
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
IN ALL THE ANSWERS DO NOT USE STYLING LIKE BOLD OR ITALICS.
`;

export type SendMessageOptions = {
  /** Wellness/Fitbit context (sleep, activity, heart rate, etc.) so you can personalize support and consider how their data may relate to mood and mental health. */
  wellnessContext?: string;
};

export async function sendMessage(
  message: string,
  chatHistory: Array<{ role: string; parts: string }> = [],
  options?: SendMessageOptions
) {
  if (!API_KEY) {
    throw new Error('API key not configured');
  }

  let systemInstruction = SYSTEM_PROMPT_BASE;
  if (options?.wellnessContext?.trim()) {
    systemInstruction += `\n\nCurrent user wellness data (use to personalize your support and consider how sleep, activity, and heart rate may relate to their mood and mental health):\n${options.wellnessContext.trim()}`;
  }

  const genAI = new GoogleGenerativeAI(API_KEY);

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction,
  });

  const history = chatHistory.map((msg) => ({
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
