import { Language, VoiceOption, AppSettings } from './types';

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en', name: 'Anglais', flag: '🇺🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Espagnol', flag: '🇪🇸' },
  { code: 'de', name: 'Allemand', flag: '🇩🇪' },
  { code: 'ja', name: 'Japonais', flag: '🇯🇵' },
  { code: 'ar', name: 'Arabe', flag: '🇸🇦' },
  { code: 'pt', name: 'Portugais', flag: '🇵🇹' },
  { code: 'zh', name: 'Chinois', flag: '🇨🇳' },
  { code: 'ru', name: 'Russe', flag: '🇷🇺' },
  { code: 'ko', name: 'Coréen', flag: '🇰🇷' },
  { code: 'it', name: 'Italien', flag: '🇮🇹' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
  { code: 'tr', name: 'Turc', flag: '🇹🇷' },
  { code: 'pl', name: 'Polonais', flag: '🇵🇱' },
  { code: 'nl', name: 'Néerlandais', flag: '🇳🇱' },
];

export const AVAILABLE_VOICES: VoiceOption[] = [
  { id: 'cloned-v1', name: 'Voix Clonée (Originale)', gender: 'male', type: 'cloned', geminiVoiceName: 'Fenrir' },
  { id: 'syn-f-1', name: 'Sarah (Naturelle)', gender: 'female', type: 'synthetic', geminiVoiceName: 'Kore' },
  { id: 'syn-m-1', name: 'Thomas (Dynamique)', gender: 'male', type: 'synthetic', geminiVoiceName: 'Puck' },
  { id: 'syn-f-2', name: 'Emma (Douce)', gender: 'female', type: 'synthetic', geminiVoiceName: 'Zephyr' },
  { id: 'syn-m-2', name: 'Marcus (Grave)', gender: 'male', type: 'synthetic', geminiVoiceName: 'Charon' },
];

export const DEFAULT_SETTINGS: AppSettings = {
  sourceLanguage: 'auto',
  targetLanguage: 'fr',
  selectedVoiceId: 'cloned-v1',
  censureExplicit: false,
  showSubtitles: true,
};

export const GEMINI_TRANSLATION_MODEL = 'gemini-2.5-flash-preview-05-20';
export const GEMINI_TTS_MODEL = 'gemini-2.5-flash-preview-tts';

// Chunk grouping settings
export const CHUNK_MAX_DURATION_SEC = 15; // Max seconds per chunk for translation
export const CHUNK_MIN_DURATION_SEC = 3;  // Min seconds to avoid tiny chunks
