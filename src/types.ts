export interface Line {
  id: string;
  character: string; // e.g. "HAMLET", "STAGE_DIRECTION", "NINA"
  text: string;
  stageDirection?: string; // e.g. "(Bağırarak girer)"
  notes?: string; // Player personal rehearsal notes
  sceneNumber?: number;
}

export interface Script {
  id: string;
  title: string;
  author: string;
  genre: 'Dram' | 'Komedi' | 'Tragedya' | 'Monolog' | 'Dizi/Film' | 'Klasik';
  language: string;
  characters: string[];
  lines: Line[];
  description?: string;
  tags?: string[];
  isFavorite?: boolean;
  isPreset?: boolean;
  createdAt: number;
  updatedAt: number;
  coverImage?: string;
}

export type RehearsalMode = 'interactive' | 'continuous' | 'teleprompter' | 'typing';

export interface CharacterVoiceConfig {
  voiceURI?: string;
  voiceName?: string;
  geminiVoiceName?: 'Fenrir' | 'Charon' | 'Puck' | 'Kore' | 'Zephyr';
  gender: 'female' | 'male' | 'neutral';
  pitch: number; // 0.7 - 1.4
  rate: number;  // 0.7 - 1.4
  emotionPreset?: 'natural' | 'dramatic' | 'excited' | 'calm' | 'whisper' | 'angry';
}

export interface RehearsalSettings {
  myCharacter: string;
  mode: RehearsalMode;
  speechRate: number; // 0.7 - 1.5
  pitch: number; // 0.8 - 1.2
  pauseDurationAfterOpponent: number; // seconds (0.5 - 5)
  hideMyLines: boolean; // Teleprompter mask mode
  autoAdvanceOnSpeech: boolean;
  enableSoundEffects: boolean;
  voiceEngine?: 'gemini' | 'browser'; // 'gemini' = AI human voice, 'browser' = offline Web Speech
  characterVoices?: Record<string, CharacterVoiceConfig>;
  voiceGenderPreference?: Record<string, 'male' | 'female' | 'default'>;
}

export interface ScriptAnalysisResult {
  scriptId: string;
  characterName: string;
  psychology: string;
  backstory: string;
  superObjective: string;
  relationshipDynamics: string;
  actingTips: string;
  subtextBreakdown?: string;
  updatedAt: number;
}

export interface RawParseStats {
  totalLinesOriginal: number;
  totalLinesCleaned: number;
  charactersFound: string[];
  filteredHeadersCount: number;
}
