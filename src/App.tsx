import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ArchiveView } from './components/ArchiveView';
import { UploadCleanerView } from './components/UploadCleanerView';
import { ScriptEditorView } from './components/ScriptEditorView';
import { RehearsalStage } from './components/RehearsalStage';
import { AIAnalysisView } from './components/AIAnalysisView';
import { Script } from './types';
import {
  getSavedScripts,
  saveSingleScript,
  deleteScript,
  toggleFavoriteScript,
} from './utils/storage';
import { Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'archive' | 'upload' | 'rehearsal' | 'analysis' | 'editor'>('archive');
  const [scripts, setScripts] = useState<Script[]>([]);
  const [selectedScript, setSelectedScript] = useState<Script | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<string>('');

  // Delete modal & toast state
  const [scriptToDelete, setScriptToDelete] = useState<Script | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load saved scripts on start
  useEffect(() => {
    const loaded = getSavedScripts();
    setScripts(loaded);
    if (loaded.length > 0) {
      setSelectedScript(loaded[0]);
      if (loaded[0].characters.length > 0) {
        setSelectedCharacter(loaded[0].characters[0]);
      }
    }
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const handleSelectScriptForView = (script: Script) => {
    setSelectedScript(script);
    if (script.characters.length > 0) {
      setSelectedCharacter(script.characters[0]);
    }
    setActiveTab('editor');
  };

  const handleSelectScriptForRehearsal = (script: Script) => {
    setSelectedScript(script);
    if (script.characters.length > 0) {
      setSelectedCharacter(script.characters[0]);
    }
    setActiveTab('rehearsal');
  };

  const handleSelectScriptForAnalysis = (script: Script) => {
    setSelectedScript(script);
    if (script.characters.length > 0) {
      setSelectedCharacter(script.characters[0]);
    }
    setActiveTab('analysis');
  };

  const handleScriptCreated = (newScript: Script) => {
    const updated = saveSingleScript(newScript);
    setScripts(updated);
    setSelectedScript(newScript);
    if (newScript.characters.length > 0) {
      setSelectedCharacter(newScript.characters[0]);
    }
    showToast(`"${newScript.title}" metni başarıyla kaydedildi!`);
    setActiveTab('rehearsal');
  };

  const handleToggleFavorite = (scriptId: string) => {
    const updated = toggleFavoriteScript(scriptId);
    setScripts(updated);
    if (selectedScript && selectedScript.id === scriptId) {
      setSelectedScript({ ...selectedScript, isFavorite: !selectedScript.isFavorite });
    }
  };

  const promptDeleteScript = (scriptId: string) => {
    const target = scripts.find((s) => s.id === scriptId);
    if (target) {
      setScriptToDelete(target);
    }
  };

  const confirmDeleteScript = () => {
    if (!scriptToDelete) return;
    const targetId = scriptToDelete.id;
    const targetTitle = scriptToDelete.title;

    const updated = deleteScript(targetId);
    setScripts(updated);

    if (selectedScript && selectedScript.id === targetId) {
      const nextScript = updated[0] || null;
      setSelectedScript(nextScript);
      if (nextScript && nextScript.characters.length > 0) {
        setSelectedCharacter(nextScript.characters[0]);
      } else {
        setSelectedCharacter('');
      }
      setActiveTab('archive');
    }

    setScriptToDelete(null);
    showToast(`"${targetTitle}" oyunu başarıyla silindi.`);
  };

  const handleUpdateScript = (updatedScript: Script) => {
    const updatedList = saveSingleScript(updatedScript);
    setScripts(updatedList);
    setSelectedScript(updatedScript);
  };

  return (
    <div className="min-h-screen bg-[#111215] text-stone-200 font-sans selection:bg-amber-900/40 selection:text-amber-200 flex flex-col justify-between relative">
      <div>
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed top-5 right-5 z-50 bg-amber-500 text-stone-950 px-4 py-3 rounded-xl font-bold text-xs shadow-2xl flex items-center gap-2 border border-amber-400 animate-bounce">
            <CheckCircle2 className="w-4 h-4 text-stone-950" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Navigation Header */}
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          selectedScript={selectedScript}
          selectedCharacter={selectedCharacter}
        />

        {/* View Switcher */}
        <main className="pb-16">
          {activeTab === 'archive' && (
            <ArchiveView
              scripts={scripts}
              onSelectScript={handleSelectScriptForView}
              onSelectScriptForRehearsal={handleSelectScriptForRehearsal}
              onSelectScriptForAnalysis={handleSelectScriptForAnalysis}
              onToggleFavorite={handleToggleFavorite}
              onDeleteScript={promptDeleteScript}
              onOpenUpload={() => setActiveTab('upload')}
            />
          )}

          {activeTab === 'upload' && (
            <UploadCleanerView
              onScriptCreated={handleScriptCreated}
              onCancel={() => setActiveTab('archive')}
            />
          )}

          {activeTab === 'editor' && selectedScript && (
            <ScriptEditorView
              script={selectedScript}
              selectedCharacter={selectedCharacter}
              onSelectCharacter={setSelectedCharacter}
              onUpdateScript={handleUpdateScript}
              onLaunchRehearsal={() => setActiveTab('rehearsal')}
              onLaunchAnalysis={() => setActiveTab('analysis')}
              onBackToArchive={() => setActiveTab('archive')}
              onDeleteScript={promptDeleteScript}
            />
          )}

          {activeTab === 'rehearsal' && selectedScript && (
            <RehearsalStage
              script={selectedScript}
              selectedCharacter={selectedCharacter}
              onBackToScript={() => setActiveTab('editor')}
              onOpenAnalysis={() => setActiveTab('analysis')}
            />
          )}

          {activeTab === 'analysis' && selectedScript && (
            <AIAnalysisView
              script={selectedScript}
              selectedCharacter={selectedCharacter}
              onBackToRehearsal={() => setActiveTab('rehearsal')}
              onBackToArchive={() => setActiveTab('archive')}
            />
          )}
        </main>
      </div>

      {/* Delete Confirmation Modal */}
      {scriptToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#18191E] border border-stone-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-red-950/60 border border-red-800/80 text-red-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-stone-100 font-serif">Oyun Metnini Sil</h3>
                <p className="text-xs text-stone-400">Bu işlem geri alınamaz.</p>
              </div>
            </div>

            <p className="text-sm text-stone-300 leading-relaxed bg-[#111215] p-3 rounded-xl border border-stone-800">
              <span className="font-bold text-amber-300">"{scriptToDelete.title}"</span> oyunu ve kaydedilmiş tüm replik dizilimi sistemden kalıcı olarak silinecektir.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setScriptToDelete(null)}
                className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-medium text-xs transition-all cursor-pointer"
              >
                İptal Et
              </button>
              <button
                onClick={confirmDeleteScript}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-red-950/50 transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Evet, Metni Sil</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Footer */}
      <footer className="border-t border-stone-800 bg-[#141519] py-6 px-4 text-center text-xs text-stone-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="font-medium text-stone-300 font-serif">
            Aklımda &copy; 2026 — Tiyatro & Dizi Oyuncuları İçin Replik Studio
          </p>
          <div className="flex items-center gap-4 text-stone-400 text-[11px] font-medium">
            <span>PDF Replik Temizleme Engine</span>
            <span>•</span>
            <span>Sesli Prova Sahnesi</span>
            <span>•</span>
            <span>Dramaturg Analizi</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
