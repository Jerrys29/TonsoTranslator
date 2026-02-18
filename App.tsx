import React, { useState } from 'react';
import { AppSettings, ProcessingState, TranslationResult } from './types';
import { DEFAULT_SETTINGS, MOCK_TRANSCRIPT } from './constants';
import VideoPlayer from './components/VideoPlayer';
import SettingsModal from './components/SettingsModal';
import ExplicitContentWarning from './components/ExplicitContentWarning';
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

  const handleStart = async () => {
    if (!process.env.API_KEY) {
      alert("API_KEY manquante. Veuillez configurer la clé API Gemini.");
      return;
    }

    const id = extractVideoId(urlInput);
    if (!id) {
      alert("Veuillez entrer une URL YouTube valide.");
      return;
    }

    setVideoId(id);
    setProcessingState(ProcessingState.ANALYZING);

    // Step 1: Analyze Context
    const analysis = await analyzeContext(MOCK_TRANSCRIPT);
    setContextResult(analysis);

    if (analysis.hasExplicitContent) {
      setProcessingState(ProcessingState.WAITING_USER_INPUT);
      setShowContentWarning(true);
    } else {
      // Proceed directly if no explicit content
      await runTranslationPipeline(analysis, settings.censureExplicit);
    }
  };

  const handleExplicitDecision = async (shouldCensure: boolean) => {
    setShowContentWarning(false);
    // Update local settings temporarily for this session based on choice
    const newSettings = { ...settings, censureExplicit: shouldCensure };
    setSettings(newSettings);
    
    if (contextResult) {
      await runTranslationPipeline(contextResult, shouldCensure);
    }
  };

  const runTranslationPipeline = async (context: any, censure: boolean) => {
    setProcessingState(ProcessingState.TRANSLATING);
    
    try {
      const result = await processTranslation(
        MOCK_TRANSCRIPT, 
        { ...settings, censureExplicit: censure }, 
        context
      );
      setTranslationResult(result);
      setProcessingState(ProcessingState.READY);
      
      // Auto-play after short delay
      setTimeout(() => {
        setProcessingState(ProcessingState.PLAYING);
      }, 1000);

    } catch (error) {
      console.error(error);
      setProcessingState(ProcessingState.ERROR);
      alert("Une erreur est survenue lors de la traduction.");
    }
  };

  const handleReset = () => {
    setVideoId(null);
    setProcessingState(ProcessingState.IDLE);
    setTranslationResult(null);
    setUrlInput('');
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-4 md:p-8">
      
      {/* Header */}
      <header className="w-full max-w-5xl flex justify-between items-center mb-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <span className="text-white font-bold text-xl">T</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">tonso.</h1>
        </div>
        <button 
          onClick={() => setShowSettings(true)}
          className="p-2 text-slate-400 hover:text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-4xl flex flex-col items-center">
        
        {!videoId ? (
          /* Landing State */
          <div className="w-full flex flex-col items-center text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="space-y-4 max-w-2xl">
              <h2 className="text-5xl md:text-6xl font-bold text-white leading-tight">
                Vidéos en anglais,<br/>
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-indigo-400">
                  voix française.
                </span>
              </h2>
              <p className="text-slate-400 text-lg md:text-xl">
                Traduction contextuelle et doublage vocal instantané par IA.
                Respecte l'humour, l'argot et le ton original.
              </p>
            </div>

            <div className="w-full max-w-xl relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-indigo-600 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-500"></div>
              <div className="relative flex bg-slate-800 rounded-xl p-2 shadow-2xl border border-slate-700">
                <input 
                  type="text" 
                  placeholder="Collez une URL YouTube..." 
                  className="flex-1 bg-transparent border-none outline-none text-white px-4 placeholder-slate-500"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                />
                <button 
                  onClick={handleStart}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  Traduire
                </button>
              </div>
            </div>
            
            <div className="flex gap-8 mt-12 text-slate-500 text-sm font-medium">
               <span className="flex items-center gap-2">
                 <span className="w-2 h-2 bg-green-500 rounded-full"></span> Gemini 2.5 Flash
               </span>
               <span className="flex items-center gap-2">
                 <span className="w-2 h-2 bg-indigo-500 rounded-full"></span> 18+ Content Filter
               </span>
               <span className="flex items-center gap-2">
                 <span className="w-2 h-2 bg-purple-500 rounded-full"></span> Natural TTS
               </span>
            </div>
          </div>
        ) : (
          /* Player State */
          <div className="w-full animate-in fade-in duration-500">
            <div className="flex justify-between items-center mb-4">
              <button 
                onClick={handleReset}
                className="text-slate-400 hover:text-white text-sm flex items-center gap-1 transition-colors"
              >
                ← Retour
              </button>
              <div className="flex gap-2">
                <span className={`px-2 py-1 rounded text-xs font-mono border ${processingState === ProcessingState.PLAYING ? 'border-green-500 text-green-500 bg-green-500/10' : 'border-slate-700 text-slate-500'}`}>
                  {processingState}
                </span>
              </div>
            </div>

            <VideoPlayer 
              videoId={videoId}
              isProcessing={processingState === ProcessingState.ANALYZING || processingState === ProcessingState.TRANSLATING}
              processingState={processingState}
              translationResult={translationResult}
              showSubtitles={settings.showSubtitles}
            />

            {/* Translation Output Preview (Debug / Info) */}
            {translationResult && (
              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 opacity-70 hover:opacity-100 transition-opacity">
                 <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Original (En)</h4>
                    <p className="text-slate-300 text-sm italic">"{translationResult.originalText}"</p>
                 </div>
                 <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                    <h4 className="text-xs font-bold text-cyan-500 uppercase mb-2">Traduit (Fr)</h4>
                    <p className="text-slate-300 text-sm">"{translationResult.translatedText}"</p>
                 </div>
              </div>
            )}
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