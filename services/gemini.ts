import { GoogleGenAI, Type } from "@google/genai";
import { CaptionResult } from "../types";

// Generate both English and Chinese captions
export const generateCaption = async (
  base64Image: string,
  mimeType: string,
  prompt: string,
  apiKey?: string
): Promise<CaptionResult> => {
  // Use custom key if provided, otherwise fallback to environment key
  const finalApiKey = apiKey?.trim() || process.env.API_KEY;
  
  // Note: We don't throw immediately if key is missing here, the SDK will throw a specific error
  const ai = new GoogleGenAI({ apiKey: finalApiKey });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Image,
              mimeType: mimeType,
            },
          },
          {
            text: `${prompt}
            
            OUTPUT INSTRUCTIONS:
            Return a JSON object with two keys:
            1. "en": The detailed English description based on the prompt above.
            2. "zh": A direct translation of that English description into Simplified Chinese.`,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            en: { type: Type.STRING },
            zh: { type: Type.STRING },
          },
          required: ["en", "zh"],
        },
      },
    });

    const text = response.text || "{}";
    try {
        return JSON.parse(text);
    } catch (e) {
        // Fallback if JSON parsing fails (rare with schema)
        return { en: text, zh: "解析失败" };
    }
  } catch (error) {
    // Let App.tsx handle errors (including 429 retries) without spamming console
    throw error;
  }
};

// Translate Chinese back to English for Flux
export const translateToEnglish = async (chineseText: string, apiKey?: string): Promise<string> => {
  const finalApiKey = apiKey?.trim() || process.env.API_KEY;
  const ai = new GoogleGenAI({ apiKey: finalApiKey });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Translate the following Chinese text to detailed English suitable for image generation prompts. Keep it descriptive.
      
      Text: "${chineseText}"`,
    });
    return response.text || "";
  } catch (error) {
    console.error("Translation error:", error);
    throw error;
  }
};
