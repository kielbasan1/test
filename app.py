import json
import os
import re
import uuid
from datetime import datetime, timedelta

from dotenv import load_dotenv
from flask import (
    Flask,
    jsonify,
    redirect,
    render_template,
    request,
    session,
    url_for,
)

load_dotenv(override=True)

from services import gemini_client  # noqa: E402

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "").strip() or os.urandom(24)
app.permanent_session_lifetime = timedelta(days=30)

APP_PASSWORD = os.environ.get("APP_PASSWORD", "").strip()

DREAMS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ruyalar")
os.makedirs(DREAMS_DIR, exist_ok=True)


@app.before_request
def _require_login():
    # APP_PASSWORD tanımlı değilse (örn. sadece kendi bilgisayarında, .env'de
    # şifre girmeden çalıştırıyorsan) giriş ekranını tamamen devre dışı bırak.
    if not APP_PASSWORD:
        return None
    if request.path == "/login" or request.path.startswith("/static/"):
        return None
    if session.get("authed"):
        return None
    return redirect(url_for("login"))


@app.route("/login", methods=["GET", "POST"])
def login():
    error = None
    if request.method == "POST":
        if request.form.get("password", "") == APP_PASSWORD:
            session.permanent = True
            session["authed"] = True
            return redirect(url_for("index"))
        error = "Yanlış şifre."
    return render_template("login.html", error=error)


@app.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return redirect(url_for("login"))


def _friendly_error(exc: Exception) -> str:
    """Gemini'den gelen ham JSON hata bloklarını kullanıcının anlayacağı kısa
    bir Türkçe mesaja çevirir; tanımadığımız hatalarda orijinal mesajı olduğu
    gibi döndürür."""
    text = str(exc)
    if "RESOURCE_EXHAUSTED" in text or "429" in text:
        return (
            "Günlük Gemini kullanım kotan doldu. Yarın tekrar deneyebilir ya da "
            ".env dosyasındaki GEMINI_MODEL / GEMINI_SYNTHESIS_MODEL değerlerini "
            "değiştirip farklı bir modelle devam edebilirsin."
        )
    if "UNAVAILABLE" in text or "503" in text:
        return "Gemini şu anda yoğun, birkaç saniye sonra tekrar dene."
    if "API_KEY_INVALID" in text or "API key not valid" in text:
        return "Gemini API anahtarı geçersiz görünüyor, .env dosyasını kontrol et."
    return text


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/extract-symbols", methods=["POST"])
def extract_symbols():
    data = request.get_json(force=True)
    dream_text = (data or {}).get("dream_text", "").strip()
    if not dream_text:
        return jsonify({"error": "Rüya metni boş olamaz."}), 400
    try:
        symbols = gemini_client.extract_symbols(dream_text)
    except Exception as exc:  # noqa: BLE001
        return jsonify({"error": _friendly_error(exc)}), 500
    return jsonify({"symbols": symbols})


@app.route("/api/expand-interpretation", methods=["POST"])
def expand_interpretation():
    # Kullanıcının kendi yorumu zorunlu girdi: bu adım sıfırdan yorum üretmez,
    # yazılmış bir yorumun kör noktalarına bakar. Yorum yoksa istek anlamsız —
    # arayüz de butonu o yüzden kilitli tutuyor, bu sunucu tarafı yedeği.
    payload = request.get_json(force=True) or {}
    if not payload.get("dream_text") or not payload.get("symbols"):
        return jsonify({"error": "Eksik veri: rüya metni ve semboller gerekli."}), 400
    if not (payload.get("my_interpretation") or "").strip():
        return jsonify({"error": "Önce kendi yorumunu yazman gerekiyor."}), 400
    try:
        interpretation = gemini_client.expand_interpretation(payload)
    except Exception as exc:  # noqa: BLE001
        return jsonify({"error": _friendly_error(exc)}), 500
    return jsonify({"interpretation": interpretation})


