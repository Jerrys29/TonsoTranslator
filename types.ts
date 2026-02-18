export type LanguageCode = 'en' | 'fr' | 'es' | 'de' | 'ja' | 'ar' | 'pt';

export interface Language {
  code: LanguageCode;
  name: string;
  flag: string;
}

export interface VoiceOption {
  id: string;
  name: string;
  gender: 'male' | 'female';
  type: 'cloned' | 'synthetic';
  geminiVoiceName: string; // Map to valid Gemini voice names
}

export interface AppSettings {
  sourceLanguage: LanguageCode | 'auto';
  targetLanguage: LanguageCode;
  selectedVoiceId: string;
  censureExplicit: boolean;
  showSubtitles: boolean;
}

export enum ProcessingState {
  IDLE = 'IDLE',
  ANALYZING_METADATA = 'ANALYZING_METADATA', // Language detection + Context
  WAITING_USER_INPUT = 'WAITING_USER_INPUT', // Explicit content warning
  VOICE_STUDIO = 'VOICE_STUDIO', // Voice selection & Preview
  GENERATING_PREVIEW = 'GENERATING_PREVIEW',
  TRANSLATING_FULL = 'TRANSLATING_FULL',
  READY_TO_PLAY = 'READY_TO_PLAY',
  PLAYING = 'PLAYING',
  ERROR = 'ERROR'
}

export interface SubtitleChunk {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
}

export interface TranslationResult {
  originalText: string;
  translatedText: string;
  audioBase64: string | null;
  duration: number;
}

export interface AnalysisResult {
  detectedLanguage: string;
  detectedGender: 'male' | 'female';
  hasExplicitContent: boolean;
  contextSummary: string;
  tone: string;
}