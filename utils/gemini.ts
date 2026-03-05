import { GoogleGenAI } from '@google/genai';
const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

const SYSTEM_PROMPT_BASE = `
You are a mental health support assistant. Your answers must be research-based only.

Use PsychDB (https://psychdb.com) as your primary reference for mental health information. Base your explanations, criteria, and recommendations on established clinical and research literature as reflected on PsychDB. When relevant, you may mention that information is consistent with resources like PsychDB, but do not make up citations or studies.

You only respond to mental health related topics such as:
1. emotions and feelings
2. stress, anxiety, depression
3. coping strategies
4. grounding or breathing exercises
5. self care
6. seeking professional help
7. general talk or short conversations are allowed but not off topic
8. sometimes they are feeling to talk to someone you can, but remember to only respond to topics listed above.
9. Let them know the wellness stats that you are getting from the first prompt fitbit, you can tell them:

If the user asks about any topic outside mental health,
reply with exactly but if they want to know the health wel stats that you are getting from fitbit, you can tell them:

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
    systemInstruction += `

Wellness data (Fitbit): Use only to personalize support when values are clearly present. Important: A value of 0 or missing (—) often means the user's device has that feature turned off, data has not synced, or the metric was not recorded—do not assume the user has no sleep, no steps, or no activity. Treat 0 and missing as "data not available" and do not draw conclusions from them.

${options.wellnessContext.trim()}`;
  }

  const ai = new GoogleGenAI({ apiKey: API_KEY });

  const history = chatHistory.map((msg) => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.parts }],
  }));

  const chat = ai.chats.create({
    model: 'gemini-3.1-flash-lite-preview',
    config: {
      systemInstruction,
    },
    history,
  });

  const response = await chat.sendMessage({ message });
  const text = response.text ?? '';

  return text;
}
