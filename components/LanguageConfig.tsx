import React from 'react';
import { AppSettings, Language, LanguageCode } from '../types';
import { SUPPORTED_LANGUAGES } from '../constants';

interface LanguageConfigProps {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  onContinue: () => void;
}

const LanguageConfig: React.FC<LanguageConfigProps> = ({ settings, updateSettings, onContinue }) => {
  
  return (
    <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-slate-800/50 backdrop-blur-md border border-slate-700 rounded-2xl p-6 md:p-8 shadow-2xl">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
          <span className="text-cyan-400">🌐</span> Configuration
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Source Language */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-400 uppercase tracking-wide">Langue Source (Vidéo)</label>
            <div className="relative">
              <select 
                value={settings.sourceLanguage}
                onChange={(e) => updateSettings({ sourceLanguage: e.target.value as LanguageCode | 'auto' })}
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 appearance-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none cursor-pointer"
              >
                <option value="auto">✨ Détection Automatique</option>
                {SUPPORTED_LANGUAGES.map(lang => (
                  <option key={`source-${lang.code}`} value={lang.code}>
                    {lang.flag} {lang.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                ▼
              </div>
            </div>
          </div>

          {/* Target Language */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-400 uppercase tracking-wide">Langue Cible (Doublage)</label>
            <div className="relative">
              <select 
                value={settings.targetLanguage}
                onChange={(e) => updateSettings({ targetLanguage: e.target.value as LanguageCode })}
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 appearance-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none cursor-pointer"
              >
                {SUPPORTED_LANGUAGES.map(lang => (
                  <option key={`target-${lang.code}`} value={lang.code}>
                    {lang.flag} {lang.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                ▼
              </div>
            </div>
          </div>
        </div>

        <button 
          onClick={onContinue}
          className="w-full bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-medium py-4 rounded-xl shadow-lg shadow-indigo-500/20 transition-all transform active:scale-[0.98]"
        >
          Continuer vers le Studio Vocal →
        </button>
      </div>
    </div>
  );
};

export default LanguageConfig;