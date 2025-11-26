
export interface TaggedImage {
  id: string;
  file: File;
  previewUrl: string;
  caption: string; // English (Official for Flux)
  captionZh: string; // Chinese (Preview/Helper)
  status: 'idle' | 'loading' | 'success' | 'error' | 'translating';
  errorMessage?: string;
  selected?: boolean;
}

export type AiProvider = 'gemini' | 'openai';

export interface AppSettings {
  prefix: string;
  suffix: string;
  customPrompt: string;
  customApiKey: string;
  // Provider settings
  provider: AiProvider;
  // OpenAI specific settings
  openaiApiKey: string;
  openaiBaseUrl: string;
  openaiModel: string;
}

export interface CaptionResult {
  en: string;
  zh: string;
}

export const DEFAULT_PROMPT = `Describe this image in detail for training a Flux text-to-image model.
Focus on the subject, animal features, facial features, and composition. Include descriptions of shapes.
Use natural language sentences. Do not use "The image shows". Do not describe style. Do not describe background. Do not use words like "like", "similar to", or "possibly". Start directly with the description.`;
