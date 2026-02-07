
import { GoogleGenAI, Type } from "@google/genai";
import { MindoSettings } from '../types';

export const expandIdea = async (topic: string, settings: MindoSettings): Promise<string[]> => {
  if (!settings.aiApiKey) {
      throw new Error("API Key is missing. Please configure it in Mindo settings.");
  }

  const prompt = `Generate 4 concise, distinct, and creative sub-topics or related concepts for the mind map node: "${topic}". Return ONLY a JSON array of strings, for example: ["Idea 1", "Idea 2", "Idea 3", "Idea 4"]. Keep them short (under 5 words). Do not wrap in markdown code blocks.`;

  try {
    if (settings.aiProvider === 'gemini') {
        // --- Google Gemini Implementation ---
        const ai = new GoogleGenAI({ apiKey: settings.aiApiKey });
        
        const response = await ai.models.generateContent({
          model: settings.aiModel || 'gemini-2.0-flash',
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.STRING
              }
            }
          }
        });

        if (response.text) {
          const ideas = JSON.parse(response.text);
          if (Array.isArray(ideas)) {
            return ideas.slice(0, 4);
          }
        }

    } else {
        // --- OpenAI Compatible Implementation (DeepSeek, OpenAI, etc) ---
        let baseUrl = settings.aiBaseUrl || 'https://api.openai.com/v1';
        // Ensure proper format for chat completions
        if (!baseUrl.endsWith('/chat/completions')) {
             // Remove trailing slash if present
             if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
             // If it doesn't end with /v1 or similar, we might need to be careful, but generally append /chat/completions
             // DeepSeek base is https://api.deepseek.com -> needs /chat/completions
             // OpenAI base is https://api.openai.com/v1 -> needs /chat/completions
             baseUrl = `${baseUrl}/chat/completions`;
        }

        const response = await fetch(baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.aiApiKey}`
            },
            body: JSON.stringify({
                model: settings.aiModel || 'deepseek-chat',
                messages: [
                    { role: "system", content: "You are a helpful assistant that helps brainstorm mind map ideas. You only speak JSON." },
                    { role: "user", content: prompt }
                ],
                stream: false,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`AI Provider Error (${response.status}): ${err}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        
        if (content) {
            // Cleanup: sometimes models add markdown code blocks even if told not to
            const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
            const ideas = JSON.parse(cleanContent);
            if (Array.isArray(ideas)) {
                return ideas.slice(0, 4);
            }
        }
    }

    return [`More about ${topic}`];
  } catch (error) {
    console.error("AI Generation failed:", error);
    throw error; // Re-throw to handle in UI
  }
};
