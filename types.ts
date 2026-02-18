export type LanguageCode = 'en' | 'fr' | 'es' | 'de' | 'ja' | 'ar' | 'pt' | 'zh' | 'ru' | 'ko' | 'it' | 'hi' | 'tr' | 'pl' | 'nl';

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
  geminiVoiceName: string;
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
  PREVIEWING_VIDEO = 'PREVIEWING_VIDEO',   // Showing thumbnail preview before starting
  FETCHING_TRANSCRIPT = 'FETCHING_TRANSCRIPT',
  ANALYZING_METADATA = 'ANALYZING_METADATA',
  WAITING_USER_INPUT = 'WAITING_USER_INPUT',
  VOICE_STUDIO = 'VOICE_STUDIO',
  GENERATING_PREVIEW = 'GENERATING_PREVIEW',
  TRANSLATING_SEGMENTS = 'TRANSLATING_SEGMENTS',
  READY_TO_PLAY = 'READY_TO_PLAY',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  ERROR = 'ERROR'
}

// ── Video Metadata (from oEmbed) ──
export interface VideoMetadata {
  videoId: string;
  title: string;
  channelName: string;
  thumbnailUrl: string;
  thumbnailFallback: string;
}

// ── YouTube Transcript ──
export interface TranscriptSegment {
  text: string;
  offset: number;   // start time in seconds
  duration: number;  // duration in seconds
}

// ── Grouped segments for coherent translation ──
export interface TranscriptChunk {
  id: number;
  segments: TranscriptSegment[];
  startTime: number;  // start of first segment
  endTime: number;    // end of last segment
  fullText: string;   // concatenated text of all segments
}

// ── Translated result per chunk ──
export interface TranslatedChunk {
  id: number;
  startTime: number;
  endTime: number;
  originalText: string;
  translatedText: string;
  audioBase64: string | null;
  audioDuration: number;
}

// ── Subtitle display ──
export interface SubtitleChunk {
  id: number;
  startTime: number;
  endTime: number;
  text: string;
}

// ── Full translation result ──
export interface TranslationResult {
  chunks: TranslatedChunk[];
  subtitles: SubtitleChunk[];
  totalDuration: number;
}

// ── Progress tracking ──
export interface TranslationProgress {
  currentChunk: number;
  totalChunks: number;
  percentage: number;
  currentText: string;
  phase: 'translating' | 'generating_audio';
}

// ── Context analysis ──
export interface AnalysisResult {
  detectedLanguage: string;
  detectedGender: 'male' | 'female';
  hasExplicitContent: boolean;
  contextSummary: string;
  tone: string;
  subjectMatter: string;
  targetAudience: string;
  languageRegister: string;
  culturalReferences: string;
  keyTerminology: string[];
}