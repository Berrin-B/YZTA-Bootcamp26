import difflib
import io
import json
import re
import time

import streamlit as st
from google import genai
from google.genai import types

# PDF okuma için pypdf kullanımı
try:
    from pypdf import PdfReader
except ImportError:
    from PyPDF2 import PdfReader

# Sayfa Ayarları
st.set_page_config(page_title="ToBe", page_icon="🎭", layout="centered")
st.title("🎭 ToBe")
st.caption("Yapay Zeka Destekli Metin Yönetimi, Düzenleme, Prova ve Analiz Asistanı")

# Varsayılan metinler
DEFAULT_SCRIPTS = {
    "Anton Çehov - Martı (Nina & Treplev)": {
        "title": "Anton Çehov - Martı (Nina & Treplev)",
        "description": "Nina ile Treplev arasında kısa bir duygusal karşılaşma.",
        "content": """TREPLEV: Yalnızız.
NİNA: Biri var galiba...
TREPLEV: Kimse yok.
NİNA: Yalnızız demeyin. Birileri var gibi geliyor bana. Sizin tiyatronuz nasıl gidiyor?
TREPLEV: Çok kötü. Nina, seni o kadar çok özledim ki..."""
    },
    "Molière - Cimri (Harpagon & La Flèche)": {
        "title": "Molière - Cimri (Harpagon & La Flèche)",
        "description": "Harpagon ile La Flèche arasında hararetli bir tartışma.",
        "content": """HARPAGON: Çık git buradan hemen, cevap verme bana! Çekil git karşımdan!
LA FLÈCHE: Neden bağırıyorsunuz efendim? Ne yaptım ben size?
HARPAGON: Sus diyorum sana! Soru sorma bana, defol!
LA FLÈCHE: Ben de gidiyorum zaten, tutan yok ki beni!"""
    },
    "Shakespeare - Romeo ve Juliet (Romeo & Juliet)": {
        "title": "Shakespeare - Romeo ve Juliet (Romeo & Juliet)",
        "description": "Romeo ve Juliet arasında duygusal bir ilk karşılaşma.",
        "content": """ROMEO: Ne ışık parlar pencereden? Şu doğan güneş midir senin yüzün?
JULIET: Ay yıldızsız kalır bu karanlıkta, eğer yüzün aydan çalmasaydı.
ROMEO: Sinemadan öte bir mücevher bu dil, zira gözlerinden daha parlak..."""
    }
}

# Yardımcı fonksiyonlar
def read_pdf_content(uploaded_file):
    try:
        reader = PdfReader(io.BytesIO(uploaded_file.read()))
        text = []
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text.append(page_text)
        if not text:
            return None, "PDF'den metin okunamadı. Lütfen farklı bir PDF deneyin."
        return "\n".join(text), None
    except Exception as exc:
        return None, f"PDF okuma sırasında bir hata oluştu: {exc}"

def normalize_text(text):
    text = text.lower()
    text = re.sub(r"[^\wçğıöşü]+", " ", text, flags=re.IGNORECASE)
    return " ".join(text.split()).strip()


def extract_characters(text):
    if not text:
        return []
    matches = re.findall(r"^\s*([A-ZÇĞİÖŞÜa-zçğıöşü\s]{2,25}):", text, re.MULTILINE)
    characters = []
    for item in matches:
        name = item.strip().title()
        if name and name not in characters:
            characters.append(name)
    return characters


