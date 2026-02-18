import React from 'react';
import { TranslationProgress as ProgressType } from '../types';

interface TranslationProgressProps {
    progress: ProgressType;
}

const TranslationProgress: React.FC<TranslationProgressProps> = ({ progress }) => {
    return (
        <div className="w-full animate-in fade-in duration-500">
            <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700 rounded-2xl p-6 md:p-8 shadow-2xl">

                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <div className="relative w-12 h-12">
                        <div className="absolute inset-0 border-4 border-slate-700 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-t-cyan-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                        <div className="absolute inset-2 bg-slate-800 rounded-full flex items-center justify-center">
                            <span className="text-lg">
                                {progress.phase === 'translating' ? '🧠' : '🎙️'}
                            </span>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white">
                            {progress.phase === 'translating'
                                ? 'Traduction contextuelle en cours...'
                                : 'Génération vocale en cours...'}
                        </h3>
                        <p className="text-sm text-slate-400">
                            Segment {progress.currentChunk} / {progress.totalChunks}
                        </p>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="relative w-full h-3 bg-slate-900 rounded-full overflow-hidden mb-4">
                    <div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${progress.percentage}%` }}
                    >
                        <div className="absolute inset-0 progress-shimmer rounded-full"></div>
                    </div>
                </div>

                {/* Details */}
                <div className="flex justify-between items-center">
                    <p className="text-xs text-slate-500 truncate max-w-[70%] italic">
                        "{progress.currentText}"
                    </p>
                    <span className="text-sm font-mono font-bold text-cyan-400">
                        {progress.percentage}%
                    </span>
                </div>

                {/* Estimated info */}
                <div className="mt-4 flex gap-4 text-xs text-slate-600">
                    <div className="flex items-center gap-1">
                        <span>🔄</span>
                        <span>{progress.phase === 'translating' ? 'Adaptation linguistique' : 'Synthèse vocale'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span>📊</span>
                        <span>{Math.round((progress.currentChunk / progress.totalChunks) * 100)}% des segments</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TranslationProgress;
