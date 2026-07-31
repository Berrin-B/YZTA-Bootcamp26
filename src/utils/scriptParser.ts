import { Line, RawParseStats } from '../types';

/**
 * Deterministic, High-Precision Script Parsing & Cleaning Engine v9
 * Specifically engineered for PDF text extractions, Shakespeare play translations,
 * screenplays, Anton Chekhov plays (e.g. Ayı / The Bear, Martı, Vanya Dayı), and Turkish/International theatre scripts.
 *
 * Features:
 * 1. OCR Typo Consolidation (Fuzzy Levenshtein & OCR letter swapping e.g. SMLRNOV -> SMİRNOV).
 * 2. Turkish Verb & Sentence Detection (Prevents "BAŞIM AĞRIYOR", "HEPSİ YALANCI", "GİT BURADAN" from becoming characters).
 * 3. Declared Character List Parsing (From "KİŞİLER" / "OYUNCULAR" header sections).
 * 4. Frequency Thresholding & Two-Pass Whitelist Extraction.
 */

export interface ParsedScriptResult {
  title: string;
  characters: string[];
  lines: Line[];
  stats: RawParseStats;
  cleanedRawText: string;
}

// Common dialogue interjections or words that must NEVER be treated as character names
const COMMON_DIALOGUE_INTERJECTIONS = new Set([
  'EVET', 'HAYIR', 'PEKİ', 'PEKI', 'TAMAM', 'SİZ', 'SIZ', 'BEN', 'SEN', 'BİZ', 'BIZ',
  'DUR', 'GİT', 'GIT', 'GEL', 'GELİN', 'HAYDİ', 'HAYDI', 'YETER', 'SUS', 'AHAHA', 'OH', 'AH',
  'GÜZEL', 'GUZEL', 'DOĞRU', 'DOGRU', 'YANLIŞ', 'YANLIS', 'AŞKIM', 'EFENDİM', 'EFENDIM',
  'BABA', 'ANNE', 'OĞLUM', 'OGLUM', 'KIZIM', 'NE', 'NEDEN', 'NASIL', 'KİM', 'KIM', 'NEREDE',
  'BURADA', 'ŞİMDİ', 'SIMDI', 'SONRA', 'SÖYLE', 'SOYLE', 'BAK', 'DİNLE', 'DINLE', 'İÇİN', 'ICIN',
  'YOK', 'VAR', 'BELKİ', 'BELKI', 'ASLA', 'TABİİ', 'TABII', 'LÜTFEN', 'LUTFEN', 'SAĞ OL',
  'ALLAH', 'TANRI', 'AMEN', 'HA', 'HAYIRDIR', 'Ç.N.', 'Ç. N.', 'A.N.', 'A. N.', 'ŞEY', 'SABAH',
  'AKŞAM', 'YARIN', 'BUGÜN', 'GECE', 'SAAT', 'BURADA', 'ORADA', 'BUNUN', 'ÜZERİNE', 'ŞÖYLE',
  'BÖYLE', 'GİBİ', 'KADAR', 'ÇÜNKÜ', 'FAKAT', 'LAKİN', 'LÂKİN', 'AMA', 'OYSA', 'HALBUKİ'
]);

// Reserved header/publisher/stage-direction keywords that are NOT characters
const RESERVED_NON_CHARACTER_WORDS = new Set([
  'PERDE', 'SAHNE', 'ACT', 'SCENE', 'BÖLÜM', 'BOLUM', 'KISIM', 'SAYFA', 'PAGE',
  'GİRİŞ', 'GIRIS', 'ÖNSÖZ', 'ONSOZ', 'SUNUŞ', 'SUNUS', 'SONSÖZ', 'SONSOZ', 'İÇİNDEKİLER', 'ICINDEKILER',
  'YAZAR', 'ÇEVİREN', 'CEVIREN', 'EDITÖR', 'EDITOR', 'BASKI', 'TİYATRO', 'TIYATRO',
  'YAYINLARI', 'YAYINEVİ', 'YAYINEVI', 'NOTLAR', 'KİŞİLER', 'KISILER', 'OYUNCULAR',
  'DRAMATIS', 'PERSONAE', 'SON', 'ROL', 'ROLLER', 'DURUM', 'MEKAN', 'MEKÂN', 'ZAMAN',
  'SERİ', 'SERI', 'ISBN', 'KÜLTÜR', 'KULTUR', 'MATBAA', 'DİZİSİ', 'OYUNU', 'DEKOR',
  'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'
]);

