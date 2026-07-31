import React, { useState } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, RefreshCw, ShieldCheck, FileCode } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { cleanAndParseScriptText, ParsedScriptResult } from '../utils/scriptParser';
import { Script } from '../types';

// Set up pdfjs worker source safely via Vite worker URL
if (typeof window !== 'undefined' && pdfjsLib) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
  } catch (e) {
    console.warn('pdfjs worker init warning:', e);
  }
}

interface UploadCleanerViewProps {
  onScriptCreated: (script: Script) => void;
  onCancel?: () => void;
}

const SAMPLE_HAMLET_RAW = `HAMLET - WILLIAM SHAKESPEARE
PERDE 3, SAHNE 1
Sayfa 45 - Basım 1998 - Mitos Boyut Yayınları - ISBN: 975-508-012

HAMLET:
Olmak ya da olmamak, işte bütün mesele bu!
Düşüncemizin katlanması mı güzel
Zalim kaderin yumruklarına, oklarına,
Yoksa direnip kabadayıca dertler denizine
Karşı koyup son vermesi mi onlara?

OFELYA:
(Elinindeki dualığı bırakarak yaklaşır)
İyi efendim, nasılsınız kaç gündür?

HAMLET:
Alçakgönüllü teşekkürlerimle, iyiyim, iyiyim, iyiyim.

OFELYA:
Efendim, sizden kalan anılar var bende,
Çoktan geri vermek istediğim;
Lütfen alır mısınız onları şimdi?

HAMLET:
Hayır, ben bir şey vermedim ki size.

OFELYA:
Verdiniz efendim, çok iyi bilirsiniz verdiniz;
Tatlı sözlerle birlikte verdiniz onları,
Aromasıyla değerlerini katkat artıran.
Ama o koku uçtu gitti madem,
Geri alın hediyelerinizi; çünkü soylu yüreğe
Hediyeler değersizleşir veren sevgisizleşince.
Buyurun efendim.`;

export const UploadCleanerView: React.FC<UploadCleanerViewProps> = ({
  onScriptCreated,
  onCancel,
}) => {
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState('');
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [parsedResult, setParsedResult] = useState<ParsedScriptResult | null>(null);

  // Form metadata for saving
  const [scriptTitle, setScriptTitle] = useState('');
  const [scriptAuthor, setScriptAuthor] = useState('');
  const [scriptGenre, setScriptGenre] = useState<Script['genre']>('Dram');

  // Helper to extract text from raw binary/PDF buffer if worker fails
  const fallbackExtractPdfText = (arrayBuffer: ArrayBuffer): string => {
    try {
      const decoder = new TextDecoder('utf-8');
      const rawString = decoder.decode(arrayBuffer);
      // Extract text content inside parenthesis or BT...ET blocks in raw PDF
      const matches = rawString.match(/\(([^)]+)\)/g);
      if (matches && matches.length > 10) {
        return matches
          .map((m) => m.replace(/[()]/g, ''))
          .filter((s) => s.length > 2 && !/^\d+$/.test(s))
          .join(' ');
      }
    } catch (e) {
      console.warn('Fallback PDF extraction failed:', e);
    }
    return '';
  };

  // Handle PDF file selection & extraction
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage('');
    setFileName(file.name);
    const defaultTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    setScriptTitle(defaultTitle);

    if (file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf') {
      setIsLoadingPdf(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        let fullExtractedText = '';

        try {
          const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
          const pdf = await loadingTask.promise;

          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
              .map((item: any) => item.str || '')
              .join(' ');
            fullExtractedText += pageText + '\n';
          }
        } catch (pdfErr) {
          console.warn('PDF.js worker read failed, attempting fallback decoder:', pdfErr);
          fullExtractedText = fallbackExtractPdfText(arrayBuffer);
        }

        if (!fullExtractedText.trim()) {
          throw new Error('PDF içerisinden okunabilir metin çıkarılamadı. Lütfen metin seçilebilir bir PDF veya .txt dosyası deneyin.');
        }

        setRawText(fullExtractedText);
        // Execute cleaning algorithm immediately
        const cleaned = cleanAndParseScriptText(fullExtractedText, defaultTitle);
        setParsedResult(cleaned);
      } catch (err: any) {
        console.error('PDF Read error:', err);
        setErrorMessage(err.message || 'PDF dosyası okunurken hata oluştu. Dilerseniz metni kopyalayıp sağdaki metin kutusuna doğrudan yapıştırabilirsiniz.');
      } finally {
        setIsLoadingPdf(false);
      }
    } else {
      // Plain text file (.txt)
      setIsLoadingPdf(true);
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = (event.target?.result as string) || '';
        setRawText(text);
        const cleaned = cleanAndParseScriptText(text, defaultTitle);
        setParsedResult(cleaned);
        setIsLoadingPdf(false);
      };
      reader.onerror = () => {
        setErrorMessage('Metin dosyası okunamadı.');
        setIsLoadingPdf(false);
      };
      reader.readAsText(file);
    }
  };

  // Load sample script (Hamlet)
  const handleLoadSample = () => {
    setErrorMessage('');
    setFileName('Hamlet_Ornek_Metin.pdf');
    setScriptTitle('Hamlet (Act III, Scene I)');
    setScriptAuthor('William Shakespeare');
    setScriptGenre('Tragedya');
    setRawText(SAMPLE_HAMLET_RAW);
    const cleaned = cleanAndParseScriptText(SAMPLE_HAMLET_RAW, 'Hamlet (Act III, Scene I)');
    setParsedResult(cleaned);
  };

  // Run standard cleaning algorithm
  const handleRunAlgorithm = () => {
    setErrorMessage('');
    const textToClean = rawText.trim();
    if (!textToClean) {
      setErrorMessage('Lütfen önce bir PDF dosyası yükleyin veya metin kutusuna oyun repliklerini yapıştırın.');
      return;
    }
    const result = cleanAndParseScriptText(textToClean, scriptTitle || 'Yeni Oyun');
    setParsedResult(result);
  };

  // Finalize & Save script
  const handleSaveScript = () => {
    if (!parsedResult || parsedResult.lines.length === 0) {
      alert('Kaydedilecek geçerli replik bulunamadı.');
      return;
    }

    const newScript: Script = {
      id: `script-${Date.now()}`,
      title: scriptTitle || parsedResult.title || 'Adsız Oyun Metni',
      author: scriptAuthor || 'Bilinmeyen Yazar',
      genre: scriptGenre,
      language: 'Türkçe',
      characters: parsedResult.characters,
      lines: parsedResult.lines,
      isPreset: false,
      isFavorite: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: [scriptGenre, 'Kullanıcı Metni'],
    };

    onScriptCreated(newScript);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-stone-800 border border-stone-700 text-amber-300 text-xs font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
          <span>Aklımda Metin & Replik Temizleme Laboratuvarı</span>
        </div>
        <h2 className="text-3xl font-bold text-stone-100 font-serif">
          PDF Oyun Metni Yükle & <span className="text-amber-300">Giriş Metinlerini Temizle</span>
        </h2>
        <p className="text-stone-300 text-sm max-w-2xl">
          Tiyatro veya dizi senaryonuzu yükleyin. Akıllı temizleme algoritmamız önsöz, biyografi, kapak bilgileri ve sayfa numaralarını otomatik atarak <strong className="text-amber-200">sadece Perde, Sahne, Karakterler ve Replikleri</strong> hazırlar.
        </p>
      </div>

      {/* File Dropzone & Raw Text Box */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Zone */}
        <div className="bg-[#18191E] border-2 border-dashed border-stone-700 hover:border-amber-500/60 rounded-2xl p-6 text-center flex flex-col items-center justify-center space-y-4 transition-all shadow-sm">
          <div className="w-14 h-14 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center text-amber-400">
            <Upload className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-stone-100 font-serif">PDF veya TXT Dosyanızı Seçin</h3>
            <p className="text-xs text-stone-400 mt-1">Cihazınızdan tiyatro oyunu veya dizi senaryosu yükleyin</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <label
              htmlFor="pdf-file-upload-input"
              className="cursor-pointer px-4 py-2 bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs rounded-lg transition-all inline-flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              <span>PDF / TXT Dosyası Seç</span>
              <input
                id="pdf-file-upload-input"
                type="file"
                accept=".pdf,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            <button
              onClick={handleLoadSample}
              className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-amber-300 font-medium text-xs rounded-lg border border-stone-700 flex items-center gap-1.5 transition-all"
            >
              <FileCode className="w-4 h-4 text-amber-400" />
              <span>Örnek Metin Yükle</span>
            </button>
          </div>

          {fileName && (
            <span className="text-xs font-medium text-amber-300 bg-stone-800 border border-stone-700 px-3 py-1 rounded-md">
              {fileName}
            </span>
          )}
          {isLoadingPdf && (
            <div className="flex items-center gap-2 text-xs text-amber-400 animate-pulse">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>PDF metni ayıklanıyor, lütfen bekleyin...</span>
            </div>
          )}
        </div>

        {/* Direct Text Input */}
        <div className="bg-[#18191E] p-5 rounded-2xl border border-stone-800 space-y-3 flex flex-col shadow-sm">
          <label className="text-xs font-medium text-stone-300 flex items-center justify-between">
            <span>Veya Metni Doğrudan Buraya Yapıştırın:</span>
            <span className="text-[11px] text-amber-400 font-mono">{rawText.length} Karakter</span>
          </label>
          <textarea
            id="raw-script-textarea"
            rows={8}
            placeholder="Oyun metnini buraya yapıştırabilirsiniz... (Algoritma önsöz ve basım bilgilerini otomatik temizler)"
            value={rawText}
            onChange={(e) => {
              setRawText(e.target.value);
              setErrorMessage('');
            }}
            className="w-full flex-1 bg-[#111215] border border-stone-700 rounded-xl p-3.5 text-xs text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-500/60 font-mono transition-all custom-scrollbar"
          />

          {errorMessage && (
            <div className="p-3 bg-red-950/80 border border-red-800 rounded-lg text-xs text-red-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="pt-1">
            <button
              id="run-cleaning-algorithm-btn"
              onClick={handleRunAlgorithm}
              className="w-full px-4 py-2.5 bg-stone-800 hover:bg-stone-700 text-amber-200 text-xs font-semibold rounded-lg border border-stone-700 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 text-amber-400" />
              <span>Algoritma ile Metni Temizle & Ayrıştır</span>
            </button>
          </div>
        </div>
      </div>

      {/* Parsing Stats Banner & Parsed Output Review */}
      {parsedResult && (
        <div className="space-y-6 bg-[#18191E] p-6 rounded-2xl border border-stone-800 shadow-sm">
          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-[#111215] border border-stone-800">
            <div>
              <span className="text-[11px] text-stone-400 font-medium block">Ham Satır Sayısı</span>
              <span className="text-lg font-bold text-stone-200">{parsedResult.stats.totalLinesOriginal}</span>
            </div>
            <div>
              <span className="text-[11px] text-amber-400 font-medium block">Temizlenen Replikler</span>
              <span className="text-lg font-bold text-amber-300">{parsedResult.lines.length} Replik</span>
            </div>
            <div>
              <span className="text-[11px] text-emerald-400 font-medium block">Atılan Giriş/Basım Satırı</span>
              <span className="text-lg font-bold text-emerald-300">{parsedResult.stats.filteredHeadersCount} Satır</span>
            </div>
            <div>
              <span className="text-[11px] text-stone-300 font-medium block">Bulunan Karakterler</span>
              <span className="text-lg font-bold text-stone-200">{parsedResult.characters.length} Karakter</span>
            </div>
          </div>

          {/* Metadata Form */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-stone-300 mb-1.5 block">Oyun Başlığı *</label>
              <input
                id="script-title-input"
                type="text"
                value={scriptTitle}
                onChange={(e) => setScriptTitle(e.target.value)}
                placeholder="Örn: Hamlet"
                className="w-full bg-[#111215] border border-stone-700 rounded-lg px-3.5 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-500/60"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-300 mb-1.5 block">Yazar</label>
              <input
                id="script-author-input"
                type="text"
                value={scriptAuthor}
                onChange={(e) => setScriptAuthor(e.target.value)}
                placeholder="Örn: William Shakespeare"
                className="w-full bg-[#111215] border border-stone-700 rounded-lg px-3.5 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-500/60"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-300 mb-1.5 block">Tür / Kategori</label>
              <select
                id="script-genre-select"
                value={scriptGenre}
                onChange={(e) => setScriptGenre(e.target.value as any)}
                className="w-full bg-[#111215] border border-stone-700 rounded-lg px-3.5 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-500/60"
              >
                <option value="Dram">Dram</option>
                <option value="Tragedya">Tragedya</option>
                <option value="Komedi">Komedi</option>
                <option value="Monolog">Monolog</option>
                <option value="Dizi/Film">Dizi / Film</option>
              </select>
            </div>
          </div>

          {/* Detected Characters Badge List */}
          <div className="space-y-2">
            <span className="text-xs font-medium text-stone-300 block">Temizlenen Karakter Listesi:</span>
            <div className="flex flex-wrap gap-2">
              {parsedResult.characters.map((char) => (
                <span
                  key={char}
                  className="px-3 py-1 bg-stone-800 border border-stone-700 text-amber-200 text-xs font-semibold rounded-md"
                >
                  {char}
                </span>
              ))}
            </div>
          </div>

          {/* Preview of Cleaned Lines */}
          <div className="space-y-2">
            <span className="text-xs font-medium text-stone-300 block">Temizlenmiş Metin Önizlemesi (İlk 15 Replik - Giriş kısımları temizlendi):</span>
            <div className="max-h-72 overflow-y-auto bg-[#111215] p-4 rounded-xl border border-stone-800 space-y-3 font-mono text-xs custom-scrollbar">
              {parsedResult.lines.slice(0, 15).map((line, idx) => (
                <div key={line.id || idx} className="border-b border-stone-800/80 pb-2">
                  <span className="font-bold text-amber-400 mr-2">{line.character}:</span>
                  {line.stageDirection && <span className="text-stone-400 italic mr-2">{line.stageDirection}</span>}
                  <span className="text-stone-200">{line.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Final Action Button */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-stone-800">
            {onCancel && (
              <button
                onClick={onCancel}
                className="px-4 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-medium transition-all"
              >
                İptal
              </button>
            )}
            <button
              id="save-cleaned-script-btn"
              onClick={handleSaveScript}
              className="px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Temizlenmiş Metni Kaydet & Prova Yap</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
