import { GoogleGenAI, Modality, Type } from "@google/genai";
import { AppSettings, AnalysisResult, TranslationResult } from '../types';
import { GEMINI_TRANSLATION_MODEL, GEMINI_TTS_MODEL } from '../constants';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Analyzes the context of the video transcript to determine tone and explicit content.
 */
export const analyzeContext = async (transcript: string): Promise<AnalysisResult> => {
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_TRANSLATION_MODEL,
      contents: `Analyze the following video transcript. 
      1. Determine if it contains explicit language (swearing, offensive terms).
      2. Summarize the context and tone (e.g., Tech review, casual, energetic).
      
      Transcript: "${transcript}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            hasExplicitContent: { type: Type.BOOLEAN },
            contextSummary: { type: Type.STRING },
            tone: { type: Type.STRING },
          },
          required: ["hasExplicitContent", "contextSummary", "tone"],
        },
      },
    });

    const result = JSON.parse(response.text || '{}');
    return {
      hasExplicitContent: result.hasExplicitContent || false,
      contextSummary: result.contextSummary || "General content",
      tone: result.tone || "Neutral",
    };
  } catch (error) {
    console.error("Error analyzing context:", error);
    return { hasExplicitContent: false, contextSummary: "Unknown", tone: "Neutral" };
  }
};

/**
 * Translates the text and generates audio using Gemini.
 */
export const processTranslation = async (
  transcript: string,
  settings: AppSettings,
  context: AnalysisResult
): Promise<TranslationResult> => {
  try {
    // 1. Contextual Translation
    const prompt = `
      You are an expert voice-over translator for a YouTube video.
      Target Audience: French speakers.
      Context: ${context.contextSummary}.
      Tone: ${context.tone}.
      Instruction: Translate the following English transcript to French. 
      - Make it sound natural and conversational, not robotic.
      - Match the energy of the original text.
      - ${settings.censureExplicit ? 'CENSOR explicit words with neutral, polite alternatives.' : 'KEEP the explicit language and slang to maintain authenticity.'}
      
      Transcript: "${transcript}"
      
      Return ONLY the translated text string.
    `;

    const translationResponse = await ai.models.generateContent({
      model: GEMINI_TRANSLATION_MODEL,
      contents: prompt,
    });

    const translatedText = translationResponse.text || "";

    // 2. TTS Generation
    // 'Puck' is a good generic voice, 'Kore' is female, 'Fenrir' is deep male.
    // Mapping rudimentary settings to voices.
    const voiceName = settings.voiceGender === 'female' ? 'Kore' : 'Fenrir';
    
    // Note: Gemini TTS currently generates English very well. 
    // It supports multi-lingual but for best French prosody we rely on the model's capabilities.
    const ttsResponse = await ai.models.generateContent({
        model: GEMINI_TTS_MODEL,
        contents: [{ parts: [{ text: translatedText }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: voiceName },
                },
            },
        },
    });

    const audioBase64 = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;

    return {
      originalText: transcript,
      translatedText: translatedText,
      audioBase64: audioBase64,
      duration: 0, // In a real app, we decode the header to get duration
    };

  } catch (error) {
    console.error("Translation processing error:", error);
    throw error;
  }
};

// Helper for decoding audio (client-side utility)
export const decodeAudio = async (base64: string, audioContext: AudioContext): Promise<AudioBuffer> => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return await audioContext.decodeAudioData(bytes.buffer);
};
