import { GoogleGenAI, Modality, Type } from "@google/genai";
import {
  AppSettings, AnalysisResult, TranscriptChunk,
  TranslatedChunk, TranslationProgress, VoiceOption
} from '../types';
import { GEMINI_TRANSLATION_MODEL, GEMINI_TTS_MODEL, SUPPORTED_LANGUAGES } from '../constants';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// ═════════════════════════════════════════════════════════════
// UTILITY: Auto-retry on rate limit (429) errors
// ═════════════════════════════════════════════════════════════
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const status = error?.status || error?.code || error?.httpErrorCode;
      const isRateLimit = status === 429 || error?.message?.includes('RESOURCE_EXHAUSTED') || error?.message?.includes('429');

      if (isRateLimit && attempt < maxRetries) {
        // Extract retry delay from error or default to 60s
        const retryMatch = error?.message?.match(/retry in (\d+)/i);
        const waitSec = retryMatch ? parseInt(retryMatch[1]) + 5 : 60;
        console.warn(`[Gemini] Rate limited. Waiting ${waitSec}s before retry ${attempt + 1}/${maxRetries}...`);
        await new Promise(r => setTimeout(r, waitSec * 1000));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}

// ═════════════════════════════════════════════════════════════
// STEP 1: Deep Context Analysis
// Analyzes the FULL transcript to understand context, tone,
// cultural references, terminology — BEFORE any translation.
// ═════════════════════════════════════════════════════════════

export const analyzeContext = async (fullTranscript: string): Promise<AnalysisResult> => {
  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: GEMINI_TRANSLATION_MODEL,
      contents: `Tu es un expert en analyse linguistique et culturelle. Analyse en profondeur ce transcript vidéo.

TRANSCRIPT:
"""
${fullTranscript.substring(0, 3000)}
"""

Analyse :
1. La langue parlée (code ISO comme "en", "fr", "es"...)
2. Le genre du locuteur principal (male/female) — déduit du vocabulaire, pronoms, contexte
3. Si le contenu contient du langage explicite (jurons, vulgarité, contenu adulte)
4. Un résumé du contexte global (de quoi parle la vidéo, quel est le sujet)
5. Le ton général (humoristique, sérieux, didactique, énergique, décontracté, etc.)
6. Le sujet principal traité
7. Le public cible (enfants, ados, adultes, professionnels, gamers, etc.)
8. Le registre de langage (familier, courant, soutenu, argотique, technique)
9. Les références culturelles détectées (memes, expressions locales, personnalités, marques)
10. Les termes techniques ou mots-clés importants qui doivent être traduits de manière cohérente`,
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
            subjectMatter: { type: Type.STRING },
            targetAudience: { type: Type.STRING },
            languageRegister: { type: Type.STRING },
            culturalReferences: { type: Type.STRING },
            keyTerminology: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: [
            "detectedLanguage", "detectedGender", "hasExplicitContent",
            "contextSummary", "tone", "subjectMatter", "targetAudience",
            "languageRegister", "culturalReferences", "keyTerminology"
          ],
        },
      },
    }));

    const result = JSON.parse(response.text || '{}');
    return {
      detectedLanguage: result.detectedLanguage || "en",
      detectedGender: (result.detectedGender as 'male' | 'female') || "male",
      hasExplicitContent: result.hasExplicitContent || false,
      contextSummary: result.contextSummary || "Contenu général",
      tone: result.tone || "Neutre",
      subjectMatter: result.subjectMatter || "Non déterminé",
      targetAudience: result.targetAudience || "Grand public",
      languageRegister: result.languageRegister || "Courant",
      culturalReferences: result.culturalReferences || "Aucune",
      keyTerminology: result.keyTerminology || [],
    };
  } catch (error) {
    console.error("Error analyzing context:", error);
    return {
      detectedLanguage: "en",
      detectedGender: "male",
      hasExplicitContent: false,
      contextSummary: "Analyse indisponible",
      tone: "Neutre",
      subjectMatter: "Non déterminé",
      targetAudience: "Grand public",
      languageRegister: "Courant",
      culturalReferences: "Aucune",
      keyTerminology: [],
    };
  }
};

// ═════════════════════════════════════════════════════════════
// STEP 2: Contextual Translation — Segment by Segment
// Each chunk gets translated with FULL context awareness.
// Not word-for-word — faithful, natural, idiomatic.
// ═════════════════════════════════════════════════════════════

