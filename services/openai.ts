import { CaptionResult } from "../types";

// Helper to remove trailing slash from base URL
const cleanBaseUrl = (url: string) => url.replace(/\/+$/, '');

export const generateCaptionOpenAI = async (
  base64Image: string,
  mimeType: string,
  prompt: string,
  apiKey: string,
  baseUrl: string = "https://api.openai.com/v1",
  model: string = "gpt-4o"
): Promise<CaptionResult> => {
  if (!apiKey) throw new Error("请配置 OpenAI API Key");

  const url = `${cleanBaseUrl(baseUrl)}/chat/completions`;

  const systemInstruction = `You are an expert image captioning assistant for AI training.
OUTPUT INSTRUCTIONS:
Return a JSON object with two keys:
1. "en": The detailed English description based on the prompt.
2. "zh": A direct translation of that English description into Simplified Chinese.`;

  const body = {
    model: model,
    messages: [
      {
        role: "system",
        content: systemInstruction
      },
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`
            }
          }
        ]
      }
    ],
    response_format: { type: "json_object" }
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `OpenAI Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    
    if (!content) throw new Error("OpenAI 返回了空内容");

    try {
        return JSON.parse(content);
    } catch (e) {
        return { en: content, zh: "解析 JSON 失败" };
    }
  } catch (error) {
    console.error("OpenAI Generation Error:", error);
    throw error;
  }
};

export const translateToEnglishOpenAI = async (
  chineseText: string,
  apiKey: string,
  baseUrl: string = "https://api.openai.com/v1",
  model: string = "gpt-4o"
): Promise<string> => {
    if (!apiKey) throw new Error("请配置 OpenAI API Key");

    const url = `${cleanBaseUrl(baseUrl)}/chat/completions`;
    
    const body = {
        model: model,
        messages: [
            {
                role: "system",
                content: "You are a translator helper. Translate the user's Chinese text into detailed, descriptive English suitable for image generation prompts. Only return the translated text."
            },
            {
                role: "user",
                content: chineseText
            }
        ]
    };

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `OpenAI Translation Error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "";
};
