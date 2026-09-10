#!/usr/bin/env python3
"""Gemini free-tier kotasinin gercekte ne oldugunu olcer.

Kaan AI Studio dashboard'unda "gemini 3.5 flash lite: 28/500" gordu.
2026-09-10'daki onceki bulgu ise bu anahtarda flash/flash-lite/2.5-flash-lite'in
ucunun de aynı 20/gun paylasimli kovaya dustugunu soyluyordu (Threads.md).
Bu script SYNTHESIS_PROVIDER'i gecici olarak (sadece bu process icinde,
.env'e dokunmadan) gemini'ye zorlayip extract_symbols ve expand_interpretation'i
art arda cagirip kacinci istekte (varsa) 429/RESOURCE_EXHAUSTED aldigini sayar.

Kisisel/gercek ruya verisi (test_ruya.json) kullanmiyor - sadece sayim
yaptigimiz icin sentetik ornek (test_ruya.example.json) yeterli ve daha
az veri paylasimi anlamina geliyor.

Kullanim: python scripts/test_gemini_quota.py
"""
import json
import os
import sys
import time
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from dotenv import load_dotenv  # noqa: E402

load_dotenv(PROJECT_ROOT / ".env", override=True)
os.environ["SYNTHESIS_PROVIDER"] = "gemini"  # bu process icinde gecici, .env degismiyor

from services import gemini_client  # noqa: E402

EXAMPLE = Path(__file__).resolve().parent / "test_ruya.example.json"
MAX_CALLS = 25


def is_quota_error(e: Exception) -> bool:
    s = str(e)
    return "429" in s or "RESOURCE_EXHAUSTED" in s or "quota" in s.lower()


def run(label, fn, model_name):
    print(f"\n=== {label} ({model_name}) ===")
    ok = 0
    other_errors = 0
    for i in range(1, MAX_CALLS + 1):
        try:
            t0 = time.time()
            fn()
            dt = time.time() - t0
            ok += 1
            print(f"  istek {i}: OK ({dt:.1f}s)")
        except Exception as e:
            if is_quota_error(e):
                print(f"  istek {i}: KOTA HATASI -> {type(e).__name__}: {str(e)[:200]}")
                print(f"  SONUC: {ok} basarili istekten sonra KOTA HATASI alindi.")
                return ok, other_errors, str(e)
            other_errors += 1
            print(f"  istek {i}: kota-disi hata (atlaniyor) -> {type(e).__name__}: {str(e)[:150]}")
            time.sleep(2)  # 503/gecici hatalarda sunucuya nefes payi
    print(f"  SONUC: {MAX_CALLS} denemenin {ok}'i basarili, kota siniri gorulmedi ({other_errors} kota-disi hata).")
    return ok, other_errors, None


def main():
    payload = json.loads(EXAMPLE.read_text(encoding="utf-8"))
    dream_text = payload["dream_text"]

    extract_ok, extract_other, extract_err = run(
        "extract_symbols (GEMINI_MODEL / flash-lite)",
        lambda: gemini_client.extract_symbols(dream_text),
        gemini_client._extract_model_name(),
    )

    synth_ok, synth_other, synth_err = run(
        "expand_interpretation (GEMINI_SYNTHESIS_MODEL / flash)",
        lambda: gemini_client.expand_interpretation(payload),
        gemini_client._expand_model_name(),
    )

    print("\n=== OZET ===")
    print(f"extract_symbols: {extract_ok} basarili, {extract_other} kota-disi hata" + (f", KOTA HATASI: {extract_err[:150]}" if extract_err else " -- kota siniri gorulmedi"))
    print(f"expand_interpretation: {synth_ok} basarili, {synth_other} kota-disi hata" + (f", KOTA HATASI: {synth_err[:150]}" if synth_err else " -- kota siniri gorulmedi"))


if __name__ == "__main__":
    main()
