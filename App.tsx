import React, { useState } from 'react';
import { AppSettings, ProcessingState, TranslationResult, VoiceOption } from './types';
import { DEFAULT_SETTINGS, MOCK_TRANSCRIPT, AVAILABLE_VOICES } from './constants';
import VideoPlayer from './components/VideoPlayer';
import SettingsModal from './components/SettingsModal';
import ExplicitContentWarning from './components/ExplicitContentWarning';
import LanguageConfig from './components/LanguageConfig';
import VoiceStudio from './components/VoiceStudio';
import { analyzeContext, processTranslation } from './services/geminiService';

const App: React.FC = () => {
  // State
  const [urlInput, setUrlInput] = useState('');
  const [videoId, setVideoId] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [processingState, setProcessingState] = useState<ProcessingState>(ProcessingState.IDLE);
  const [translationResult, setTranslationResult] = useState<TranslationResult | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showContentWarning, setShowContentWarning] = useState(false);
  const [contextResult, setContextResult] = useState<any>(null);

  // Parse YouTube ID
  const extractVideoId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  // STEP 1: Analyze Context & Metadata
  const handleStartAnalysis = async () => {
    if (!process.env.API_KEY) {
      alert("API_KEY manquante.");
      return;
    }
    const id = extractVideoId(urlInput);
    if (!id) {
      alert("URL YouTube invalide.");
      return;
    }

    setVideoId(id);
    setProcessingState(ProcessingState.ANALYZING_METADATA);

    // Analyze
    const analysis = await analyzeContext(MOCK_TRANSCRIPT);
    setContextResult(analysis);
    
    // Auto-select cloned voice that matches gender
    const matchingClone = AVAILABLE_VOICES.find(v => v.type === 'cloned' && v.gender === analysis.detectedGender) 
                       || AVAILABLE_VOICES[0];
    
    setSettings(prev => ({ ...prev, selectedVoiceId: matchingClone.id }));

    if (analysis.hasExplicitContent) {
      setProcessingState(ProcessingState.WAITING_USER_INPUT);
      setShowContentWarning(true);
    } else {
      setProcessingState(ProcessingState.IDLE); // Wait for language config
    }
  };

  const handleExplicitDecision = (shouldCensure: boolean) => {
    setShowContentWarning(false);
    setSettings(prev => ({ ...prev, censureExplicit: shouldCensure }));
    setProcessingState(ProcessingState.IDLE);
  };

  // STEP 2: Handle Voice Preview Generation
  const handleVoicePreview = async (voice: VoiceOption): Promise<string | null> => {
    setProcessingState(ProcessingState.GENERATING_PREVIEW);
    try {
      // Translate just the first sentence for preview
      const previewText = MOCK_TRANSCRIPT.split('.')[0] + ".";
      const result = await processTranslation(
        previewText, 
        settings, 
        contextResult, 
        voice
      );
      setProcessingState(ProcessingState.VOICE_STUDIO);
      return result.audioBase64;
    } catch (e) {
      console.error(e);
      setProcessingState(ProcessingState.VOICE_STUDIO);
      return null;
    }
  };

  // STEP 3: Full Translation
  const handleFullTranslation = async () => {
    setProcessingState(ProcessingState.TRANSLATING_FULL);
    try {
      const selectedVoice = AVAILABLE_VOICES.find(v => v.id === settings.selectedVoiceId) || AVAILABLE_VOICES[0];
      const result = await processTranslation(
        MOCK_TRANSCRIPT, 
        settings, 
        contextResult, 
        selectedVoice
      );
      setTranslationResult(result);
      setProcessingState(ProcessingState.READY_TO_PLAY);
      setTimeout(() => setProcessingState(ProcessingState.PLAYING), 500);
    } catch (e) {
      setProcessingState(ProcessingState.ERROR);
    }
  };

  const handleReset = () => {
    setVideoId(null);
    setProcessingState(ProcessingState.IDLE);
    setTranslationResult(null);
    setUrlInput('');
    setContextResult(null);
  };

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
        {videoId && (
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
        
        {/* STATE: LANDING / URL INPUT */}
        {!videoId && (
          <div className="w-full flex flex-col items-center text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 mt-12">
            <div className="space-y-4 max-w-3xl">
              <h2 className="text-5xl md:text-7xl font-bold text-white leading-tight tracking-tight">
                Brisez les barrières <br/>
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-indigo-400">
                  linguistiques.
                </span>
              </h2>
              <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto">
                Doublage vidéo IA avec clonage de voix authentique. 
                Supporte +30 langues avec une précision contextuelle inégalée.
              </p>
            </div>

            <div className="w-full max-w-xl relative group mt-8">
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-indigo-600 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-500"></div>
              <div className="relative flex bg-slate-800 rounded-xl p-2 shadow-2xl border border-slate-700">
                <input 
                  type="text" 
                  placeholder="Collez une URL YouTube..." 
                  className="flex-1 bg-transparent border-none outline-none text-white px-4 placeholder-slate-500"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleStartAnalysis()}
                />
                <button 
                  onClick={handleStartAnalysis}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  Démarrer
                </button>
              </div>
            </div>
            
            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 text-left w-full max-w-4xl">
               <div className="bg-slate-800/30 p-6 rounded-2xl border border-slate-700/50">
                  <div className="text-3xl mb-3">🧬</div>
                  <h3 className="text-white font-bold mb-2">Clonage Vocal</h3>
                  <p className="text-slate-500 text-sm">Reproduit le timbre exact du créateur original.</p>
               </div>
               <div className="bg-slate-800/30 p-6 rounded-2xl border border-slate-700/50">
                  <div className="text-3xl mb-3">🌍</div>
                  <h3 className="text-white font-bold mb-2">Multi-langues</h3>
                  <p className="text-slate-500 text-sm">Français, Anglais, Japonais, Arabe et plus.</p>
               </div>
               <div className="bg-slate-800/30 p-6 rounded-2xl border border-slate-700/50">
                  <div className="text-3xl mb-3">🧠</div>
                  <h3 className="text-white font-bold mb-2">Context Aware</h3>
                  <p className="text-slate-500 text-sm">Respecte l'argot, l'humour et les émotions.</p>
               </div>
            </div>
          </div>
        )}

        {/* STATE: LOADING ANALYSIS */}
        {processingState === ProcessingState.ANALYZING_METADATA && (
          <div className="flex flex-col items-center mt-20">
             <div className="w-16 h-16 border-4 border-slate-700 border-t-cyan-500 rounded-full animate-spin mb-6"></div>
             <h3 className="text-white text-xl font-medium">Analyse de la vidéo...</h3>
             <p className="text-slate-500">Détection de la langue et du locuteur</p>
          </div>
        )}

        {/* STATE: CONFIGURATION (Language) */}
        {videoId && contextResult && !showContentWarning && processingState === ProcessingState.IDLE && (
          <LanguageConfig 
            settings={settings} 
            updateSettings={(s) => setSettings({...settings, ...s})}
            onContinue={() => setProcessingState(ProcessingState.VOICE_STUDIO)}
          />
        )}

        {/* STATE: VOICE STUDIO */}
        {(processingState === ProcessingState.VOICE_STUDIO || processingState === ProcessingState.GENERATING_PREVIEW) && contextResult && (
          <VoiceStudio 
             settings={settings}
             updateSettings={(s) => setSettings({...settings, ...s})}
             analysis={contextResult}
             onPreview={handleVoicePreview}
             onConfirm={handleFullTranslation}
             isGeneratingPreview={processingState === ProcessingState.GENERATING_PREVIEW}
          />
        )}

        {/* STATE: PLAYER (Translating or Playing) */}
        {(processingState === ProcessingState.TRANSLATING_FULL || 
          processingState === ProcessingState.READY_TO_PLAY || 
          processingState === ProcessingState.PLAYING) && (
          <div className="w-full animate-in fade-in duration-500">
             <div className="flex items-center gap-2 mb-4">
                <button onClick={handleReset} className="text-slate-500 hover:text-slate-300">← Accueil</button>
             </div>
             <VideoPlayer 
              videoId={videoId!}
              isProcessing={processingState === ProcessingState.TRANSLATING_FULL}
              processingState={processingState}
              translationResult={translationResult}
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
        updateSettings={(newS) => setSettings({...settings, ...newS})}
      />

      <ExplicitContentWarning
        isOpen={showContentWarning}
        onDecide={handleExplicitDecision}
      />
      
    </div>
  );
};

export default App;