
import { GoogleGenAI, Type } from "@google/genai";
import { MindoSettings } from '../types';

export interface AiResult {
    title: string;
    content: string;
}

export const expandIdea = async (topic: string, settings: MindoSettings): Promise<AiResult[]> => {
  if (!settings.aiApiKey) {
      throw new Error("缺少 API Key，请在 Mindo 设置中配置。");
  }

  const prompt = `作为思维导图专家，请深入挖掘主题 "${topic}"，生成 4 个具有深度、多维度的子主题。
  请返回一个严格的 JSON 对象数组（Array），不要包含任何 Markdown 格式（如 \`\`\`json）。
  每个对象包含以下字段：
  - "title": 子主题标题（简练概括，15字以内）。
  - "content": 对该子主题的详细描述、关键点或延伸解释（50-80字，可分点描述）。
  
  示例格式：[{"title": "概念定义", "content": "..."}]`;

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
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  content: { type: Type.STRING }
                },
                required: ["title", "content"]
              }
            }
          }
        });

        if (response.text) {
          const ideas = JSON.parse(response.text);
          if (Array.isArray(ideas)) {
            return ideas.slice(0, 4).map((item: any) => ({
                title: item.title || "未命名",
                content: item.content || ""
            }));
          }
        }

    } else {
        // --- OpenAI Compatible Implementation (DeepSeek, OpenAI, etc) ---
        let baseUrl = settings.aiBaseUrl || 'https://api.openai.com/v1';
        if (!baseUrl.endsWith('/chat/completions')) {
             if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
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
                    { role: "system", content: "你是一个专业的思维导图助手，擅长深度拆解问题。请直接返回 JSON 数组格式的数据。" },
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
            // Improved regex to handle various markdown code block formats (e.g. ```json, ```JSON, or just ```)
            const cleanContent = content.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
            try {
                const ideas = JSON.parse(cleanContent);
                if (Array.isArray(ideas)) {
                    return ideas.slice(0, 4).map((item: any) => ({
                        title: typeof item === 'string' ? item : (item.title || "未命名"),
                        content: typeof item === 'string' ? "" : (item.content || "")
                    }));
                }
            } catch (e) {
                console.error("Failed to parse JSON from AI response:", cleanContent);
                throw new Error("AI 返回的数据格式不正确，无法解析。");
            }
        }
    }

    return [{ title: `关于 ${topic} 的更多内容`, content: "AI 未返回有效数据。" }];
  } catch (error) {
    console.error("AI Generation failed:", error);
    throw error;
  }
};
