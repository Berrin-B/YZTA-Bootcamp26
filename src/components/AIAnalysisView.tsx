import React, { useState, useEffect } from 'react';
import { Sparkles, Brain, User, MessageCircle, Send, BookOpen, Layers, RefreshCw, ChevronLeft, Award, HeartHandshake } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Script, ScriptAnalysisResult } from '../types';
import { getSavedAnalyses, saveAnalysis } from '../utils/storage';

interface AIAnalysisViewProps {
  script: Script;
  selectedCharacter: string;
  onBackToRehearsal: () => void;
  onBackToArchive: () => void;
}

export const AIAnalysisView: React.FC<AIAnalysisViewProps> = ({
  script,
  selectedCharacter,
  onBackToRehearsal,
  onBackToArchive,
}) => {
  const [activeTab, setActiveTab] = useState<'character' | 'subtext' | 'coach'>('character');
  const [characterName, setCharacterName] = useState(selectedCharacter || script.characters[0] || '');
  const [isLoading, setIsLoading] = useState(false);
  const [analysisText, setAnalysisText] = useState('');

  // Coach chat state
  const [coachQuestion, setCoachQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'coach'; message: string }>>([]);

  // Load existing analysis if cached in local storage
  useEffect(() => {
    const saved = getSavedAnalyses();
    const key = `${script.id}_${characterName}`;
    if (saved[key] && saved[key].psychology) {
      setAnalysisText(saved[key].psychology);
    } else {
      runAnalysis('character');
    }
  }, [script.id, characterName]);

  const runAnalysis = async (type: 'character' | 'subtext') => {
    setIsLoading(true);
    setAnalysisText('');
    try {
      const sceneContent = script.lines.map((l) => `${l.character}: ${l.text}`).join('\n');
      const res = await fetch('/api/gemini/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptTitle: script.title,
          characterName: characterName,
          sceneContent,
          type,
        }),
      });

      const data = await res.json();
      if (data.analysis) {
        setAnalysisText(data.analysis);
        if (type === 'character') {
          const result: ScriptAnalysisResult = {
            scriptId: script.id,
            characterName,
            psychology: data.analysis,
            backstory: data.analysis,
            superObjective: '',
            relationshipDynamics: '',
            actingTips: '',
            updatedAt: Date.now(),
          };
          saveAnalysis(result);
        }
      } else {
        setAnalysisText('Analiz sonucu alınamadı.');
      }
    } catch (e: any) {
      console.error('Analysis error:', e);
      setAnalysisText('Yapay zeka analizi oluşturulurken bir bağlantı hatası oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendCoachQuestion = async () => {
    if (!coachQuestion.trim()) return;

    const userMsg = coachQuestion;
    setCoachQuestion('');
    setChatHistory((prev) => [...prev, { role: 'user', message: userMsg }]);

    setIsLoading(true);
    try {
      const sceneContent = script.lines.map((l) => `${l.character}: ${l.text}`).join('\n');
      const res = await fetch('/api/gemini/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptTitle: script.title,
          characterName: characterName,
          sceneContent,
          type: 'coach_chat',
          userQuestion: userMsg,
        }),
      });

      const data = await res.json();
      if (data.analysis) {
        setChatHistory((prev) => [...prev, { role: 'coach', message: data.analysis }]);
      }
    } catch (e) {
      console.error('Coach error:', e);
      setChatHistory((prev) => [...prev, { role: 'coach', message: 'Uzman koç yanıt verirken bir hata oluştu.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-8 py-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Gemini AI Dramaturg & Oyunculuk Koçu</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-100">{script.title}</h2>
          <p className="text-xs text-amber-400 font-medium">Analiz Edilen Karakter: {characterName || 'Tüm Oyun'}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onBackToRehearsal}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all"
          >
            Provaya Dön
          </button>
          <button
            onClick={onBackToArchive}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700"
          >
            Arşive Dön
          </button>
        </div>
      </div>

      {/* Character Selector & Analysis Sub-Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-3">
          <User className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold text-slate-300">Karakter Seçin:</span>
          <select
            value={characterName}
            onChange={(e) => {
              setCharacterName(e.target.value);
            }}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-amber-300 font-bold focus:outline-none focus:border-amber-500"
          >
            {script.characters.map((char) => (
              <option key={char} value={char}>
                {char}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-medium">
          <button
            onClick={() => {
              setActiveTab('character');
              runAnalysis('character');
            }}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'character' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            <span>Karakter & Psikoloji</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('subtext');
              runAnalysis('subtext');
            }}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'subtext' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Alt Metin & Çatışma</span>
          </button>

          <button
            onClick={() => setActiveTab('coach')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'coach' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>AI Koç Sorularım</span>
          </button>
        </div>
      </div>

      {/* Main Analysis Content View */}
      {activeTab !== 'coach' ? (
        <div className="bg-slate-900/90 rounded-3xl p-6 md:p-8 border border-amber-500/20 shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <h3 className="text-lg font-bold text-amber-300 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              {activeTab === 'character' ? `${characterName} Karakter Analizi & Geçmişi` : 'Sahne Alt Metni & Çatışma Analizi'}
            </h3>
            <button
              onClick={() => runAnalysis(activeTab)}
              disabled={isLoading}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Yeniden Analiz Et</span>
            </button>
          </div>

          {isLoading ? (
            <div className="py-16 text-center space-y-3">
              <Sparkles className="w-10 h-10 text-amber-400 animate-spin mx-auto" />
              <p className="text-slate-300 font-medium">Gemini AI tiyatro dramaturgu metni inceliyor...</p>
              <p className="text-xs text-slate-500">Karakterin alt metni, motivasyonları ve geçmiş hikayesi oluşturuluyor.</p>
            </div>
          ) : (
            <div className="markdown-body text-slate-200 space-y-4 text-sm leading-relaxed">
              <ReactMarkdown>{analysisText}</ReactMarkdown>
            </div>
          )}
        </div>
      ) : (
        /* AI Acting Coach Chat Interface */
        <div className="bg-slate-900/90 rounded-3xl p-6 border border-amber-500/20 shadow-2xl space-y-6 flex flex-col min-h-[480px] justify-between">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-amber-300 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" /> AI Oyunculuk Koçunuz ile Sohbet
            </h3>
            <p className="text-xs text-slate-400">
              "{characterName}" rolü ve "{script.title}" oyunu hakkında aklınıza takılan her şeyi sorun. (Örn: Bu tiratta hangi kelimeleri vurgulamalıyım?)
            </p>
          </div>

          {/* Chat History Messages */}
          <div className="flex-1 space-y-4 overflow-y-auto max-h-[380px] pr-2 custom-scrollbar">
            {chatHistory.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs space-y-2">
                <HeartHandshake className="w-8 h-8 text-amber-500/30 mx-auto" />
                <p>Oyunculuk koçunuza bir soru sorarak başlayın.</p>
              </div>
            ) : (
              chatHistory.map((chat, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-2xl max-w-2xl text-xs leading-relaxed ${
                    chat.role === 'user'
                      ? 'ml-auto bg-amber-500/20 text-amber-100 border border-amber-500/30 font-medium'
                      : 'mr-auto bg-slate-950 text-slate-200 border border-slate-800'
                  }`}
                >
                  <span className="font-bold block mb-1 text-[10px] text-amber-400 uppercase">
                    {chat.role === 'user' ? 'Senin Sorun' : 'AI Oyunculuk Koçu'}
                  </span>
                  <p className="whitespace-pre-wrap">{chat.message}</p>
                </div>
              ))
            )}
            {isLoading && (
              <div className="p-3 bg-slate-950 rounded-2xl text-xs text-amber-400 font-medium animate-pulse">
                AI Oyunculuk Koçu yazıyor...
              </div>
            )}
          </div>

          {/* Input Box */}
          <div className="flex gap-2 pt-2 border-t border-slate-800">
            <input
              type="text"
              value={coachQuestion}
              onChange={(e) => setCoachQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendCoachQuestion()}
              placeholder="Oyunculuk koçunuza sorun... (Örn: Bu sahnede duygumu nasıl tırmandırmalıyım?)"
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/60"
            />
            <button
              onClick={handleSendCoachQuestion}
              disabled={!coachQuestion.trim() || isLoading}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all"
            >
              <Send className="w-4 h-4" />
              <span>Gönder</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
