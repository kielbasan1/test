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
            ".env dosyasındaki GEMINI_MODEL değerini değiştirip farklı bir "
            "modelle devam edebilirsin."
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


@app.route("/api/synthesize", methods=["POST"])
def synthesize():
    payload = request.get_json(force=True) or {}
    if not payload.get("dream_text") or not payload.get("symbols"):
        return jsonify({"error": "Eksik veri: rüya metni ve semboller gerekli."}), 400
    try:
        interpretation = gemini_client.synthesize_interpretation(payload)
    except Exception as exc:  # noqa: BLE001
        return jsonify({"error": _friendly_error(exc)}), 500
    return jsonify({"interpretation": interpretation})


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
            }
        )
    return jsonify({"dreams": dreams})


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