def process_script_with_ai(raw_text, api_key):
    if not raw_text or not api_key:
        return None

    try:
        client = genai.Client(api_key=api_key)
        sample_text = raw_text[:8000]

        prompt = f"""
        Sen uzman bir tiyatro dramaturgusun.
        
        GÖREVLER:
        1. Oyunun adını tespit et.
        2. Oyunda geçen GERÇEK tiyatro karakterlerini bul (Yayıncı, editör, basım, önsöz, çevirmen, kaynakça vb. tiyatro dışı terimleri KESİNLİKLE ELE).
        3. Metnin başındaki ÖNSÖZ, YAYINEVİ, BASIM, İÇİNDEKİLER ve KAPAK BİLGİLERİNİ TEMİZLE. Oyunun/repliklerin başladığı İLK REPLİK veya SAHNE BAŞLIĞINI aynen tespit et.
        
        ÇIKTI FORMATI:
        SADECE aşağıdaki JSON formatında yanıt ver. Başka HİÇBİR açıklama veya markdown ekleme:
        {{
            "title": "Oyun Adı",
            "characters": ["KARAKTER1", "KARAKTER2"],
            "cleaned_start_text": "Oyunun ilk repliği veya sahne başlığı..."
        }}
        
        METİN:
        {sample_text}
        """

        # Gemini 3.x modelleri varsayılan olarak "thinking" (düşünme) kullanır ve bu
        # tokenlar max_output_tokens bütçesinden düşer. Ayrıca Gemini 3.x ailesinde
        # zaman zaman görülen bilinen bir davranış olarak, model bazen tamamen boş bir
        # candidates listesiyle dönebiliyor (ne hata, ne güvenlik engeli - sadece boş).
        # Bu yüzden: (1) thinking_level="minimal" ile düşünmeyi Google'ın çıkarım/etiketleme
        # görevleri için önerdiği en düşük seviyeye çekiyoruz, (2) bol max_output_tokens
        # veriyoruz, (3) boş dönerse birkaç kez otomatik yeniden deniyoruz.
        # Ayarlanabilir 4 güvenlik kategorisini en gevşek seviyeye çekiyoruz. Not: bu,
        # "PROHIBITED_CONTENT" block_reason'ını ETKİLEMEZ - o Google'ın sabit, kapatılamayan
        # çekirdek koruma katmanı. Ama olası SAFETY tabanlı blokajları önlemeye yardımcı olur.
        safety_settings = [
            types.SafetySetting(category="HARM_CATEGORY_HARASSMENT", threshold="BLOCK_NONE"),
            types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH", threshold="BLOCK_NONE"),
            types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="BLOCK_NONE"),
            types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="BLOCK_NONE"),
        ]

        generation_config = types.GenerateContentConfig(
            thinking_config=types.ThinkingConfig(thinking_level="minimal"),
            max_output_tokens=8192,
            response_mime_type="application/json",
            safety_settings=safety_settings,
        )

        raw_res = ""
        last_finish_reason = None
        last_block_reason = None
        max_attempts = 3

        for attempt in range(max_attempts):
            response = client.models.generate_content(
                model="gemini-3.6-flash",
                contents=prompt,
                config=generation_config,
            )

            if hasattr(response, "text") and response.text:
                raw_res = response.text.strip()
            elif getattr(response, "candidates", None):
                candidate = response.candidates[0]
                if getattr(candidate, "content", None) and getattr(candidate.content, "parts", None):
                    raw_res = (candidate.content.parts[0].text or "").strip()

            if raw_res:
                break

            if getattr(response, "candidates", None):
                last_finish_reason = getattr(response.candidates[0], "finish_reason", None)
            feedback = getattr(response, "prompt_feedback", None)
            if feedback is not None:
                last_block_reason = getattr(feedback, "block_reason", None)

            if attempt < max_attempts - 1:
                time.sleep(1.5)

        if not raw_res:
            if last_block_reason:
                st.error(
                    f"İstek Google'ın güvenlik filtresine takıldı (block_reason: {last_block_reason}). "
                    "Bu, ayarlarla kapatılamayan sabit bir koruma katmanı; tiyatro metinlerindeki "
                    "şiddet/ölüm gibi temalar bazen yanlışlıkla tetikleyebiliyor. Aşağıdaki "
                    "'AI'sız Devam Et' seçeneğini kullanarak metni AI olmadan da kaydedebilirsin."
                )
            elif str(last_finish_reason) in ("MAX_TOKENS", "FinishReason.MAX_TOKENS"):
                st.error(
                    "Model 'düşünme' aşamasında token bütçesini tükettiği için gövde metni "
                    "üretemedi. Lütfen tekrar deneyin."
                )
            else:
                st.error(
                    f"Model {max_attempts} denemede de boş yanıt döndürdü "
                    f"(finish_reason: {last_finish_reason}). Bu Gemini tarafında ara sıra "
                    "görülen geçici bir durum olabilir; lütfen birkaç dakika sonra tekrar deneyin."
                )
            return None

        match = re.search(r"\{.*\}", raw_res, re.DOTALL)
        clean_json_str = match.group(0) if match else raw_res

        data = json.loads(clean_json_str)

        cleaned_start = data.get("cleaned_start_text", "").strip()
        final_text = raw_text
        if cleaned_start and len(cleaned_start) > 8:
            search_anchor = cleaned_start[:20]
            idx = raw_text.find(search_anchor)
            if idx != -1:
                final_text = raw_text[idx:]

        return {
            "title": data.get("title", "Yeni Oyun"),
            "characters": data.get("characters", []),
            "cleaned_text": final_text,
        }

    except Exception as e:
        st.error(f"AI Analiz Hatası: {e}")
        return None

