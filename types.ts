export interface AppSettings {
  voiceGender: 'male' | 'female';
  censureExplicit: boolean;
  showSubtitles: boolean;
  accent: 'fr-FR' | 'fr-CA';
}

export enum ProcessingState {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING', // Checking context/toxicity
  WAITING_USER_INPUT = 'WAITING_USER_INPUT', // 18+ check
  TRANSLATING = 'TRANSLATING',
  READY = 'READY',
  PLAYING = 'PLAYING',
  ERROR = 'ERROR'
}

export interface SubtitleChunk {
  id: string;
  startTime: number; // in seconds
  endTime: number; // in seconds
  text: string;
}

export interface TranslationResult {
  originalText: string;
  translatedText: string;
  audioBase64: string | null;
  duration: number;
}

export interface AnalysisResult {
  hasExplicitContent: boolean;
  contextSummary: string;
  tone: string;
}