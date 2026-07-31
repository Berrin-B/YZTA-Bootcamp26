import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Modality } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Initialize Gemini AI SDK (Server-Side Only)
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
});

// API Route: Script & Character Analysis using Gemini AI
app.post("/api/gemini/analyze", async (req, res) => {
  try {
    const { scriptTitle, characterName, sceneContent, type } = req.body;

    if (!scriptTitle || !sceneContent) {
      return res.status(400).json({ error: "Eksik parametreler (scriptTitle, sceneContent gerekli)." });
    }

    let prompt = "";

    if (type === "character") {
      prompt = `Sen deneyimli bir tiyatro ve sinema yönetmeni, aynı zamanda uzman bir oyunculuk koçusun.
Şu tiyatro metninden ("${scriptTitle}") seçilen "${characterName || "Ana Karakter"}" karakteri için derinlemesine bir karakter ve psikoloji analizi hazırla.

Metin / Sahne:
"""
${sceneContent.slice(0, 4000)}
"""

Lütfen yanıtı Türkçe dilinde, tiyatro oyuncularının prova yaparken faydalanabileceği net ve pratik bir formatta ver:
1. **Karakterin Genel Psikolojisi ve İç Dünyası**: Temel arzuları, korkuları ve travmaları.
2. **Karakterin Geçmiş Hikayesi (Backstory)**: Metindeki ima veya olasılıklardan yola çıkan derin arka plan.
3. **Sahnedeki Süper Hedef (Super-Objective) ve Engeli**: Bu sahnede ne istiyor, karşısındaki engel ne?
4. **İlişki Dinamikleri**: Diğer karakterlerle çatışması veya bağı.
5. **Oyunculuk İpuçları & Beden Dili**: Ses tonu, nefes kullanımı, duraklamalar ve fiziksel jest önerileri.`;
    } else if (type === "subtext") {
      prompt = `Sen usta bir tiyatro metin analisti ve dramaturgsun.
Aşağıdaki sahne metni ("${scriptTitle}") için detaylı ALT METİN (Subtext) ve ÇATIŞMA ANALİZİ çıkar.

Metin / Sahne:
"""
${sceneContent.slice(0, 4000)}
"""

Lütfen Türkçe olarak:
1. **Özet & Temel Çatışma**: Sahnenin ana çatışma ekseni.
2. **Alt Metin (Satır Araları)**: Karakterlerin söyledikleri ile aslında kastedilenler (Gizli niyetler).
3. **Dönüm Noktaları (Beat Switch)**: Sahnedeki duygu veya güç dengesi değişim anları.
4. **Atmosfer ve Tonal Yapı**: Sahnenin temposu ve ritim tavsiyeleri.`;
    } else if (type === "coach_chat") {
      const { userQuestion } = req.body;
      prompt = `Sen oyunculara rehberlik eden sıcak, motivasyonel ve çok bilgili bir AI Oyunculuk Koçusun.
Oyun: "${scriptTitle}"
Karakter: "${characterName || "Oyuncu"}"

Metin Özeti/İçeriği:
"""
${sceneContent.slice(0, 2000)}
"""

Oyuncunun Sorusu/Talebi:
"${userQuestion}"

Lütfen oyuncuya ilham verici, uygulanabilir ve pratik bir oyunculuk tavsiyesi sun. Türkçe yanıt ver.`;
    } else {
      prompt = `Sen usta bir tiyatro dramaturgusun. Aşağıdaki oyun metnini ("${scriptTitle}") genel olarak analiz et, temalarını, karakter ilişkilerini ve oyuncu provaları için kritik noktaları Türkçe özetle.\n\nMetin:\n"""\n${sceneContent.slice(0, 4000)}\n"""`;
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
    });

    const analysisText = response.text || "Analiz üretilemedi.";
    return res.json({ analysis: analysisText });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return res.status(500).json({
      error: error.message || "Yapay zeka analizi oluşturulurken bir hata oluştu.",
    });
  }
});

// API Route: Smart Script Cleaning AI Assistant (Enhancer for clean script)
app.post("/api/gemini/clean-script", async (req, res) => {
  try {
    const { rawText } = req.body;
    if (!rawText) {
      return res.status(400).json({ error: "rawText gereklidir." });
    }

    const prompt = `Sen profesyonel bir tiyatro dramaturgu ve dizi senaryo editörüsün.
Sana verilen tiyatro/dizi metninden TÜM GİRİŞ BÖLÜMLERİNİ, ÖNSÖZLERİ, YAZAR BİYOGRAFİLERİNİ, YAYINEVİ VE BASIM BİLGİLERİNİ, SAYFA NUMARALARINI, İÇİNDEKİLER VE ROL DAĞILIMI BÖLÜMLERİNİ TAMAMEN SİL.

Metinde SADECE VE SADECE şunlar kalmalıdır:
1. Perde ve Sahne/Bölüm Başlıkları (Örn: 1. PERDE, 2. SAHNE veya PERDE 1)
2. Karakter İsimleri ve Replikleri (Format: KARAKTER ADI: Replik metni)
3. Parantez içindeki sahne/oyunculuk yönergeleri (Örn: (Gülerek yaklaşır))

Giriş kısımlarındaki hiçbir biyografiyi, sunuşu veya yayın notunu ASLA metinde bırakma. Metin doğrudan ilk Perde/Sahne başlığı veya ilk Karakter repliği ile başlasın.

Girdi Metin:
"""
${rawText.slice(0, 15000)}
"""`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
    });

    return res.json({ cleanedText: response.text || rawText });
  } catch (err: any) {
    console.error("Script clean AI error:", err);
    return res.status(500).json({ error: "AI metin temizleme sırasında hata oluştu." });
  }
});

// In-Memory Server TTS Audio Cache for ultra-low latency and API quota optimization
const ttsCache = new Map<string, { audio: string; sampleRate: number; mimeType: string }>();
const MAX_SERVER_CACHE_SIZE = 500;

function generateTtsCacheKey(
  text: string,
  voiceName: string,
  emotion?: string,
  stageDirection?: string
): string {
  const normalizedText = text.replace(/\s+/g, ' ').trim().toLowerCase();
  return `${voiceName}_${emotion || 'natural'}_${stageDirection || ''}_${normalizedText}`;
}

// API Route: Gemini Human Voice TTS Generation
app.post("/api/tts/generate", async (req, res) => {
  try {
    const { text, characterName, gender, emotion, stageDirection, voiceName: reqVoiceName } = req.body;
    if (!text) {
      return res.status(400).json({ error: "text gereklidir." });
    }

    // Clean text from stage directions
    const cleanText = text.replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').trim();
    if (!cleanText) {
      return res.status(400).json({ error: "Boş metin." });
    }

    // Select prebuilt Gemini voice name
    // Supported voices: 'Fenrir', 'Charon', 'Puck', 'Kore', 'Zephyr'
    let voiceName = reqVoiceName;
    if (!voiceName) {
      if (gender === 'female') {
        voiceName = 'Kore'; // Warm natural female voice
      } else if (gender === 'male') {
        // Distribute different male characters to different voices for contrast
        const charUpper = (characterName || '').toUpperCase();
        if (charUpper.includes('BABA') || charUpper.includes('KRAL') || charUpper.includes('SMİRNOV') || charUpper.includes('SMIRNOV') || charUpper.includes('BEY')) {
          voiceName = 'Charon'; // Authoritative / Deep male
        } else if (charUpper.includes('GENÇ') || charUpper.includes('GENC') || charUpper.includes('LUKA') || charUpper.includes('OĞUL')) {
          voiceName = 'Puck'; // Energetic / Younger male
        } else {
          voiceName = 'Fenrir'; // Natural rich male voice
        }
      } else {
        voiceName = 'Zephyr'; // Neutral narrator / balanced voice
      }
    }

    // Check server-side cache for instant zero-latency response
    const cacheKey = generateTtsCacheKey(cleanText, voiceName, emotion, stageDirection);
    if (ttsCache.has(cacheKey)) {
      const cached = ttsCache.get(cacheKey)!;
      return res.json(cached);
    }

    // Construct dramaturgical prompt for humanized, theatrical voice synthesis
    let instruction = `Lütfen aşağıdaki tiyatro repliğini yapay/robotik bir tonda DEĞİL, duygulu, vurgulu ve gerçekçi bir insan sesiyle Türkçe seslendir.\nKarakter: ${characterName || 'Karakter'}`;
    if (stageDirection) {
      instruction += `\nDramatik duygu ve sahne tonlaması: ${stageDirection}`;
    }
    if (emotion && emotion !== 'natural') {
      instruction += `\nDuygu Modu: ${emotion}`;
    }
    instruction += `\nReplik: "${cleanText}"`;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: instruction }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error("Gemini ses üretilemedi.");
    }

    const resultPayload = { audio: base64Audio, mimeType: "audio/pcm", sampleRate: 24000 };

    // Save to server cache (evict oldest if cache gets too large)
    if (ttsCache.size >= MAX_SERVER_CACHE_SIZE) {
      const firstKey = ttsCache.keys().next().value;
      if (firstKey) ttsCache.delete(firstKey);
    }
    ttsCache.set(cacheKey, resultPayload);

    return res.json(resultPayload);
  } catch (err: any) {
    const isQuotaError =
      err?.status === 429 ||
      err?.code === 429 ||
      (typeof err?.message === 'string' && (err.message.includes('429') || err.message.includes('quota') || err.message.includes('RESOURCE_EXHAUSTED')));

    if (isQuotaError) {
      console.warn("Gemini TTS free tier quota limit reached. Clients will fallback to browser SpeechSynthesis.");
      return res.status(429).json({
        error: "QUOTA_EXHAUSTED",
        message: "Gemini TTS kotalı veya sınırına ulaşıldı. Tarayıcı sesine geçiliyor."
      });
    }

    console.warn("Gemini TTS error:", err?.message || err);
    return res.status(500).json({ error: "TTS_FAILED", message: err?.message || "TTS ses üretimi başarısız oldu." });
  }
});

async function startServer() {
  // Vite middleware for dev or static server for prod
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`ScenePartner Server running at http://localhost:${PORT}`);
  });
}

startServer();