def is_line_correct(expected, answer):
    expected_norm = normalize_text(expected)
    answer_norm = normalize_text(answer)
    if not expected_norm or not answer_norm:
        return False, 0.0
    ratio = difflib.SequenceMatcher(None, expected_norm, answer_norm).ratio()
    return ratio >= 0.70, ratio

def split_script_lines(script_text):
    lines = []
    for raw in script_text.splitlines():
        if not raw.strip():
            continue
        match = re.match(r"^\s*([^:]+?)\s*:\s*(.*)$", raw)
        if match:
            lines.append({"character": match.group(1).strip(), "text": match.group(2).strip(), "raw": raw.strip()})
        elif lines:
            lines[-1]["text"] += " " + raw.strip()
            lines[-1]["raw"] += "\n" + raw.strip()
        else:
            lines.append({"character": "", "text": raw.strip(), "raw": raw.strip()})
    return lines

def summarize_script(script_text, mode, api_key):
    if not api_key:
        return "Lütfen önce sol panelde Google Gemini API anahtarınızı girin."

    client = genai.Client(api_key=api_key)
    if mode == "Metni Özetle":
        prompt = "Aşağıdaki tiyatro metnini Türkçe olarak kısa ve anlaşılır şekilde özetle."
    elif mode == "Karakter Analizi":
        prompt = "Aşağıdaki tiyatro metnindeki karakterlerin kimliklerini, geçmişlerini ve rollerini Türkçe olarak özetle."
    else:
        prompt = "Aşağıdaki tiyatro metnindeki karakterlerin psikolojik tahlilini yap. Karakterlerin duygusal durumu, iç motivasyonları ve sahneye yansıyabilecek psikolojik özelliklerini anlat."

    prompt += f"\n\nMETİN:\n{script_text}"
    try:
        safety_settings = [
            types.SafetySetting(category="HARM_CATEGORY_HARASSMENT", threshold="BLOCK_NONE"),
            types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH", threshold="BLOCK_NONE"),
            types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="BLOCK_NONE"),
            types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="BLOCK_NONE"),
        ]
        generation_config = types.GenerateContentConfig(
            thinking_config=types.ThinkingConfig(thinking_level="low"),
            max_output_tokens=8192,
            safety_settings=safety_settings,
        )
        last_finish_reason = None
        for attempt in range(3):
            response = client.models.generate_content(
                model="gemini-3.6-flash",
                contents=[{"role": "user", "parts": [{"text": prompt}]}],
                config=generation_config,
            )
            if getattr(response, "text", None):
                return response.text
            if getattr(response, "candidates", None):
                last_finish_reason = getattr(response.candidates[0], "finish_reason", None)
            if attempt < 2:
                time.sleep(1.5)
        return f"Model {3} denemede de boş yanıt döndürdü (finish_reason: {last_finish_reason}). Lütfen tekrar deneyin."
    except Exception as exc:
        return f"Yapay zeka çağrısı sırasında bir hata oluştu: {exc}"

def get_script_key(title):
    normalized = re.sub(r"[^\wçğıöşü]+", "_", title.lower()).strip("_")
    return "saved:" + normalized

def load_all_scripts():
    all_scripts = {}
    for key, script in DEFAULT_SCRIPTS.items():
        all_scripts[f"builtin:{key}"] = script.copy()
    for key, script in st.session_state.saved_scripts.items():
        all_scripts[key] = script
    return all_scripts

def get_script_safe(key):
    if not key:
        return None
    if key.startswith("builtin:"):
        script_key = key[len("builtin:"):]
        return DEFAULT_SCRIPTS.get(script_key, {}).copy()
    return st.session_state.saved_scripts.get(key)

def format_script_preview(script):
    text = script["content"]
    return text if len(text) <= 400 else text[:400].rsplit(" ", 1)[0] + "..."

