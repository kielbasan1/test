#!/usr/bin/env python3
"""dream_completion_pct() için birim testler.

Projede pytest yok; var olan manuel-script deseniyle (scripts/test_expand.py
gibi) assert tabanlı, doğrudan çalıştırılabilir bir test dosyası.

Kullanım (proje kökünden):
    python scripts/test_dream_completion.py
"""
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from app import dream_completion_pct  # noqa: E402


def _symbol(q1="x", q2="x", q3="x", q4="x", assoc="x"):
    return {
        "questions": {"q1": q1, "q2": q2, "q3": q3, "q4": q4},
        "selected_association": assoc,
    }


def test_no_symbols_is_zero():
    assert dream_completion_pct({"symbols": []}) == 0
    assert dream_completion_pct({}) == 0


def test_all_symbols_complete_is_100():
    record = {"symbols": [_symbol(), _symbol()]}
    assert dream_completion_pct(record) == 100


def test_missing_association_not_complete():
    record = {"symbols": [_symbol(assoc="")]}
    assert dream_completion_pct(record) == 0


def test_missing_question_not_complete():
    record = {"symbols": [_symbol(q3="")]}
    assert dream_completion_pct(record) == 0


def test_whitespace_only_counts_as_empty():
    record = {"symbols": [_symbol(q4="   ")]}
    assert dream_completion_pct(record) == 0


def test_partial_completion_rounds():
    # 1 / 3 sembol tam -> %33
    record = {"symbols": [_symbol(), _symbol(assoc=""), _symbol(assoc="")]}
    assert dream_completion_pct(record) == 33


def main() -> None:
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        t()
        print(f"OK: {t.__name__}")
    print(f"\n{len(tests)} test gecti.")


if __name__ == "__main__":
    main()
