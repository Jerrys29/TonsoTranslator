import React, { useState } from 'react';
import {
  AppSettings, ProcessingState, TranslationProgress as ProgressType,
  TranscriptChunk, TranslatedChunk, AnalysisResult, VideoMetadata
} from './types';
import { DEFAULT_SETTINGS, AVAILABLE_VOICES } from './constants';
import VideoPlayer from './components/VideoPlayer';
import SettingsModal from './components/SettingsModal';
import ExplicitContentWarning from './components/ExplicitContentWarning';
import LanguageConfig from './components/LanguageConfig';
import VoiceStudio from './components/VoiceStudio';
import TranslationProgress from './components/TranslationProgress';
import VideoPreviewCard from './components/VideoPreviewCard';
import { analyzeContext, translateAllChunks } from './services/geminiService';
import { fetchTranscript, fetchVideoMetadata, groupSegmentsIntoChunks, extractVideoId } from './services/youtubeService';

const App: React.FC = () => {
  // State
  const [urlInput, setUrlInput] = useState('');
  const [videoId, setVideoId] = useState<string | null>(null);
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [processingState, setProcessingState] = useState<ProcessingState>(ProcessingState.IDLE);
  const [showSettings, setShowSettings] = useState(false);
  const [showContentWarning, setShowContentWarning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFetchingPreview, setIsFetchingPreview] = useState(false);

  // Data
  const [contextResult, setContextResult] = useState<AnalysisResult | null>(null);
  const [transcriptChunks, setTranscriptChunks] = useState<TranscriptChunk[]>([]);
  const [translatedChunks, setTranslatedChunks] = useState<TranslatedChunk[]>([]);
  const [translationProgress, setTranslationProgress] = useState<ProgressType | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);

  // ═══════════════════════════════════════════
  // STEP 0: Fetch Video Metadata (oEmbed preview)
  // ═══════════════════════════════════════════
  const handleUrlSubmit = async () => {
    const id = extractVideoId(urlInput.trim());
    if (!id) {
      setErrorMessage("URL YouTube invalide. Collez une URL comme https://youtube.com/watch?v=...");
      return;
    }

    setErrorMessage(null);
    setIsFetchingPreview(true);

    try {
      const metadata = await fetchVideoMetadata(id);
      setVideoId(id);
      setVideoMetadata(metadata);
      setProcessingState(ProcessingState.PREVIEWING_VIDEO);
    } catch (err: any) {
      setErrorMessage(err.message || "Impossible de charger la vidéo.");
    } finally {
      setIsFetchingPreview(false);
    }
  };

  // ═══════════════════════════════════════════
  // STEP 1: Fetch Transcript + Analyze Context
  // ═══════════════════════════════════════════
  const handleStartAnalysis = async () => {
    if (!process.env.API_KEY) {
      setErrorMessage("Clé API Gemini manquante. Créez un fichier .env.local avec GEMINI_API_KEY=votre_clé");
      setProcessingState(ProcessingState.ERROR);
      return;
    }
    if (!videoId) return;

    setErrorMessage(null);
    setProcessingState(ProcessingState.FETCHING_TRANSCRIPT);

    try {
      // 1. Fetch real YouTube transcript
      const segments = await fetchTranscript(videoId);
      if (segments.length === 0) {
        setErrorMessage("Aucun sous-titre trouvé pour cette vidéo.");
        setProcessingState(ProcessingState.ERROR);
        return;
      }

      // 2. Group segments into coherent chunks
      const chunks = groupSegmentsIntoChunks(segments);
      setTranscriptChunks(chunks);

      // 3. Analyze full context
      setProcessingState(ProcessingState.ANALYZING_METADATA);
      const fullTranscript = chunks.map(c => c.fullText).join(' ');
      const analysis = await analyzeContext(fullTranscript);
      setContextResult(analysis);

      // Auto-select voice matching detected gender
      const matchingVoice = AVAILABLE_VOICES.find(
        v => v.type === 'cloned' && v.gender === analysis.detectedGender
      ) || AVAILABLE_VOICES[0];
      setSettings(prev => ({ ...prev, selectedVoiceId: matchingVoice.id }));

      // Check for explicit content
      if (analysis.hasExplicitContent) {
        setProcessingState(ProcessingState.WAITING_USER_INPUT);
        setShowContentWarning(true);
      } else {
        setProcessingState(ProcessingState.IDLE);
      }
    } catch (error: any) {
      setErrorMessage(error.message || "Erreur lors de l'analyse de la vidéo.");
      setProcessingState(ProcessingState.ERROR);
    }
  };

  // ═══════════════════════════════════════════
  // STEP 2: Handle Explicit Content Decision
  // ═══════════════════════════════════════════
  const handleExplicitDecision = (shouldCensure: boolean) => {
    setShowContentWarning(false);
    setSettings(prev => ({ ...prev, censureExplicit: shouldCensure }));
    setProcessingState(ProcessingState.IDLE);
  };

  // ═══════════════════════════════════════════
  // STEP 3: Full Translation Pipeline
  // ═══════════════════════════════════════════
  const handleFullTranslation = async () => {
    if (!contextResult || transcriptChunks.length === 0) return;

    setProcessingState(ProcessingState.TRANSLATING_SEGMENTS);
    setTranslationProgress(null);

    try {
      const selectedVoice = AVAILABLE_VOICES.find(
        v => v.id === settings.selectedVoiceId
      ) || AVAILABLE_VOICES[0];

      const result = await translateAllChunks(
        transcriptChunks,
        settings,
        contextResult,
        selectedVoice,
        (progress) => setTranslationProgress(progress)
      );

      setTranslatedChunks(result);
      setProcessingState(ProcessingState.READY_TO_PLAY);

      // Auto-play after a brief delay
      setTimeout(() => setProcessingState(ProcessingState.PLAYING), 800);
    } catch (error: any) {
      setErrorMessage(error.message || "Erreur lors de la traduction.");
      setProcessingState(ProcessingState.ERROR);
    }
  };

  // ═══════════════════════════════════════════
  // RESET
  // ═══════════════════════════════════════════
  const handleReset = () => {
    setVideoId(null);
    setVideoMetadata(null);
    setProcessingState(ProcessingState.IDLE);
    setTranslatedChunks([]);
    setTranscriptChunks([]);
    setUrlInput('');
    setContextResult(null);
    setTranslationProgress(null);
    setErrorMessage(null);
  };

  // ═══════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════
  return (
    <div className="min-h-screen flex flex-col items-center p-4 md:p-8">

      {/* Header */}
      <header className="w-full max-w-6xl flex justify-between items-center mb-8">
        <div className="flex items-center gap-3 cursor-pointer" onClick={handleReset}>
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <span className="text-white font-bold text-xl">T</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">tonso.</h1>
        </div>
        {videoId && processingState !== ProcessingState.PREVIEWING_VIDEO && (
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 text-slate-400 hover:text-white transition-colors"
          >
            ⚙️
          </button>
        )}
      </header>

      {/* Main Content */}
      <main className="w-full max-w-5xl flex flex-col items-center">

        {/* ── LANDING PAGE ── */}
        {processingState === ProcessingState.IDLE && !videoId && !errorMessage && (
          <div className="w-full flex flex-col items-center text-center space-y-8 mt-12">
            <div className="space-y-4 max-w-3xl">
              <h2 className="text-5xl md:text-7xl font-bold text-white leading-tight tracking-tight">
                Brisez les barrières <br />
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-indigo-400">
                  linguistiques.
                </span>
              </h2>
              <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto">
                Doublage vidéo IA avec traduction contextuelle intelligente.
                Fidèle au style, au ton et au vocabulaire du créateur original.
              </p>
            </div>

            {/* URL Input */}
            <div className="w-full max-w-xl relative group mt-8">
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-indigo-600 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-500"></div>
              <div className="relative flex bg-slate-800 rounded-xl p-2 shadow-2xl border border-slate-700">
                <input
                  type="text"
                  placeholder="Collez une URL YouTube..."
                  className="flex-1 bg-transparent border-none outline-none text-white px-4 placeholder-slate-500"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
                />
                <button
                  onClick={handleUrlSubmit}
                  disabled={isFetchingPreview || !urlInput.trim()}
                  className="bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  {isFetchingPreview ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    '→'
                  )}
                </button>
              </div>
            </div>

            {/* Error inline */}
            {errorMessage && (
              <p className="text-red-400 text-sm mt-2">{errorMessage}</p>
            )}

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 text-left w-full max-w-4xl">
              <div className="bg-slate-800/30 p-6 rounded-2xl border border-slate-700/50">
                <div className="text-3xl mb-3">🧠</div>
                <h3 className="text-white font-bold mb-2">Traduction Contextuelle</h3>
                <p className="text-slate-500 text-sm">Respecte l'argot, l'humour, le ton et les références culturelles du créateur.</p>
              </div>
              <div className="bg-slate-800/30 p-6 rounded-2xl border border-slate-700/50">
                <div className="text-3xl mb-3">🌍</div>
                <h3 className="text-white font-bold mb-2">15+ Langues</h3>
                <p className="text-slate-500 text-sm">Français, Anglais, Japonais, Arabe, Chinois, Coréen et bien plus.</p>
              </div>
              <div className="bg-slate-800/30 p-6 rounded-2xl border border-slate-700/50">
                <div className="text-3xl mb-3">🎙️</div>
                <h3 className="text-white font-bold mb-2">Voice Studio</h3>
                <p className="text-slate-500 text-sm">Prévisualisez et choisissez la voix parfaite avant le doublage.</p>
              </div>
            </div>
          </div>
        )}

        {/* ── VIDEO PREVIEW CARD ── */}
        {processingState === ProcessingState.PREVIEWING_VIDEO && videoMetadata && (
          <div className="w-full flex flex-col items-center mt-8 space-y-4">
            <p className="text-slate-400 text-sm">Confirmez la vidéo à traduire</p>
            <VideoPreviewCard
              metadata={videoMetadata}
              onConfirm={handleStartAnalysis}
              onCancel={handleReset}
            />
          </div>
        )}

        {/* ── ERROR STATE (full page) ── */}
        {processingState === ProcessingState.ERROR && (
          <div className="w-full max-w-xl mt-12">
            <div className="bg-red-900/20 border border-red-500/30 rounded-2xl p-6 text-center">
              <div className="text-4xl mb-4">❌</div>
              <h3 className="text-xl font-bold text-white mb-2">Oops !</h3>
              <p className="text-red-300 mb-6">{errorMessage || "Une erreur inattendue s'est produite."}</p>
              <button
                onClick={handleReset}
                className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-xl font-medium transition-colors"
              >
                ← Réessayer
              </button>
            </div>
          </div>
        )}

        {/* ── FETCHING TRANSCRIPT ── */}
        {processingState === ProcessingState.FETCHING_TRANSCRIPT && (
          <div className="flex flex-col items-center mt-20">
            <div className="w-16 h-16 border-4 border-slate-700 border-t-cyan-500 rounded-full animate-spin mb-6"></div>
            <h3 className="text-white text-xl font-medium">Récupération du transcript...</h3>
            <p className="text-slate-500">Extraction des sous-titres YouTube avec timestamps</p>
          </div>
        )}

        {/* ── ANALYZING METADATA ── */}
        {processingState === ProcessingState.ANALYZING_METADATA && (
          <div className="flex flex-col items-center mt-20">
            <div className="w-16 h-16 border-4 border-slate-700 border-t-indigo-500 rounded-full animate-spin mb-6"></div>
            <h3 className="text-white text-xl font-medium">Analyse contextuelle en cours...</h3>
            <p className="text-slate-500">Détection du ton, du registre, des références culturelles et du vocabulaire</p>
          </div>
        )}

        {/* ── LANGUAGE CONFIGURATION ── */}
        {videoId && contextResult && !showContentWarning && processingState === ProcessingState.IDLE && (
          <div className="w-full space-y-4">
            {/* Video info bar */}
            {videoMetadata && (
              <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 flex items-center gap-4">
                <img
                  src={videoMetadata.thumbnailFallback}
                  alt={videoMetadata.title}
                  className="w-16 h-10 object-cover rounded-lg"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">{videoMetadata.title}</p>
                  <p className="text-slate-500 text-xs">{transcriptChunks.length} segments • {contextResult.detectedLanguage} • {contextResult.tone}</p>
                </div>
              </div>
            )}
            <LanguageConfig
              settings={settings}
              updateSettings={(s) => setSettings({ ...settings, ...s })}
              onContinue={() => setProcessingState(ProcessingState.VOICE_STUDIO)}
            />
          </div>
        )}

        {/* ── VOICE STUDIO ── */}
        {(processingState === ProcessingState.VOICE_STUDIO || processingState === ProcessingState.GENERATING_PREVIEW) && contextResult && (
          <VoiceStudio
            settings={settings}
            updateSettings={(s) => setSettings({ ...settings, ...s })}
            analysis={contextResult}
            chunks={transcriptChunks}
            onConfirm={handleFullTranslation}
            isGeneratingPreview={isGeneratingPreview}
            setIsGeneratingPreview={setIsGeneratingPreview}
          />
        )}

        {/* ── TRANSLATION PROGRESS ── */}
        {processingState === ProcessingState.TRANSLATING_SEGMENTS && translationProgress && (
          <TranslationProgress progress={translationProgress} />
        )}

        {/* ── VIDEO PLAYER ── */}
        {videoId && (processingState === ProcessingState.READY_TO_PLAY ||
          processingState === ProcessingState.PLAYING ||
          processingState === ProcessingState.PAUSED) && (
            <div className="w-full">
              <div className="flex items-center gap-2 mb-4">
                <button onClick={handleReset} className="text-slate-500 hover:text-slate-300 transition-colors text-sm">
                  ← Accueil
                </button>
                {videoMetadata && (
                  <span className="text-slate-600 text-sm truncate">/ {videoMetadata.title}</span>
                )}
              </div>
              <VideoPlayer
                videoId={videoId}
                isProcessing={false}
                processingState={processingState}
                translatedChunks={translatedChunks}
                showSubtitles={settings.showSubtitles}
              />
            </div>
          )}

      </main>

      {/* Modals */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        updateSettings={(newS) => setSettings({ ...settings, ...newS })}
      />

      <ExplicitContentWarning
        isOpen={showContentWarning}
        onDecide={handleExplicitDecision}
      />

    </div>
  );
};

export default App;