def save_script_to_library(title, description, content, characters=None):
    key_base = get_script_key(title)
    key = key_base
    suffix = 1
    while key in st.session_state.saved_scripts:
        suffix += 1
        key = f"{key_base}_{suffix}"
    st.session_state.saved_scripts[key] = {
        "title": title.strip(),
        "description": description.strip(),
        "content": content.strip(),
        "characters": characters or [],
    }
    return key

def ensure_route_to_practice(script_key):
    st.session_state.active_script = script_key
    st.session_state.current_page = "Prova & Ayarlar"
    st.rerun()

def add_to_favorites(script_key):
    if script_key not in st.session_state.favorites:
        st.session_state.favorites.append(script_key)

def remove_from_favorites(script_key):
    if script_key in st.session_state.favorites:
        st.session_state.favorites.remove(script_key)

# Oturum durumu başlangıcı
initial_session = {
    "saved_scripts": {},
    "favorites": [],
    "active_script": None,
    "current_page": "➕ Yeni Metin Ekle",
    "current_line_index": 0,
    "weak_lines": {},
    "hint_revealed": False,
    "timer_start": 0,
    "analysis_result": "",
    "analysis_mode": "Metni Özetle",
    "practice_answer": "",
    "last_evaluation": "",
    "last_ratio": 0.0,
    "pending_script_text": "",
    "script_text": "",
    "script_title": "",
    "script_desc": "",
    "detected_characters": [],
    "script_characters": [],
    "ai_processed": False,
    "new_script_title": "",
    "new_script_description": "",
}
for key, value in initial_session.items():
    if key not in st.session_state:
        st.session_state[key] = value

if st.session_state.current_page not in ["➕ Yeni Metin Ekle", "📚 Kütüphanem", "Prova & Ayarlar"]:
    st.session_state.current_page = "➕ Yeni Metin Ekle"

# Sol Panel
with st.sidebar:
    st.header("📌 ToBe Menüsü")
    page_options = ["➕ Yeni Metin Ekle", "📚 Kütüphanem"]
    current_index = page_options.index(st.session_state.current_page) if st.session_state.current_page in page_options else 0
    selected_page = st.radio("Sayfa Seçimi", page_options, index=current_index)
    if st.session_state.current_page in page_options and selected_page != st.session_state.current_page:
        st.session_state.current_page = selected_page

    st.divider()
    st.header("🔑 Bağlantı Ayarları")
    api_key = st.text_input("Google Gemini API Key", type="password", help="aistudio.google.com adresinden aldığın anahtarı buraya yapıştır.")

# Ana Sayfa
all_scripts = load_all_scripts()

