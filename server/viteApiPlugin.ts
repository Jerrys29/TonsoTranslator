import type { Plugin, ViteDevServer } from 'vite';
import https from 'https';

/**
 * Vite plugin that proxies YouTube API calls server-side.
 * This bypasses browser SSL cert issues caused by corporate/antivirus proxies.
 * 
 * Endpoints:
 *   GET /api/transcript?videoId=xxx  → YouTube transcript XML
 *   GET /api/metadata?videoId=xxx    → oEmbed metadata (title, thumbnail, channel)
 */
export function viteApiPlugin(): Plugin {
    return {
        name: 'tonso-api',
        configureServer(server: ViteDevServer) {
            server.middlewares.use(async (req, res, next) => {
                const url = req.url ?? '';

                // ── /api/thumbnail ──
                if (url.startsWith('/api/thumbnail')) {
                    const params = new URL(url, 'http://localhost');
                    const videoId = params.searchParams.get('videoId');
                    const quality = params.searchParams.get('q') || 'hqdefault';

                    if (!videoId) {
                        res.statusCode = 400;
                        res.end('Missing videoId');
                        return;
                    }

                    try {
                        const imgUrl = `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
                        const imgData = await httpsGetBinary(imgUrl);
                        res.statusCode = 200;
                        res.setHeader('Content-Type', 'image/jpeg');
                        res.setHeader('Cache-Control', 'public, max-age=3600');
                        res.end(imgData);
                    } catch {
                        res.statusCode = 404;
                        res.end('Thumbnail not found');
                    }
                    return;
                }

                // ── /api/metadata ──
                if (url.startsWith('/api/metadata')) {
                    const params = new URL(url, 'http://localhost');
                    const videoId = params.searchParams.get('videoId');

                    if (!videoId) {
                        res.statusCode = 400;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ error: 'Missing videoId' }));
                        return;
                    }

                    // Return basic metadata immediately without any network call.
                    // Title/channel will be enriched client-side via the YouTube iframe API
                    // once the video loads. This avoids corporate proxy SSL interception.
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({
                        videoId,
                        title: videoId,
                        channelName: 'YouTube',
                        thumbnailUrl: `/api/thumbnail?videoId=${videoId}&q=maxresdefault`,
                        thumbnailFallback: `/api/thumbnail?videoId=${videoId}&q=hqdefault`,
                    }));
                    return;
                }

                // ── /api/transcript ──
                if (url.startsWith('/api/transcript')) {
                    const params = new URL(url, 'http://localhost');
                    const videoId = params.searchParams.get('videoId');

                    if (!videoId) {
                        res.statusCode = 400;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ error: 'Missing videoId parameter' }));
                        return;
                    }

                    try {
                        const segments = await fetchYoutubeTranscript(videoId);
                        res.statusCode = 200;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ segments, videoId }));
                    } catch (error: any) {
                        console.error('[Tonso API] Transcript error:', error.message);

                        let statusCode = 500;
                        let errorMessage = 'Erreur lors de la récupération du transcript.';

                        if (error.message?.includes('No transcript') || error.message?.includes('captions') || error.message?.includes('disabled')) {
                            statusCode = 404;
                            errorMessage = 'Aucun sous-titre disponible pour cette vidéo. Essayez une vidéo avec des sous-titres activés.';
                        } else if (error.message?.includes('unavailable') || error.message?.includes('not found')) {
                            statusCode = 404;
                            errorMessage = "Vidéo introuvable. Vérifiez l'URL.";
                        } else if (error.message?.includes('captcha') || error.message?.includes('Too many')) {
                            statusCode = 429;
                            errorMessage = 'YouTube bloque temporairement les requêtes. Réessayez dans quelques minutes.';
                        } else if (error.message?.includes('timeout')) {
                            statusCode = 504;
                            errorMessage = 'Délai dépassé. Vérifiez votre connexion réseau.';
                        }

                        res.statusCode = statusCode;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ error: errorMessage }));
                    }
                    return;
                }

                next();
            });
        },
    };
}

// ── HTTPS helpers (rejectUnauthorized:false for corporate proxy SSL interception) ──

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const RE_XML_TRANSCRIPT = /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g;

/** Fetches a URL and returns the response as a Buffer (for binary data like images). */
function httpsGetBinary(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options: https.RequestOptions = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: { 'User-Agent': USER_AGENT },
            rejectUnauthorized: false,
        };
        const request = https.request(options, (response) => {
            if (response.statusCode && response.statusCode >= 400) {
                reject(new Error(`HTTP ${response.statusCode}`));
                return;
            }
            const chunks: Buffer[] = [];
            response.on('data', (chunk: Buffer) => chunks.push(chunk));
            response.on('end', () => resolve(Buffer.concat(chunks)));
            response.on('error', reject);
        });
        request.on('error', reject);
        request.setTimeout(10000, () => { request.destroy(); reject(new Error('timeout')); });
        request.end();
    });
}

function httpsGet(url: string, extraHeaders: Record<string, string> = {}): Promise<string> {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options: https.RequestOptions = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
                'User-Agent': USER_AGENT,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'identity',
                'Connection': 'keep-alive',
                ...extraHeaders,
            },
            rejectUnauthorized: false, // Required: corporate/antivirus proxies replace SSL certs
        };

        const request = https.request(options, (response) => {
            // Follow redirects
            if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                const redirectUrl = response.headers.location.startsWith('http')
                    ? response.headers.location
                    : `https://${urlObj.hostname}${response.headers.location}`;
                httpsGet(redirectUrl, extraHeaders).then(resolve).catch(reject);
                return;
            }

            if (response.statusCode && response.statusCode >= 400) {
                reject(new Error(`HTTP ${response.statusCode} for ${url}`));
                return;
            }

            let data = '';
            response.setEncoding('utf8');
            response.on('data', (chunk: string) => { data += chunk; });
            response.on('end', () => resolve(data));
            response.on('error', reject);
        });

        request.on('error', (err) => {
            reject(new Error(`Network error: ${err.message}`));
        });

        request.setTimeout(20000, () => {
            request.destroy();
            reject(new Error('Request timeout after 20s'));
        });

        request.end();
    });
}

function decodeHtmlEntities(text: string): string {
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/\n/g, ' ')
        .trim();
}