// Words, pronouns, adjectives, body parts and exclamations that indicate dialogue or sentence text
const FORBIDDEN_CHARACTER_WORDS = new Set([
  // Sentences & body parts / exclamations mentioned by user
  'BAŞIM', 'BASIM', 'AĞRIYOR', 'AGRIYOR', 'HEPSİ', 'HEPSI', 'YALANCI', 'YALANCILAR',
  'SERSERİ', 'SERSERI', 'BUDALA', 'HAYDUT', 'DÜŞMAN', 'DUSMAN', 'İMDAT', 'IMDAT', 'AMAN',
  'ALLAHIM', 'TANRIM', 'KAPIDA', 'PARALAR', 'BORÇLAR', 'BORÇ', 'BORC', 'SENET',
  
  // Verbs & stage actions
  'ÇIKARARAK', 'CIKARARAK', 'GİREREK', 'GIREREK', 'BAKARAK', 'GÖREREK', 'GOREREK',
  'GÜLEREK', 'GULEREK', 'AĞLAYARAK', 'AGLAYARAK', 'BAĞIRARAK', 'BAGIRARAK',
  'SÖYLEYEREK', 'SOYLEYEREK', 'DİYEREK', 'DIYEREK', 'SİLEREK', 'SILEREK',
  'OTURARAK', 'KALKARAK', 'DURARAK', 'KOŞARAK', 'KOSARAK', 'DÖNEREK', 'DONEREK',
  'ALARAK', 'VEREREK', 'TUTARAK', 'ÇEKEREK', 'SALLAYARAK', 'VURARAK', 'ÖPEREK',
  'DEDİ', 'DEDI', 'DER', 'SÖYLER', 'SOYLER', 'SÖYLEMİŞTİR', 'CEVAP', 'VERİR', 'VERIR',
  'GİRER', 'GIRER', 'ÇIKAR', 'CIKAR', 'GİDER', 'GIDER', 'GELİR', 'GELIR', 'BAKAR',
  'GÖRÜR', 'GORUR', 'KALKAR', 'OTURUR', 'YÜRÜR', 'YURUR', 'DURUR', 'ANLAR', 'BİLİR',
  'İSTER', 'ISTER', 'OLUR', 'OLMAZ', 'YAPAR', 'AÇAR', 'ACAR', 'KAPAR', 'KAPATIR',
  'BAŞLAR', 'BASLAR', 'BİTİRİR', 'BITIRIR', 'ÖLDÜRÜR', 'OLDURUR', 'YAZAR', 'OKUR',
  
  // Pronouns & Conjunctions
  'BUNUN', 'ŞUNUN', 'SUNUN', 'ONUN', 'BUNLAR', 'ŞUNLAR', 'SUNLAR', 'ONLAR',
  'BENİM', 'BENIM', 'SENİN', 'SENIN', 'BİZİM', 'BIZIM', 'SİZİN', 'SIZIN',
  'BUNU', 'ŞUNU', 'SUNU', 'ONU', 'BANA', 'SANA', 'ONA', 'BİZE', 'BIZE', 'SİZE', 'SIZE', 'ONLARA',
  'BENDEN', 'SENDEN', 'ONDAN', 'BİZDEN', 'BIZDEN', 'SİZDEN', 'SIZDEN', 'ONLARDAN',
  'EĞER', 'EGER', 'ÇÜNKÜ', 'CUNKU', 'FAKAT', 'LAKİN', 'LÂKİN', 'OYSA', 'HALBUKİ',
  'VE', 'VEYA', 'YAHUT', 'VEYAHUT', 'İLE', 'ILE', 'İÇİN', 'ICIN', 'GİBİ', 'GIBI',
  'KADAR', 'SADECE', 'YALNIZ', 'HER', 'HİÇ', 'HIC', 'TÜM', 'TUM', 'BÜTÜN', 'BUTUN',
  'ŞEY', 'SEY', 'ZAMAN', 'HANGİ', 'HANGI',
  
  // Nouns/Adjectives unlikely to be standalone names
  'BİR', 'BIR', 'BİRÇOK', 'BIRCOK', 'KADIN', 'ADAM', 'İNSAN', 'INSAN', 'KIZ', 'ERKEK',
  'ÇOCUK', 'COCUK', 'EFENDİ', 'EFENDI', 'BEY', 'BAY', 'BAYAN', 'HANIM', 'ODADA', 'EVDE',
  'MASA', 'SANDALYE', 'KAPI', 'PENCERE', 'MEKTUP', 'PARALARI',
  'SABAH', 'AKŞAM', 'AKSAM', 'GECE', 'GÜNDÜZ', 'GUNDUZ', 'SAAT', 'SAYFA', 'BASKI', 'KAPAK'
]);

// Patterns commonly associated with publisher / copyright / intro / PDF page headers & footers
const UNWANTED_PATTERNS = [
  /isbn[\s\d:-]+/i,
  /baskı\s+\d+/i,
  /yayınları/i,
  /yayınevi/i,
  /copyright/i,
  /tüm\s+hakları\s+saklıdır/i,
  /sayfa\s+\d+/i,
  /dizgi\s*&?\s*tasarım/i,
  /kapak\s+tasarımı/i,
  /tiyatro\s+oyunları\s+dizisi/i,
  /önsöz/i,
  /sunuş/i,
  /giriş/i,
  /yazar\s+hakkında/i,
  /oyun\s+hakkında/i,
  /biyografi/i,
  /yayın\s+yönetmeni/i,
  /çeviren/i,
  /editör/i,
  /matbaa/i,
  /içindekiler/i,
  /basım\s+\d+/i,
  /basım\s+tarihi/i,
  /sertifika\s+no/i,
  /\(Ç\.N\.\)/i,
  /\(Ç\.\s*N\.\)/i,
  /\(A\.N\.\)/i,
  /^\s*\(\d+\)\s+[A-ZÇĞİÖŞÜa-zçğıöşü]/,
  /^\s*\d+\s*\.\s*[A-ZÇĞİÖŞÜa-zçğıöşü]+.*\(Ç\.N\.\)/i,
];

/**
 * Checks if a Turkish string contains active verb tenses or sentence structure
 * (e.g. ends in -YOR, -ACAK, -ECEK, -Dİ, -Tİ, -MİŞ, -MALI, -YIM, etc.)
 */
