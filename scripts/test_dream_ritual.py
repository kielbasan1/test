#!/usr/bin/env python3
"""PATCH /api/dreams/<fname> ile ritüel (ritual_text/ritual_done) alanları ve
GET /api/dreams'in bunları kütüphane özetine (has_ritual/ritual_done) yansıtması
için testler.

Flask'ın kendi test_client()'ı kullanılır, pytest gerekmez — scripts/test_dream_resonance.py
ile aynı desen. Ritüel, rezonanstan farklı olarak kütüphaneden HER ZAMAN
işaretlenebilir olmalı (ritüel günler sonra yapılabilir) — bu dosya sadece
kısmi güncellemenin doğruluğunu test eder, "ne zaman gösterilir" arayüz
kararı frontend'de.

Kullanım (proje kökünden):
    python scripts/test_dream_ritual.py
"""
import json
import sys
import tempfile
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import app as app_module  # noqa: E402

app_module.APP_PASSWORD = ""  # testte giriş ekranını devre dışı bırak


def _client_with_dream(tmpdir, record):
    app_module.DREAMS_DIR = tmpdir
    fname = "20260101_000000_test0001.json"
    (Path(tmpdir) / fname).write_text(json.dumps(record, ensure_ascii=False), encoding="utf-8")
    return app_module.app.test_client(), fname


def test_patch_sets_ritual_text():
    with tempfile.TemporaryDirectory() as tmp:
        client, fname = _client_with_dream(tmp, {"dream_text": "test", "symbols": []})
        res = client.patch(f"/api/dreams/{fname}", json={"ritual_text": "bir mum yakacağım"})
        assert res.status_code == 200, res.get_data(as_text=True)
        assert res.get_json()["ritual_text"] == "bir mum yakacağım"
        saved = json.loads((Path(tmp) / fname).read_text(encoding="utf-8"))
        assert saved["ritual_text"] == "bir mum yakacağım"


def test_patch_sets_ritual_done():
    with tempfile.TemporaryDirectory() as tmp:
        client, fname = _client_with_dream(
            tmp, {"dream_text": "test", "symbols": [], "ritual_text": "bir mum yakacağım"}
        )
        res = client.patch(f"/api/dreams/{fname}", json={"ritual_done": True})
        assert res.status_code == 200, res.get_data(as_text=True)
        assert res.get_json()["ritual_done"] is True
        saved = json.loads((Path(tmp) / fname).read_text(encoding="utf-8"))
        assert saved["ritual_done"] is True


def test_patch_ritual_done_only_does_not_erase_ritual_text():
    with tempfile.TemporaryDirectory() as tmp:
        client, fname = _client_with_dream(
            tmp, {"dream_text": "test", "symbols": [], "ritual_text": "bir mum yakacağım"}
        )
        client.patch(f"/api/dreams/{fname}", json={"ritual_done": True})
        saved = json.loads((Path(tmp) / fname).read_text(encoding="utf-8"))
        assert saved["ritual_text"] == "bir mum yakacağım"
        assert saved["ritual_done"] is True


def test_patch_ritual_text_only_does_not_touch_title_or_resonance():
    with tempfile.TemporaryDirectory() as tmp:
        client, fname = _client_with_dream(
            tmp,
            {
                "dream_text": "test",
                "symbols": [],
                "title": "Var olan başlık",
                "resonance": "fit",
            },
        )
        client.patch(f"/api/dreams/{fname}", json={"ritual_text": "bir mum yakacağım"})
        saved = json.loads((Path(tmp) / fname).read_text(encoding="utf-8"))
        assert saved["title"] == "Var olan başlık"
        assert saved["resonance"] == "fit"
        assert saved["ritual_text"] == "bir mum yakacağım"


def test_patch_ritual_done_coerces_truthy_value_to_bool():
    with tempfile.TemporaryDirectory() as tmp:
        client, fname = _client_with_dream(tmp, {"dream_text": "test", "symbols": []})
        client.patch(f"/api/dreams/{fname}", json={"ritual_done": "evet"})
        saved = json.loads((Path(tmp) / fname).read_text(encoding="utf-8"))
        assert saved["ritual_done"] is True


def test_list_dreams_includes_has_ritual_and_ritual_done():
    with tempfile.TemporaryDirectory() as tmp:
        client, fname = _client_with_dream(
            tmp,
            {
                "dream_text": "test",
                "symbols": [],
                "ritual_text": "bir mum yakacağım",
                "ritual_done": True,
            },
        )
        res = client.get("/api/dreams")
        dream = res.get_json()["dreams"][0]
        assert dream["has_ritual"] is True
        assert dream["ritual_done"] is True


def test_list_dreams_ritual_fields_default_when_missing():
    with tempfile.TemporaryDirectory() as tmp:
        client, fname = _client_with_dream(tmp, {"dream_text": "test", "symbols": []})
        res = client.get("/api/dreams")
        dream = res.get_json()["dreams"][0]
        assert dream["has_ritual"] is False
        assert dream["ritual_done"] is False


def main() -> None:
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        t()
        print(f"OK: {t.__name__}")
    print(f"\n{len(tests)} test gecti.")


if __name__ == "__main__":
    main()