interface TranscriptItem {
    text: string;
    offset: number;
    duration: number;
}

async function fetchYoutubeTranscript(videoId: string): Promise<TranscriptItem[]> {
    console.log(`[Tonso API] Fetching transcript for: ${videoId}`);

    // Step 1: Fetch the YouTube watch page
    const videoPageBody = await httpsGet(`https://www.youtube.com/watch?v=${videoId}`);
    console.log(`[Tonso API] Page fetched, length: ${videoPageBody.length}`);

    if (videoPageBody.includes('class="g-recaptcha"')) {
        throw new Error('Too many requests - YouTube is showing a captcha');
    }

    if (!videoPageBody.includes('"playabilityStatus":')) {
        throw new Error('Video unavailable or not found');
    }

    // Step 2: Extract captions JSON
    const splittedHTML = videoPageBody.split('"captions":');
    if (splittedHTML.length <= 1) {
        throw new Error('No captions/transcript disabled on this video');
    }

    let captions: any;
    try {
        const captionsJson = splittedHTML[1].split(',"videoDetails')[0].replace(/\n/g, '');
        captions = JSON.parse(captionsJson)?.playerCaptionsTracklistRenderer;
    } catch (e) {
        throw new Error('Failed to parse captions data from page');
    }

    if (!captions?.captionTracks?.length) {
        throw new Error('No transcript available for this video');
    }

    console.log(`[Tonso API] Found ${captions.captionTracks.length} caption track(s)`);

    // Step 3: Fetch the transcript XML
    const transcriptURL = captions.captionTracks[0].baseUrl;
    const transcriptBody = await httpsGet(transcriptURL);
    console.log(`[Tonso API] Transcript XML fetched, length: ${transcriptBody.length}`);

    // Step 4: Parse XML
    const results = [...transcriptBody.matchAll(RE_XML_TRANSCRIPT)];
    if (results.length === 0) {
        throw new Error('Transcript XML is empty or malformed');
    }

    console.log(`[Tonso API] Parsed ${results.length} transcript segments`);

    return results.map((result) => ({
        text: decodeHtmlEntities(result[3]),
        offset: parseFloat(result[1]),
        duration: parseFloat(result[2]),
    }));
}
