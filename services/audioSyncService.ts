import { TranslatedChunk, SubtitleChunk } from '../types';
import { decodeAudio } from './geminiService';

/**
 * AudioSyncEngine — Manages synchronized playback of translated audio
 * segments alongside the YouTube video player.
 * 
 * It schedules each audio chunk at its corresponding video timestamp
 * using the Web Audio API's precise timing capabilities.
 */
export class AudioSyncEngine {
    private audioContext: AudioContext;
    private chunks: TranslatedChunk[] = [];
    private audioBuffers: Map<number, AudioBuffer> = new Map();
    private scheduledSources: Map<number, AudioBufferSourceNode> = new Map();
    private gainNode: GainNode;
    private isPlaying = false;
    private playbackStartTime = 0;  // AudioContext time when playback started
    private videoTimeOffset = 0;    // Video time when playback started
    private onSubtitleChange: ((subtitle: SubtitleChunk | null) => void) | null = null;
    private subtitleInterval: number | null = null;

    constructor() {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
            sampleRate: 24000,
        });
        this.gainNode = this.audioContext.createGain();
        this.gainNode.connect(this.audioContext.destination);
        this.gainNode.gain.value = 1.0;
    }

    /**
     * Load translated chunks and decode their audio into AudioBuffers.
     */
    async loadChunks(chunks: TranslatedChunk[]): Promise<void> {
        this.chunks = chunks;
        this.audioBuffers.clear();

        for (const chunk of chunks) {
            if (chunk.audioBase64) {
                try {
                    const buffer = await decodeAudio(chunk.audioBase64, this.audioContext);
                    this.audioBuffers.set(chunk.id, buffer);
                } catch (e) {
                    console.warn(`Failed to decode audio for chunk ${chunk.id}:`, e);
                }
            }
        }
    }

    /**
     * Start playback from a specific video time.
     * Schedules all audio chunks relative to the current position.
     */
    play(fromVideoTime: number = 0): void {
        this.stopAll();

        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        this.isPlaying = true;
        this.playbackStartTime = this.audioContext.currentTime;
        this.videoTimeOffset = fromVideoTime;

        // Schedule each chunk that starts at or after the current position
        for (const chunk of this.chunks) {
            const buffer = this.audioBuffers.get(chunk.id);
            if (!buffer) continue;

            const timeUntilChunk = chunk.startTime - fromVideoTime;

            if (timeUntilChunk >= -chunk.audioDuration) {
                const source = this.audioContext.createBufferSource();
                source.buffer = buffer;
                source.connect(this.gainNode);

                source.onended = () => {
                    this.scheduledSources.delete(chunk.id);
                };

                if (timeUntilChunk >= 0) {
                    // Chunk is in the future — schedule it
                    source.start(this.playbackStartTime + timeUntilChunk);
                } else {
                    // Chunk is currently playing — start with offset
                    const offset = Math.abs(timeUntilChunk);
                    if (offset < buffer.duration) {
                        source.start(0, offset);
                    }
                }

                this.scheduledSources.set(chunk.id, source);
            }
        }

        // Start subtitle tracking
        this.startSubtitleTracking();
    }

    /**
     * Pause all audio playback.
     */
    pause(): void {
        this.isPlaying = false;
        this.stopAll();
        this.stopSubtitleTracking();
    }

    /**
     * Seek to a specific video time — reschedules all audio.
     */
    seekTo(videoTime: number): void {
        if (this.isPlaying) {
            this.play(videoTime);
        }
    }

    /**
     * Set volume (0.0 to 1.0)
     */
    setVolume(volume: number): void {
        this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    }

    /**
     * Register a callback for subtitle changes.
     */
    onSubtitle(callback: (subtitle: SubtitleChunk | null) => void): void {
        this.onSubtitleChange = callback;
    }

    /**
     * Get the current video time based on AudioContext timing.
     */
    getCurrentVideoTime(): number {
        if (!this.isPlaying) return this.videoTimeOffset;
        return this.videoTimeOffset + (this.audioContext.currentTime - this.playbackStartTime);
    }

    /**
     * Get all subtitles for display.
     */
    getSubtitles(): SubtitleChunk[] {
        return this.chunks.map(chunk => ({
            id: chunk.id,
            startTime: chunk.startTime,
            endTime: chunk.endTime,
            text: chunk.translatedText,
        }));
    }

    /**
     * Get the currently active subtitle for a given time.
     */
    getSubtitleAt(videoTime: number): SubtitleChunk | null {
        for (const chunk of this.chunks) {
            if (videoTime >= chunk.startTime && videoTime < chunk.endTime) {
                return {
                    id: chunk.id,
                    startTime: chunk.startTime,
                    endTime: chunk.endTime,
                    text: chunk.translatedText,
                };
            }
        }
        return null;
    }

    /**
     * Cleanup everything.
     */
    destroy(): void {
        this.stopAll();
        this.stopSubtitleTracking();
        this.audioContext.close();
    }

    // ── Private ──

    private stopAll(): void {
        for (const [id, source] of this.scheduledSources) {
            try {
                source.stop();
            } catch (e) {
                // Already stopped
            }
        }
        this.scheduledSources.clear();
    }

    private startSubtitleTracking(): void {
        this.stopSubtitleTracking();

        let lastSubtitleId: number | null = null;

        this.subtitleInterval = window.setInterval(() => {
            if (!this.isPlaying || !this.onSubtitleChange) return;

            const currentTime = this.getCurrentVideoTime();
            const subtitle = this.getSubtitleAt(currentTime);

            if (subtitle?.id !== lastSubtitleId) {
                lastSubtitleId = subtitle?.id ?? null;
                this.onSubtitleChange(subtitle);
            }
        }, 100); // Check every 100ms for smooth subtitle transitions
    }

    private stopSubtitleTracking(): void {
        if (this.subtitleInterval !== null) {
            clearInterval(this.subtitleInterval);
            this.subtitleInterval = null;
        }
    }
}
