import React, { useState } from 'react';
import { VideoMetadata } from '../types';

interface VideoPreviewCardProps {
    metadata: VideoMetadata;
    onConfirm: () => void;
    onCancel: () => void;
    isLoading?: boolean;
}

const VideoPreviewCard: React.FC<VideoPreviewCardProps> = ({
    metadata,
    onConfirm,
    onCancel,
    isLoading = false,
}) => {
    const proxyThumb = (q: string) => `/api/thumbnail?videoId=${metadata.videoId}&q=${q}`;
    const [imgSrc, setImgSrc] = useState(proxyThumb('maxresdefault'));

    return (
        <div className="w-full max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-slate-800/90 backdrop-blur-md border border-slate-700 rounded-2xl overflow-hidden shadow-2xl">

                {/* Thumbnail */}
                <div className="relative w-full aspect-video bg-slate-900">
                    <img
                        src={imgSrc}
                        alt={metadata.title}
                        className="w-full h-full object-cover"
                        onError={() => setImgSrc(proxyThumb('hqdefault'))}
                    />
                    {/* Play icon overlay */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center shadow-xl">
                            <svg className="w-7 h-7 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                            </svg>
                        </div>
                    </div>
                    {/* Duration badge placeholder */}
                    <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full border border-white/10">
                        <span className="text-xs font-bold text-white uppercase tracking-wider">YouTube</span>
                    </div>
                </div>

                {/* Info */}
                <div className="p-6">
                    <h3 className="text-white font-bold text-lg leading-snug mb-1 line-clamp-2">
                        {metadata.title}
                    </h3>
                    <p className="text-slate-400 text-sm mb-6 flex items-center gap-2">
                        <span className="w-5 h-5 bg-slate-700 rounded-full flex items-center justify-center text-xs">📺</span>
                        {metadata.channelName}
                    </p>

                    {/* Confirm / Cancel */}
                    <div className="flex gap-3">
                        <button
                            onClick={onCancel}
                            className="flex-1 py-3 rounded-xl border border-slate-600 text-slate-400 hover:text-white hover:border-slate-500 transition-all font-medium"
                        >
                            ← Changer
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={isLoading}
                            className="flex-[2] py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold transition-all shadow-lg shadow-cyan-900/30 flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Analyse en cours...</span>
                                </>
                            ) : (
                                <>
                                    <span>Traduire cette vidéo</span>
                                    <span>🚀</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VideoPreviewCard;
