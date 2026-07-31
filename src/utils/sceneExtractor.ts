import { Line } from '../types';

export interface SceneSection {
  id: string;
  actTitle: string;    // e.g. "1. Perde", "BİRİNCİ PERDE", "Genel"
  sceneTitle: string;  // e.g. "1. Sahne", "2. Sahne - Venedik Sokakları"
  startIndex: number;  // line index in full script.lines array
  endIndex: number;    // line index in full script.lines array (inclusive)
  lineCount: number;
}

export interface ScriptStructure {
  acts: string[];
  scenesByAct: Record<string, SceneSection[]>;
  allSections: SceneSection[];
}

/**
 * Parses script lines and extracts structured Acts (Perdeler / Bölümler) and Scenes (Sahneler)
 */
export function extractScriptStructure(lines: Line[]): ScriptStructure {
  if (!lines || lines.length === 0) {
    const defaultSection: SceneSection = {
      id: 'sec-0',
      actTitle: 'Tüm Oyun',
      sceneTitle: 'Tüm Sahneler',
      startIndex: 0,
      endIndex: 0,
      lineCount: 0,
    };
    return {
      acts: ['Tüm Oyun'],
      scenesByAct: { 'Tüm Oyun': [defaultSection] },
      allSections: [defaultSection],
    };
  }

  const sections: SceneSection[] = [];
  let currentAct = '1. Perde';
  let currentScene = '1. Sahne';
  let currentStartIndex = 0;
  let sectionCounter = 1;

  // Regexes for detecting Act and Scene lines
  const ACT_REGEX = /^(BİRİNCİ|İKİNCİ|ÜÇÜNCÜ|DÖRDÜNCÜ|BEŞİNCİ|\d+\.|[I|V|X]+\.)?\s*(PERDE|ACT|BÖLÜM|KISIM)\s*(\d+|[I|V|X]+|BİRİNCİ|İKİNCİ|ÜÇÜNCÜ|DÖRDÜNCÜ|BEŞİNCİ)?/i;
  const SCENE_REGEX = /^(BİRİNCİ|İKİNCİ|ÜÇÜNCÜ|DÖRDÜNCÜ|BEŞİNCİ|\d+\.|[I|V|X]+\.)?\s*(SAHNE|SCENE)\s*(\d+|[I|V|X]+|BİRİNCİ|İKİNCİ|ÜÇÜNCÜ|DÖRDÜNCÜ|BEŞİNCİ)?/i;

  let hasExplicitStructure = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const text = line.text.trim();
    const isStageDir = line.character === 'SAHNE YÖNERGESİ';

    const isActHeader = isStageDir && (ACT_REGEX.test(text) || /PERDE/i.test(text));
    const isSceneHeader = isStageDir && (SCENE_REGEX.test(text) || /SAHNE/i.test(text));

    if (isActHeader || isSceneHeader) {
      hasExplicitStructure = true;

      // Close previous section if it has lines
      if (i > currentStartIndex) {
        sections.push({
          id: `sec-${sectionCounter++}`,
          actTitle: currentAct,
          sceneTitle: currentScene,
          startIndex: currentStartIndex,
          endIndex: i - 1,
          lineCount: i - currentStartIndex,
        });
      }

      currentStartIndex = i;

      if (isActHeader) {
        currentAct = text.length <= 40 ? text : text.substring(0, 40) + '...';
        currentScene = '1. Sahne';
      } else if (isSceneHeader) {
        currentScene = text.length <= 40 ? text : text.substring(0, 40) + '...';
      }
    }
  }

  // Close final section
  if (currentStartIndex < lines.length) {
    sections.push({
      id: `sec-${sectionCounter++}`,
      actTitle: currentAct,
      sceneTitle: currentScene,
      startIndex: currentStartIndex,
      endIndex: lines.length - 1,
      lineCount: lines.length - currentStartIndex,
    });
  }

  // Fallback if no explicit PERDE/SAHNE headers were detected
  if (!hasExplicitStructure || sections.length === 0) {
    // If play is short (< 35 lines), single section
    if (lines.length <= 35) {
      const singleSection: SceneSection = {
        id: 'sec-1',
        actTitle: '1. Bölüm',
        sceneTitle: 'Tam Metin',
        startIndex: 0,
        endIndex: lines.length - 1,
        lineCount: lines.length,
      };
      return {
        acts: ['1. Bölüm'],
        scenesByAct: { '1. Bölüm': [singleSection] },
        allSections: [singleSection],
      };
    }

    // Otherwise chunk into ~25-line rehearsal scenes
    const chunkedSections: SceneSection[] = [];
    const chunkSize = 25;
    let chunkCount = 1;

    for (let start = 0; start < lines.length; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, lines.length - 1);
      chunkedSections.push({
        id: `chunk-${chunkCount}`,
        actTitle: '1. Bölüm',
        sceneTitle: `Sahne ${chunkCount} (Replik ${start + 1}-${end + 1})`,
        startIndex: start,
        endIndex: end,
        lineCount: end - start + 1,
      });
      chunkCount++;
    }

    return {
      acts: ['1. Bölüm'],
      scenesByAct: { '1. Bölüm': chunkedSections },
      allSections: chunkedSections,
    };
  }

  // Group sections by Act Title
  const actsSet = new Set<string>();
  const scenesByAct: Record<string, SceneSection[]> = {};

  for (const sec of sections) {
    actsSet.add(sec.actTitle);
    if (!scenesByAct[sec.actTitle]) {
      scenesByAct[sec.actTitle] = [];
    }
    scenesByAct[sec.actTitle].push(sec);
  }

  return {
    acts: Array.from(actsSet),
    scenesByAct,
    allSections: sections,
  };
}
