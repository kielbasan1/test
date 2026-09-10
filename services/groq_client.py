import json
import os

from groq import Groq

from services.gemini_client import AMPLIFY_PROMPT, EXPAND_PROMPT

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


def _expand_model_name() -> str:
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
    # riskini almamak için genişletmeyle aynı qwen3.6-27b kullanılıyor, ayrı
    # ayarlanabilsin diye kendi env değişkeni var.
    return os.environ.get("GROQ_EXTRACT_MODEL", _expand_model_name())


def expand_interpretation(payload: dict) -> str:
    client = _get_client()
    prompt = EXPAND_PROMPT.replace(
        "{payload_json}", json.dumps(payload, ensure_ascii=False, indent=2)
    )
    try:
        response = client.chat.completions.create(
            model=_expand_model_name(),
            messages=[{"role": "user", "content": prompt}],
            # Ücretsiz katmanda bu model dakikada 1000 çıktı-token ile sınırlı.
            # Eski sentez adımı (~700 kelime + ritüel kapanışı) bu sınırda son
            # cümlede kesilebiliyordu; kör nokta çıktısı 200-350 kelime olduğu
            # için artık rahatlıkla altında kalıyor.
            max_tokens=990,
            temperature=0.7,
            # qwen3.6-27b bir "reasoning" modeli — varsayılanda yanıttan önce
            # gizli bir <think> bloğu üretiyor ve bu, ücretsiz katmanın dar
            # dakikalık çıktı-token limitini (OTPM) tek başına tüketebiliyor.
            # EXPAND_PROMPT zaten nereye bakılacağını adım adım söylüyor,
            # ayrı bir gizli düşünme aşamasına ihtiyaç yok.
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