@app.route("/api/amplify-symbol", methods=["POST"])
def amplify_symbol():
    data = request.get_json(force=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Sembol adı boş olamaz."}), 400
    try:
        amplification = gemini_client.amplify_symbol(
            name, (data.get("name_en") or "").strip(), (data.get("context") or "").strip()
        )
    except Exception as exc:  # noqa: BLE001
        return jsonify({"error": _friendly_error(exc)}), 500
    return jsonify({"amplification": amplification})


@app.route("/api/save-dream", methods=["POST"])
def save_dream():
    payload = request.get_json(force=True) or {}
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    slug = re.sub(r"[^a-zA-Z0-9_-]+", "", str(uuid.uuid4())[:8])
    filename = f"{timestamp}_{slug}.json"
    path = os.path.join(DREAMS_DIR, filename)
    record = {"saved_at": datetime.now().isoformat(), **payload}
    with open(path, "w", encoding="utf-8") as f:
        json.dump(record, f, ensure_ascii=False, indent=2)
    return jsonify({"saved_as": filename})


def dream_completion_pct(record: dict) -> int:
    """Bir rüyanın çalışılma yüzdesi.

    Bir sembol "tam" sayılır: q1-q4 sorularının hepsi doluysa VE bir
    çağrışım seçilmişse. Yüzde = tam sembol sayısı / toplam sembol sayısı.
    """
    symbols = record.get("symbols") or []
    if not symbols:
        return 0
    complete = 0
    for sym in symbols:
        questions = sym.get("questions") or {}
        answered = all((questions.get(f"q{i}") or "").strip() for i in range(1, 5))
        has_association = bool((sym.get("selected_association") or "").strip())
        if answered and has_association:
            complete += 1
    return round(complete / len(symbols) * 100)


def recurring_symbols(records: list) -> list:
    """Birden fazla rüyada tekrar eden sembolleri gruplar.

    Eşleştirme `name_en` üzerinden (küçük harf + boşluk kırpma ile
    normalize edilmiş) yapılır, çünkü aynı sembolün Türkçe adı oturumdan
    oturuma farklı yazılmış olabilir. Sadece 2+ rüyada geçen semboller
    döner, en çok tekrar edenden aza sıralı.
    """
    groups: dict = {}
    for record in records:
        seen_in_this_dream = set()
        for sym in record.get("symbols") or []:
            key = (sym.get("name_en") or "").strip().lower()
            if not key or key in seen_in_this_dream:
                continue
            seen_in_this_dream.add(key)
            group = groups.setdefault(
                key, {"name_en": key, "name": sym.get("name") or key, "occurrences": []}
            )
            group["occurrences"].append(
                {
                    "file": record.get("file"),
                    "title": record.get("title") or "",
                    "saved_at": record.get("saved_at"),
                    "selected_association": sym.get("selected_association") or "",
                }
            )
    result = [g for g in groups.values() if len(g["occurrences"]) >= 2]
    for g in result:
        g["count"] = len(g["occurrences"])
    result.sort(key=lambda g: g["count"], reverse=True)
    return result


@app.route("/api/dreams/recurring-symbols", methods=["GET"])
def get_recurring_symbols():
    files = sorted(os.listdir(DREAMS_DIR), reverse=True)
    records = []
    for fname in files:
        if not fname.endswith(".json"):
            continue
        with open(os.path.join(DREAMS_DIR, fname), encoding="utf-8") as f:
            record = json.load(f)
        record["file"] = fname
        records.append(record)
    return jsonify({"symbols": recurring_symbols(records)})


@app.route("/api/dreams", methods=["GET"])
def list_dreams():
    files = sorted(os.listdir(DREAMS_DIR), reverse=True)
    dreams = []
    for fname in files:
        if not fname.endswith(".json"):
            continue
        with open(os.path.join(DREAMS_DIR, fname), encoding="utf-8") as f:
            record = json.load(f)
        dreams.append(
            {
                "file": fname,
                "saved_at": record.get("saved_at"),
                "dream_text": record.get("dream_text", "")[:120],
                "symbol_count": len(record.get("symbols") or []),
                "completion_pct": dream_completion_pct(record),
                "title": record.get("title", ""),
                "dream_attitude": record.get("dream_attitude", ""),
                "dream_emotion": record.get("dream_emotion", ""),
                "dream_arc": record.get("dream_arc", ""),
                "has_ritual": bool((record.get("ritual_text") or "").strip()),
                "ritual_done": bool(record.get("ritual_done", False)),
            }
        )
    return jsonify({"dreams": dreams})


RESONANCE_VALUES = {"", "fit", "partial", "miss"}


@app.route("/api/dreams/<fname>", methods=["PATCH"])
def patch_dream(fname):
    """Kaydedilmiş bir rüyanın başlığını, rezonans geri bildirimini (Faz 1.3)
    ve/veya ritüel alanlarını (ritual_text/ritual_done — Johnson'ın 4. adımı)
    kısmi olarak günceller. Sadece payload'da GEÇEN alan güncellenir — biri
    diğerini sessizce silmesin diye (örn. sadece resonance gönderince title
    boşa düşmemeli). ritual_done kütüphaneden HER ZAMAN değiştirilebilir
    (resonance'ın aksine) — ritüel günler sonra yapılabilir.
    """
    safe_name = os.path.basename(fname)
    path = os.path.join(DREAMS_DIR, safe_name)
    if not os.path.isfile(path):
        return jsonify({"error": "Kayıt bulunamadı."}), 404
    payload = request.get_json(force=True) or {}

    if "resonance" in payload and str(payload.get("resonance") or "").strip() not in RESONANCE_VALUES:
        return jsonify({"error": "Geçersiz rezonans değeri."}), 400

    with open(path, encoding="utf-8") as f:
        record = json.load(f)

    response = {"file": safe_name}
    if "title" in payload:
        record["title"] = str(payload.get("title", "")).strip()
        response["title"] = record["title"]
    if "resonance" in payload:
        record["resonance"] = str(payload.get("resonance") or "").strip()
        response["resonance"] = record["resonance"]
    if "resonance_note" in payload:
        record["resonance_note"] = str(payload.get("resonance_note", "")).strip()
        response["resonance_note"] = record["resonance_note"]
    if "ritual_text" in payload:
        record["ritual_text"] = str(payload.get("ritual_text", "")).strip()
        response["ritual_text"] = record["ritual_text"]
    if "ritual_done" in payload:
        record["ritual_done"] = bool(payload.get("ritual_done"))
        response["ritual_done"] = record["ritual_done"]

    with open(path, "w", encoding="utf-8") as f:
        json.dump(record, f, ensure_ascii=False, indent=2)
    return jsonify(response)


@app.route("/api/dreams/<fname>", methods=["DELETE"])
def delete_dream(fname):
    safe_name = os.path.basename(fname)
    path = os.path.join(DREAMS_DIR, safe_name)
    if not os.path.isfile(path):
        return jsonify({"error": "Kayıt bulunamadı."}), 404
    os.remove(path)
    return jsonify({"file": safe_name})


@app.route("/api/dreams", methods=["DELETE"])
def delete_all_dreams():
    deleted = 0
    for fname in os.listdir(DREAMS_DIR):
        if not fname.endswith(".json"):
            continue
        os.remove(os.path.join(DREAMS_DIR, fname))
        deleted += 1
    return jsonify({"deleted": deleted})


@app.route("/api/dreams/<fname>", methods=["GET"])
def get_dream(fname):
    safe_name = os.path.basename(fname)
    path = os.path.join(DREAMS_DIR, safe_name)
    if not os.path.isfile(path):
        return jsonify({"error": "Kayıt bulunamadı."}), 404
    with open(path, encoding="utf-8") as f:
        record = json.load(f)
    return jsonify(record)


if __name__ == "__main__":
    app.run(debug=True, port=5000)
