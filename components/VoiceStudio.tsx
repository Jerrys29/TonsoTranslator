import React, { useEffect, useRef, useState } from 'react';
import { VoiceOption, AppSettings, AnalysisResult } from '../types';
import { AVAILABLE_VOICES } from '../constants';
import { decodeAudio } from '../services/geminiService';

interface VoiceStudioProps {
  settings: AppSettings;
  updateSettings: (s: Partial<AppSettings>) => void;
  analysis: AnalysisResult;
  onPreview: (voice: VoiceOption) => Promise<string | null>;
  onConfirm: () => void;
  isGeneratingPreview: boolean;
}

const VoiceStudio: React.FC<VoiceStudioProps> = ({
  settings,
  updateSettings,
  analysis,
  onPreview,
  onConfirm,
  isGeneratingPreview
}) => {
  const [activePreviewUrl, setActivePreviewUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Initialize Audio
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    return () => {
        audioContextRef.current?.close();
    };
  }, []);

  const handlePreview = async (voice: VoiceOption) => {
    // Stop current
    if (sourceRef.current) sourceRef.current.stop();
    setIsPlaying(false);
    
    // Select the voice
    updateSettings({ selectedVoiceId: voice.id });

    // Request new preview audio
    const audioBase64 = await onPreview(voice);
    if (audioBase64 && audioContextRef.current) {
      try {
        const buffer = await decodeAudio(audioBase64, audioContextRef.current);
        const source = audioContextRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContextRef.current.destination);
        source.onended = () => setIsPlaying(false);
        source.start(0);
        sourceRef.current = source;
        setIsPlaying(true);
      } catch (e) {
        console.error("Preview playback failed", e);
      }
    }
  };

  // Filter voices based on detected gender? Or just show all.
  // Showing all gives user more control.
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
              {analysis.detectedGender === 'male' ? '👤 Homme' : '👤 Femme'} détecté • {analysis.tone}
            </p>
          </div>
          {isGeneratingPreview && (
             <div className="flex items-center gap-2 text-cyan-400 text-sm font-medium animate-pulse">
               <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
               Génération...
             </div>
          )}
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
                  className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
                    isActive 
                      ? 'bg-indigo-600/20 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.2)]' 
                      : 'bg-slate-900 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                      voice.type === 'cloned' ? 'bg-gradient-to-br from-purple-500 to-pink-500' : 'bg-slate-700'
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
                        <div className="w-1 bg-indigo-400 animate-[pulse_0.6s_infinite] h-2"></div>
                        <div className="w-1 bg-indigo-400 animate-[pulse_0.8s_infinite] h-4"></div>
                        <div className="w-1 bg-indigo-400 animate-[pulse_0.5s_infinite] h-3"></div>
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

          {/* Visualization / Info */}
          <div className="flex flex-col justify-between bg-slate-900/50 rounded-xl p-6 border border-slate-800">
            <div>
               <h3 className="text-sm font-semibold text-white mb-4">Prévisualisation</h3>
               <div className="w-full h-32 bg-black/40 rounded-lg flex items-center justify-center border border-slate-800 relative overflow-hidden group">
                  {isPlaying ? (
                    <div className="flex items-center gap-1">
                      {[...Array(20)].map((_, i) => (
                        <div 
                          key={i} 
                          className="w-1 bg-gradient-to-t from-cyan-500 to-indigo-500 rounded-full"
                          style={{
                            height: `${Math.random() * 100}%`,
                            animation: `pulse 0.${5 + i%5}s infinite`
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-600 text-sm">Cliquez sur une voix pour écouter</span>
                  )}
               </div>
               <p className="text-xs text-slate-500 mt-3 text-center">
                 Le clonage analyse le timbre et la prosodie de la vidéo source pour sélectionner le modèle le plus proche.
               </p>
            </div>

            <button
              onClick={onConfirm}
              className="w-full mt-6 bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-green-900/20 transition-all flex items-center justify-center gap-2"
            >
              <span>Lancer la vidéo complète</span>
              <span className="text-xl">🚀</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceStudio;