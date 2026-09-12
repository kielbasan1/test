#!/usr/bin/env python3
"""PATCH /api/dreams/<fname> (rüya başlığı değiştirme) için testler.

Flask'ın kendi test_client()'ı kullanılır, pytest gerekmez. Gerçek
ruyalar/ klasörüne dokunmamak için her test kendi geçici klasörünü
app.DREAMS_DIR'e atayıp kullanır.

Kullanım (proje kökünden):
    python scripts/test_dream_rename.py
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


def test_patch_updates_title_on_disk_and_response():
    with tempfile.TemporaryDirectory() as tmp:
        client, fname = _client_with_dream(tmp, {"dream_text": "test", "symbols": []})
        res = client.patch(f"/api/dreams/{fname}", json={"title": "Yeni Başlık"})
        assert res.status_code == 200, res.get_data(as_text=True)
        assert res.get_json()["title"] == "Yeni Başlık"
        saved = json.loads((Path(tmp) / fname).read_text(encoding="utf-8"))
        assert saved["title"] == "Yeni Başlık"


def test_patch_missing_file_is_404():
    with tempfile.TemporaryDirectory() as tmp:
        app_module.DREAMS_DIR = tmp
        client = app_module.app.test_client()
        res = client.patch("/api/dreams/does-not-exist.json", json={"title": "x"})
        assert res.status_code == 404


def test_patch_trims_whitespace():
    with tempfile.TemporaryDirectory() as tmp:
        client, fname = _client_with_dream(tmp, {"dream_text": "test", "symbols": []})
        client.patch(f"/api/dreams/{fname}", json={"title": "  boşluklu  "})
        saved = json.loads((Path(tmp) / fname).read_text(encoding="utf-8"))
        assert saved["title"] == "boşluklu"


def test_list_dreams_includes_title():
    with tempfile.TemporaryDirectory() as tmp:
        client, _ = _client_with_dream(tmp, {"dream_text": "test", "symbols": [], "title": "Var olan"})
        data = client.get("/api/dreams").get_json()
        assert data["dreams"][0]["title"] == "Var olan"


def test_list_dreams_title_defaults_to_empty_string():
    with tempfile.TemporaryDirectory() as tmp:
        client, _ = _client_with_dream(tmp, {"dream_text": "test", "symbols": []})
        data = client.get("/api/dreams").get_json()
        assert data["dreams"][0]["title"] == ""


def main() -> None:
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        t()
        print(f"OK: {t.__name__}")
    print(f"\n{len(tests)} test gecti.")


if __name__ == "__main__":
    main()
