# 🎭 Aklımda - Akıllı Tiyatro & Senaryo Prova Asistanı
## 👥 Takım Bilgileri (Bireysel Proje)
* **Berrin Bilgin:** Product Owner / Scrum Master / Developer
  
## 📌 Proje Hakkında
Tiyatro ve kamera önü oyuncuları, diyalog gerektiren bir sahneyi veya tiradı ezberlerken **partner eksikliği** yaşarlar. Geleneksel yöntemlerde oyuncular:
- Kendi seslerini kasete/telefona kaydedip karşı tarafın boşluklarında konuşmaya çalışırlar (esneklikten yoksun, monoton ve zaman alıcıdır).
- Aile bireylerinden veya arkadaşlarından replik okumalarını rica ederler (her zaman erişilebilir değildir).
- Klasik ses okuyucuları (TTS) kullandıklarında ise robotik, duygusuz ve tiyatral vurgulardan uzak ses tonlarıyla prova yapmak zorunda kalırlar.
Aklımda, tiyatro ve sahne oyuncularının tek başlarına rol provası yaparken yaşadığı "karşılıklı replik okuma" problemini çözen yapay zeka destekli bir prova asistanıdır. Kullanıcı tiyatro metnini sisteme yükler, kendi oynayacağı karakteri seçer ve uygulama senaryo akışını takip ederek diğer karakterlerin repliklerini sırayla ekrana getirir. Oyuncunun sırası geldiğinde repliği gizleyerek hafıza ve ipucu mekanizmasıyla etkileşimli bir prova deneyimi sunar.


### 💡 Bu Problem Neden Önemli?
Bir sahnede duygu geçişi, zamanlama (pacing), tonlama ve partnerin ses tonuna verilen anlık tepkiler hayati önem taşır. Monoton veya mekanik provalar oyuncunun sahne hissini köreltir ve gerçek performansa geçiş süresini uzatır.

### 👥 Hedef Kullanıcı Kitlesi
- Tiyatro, dizi ve film oyuncuları
- Konservatuar ve oyunculuk kursu öğrencileri
- Dublaj ve seslendirme sanatçıları
- Sunucular, konuşmacılar ve tirad çalışan bireysel sanatçılar

---

## 2. Çözümümüz

### 🚀 Ürün Ne Yapıyor?
**Aklımda AI**, yüklenen herhangi bir oyun metnini veya senaryoyu (PDF, TXT, DOCX) saniyeler içinde analiz eder; karakterleri, sahne yönnergelerini (jest, mimik, duygu) ve replikleri ayıklar. Oyuncu kendi rolünü seçer; geriye kalan tüm partner karakterleri ise **Google Gemini AI'ın insansı nöral ses teknolojisi** canlandırır.

### ✨ Kullanıcı Neden Bu Ürünü Tercih Etmeli?
1. **İnsansı ve Tiyatral Sesler:** Monoton sesler yerine sahnedeki duyguya, karakterin cinsiyetine ve mizacına uygun insansı Gemini AI sesleri (Kore, Fenrir, Charon, Puck, Zephyr) kullanılır.
2. **Sıfır Gecikmeli Akış (Zero-Latency Streaming):** Bir sonraki partner replikleri arka planda önceden hazırlanarak provadaki akıcılık ve sahne ritmi korunur.
3. **Akıllı Sufle ve Ezber Modları:** Takıldığınızda anlık ipucu veren yapay zekâ suflesi ve replikleri gizleyerek hafızayı zorlayan gizleme modları içerir.
4. **7/24 Kesintisiz Partner:** Zaman ve mekân sınırlaması olmaksızın dilediğiniz an provalarınızı gerçekleştirebilirsiniz.
5. **Derinlemesine Karakter/Metin Analizi:** Yapay Zeka Asistanı ile istediğiniz karakterlerin analizini çıkarıp geçmişlerini, psikolojilerini ve motivasyonlarını derinlemesine çalışıp karakteri geliştirebilirsiniz.

---

## 3. Kullanıcı Deneyimi (İş Akışı ve Kullanım)

Bir kullanıcının Aklımda AI platformundaki adım adım prova deneyimi:

```
[1. Senaryo Yükleme] ➡️ [2. Karakter & Sahne Seçimi] ➡️ [3. AI Ses & Mod Ayarı] ➡️ [4. İnteraktif Prova & Sufle] ➡️ [5. Analiz & Raporlama]
```

### 📋 Kullanım Adımları:
1. **Senaryo ve Metin Girişi:** Kullanıcı kendi senaryo dosyasını yükler veya hazır tiyatro metinlerinden (ör. Shakespeare, Çehov vb.) birini seçer.
2. **Otomatik Ayrıştırma:** Sistem senaryoyu inceler, sahneleri bölümler ve karakter listesini çıkarır.
3. **Rol Seçimi ve Ses Özelleştirme:** Kullanıcı kendi canlandıracağı karakteri seçer. Diğer karakterler için cinsiyet, hız, tonlama ve Gemini AI ses modelleri (örn: *Charon - Otoriter Erkek*, *Kore - Sıcak Kadın*) atanır.
4. **Sahne Modu Belirleme:**
   - **Tam Prova:** Tüm replikler görünür, akıcı okuma yapılır.
   - **Ezber (Gizli) Modu:** Kullanıcının kendi replikleri blurlanır, hatırlaması beklenir.
   - **Sufleli Prova:** Takılınca otomatik ilk kelimeler veya tiyatral ipuçları belirir.
