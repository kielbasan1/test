import json
import os

from groq import Groq

from services.gemini_client import AMPLIFY_PROMPT, EXTRACT_PROMPT, SYNTHESIS_PROMPT

_client = None


def _get_client() -> Groq:
    global _client
    if _client is None:
        api_key = os.environ.get("GROQ_API_KEY", "").strip()
        if not api_key:
            raise RuntimeError(
                "GROQ_API_KEY tanımlı değil. .env dosyasına console.groq.com "
                "üzerinden aldığınız ücretsiz API anahtarını ekleyin."
            )
        _client = Groq(api_key=api_key)
    return _client


def _synthesis_model_name() -> str:
    # gpt-oss-120b bilinçli olarak elendi: psikolojik analiz içerikte
    # belgelenmiş aşırı-reddetme sorunu var, gerçek test rüyalarımızdaki
    # aile/cinsellik/din/utanç temalarıyla çakışma riski yüksek. Groq'un
    # model envanteri sık değişiyor — llama-3.3-70b-versatile bu hesapta
    # artık mevcut değildi (2026-09-10), qwen3.6-27b şu an mevcut en güçlü
    # genel-amaçlı (gpt-oss/agentic olmayan) model.
    return os.environ.get("GROQ_SYNTHESIS_MODEL", "qwen/qwen3.6-27b")


def _extract_model_name() -> str:
    # Gemini tarafında extraction ucuz/yüksek-kotalı bir modele (flash-lite)
    # ayrılmıştı ama Groq'ta ayrı bir "ucuz" model doğrulanmadı — kalite
    # riskini almamak için sentezle aynı qwen3.6-27b kullanılıyor, ayrı ayarlanabilsin
    # diye kendi env değişkeni var.
    return os.environ.get("GROQ_EXTRACT_MODEL", _synthesis_model_name())


def _parse_symbols_json(raw: str) -> list[dict]:
    """JSON dizisini olduğu gibi parse etmeyi dener; OTPM sınırına takılıp
    yarıda kesilen bir yanıtta (dizi kapanmadan biten) tam sayılabilecek
    {...} nesnelerini tek tek kurtarıp geri kalanı atar — az sembolle devam
    etmek, extraction'ın tamamen başarısız olmasından iyidir."""
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    decoder = json.JSONDecoder()
    items = []
    idx = raw.find("{")
    while idx != -1:
        try:
            obj, end = decoder.raw_decode(raw, idx)
        except json.JSONDecodeError:
            break
        items.append(obj)
        idx = raw.find("{", end)
    if not items:
        raise RuntimeError("Groq'tan gelen yanıt geçerli JSON değildi, tekrar dene.")
    return items