if st.session_state.current_page == "➕ Yeni Metin Ekle":
    st.header("➕ Yeni Metin Ekle")
    tabs = st.tabs(["PDF Yükle", "Metin Yaz / Yapıştır"])

    with tabs[0]:
        uploaded_file = st.file_uploader("PDF dosyanı seç", type=["pdf"], key="pdf_uploader")
        if uploaded_file is not None:
            pdf_text, pdf_error = read_pdf_content(uploaded_file)
            if pdf_error:
                st.error(pdf_error)
            else:
                if st.session_state.get("pending_script_text", "") != pdf_text:
                    st.session_state.pending_script_text = pdf_text
                    st.session_state["script_text"] = pdf_text
                    st.session_state["ai_processed"] = False

    with tabs[1]:
        user_written_text = st.text_area(
            "Metin İçeriği (Düzenlenebilir):",
            value=st.session_state.get("script_text", st.session_state.get("pending_script_text", "")),
            height=250,
            key="editor_text_area",
        )
        if not st.session_state.get("ai_processed"):
            st.session_state["script_text"] = user_written_text

    current_script_text = st.session_state.get("script_text", "")
    if not current_script_text:
        current_script_text = st.session_state.get("pending_script_text", "")

    if current_script_text and not st.session_state.get("ai_processed"):
        st.markdown("---")
        st.subheader("📄 Yüklenen Ham Metin Ön İzlemesi")
        st.text_area(
            "Ham Metin",
            value=current_script_text[:1500] + ("..." if len(current_script_text) > 1500 else ""),
            height=180,
            disabled=True,
            key="raw_preview_box",
        )

    ai_col, skip_col = st.columns([2, 1])
    with ai_col:
        run_ai = st.button(
            "🤖 Metni Yapay Zeka ile İşle ve Hazırla",
            key="ai_process_button"
        )
    with skip_col:
        skip_ai = st.button(
            "✍️ AI'sız Devam Et",
            key="skip_ai_button",
            help="Gemini engellenirse/başarısız olursa metni AI olmadan, basit metin analiziyle kaydet.",
        )

    if run_ai:
        if not api_key:
            st.warning("⚠️ Lütfen sol menüden Google Gemini API anahtarınızı girin!")
        else:
            with st.spinner(
                "🤖 Gemini metni analiz ediyor ve önsözleri temizliyor..."
            ):
                data = process_script_with_ai(current_script_text, api_key)
                if not data:
                    st.error("⚠️ AI’den geçerli bir yanıt alınamadı. Yukarıdaki hata mesajına bakabilir ya da 'AI'sız Devam Et' ile ilerleyebilirsin.")
                else:
                    cleaned_text = current_script_text
                    cleaned_start = data.get("cleaned_text", "").strip()

                    if cleaned_start and len(cleaned_start) > 10:
                        search_anchor = cleaned_start[:20]
                        idx = current_script_text.find(search_anchor)
                        if idx != -1:
                            cleaned_text = current_script_text[idx:]

                    st.session_state["script_text"] = cleaned_text
                    st.session_state["detected_characters"] = data.get("characters", [])
                    st.session_state["script_title"] = data.get("title", "Yeni Oyun")
                    st.session_state.new_script_title = data.get("title", "Yeni Oyun")
                    st.session_state["ai_processed"] = True
                    st.success(
                        "✅ Metin önsözlerden temizlendi ve karakterler tespit edildi!"
                    )
                    st.rerun()

    if skip_ai:
        if not current_script_text.strip():
            st.warning("⚠️ Önce bir metin girin ya da PDF yükleyin.")
        else:
            # AI çağrısı olmadan, mevcut basit regex tabanlı karakter tespitini kullan.
            # Metin önsöz/kapak temizliği yapılmaz; kullanıcı aşağıdaki metin kutusundan
            # elle düzenleyebilir.
            st.session_state["script_text"] = current_script_text
            st.session_state["detected_characters"] = extract_characters(current_script_text)
            st.session_state["script_title"] = "Yeni Oyun"
            st.session_state.new_script_title = "Yeni Oyun"
            st.session_state["ai_processed"] = True
            st.info(
                "AI adımı atlandı. Karakterler basit metin analiziyle tespit edildi; "
                "başlığı, açıklamayı ve metni aşağıda elle düzenleyip kaydedebilirsin."
            )
            st.rerun()

    if st.session_state.get("ai_processed"):
        st.markdown("---")
        st.success("🎉 Yapay Zeka Analizi Tamamlandı! Aşağıdaki bilgileri kontrol edip kütüphanenize kaydedebilirsiniz.")

        st.subheader("📝 Metin Bilgileri")
        st.session_state.new_script_title = st.text_input(
            "Metin Başlığı",
            value=st.session_state.get("script_title", "Yeni Oyun"),
        )
        st.session_state["script_title"] = st.session_state.new_script_title
        st.session_state.new_script_description = st.text_area(
            "Açıklama / Notlar",
            value=st.session_state.get("new_script_description", ""),
            height=80,
        )
        st.session_state["script_desc"] = st.session_state.new_script_description

        st.subheader("🎭 AI Tarafından Tespit Edilen Karakterler")
        chars = st.session_state.get("detected_characters", [])
        if chars:
            chips = [
                f"<span style='display:inline-block;padding:0.3rem 0.8rem;margin:0.2rem;border-radius:20px;background:#E8F0FE;color:#1A73E8;font-weight:bold;'>🎭 {char}</span>"
                for char in chars
            ]
            st.markdown(" ".join(chips), unsafe_allow_html=True)
        else:
            st.info("Karakter bulunamadı.")

        st.subheader("📄 Hazırlanan Metin Ön İzlemesi")
        st.text_area(
            "İşlenmiş Metin",
            value=st.session_state.get("script_text", ""),
            height=250,
            disabled=True,
            key="final_ai_preview_box",
        )

        if st.button("💾 Kütüphaneye Kaydet", key="save_script_final_btn"):
            title_to_save = st.session_state.get("new_script_title", "Adsız Oyun")
            desc_to_save = st.session_state.get("new_script_description", "")
            text_to_save = st.session_state.get("script_text", "")
            characters_to_save = st.session_state.get("detected_characters", [])

            if not text_to_save.strip():
                st.error("Metin içeriği boş olamaz.")
            else:
                saved_key = save_script_to_library(
                    title_to_save,
                    desc_to_save,
                    text_to_save,
                    characters=characters_to_save,
                )
                st.success("🎉 Metin başarıyla kütüphanenize kaydedildi!")
                st.session_state.active_script = saved_key
                st.session_state.pending_script_text = ""
                st.session_state["script_text"] = ""
                st.session_state["detected_characters"] = []
                st.session_state["ai_processed"] = False
                st.session_state.current_page = "Prova & Ayarlar"
                st.rerun()

