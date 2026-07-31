import { CharacterVoiceConfig } from '../types';

export interface VoiceOption {
  voice: SpeechSynthesisVoice;
  name: string;
  lang: string;
  gender: 'female' | 'male' | 'neutral';
}

let activeAudioSource: AudioBufferSourceNode | null = null;
let activeAudioContext: AudioContext | null = null;
let geminiTtsCooldownUntil = 0;

// Client-side Audio Cache for zero-latency instant playback
const clientAudioCache = new Map<string, { audio: string; sampleRate: number }>();

/**
 * Pre-fetch and cache audio for upcoming lines in background
 */
export async function prefetchTTSAudio(
  text: string,
  options: {
    characterName?: string;
    stageDirection?: string;
    characterConfig?: CharacterVoiceConfig;
    useGeminiTTS?: boolean;
  }
): Promise<void> {
  const normalizedText = normalizeTurkishTheatricalText(text);
  if (!normalizedText) return;

  const useGemini = options.useGeminiTTS !== false && Date.now() > geminiTtsCooldownUntil;
  if (!useGemini) return;

  const gender = options.characterConfig?.gender || (options.characterName ? inferCharacterGender(options.characterName) : 'neutral');
  const emotion = options.characterConfig?.emotionPreset || 'natural';
  const voiceName = options.characterConfig?.geminiVoiceName;
  const stageDirection = options.stageDirection || '';

  const cacheKey = `${voiceName || ''}_${gender}_${emotion}_${stageDirection}_${normalizedText}`;
  if (clientAudioCache.has(cacheKey)) return;

  try {
    const response = await fetch('/api/tts/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: normalizedText,
        characterName: options.characterName || 'Karakter',
        gender,
        emotion,
        stageDirection,
        voiceName,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.audio) {
        clientAudioCache.set(cacheKey, {
          audio: data.audio,
          sampleRate: data.sampleRate || 24000,
        });
      }
    } else if (response.status === 429 || response.status === 503) {
      geminiTtsCooldownUntil = Date.now() + 60000;
    }
  } catch (e) {
    // Silent fail for prefetch
  }
}

/**
  * Stop all current speech synthesis and active AudioContext PCM streams
  */
export function stopSpeech(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  if (activeAudioSource) {
    try {
      activeAudioSource.stop();
    } catch (e) {
      // Ignore
    }
    activeAudioSource = null;
  }
  if (activeAudioContext) {
    try {
      activeAudioContext.close();
    } catch (e) {
      // Ignore
    }
    activeAudioContext = null;
  }
}

export function resetGeminiTtsCooldown(): void {
  geminiTtsCooldownUntil = 0;
}

/**
 * Play 16-bit PCM Audio (Sample Rate 24000Hz default from Gemini TTS) via Web Audio API
 */
export function playBase64PcmAudio(
  base64Audio: string,
  sampleRate = 24000,
  onEnd?: () => void
): boolean {
  stopSpeech();

  try {
    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const dataView = new DataView(bytes.buffer);
    const numSamples = Math.floor(bytes.length / 2);
    const float32Data = new Float32Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
      const int16 = dataView.getInt16(i * 2, true);
      float32Data[i] = int16 / 32768.0;
    }

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return false;

    const audioCtx = new AudioCtx({ sampleRate });
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    activeAudioContext = audioCtx;

    const audioBuffer = audioCtx.createBuffer(1, numSamples, sampleRate);
    audioBuffer.getChannelData(0).set(float32Data);

    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioCtx.destination);

    activeAudioSource = source;

    source.onended = () => {
      activeAudioSource = null;
      if (onEnd) onEnd();
    };

    source.start(0);
    return true;
  } catch (err) {
    console.error('Error playing Gemini PCM audio:', err);
    if (onEnd) onEnd();
    return false;
  }
}

/**
 * Clean & normalize Turkish theatrical script text for natural TTS pronunciation
 */
