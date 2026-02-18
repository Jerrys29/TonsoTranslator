import { GoogleGenAI, Modality, Type } from "@google/genai";
import { AppSettings, AnalysisResult, TranslationResult, VoiceOption } from '../types';
import { GEMINI_TRANSLATION_MODEL, GEMINI_TTS_MODEL, SUPPORTED_LANGUAGES } from '../constants';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Analyzes the context, detects language and gender for voice cloning.
 */
export const analyzeContext = async (transcript: string): Promise<AnalysisResult> => {
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_TRANSLATION_MODEL,
      contents: `Analyze this transcript.
      1. Detect the source language.
      2. Guess the speaker's gender based on context or vocabulary (default to male if unsure).
      3. Identify explicit content.
      4. Summarize tone/context.
      
      Transcript: "${transcript.substring(0, 500)}..."`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detectedLanguage: { type: Type.STRING },
            detectedGender: { type: Type.STRING, enum: ['male', 'female'] },
            hasExplicitContent: { type: Type.BOOLEAN },
            contextSummary: { type: Type.STRING },
            tone: { type: Type.STRING },
          },
          required: ["detectedLanguage", "detectedGender", "hasExplicitContent", "contextSummary", "tone"],
        },
      },
    });

    const result = JSON.parse(response.text || '{}');
    return {
      detectedLanguage: result.detectedLanguage || "en",
      detectedGender: (result.detectedGender as 'male' | 'female') || "male",
      hasExplicitContent: result.hasExplicitContent || false,
      contextSummary: result.contextSummary || "General content",
      tone: result.tone || "Neutral",
    };
  } catch (error) {
    console.error("Error analyzing context:", error);
    return { detectedLanguage: "en", detectedGender: "male", hasExplicitContent: false, contextSummary: "Unknown", tone: "Neutral" };
  }
};

/**
 * Core translation and TTS logic. Used for both Preview and Full Video.
 */
export const processTranslation = async (
  textToTranslate: string,
  settings: AppSettings,
  context: AnalysisResult,
  selectedVoice: VoiceOption
): Promise<TranslationResult> => {
  try {
    const targetLangName = SUPPORTED_LANGUAGES.find(l => l.code === settings.targetLanguage)?.name || "French";

    // 1. Contextual Translation
    const prompt = `
      You are an expert voice-over translator.
      Target Language: ${targetLangName}.
      Context: ${context.contextSummary}.
      Tone: ${context.tone}.
      Source Text: "${textToTranslate}"
      
      Instructions:
      - Translate naturally, adapting idioms and slang.
      - ${settings.censureExplicit ? 'CENSOR explicit words (use polite equivalents).' : 'KEEP explicit nuances.'}
      - Return ONLY the translated text.
    `;

    const translationResponse = await ai.models.generateContent({
      model: GEMINI_TRANSLATION_MODEL,
      contents: prompt,
    });

    const translatedText = translationResponse.text || "";

    // 2. TTS Generation
    const ttsResponse = await ai.models.generateContent({
        model: GEMINI_TTS_MODEL,
        contents: [{ parts: [{ text: translatedText }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: selectedVoice.geminiVoiceName },
                },
            },
        },
    });

    const audioBase64 = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;

    // Calculate duration (PCM 24kHz Mono 16-bit)
    let duration = 0;
    if (audioBase64) {
      const byteLength = (audioBase64.length * 3) / 4; 
      duration = byteLength / 48000;
    }

    return {
      originalText: textToTranslate,
      translatedText: translatedText,
      audioBase64: audioBase64,
      duration: duration,
    };

  } catch (error) {
    console.error("Translation processing error:", error);
    throw error;
  }
};

export const decodeAudio = async (base64: string, audioContext: AudioContext): Promise<AudioBuffer> => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  const dataInt16 = new Int16Array(bytes.buffer);
  const numChannels = 1;
  const sampleRate = 24000;
  
  const buffer = audioContext.createBuffer(numChannels, dataInt16.length, sampleRate);
  const channelData = buffer.getChannelData(0);
  
  for (let i = 0; i < dataInt16.length; i++) {
     channelData[i] = dataInt16[i] / 32768.0;
  }
  return buffer;
};
