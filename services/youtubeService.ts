import { TranscriptSegment, TranscriptChunk, VideoMetadata } from '../types';
import { CHUNK_MAX_DURATION_SEC, CHUNK_MIN_DURATION_SEC } from '../constants';

/**
 * Fetches video metadata (title, thumbnail, channel).
 * Tries server proxy first (avoids CORS), falls back to client-side noembed.com (public proxy)
 * if server fails (e.g. corporate firewall blocking server but not browser).
 */
export const fetchVideoMetadata = async (videoId: string): Promise<VideoMetadata> => {
    // Base metadata from server (no external network calls, always succeeds)
    const serverResponse = await fetch(`/api/metadata?videoId=${encodeURIComponent(videoId)}`);
    const base: VideoMetadata = serverResponse.ok
        ? await serverResponse.json()
        : { videoId, title: videoId, channelName: 'YouTube', thumbnailUrl: `/api/thumbnail?videoId=${videoId}&q=maxresdefault`, thumbnailFallback: `/api/thumbnail?videoId=${videoId}&q=hqdefault` };

    // Try to enrich with real title/channel via YouTube oEmbed (browser fetch, no proxy issues)
    try {
        const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
        if (oembedRes.ok) {
            const oembed = await oembedRes.json();
            if (oembed.title) base.title = oembed.title;
            if (oembed.author_name) base.channelName = oembed.author_name;
        }
    } catch {
        // oEmbed failed (offline / blocked), keep base metadata
    }

    return base;
};

/**
 * Fetches the real YouTube transcript via our Vite server API endpoint.
 * Returns timestamped segments.
 */
export const fetchTranscript = async (videoId: string): Promise<TranscriptSegment[]> => {
    const response = await fetch(`/api/transcript?videoId=${encodeURIComponent(videoId)}`);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erreur inconnue' }));
        throw new Error(errorData.error || `Erreur ${response.status}`);
    }

    const data = await response.json();
    return data.segments as TranscriptSegment[];
};

/**
 * Groups small transcript segments into coherent chunks of ~10-15 seconds.
 * This ensures each chunk has enough context for a natural translation,
 * while keeping them short enough for responsive TTS generation.
 */
export const groupSegmentsIntoChunks = (segments: TranscriptSegment[]): TranscriptChunk[] => {
    if (segments.length === 0) return [];

    const chunks: TranscriptChunk[] = [];
    let currentSegments: TranscriptSegment[] = [];
    let currentDuration = 0;
    let chunkId = 0;

    for (const segment of segments) {
        currentSegments.push(segment);
        currentDuration += segment.duration;

        // Check if we should close this chunk
        const isLongEnough = currentDuration >= CHUNK_MAX_DURATION_SEC;
        const endsWithPunctuation = /[.!?;:]$/.test(segment.text.trim());
        const isMinDuration = currentDuration >= CHUNK_MIN_DURATION_SEC;

        // Close chunk when: max duration reached, OR natural sentence boundary + min duration
        if (isLongEnough || (endsWithPunctuation && isMinDuration)) {
            const startTime = currentSegments[0].offset;
            const lastSeg = currentSegments[currentSegments.length - 1];
            const endTime = lastSeg.offset + lastSeg.duration;

            chunks.push({
                id: chunkId++,
                segments: [...currentSegments],
                startTime,
                endTime,
                fullText: currentSegments.map(s => s.text).join(' '),
            });

            currentSegments = [];
            currentDuration = 0;
        }
    }

    // Don't forget remaining segments
    if (currentSegments.length > 0) {
        const startTime = currentSegments[0].offset;
        const lastSeg = currentSegments[currentSegments.length - 1];
        const endTime = lastSeg.offset + lastSeg.duration;

        chunks.push({
            id: chunkId,
            segments: [...currentSegments],
            startTime,
            endTime,
            fullText: currentSegments.map(s => s.text).join(' '),
        });
    }

    return chunks;
};

/**
 * Extracts a YouTube video ID from various URL formats.
 */
export const extractVideoId = (url: string): string | null => {
    const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};
