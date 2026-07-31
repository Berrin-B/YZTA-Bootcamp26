import { Script, ScriptAnalysisResult } from '../types';
import { PRESET_SCRIPTS } from '../data/presetScripts';

const STORAGE_KEY_SCRIPTS = 'aklimda_scripts_v1';
const STORAGE_KEY_ANALYSES = 'aklimda_ai_analyses_v1';

export function getSavedScripts(): Script[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SCRIPTS);
    if (!raw) {
      // Seed with presets if first time
      saveScripts(PRESET_SCRIPTS);
      return PRESET_SCRIPTS;
    }
    const parsed: Script[] = JSON.parse(raw);
    return parsed;
  } catch (e) {
    console.error('Failed to load scripts from localStorage:', e);
    return PRESET_SCRIPTS;
  }
}

export function saveScripts(scripts: Script[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_SCRIPTS, JSON.stringify(scripts));
  } catch (e) {
    console.error('Failed to save scripts to localStorage:', e);
  }
}

export function saveSingleScript(script: Script): Script[] {
  const existing = getSavedScripts();
  const index = existing.findIndex((s) => s.id === script.id);
  let updated: Script[];
  if (index >= 0) {
    existing[index] = { ...script, updatedAt: Date.now() };
    updated = existing;
  } else {
    updated = [script, ...existing];
  }
  saveScripts(updated);
  return updated;
}

export function deleteScript(scriptId: string): Script[] {
  const existing = getSavedScripts();
  const updated = existing.filter((s) => s.id !== scriptId);
  saveScripts(updated);
  return updated;
}

export function toggleFavoriteScript(scriptId: string): Script[] {
  const existing = getSavedScripts();
  const updated = existing.map((s) => {
    if (s.id === scriptId) {
      return { ...s, isFavorite: !s.isFavorite };
    }
    return s;
  });
  saveScripts(updated);
  return updated;
}

export function getSavedAnalyses(): Record<string, ScriptAnalysisResult> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ANALYSES);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export function saveAnalysis(analysis: ScriptAnalysisResult): void {
  try {
    const existing = getSavedAnalyses();
    const key = `${analysis.scriptId}_${analysis.characterName}`;
    existing[key] = analysis;
    localStorage.setItem(STORAGE_KEY_ANALYSES, JSON.stringify(existing));
  } catch (e) {
    console.error('Failed to save analysis:', e);
  }
}
