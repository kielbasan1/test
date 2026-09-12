#!/usr/bin/env python3
"""PATCH /api/dreams/<fname> ile rezonans geri bildirimi (resonance/resonance_note)
için testler.

Flask'ın kendi test_client()'ı kullanılır, pytest gerekmez — scripts/test_dream_rename.py
ile aynı desen. Bu PATCH endpoint'i artık hem title hem resonance alanlarını
kısmi güncelleme (payload'da olan alan neyse sadece o) ile destekliyor; testlerin
odağı bu kısmi güncellemenin birbirine karışmaması.

Kullanım (proje kökünden):
    python scripts/test_dream_resonance.py
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


def test_patch_sets_resonance():
    with tempfile.TemporaryDirectory() as tmp:
        client, fname = _client_with_dream(tmp, {"dream_text": "test", "symbols": []})
        res = client.patch(f"/api/dreams/{fname}", json={"resonance": "fit"})
        assert res.status_code == 200, res.get_data(as_text=True)
        assert res.get_json()["resonance"] == "fit"
        saved = json.loads((Path(tmp) / fname).read_text(encoding="utf-8"))
        assert saved["resonance"] == "fit"


def test_patch_sets_resonance_note():
    with tempfile.TemporaryDirectory() as tmp:
        client, fname = _client_with_dream(tmp, {"dream_text": "test", "symbols": []})
        client.patch(f"/api/dreams/{fname}", json={"resonance": "partial", "resonance_note": "yarım oturdu"})
        saved = json.loads((Path(tmp) / fname).read_text(encoding="utf-8"))
        assert saved["resonance"] == "partial"
        assert saved["resonance_note"] == "yarım oturdu"


def test_patch_rejects_invalid_resonance_value():
    with tempfile.TemporaryDirectory() as tmp:
        client, fname = _client_with_dream(tmp, {"dream_text": "test", "symbols": []})
        res = client.patch(f"/api/dreams/{fname}", json={"resonance": "asdf"})
        assert res.status_code == 400


def test_patch_resonance_only_does_not_erase_existing_title():
    with tempfile.TemporaryDirectory() as tmp:
        client, fname = _client_with_dream(
            tmp, {"dream_text": "test", "symbols": [], "title": "Var olan başlık"}
        )
        client.patch(f"/api/dreams/{fname}", json={"resonance": "miss"})
        saved = json.loads((Path(tmp) / fname).read_text(encoding="utf-8"))
        assert saved["title"] == "Var olan başlık"
        assert saved["resonance"] == "miss"


def test_patch_title_only_does_not_touch_existing_resonance():
    with tempfile.TemporaryDirectory() as tmp:
        client, fname = _client_with_dream(
            tmp, {"dream_text": "test", "symbols": [], "resonance": "fit", "resonance_note": "not"}
        )
        client.patch(f"/api/dreams/{fname}", json={"title": "Yeni başlık"})
        saved = json.loads((Path(tmp) / fname).read_text(encoding="utf-8"))
        assert saved["title"] == "Yeni başlık"
        assert saved["resonance"] == "fit"
        assert saved["resonance_note"] == "not"


def test_patch_missing_file_is_404_for_resonance_too():
    with tempfile.TemporaryDirectory() as tmp:
        app_module.DREAMS_DIR = tmp
        client = app_module.app.test_client()
        res = client.patch("/api/dreams/does-not-exist.json", json={"resonance": "fit"})
        assert res.status_code == 404


def main() -> None:
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        t()
        print(f"OK: {t.__name__}")
    print(f"\n{len(tests)} test gecti.")


if __name__ == "__main__":
    main()
