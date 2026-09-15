"""ruyalar/*.json dosyalarını Neon Postgres'e bir kerelik taşır.

İdempotent: zaten taşınmış bir fname tekrar çalıştırılırsa atlanır
(dreams_store.insert_record ON CONFLICT DO NOTHING kullanıyor). Orijinal
JSON dosyalarını SİLMEZ — taşıma doğrulanana kadar yerel yedek olarak
kalsınlar.
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(override=True)

from services import dreams_store  # noqa: E402

DREAMS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "ruyalar")


def main() -> None:
    dreams_store.init_db()
    before = {r["file"] for r in dreams_store.list_records()}

    files = sorted(f for f in os.listdir(DREAMS_DIR) if f.endswith(".json"))
    migrated = 0
    skipped = 0
    for fname in files:
        if fname in before:
            skipped += 1
            continue
        with open(os.path.join(DREAMS_DIR, fname), encoding="utf-8") as f:
            record = json.load(f)
        dreams_store.insert_record(fname, record)
        migrated += 1

    after = dreams_store.list_records()
    print(f"Yerel dosya sayısı: {len(files)}")
    print(f"Yeni taşınan: {migrated}")
    print(f"Zaten vardı (atlandı): {skipped}")
    print(f"Neon'da toplam kayıt: {len(after)}")


if __name__ == "__main__":
    main()
