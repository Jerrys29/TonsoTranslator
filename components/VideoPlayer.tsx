import React, { useEffect, useRef, useState } from 'react';
import { TranslationResult, ProcessingState } from '../types';

interface VideoPlayerProps {
  videoId: string;
  isProcessing: boolean;
  translationResult: TranslationResult | null;
  processingState: ProcessingState;
  showSubtitles: boolean;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ 
  videoId, 
  isProcessing, 
  translationResult, 
  processingState,
  showSubtitles
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Initialize Audio Context
  useEffect(() => {
    if (!audioContextRef.current) {
      // Gemini TTS uses 24kHz sample rate
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000
      });
    }
    return () => {
      audioContextRef.current?.close();
    };
  }, []);

  // Handle Playback Logic
  useEffect(() => {
    if (processingState === ProcessingState.PLAYING && translationResult?.audioBase64) {
      playAudio(translationResult.audioBase64);
      setIsPlaying(true);
    } else {
      stopAudio();
      setIsPlaying(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processingState, translationResult]);

  const playAudio = async (base64: string) => {
    if (!audioContextRef.current) return;
    
    try {
      // 1. Decode Base64 string to Uint8Array
      const binaryString = atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // 2. Convert raw PCM (16-bit, 24kHz, Mono) to AudioBuffer
      // NOTE: Gemini API returns raw PCM data without headers, so standard decodeAudioData fails.
      const dataInt16 = new Int16Array(bytes.buffer);
      const numChannels = 1;
      const sampleRate = 24000;
      
      const audioBuffer = audioContextRef.current.createBuffer(
        numChannels, 
        dataInt16.length, 
        sampleRate
      );

      // Convert Int16 to Float32 [-1.0, 1.0]
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < dataInt16.length; i++) {
        channelData[i] = dataInt16[i] / 32768.0;
      }

      // 3. Play
      if (audioSourceRef.current) {
        audioSourceRef.current.stop();
      }
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.start(0);
      audioSourceRef.current = source;
      
      // Auto-stop handler
      source.onended = () => {
        setIsPlaying(false);
      };

    } catch (e) {
      console.error("Audio playback error", e);
      setIsPlaying(false);
    }
  };

  const stopAudio = () => {
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
      } catch (e) {
        // ignore if already stopped
      }
      audioSourceRef.current = null;
    }
  };

  return (
    <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800">
      {/* Background: The Video (Muted to allow dubbed audio) */}
      <iframe
        ref={iframeRef}
        src={`https://www.youtube.com/embed/${videoId}?autoplay=${isPlaying ? 1 : 0}&mute=1&controls=0&modestbranding=1&showinfo=0&rel=0`}
        className="w-full h-full opacity-60"
        title="Source Video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      />

      {/* Overlay: Processing State */}
      {isProcessing && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-10">
          <div className="relative w-24 h-24 mb-6">
            <div className="absolute inset-0 border-4 border-slate-700 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-t-cyan-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
            <div className="absolute inset-4 bg-slate-800 rounded-full flex items-center justify-center animate-pulse">
               <span className="text-2xl">🧠</span>
            </div>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">
            {processingState === ProcessingState.ANALYZING_METADATA && "Analyse du contexte..."}
            {processingState === ProcessingState.TRANSLATING_FULL && "Traduction & Synthèse vocale..."}
          </h3>
          <p className="text-slate-400 text-sm max-w-xs text-center">
            {processingState === ProcessingState.ANALYZING_METADATA && "Détection du ton, de l'argot et des références culturelles."}
            {processingState === ProcessingState.TRANSLATING_FULL && "Génération d'une voix naturelle en français."}
          </p>
        </div>
      )}

      {/* Overlay: Subtitles */}
      {showSubtitles && isPlaying && translationResult && (
        <div className="absolute bottom-12 left-0 right-0 flex justify-center px-8 z-20">
          <div className="bg-black/60 backdrop-blur-md px-6 py-3 rounded-xl border border-white/10 shadow-lg">
            <p className="text-white text-lg font-medium text-center leading-relaxed drop-shadow-md">
              {translationResult.translatedText}
            </p>
          </div>
        </div>
      )}

      {/* Overlay: "Live" Translation Indicator */}
      {isPlaying && (
         <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/50 backdrop-blur px-3 py-1.5 rounded-full border border-cyan-500/30">
            <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></div>
            <span className="text-xs font-bold text-cyan-100 uppercase tracking-wider">Tonso AI Dubbing</span>
         </div>
      )}
    </div>
  );
};

export default VideoPlayer;