export function normalizeTurkishTheatricalText(text: string): string {
  if (!text) return '';

  let clean = text
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .trim();

  // Expand common Turkish abbreviations
  clean = clean
    .replace(/\bdr\./gi, 'doktor')
    .replace(/\bprof\./gi, 'profesör')
    .replace(/\bav\./gi, 'avukat')
    .replace(/\bvb\./gi, 've benzerleri')
    .replace(/\bvs\./gi, 've saire')
    .replace(/\bör\./gi, 'örneğin')
    .replace(/\b1\./g, 'birinci')
    .replace(/\b2\./g, 'ikinci')
    .replace(/\b3\./g, 'üçüncü')
    .replace(/\b4\./g, 'dördüncü')
    .replace(/\b5\./g, 'beşinci');

  // Replace double dashes or ellipsis with comma for natural breath breaks in speech
  clean = clean
    .replace(/--/g, ', ')
    .replace(/\.\.\./g, ', ')
    .replace(/\s+/g, ' ');

  return clean;
}

/**
 * Infer gender from character name or role (Turkish & International theatrical plays)
 */
export function inferCharacterGender(characterName: string): 'female' | 'male' | 'neutral' {
  if (!characterName) return 'neutral';
  const name = characterName.toUpperCase().trim();

  // Narrator / Stage Directions
  if (name.includes('SAHNE') || name.includes('ANLATICI') || name.includes('YÖNERGE') || name.includes('NARRATOR')) {
    return 'neutral';
  }

  // Female Indicators
  const femaleTokens = [
    'POPOVA', 'YELENA', 'ANNA','LEYLA', 'MERVE', 'KADIN', 'KIZ', 'ANNE', 'TEYZE', 'HANIM', 
    'PRENSES', 'KRALİÇE', 'KRALICE','NİNA', 'NINA', 'MAŞA', 'MASA', 'İRİNA', 'IRINA', 'ARKADİNA', 
    'DESDEMONA', 'JULIET', 'OPHELIA', 'MEDEA', 'VARYA', 'LUBOW', 'SONYA', 'LİZ', 'LIZ', 'NATASHA', 
    'ELENA', 'SONIA', 'MARY', 'MARIA', 'CATHERINE', 'MARGARET', 'ALICE', 'CLEOPATRA', 'LADY', 'MRS', 'MISS'
  ];

  for (const token of femaleTokens) {
    if (name.includes(token)) return 'female';
  }

  // Male Indicators
  const maleTokens = [
    'SMİRNOV', 'SMIRNOV', 'LUKA', 'LOPAKHIN', 'TREPLEV', 'TRIGORIN', 'ASTROV', 'VOYNITSKY',
    'HAMLET', 'OTHELLO', 'MACBETH', 'ROMEO', 'BABA', 'DEDE', 'AMCA', 'ERKEK', 'ADAM', 'BEY',
    'BAY', 'KRAL', 'PRENS', 'IVAN', 'GRIGORY', 'STEPAN', 'NICOLAI', 'ALEXANDER', 'BORIS', 'MIKHAIL', 'PETER',
    'JOHN', 'GEORGE', 'CHARLES', 'DAVID', 'MICHAEL', 'RICHARD', 'THOMAS', 'SIR', 'LORD', 'MR'
  ];

  for (const token of maleTokens) {
    if (name.includes(token)) return 'male';
  }

  return 'neutral';
}

/**
 * Infer gender of a browser SpeechSynthesisVoice based on name/lang
 */
export function inferVoiceGender(voice: SpeechSynthesisVoice): 'female' | 'male' | 'neutral' {
  const name = voice.name.toLowerCase();

  const femaleKeywords = [
    'emel', 'yelda', 'dilara', 'seda', 'zeynep', 'ayşe', 'ayse', 'female', 'woman', 'kadın',
    'hazel', 'susan', 'zira', 'catherine', 'eva', 'victoria', 'sin-ji', 'helena', 'filiz',
    'sibel', 'siri', 'samantha', 'google türkçe', 'google turkce'
  ];
  for (const kw of femaleKeywords) {
    if (name.includes(kw)) return 'female';
  }

  const maleKeywords = [
    'tolga', 'cem', 'kerem', 'ahmet', 'male', 'man', 'erkek', 'david', 'george', 'mark',
    'pavel', 'stefan', 'daniel', 'james', 'thomas'
  ];
  for (const kw of maleKeywords) {
    if (name.includes(kw)) return 'male';
  }

  return 'neutral';
}

