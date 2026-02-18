export const DEFAULT_SETTINGS = {
  voiceGender: 'female',
  censureExplicit: false,
  showSubtitles: true,
  accent: 'fr-FR',
};

// Since we cannot scrape YouTube client-side due to CORS, 
// we use a mock English transcript for demonstration purposes.
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