def _strip_json_fence(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text.rsplit("```", 1)[0]
        if text.lower().startswith("json"):
            text = text[4:]
    return text.strip()


def extract_symbols(dream_text: str) -> list[dict]:
    client = _get_client()
    prompt = EXTRACT_PROMPT.replace("{dream_text}", dream_text)
    try:
        response = client.chat.completions.create(
            model=_extract_model_name(),
            messages=[{"role": "user", "content": prompt}],
            # Groq'un ücretsiz katmanı dakikada 1000 çıktı-token (OTPM) ile
            # sınırlı — synthesize_interpretation'daki 990 ile aynı sınırın
            # altında kalınıyor. Çok imgeli bir rüyada JSON bu sınıra takılıp
            # kesilebilir; o durumda extract_symbols kesik JSON'u parse
            # edemeyip anlaşılır bir hata fırlatır.
            max_tokens=990,
            temperature=0.3,
            # Sentezdeki gibi: gizli <think> bloğu hem dakikalık çıktı
            # limitini boşuna tüketir hem de JSON'dan önce gereksiz metin ekler.
            reasoning_effort="none",
        )
    except Exception as exc:  # Groq SDK'sının kendi hata sınıfları burada yakalanır.
        message = str(exc)
        if "rate_limit" in message.lower() or "429" in message:
            raise RuntimeError(
                "Groq günlük/dakikalık kullanım kotan doldu. Birkaç dakika "
                "sonra tekrar dene ya da .env dosyasındaki GROQ_EXTRACT_MODEL "
                "değerini değiştir."
            ) from exc
        raise RuntimeError(f"Groq isteği başarısız: {message}") from exc

    choice = response.choices[0] if response.choices else None
    if not choice or not choice.message or not choice.message.content:
        finish_reason = choice.finish_reason if choice else "bilinmiyor"
        raise RuntimeError(
            f"Groq boş yanıt döndürdü (sebep: {finish_reason}). Genellikle geçici "
            "bir durumdur, tekrar dene."
        )

    raw = _strip_json_fence(choice.message.content)
    data = _parse_symbols_json(raw)

    symbols = []
    for item in data:
        name = str(item.get("name", "")).strip()
        context = str(item.get("context", "")).strip()
        name_en = str(item.get("name_en", "")).strip()
        if name:
            symbols.append({"name": name, "name_en": name_en, "context": context})
    return symbols


def synthesize_interpretation(payload: dict) -> str:
    client = _get_client()
    prompt = SYNTHESIS_PROMPT.replace(
        "{payload_json}", json.dumps(payload, ensure_ascii=False, indent=2)
    )
    try:
        response = client.chat.completions.create(
            model=_synthesis_model_name(),
            messages=[{"role": "user", "content": prompt}],
            # Ücretsiz katmanda bu model dakikada 1000 çıktı-token ile
            # sınırlı — tam (~700 kelime + ritüel kapanışı) bir yorum bunu
            # nadiren aşıp son cümlede kesilebiliyor. SYNTHESIS_PROMPT'un
            # ritüel/kapanış bölümü yakında kısalacağı için şimdilik
            # düzeltilmedi, prompt kısalınca kendiliğinden çözülmesi
            # bekleniyor.
            max_tokens=990,
            temperature=0.7,
            # qwen3.6-27b bir "reasoning" modeli — varsayılanda yanıttan önce
            # gizli bir <think> bloğu üretiyor ve bu, ücretsiz katmanın dar
            # dakikalık çıktı-token limitini (OTPM) tek başına tüketebiliyor.
            # SYNTHESIS_PROMPT zaten kendi adım adım muhakemesini metne
            # döküyor, ayrı bir gizli düşünme aşamasına ihtiyaç yok.
            reasoning_effort="none",
        )
    except Exception as exc:  # Groq SDK'sının kendi hata sınıfları burada yakalanır.
        message = str(exc)
        if "rate_limit" in message.lower() or "429" in message:
            raise RuntimeError(
                "Groq günlük/dakikalık kullanım kotan doldu. Birkaç dakika "
                "sonra tekrar dene ya da .env dosyasındaki GROQ_SYNTHESIS_MODEL "
                "değerini değiştir."
            ) from exc
        raise RuntimeError(f"Groq isteği başarısız: {message}") from exc

    choice = response.choices[0] if response.choices else None
    if not choice or not choice.message or not choice.message.content:
        finish_reason = choice.finish_reason if choice else "bilinmiyor"
        raise RuntimeError(
            f"Groq boş yanıt döndürdü (sebep: {finish_reason}). Genellikle geçici "
            "bir durumdur, tekrar dene."
        )
    return choice.message.content.strip()


def amplify_symbol(name: str, name_en: str, context: str) -> str:
    client = _get_client()
    prompt = (
        AMPLIFY_PROMPT.replace("{symbol_name}", name)
        .replace("{symbol_name_en}", name_en or name)
        .replace("{symbol_context}", context or "—")
    )
    try:
        response = client.chat.completions.create(
            model=_extract_model_name(),
            messages=[{"role": "user", "content": prompt}],
            max_tokens=512,
            temperature=0.7,
            reasoning_effort="none",
        )
    except Exception as exc:  # Groq SDK'sının kendi hata sınıfları burada yakalanır.
        message = str(exc)
        if "rate_limit" in message.lower() or "429" in message:
            raise RuntimeError(
                "Groq günlük/dakikalık kullanım kotan doldu. Birkaç dakika "
                "sonra tekrar dene."
            ) from exc
        raise RuntimeError(f"Groq isteği başarısız: {message}") from exc

    choice = response.choices[0] if response.choices else None
    if not choice or not choice.message or not choice.message.content:
        finish_reason = choice.finish_reason if choice else "bilinmiyor"
        raise RuntimeError(
            f"Groq boş yanıt döndürdü (sebep: {finish_reason}). Genellikle geçici "
            "bir durumdur, tekrar dene."
        )
    return choice.message.content.strip()
