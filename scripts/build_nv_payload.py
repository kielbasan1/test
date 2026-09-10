#!/usr/bin/env python3
"""EXPAND_PROMPT + test_ruya.json'u NVIDIA NIM chat/completions için bir
istek gövdesine (UTF-8) derler. Kullanım: python scripts/build_nv_payload.py <model> <out.json>
"""
import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from services.gemini_client import EXPAND_PROMPT  # noqa: E402

FIXTURE = Path(__file__).resolve().parent / "test_ruya.json"


def main() -> None:
    model = sys.argv[1]
    out_path = Path(sys.argv[2])
    payload = json.loads(FIXTURE.read_text(encoding="utf-8"))
    prompt = EXPAND_PROMPT.replace(
        "{payload_json}", json.dumps(payload, ensure_ascii=False, indent=2)
    )
    body = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 2048,
        "temperature": 0.6,
    }
    out_path.write_text(json.dumps(body, ensure_ascii=False), encoding="utf-8")
    print(f"wrote {out_path}")


if __name__ == "__main__":
    main()
