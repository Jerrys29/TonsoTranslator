import React from 'react';
import { AppSettings } from '../types';
import { SUPPORTED_LANGUAGES } from '../constants';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, updateSettings }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl w-full max-w-md shadow-2xl relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white"
        >
          ✕
        </button>
        
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <span className="text-cyan-400">⚡</span> Préférences
        </h2>

        <div className="space-y-6">
          
          <div className="p-3 bg-slate-900 rounded-lg">
             <p className="text-xs text-slate-500 uppercase font-bold mb-1">Configuration Actuelle</p>
             <div className="flex justify-between items-center text-slate-300 text-sm">
                <span>Langue Cible</span>
                <span className="text-white font-medium">
                  {SUPPORTED_LANGUAGES.find(l => l.code === settings.targetLanguage)?.name} {SUPPORTED_LANGUAGES.find(l => l.code === settings.targetLanguage)?.flag}
                </span>
             </div>
          </div>

          {/* Censure Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-slate-300">Filtre de Censure</label>
              <p className="text-xs text-slate-500">Adoucit le langage explicite</p>
            </div>
            <button
              onClick={() => updateSettings({ censureExplicit: !settings.censureExplicit })}
              className={`w-12 h-6 rounded-full p-1 transition-colors ${
                settings.censureExplicit ? 'bg-green-500' : 'bg-slate-600'
              }`}
            >
              <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                settings.censureExplicit ? 'translate-x-6' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Subtitles Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-slate-300">Sous-titres Intelligents</label>
              <p className="text-xs text-slate-500">Affichage synchronisé</p>
            </div>
            <button
              onClick={() => updateSettings({ showSubtitles: !settings.showSubtitles })}
              className={`w-12 h-6 rounded-full p-1 transition-colors ${
                settings.showSubtitles ? 'bg-cyan-500' : 'bg-slate-600'
              }`}
            >
              <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                settings.showSubtitles ? 'translate-x-6' : 'translate-x-0'
              }`} />
            </button>
          </div>
        </div>

        <div className="mt-8">
          <button 
            onClick={onClose}
            className="w-full bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl font-medium transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;