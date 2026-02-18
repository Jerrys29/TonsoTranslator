import { Language, VoiceOption, AppSettings } from './types';

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en', name: 'Anglais', flag: '🇺🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Espagnol', flag: '🇪🇸' },
  { code: 'de', name: 'Allemand', flag: '🇩🇪' },
  { code: 'ja', name: 'Japonais', flag: '🇯🇵' },
  { code: 'ar', name: 'Arabe', flag: '🇸🇦' },
  { code: 'pt', name: 'Portugais', flag: '🇵🇹' },
];

export const AVAILABLE_VOICES: VoiceOption[] = [
  { id: 'cloned-v1', name: 'Voix Clonée (Originale)', gender: 'male', type: 'cloned', geminiVoiceName: 'Fenrir' }, // Simulating clone with deep voice
  { id: 'syn-f-1', name: 'Sarah (Synthétique)', gender: 'female', type: 'synthetic', geminiVoiceName: 'Kore' },
  { id: 'syn-m-1', name: 'Thomas (Synthétique)', gender: 'male', type: 'synthetic', geminiVoiceName: 'Puck' },
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

// Mock transcript extended for demo
export const MOCK_TRANSCRIPT = `
Hey guys, what's up! Welcome back to the channel. 
Today, we're gonna talk about something completely insane. 
Honestly, this tech is simpler than it looks, but it's gonna blow your mind.
Usually, people screw this up immediately, but I'm gonna show you the real deal.
Wait, did you see that? Holy sh*t, that was fast!
Let's dive right in and break this down, piece by piece.
`;

export const GEMINI_TRANSLATION_MODEL = 'gemini-3-flash-preview';
export const GEMINI_TTS_MODEL = 'gemini-2.5-flash-preview-tts';