5. **Sahneye Çıkış (Canlı Prova):**
   - Kullanıcı repliğini söyler yazar veya mikrofon/ilerle butonuna basar.
   - AI partner, senaryodaki sahne yönnergelerini (ör: *[öfkeyle fısıldayarak]*) dikkate alarak repliğini seslendirir.
   - Kullanıcı takıldığında **"İpucu Ver"** butonuna basarak yapay zekadan anlık tiyatral yönlendirme alır.

---

## 4. Ürünün Temel Özellikleri

| Özellik | Açıklama |
| :--- | :--- |
| 🎭 **Akıllı Senaryo Ayrıştırıcı (NLP Parser)** | PDF/TXT senaryolardan karakter repliklerini ve parantez içi sahne yönnergelerini (`stage directions`) otomatik olarak ayırır. |
| 🎙️ **Gemini AI Nöral Seslendirme Engine** | Google Gemini'ın gelişmiş doğrudan ses sentezleme modellerini (`Kore`, `Fenrir`, `Charon`, `Puck`, `Zephyr`) kullanaraktiyatral duygulu okuma sağlar. |
| ⚡ **Arka Plan Ön-Yükleme (Prefetch Engine)** | Sahne akarken partnerin bir sonraki repliğini arka planda hazırlar; gecikmesiz, doğal bir diyalog ritmi sunar. |
| 💡 **Yapay Zekâ Sufle Asistanı** | Oyuncunun takıldığı noktada senaryo bağlamına uygun ipucu, ilk sözcükler veya duygu hatırlatması üretir. |
| 🙈 **Ezber Modu (Blur/Hide Replikler)** | Oyuncunun kendi konuşacağı hatları gizleyerek zihinsel ezber kontrolü ve performans testi imkanı verir. |
| 🎧 **Hibrit Ses Motoru Desteği** | Gemini AI Ses Motoru + Çevrimdışı Tarayıcı Web Speech API yedekleme sistemi ile kesintisiz çalışma garantisi. |

---

## 5. Kullanılan Teknolojiler

### 5.1 Yapay Zekâ & Backend Mimarisi

- **Kullanılan AI Modelleri:**
  - `gemini-3.6-flash` (NLP & Audio Generation):
    - Senaryo analizi, karakter bağlamı çıkarma ve tiyatral sufle üretimi.
    - Doğrudan PCM ses sentezleme (Gemini Text-to-Speech Audio output) ile insan doğallığında ses üretimi.
- **Yapay Zekânın Üstlendiği Görevler:**
  1. Senaryolardaki karakter, replik ve duygu parantezlerini analiz etme.
  2. Karakter mizacına göre otomatik ses ve cinsiyet eşleştirmesi yapma.
  3. Doğal konuşma dilinde, duraklamalı ve tonlamalı ses üretimi (`24kHz 16-bit PCM Audio`).
  4. Takılan oyuncuya anlık sufle (prompting) desteği sağlama.

- **Teknik Mimari Özeti:**
  - **Frontend:** React 18, TypeScript, Tailwind CSS, Lucide Icons, Web Audio API (`AudioContext`, `AudioBuffer` PCM kayıpsız ses işleyici).
  - **Backend Server:** Node.js + Express API sunucusu (`server.ts`).
  - **SDK Integration:** `@google/genai` TypeScript SDK server-side entegrasyonu (API anahtarları güvenle sunucuda saklanır).
  - **Ses Akışı:** İstemci tarafında Web Audio API aracılığıyla Gemini PCM bayt akışları işlenerek anında çalınır.

---
- **Ekran Görüntüleri:**
<img width="1348" height="629" alt="Ekran Görüntüsü (1133)" src="https://github.com/user-attachments/assets/e21583f8-7e13-4649-bc4e-6d1f90a95471" />
<img width="1345" height="624" alt="Ekran Görüntüsü (1134)" src="https://github.com/user-attachments/assets/b469b79e-ce07-4693-80ea-6c53ec5f5200" />
<img width="1343" height="625" alt="Ekran Görüntüsü (1138)" src="https://github.com/user-attachments/assets/c2eb1eb4-f341-47ee-86b4-b5c6b0f372fd" />
<img width="1329" height="625" alt="Ekran Görüntüsü (1136)" src="https://github.com/user-attachments/assets/4bcf2084-1a7c-4edb-aaac-e97dcc64868d" />
<img width="1347" height="621" alt="Ekran Görüntüsü (1135)" src="https://github.com/user-attachments/assets/4d4b7148-56b9-4591-8243-0c412b7ee5bb" />
<img width="1343" height="627" alt="Ekran Görüntüsü (1139)" src="https://github.com/user-attachments/assets/b33e7702-8b1c-4fe6-8035-0ba3f0517f82" />







Aklımda AI ile sahneye her zaman hazır olun! 🎭✨
