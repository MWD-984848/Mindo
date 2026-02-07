
import { GoogleGenAI, Type } from "@google/genai";

export const expandIdea = async (topic: string, apiKey: string, model: string): Promise<string[]> => {
  if (!apiKey) {
      throw new Error("API Key is missing. Please configure it in Mindo settings.");
  }

  try {
    const ai = new GoogleGenAI({ apiKey: apiKey });
    
    const response = await ai.models.generateContent({
      model: model || 'gemini-2.0-flash',
      contents: `Generate 4 concise, distinct, and creative sub-topics or related concepts for the mind map node: "${topic}". Keep them short (under 5 words).`,
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
    return [`More about ${topic}`];
  } catch (error) {
    console.error("AI Generation failed:", error);
    throw error; // Re-throw to handle in UI
  }
};