elif st.session_state.current_page == "📚 Kütüphanem":
    st.header("📚 Kütüphanem")
    tabs = st.tabs(["Kaydettiğim Metinler", "Hazır Metinler", "Favorilerim"])

    with tabs[0]:
        saved_keys = list(st.session_state.saved_scripts.keys())
        if not saved_keys:
            st.info("Henüz kaydedilmiş metin yok. Yeni bir metin ekleyin.")
        else:
            for key in saved_keys:
                script = st.session_state.saved_scripts[key]
                with st.expander(script["title"]):
                    st.write(script["description"])
                    st.write(format_script_preview(script))
                    cols = st.columns([2, 1, 1])
                    if cols[0].button("🎭 Bu Metinle Provaya Başla", key=f"start_{key}"):
                        ensure_route_to_practice(key)
                    if key in st.session_state.favorites:
                        if cols[1].button("★ Favorilerden Kaldır", key=f"unfav_{key}"):
                            remove_from_favorites(key)
                            st.rerun()
                    else:
                        if cols[1].button("☆ Favorilere Ekle", key=f"fav_{key}"):
                            add_to_favorites(key)
                            st.rerun()
                    if cols[2].button("Sil", key=f"delete_{key}"):
                        st.session_state.saved_scripts.pop(key, None)
                        remove_from_favorites(key)
                        st.success("Metin silindi.")
                        st.rerun()

    with tabs[1]:
        for built_key, script in DEFAULT_SCRIPTS.items():
            wrapper_key = f"builtin:{built_key}"
            with st.expander(script["title"]):
                st.write(script["description"])
                st.write(format_script_preview(script))
                cols = st.columns([2, 1])
                if cols[0].button("🎭 Bu Metinle Provaya Başla", key=f"start_{wrapper_key}"):
                    ensure_route_to_practice(wrapper_key)
                if wrapper_key in st.session_state.favorites:
                    if cols[1].button("★ Favorilerden Kaldır", key=f"unfav_{wrapper_key}"):
                        remove_from_favorites(wrapper_key)
                        st.rerun()
                else:
                    if cols[1].button("☆ Favorilere Ekle", key=f"fav_{wrapper_key}"):
                        add_to_favorites(wrapper_key)
                        st.rerun()

    with tabs[2]:
        favorites = [key for key in st.session_state.favorites if key in all_scripts]
        if not favorites:
            st.info("Favori listeniz boş. Kütüphaneden metin seçip favorilere ekleyebilirsiniz.")
        else:
            for key in favorites:
                script = all_scripts[key]
                with st.expander(script["title"]):
                    st.write(script["description"])
                    st.write(format_script_preview(script))
                    cols = st.columns([2, 1])
                    if cols[0].button("🎭 Bu Metinle Provaya Başla", key=f"startfav_{key}"):
                        ensure_route_to_practice(key)
                    if cols[1].button("★ Favorilerden Kaldır", key=f"unfavfav_{key}"):
                        remove_from_favorites(key)
                        st.rerun()

