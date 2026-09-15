"""DuckDuckGo web araması — sembol amplifikasyonuna isteğe bağlı takviye kaynak.

Resmi bir API değil; `ddgs` kütüphanesi DuckDuckGo'nun arama sayfasını
kazıyor, paylaşımlı hosting IP'lerinde (Render vb.) engellenme riski var
(bkz. PLAN.md Faz 3.1b — eski, HER sembol için otomatik çalışan yüksek
hacimli kullanım bu yüzden kaldırılmıştı). Bu modül HER ZAMAN sessizce
başarısız olacak şekilde tasarlandı: import hatası, ağ hatası ya da
engellenme durumunda boş liste döner, amplifikasyon akışını hiç bozmaz.
"""


def search_symbol(query: str, max_results: int = 3) -> list:
    try:
        from ddgs import DDGS
    except Exception:
        return []
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=max_results))
    except Exception:
        return []
    snippets = []
    for r in results:
        title = (r.get("title") or "").strip()
        body = (r.get("body") or "").strip()
        combined = f"{title}: {body}".strip(": ").strip()
        if combined:
            snippets.append(combined)
    return snippets
