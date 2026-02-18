import React, { useEffect, useRef, useState } from 'react';
import { VoiceOption, AppSettings, AnalysisResult, TranscriptChunk } from '../types';
import { AVAILABLE_VOICES } from '../constants';
import { generatePreview, decodeAudio } from '../services/geminiService';

interface VoiceStudioProps {
  settings: AppSettings;
  updateSettings: (s: Partial<AppSettings>) => void;
  analysis: AnalysisResult;
  chunks: TranscriptChunk[];
  onConfirm: () => void;
  isGeneratingPreview: boolean;
  setIsGeneratingPreview: (v: boolean) => void;
}

const VoiceStudio: React.FC<VoiceStudioProps> = ({
  settings,
  updateSettings,
  analysis,
  chunks,
  onConfirm,
  isGeneratingPreview,
  setIsGeneratingPreview,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Get or create a valid AudioContext (recreate if closed)
  const getAudioContext = (): AudioContext => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    return audioContextRef.current;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try { sourceRef.current?.stop(); } catch { /* already stopped */ }
      try { audioContextRef.current?.close(); } catch { /* already closed */ }
    };
  }, []);

  const handlePreview = async (voice: VoiceOption) => {
    // Stop current playback
    try { sourceRef.current?.stop(); } catch { /* already stopped */ }
    setIsPlaying(false);

    // Select the voice
    updateSettings({ selectedVoiceId: voice.id });
    setIsGeneratingPreview(true);

    try {
      // Use the first chunk's text as preview sample
      const sampleText = chunks.length > 0
        ? chunks[0].fullText
        : "Bonjour, ceci est un test de la voix sélectionnée.";

      const audioBase64 = await generatePreview(sampleText, settings, analysis, voice);

      if (audioBase64) {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') await ctx.resume();
        const buffer = await decodeAudio(audioBase64, ctx);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.onended = () => setIsPlaying(false);
        source.start(0);
        sourceRef.current = source;
        setIsPlaying(true);
      }
    } catch (e) {
      console.error("Preview playback failed", e);
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  const voices = AVAILABLE_VOICES;

  return (
    <div className="w-full animate-in fade-in slide-in-from-right-8 duration-500">
      <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700 rounded-2xl p-6 shadow-2xl">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <span className="text-indigo-400">🎙️</span> Studio Vocal
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              {analysis.detectedGender === 'male' ? '👤 Homme' : '👤 Femme'} détecté • {analysis.tone} • {analysis.languageRegister}
            </p>
          </div>
          {isGeneratingPreview && (
            <div className="flex items-center gap-2 text-cyan-400 text-sm font-medium animate-pulse">
              <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
              Génération...
            </div>
          )}
        </div>

        {/* Context Summary Card */}
        <div className="bg-slate-900/50 rounded-xl p-4 mb-6 border border-slate-800">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Contexte Détecté</h4>
          <p className="text-sm text-slate-300">{analysis.contextSummary}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded-full">{analysis.subjectMatter}</span>
            <span className="text-xs bg-cyan-500/20 text-cyan-300 px-2 py-1 rounded-full">{analysis.targetAudience}</span>
            <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full">{analysis.tone}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Voice List */}
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Voix Disponibles</h3>

            {voices.map((voice) => {
              const isActive = settings.selectedVoiceId === voice.id;
              return (
                <button
                  key={voice.id}
                  onClick={() => !isGeneratingPreview && handlePreview(voice)}
                  disabled={isGeneratingPreview}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${isActive
                      ? 'bg-indigo-600/20 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                      : 'bg-slate-900 border-slate-700 hover:bg-slate-700'
                    }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${voice.type === 'cloned' ? 'bg-gradient-to-br from-purple-500 to-pink-500' : 'bg-slate-700'
                      }`}>
                      {voice.type === 'cloned' ? '🧬' : (voice.gender === 'male' ? '👨' : '👩')}
                    </div>
                    <div className="text-left">
                      <div className={`font-semibold ${isActive ? 'text-white' : 'text-slate-300'}`}>
                        {voice.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {voice.type === 'cloned' ? 'Basé sur l\'audio original' : 'Voix studio haute fidélité'}
                      </div>
                    </div>
                  </div>

                  {isActive && isPlaying ? (
                    <div className="flex gap-1 items-end h-4">
                      <div className="w-1 bg-indigo-400 rounded-full animate-eq-bar" style={{ animationDelay: '0s', height: '8px' }}></div>
                      <div className="w-1 bg-indigo-400 rounded-full animate-eq-bar" style={{ animationDelay: '0.2s', height: '16px' }}></div>
                      <div className="w-1 bg-indigo-400 rounded-full animate-eq-bar" style={{ animationDelay: '0.1s', height: '12px' }}></div>
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                      ▶
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Preview / Info Panel */}
          <div className="flex flex-col justify-between bg-slate-900/50 rounded-xl p-6 border border-slate-800">
            <div>
              <h3 className="text-sm font-semibold text-white mb-4">Prévisualisation</h3>
              <div className="w-full h-32 bg-black/40 rounded-lg flex items-center justify-center border border-slate-800 relative overflow-hidden">
                {isPlaying ? (
                  <div className="flex items-center gap-1">
                    {[...Array(20)].map((_, i) => (
                      <div
                        key={i}
                        className="w-1 bg-gradient-to-t from-cyan-500 to-indigo-500 rounded-full animate-eq-bar"
                        style={{
                          height: `${20 + Math.random() * 80}%`,
                          animationDelay: `${i * 0.05}s`,
                          animationDuration: `${0.4 + Math.random() * 0.4}s`,
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-600 text-sm">Cliquez sur une voix pour écouter</span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-3 text-center">
                La voix sera utilisée pour doubler les {chunks.length} segments de la vidéo.
              </p>
            </div>

            <button
              onClick={onConfirm}
              disabled={isGeneratingPreview}
              className="w-full mt-6 bg-green-600 hover:bg-green-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl shadow-lg shadow-green-900/20 transition-all flex items-center justify-center gap-2"
            >
              <span>Lancer la traduction complète</span>
              <span className="text-xl">🚀</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceStudio;