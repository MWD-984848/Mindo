
import { GoogleGenAI, Type } from "@google/genai";
import { MindoSettings } from '../types';

export const expandIdea = async (topic: string, settings: MindoSettings): Promise<string[]> => {
  if (!settings.aiApiKey) {
      throw new Error("缺少 API Key，请在 Mindo 设置中配置。");
  }

  const prompt = `为思维导图节点 "${topic}" 生成 4 个简洁、独特且有创意的子主题。仅返回一个 JSON 字符串数组，例如：["想法 1", "想法 2", "想法 3", "想法 4"]。保持简短（5个字以内）。不要使用 markdown 代码块。`;

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
                    { role: "system", content: "你是一个帮助头脑风暴思维导图创意的助手。请只回复 JSON 格式。" },
                    { role: "user", content: prompt }
                ],
                stream: false,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`AI 服务提供商错误 (${response.status}): ${err}`);
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

    return [`关于 ${topic} 的更多内容`];
  } catch (error) {
    console.error("AI Generation failed:", error);
    throw error; // Re-throw to handle in UI
  }
};
