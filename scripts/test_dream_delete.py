#!/usr/bin/env python3
"""DELETE /api/dreams/<fname> (tekli) ve DELETE /api/dreams (hepsi) için testler.

Flask'ın kendi test_client()'ı kullanılır, pytest gerekmez — projedeki
scripts/test_dream_rename.py deseninin aynısı. Gerçek ruyalar/ klasörüne
dokunmamak için her test kendi geçici klasörünü app.DREAMS_DIR'e atar.

Kullanım (proje kökünden):
    python scripts/test_dream_delete.py
"""
import json
import sys
import tempfile
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import app as app_module  # noqa: E402

app_module.APP_PASSWORD = ""  # testte giriş ekranını devre dışı bırak


def _write_dream(tmpdir, fname, record=None):
    (Path(tmpdir) / fname).write_text(
        json.dumps(record or {"dream_text": "test", "symbols": []}, ensure_ascii=False),
        encoding="utf-8",
    )


def test_delete_removes_file_and_returns_200():
    with tempfile.TemporaryDirectory() as tmp:
        app_module.DREAMS_DIR = tmp
        _write_dream(tmp, "20260101_000000_aaaa0001.json")
        client = app_module.app.test_client()
        res = client.delete("/api/dreams/20260101_000000_aaaa0001.json")
        assert res.status_code == 200, res.get_data(as_text=True)
        assert not (Path(tmp) / "20260101_000000_aaaa0001.json").exists()


def test_delete_missing_file_is_404():
    with tempfile.TemporaryDirectory() as tmp:
        app_module.DREAMS_DIR = tmp
        client = app_module.app.test_client()
        res = client.delete("/api/dreams/does-not-exist.json")
        assert res.status_code == 404


def test_delete_does_not_touch_other_files():
    with tempfile.TemporaryDirectory() as tmp:
        app_module.DREAMS_DIR = tmp
        _write_dream(tmp, "20260101_000000_aaaa0001.json")
        _write_dream(tmp, "20260102_000000_bbbb0002.json")
        client = app_module.app.test_client()
        client.delete("/api/dreams/20260101_000000_aaaa0001.json")
        assert not (Path(tmp) / "20260101_000000_aaaa0001.json").exists()
        assert (Path(tmp) / "20260102_000000_bbbb0002.json").exists()


def test_delete_all_removes_every_file_and_returns_count():
    with tempfile.TemporaryDirectory() as tmp:
        app_module.DREAMS_DIR = tmp
        _write_dream(tmp, "20260101_000000_aaaa0001.json")
        _write_dream(tmp, "20260102_000000_bbbb0002.json")
        _write_dream(tmp, "20260103_000000_cccc0003.json")
        client = app_module.app.test_client()
        res = client.delete("/api/dreams")
        assert res.status_code == 200, res.get_data(as_text=True)
        assert res.get_json()["deleted"] == 3
        assert list(Path(tmp).glob("*.json")) == []


def test_delete_all_on_empty_dir_returns_zero():
    with tempfile.TemporaryDirectory() as tmp:
        app_module.DREAMS_DIR = tmp
        client = app_module.app.test_client()
        res = client.delete("/api/dreams")
        assert res.status_code == 200
        assert res.get_json()["deleted"] == 0


def test_delete_all_ignores_non_json_files():
    with tempfile.TemporaryDirectory() as tmp:
        app_module.DREAMS_DIR = tmp
        _write_dream(tmp, "20260101_000000_aaaa0001.json")
        (Path(tmp) / "readme.txt").write_text("not a dream", encoding="utf-8")
        client = app_module.app.test_client()
        res = client.delete("/api/dreams")
        assert res.get_json()["deleted"] == 1
        assert (Path(tmp) / "readme.txt").exists()


def main() -> None:
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        t()
        print(f"OK: {t.__name__}")
    print(f"\n{len(tests)} test gecti.")


if __name__ == "__main__":
    main()
