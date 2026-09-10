#!/usr/bin/env python3
"""EXPAND_PROMPT'u ("yorumu genişlet" / kör nokta adımı) sabit bir test
rüyasıyla çalıştırır.

Rüyayı, çağrışımları ve kendi yorumunu her seferinde elle yeniden yazmadan,
prompt/model değişikliklerini hızlı test etmek için. `scripts/test_ruya.json`'daki
veriyi okuyup doğrudan gemini_client.expand_interpretation()'ı çağırır — Flask
sunucusu, giriş ekranı ya da tarayıcı gerekmez.

Fixture'da `my_interpretation` alanı ZORUNLU: bu adım sıfırdan yorum üretmez,
kullanıcının kendi yorumundaki kör noktalara bakar.

`test_ruya.json` gerçek/kişisel rüya verisi içerebileceği için .gitignore'da
ve asla commit edilmez. Elinde yoksa `scripts/test_ruya.example.json`'u aynı
isme kopyala (sentetik, paylaşıma uygun bir örnek).

Kullanım (proje kökünden):
    python scripts/test_expand.py
"""
import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Windows konsolu (cp1254) proje yolundaki emoji/Türkçe karakterlerde çöküyor;
# konsol çıktısını UTF-8'e zorla (dosya yazımı zaten ayrıca UTF-8).
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from dotenv import load_dotenv  # noqa: E402

load_dotenv(PROJECT_ROOT / ".env", override=True)

from services import gemini_client  # noqa: E402

FIXTURE = Path(__file__).resolve().parent / "test_ruya.json"
OUTPUT = Path(__file__).resolve().parent / "test_output.txt"


def main() -> None:
    if not FIXTURE.exists():
        example = FIXTURE.with_name("test_ruya.example.json")
        print(f"{FIXTURE} yok. Örnek için: cp {example} {FIXTURE}")
        return
    # Windows konsolu (cp1254) Türkçe karakterleri sessizce bozuyor (print/redirect
    # ile bile) — sonucu doğrudan UTF-8 dosyaya yazıp konsola sadece ASCII bir
    # onay basıyoruz, gerçek metni Read/editör ile oku.
    payload = json.loads(FIXTURE.read_text(encoding="utf-8"))
    if not (payload.get("my_interpretation") or "").strip():
        print(f"{FIXTURE} icinde 'my_interpretation' alani yok — bu adim kendi")
        print("yorumun uzerinde calisir, once o alani doldur.")
        return
    model = gemini_client._expand_model_name()
    interpretation = gemini_client.expand_interpretation(payload)
    OUTPUT.write_text(interpretation, encoding="utf-8")
    print(f"model: {model}")
    print(f"kelime sayisi: {len(interpretation.split())}")
    print(f"yazildi: {OUTPUT}")


if __name__ == "__main__":
    main()
