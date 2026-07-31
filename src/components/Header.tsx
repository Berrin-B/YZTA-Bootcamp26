import React from 'react';
import { BookOpen, Sparkles, Play, Theater, Bookmark, PlusCircle } from 'lucide-react';
import { Script } from '../types';

interface HeaderProps {
  activeTab: 'archive' | 'upload' | 'rehearsal' | 'analysis' | 'editor';
  setActiveTab: (tab: 'archive' | 'upload' | 'rehearsal' | 'analysis' | 'editor') => void;
  selectedScript: Script | null;
  selectedCharacter: string;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  selectedScript,
  selectedCharacter,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#141519]/95 backdrop-blur-md border-b border-stone-800/80 px-4 lg:px-8 py-3 transition-all shadow-md">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand Logo - Aklımda */}
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setActiveTab('archive')}>
          <div className="w-10 h-10 rounded-xl bg-stone-800 border border-amber-600/30 flex items-center justify-center transition-transform group-hover:scale-105 shadow-sm">
            <Theater className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-amber-100 tracking-tight font-serif">
                Aklımda
              </h1>
              <span className="text-stone-300 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-stone-800 border border-stone-700 tracking-wider">
                REPLİK & PROVA
              </span>
            </div>
            <p className="text-xs text-stone-400 font-medium hidden sm:block">Tiyatro & Dizi Oyuncuları İçin Replik Çalışma Asistanı</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-[#1A1B20] p-1.5 rounded-xl border border-stone-800 text-sm overflow-x-auto max-w-full">
          <button
            id="tab-archive-btn"
            onClick={() => setActiveTab('archive')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'archive'
                ? 'bg-amber-600/20 border border-amber-500/40 text-amber-200 font-semibold'
                : 'text-stone-300 hover:text-white hover:bg-stone-800/60'
            }`}
          >
            <BookOpen className="w-4 h-4 text-amber-500" />
            <span>Arşiv & Metinler</span>
          </button>

          <button
            id="tab-upload-btn"
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'upload'
                ? 'bg-amber-600/20 border border-amber-500/40 text-amber-200 font-semibold'
                : 'text-stone-300 hover:text-white hover:bg-stone-800/60'
            }`}
          >
            <PlusCircle className="w-4 h-4 text-amber-500" />
            <span>PDF Yükle & Temizle</span>
          </button>

          <button
            id="tab-rehearsal-btn"
            onClick={() => {
              if (selectedScript) setActiveTab('rehearsal');
              else setActiveTab('archive');
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'rehearsal'
                ? 'bg-rose-950/60 border border-rose-800/80 text-rose-200 font-semibold'
                : 'text-stone-300 hover:text-white hover:bg-stone-800/60'
            } ${!selectedScript ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={!selectedScript ? 'Önce arşivden bir oyun seçin' : 'Prova Sahnesine Git'}
          >
            <Play className="w-4 h-4 fill-current text-rose-400" />
            <span>Prova Sahnesi</span>
          </button>

          <button
            id="tab-analysis-btn"
            onClick={() => {
              if (selectedScript) setActiveTab('analysis');
              else setActiveTab('archive');
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'analysis'
                ? 'bg-stone-800 border border-amber-500/40 text-amber-200 font-semibold'
                : 'text-stone-300 hover:text-white hover:bg-stone-800/60'
            } ${!selectedScript ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={!selectedScript ? 'Önce bir oyun seçin' : 'Karakter ve Metin Analizi'}
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>AI Karakter Analizi</span>
          </button>
        </nav>

        {/* Selected Script Badge Indicator */}
        {selectedScript && (
          <div className="hidden xl:flex items-center gap-2 bg-stone-900 border border-stone-800 px-3 py-1.5 rounded-lg text-xs">
            <Bookmark className="w-3.5 h-3.5 text-amber-500" />
            <div className="truncate max-w-[160px]">
              <span className="text-amber-200 font-medium truncate block font-serif">{selectedScript.title}</span>
              <span className="text-stone-400 text-[10px]">Rol: {selectedCharacter || 'Seçilmedi'}</span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
