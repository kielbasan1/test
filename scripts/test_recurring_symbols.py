#!/usr/bin/env python3
"""recurring_symbols() ve GET /api/dreams/recurring-symbols için testler.

Projede pytest yok; var olan manuel-script deseniyle (scripts/test_dream_completion.py,
scripts/test_dream_rename.py gibi) assert tabanlı, doğrudan çalıştırılabilir bir test dosyası.

Kullanım (proje kökünden):
    python scripts/test_recurring_symbols.py
"""
import json
import sys
import tempfile
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import app as app_module  # noqa: E402
from app import recurring_symbols  # noqa: E402

app_module.APP_PASSWORD = ""  # testte giriş ekranını devre dışı bırak


def _sym(name="kara köpek", name_en="black dog", assoc="sadakat"):
    return {"name": name, "name_en": name_en, "selected_association": assoc}


def _dream(file, symbols, title="", saved_at="2026-01-01T00:00:00"):
    return {"file": file, "title": title, "saved_at": saved_at, "symbols": symbols}


def test_symbol_in_one_dream_is_not_recurring():
    dreams = [_dream("a.json", [_sym()])]
    assert recurring_symbols(dreams) == []


def test_symbol_in_two_dreams_is_recurring():
    dreams = [
        _dream("a.json", [_sym()]),
        _dream("b.json", [_sym()]),
    ]
    result = recurring_symbols(dreams)
    assert len(result) == 1
    assert result[0]["name_en"] == "black dog"
    assert result[0]["count"] == 2


def test_matching_is_by_name_en_case_and_whitespace_insensitive():
    dreams = [
        _dream("a.json", [_sym(name_en="Black Dog")]),
        _dream("b.json", [_sym(name_en="  black dog  ")]),
    ]
    result = recurring_symbols(dreams)
    assert len(result) == 1
    assert result[0]["count"] == 2


def test_duplicate_symbol_within_same_dream_counts_once():
    dreams = [
        _dream("a.json", [_sym(), _sym()]),  # aynı rüyada iki kez
        _dream("b.json", [_sym()]),
    ]
    result = recurring_symbols(dreams)
    assert len(result) == 1
    assert result[0]["count"] == 2


def test_occurrences_include_file_title_and_association():
    dreams = [
        _dream("a.json", [_sym(assoc="ilk çağrışım")], title="İlk rüya"),
        _dream("b.json", [_sym(assoc="ikinci çağrışım")], title="İkinci rüya"),
    ]
    result = recurring_symbols(dreams)
    occurrences = result[0]["occurrences"]
    assert {"a.json", "b.json"} == {o["file"] for o in occurrences}
    assert {"ilk çağrışım", "ikinci çağrışım"} == {o["selected_association"] for o in occurrences}
    titles = {o["title"] for o in occurrences}
    assert titles == {"İlk rüya", "İkinci rüya"}


def test_sorted_by_count_descending():
    dreams = [
        _dream("a.json", [_sym(name_en="black dog"), _sym(name="kilitli kapı", name_en="locked door")]),
        _dream("b.json", [_sym(name_en="black dog")]),
        _dream("c.json", [_sym(name_en="black dog")]),
        _dream("d.json", [_sym(name="kilitli kapı", name_en="locked door")]),
    ]
    result = recurring_symbols(dreams)
    assert [g["name_en"] for g in result] == ["black dog", "locked door"]
    assert [g["count"] for g in result] == [3, 2]


def test_empty_or_missing_name_en_is_ignored():
    dreams = [
        _dream("a.json", [_sym(name_en="")]),
        _dream("b.json", [{"name": "x"}]),
    ]
    assert recurring_symbols(dreams) == []


def test_endpoint_returns_recurring_symbols_from_disk():
    with tempfile.TemporaryDirectory() as tmp:
        app_module.DREAMS_DIR = tmp
        record_a = {"dream_text": "a", "symbols": [_sym()], "title": "A"}
        record_b = {"dream_text": "b", "symbols": [_sym()], "title": "B"}
        (Path(tmp) / "20260101_000000_aaaa0001.json").write_text(
            json.dumps(record_a, ensure_ascii=False), encoding="utf-8"
        )
        (Path(tmp) / "20260102_000000_bbbb0002.json").write_text(
            json.dumps(record_b, ensure_ascii=False), encoding="utf-8"
        )
        client = app_module.app.test_client()
        res = client.get("/api/dreams/recurring-symbols")
        assert res.status_code == 200, res.get_data(as_text=True)
        data = res.get_json()["symbols"]
        assert len(data) == 1
        assert data[0]["name_en"] == "black dog"
        assert data[0]["count"] == 2


def test_endpoint_excludes_non_recurring_symbols():
    with tempfile.TemporaryDirectory() as tmp:
        app_module.DREAMS_DIR = tmp
        record = {"dream_text": "a", "symbols": [_sym()], "title": "A"}
        (Path(tmp) / "20260101_000000_cccc0003.json").write_text(
            json.dumps(record, ensure_ascii=False), encoding="utf-8"
        )
        client = app_module.app.test_client()
        res = client.get("/api/dreams/recurring-symbols")
        assert res.get_json()["symbols"] == []


def main() -> None:
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        t()
        print(f"OK: {t.__name__}")
    print(f"\n{len(tests)} test gecti.")


if __name__ == "__main__":
    main()