export function getAvailableVoices(langPrefix: string = 'tr'): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return [];
  }
  const voices = window.speechSynthesis.getVoices();
  const filtered = voices.filter((v) => v.lang.toLowerCase().startsWith(langPrefix));
  return filtered.length > 0 ? filtered : voices;
}

export function getVoicesWithGenderInfo(langPrefix: string = 'tr'): VoiceOption[] {
  const rawVoices = getAvailableVoices(langPrefix);
  return rawVoices.map((v) => ({
    voice: v,
    name: v.name,
    lang: v.lang,
    gender: inferVoiceGender(v),
  }));
}

/**
 * Infer optimal Gemini prebuilt voice model according to character name & gender
 */
export function inferGeminiVoiceForCharacter(
  characterName: string,
  gender?: 'female' | 'male' | 'neutral'
): 'Fenrir' | 'Charon' | 'Puck' | 'Kore' | 'Zephyr' {
  const gen = gender || inferCharacterGender(characterName);
  if (gen === 'female') {
    return 'Kore';
  } else if (gen === 'male') {
    const charUpper = (characterName || '').toUpperCase();
    if (
      charUpper.includes('BABA') ||
      charUpper.includes('KRAL') ||
      charUpper.includes('SMİRNOV') ||
      charUpper.includes('SMIRNOV') ||
      charUpper.includes('BEY') ||
      charUpper.includes('MÜDÜR')
    ) {
      return 'Charon'; // Deep / Authoritative
    } else if (
      charUpper.includes('GENÇ') ||
      charUpper.includes('GENC') ||
      charUpper.includes('LUKA') ||
      charUpper.includes('OĞUL') ||
      charUpper.includes('ÇOCUK')
    ) {
      return 'Puck'; // Lively / Energetic / Young
    } else {
      return 'Fenrir'; // Natural rich male
    }
  }
  return 'Zephyr';
}

/**
 * Select best system voice and pitch/rate parameters for a specific character
 */
export function getOptimalVoiceForCharacter(
  characterName: string,
  config?: CharacterVoiceConfig
): {
  voice: SpeechSynthesisVoice | null;
  pitch: number;
  rate: number;
  geminiVoiceName: 'Fenrir' | 'Charon' | 'Puck' | 'Kore' | 'Zephyr';
} {
  const voices = getAvailableVoices('tr');
  const gender = config?.gender || inferCharacterGender(characterName);
  const geminiVoiceName = config?.geminiVoiceName || inferGeminiVoiceForCharacter(characterName, gender);

  let selectedVoice: SpeechSynthesisVoice | null = null;

  // 1. If explicit voiceURI/voiceName is in config
  if (config?.voiceURI || config?.voiceName) {
    const match = voices.find(
      (v) => v.voiceURI === config.voiceURI || v.name === config.voiceName
    );
    if (match) selectedVoice = match;
  }

  // 2. Try to find a voice that matches character gender
  if (!selectedVoice && voices.length > 0) {
    const genderMatch = voices.find((v) => inferVoiceGender(v) === gender);
    if (genderMatch) {
      selectedVoice = genderMatch;
    } else {
      selectedVoice = voices[0];
    }
  }

  // Base pitch & rate according to gender & emotion
  let basePitch = config?.pitch ?? 1.0;
  let baseRate = config?.rate ?? 1.0;

  // Crucial Fix: If gender is female and no female system voice is natively present,
  // boost pitch significantly (1.38 - 1.45) so male base voice sounds genuinely female!
  if (gender === 'female') {
    if (!config || config.pitch === 1.0) {
      basePitch = 1.38;
      baseRate = 1.04;
    }
  } else if (gender === 'male') {
    if (!config || config.pitch === 1.0) {
      basePitch = 0.82;
      baseRate = 0.96;
    }
  }

  // Apply emotion adjustments
  if (config?.emotionPreset) {
    switch (config.emotionPreset) {
      case 'dramatic':
        basePitch *= 0.95;
        baseRate *= 0.90;
        break;
      case 'excited':
        basePitch *= 1.12;
        baseRate *= 1.12;
        break;
      case 'calm':
        basePitch *= 0.96;
        baseRate *= 0.92;
        break;
      case 'whisper':
        basePitch *= 0.85;
        baseRate *= 0.85;
        break;
      case 'angry':
        basePitch *= 1.10;
        baseRate *= 1.15;
        break;
    }
  }

  return {
    voice: selectedVoice,
    pitch: Math.max(0.5, Math.min(2.0, basePitch)),
    rate: Math.max(0.5, Math.min(2.0, baseRate)),
    geminiVoiceName,
  };
}

