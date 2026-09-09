import json
import os

from groq import Groq

from services.gemini_client import SYNTHESIS_PROMPT

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
