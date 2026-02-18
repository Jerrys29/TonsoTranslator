import React from 'react';

interface ExplicitContentWarningProps {
  isOpen: boolean;
  onDecide: (censure: boolean) => void;
}

const ExplicitContentWarning: React.FC<ExplicitContentWarningProps> = ({ isOpen, onDecide }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in zoom-in duration-300">
      <div className="bg-red-900/20 border border-red-500/50 p-8 rounded-2xl w-full max-w-lg text-center shadow-[0_0_50px_rgba(220,38,38,0.2)]">
        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        
        <h2 className="text-2xl font-bold text-white mb-2">Contenu Explicite Détecté</h2>
        <p className="text-slate-300 mb-8 leading-relaxed">
          L'IA a détecté un langage offensant ou explicite dans cette vidéo. 
          Comment souhaitez-vous procéder pour la traduction ?
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => onDecide(true)}
            className="px-6 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white rounded-xl font-medium transition-all"
          >
            🛡️ Censurer (Neutre)
          </button>
          <button
            onClick={() => onDecide(false)}
            className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-medium shadow-lg shadow-red-900/20 transition-all"
          >
            🔞 Conserver le langage
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExplicitContentWarning;