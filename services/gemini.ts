import { GoogleGenAI, Type } from "@google/genai";
import { CaptionResult } from "../types";

// Helper to safely get API Key from environment (Vite specific)
const getEnvironmentApiKey = () => {
    // Try Vite environment variable (Standard for React/Vite apps)
    try {
        // Cast import.meta to any to avoid TypeScript errors if types aren't set up
        const meta = import.meta as any;
        if (typeof meta !== 'undefined' && meta.env && meta.env.VITE_API_KEY) {
            return meta.env.VITE_API_KEY as string;
        }
    } catch (e) {
        // Ignore errors if import.meta is not available
    }

    return "";
};

// Generate both English and Chinese captions
export const generateCaption = async (
  base64Image: string,
  mimeType: string,
  prompt: string,
  apiKey?: string
): Promise<CaptionResult> => {
  // Use custom key if provided, otherwise fallback to environment key safely
  const finalApiKey = apiKey?.trim() || getEnvironmentApiKey();
  
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
  const finalApiKey = apiKey?.trim() || getEnvironmentApiKey();
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