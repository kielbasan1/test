from ddgs import DDGS

from services.tavily_client import EXCLUDED_DOMAINS, is_low_quality


def search_symbol(symbol: str, context: str = "", symbol_en: str = "") -> list[dict]:
    """Tavily kotası bittiğinde devreye giren yedek arama. `ddgs` (LangChain'in
    DuckDuckGo aracının da arkasında kullandığı, tarayıcı TLS parmak izini taklit
    eden) kütüphanesini kullanır; resmi bir API değildir, bu yüzden yalnızca
    Tavily başarısız olduğunda çağrılmalı, birincil kaynak olarak kullanılmamalı."""
    final_limit = 8
    queries = [
        (f"{symbol} sembolizm mitoloji arketip simya kültürler arası anlam", "tr-tr"),
    ]
    symbol_en = (symbol_en or "").strip()
    if symbol_en and symbol_en.lower() != symbol.strip().lower():
        queries.append(
            (f"{symbol_en} symbolism mythology archetype alchemy jungian cross-cultural meaning", "us-en")
        )
    per_query_cap = -(-final_limit // len(queries))  # ceil

    items = []
    seen_urls = set()
    for query, region in queries:
        raw_results = DDGS().text(query, region=region, safesearch="moderate", max_results=10)
        added = 0
        for r in raw_results:
            title = r.get("title", "")
            url = r.get("href", "")
            if not url or url in seen_urls:
                continue
            if any(domain in url for domain in EXCLUDED_DOMAINS):
                continue
            if is_low_quality(title, url):
                continue
            seen_urls.add(url)
            items.append({"title": title, "url": url, "snippet": r.get("body", "")})
            added += 1
            if added >= per_query_cap:
                break
        if len(items) >= final_limit:
            break
    return items[:final_limit]
