import { TranscriptSegment, TranscriptChunk, VideoMetadata } from '../types';
import { CHUNK_MAX_DURATION_SEC, CHUNK_MIN_DURATION_SEC } from '../constants';

/**
 * Fetches video metadata (title, thumbnail, channel).
 * Tries server proxy first (avoids CORS), falls back to client-side noembed.com (public proxy)
 * if server fails (e.g. corporate firewall blocking server but not browser).
 */
export const fetchVideoMetadata = async (videoId: string): Promise<VideoMetadata> => {
    const base: VideoMetadata = {
        videoId,
        title: videoId,
        channelName: 'YouTube',
        thumbnailUrl: `/api/thumbnail?videoId=${videoId}&q=maxresdefault`,
        thumbnailFallback: `/api/thumbnail?videoId=${videoId}&q=hqdefault`,
    };

    // Try server proxy for metadata (works if youtube.com reachable from Node)
    try {
        const serverRes = await fetch(`/api/metadata?videoId=${encodeURIComponent(videoId)}`);
        if (serverRes.ok) {
            const data = await serverRes.json();
            if (data.title && data.title !== videoId) {
                base.title = data.title;
                base.channelName = data.channelName || 'YouTube';
                return base;
            }
        }
    } catch { /* continue to Gemini fallback */ }

    // Fallback: Use Gemini to get video title/channel (via googleapis.com, not blocked)
    try {
        const { GoogleGenAI, Type } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                {
                    role: 'user',
                    parts: [
                        {
                            fileData: {
                                fileUri: `https://www.youtube.com/watch?v=${videoId}`,
                                mimeType: 'video/*',
                            },
                        },
                        { text: 'What is the exact title and channel name of this YouTube video? Return JSON with "title" and "channelName" fields only.' },
                    ],
                },
            ],
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        channelName: { type: Type.STRING },
                    },
                    required: ['title', 'channelName'],
                },
            },
        });

        const meta = JSON.parse(response.text || '{}');
        if (meta.title) base.title = meta.title;
        if (meta.channelName) base.channelName = meta.channelName;
    } catch {
        // Gemini failed too, keep base metadata
    }

    return base;
};

/**
 * Fetches the YouTube transcript.
 * Tries server proxy first, falls back to Gemini AI extraction if the server
 * is blocked (e.g. pfBlockerNG DNS blocking youtube.com from Node).
 */
export const fetchTranscript = async (videoId: string): Promise<TranscriptSegment[]> => {
    // Try server endpoint first (works if youtube.com is reachable from Node)
    try {
        const response = await fetch(`/api/transcript?videoId=${encodeURIComponent(videoId)}`);
        if (response.ok) {
            const data = await response.json();
            if (data.segments?.length > 0) return data.segments as TranscriptSegment[];
        }
    } catch {
        // Server failed (DNS blocked), try Gemini fallback
    }

    // Fallback: Use Gemini to extract transcript from the YouTube video
    // Gemini can access YouTube videos via googleapis.com (not blocked by DNS)
    return fetchTranscriptViaGemini(videoId);
};

/**
 * Uses Gemini AI to extract the transcript with timestamps from a YouTube video.
 * This bypasses DNS-level blocking of youtube.com since Gemini accesses the video
 * through Google's internal infrastructure via googleapis.com.
 */
async function fetchTranscriptViaGemini(videoId: string): Promise<TranscriptSegment[]> {
    const { GoogleGenAI, Type } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
            {
                role: 'user',
                parts: [
                    {
                        fileData: {
                            fileUri: `https://www.youtube.com/watch?v=${videoId}`,
                            mimeType: 'video/*',
                        },
                    },
                    {
                        text: `Extract the complete spoken transcript of this YouTube video with accurate timestamps.

For each spoken segment, provide:
- "text": the exact words spoken (in the original language, do NOT translate)
- "offset": start time in seconds (decimal, e.g. 12.5)
- "duration": duration in seconds (decimal, e.g. 3.2)

Rules:
- Include ALL spoken words, do not skip anything
- Keep segments short (1-2 sentences each, roughly 2-8 seconds)
- Timestamps must be accurate to within ~1 second
- Do NOT translate — keep the original language exactly as spoken
- Do NOT include sound effects, music descriptions, or non-speech

Return a JSON array of segments.`,
                    },
                ],
            },
        ],
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        text: { type: Type.STRING },
                        offset: { type: Type.NUMBER },
                        duration: { type: Type.NUMBER },
                    },
                    required: ['text', 'offset', 'duration'],
                },
            },
        },
    });

    const segments: TranscriptSegment[] = JSON.parse(response.text || '[]');

    if (segments.length === 0) {
        throw new Error('Aucun sous-titre extrait de la vidéo. La vidéo est peut-être sans paroles.');
    }

    return segments;
}

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
