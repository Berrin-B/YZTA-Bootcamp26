import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  RotateCcw,
  Volume2,
  Mic,
  MicOff,
  Eye,
  EyeOff,
  Settings,
  CheckCircle,
  HelpCircle,
  ChevronLeft,
  VolumeX,
  Keyboard,
  Sparkles,
  MessageSquare,
  Layers,
  Film,
  Filter,
  ListFilter,
  Bookmark,
  User,
  Wand2,
  SlidersHorizontal,
  Volume1,
  Smile,
  Zap,
} from 'lucide-react';
import { Script, RehearsalSettings, Line, CharacterVoiceConfig } from '../types';
import {
  speakText,
  stopSpeech,
  playCueChime,
  compareLineAccuracy,
  getAvailableVoices,
  getVoicesWithGenderInfo,
  inferCharacterGender,
  getOptimalVoiceForCharacter,
  inferGeminiVoiceForCharacter,
  prefetchTTSAudio,
  resetGeminiTtsCooldown,
  VoiceOption,
} from '../utils/speech';
import { extractScriptStructure, SceneSection } from '../utils/sceneExtractor';

interface RehearsalStageProps {
  script: Script;
  selectedCharacter: string;
  onBackToScript: () => void;
  onOpenAnalysis: () => void;
}

export const RehearsalStage: React.FC<RehearsalStageProps> = ({
  script,
  selectedCharacter,
  onBackToScript,
  onOpenAnalysis,
}) => {
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPromptHint, setShowPromptHint] = useState(false);
  const [typedUserText, setTypedUserText] = useState('');
  const [accuracyResult, setAccuracyResult] = useState<{ accuracyPercentage: number; missingWords: string[] } | null>(null);

  // Act & Scene Selection State
  const [selectedAct, setSelectedAct] = useState<string>('all');
  const [selectedSceneId, setSelectedSceneId] = useState<string>('all');
  const [onlyShowSelectedScene, setOnlyShowSelectedScene] = useState<boolean>(true);

  // Installed System Voices
  const [installedVoices, setInstalledVoices] = useState<VoiceOption[]>([]);
  const [testingVoiceChar, setTestingVoiceChar] = useState<string | null>(null);

  // Settings
  const [settings, setSettings] = useState<RehearsalSettings>({
    myCharacter: selectedCharacter || script.characters[0] || '',
    mode: 'interactive',
    speechRate: 1.0,
    pitch: 1.0,
    pauseDurationAfterOpponent: 1.5,
    hideMyLines: true,
    autoAdvanceOnSpeech: true,
    enableSoundEffects: true,
    voiceEngine: 'gemini',
    characterVoices: {},
  });

  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [showVoiceCustomizerModal, setShowVoiceCustomizerModal] = useState(false);

  // Load installed system voices on mount
  useEffect(() => {
    const loadVoices = () => {
      const v = getVoicesWithGenderInfo('tr');
      setInstalledVoices(v);
    };

    loadVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Auto-initialize character voice configs when script characters load
  useEffect(() => {
    if (!script.characters || script.characters.length === 0) return;

    setSettings((prev) => {
      const updatedVoices: Record<string, CharacterVoiceConfig> = { ...prev.characterVoices };
      let changed = false;

      script.characters.forEach((charName) => {
        if (!updatedVoices[charName]) {
          changed = true;
          const gender = inferCharacterGender(charName);
          const optimal = getOptimalVoiceForCharacter(charName);

          updatedVoices[charName] = {
            gender,
            voiceURI: optimal.voice?.voiceURI || '',
            voiceName: optimal.voice?.name || '',
            geminiVoiceName: optimal.geminiVoiceName,
            pitch: optimal.pitch,
            rate: optimal.rate,
            emotionPreset: 'natural',
          };
        }
      });

      return changed ? { ...prev, characterVoices: updatedVoices } : prev;
    });
  }, [script.characters]);

  // Speech Recognition (STT) State
  const [isListeningMic, setIsListeningMic] = useState(false);
  const [recognizedTranscript, setRecognizedTranscript] = useState('');
  const recognitionRef = useRef<any>(null);

  // Active line ref for autoscroll
  const activeLineRef = useRef<HTMLDivElement>(null);

  // Extract Act & Scene Structure
  const scriptStructure = useMemo(() => extractScriptStructure(script.lines), [script.lines]);

  // Filter scenes based on selected act
  const availableScenes = useMemo(() => {
    if (selectedAct === 'all') {
      return scriptStructure.allSections;
    }
    return scriptStructure.scenesByAct[selectedAct] || [];
  }, [selectedAct, scriptStructure]);

  // Compute active line indices according to filtering preferences
  const filteredLineIndices = useMemo(() => {
    if (!onlyShowSelectedScene) {
      return script.lines.map((_, idx) => idx);
    }

    if (selectedAct === 'all' && selectedSceneId === 'all') {
      return script.lines.map((_, idx) => idx);
    }

    if (selectedSceneId !== 'all') {
      const sec = scriptStructure.allSections.find((s) => s.id === selectedSceneId);
      if (sec) {
        const indices: number[] = [];
        for (let i = sec.startIndex; i <= sec.endIndex; i++) {
          indices.push(i);
        }
        return indices;
      }
    } else if (selectedAct !== 'all') {
      const actSections = scriptStructure.scenesByAct[selectedAct] || [];
      const indices: number[] = [];
      for (const sec of actSections) {
        for (let i = sec.startIndex; i <= sec.endIndex; i++) {
          indices.push(i);
        }
      }
      return indices;
    }

    return script.lines.map((_, idx) => idx);
  }, [selectedAct, selectedSceneId, onlyShowSelectedScene, script.lines, scriptStructure]);

  const currentLine = script.lines[currentLineIndex];
  const isMyTurn = currentLine && currentLine.character === settings.myCharacter;

  // Autoscroll active line into view smoothly
  useEffect(() => {
    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentLineIndex]);

  // Handle Speech Recognition setup
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = true;
        rec.lang = 'tr-TR';

        rec.onresult = (event: any) => {
          let transcript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          setRecognizedTranscript(transcript);

          if (event.results[0].isFinal && currentLine) {
            const comparison = compareLineAccuracy(transcript, currentLine.text);
            setAccuracyResult(comparison);
          }
        };

        rec.onerror = (e: any) => {
          console.warn('Speech recognition error:', e);
          setIsListeningMic(false);
        };

        rec.onend = () => {
          setIsListeningMic(false);
        };

        recognitionRef.current = rec;
      }
    }
    return () => {
      stopSpeech();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, [currentLineIndex]);

  // Playback Loop Controller with per-character voices and dynamic emotion intonation
  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (!isPlaying || !currentLine) return;

    if (currentLine.character === 'SAHNE YÖNERGESİ') {
      speakText(currentLine.text, {
        characterName: 'SAHNE YÖNERGESİ',
        stageDirection: 'sahne yönergesi',
        useGeminiTTS: settings.voiceEngine !== 'browser',
        rate: settings.speechRate * 0.95,
        pitch: 0.95,
        onEnd: () => {
          timer = setTimeout(() => {
            advanceNextLine();
          }, 800);
        },
      });
    } else if (!isMyTurn) {
      // Opponent line: AI Speaks with assigned character voice!
      const characterConfig = settings.characterVoices?.[currentLine.character];
      speakText(currentLine.text, {
        characterName: currentLine.character,
        stageDirection: currentLine.stageDirection,
        characterConfig,
        useGeminiTTS: settings.voiceEngine !== 'browser',
        rate: settings.speechRate,
        pitch: settings.pitch,
        onEnd: () => {
          if (
            settings.enableSoundEffects &&
            currentLineIndex + 1 < script.lines.length &&
            script.lines[currentLineIndex + 1].character === settings.myCharacter
          ) {
            playCueChime(); // Cue chime before actor's turn!
          }
          timer = setTimeout(() => {
            advanceNextLine();
          }, settings.pauseDurationAfterOpponent * 1000);
        },
      });
    } else {
      // User's turn (if continuous mode)
      if (settings.mode === 'continuous') {
        const characterConfig = settings.characterVoices?.[currentLine.character];
        speakText(currentLine.text, {
          characterName: currentLine.character,
          stageDirection: currentLine.stageDirection,
          characterConfig,
          useGeminiTTS: settings.voiceEngine !== 'browser',
          rate: settings.speechRate,
          pitch: settings.pitch,
          onEnd: () => {
            timer = setTimeout(() => {
              advanceNextLine();
            }, settings.pauseDurationAfterOpponent * 1000);
          },
        });
      }
    }

    return () => {
      clearTimeout(timer);
      stopSpeech();
    };
  }, [currentLineIndex, isPlaying, settings.myCharacter, settings.mode, settings.speechRate, settings.characterVoices, filteredLineIndices]);

  // Background Audio Preloading for Zero-Latency Opponent Speech
  useEffect(() => {
    if (!script || !script.lines || script.lines.length === 0) return;

    const currentPos = filteredLineIndices.indexOf(currentLineIndex);
    if (currentPos !== -1) {
      for (let i = 1; i <= 3; i++) {
        const nextIdx = filteredLineIndices[currentPos + i];
        if (nextIdx !== undefined) {
          const nextLine = script.lines[nextIdx];
          if (nextLine && nextLine.character !== settings.myCharacter) {
            const charConfig = settings.characterVoices?.[nextLine.character];
            prefetchTTSAudio(nextLine.text, {
              characterName: nextLine.character,
              stageDirection: nextLine.stageDirection,
              characterConfig: charConfig,
              useGeminiTTS: settings.voiceEngine !== 'browser',
            });
          }
        }
      }
    }
  }, [currentLineIndex, filteredLineIndices, script.lines, settings.myCharacter, settings.characterVoices, settings.voiceEngine]);

  const advanceNextLine = () => {
    stopSpeech();
    setShowPromptHint(false);
    setTypedUserText('');
    setRecognizedTranscript('');
    setAccuracyResult(null);

    const currentPos = filteredLineIndices.indexOf(currentLineIndex);
    if (currentPos !== -1 && currentPos < filteredLineIndices.length - 1) {
      setCurrentLineIndex(filteredLineIndices[currentPos + 1]);
    } else {
      setIsPlaying(false); // Rehearsal completed for this scene/section
    }
  };

  const advancePrevLine = () => {
    stopSpeech();
    setShowPromptHint(false);
    setTypedUserText('');
    setRecognizedTranscript('');
    setAccuracyResult(null);

    const currentPos = filteredLineIndices.indexOf(currentLineIndex);
    if (currentPos > 0) {
      setCurrentLineIndex(filteredLineIndices[currentPos - 1]);
    }
  };

  const handleActChange = (act: string) => {
    stopSpeech();
    setIsPlaying(false);
    setSelectedAct(act);
    setSelectedSceneId('all');

    if (act === 'all') {
      setCurrentLineIndex(0);
    } else {
      const firstSec = scriptStructure.scenesByAct[act]?.[0];
      if (firstSec) {
        setCurrentLineIndex(firstSec.startIndex);
      }
    }
  };

  const handleSceneChange = (sceneId: string) => {
    stopSpeech();
    setIsPlaying(false);
    setSelectedSceneId(sceneId);

    if (sceneId === 'all') {
      if (selectedAct !== 'all') {
        const firstSec = scriptStructure.scenesByAct[selectedAct]?.[0];
        if (firstSec) setCurrentLineIndex(firstSec.startIndex);
      } else {
        setCurrentLineIndex(0);
      }
    } else {
      const sec = scriptStructure.allSections.find((s) => s.id === sceneId);
      if (sec) {
        setCurrentLineIndex(sec.startIndex);
      }
    }
  };

  const toggleMicListening = () => {
    if (!recognitionRef.current) {
      alert('Tarayıcınız ses tanımayı desteklemiyor. Google Chrome veya Edge kullanabilirsiniz.');
      return;
    }
    if (isListeningMic) {
      recognitionRef.current.stop();
      setIsListeningMic(false);
    } else {
      setRecognizedTranscript('');
      setAccuracyResult(null);
      recognitionRef.current.start();
      setIsListeningMic(true);
    }
  };

  const handleTypedCheck = () => {
    if (!currentLine) return;
    const result = compareLineAccuracy(typedUserText, currentLine.text);
    setAccuracyResult(result);
  };

  // Auto-Match Gender & Voice for All Characters
  const handleAutoMatchGenderVoices = () => {
    setSettings((prev) => {
      const newVoices: Record<string, CharacterVoiceConfig> = {};
      script.characters.forEach((char) => {
        const gender = inferCharacterGender(char);
        const optimal = getOptimalVoiceForCharacter(char, {
          gender,
          pitch: gender === 'female' ? 1.38 : gender === 'male' ? 0.82 : 1.0,
          rate: 1.0,
        });

        newVoices[char] = {
          gender,
          voiceURI: optimal.voice?.voiceURI || '',
          voiceName: optimal.voice?.name || '',
          geminiVoiceName: optimal.geminiVoiceName,
          pitch: optimal.pitch,
          rate: optimal.rate,
          emotionPreset: 'natural',
        };
      });

      return { ...prev, characterVoices: newVoices };
    });
  };

  // Test character voice preview
  const handlePreviewCharacterVoice = (charName: string) => {
    stopSpeech();
    resetGeminiTtsCooldown();
    setTestingVoiceChar(charName);
    const characterConfig = settings.characterVoices?.[charName];

    speakText(`Merhaba, ben ${charName}. Oyundaki tüm repliklerimi bu ses tonu ve tonlama ile okuyacağım.`, {
      characterName: charName,
      characterConfig,
      useGeminiTTS: settings.voiceEngine !== 'browser',
      onEnd: () => setTestingVoiceChar(null),
    });
  };

  // Update specific character voice config
  const updateCharacterVoice = (charName: string, updates: Partial<CharacterVoiceConfig>) => {
    setSettings((prev) => {
      const current = prev.characterVoices?.[charName] || {
        gender: inferCharacterGender(charName),
        pitch: 1.0,
        rate: 1.0,
        emotionPreset: 'natural',
      };

      return {
        ...prev,
        characterVoices: {
          ...prev.characterVoices,
          [charName]: { ...current, ...updates },
        },
      };
    });
  };

  // Active scene info for display badge
  const activeSectionInfo = useMemo(() => {
    if (selectedSceneId !== 'all') {
      return scriptStructure.allSections.find((s) => s.id === selectedSceneId);
    }
    return null;
  }, [selectedSceneId, scriptStructure]);

  return (
    <div className="max-w-5xl mx-auto px-4 lg:px-8 py-6 space-y-6">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between bg-slate-900/90 p-4 rounded-2xl border border-slate-800 shadow-xl">
        <button
          onClick={onBackToScript}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-amber-400 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Metne Dön
        </button>

        <div className="text-center">
          <h2 className="text-base font-bold text-slate-100 truncate max-w-xs sm:max-w-md">{script.title}</h2>
          <p className="text-xs text-amber-400 font-medium">
            Senin Rolün: <span className="font-extrabold uppercase">{settings.myCharacter || 'Seçilmedi'}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowVoiceCustomizerModal(true)}
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Karakter Sesleri ve Tonlama Ayarları"
          >
            <SlidersHorizontal className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Karakter Sesleri</span>
          </button>
          <button
            onClick={onOpenAnalysis}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all"
            title="Karakter Analizi"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">AI Analiz</span>
          </button>
          <button
            onClick={() => setShowSettingsDrawer(!showSettingsDrawer)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
            title="Genel Ayarlar"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Act & Scene Selection Selector Bar */}
      <div className="bg-slate-900/95 border border-amber-500/30 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
            <Layers className="w-4 h-4 text-amber-400" />
            <span>Prova Bölümü ve Sahne Seçimi</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setOnlyShowSelectedScene(!onlyShowSelectedScene)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
                onlyShowSelectedScene
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
              title="Açık olduğunda sadece seçili sahnenin replikleri listelenir."
            >
              <Filter className="w-3.5 h-3.5" />
              <span>{onlyShowSelectedScene ? 'Sadece Seçili Sahneyi Göster' : 'Tüm Metinde Konumlan'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {/* Act / Perde Dropdown */}
          <div className="space-y-1">
            <label className="text-slate-400 font-semibold flex items-center gap-1">
              <Bookmark className="w-3.5 h-3.5 text-amber-400" /> Perde / Bölüm Seç:
            </label>
            <select
              value={selectedAct}
              onChange={(e) => handleActChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-amber-300 font-bold focus:outline-none focus:border-amber-500/60"
            >
              <option value="all">🎭 Tüm Oyun (Hepsi)</option>
              {scriptStructure.acts.map((act) => (
                <option key={act} value={act}>
                  {act}
                </option>
              ))}
            </select>
          </div>

          {/* Scene / Sahne Dropdown */}
          <div className="space-y-1">
            <label className="text-slate-400 font-semibold flex items-center gap-1">
              <Film className="w-3.5 h-3.5 text-amber-400" /> Sahne Seç:
            </label>
            <select
              value={selectedSceneId}
              onChange={(e) => handleSceneChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-amber-300 font-bold focus:outline-none focus:border-amber-500/60"
            >
              <option value="all">🎬 Tüm Sahneler (Hepsi)</option>
              {availableScenes.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  {sec.sceneTitle} ({sec.lineCount} Replik)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Selected Scene Context Banner */}
        <div className="flex flex-wrap items-center justify-between text-xs bg-slate-950/80 px-3.5 py-2 rounded-xl border border-slate-800/80 text-slate-300">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 font-bold">📍 Çalışılan Alan:</span>
            <span>
              {selectedAct === 'all' ? 'Tüm Oyun' : selectedAct} ›{' '}
              {activeSectionInfo ? activeSectionInfo.sceneTitle : 'Tüm Sahneler'}
            </span>
          </div>

          <div className="font-mono text-slate-400">
            Listelenen Replik: <span className="text-amber-400 font-bold">{filteredLineIndices.length}</span> / Toplam {script.lines.length}
          </div>
        </div>
      </div>

      {/* General Settings Drawer */}
      {showSettingsDrawer && (
        <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-5 space-y-4 shadow-2xl animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
              <Settings className="w-4 h-4" /> Prova Sahnesi Ayarları
            </h3>
            <button onClick={() => setShowSettingsDrawer(false)} className="text-xs text-slate-400 hover:text-slate-200">
              Kapat ✕
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            {/* Character selection */}
            <div>
              <label className="text-slate-400 mb-1 block font-semibold">Benim Rolüm:</label>
              <select
                value={settings.myCharacter}
                onChange={(e) => setSettings({ ...settings, myCharacter: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-amber-300 font-bold"
              >
                {script.characters.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Speech Rate */}
            <div>
              <label className="text-slate-400 mb-1 block font-semibold">
                Genel Okuma Hızı (TTS): <span className="text-amber-400 font-bold">{settings.speechRate}x</span>
              </label>
              <input
                type="range"
                min="0.7"
                max="1.5"
                step="0.1"
                value={settings.speechRate}
                onChange={(e) => setSettings({ ...settings, speechRate: parseFloat(e.target.value) })}
                className="w-full accent-amber-500"
              />
            </div>

            {/* Pause duration after opponent */}
            <div>
              <label className="text-slate-400 mb-1 block font-semibold">
                Rakip Replik Sonrası Es Saniyesi: <span className="text-amber-400 font-bold">{settings.pauseDurationAfterOpponent} sn</span>
              </label>
              <input
                type="range"
                min="0.5"
                max="4"
                step="0.5"
                value={settings.pauseDurationAfterOpponent}
                onChange={(e) => setSettings({ ...settings, pauseDurationAfterOpponent: parseFloat(e.target.value) })}
                className="w-full accent-amber-500"
              />
            </div>

            {/* Mask lines toggle */}
            <div className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-300 font-medium">Repliklerimi Gizle (Ezber Modu)</span>
              <button
                onClick={() => setSettings({ ...settings, hideMyLines: !settings.hideMyLines })}
                className={`px-3 py-1 rounded-lg font-bold text-[11px] ${
                  settings.hideMyLines ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {settings.hideMyLines ? 'AÇIK' : 'KAPALI'}
              </button>
            </div>

            {/* Cue sound effect toggle */}
            <div className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-300 font-medium">Sıra Sende Sinyal Sesi</span>
              <button
                onClick={() => setSettings({ ...settings, enableSoundEffects: !settings.enableSoundEffects })}
                className={`px-3 py-1 rounded-lg font-bold text-[11px] ${
                  settings.enableSoundEffects ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {settings.enableSoundEffects ? 'AÇIK' : 'KAPALI'}
              </button>
            </div>

            {/* Voice Engine Switcher */}
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-3 pt-2 border-t border-slate-800">
              <label className="text-slate-300 font-semibold flex items-center gap-1.5 text-xs">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Seslendirme Motoru Seçimi:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    resetGeminiTtsCooldown();
                    setSettings({ ...settings, voiceEngine: 'gemini' });
                  }}
                  className={`p-3 rounded-2xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                    settings.voiceEngine !== 'browser'
                      ? 'bg-amber-500/15 border-amber-500/80 text-amber-200 shadow-lg shadow-amber-950/40'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-xs flex items-center gap-2">
                      Gemini AI İnsansı Sesi
                      {settings.voiceEngine !== 'browser' && (
                        <span className="bg-amber-500 text-slate-950 text-[9px] px-1.5 py-0.5 rounded font-black">
                          AKTİF
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] opacity-80 mt-0.5">
                      Kore, Fenrir, Charon, Puck, Zephyr ile tiyatral, duygulu insan sesleri
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, voiceEngine: 'browser' })}
                  className={`p-3 rounded-2xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                    settings.voiceEngine === 'browser'
                      ? 'bg-slate-800 border-amber-500 text-amber-200'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Volume2 className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-xs flex items-center gap-2">
                      Tarayıcı Sesi (Yedek)
                      {settings.voiceEngine === 'browser' && (
                        <span className="bg-slate-700 text-slate-200 text-[9px] px-1.5 py-0.5 rounded font-black">
                          AKTİF
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] opacity-80 mt-0.5">
                      Çevrimdışı tarayıcı Web Speech motoru
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Open Voice Customizer */}
            <div className="flex items-center justify-between bg-amber-500/10 p-3 rounded-xl border border-amber-500/30 sm:col-span-2 lg:col-span-3">
              <span className="text-amber-300 font-medium">Karakter Seslerini & Modlarını Özelleştir</span>
              <button
                onClick={() => {
                  setShowSettingsDrawer(false);
                  setShowVoiceCustomizerModal(true);
                }}
                className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg font-bold text-[11px] cursor-pointer"
              >
                Özelleştir ➔
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Character Voices Customizer Modal */}
      {showVoiceCustomizerModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#18191E] border border-amber-500/40 rounded-3xl max-w-3xl w-full p-6 space-y-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-stone-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-300">
                  <SlidersHorizontal className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-stone-100 font-serif">Karakter Sesleri & Dramatik Tonlama</h3>
                  <p className="text-xs text-stone-400">
                    Kadın karakterlere kadın, erkek karakterlere erkek sesleri atayabilir; ton yüksekliği ve duygularını özelleştirebilirsiniz.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowVoiceCustomizerModal(false)}
                className="p-2 text-stone-400 hover:text-stone-100 bg-stone-800 rounded-xl text-xs font-bold"
              >
                Kapat ✕
              </button>
            </div>

            {/* Voice Engine Mode Selector Banner */}
            <div className="bg-stone-900 border border-stone-800 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-stone-100 font-bold text-xs">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Ses Motoru Teknolojisi (Voice Engine)</span>
                </div>
                <p className="text-[11px] text-stone-400">
                  {settings.voiceEngine === 'browser'
                    ? 'Cihazınızın varsayılan çevrimdışı ses motoru kullanılıyor.'
                    : '🌟 Gemini AI Insansı Tiyatro Sesi: Gerçekçi insan nefesi, kadın & erkek tiyatro vurguları ve doğal diksiyon.'}
                </p>
              </div>
              <div className="flex items-center gap-1.5 bg-stone-950 p-1.5 rounded-xl border border-stone-800 shrink-0">
                <button
                  onClick={() => setSettings((prev) => ({ ...prev, voiceEngine: 'gemini' }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    settings.voiceEngine !== 'browser' ? 'bg-amber-500 text-stone-950 shadow-md font-black' : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>🌟 Gemini AI Insansı Ses</span>
                </button>
                <button
                  onClick={() => setSettings((prev) => ({ ...prev, voiceEngine: 'browser' }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    settings.voiceEngine === 'browser' ? 'bg-stone-700 text-white font-black' : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  <span>🎙️ Tarayıcı Cihaz Sesi</span>
                </button>
              </div>
            </div>

            {/* Auto Match Gender & Voices Banner */}
            <div className="bg-gradient-to-r from-amber-950/60 to-amber-900/30 border border-amber-500/40 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                  <Wand2 className="w-4 h-4 text-amber-400" />
                  <span>Akıllı Otomatik Cinsiyet ve Ses Eşleme</span>
                </div>
                <p className="text-[11px] text-amber-200/80">
                  Oyundaki tüm kadın karakterlere yüksek frekanslı kadın sesleri, erkek karakterlere pes erkek sesleri otomatik atanır.
                </p>
              </div>

              <button
                onClick={handleAutoMatchGenderVoices}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-extrabold text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all cursor-pointer shrink-0"
              >
                <Wand2 className="w-4 h-4" />
                <span>Otomatik Cinsiyet Eşle</span>
              </button>
            </div>

            {/* Character Voice Configuration Cards */}
            <div className="space-y-4 max-h-[420px] overflow-y-auto pr-2 custom-scrollbar">
              {script.characters.map((charName) => {
                const config = settings.characterVoices?.[charName] || {
                  gender: inferCharacterGender(charName),
                  pitch: 1.0,
                  rate: 1.0,
                  emotionPreset: 'natural',
                };

                const isTesting = testingVoiceChar === charName;

                return (
                  <div
                    key={charName}
                    className="bg-[#111215] border border-stone-800 rounded-2xl p-4 space-y-3 hover:border-amber-500/40 transition-all"
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-stone-800/80 pb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm border ${
                            config.gender === 'female'
                              ? 'bg-rose-950/60 border-rose-800/80 text-rose-300'
                              : config.gender === 'male'
                              ? 'bg-sky-950/60 border-sky-800/80 text-sky-300'
                              : 'bg-stone-800 border-stone-700 text-stone-300'
                          }`}
                        >
                          {config.gender === 'female' ? '👩' : config.gender === 'male' ? '👨' : '🎙️'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-stone-100 text-sm uppercase">{charName}</span>
                            {charName === settings.myCharacter && (
                              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                                Sen Oynuyorsun
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-stone-400 font-medium">
                            {config.gender === 'female' ? 'Kadın Karakter' : config.gender === 'male' ? 'Erkek Karakter' : 'Nötr / Anlatıcı'}
                          </span>
                        </div>
                      </div>

                      {/* Gender Selector Buttons */}
                      <div className="flex items-center gap-1 bg-stone-900 p-1 rounded-xl border border-stone-800">
                        <button
                          onClick={() => updateCharacterVoice(charName, { gender: 'female', pitch: 1.38, geminiVoiceName: 'Kore' })}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            config.gender === 'female' ? 'bg-rose-600 text-white shadow' : 'text-stone-400 hover:text-stone-200'
                          }`}
                        >
                          👩 Kadın
                        </button>
                        <button
                          onClick={() => updateCharacterVoice(charName, { gender: 'male', pitch: 0.82, geminiVoiceName: inferGeminiVoiceForCharacter(charName, 'male') })}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            config.gender === 'male' ? 'bg-sky-600 text-white shadow' : 'text-stone-400 hover:text-stone-200'
                          }`}
                        >
                          👨 Erkek
                        </button>
                        <button
                          onClick={() => updateCharacterVoice(charName, { gender: 'neutral', pitch: 1.0, geminiVoiceName: 'Zephyr' })}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                            config.gender === 'neutral' ? 'bg-stone-700 text-white shadow' : 'text-stone-400 hover:text-stone-200'
                          }`}
                        >
                          🎙️ Nötr
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                      {/* Gemini AI Voice Selection */}
                      <div className="space-y-1">
                        <label className="text-stone-400 font-semibold block text-[11px] flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-amber-400" /> Gemini AI Sesi:
                        </label>
                        <select
                          value={config.geminiVoiceName || inferGeminiVoiceForCharacter(charName, config.gender)}
                          onChange={(e) => updateCharacterVoice(charName, { geminiVoiceName: e.target.value as any })}
                          className="w-full bg-stone-900 border border-amber-500/40 rounded-xl px-2.5 py-1.5 text-amber-300 font-bold focus:outline-none focus:border-amber-500"
                        >
                          <option value="Kore">👩 Kore (Kadın - Sıcak & Doğal)</option>
                          <option value="Fenrir">👨 Fenrir (Erkek - Tınılı & Zengin)</option>
                          <option value="Charon">👨 Charon (Erkek - Otoriter & Derin)</option>
                          <option value="Puck">👦 Puck (Erkek - Dinamik & Genç)</option>
                          <option value="Zephyr">🎙️ Zephyr (Nötr - Dengeli Anlatıcı)</option>
                        </select>
                      </div>

                      {/* System Voice Selection */}
                      <div className="space-y-1">
                        <label className="text-stone-400 font-semibold block text-[11px]">Sistem Sesi (Yedek):</label>
                        <select
                          value={config.voiceURI || config.voiceName || ''}
                          onChange={(e) => {
                            const selected = installedVoices.find((v) => v.voice.voiceURI === e.target.value || v.name === e.target.value);
                            updateCharacterVoice(charName, {
                              voiceURI: selected?.voice.voiceURI || e.target.value,
                              voiceName: selected?.name || e.target.value,
                            });
                          }}
                          className="w-full bg-stone-900 border border-stone-800 rounded-xl px-2.5 py-1.5 text-stone-300 font-medium focus:outline-none focus:border-amber-500/60"
                        >
                          <option value="">⚙️ Otomatik Ses (Sistem)</option>
                          {installedVoices.map((v) => (
                            <option key={v.voice.voiceURI || v.name} value={v.voice.voiceURI || v.name}>
                              {v.gender === 'female' ? '👩' : v.gender === 'male' ? '👨' : '🎙️'} {v.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Emotion Preset */}
                      <div className="space-y-1">
                        <label className="text-stone-400 font-semibold block text-[11px]">Dramatik Tonlama:</label>
                        <select
                          value={config.emotionPreset || 'natural'}
                          onChange={(e) => updateCharacterVoice(charName, { emotionPreset: e.target.value as any })}
                          className="w-full bg-stone-900 border border-stone-800 rounded-xl px-2.5 py-1.5 text-stone-200 font-medium focus:outline-none focus:border-amber-500/60"
                        >
                          <option value="natural">🎭 Doğal / Dramatik</option>
                          <option value="excited">⚡ Coşkulu / Heyecanlı</option>
                          <option value="calm">🧘 Ciddi / Sakin</option>
                          <option value="whisper">🤫 Fısıltı / Gizemli</option>
                          <option value="angry">💥 Öfkeli / Sert</option>
                        </select>
                      </div>

                      {/* Pitch Control */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-stone-400 font-semibold">Ton Yüksekliği:</span>
                          <span className="text-amber-400 font-bold">{Math.round(config.pitch * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0.7"
                          max="1.4"
                          step="0.05"
                          value={config.pitch}
                          onChange={(e) => updateCharacterVoice(charName, { pitch: parseFloat(e.target.value) })}
                          className="w-full accent-amber-500"
                        />
                      </div>

                      {/* Speed Rate Control */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-stone-400 font-semibold">Konuşma Hızı:</span>
                          <span className="text-amber-400 font-bold">{Math.round(config.rate * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0.75"
                          max="1.35"
                          step="0.05"
                          value={config.rate}
                          onChange={(e) => updateCharacterVoice(charName, { rate: parseFloat(e.target.value) })}
                          className="w-full accent-amber-500"
                        />
                      </div>
                    </div>

                    {/* Test Audio Preview Button */}
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => handlePreviewCharacterVoice(charName)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                          isTesting
                            ? 'bg-amber-500 text-stone-950 animate-pulse'
                            : 'bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700'
                        }`}
                      >
                        <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                        <span>{isTesting ? 'Okunuyor...' : 'Örnek Sesi Dinle'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-stone-800">
              <p className="text-[11px] text-stone-400">
                Ayarlandıktan sonra sahne provasında her bir karakter kendi kadın/erkek sesi ve tonlamasıyla konuşacaktır.
              </p>
              <button
                onClick={() => setShowVoiceCustomizerModal(false)}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-extrabold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
              >
                Tamam, Ayarları Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Rehearsal Stage Script Display */}
      <div className="bg-slate-950 rounded-3xl border border-slate-800/80 p-6 md:p-8 space-y-6 shadow-2xl min-h-[420px] flex flex-col justify-between">
        {/* Script Lines Stream */}
        <div className="space-y-6 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
          {filteredLineIndices.map((actualIndex) => {
            const line = script.lines[actualIndex];
            if (!line) return null;

            const isActive = actualIndex === currentLineIndex;
            const isUserRole = line.character === settings.myCharacter;
            const isStageDir = line.character === 'SAHNE YÖNERGESİ';
            const charVoiceConfig = settings.characterVoices?.[line.character];

            return (
              <div
                key={line.id}
                ref={isActive ? activeLineRef : null}
                onClick={() => {
                  stopSpeech();
                  setCurrentLineIndex(actualIndex);
                }}
                className={`p-5 rounded-2xl transition-all duration-300 cursor-pointer ${
                  isActive
                    ? isUserRole
                      ? 'bg-amber-500/20 border-2 border-amber-500 shadow-xl shadow-amber-500/10 scale-[1.01]'
                      : 'bg-slate-900 border-2 border-sky-500/70 shadow-xl shadow-sky-500/10 scale-[1.01]'
                    : isUserRole
                    ? 'bg-amber-500/5 border border-amber-500/20 opacity-70 hover:opacity-100'
                    : isStageDir
                    ? 'bg-slate-900/40 border border-slate-800/60 opacity-60 text-slate-400 italic text-xs'
                    : 'bg-slate-900/60 border border-slate-800/80 opacity-60 hover:opacity-100'
                }`}
              >
                {/* Line Character & Badge */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-black tracking-wider uppercase flex items-center gap-1 ${
                        isActive
                          ? isUserRole
                            ? 'text-amber-400 text-sm'
                            : 'text-sky-400 text-sm'
                          : isUserRole
                          ? 'text-amber-300'
                          : 'text-slate-300'
                      }`}
                    >
                      {charVoiceConfig?.gender === 'female' ? '👩' : charVoiceConfig?.gender === 'male' ? '👨' : ''} {line.character}
                    </span>
                    {isUserRole && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                        SENİN REPLİĞİN
                      </span>
                    )}
                    {line.stageDirection && (
                      <span className="text-xs text-slate-400 italic font-mono">{line.stageDirection}</span>
                    )}
                  </div>
                  {isActive && (
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-extrabold animate-pulse">
                      AKTİF REPLİK ({actualIndex + 1}/{script.lines.length})
                    </span>
                  )}
                </div>

                {/* Line Content */}
                {isUserRole && settings.hideMyLines && isActive && !showPromptHint ? (
                  /* Masked Teleprompter View */
                  <div className="space-y-2">
                    <p className="text-lg font-bold text-amber-300/40 tracking-widest bg-slate-950 p-3 rounded-xl border border-amber-500/20 select-none">
                      {line.text.replace(/[^\s.,!?]/g, '•')}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowPromptHint(true);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>İpucu / Repliği Göster</span>
                    </button>
                  </div>
                ) : (
                  /* Normal Line View */
                  <p
                    className={`text-base sm:text-lg font-medium leading-relaxed ${
                      isActive ? 'text-slate-100 font-semibold' : 'text-slate-300'
                    }`}
                  >
                    {line.text}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Actor Active Turn Practice Tools (Voice STT / Typing Check) */}
        {isMyTurn && (
          <div className="bg-slate-900/90 p-5 rounded-2xl border border-amber-500/40 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <span className="text-xs font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" /> Sıra Sende! Repliğini Söyle Veya Yaz:
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleMicListening}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    isListeningMic
                      ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30'
                      : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                  }`}
                >
                  {isListeningMic ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  <span>{isListeningMic ? 'Dinliyor...' : 'Sesli Söyle (Mikrofon)'}</span>
                </button>
              </div>
            </div>

            {/* Speech Transcript Output */}
            {recognizedTranscript && (
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
                <span className="text-slate-400 block mb-1 font-semibold">Algılanan Sesiniz:</span>
                <p className="text-amber-200 font-mono text-sm">"{recognizedTranscript}"</p>
              </div>
            )}

            {/* Typing Check Option */}
            <div className="flex gap-2">
              <input
                type="text"
                value={typedUserText}
                onChange={(e) => setTypedUserText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTypedCheck()}
                placeholder="Ezber kontrolü için repliğini buraya yaz..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/60"
              />
              <button
                onClick={handleTypedCheck}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 cursor-pointer"
              >
                Kontrol Et
              </button>
            </div>

            {/* Accuracy Score Output */}
            {accuracyResult && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center justify-between border ${
                  accuracyResult.accuracyPercentage >= 80
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                }`}
              >
                <span className="font-bold">Ezber İsabet Oranı: %{accuracyResult.accuracyPercentage}</span>
                {accuracyResult.missingWords.length > 0 && (
                  <span className="text-[11px] opacity-80">
                    Eksik Kelimeler: {accuracyResult.missingWords.slice(0, 4).join(', ')}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Playback Controls Bar */}
        <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                stopSpeech();
                setCurrentLineIndex(filteredLineIndices[0] ?? 0);
                setIsPlaying(false);
              }}
              className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-all cursor-pointer"
              title="Sahne Başına Dön"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={advancePrevLine}
              disabled={filteredLineIndices.indexOf(currentLineIndex) <= 0}
              className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-200 border border-slate-800 transition-all cursor-pointer"
              title="Önceki Replik"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            <button
              id="rehearsal-play-toggle-btn"
              onClick={() => {
                if (isPlaying) {
                  stopSpeech();
                  setIsPlaying(false);
                } else {
                  setIsPlaying(true);
                }
              }}
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all transform hover:scale-105 cursor-pointer"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
              <span>{isPlaying ? 'Duraklat' : 'Provaya Başla / Oynat'}</span>
            </button>

            <button
              onClick={advanceNextLine}
              disabled={filteredLineIndices.indexOf(currentLineIndex) >= filteredLineIndices.length - 1}
              className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-200 border border-slate-800 transition-all cursor-pointer"
              title="Sonraki Replik"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          <div className="text-xs text-slate-400 font-mono">
            Replik {filteredLineIndices.indexOf(currentLineIndex) + 1} / {filteredLineIndices.length}
          </div>
        </div>
      </div>
    </div>
  );
};
