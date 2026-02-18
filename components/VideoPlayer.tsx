import React, { useEffect, useRef, useState, useCallback } from 'react';
import YouTube from 'react-youtube';
import type { YouTubeEvent, YouTubePlayer } from 'react-youtube';
import { TranslatedChunk, SubtitleChunk, ProcessingState } from '../types';
import { AudioSyncEngine } from '../services/audioSyncService';

interface VideoPlayerProps {
  videoId: string;
  isProcessing: boolean;
  processingState: ProcessingState;
  translatedChunks: TranslatedChunk[];
  showSubtitles: boolean;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoId,
  isProcessing,
  processingState,
  translatedChunks,
  showSubtitles,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSubtitle, setCurrentSubtitle] = useState<SubtitleChunk | null>(null);
  const [volume, setVolume] = useState(0.8);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const syncEngineRef = useRef<AudioSyncEngine | null>(null);
  const timeUpdateRef = useRef<number | null>(null);

  // Initialize sync engine
  useEffect(() => {
    syncEngineRef.current = new AudioSyncEngine();
    syncEngineRef.current.onSubtitle((subtitle) => {
      setCurrentSubtitle(subtitle);
    });

    return () => {
      syncEngineRef.current?.destroy();
      if (timeUpdateRef.current) cancelAnimationFrame(timeUpdateRef.current);
    };
  }, []);

  // Load translated chunks into audio engine when available
  useEffect(() => {
    if (translatedChunks.length > 0 && syncEngineRef.current) {
      syncEngineRef.current.loadChunks(translatedChunks);
    }
  }, [translatedChunks]);

  // Update volume
  useEffect(() => {
    syncEngineRef.current?.setVolume(volume);
  }, [volume]);

  // Time tracking loop
  const startTimeTracking = useCallback(() => {
    const update = () => {
      if (playerRef.current) {
        const time = playerRef.current.getCurrentTime?.() || 0;
        setCurrentTime(time);
      }
      timeUpdateRef.current = requestAnimationFrame(update);
    };
    timeUpdateRef.current = requestAnimationFrame(update);
  }, []);

  const stopTimeTracking = () => {
    if (timeUpdateRef.current) {
      cancelAnimationFrame(timeUpdateRef.current);
      timeUpdateRef.current = null;
    }
  };

  // YouTube Player event handlers
  const onPlayerReady = (event: YouTubeEvent) => {
    playerRef.current = event.target;
    event.target.setVolume(0); // Mute original audio
    const dur = event.target.getDuration?.() || 0;
    setDuration(dur);
  };

  const onPlayerStateChange = (event: YouTubeEvent) => {
    const state = event.data;

    // YT.PlayerState: PLAYING=1, PAUSED=2, ENDED=0, BUFFERING=3
    if (state === 1) {
      // Playing
      setIsPlaying(true);
      const currentVideoTime = playerRef.current?.getCurrentTime?.() || 0;
      if (translatedChunks.length > 0) {
        syncEngineRef.current?.play(currentVideoTime);
      }
      startTimeTracking();
    } else if (state === 2) {
      // Paused
      setIsPlaying(false);
      syncEngineRef.current?.pause();
      stopTimeTracking();
    } else if (state === 0) {
      // Ended
      setIsPlaying(false);
      syncEngineRef.current?.pause();
      stopTimeTracking();
    }
  };

  // Play/Pause toggle
  const togglePlayPause = () => {
    if (!playerRef.current) return;
    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  };

  // Seek
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!playerRef.current || duration === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const seekTime = percentage * duration;

    playerRef.current.seekTo(seekTime, true);
    syncEngineRef.current?.seekTo(seekTime);
    setCurrentTime(seekTime);
  };

  // Format time
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Auto-play when translation is ready
  useEffect(() => {
    if (processingState === ProcessingState.PLAYING && playerRef.current) {
      playerRef.current.seekTo(0, true);
      playerRef.current.playVideo();
    }
  }, [processingState]);

  return (
    <div className="relative w-full bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800">

      {/* YouTube Player */}
      <div className="relative w-full aspect-video">
        <YouTube
          videoId={videoId}
          className="w-full h-full"
          iframeClassName="w-full h-full"
          opts={{
            width: '100%',
            height: '100%',
            host: 'https://www.youtube-nocookie.com',
            playerVars: {
              autoplay: 0,
              mute: 1,
              controls: 0,
              modestbranding: 1,
              showinfo: 0,
              rel: 0,
              disablekb: 1,
              iv_load_policy: 3,
              cc_load_policy: 0,
            },
          }}
          onReady={onPlayerReady}
          onStateChange={onPlayerStateChange}
        />

        {/* Processing Overlay */}
        {isProcessing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-10">
            <div className="relative w-24 h-24 mb-6">
              <div className="absolute inset-0 border-4 border-slate-700 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-t-cyan-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
              <div className="absolute inset-4 bg-slate-800 rounded-full flex items-center justify-center animate-pulse">
                <span className="text-2xl">🧠</span>
              </div>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Préparation...</h3>
            <p className="text-slate-400 text-sm">Chargement de la vidéo</p>
          </div>
        )}

        {/* Subtitles Overlay */}
        {showSubtitles && isPlaying && currentSubtitle && (
          <div className="absolute bottom-16 left-0 right-0 flex justify-center px-8 z-20 pointer-events-none">
            <div className="bg-black/70 backdrop-blur-md px-6 py-3 rounded-xl border border-white/10 shadow-lg max-w-[80%] transition-all duration-300">
              <p className="text-white text-lg font-medium text-center leading-relaxed drop-shadow-md">
                {currentSubtitle.text}
              </p>
            </div>
          </div>
        )}

        {/* Live Indicator */}
        {isPlaying && translatedChunks.length > 0 && (
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/50 backdrop-blur px-3 py-1.5 rounded-full border border-cyan-500/30 z-20">
            <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></div>
            <span className="text-xs font-bold text-cyan-100 uppercase tracking-wider">Tonso AI Dubbing</span>
          </div>
        )}
      </div>

      {/* Custom Controls Bar */}
      {translatedChunks.length > 0 && (
        <div className="bg-slate-900/90 backdrop-blur-md px-4 py-3 border-t border-slate-800">
          <div className="flex items-center gap-4">
            {/* Play/Pause */}
            <button
              onClick={togglePlayPause}
              className="w-10 h-10 flex items-center justify-center text-white hover:text-cyan-400 transition-colors"
            >
              {isPlaying ? (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* Time */}
            <span className="text-xs text-slate-400 font-mono min-w-[80px]">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            {/* Progress Bar */}
            <div
              className="flex-1 h-2 bg-slate-700 rounded-full cursor-pointer group relative"
              onClick={handleSeek}
            >
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full transition-all duration-100 relative"
                style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setVolume(v => v > 0 ? 0 : 0.8)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                {volume > 0 ? '🔊' : '🔇'}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-20 h-1 accent-cyan-500"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;