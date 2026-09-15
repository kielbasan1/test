"""Neon Postgres tabanlı rüya kaydı deposu.

Önceki dosya-tabanlı depoyla (ruyalar/*.json) aynı sözleşmeyi korur: her
kayıt bir dosya adıyla (fname) anahtarlanan tam bir JSON belgesi. Render'ın
kalıcı olmayan diskine bağımlılığı kaldırmak için eklendi (2026-09-15) —
bkz. PRODUCT.md "Depolama yönü kararı".
"""

import os

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Json

DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()


def _conn():
    return psycopg.connect(DATABASE_URL, row_factory=dict_row)


def init_db() -> None:
    with _conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS dreams (
                fname TEXT PRIMARY KEY,
                saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                record JSONB NOT NULL
            )
            """
        )


def insert_record(fname: str, record: dict) -> None:
    with _conn() as conn:
        conn.execute(
            "INSERT INTO dreams (fname, saved_at, record) VALUES (%s, %s, %s) "
            "ON CONFLICT (fname) DO NOTHING",
            (fname, record.get("saved_at"), Json(record)),
        )


def list_records() -> list:
    with _conn() as conn:
        rows = conn.execute(
            "SELECT fname, record FROM dreams ORDER BY fname DESC"
        ).fetchall()
    results = []
    for row in rows:
        rec = dict(row["record"])
        rec["file"] = row["fname"]
        results.append(rec)
    return results


def get_record(fname: str):
    with _conn() as conn:
        row = conn.execute(
            "SELECT record FROM dreams WHERE fname = %s", (fname,)
        ).fetchone()
    return dict(row["record"]) if row else None


def save_record(fname: str, record: dict) -> None:
    with _conn() as conn:
        conn.execute(
            "UPDATE dreams SET record = %s WHERE fname = %s",
            (Json(record), fname),
        )


def delete_record(fname: str) -> bool:
    with _conn() as conn:
        cur = conn.execute("DELETE FROM dreams WHERE fname = %s", (fname,))
        return cur.rowcount > 0


def delete_all() -> int:
    with _conn() as conn:
        cur = conn.execute("DELETE FROM dreams")
        return cur.rowcount