export async function speakText(
  text: string,
  options: {
    characterName?: string;
    stageDirection?: string;
    characterConfig?: CharacterVoiceConfig;
    useGeminiTTS?: boolean;
    rate?: number;
    pitch?: number;
    voice?: SpeechSynthesisVoice | null;
    onEnd?: () => void;
    onError?: () => void;
  }
): Promise<void> {
  stopSpeech();

  const normalizedText = normalizeTurkishTheatricalText(text);
  if (!normalizedText) {
    if (options.onEnd) options.onEnd();
    return;
  }

  const gender = options.characterConfig?.gender || (options.characterName ? inferCharacterGender(options.characterName) : 'neutral');
  const emotion = options.characterConfig?.emotionPreset || 'natural';
  const voiceName = options.characterConfig?.geminiVoiceName;
  const stageDirection = options.stageDirection || '';

  // 1. Try Gemini AI Human Voice TTS (Default: Enabled)
  const useGemini = options.useGeminiTTS !== false && Date.now() > geminiTtsCooldownUntil;

  if (useGemini) {
    const cacheKey = `${voiceName || ''}_${gender}_${emotion}_${stageDirection}_${normalizedText}`;

    // Zero-latency playback from client pre-fetch cache
    if (clientAudioCache.has(cacheKey)) {
      const cached = clientAudioCache.get(cacheKey)!;
      const success = playBase64PcmAudio(cached.audio, cached.sampleRate, options.onEnd);
      if (success) return;
    }

    try {
      const response = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: normalizedText,
          characterName: options.characterName || 'Karakter',
          gender,
          emotion,
          stageDirection,
          voiceName,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.audio) {
          clientAudioCache.set(cacheKey, {
            audio: data.audio,
            sampleRate: data.sampleRate || 24000,
          });
          const success = playBase64PcmAudio(data.audio, data.sampleRate || 24000, options.onEnd);
          if (success) return;
        }
      } else {
        if (response.status === 429 || response.status === 503) {
          // Cooldown Gemini TTS for 60 seconds when rate-limited/quota exceeded
          geminiTtsCooldownUntil = Date.now() + 60000;
          console.warn('Gemini TTS quota limit reached. Cooldown active for 60s; falling back to Web Speech API.');
        }
      }
    } catch (e) {
      console.warn('Gemini TTS fetch error, falling back to Web Speech API:', e);
    }
  }

  // 2. Fallback to Web Speech API
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (options.onEnd) options.onEnd();
    return;
  }

  let targetVoice = options.voice || null;
  let targetPitch = options.pitch || 1.0;
  let targetRate = options.rate || 1.0;

  if (options.characterName) {
    const optimal = getOptimalVoiceForCharacter(options.characterName, options.characterConfig);
    if (!targetVoice) targetVoice = optimal.voice;
    targetPitch *= optimal.pitch;
    targetRate *= optimal.rate;
  } else if (!targetVoice) {
    const voices = getAvailableVoices('tr');
    if (voices.length > 0) targetVoice = voices[0];
  }

  // Override gender pitch
  if (gender === 'female' && (!options.characterConfig || options.characterConfig.pitch === 1.0)) {
    targetPitch = 1.38;
    targetRate = 1.04;
  } else if (gender === 'male' && (!options.characterConfig || options.characterConfig.pitch === 1.0)) {
    targetPitch = 0.82;
    targetRate = 0.96;
  }

  // Dynamic dramaturgical emotion modulation from inline parentheticals / stageDirection
  const stageDirText = ((options.stageDirection || '') + ' ' + (text.match(/\((.*?)\)/)?.[1] || '')).toLowerCase();

  if (stageDirText) {
    if (stageDirText.includes('öfke') || stageDirText.includes('bağır') || stageDirText.includes('sert') || stageDirText.includes('sinir')) {
      targetPitch *= 1.12;
      targetRate *= 1.15;
    } else if (stageDirText.includes('fısıltı') || stageDirText.includes('sessiz') || stageDirText.includes('mırıldan') || stageDirText.includes('kendi kendine')) {
      targetPitch *= 0.85;
      targetRate *= 0.88;
    } else if (stageDirText.includes('gül') || stageDirText.includes('neşeli') || stageDirText.includes('sevinç')) {
      targetPitch *= 1.15;
      targetRate *= 1.08;
    } else if (stageDirText.includes('üzgün') || stageDirText.includes('ağla') || stageDirText.includes('keder') || stageDirText.includes('mahzun')) {
      targetPitch *= 0.88;
      targetRate *= 0.85;
    } else if (stageDirText.includes('şaşkın') || stageDirText.includes('heyecan') || stageDirText.includes('panik')) {
      targetPitch *= 1.18;
      targetRate *= 1.10;
    }
  }

  // Sentence punctuation intonation
  if (normalizedText.endsWith('?')) {
    targetPitch *= 1.08;
  } else if (normalizedText.endsWith('!')) {
    targetRate *= 1.06;
  }

  const utterance = new SpeechSynthesisUtterance(normalizedText);
  utterance.rate = Math.max(0.6, Math.min(1.8, targetRate));
  utterance.pitch = Math.max(0.6, Math.min(1.8, targetPitch));
  utterance.lang = 'tr-TR';

  if (targetVoice) {
    utterance.voice = targetVoice;
  }

  utterance.onend = () => {
    if (options.onEnd) options.onEnd();
  };

  utterance.onerror = (e) => {
    console.warn('SpeechSynthesis error:', e);
    if (options.onError) options.onError();
    if (options.onEnd) options.onEnd();
  };

  window.speechSynthesis.speak(utterance);
}

/**
 * Web Audio API Sound Effects (Cue beep chime for actors)
 */
export function playCueChime(): void {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {
    // Ignore audio context errors
  }
}

/**
 * Fuzzy Text Match Check to compare user's spoken or typed line with expected script line
 */
export function compareLineAccuracy(spoken: string, expected: string): {
  accuracyPercentage: number;
  missingWords: string[];
  matchedWords: string[];
} {
  const normalize = (str: string) =>
    str
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?'"”„«»]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const normSpoken = normalize(spoken);
  const normExpected = normalize(expected);

  if (!normExpected) {
    return { accuracyPercentage: 100, missingWords: [], matchedWords: [] };
  }

  const expectedWords = normExpected.split(' ');
  const spokenWords = new Set(normSpoken.split(' '));

  let matchedCount = 0;
  const missingWords: string[] = [];
  const matchedWords: string[] = [];

  expectedWords.forEach((word) => {
    if (spokenWords.has(word)) {
      matchedCount++;
      matchedWords.push(word);
    } else {
      missingWords.push(word);
    }
  });

  const accuracyPercentage = Math.round((matchedCount / expectedWords.length) * 100);

  return {
    accuracyPercentage,
    missingWords,
    matchedWords,
  };
}