const translateChunkText = async (
  chunk: TranscriptChunk,
  settings: AppSettings,
  context: AnalysisResult,
  previousTranslations: string[] // For terminological consistency
): Promise<string> => {
  const targetLangName = SUPPORTED_LANGUAGES.find(l => l.code === settings.targetLanguage)?.name || "Français";

  const recentContext = previousTranslations.length > 0
    ? `\n\nTRADUCTIONS PRÉCÉDENTES (pour cohérence terminologique) :\n${previousTranslations.slice(-3).join('\n')}`
    : '';

  const prompt = `Tu es un expert en doublage et adaptation linguistique professionnelle pour la vidéo.

CONTEXTE DE LA VIDÉO :
- Sujet : ${context.subjectMatter}
- Ton : ${context.tone}
- Public cible : ${context.targetAudience}
- Registre : ${context.languageRegister}
- Références culturelles : ${context.culturalReferences}
- Termes clés à maintenir cohérents : ${context.keyTerminology.join(', ')}
${recentContext}

LANGUE CIBLE : ${targetLangName}

TEXTE À TRADUIRE :
"${chunk.fullText}"

INSTRUCTIONS DE TRADUCTION :
1. NE fais PAS de traduction mot-à-mot. Adapte le sens, le style et le rythme.
2. Respecte le registre de langage du créateur (${context.languageRegister}).
3. Adapte les expressions idiomatiques en équivalents naturels dans la langue cible.
4. Conserve l'humour, l'énergie et les émotions du texte original.
5. Les références culturelles doivent être adaptées si elles n'ont pas d'équivalent direct, ou conservées si elles sont universellement connues.
6. Le texte traduit doit avoir une longueur similaire à l'original (pour le timing du doublage).
7. ${settings.censureExplicit ? 'CENSURE les mots explicites — remplace-les par des équivalents polis sans casser le flux naturel de la phrase.' : 'CONSERVE le langage explicite tel quel, adapté naturellement dans la langue cible.'}
8. Maintiens la cohérence terminologique avec les traductions précédentes.

Retourne UNIQUEMENT le texte traduit, sans guillemets ni explications.`;

  const response = await withRetry(() => ai.models.generateContent({
    model: GEMINI_TRANSLATION_MODEL,
    contents: prompt,
  }));

  return (response.text || "").trim();
};

// ═════════════════════════════════════════════════════════════
// STEP 3: TTS Generation per Chunk
// ═════════════════════════════════════════════════════════════

const generateTTS = async (
  text: string,
  voice: VoiceOption
): Promise<{ audioBase64: string | null; duration: number }> => {
  try {
    const ttsResponse = await withRetry(() => ai.models.generateContent({
      model: GEMINI_TTS_MODEL,
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice.geminiVoiceName },
          },
        },
      },
    }));

    const audioBase64 = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;

    // Calculate real duration from PCM data (16-bit, 24kHz, Mono)
    let duration = 0;
    if (audioBase64) {
      const byteLength = (audioBase64.length * 3) / 4;
      const samples = byteLength / 2; // 16-bit = 2 bytes per sample
      duration = samples / 24000;     // 24kHz sample rate
    }

    return { audioBase64, duration };
  } catch (error) {
    console.error("TTS generation error:", error);
    return { audioBase64: null, duration: 0 };
  }
};

// ═════════════════════════════════════════════════════════════
// MAIN PIPELINE: Translate all chunks with progress callback
// ═════════════════════════════════════════════════════════════

export const translateAllChunks = async (
  chunks: TranscriptChunk[],
  settings: AppSettings,
  context: AnalysisResult,
  voice: VoiceOption,
  onProgress: (progress: TranslationProgress) => void
): Promise<TranslatedChunk[]> => {
  const translatedChunks: TranslatedChunk[] = [];
  const previousTranslations: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    // Phase 1: Translation
    onProgress({
      currentChunk: i + 1,
      totalChunks: chunks.length,
      percentage: Math.round(((i * 2) / (chunks.length * 2)) * 100),
      currentText: chunk.fullText.substring(0, 60) + (chunk.fullText.length > 60 ? '...' : ''),
      phase: 'translating',
    });

    const translatedText = await translateChunkText(chunk, settings, context, previousTranslations);
    previousTranslations.push(translatedText);

    // Phase 2: TTS
    onProgress({
      currentChunk: i + 1,
      totalChunks: chunks.length,
      percentage: Math.round(((i * 2 + 1) / (chunks.length * 2)) * 100),
      currentText: translatedText.substring(0, 60) + (translatedText.length > 60 ? '...' : ''),
      phase: 'generating_audio',
    });

    const { audioBase64, duration } = await generateTTS(translatedText, voice);

    translatedChunks.push({
      id: chunk.id,
      startTime: chunk.startTime,
      endTime: chunk.endTime,
      originalText: chunk.fullText,
      translatedText,
      audioBase64,
      audioDuration: duration,
    });
  }

  // Final 100%
  onProgress({
    currentChunk: chunks.length,
    totalChunks: chunks.length,
    percentage: 100,
    currentText: 'Terminé !',
    phase: 'generating_audio',
  });

  return translatedChunks;
};

// ═════════════════════════════════════════════════════════════
// PREVIEW: Quick translation of a single short segment
// ═════════════════════════════════════════════════════════════

export const generatePreview = async (
  sampleText: string,
  settings: AppSettings,
  context: AnalysisResult,
  voice: VoiceOption
): Promise<string | null> => {
  const targetLangName = SUPPORTED_LANGUAGES.find(l => l.code === settings.targetLanguage)?.name || "Français";

  const prompt = `Traduis ce court extrait en ${targetLangName} de manière naturelle et fidèle au ton (${context.tone}, ${context.languageRegister}).
${settings.censureExplicit ? 'Censure les mots explicites.' : 'Conserve le langage original.'}
Texte : "${sampleText}"
Retourne UNIQUEMENT la traduction.`;

  const translationResponse = await withRetry(() => ai.models.generateContent({
    model: GEMINI_TRANSLATION_MODEL,
    contents: prompt,
  }));

  const translatedText = (translationResponse.text || "").trim();

  const { audioBase64 } = await generateTTS(translatedText, voice);
  return audioBase64;
};

// ═════════════════════════════════════════════════════════════
// AUDIO UTILITY: Decode PCM base64 to AudioBuffer
// ═════════════════════════════════════════════════════════════

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