elif st.session_state.current_page == "Prova & Ayarlar":
    active_key = st.session_state.active_script
    selected_script = get_script_safe(active_key)
    if not selected_script:
        st.warning("Aktif bir metin seçilmedi. Lütfen kütüphaneden bir metin seçin.")
        if st.button("Kütüphaneme Dön"):
            st.session_state.current_page = "📚 Kütüphanem"
            st.rerun()
    else:
        st.header("🎬 Prova & Ayarlar")
        st.write(f"**Seçili Metin:** {selected_script['title']}")
        st.write(selected_script['description'])
        nav_cols = st.columns([1, 1, 1])
        if nav_cols[0].button("📚 Kütüphaneme Dön"):
            st.session_state.current_page = "📚 Kütüphanem"
            st.rerun()
        if nav_cols[1].button("➕ Yeni Metin Ekle"):
            st.session_state.current_page = "➕ Yeni Metin Ekle"
            st.rerun()
        if nav_cols[2].button("Metni Kaydet / Kopyala"):
            if active_key.startswith("builtin:"):
                saved_key = save_script_to_library(
                    selected_script["title"],
                    selected_script["description"],
                    selected_script["content"],
                    characters=selected_script.get("characters", []),
                )
                st.success("Metin kütüphaneye kopyalandı.")
                st.session_state.active_script = saved_key
                st.rerun()
            else:
                st.success("Bu metin zaten kaydedilmiş.")

        st.markdown("---")
        st.subheader("Metni İncele ve Düzenle")
        edited_title = st.text_input("Başlığı Düzenle", value=selected_script["title"])
        edited_description = st.text_area("Açıklamayı Düzenle", value=selected_script["description"], height=100)
        edited_content = st.text_area("Metin İçeriği", value=selected_script["content"], height=260)

        if st.button("Değişiklikleri Kaydet"):
            if active_key.startswith("builtin:"):
                saved_key = save_script_to_library(edited_title, edited_description, edited_content)
                st.session_state.active_script = saved_key
                st.success("Hazır metin kaydedildi ve aktif metin olarak ayarlandı.")
                st.rerun()
            else:
                st.session_state.saved_scripts[active_key] = {
                    "title": edited_title.strip(),
                    "description": edited_description.strip(),
                    "content": edited_content.strip(),
                    "characters": selected_script.get("characters", []),
                }
                st.success("Metin kaydedildi.")
                st.rerun()

        st.markdown("---")
        st.subheader("Prova Ayarları")
        practice_mode = st.selectbox(
            "Pratiği nasıl göstermek istersiniz?",
            [
                "Bütün replikler gösterilsin",
                "Sıramız gelince gizlensin",
                "Repliğin sadece ilk kelimesi gösterilsin",
                "Tamamen gizlensin"
            ],
            index=1,
            key="practice_mode"
        )
        next_line_mode = st.selectbox(
            "Bir sonraki line'a geçme yöntemi",
            ["Manuel", "Zamanlayıcı ile", "Otomatik"],
            index=0,
            key="next_line_mode"
        )
        timer_seconds = st.number_input("Zamanlayıcı süresi (s)", min_value=3, max_value=60, value=8, key="timer_seconds")
        use_write_control = st.checkbox("Replik sırası bana gelince yazma kontrolünü kullan", value=False, key="use_write_control")
        show_hints = st.checkbox("İpucu almak istiyorum", value=True, key="show_hints")

        lines = split_script_lines(edited_content)
        characters = selected_script.get("characters") or extract_characters(edited_content)
        if not lines:
            st.warning("Seçili metinde satır formatı bulunamadı. Lütfen KARAKTER: replik formatında metin girin.")
        elif not characters:
            st.warning("Seçili metinde karakter ayrıştırılamadı. Lütfen metni kontrol edin.")
        else:
            user_character = st.selectbox("Hangi karakteri pratik yapmak istersiniz?", characters, key="user_character")
            all_lines = [line for line in lines if line["character"]]
            if st.session_state.current_line_index >= len(all_lines):
                st.session_state.current_line_index = 0

            current_index = st.session_state.current_line_index
            current_line = all_lines[current_index]
            st.markdown(f"**Geçerli Satır ({current_index + 1}/{len(all_lines)}):** {current_line['character']}")

            display_text = current_line["text"]
            if current_line["character"] == user_character:
                if practice_mode == "Sıramız gelince gizlensin":
                    display_text = "..."
                elif practice_mode == "Repliğin sadece ilk kelimesi gösterilsin":
                    words = current_line["text"].split()
                    display_text = f"{words[0]} ..." if words else "..."
                elif practice_mode == "Tamamen gizlensin":
                    display_text = "[Gizli]"

            st.info(f"**{current_line['character']}:** {display_text}")

            if current_line["character"] == user_character and show_hints:
                if st.button("İpucu Göster"):
                    st.session_state.hint_revealed = True
                if st.session_state.hint_revealed:
                    hint = " ".join(current_line["text"].split()[:2])
                    st.success(f"İpucu: {hint}...")

            if use_write_control and current_line["character"] == user_character:
                st.write("Repliğini yaz ve kontrol et.")
                st.session_state.practice_answer = st.text_input("Repliğini yaz", value=st.session_state.practice_answer, key="practice_answer")
                if st.button("Kontrol Et"):
                    correct, ratio = is_line_correct(current_line["text"], st.session_state.practice_answer)
                    st.session_state.last_ratio = ratio
                    if correct:
                        st.success(f"Tebrikler! Repliğin doğru. Benzerlik: {ratio:.0f}%")
                        st.session_state.last_evaluation = "correct"
                    else:
                        st.error(f"Henüz doğru değil. Benzerlik: {ratio:.0%}. Lütfen tekrar deneyin veya ipucu kullanın.")
                        st.session_state.last_evaluation = "incorrect"

            if st.button("Zayıf Satır Olarak İşaretle"):
                if active_key not in st.session_state.weak_lines:
                    st.session_state.weak_lines[active_key] = []
                if current_index not in st.session_state.weak_lines[active_key]:
                    st.session_state.weak_lines[active_key].append(current_index)
                st.success("Satır zayıf olarak işaretlendi.")

            if next_line_mode == "Zamanlayıcı ile" and st.button("Zamanlayıcıyı Başlat"):
                st.session_state.timer_start = time.time()
                st.info(f"{timer_seconds} saniye sonra bir sonraki satıra geçilecek.")

            if next_line_mode == "Zamanlayıcı ile" and st.session_state.timer_start:
                elapsed = time.time() - st.session_state.timer_start
                remaining = max(0, timer_seconds - int(elapsed))
                st.write(f"Kalan süre: {remaining} saniye")
                if elapsed >= timer_seconds:
                    st.session_state.current_line_index = min(len(all_lines) - 1, current_index + 1)
                    st.session_state.timer_start = 0
                    st.session_state.hint_revealed = False
                    st.rerun()

            if next_line_mode == "Otomatik" and current_line["character"] == user_character and st.session_state.last_evaluation == "correct":
                st.session_state.current_line_index = min(len(all_lines) - 1, current_index + 1)
                st.session_state.hint_revealed = False
                st.session_state.practice_answer = ""
                st.session_state.last_evaluation = ""
                st.rerun()

            cols = st.columns(3)
            if cols[0].button("Önceki Satır"):
                st.session_state.current_line_index = max(0, current_index - 1)
                st.session_state.hint_revealed = False
                st.session_state.practice_answer = ""
                st.session_state.last_evaluation = ""
                st.rerun()
            if cols[1].button("Sonraki Satır"):
                st.session_state.current_line_index = min(len(all_lines) - 1, current_index + 1)
                st.session_state.hint_revealed = False
                st.session_state.practice_answer = ""
                st.session_state.last_evaluation = ""
                st.rerun()

            if st.session_state.weak_lines.get(active_key):
                st.expander("Zayıf Olarak İşaretlenen Satırlar").write(
                    "\n".join(
                        f"{idx + 1}. {all_lines[idx]['character']}: {all_lines[idx]['text']}"
                        for idx in st.session_state.weak_lines[active_key]
                    )
                )
                if st.button("Zayıf Satırları Sıfırla"):
                    st.session_state.weak_lines[active_key] = []
                    st.success("Zayıf satırlar temizlendi.")

        st.markdown("---")
        st.subheader("Yapay Zeka Destekli Analiz")
        analysis_options = ["Metni Özetle", "Karakter Analizi", "Psikolojik Tahlil"]
        selected_analysis_mode = st.selectbox(
            "Hangi analiz türünü çalıştırmak istersiniz?",
            analysis_options,
            key="analysis_mode"
        )
        if st.button("Analizi Çalıştır"):
            st.session_state.analysis_result = summarize_script(edited_content, selected_analysis_mode, api_key)

        if st.session_state.analysis_result:
            st.text_area("Analiz Sonucu", value=st.session_state.analysis_result, height=260)

else:
    st.warning("Sol panelden bir metin ekleyin ya da kütüphanemden bir içerik seçin.")