function containsActiveVerbOrSentence(text: string): boolean {
  const upper = text.toUpperCase().trim();
  const words = upper.split(/\s+/);

  for (const word of words) {
    if (FORBIDDEN_CHARACTER_WORDS.has(word)) return true;

    // Verb tense suffixes
    if (word.length >= 4) {
      if (
        word.endsWith('YOR') ||
        word.endsWith('ACAK') ||
        word.endsWith('ECEK') ||
        word.endsWith('MİŞTİR') ||
        word.endsWith('MISTIR') ||
        word.endsWith('MELİ') ||
        word.endsWith('MALI') ||
        word.endsWith('SANA') ||
        word.endsWith('SENE') ||
        word.endsWith('YIM') ||
        word.endsWith('YİM') ||
        word.endsWith('DUM') ||
        word.endsWith('DÜM') ||
        word.endsWith('TUM') ||
        word.endsWith('TÜM') ||
        word.endsWith('DUR') ||
        word.endsWith('DÜR') ||
        word.endsWith('TUR') ||
        word.endsWith('TÜR')
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Calculates Levenshtein Distance for OCR typo detection (e.g. SMLRNOV vs SMİRNOV)
 */
function calculateLevenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Normalizes strings for OCR comparison:
 * Handles 'L' -> 'İ' / 'I' OCR errors in Turkish text (e.g. SMLRNOV -> SMIRNOV)
 */
function normalizeForOcrComparison(str: string): string {
  let s = str.toUpperCase().trim();
  // Strip possessive suffixes e.g. POPOVA'NIN -> POPOVA, LUKA'YA -> LUKA
  s = s.replace(/['’\`](NIN|NİN|NUN|NÜN|YIN|YİN|YA|YE|A|E|DAN|DEN|TA|TE)$/i, '');
  // Normalize Turkish characters & common OCR swaps
  s = s
    .replace(/L/g, 'I')
    .replace(/İ/g, 'I')
    .replace(/0/g, 'O')
    .replace(/1/g, 'I')
    .replace(/Ğ/g, 'G')
    .replace(/Ş/g, 'S')
    .replace(/Ç/g, 'C')
    .replace(/Ö/g, 'O')
    .replace(/Ü/g, 'U');
  return s;
}

/**
 * Tests if two character names are OCR variants of each other (e.g. SMLRNOV vs SMİRNOV)
 */
function areOcrCharacterVariants(name1: string, name2: string): boolean {
  const n1 = normalizeForOcrComparison(name1);
  const n2 = normalizeForOcrComparison(name2);

  if (n1 === n2) return true;

  // Check if one contains the other
  if (n1.length >= 4 && n2.length >= 4) {
    if (n1.includes(n2) || n2.includes(n1)) return true;
  }

  // Calculate Levenshtein distance on normalized strings
  const dist = calculateLevenshteinDistance(n1, n2);
  const minLen = Math.min(n1.length, n2.length);

  if (minLen >= 5 && dist <= 2) return true;
  if (minLen >= 3 && dist <= 1) return true;

  return false;
}

/**
 * Checks if a line is exclusively a PDF page number or page indicator
 */
function isStandalonePageNumber(line: string): boolean {
  const l = line.trim();
  if (!l) return false;
  if (/^\d{1,4}$/.test(l)) return true;
  if (/^[\-\[\(]?\s*(?:sayfa|page)?\s*\d{1,4}\s*(?:\/\s*\d{1,4})?\s*[\-\]\)]?$/i.test(l)) return true;
  return false;
}

/**
 * Trims away all prefaces, intro commentary, publisher notes, and background biographies
 * prior to the start of Act 1 ("BİRİNCİ PERDE", "1. PERDE", "PERDE I", "1. SAHNE", "ACT I", etc.)
 */
export function trimPrefaceBeforeActOne(rawText: string): string {
  if (!rawText) return '';

  const ACT_ONE_PATTERNS = [
    /(?:B\s*İ\s*R\s*İ\s*N\s*C\s*İ|B\s*I\s*R\s*I\s*N\s*C\s*I|1\.|I\b)\s*(?:P\s*E\s*R\s*D\s*E|A\s*C\s*T)/i,
    /(?:P\s*E\s*R\s*D\s*E|A\s*C\s*T)\s*(?:1|I\b|B\s*İ\s*R\s*İ\s*N\s*C\s*İ|B\s*I\s*R\s*I\s*N\s*C\s*I)/i,
    /(?:B\s*İ\s*R\s*İ\s*N\s*C\s*İ|B\s*I\s*R\s*I\s*N\s*C\s*I|1\.|I\b)\s*(?:S\s*A\s*H\s*N\s*E|S\s*C\s*E\s*N\s*E)/i,
    /(?:S\s*A\s*H\s*N\s*E|S\s*C\s*E\s*N\s*E)\s*(?:1|I\b|B\s*İ\s*R\s*İ\s*N\s*C\s*İ|B\s*I\s*R\s*I\s*N\s*C\s*I)/i,
    /B\s*i\s*r\s*i\s*n\s*c\s*i\s+P\s*e\s*r\s*d\s*e/i,
    /B\s*i\s*r\s*i\s*n\s*c\s*i\s+S\s*a\s*h\s*n\s*e/i,
  ];

  let earliestIdx = -1;

  for (const pattern of ACT_ONE_PATTERNS) {
    const match = rawText.match(pattern);
    if (match && match.index !== undefined) {
      if (earliestIdx === -1 || match.index < earliestIdx) {
        earliestIdx = match.index;
      }
    }
  }

  if (earliestIdx !== -1) {
    return rawText.substring(earliestIdx);
  }

  return rawText;
}

/**
 * Checks if a line is a Scene, Act, or Stage header
 */
export const isSceneOrActHeader = (line: string): boolean => {
  const l = line.trim();
  if (!l) return false;

  if (/^(PERDE|SAHNE|ACT|SCENE|BÖLÜM|BOLUM|KISIM|\d+\.\s*(PERDE|SAHNE|BÖLÜM|KISIM)|(PERDE|SAHNE|BÖLÜM|KISIM)\s+\d+|[I|V|X]+\.\s*(PERDE|SAHNE))/i.test(l)) {
    return true;
  }
  if (/^(BİRİNCİ|İKİNCİ|ÜÇÜNCÜ|DÖRDÜNCÜ|BEŞİNCİ)\s+(PERDE|SAHNE)/i.test(l)) {
    return true;
  }
  if (/^B\s*i\s*r\s*i\s*n\s*c\s*i\s+(P\s*e\s*r\s*d\s*e|S\s*a\s*h\s*n\s*e)/i.test(l)) {
    return true;
  }
  return false;
};

/**
 * Strips PDF page/scene headers like "19 I:Perde, I. Sahne", "Sayfa 12" from line starts
 */
function stripPdfPageHeaderPrefix(line: string): string {
  let cleaned = line.trim();
  cleaned = cleaned.replace(/^\d{1,4}\s*[\-\/]\s*\d{1,4}\s+/, '');
  cleaned = cleaned.replace(/^\d+\s+[I|V|X]*:?\s*(Perde|Sahne|Act|Scene)[^A-Za-zÇĞİÖŞÜçğıöşü]*\s*/i, '');
  cleaned = cleaned.replace(/^\d{1,3}\s+(?=(BİRİNCİ|İKİNCİ|ÜÇÜNCÜ|DÖRDÜNCÜ|BEŞİNCİ|PERDE|SAHNE|[A-ZÇĞİÖŞÜ]{2,}))/i, '');
  cleaned = cleaned.replace(/\s+\d{1,3}$/, '');
  return cleaned.trim();
}

/**
 * Clean inline footnote indicators like "(1)", "(2)", or verse numbers
 */
function cleanInlineNoiseAndFootnotes(text: string): string {
  let result = text;
  result = result.replace(/\(\d{1,2}\)[^()]*\(Ç\.N\.\)/gi, '');
  result = result.replace(/\(\d{1,2}\)/g, '');
  result = result.replace(/\[\d{1,2}\]/g, '');
  result = result.replace(/\s+\d{1,3}\s+(?=[A-ZÇĞİÖŞÜa-zçğıöşü“"'])/g, ' ');
  return result.trim();
}

/**
 * High-precision validation for character names.
 * Ensures that sentences, narrative text, verbs, or publisher marks are NEVER treated as characters.
 */
function isValidCharacterCandidate(nameCandidate: string, declaredCharacters?: Set<string>): boolean {
  if (!nameCandidate) return false;
  const rawClean = nameCandidate.trim();
  const cleanUpper = rawClean.toUpperCase();

  // If we have a declared character set, check against it
  if (declaredCharacters && declaredCharacters.size > 0) {
    if (declaredCharacters.has(cleanUpper)) return true;
    for (const dec of declaredCharacters) {
      if (areOcrCharacterVariants(cleanUpper, dec)) return true;
    }
  }

  // Must be between 2 and 30 chars
  if (cleanUpper.length < 2 || cleanUpper.length > 30) return false;

  // Cannot contain punctuation like commas, colons, semi-colons, quotes, or question marks
  if (/[;,:\?!"'“”„]/.test(rawClean)) return false;

  // Real character names in plays are 1 to 3 words max
  const words = cleanUpper.split(/\s+/);
  if (words.length > 3) return false;

  // MUST NOT contain active verb tenses or Turkish sentence patterns ("BAŞIM AĞRIYOR", "HEPSİ YALANCI")
  if (containsActiveVerbOrSentence(cleanUpper)) return false;

  // Check against forbidden words, interjections, and reserved headers
  for (const word of words) {
    if (FORBIDDEN_CHARACTER_WORDS.has(word)) return false;
    if (COMMON_DIALOGUE_INTERJECTIONS.has(word)) return false;
    if (RESERVED_NON_CHARACTER_WORDS.has(word)) return false;
  }

  // Cannot start with a digit unless it's a character like "1. OYUNCU"
  if (/^\d+/.test(cleanUpper) && !/^\d+\.\s*[A-ZÇĞİÖŞÜ]+/.test(cleanUpper)) {
    return false;
  }

  // Cannot be roman numerals like "I", "II", "III", "IV"
  if (/^[I|V|X]+$/.test(cleanUpper) || /^\d+[I|V|X]+$/.test(cleanUpper)) return false;

  // Cannot contain words like PERDE, SAHNE, SAYFA, ISBN, BASKI, BÖLÜM
  if (/(PERDE|SAHNE|ACT|SCENE|BÖLÜM|SAYFA|BASKI|ISBN|YAYIN)/.test(cleanUpper)) return false;

  // Capitalization check: Character names must be ALL-CAPS or strictly Title-Case
  const isAllCaps = cleanUpper === rawClean;
  const isTitleCase = words.every((w) => /^[A-ZÇĞİÖŞÜ][a-zçğıöşüA-ZÇĞİÖŞÜ]*$/.test(w));

  if (!isAllCaps && !isTitleCase) return false;

  return true;
}

/**
 * Detect declared characters from "KİŞİLER" / "OYUNCULAR" / "PERSONAE" section at top of script
 */
export function detectDeclaredCharacters(rawText: string): Set<string> {
  const declared = new Set<string>();
  const lines = rawText.split(/\r?\n/).slice(0, 150);

  let inListSection = false;

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l) continue;

    if (/^(KİŞİLER|KISILER|OYUNDAKİ KİŞİLER|OYUNCULAR|ROLLER|DRAMATIS PERSONAE)\b/i.test(l)) {
      inListSection = true;
      continue;
    }

    if (inListSection) {
      if (isSceneOrActHeader(l) || /^PERDE\b/i.test(l) || /^SAHNE\b/i.test(l)) {
        break; // Reached Act 1
      }

      // Extract candidate name before colon or dash or parenthesis e.g. "Yelena İvanovna Popova: Genç bir dul"
      const match = l.match(/^([A-Za-zÇĞİÖŞÜçğıöşü0-9\s]{2,30})(?:\s*\([^)]*\))?\s*[:\-\—–\.]/);
      if (match) {
        const candidate = match[1].trim().toUpperCase();
        const parts = candidate.split(/\s+/);
        const lastName = parts[parts.length - 1];
        if (lastName && lastName.length >= 3 && !containsActiveVerbOrSentence(lastName)) {
          declared.add(lastName);
        }
        if (!containsActiveVerbOrSentence(candidate)) {
          declared.add(candidate);
        }
      } else if (l.length >= 3 && l.length <= 25 && /^[A-ZÇĞİÖŞÜa-zçğıöşü0-9\s]+$/.test(l)) {
        const candidate = l.toUpperCase();
        if (!containsActiveVerbOrSentence(candidate)) {
          const parts = candidate.split(/\s+/);
          const lastName = parts[parts.length - 1];
          if (lastName && lastName.length >= 3) {
            declared.add(lastName);
          }
          declared.add(candidate);
        }
      }
    }
  }

  return declared;
}

export interface CharacterParseMatch {
  isMatch: boolean;
  charName?: string;
  inlineStageDir?: string;
  spokenText?: string;
  isStandaloneName?: boolean;
}

/**
 * Character header detection on a single line
 */
export const parseCharacterHeader = (
  line: string,
  nextLine?: string,
  declaredCharacters?: Set<string>
): CharacterParseMatch => {
  const l = stripPdfPageHeaderPrefix(line.trim());
  if (!l || isStandalonePageNumber(l)) return { isMatch: false };

  if (isSceneOrActHeader(l)) return { isMatch: false };
  if (l.startsWith('(') || l.startsWith('[')) return { isMatch: false };

  // Pattern 1: Speaker with separator symbol (:, -, —, –, .)
  // e.g. "POPOVA:", "POPOVA (kendi kendine):", "SMİRNOV -", "LUKA.", "Popova:"
  const separatorMatch = l.match(/^([A-Za-zÇĞİÖŞÜçğıöşü0-9\s]{2,30})(\s*\([^)]*\))?\s*[:\-\—–\.]\s*(.*)$/);
  if (separatorMatch) {
    const rawCharCandidate = separatorMatch[1].trim();
    if (isValidCharacterCandidate(rawCharCandidate, declaredCharacters)) {
      return {
        isMatch: true,
        charName: rawCharCandidate.toUpperCase(),
        inlineStageDir: separatorMatch[2] ? separatorMatch[2].trim() : undefined,
        spokenText: cleanInlineNoiseAndFootnotes(separatorMatch[3] || ''),
        isStandaloneName: false,
      };
    }
  }

  // Pattern 2: Standalone character name line (e.g. "POPOVA", "SMİRNOV", "LUKA")
  const standaloneMatch = l.match(/^([A-Za-zÇĞİÖŞÜçğıöşü0-9\s]{2,25})(\s*\([^)]*\))?$/);
  if (standaloneMatch) {
    const rawCharCandidate = standaloneMatch[1].trim();
    if (isValidCharacterCandidate(rawCharCandidate, declaredCharacters)) {
      if (nextLine !== undefined) {
        const trimmedNext = stripPdfPageHeaderPrefix(nextLine.trim());
        if (!trimmedNext || isStandalonePageNumber(trimmedNext) || isSceneOrActHeader(trimmedNext)) {
          return { isMatch: false };
        }
      }

      return {
        isMatch: true,
        charName: rawCharCandidate.toUpperCase(),
        inlineStageDir: standaloneMatch[2] ? standaloneMatch[2].trim() : undefined,
        spokenText: '',
        isStandaloneName: true,
      };
    }
  }

  return { isMatch: false };
};

/**
 * Normalizes and splits continuous text blocks where character names appear inline ('Karakter: Replik')
 */
function splitInlineCharacterBlocks(rawText: string, declaredCharacters?: Set<string>): string[] {
  let text = rawText
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      if (isStandalonePageNumber(trimmed)) return false;
      if (UNWANTED_PATTERNS.some((p) => p.test(trimmed))) return false;
      if (/\(Ç\.N\.\)/i.test(trimmed) || /\(Ç\.\s*N\.\)/i.test(trimmed)) return false;
      if (/^\s*\(\d+\)/.test(trimmed)) return false;
      return true;
    })
    .join('\n');

  // Insert breaks before Act / Scene headers
  text = text.replace(
    /(?:^|\s)(BİRİNCİ PERDE|İKİNCİ PERDE|ÜÇÜNCÜ PERDE|DÖRDÜNCÜ PERDE|BEŞİNCİ PERDE|1\.\s*PERDE|2\.\s*PERDE|3\.\s*PERDE|4\.\s*PERDE|5\.\s*PERDE|PERDE\s+\d+|PERDE\s+[I|V|X]+|B\s*i\s*r\s*i\s*n\s*c\s*i\s+S\s*a\s*h\s*n\s*e|BİRİNCİ SAHNE|1\.\s*SAHNE|2\.\s*SAHNE|SAHNE\s+\d+|SAHNE\s+[I|V|X]+)(?=\s|\(|$)/gi,
    '\n$1\n'
  );

  // Insert breaks before stage directions in parentheses
  text = text.replace(/(\([^)]+\))/g, '\n$1\n');

  // Regex to detect inline character speakers
  const inlineSpeakerRegex = /(?:^|[\n.\?!)\s])([A-ZÇĞİÖŞÜ0-9][A-ZÇĞİÖŞÜa-zçğıöşü0-9\s]{1,25})(\s*\([^)]*\))?\s*([:\-\—–\.]\s*)(?=[A-ZÇĞİÖŞÜa-zçğıöşü“"'(\d])/g;

  const formattedText = text.replace(inlineSpeakerRegex, (match, speaker, stageDir, separator) => {
    const cleanSpeaker = speaker.trim();
    if (isValidCharacterCandidate(cleanSpeaker, declaredCharacters)) {
      const stage = stageDir ? stageDir.trim() : '';
      return `\n${cleanSpeaker.toUpperCase()}${stage ? ' ' + stage : ''}: `;
    }
    return match;
  });

  return formattedText
    .split('\n')
    .map((l) => stripPdfPageHeaderPrefix(l.trim()))
    .filter((l) => l && !isStandalonePageNumber(l));
}

/**
 * Consolidates OCR character name variations using frequency & Levenshtein distance
 * e.g. "SMLRNOV" (3 turns) + "SMİRNOV" (30 turns) -> "SMİRNOV"
 */
function consolidateCharacterRoster(
  characterCounts: Map<string, number>,
  declaredCharacters: Set<string>
): Map<string, string> {
  const canonicalMap = new Map<string, string>(); // rawCandidate -> canonicalName
  const sortedCandidates = Array.from(characterCounts.entries()).sort((a, b) => b[1] - a[1]);

  const verifiedCanonicals: { name: string; count: number }[] = [];

  for (const [candidate, count] of sortedCandidates) {
    if (candidate === 'SAHNE YÖNERGESİ' || candidate === 'ANLATICI' || !candidate) continue;

    // Check if candidate matches active verbs or forbidden words
    if (containsActiveVerbOrSentence(candidate)) continue;

    let matchedCanonical = '';

    // Check if it's an OCR variant of an already verified higher-frequency canonical
    for (const item of verifiedCanonicals) {
      if (areOcrCharacterVariants(candidate, item.name)) {
        matchedCanonical = item.name;
        break;
      }
    }

    if (matchedCanonical) {
      canonicalMap.set(candidate, matchedCanonical);
    } else {
      // New canonical character
      verifiedCanonicals.push({ name: candidate, count });
      canonicalMap.set(candidate, candidate);
    }
  }

  // Filter out low-frequency noise candidates (e.g. 1 turn when max turns >= 5, unless in declared list)
  const maxTurnCount = Math.max(...Array.from(characterCounts.values()), 1);

  const finalMap = new Map<string, string>();
  for (const [candidate, canonical] of canonicalMap.entries()) {
    const totalCount = characterCounts.get(candidate) || 0;
    const isDeclared = declaredCharacters.has(candidate) || declaredCharacters.has(canonical);

    if (totalCount <= 1 && maxTurnCount >= 5 && !isDeclared) {
      // Reject single-turn noise fragment!
      continue;
    }
    finalMap.set(candidate, canonical);
  }

  return finalMap;
}

/**
 * Main cleaning and parsing function v9.
 */
export function cleanAndParseScriptText(rawInput: string, fallbackTitle: string = 'Yeni Yüklenen Oyun'): ParsedScriptResult {
  if (!rawInput || !rawInput.trim()) {
    return {
      title: fallbackTitle,
      characters: [],
      lines: [],
      stats: { totalLinesOriginal: 0, totalLinesCleaned: 0, charactersFound: [], filteredHeadersCount: 0 },
      cleanedRawText: '',
    };
  }

  // Step 1: Detect explicit declared characters from "KİŞİLER" / "OYUNCULAR"
  const declaredCharacters = detectDeclaredCharacters(rawInput);

  // Step 2: Trim away prefaces/intros before Act 1 / "BİRİNCİ PERDE"
  const trimmedText = trimPrefaceBeforeActOne(rawInput);

  // Step 3: Pre-split inline character blocks & clean text
  const cleanedTextLines = splitInlineCharacterBlocks(trimmedText, declaredCharacters);
  const totalLinesOriginal = rawInput.split('\n').length;

  // Step 4: Detect Play Title
  let detectedTitle = fallbackTitle;
  const rawFirstLines = rawInput.split('\n');
  for (let i = 0; i < Math.min(10, rawFirstLines.length); i++) {
    const line = rawFirstLines[i].trim();
    if (
      line &&
      !isStandalonePageNumber(line) &&
      !UNWANTED_PATTERNS.some((p) => p.test(line)) &&
      line.length >= 2 &&
      line.length <= 70 &&
      !isSceneOrActHeader(line) &&
      !parseCharacterHeader(line, undefined, declaredCharacters).isMatch
    ) {
      detectedTitle = line.replace(/^#+\s*/, '').replace(/[-_]/g, ' ');
      break;
    }
  }

  // Pass 1: Collect character candidate counts
  const rawCharacterLineCounts = new Map<string, number>();

  for (let i = 0; i < cleanedTextLines.length; i++) {
    const lineStr = cleanedTextLines[i];
    const nextLineStr = i + 1 < cleanedTextLines.length ? cleanedTextLines[i + 1] : undefined;

    if (isStandalonePageNumber(lineStr) || isSceneOrActHeader(lineStr)) continue;

    const charParse = parseCharacterHeader(lineStr, nextLineStr, declaredCharacters);
    if (charParse.isMatch && charParse.charName) {
      const c = charParse.charName;
      rawCharacterLineCounts.set(c, (rawCharacterLineCounts.get(c) || 0) + 1);
    }
  }

  // Step 5: OCR Typo & Frequency Consolidation
  const canonicalCharacterMap = consolidateCharacterRoster(rawCharacterLineCounts, declaredCharacters);
  const verifiedCharacterNames = Array.from(new Set(canonicalCharacterMap.values()));

  // Pass 2: Re-parse structured lines using canonical character whitelist
  const parsedLines: Line[] = [];
  let activeCharacter = '';
  let lineIdCounter = 1;
  let currentActiveActNormalized = '';

  for (let i = 0; i < cleanedTextLines.length; i++) {
    const lineStr = cleanedTextLines[i];
    const nextLineStr = i + 1 < cleanedTextLines.length ? cleanedTextLines[i + 1] : undefined;

    if (isStandalonePageNumber(lineStr)) continue;

    // Case A: Scene / Act Header
    if (isSceneOrActHeader(lineStr)) {
      const normalizedActHeader = lineStr.toUpperCase().replace(/[^A-ZÇĞİÖŞÜ0-9]/g, '');

      if (/PERDE|ACT|BÖLÜM/i.test(lineStr)) {
        if (currentActiveActNormalized && normalizedActHeader === currentActiveActNormalized) {
          continue; // Skip duplicate running page header
        }
        currentActiveActNormalized = normalizedActHeader;
      }

      parsedLines.push({
        id: `line-${lineIdCounter++}`,
        character: 'SAHNE YÖNERGESİ',
        text: cleanInlineNoiseAndFootnotes(lineStr),
      });
      continue;
    }

    if (
      (lineStr.startsWith('(') && lineStr.endsWith(')')) ||
      (lineStr.startsWith('[') && lineStr.endsWith(']'))
    ) {
      parsedLines.push({
        id: `line-${lineIdCounter++}`,
        character: 'SAHNE YÖNERGESİ',
        text: cleanInlineNoiseAndFootnotes(lineStr),
      });
      continue;
    }

    // Case B: Character Header Line
    const charParse = parseCharacterHeader(lineStr, nextLineStr, declaredCharacters);

    if (charParse.isMatch && charParse.charName) {
      const rawName = charParse.charName;
      const canonicalName = canonicalCharacterMap.get(rawName);

      if (canonicalName && verifiedCharacterNames.includes(canonicalName)) {
        activeCharacter = canonicalName;

        if (charParse.isStandaloneName) {
          if (charParse.inlineStageDir) {
            parsedLines.push({
              id: `line-${lineIdCounter++}`,
              character: canonicalName,
              text: '',
              stageDirection: charParse.inlineStageDir,
            });
          }
        } else {
          const cleanText = cleanInlineNoiseAndFootnotes(charParse.spokenText || '');
          parsedLines.push({
            id: `line-${lineIdCounter++}`,
            character: canonicalName,
            text: cleanText || '(Sessizlik)',
            stageDirection: charParse.inlineStageDir,
          });
        }
        continue;
      }
    }

    // Case C: Dialogue continuation for active character (or rejected false speaker as dialogue)
    const cleanLineText = cleanInlineNoiseAndFootnotes(lineStr);
    if (cleanLineText && activeCharacter) {
      if (parsedLines.length > 0 && parsedLines[parsedLines.length - 1].character === activeCharacter) {
        const prevLine = parsedLines[parsedLines.length - 1];
        if (!prevLine.text) {
          prevLine.text = cleanLineText;
        } else {
          prevLine.text += ' ' + cleanLineText;
        }
      } else {
        parsedLines.push({
          id: `line-${lineIdCounter++}`,
          character: activeCharacter,
          text: cleanLineText,
        });
      }
    }
  }

  return {
    title: detectedTitle || fallbackTitle,
    characters: verifiedCharacterNames,
    lines: parsedLines,
    stats: {
      totalLinesOriginal,
      totalLinesCleaned: cleanedTextLines.length,
      charactersFound: verifiedCharacterNames,
      filteredHeadersCount: Math.max(0, totalLinesOriginal - cleanedTextLines.length),
    },
    cleanedRawText: cleanedTextLines.join('\n'),
  };
}
