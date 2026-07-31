import React, { useState } from 'react';
import { Play, Sparkles, Plus, Trash2, Edit2, Save, X, MessageSquare, UserCheck, Layers, ChevronLeft, StickyNote } from 'lucide-react';
import { Script, Line } from '../types';

interface ScriptEditorViewProps {
  script: Script;
  selectedCharacter: string;
  onSelectCharacter: (char: string) => void;
  onUpdateScript: (script: Script) => void;
  onLaunchRehearsal: () => void;
  onLaunchAnalysis: () => void;
  onBackToArchive: () => void;
  onDeleteScript?: (scriptId: string) => void;
}

export const ScriptEditorView: React.FC<ScriptEditorViewProps> = ({
  script,
  selectedCharacter,
  onSelectCharacter,
  onUpdateScript,
  onLaunchRehearsal,
  onLaunchAnalysis,
  onBackToArchive,
  onDeleteScript,
}) => {
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editCharacter, setEditCharacter] = useState('');
  const [editText, setEditText] = useState('');
  const [editStageDirection, setEditStageDirection] = useState('');
  const [editNote, setEditNote] = useState('');

  // New line state
  const [isAddingLine, setIsAddingLine] = useState(false);
  const [newChar, setNewChar] = useState(script.characters[0] || 'KARAKTER');
  const [newText, setNewText] = useState('');
  const [newStageDir, setNewStageDir] = useState('');

  // Character filter
  const [characterFilter, setCharacterFilter] = useState<string>('all');

  const startEdit = (line: Line) => {
    setEditingLineId(line.id);
    setEditCharacter(line.character);
    setEditText(line.text);
    setEditStageDirection(line.stageDirection || '');
    setEditNote(line.notes || '');
  };

  const saveEdit = (lineId: string) => {
    const updatedLines = script.lines.map((line) => {
      if (line.id === lineId) {
        return {
          ...line,
          character: editCharacter.trim().toUpperCase(),
          text: editText,
          stageDirection: editStageDirection || undefined,
          notes: editNote || undefined,
        };
      }
      return line;
    });

    // Update character list if new character introduced
    const updatedCharacters = Array.from(new Set(updatedLines.map((l) => l.character))).filter(
      (c) => c !== 'SAHNE YÖNERGESİ'
    );

    onUpdateScript({
      ...script,
      lines: updatedLines,
      characters: updatedCharacters,
      updatedAt: Date.now(),
    });

    setEditingLineId(null);
  };

  const deleteLine = (lineId: string) => {
    const updatedLines = script.lines.filter((l) => l.id !== lineId);
    onUpdateScript({
      ...script,
      lines: updatedLines,
      updatedAt: Date.now(),
    });
  };

  const handleAddNewLine = () => {
    if (!newText.trim()) return;

    const newLine: Line = {
      id: `line-${Date.now()}`,
      character: newChar.trim().toUpperCase(),
      text: newText,
      stageDirection: newStageDir ? newStageDir : undefined,
    };

    const updatedLines = [...script.lines, newLine];
    const updatedCharacters = Array.from(new Set(updatedLines.map((l) => l.character))).filter(
      (c) => c !== 'SAHNE YÖNERGESİ'
    );

    onUpdateScript({
      ...script,
      lines: updatedLines,
      characters: updatedCharacters,
      updatedAt: Date.now(),
    });

    setNewText('');
    setNewStageDir('');
    setIsAddingLine(false);
  };

  const filteredLines = script.lines.filter((l) => {
    if (characterFilter !== 'all' && l.character !== characterFilter) return false;
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-8 py-8 space-y-8">
      {/* Top Navigation & Actions Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <button
          onClick={onBackToArchive}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-amber-400 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Arşive Dön
        </button>

        <div className="flex flex-wrap items-center gap-3">
          {onDeleteScript && (
            <button
              onClick={() => onDeleteScript(script.id)}
              className="px-3.5 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-800/60 text-red-300 font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer"
              title="Metni Sil"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
              <span>Metni Sil</span>
            </button>
          )}

          <button
            onClick={onLaunchAnalysis}
            className="px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-semibold text-xs flex items-center gap-2 transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>AI Karakter Analizi</span>
          </button>

          <button
            id="start-rehearsal-from-editor-btn"
            onClick={onLaunchRehearsal}
            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Provaya Başla</span>
          </button>
        </div>
      </div>

      {/* Script Overview Card */}
      <div className="bg-slate-900/90 rounded-3xl p-6 border border-slate-800 space-y-6 shadow-xl">
        <div className="flex flex-col lg:flex-row justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs font-semibold">
                {script.genre}
              </span>
              <span className="text-xs text-slate-400">{script.lines.length} Replik</span>
            </div>
            <h2 className="text-3xl font-extrabold text-slate-100">{script.title}</h2>
            <p className="text-xs text-amber-400 font-medium">Yazar: {script.author}</p>
          </div>

          {/* Character Selection for Practice */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-amber-500/30 space-y-2 min-w-[280px]">
            <label className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-amber-400" /> Benim Karakterim (Rolüm):
            </label>
            <select
              id="select-my-character-dropdown"
              value={selectedCharacter}
              onChange={(e) => onSelectCharacter(e.target.value)}
              className="w-full bg-slate-900 border border-amber-500/40 rounded-xl px-3 py-2 text-sm font-bold text-amber-300 focus:outline-none focus:border-amber-400"
            >
              <option value="">-- Karakterinizi Seçin --</option>
              {script.characters.map((char) => (
                <option key={char} value={char}>
                  {char}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400">
              {selectedCharacter
                ? `Sıra "${selectedCharacter}" karakterine geldiğinde uygulama bekler.`
                : 'Lütfen prova yapmak istediğiniz karakterinizi seçin.'}
            </p>
          </div>
        </div>

        {/* Character Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-800/80">
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="text-xs text-slate-400 font-semibold">Filtrele:</span>
            <button
              onClick={() => setCharacterFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                characterFilter === 'all'
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
            >
              Tüm Replikler ({script.lines.length})
            </button>
            {script.characters.map((char) => (
              <button
                key={char}
                onClick={() => setCharacterFilter(char)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  characterFilter === char
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                }`}
              >
                {char}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsAddingLine(true)}
            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-1.5 border border-slate-700 transition-all"
          >
            <Plus className="w-4 h-4 text-amber-400" /> Replik Ekle
          </button>
        </div>
      </div>

      {/* New Line Form Modal / Section */}
      {isAddingLine && (
        <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 space-y-4 shadow-2xl">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-amber-300">Yeni Replik / Sahne Yönergesi Ekle</h3>
            <button onClick={() => setIsAddingLine(false)} className="text-slate-400 hover:text-slate-200">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Karakter</label>
              <input
                type="text"
                value={newChar}
                onChange={(e) => setNewChar(e.target.value)}
                placeholder="Örn: HAMLET"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-slate-400 mb-1 block">Sahne Yönergesi (Parantez İçi - İsteğe Bağlı)</label>
              <input
                type="text"
                value={newStageDir}
                onChange={(e) => setNewStageDir(e.target.value)}
                placeholder="Örn: (Ağlayarak fısıldar)"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Replik Metni</label>
            <textarea
              rows={3}
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder="Konuşma repliğini yazın..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsAddingLine(false)}
              className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl"
            >
              İptal
            </button>
            <button
              onClick={handleAddNewLine}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl shadow-md"
            >
              Ekle
            </button>
          </div>
        </div>
      )}

      {/* Line List */}
      <div className="space-y-4">
        {filteredLines.map((line) => {
          const isSelectedRole = line.character === selectedCharacter;
          const isStageDir = line.character === 'SAHNE YÖNERGESİ';
          const isEditing = editingLineId === line.id;

          return (
            <div
              key={line.id}
              className={`p-5 rounded-2xl border transition-all ${
                isSelectedRole
                  ? 'bg-amber-500/10 border-amber-500/40 shadow-lg shadow-amber-500/5'
                  : isStageDir
                  ? 'bg-slate-950/60 border-slate-800/80 italic text-slate-400'
                  : 'bg-slate-900 border-slate-800/80 hover:border-slate-700'
              }`}
            >
              {isEditing ? (
                /* Edit Mode */
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={editCharacter}
                      onChange={(e) => setEditCharacter(e.target.value)}
                      className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-amber-300 font-bold"
                    />
                    <input
                      type="text"
                      placeholder="Sahne Yönergesi"
                      value={editStageDirection}
                      onChange={(e) => setEditStageDirection(e.target.value)}
                      className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-400 italic"
                    />
                  </div>
                  <textarea
                    rows={3}
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200"
                  />
                  <input
                    type="text"
                    placeholder="Oyuncu Prova Notu (Örn: Burada es ver, hüzünlü ton)"
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-amber-200/80"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setEditingLineId(null)}
                      className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs rounded-lg"
                    >
                      İptal
                    </button>
                    <button
                      onClick={() => saveEdit(line.id)}
                      className="px-4 py-1.5 bg-amber-500 text-slate-950 text-xs font-bold rounded-lg shadow-md flex items-center gap-1"
                    >
                      <Save className="w-3.5 h-3.5" /> Kaydet
                    </button>
                  </div>
                </div>
              ) : (
                /* View Mode */
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-extrabold tracking-wider ${
                          isSelectedRole ? 'text-amber-400' : 'text-slate-300'
                        }`}
                      >
                        {line.character}
                      </span>
                      {isSelectedRole && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-semibold">
                          Senin Rolün
                        </span>
                      )}
                      {line.stageDirection && (
                        <span className="text-xs text-slate-400 italic">{line.stageDirection}</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-200 leading-relaxed">{line.text}</p>
                    {line.notes && (
                      <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 font-medium">
                        <StickyNote className="w-3 h-3 text-amber-400" />
                        <span>Not: {line.notes}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startEdit(line)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition-colors"
                      title="Düzenle"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteLine(line.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
                      title="Sil"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
