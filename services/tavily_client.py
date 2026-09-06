import os

from tavily import TavilyClient

# Kaliteli mitoloji/sembolizm kaynağı yerine sığ "rüya tabiri" ve fal sitelerinin
# veri havuzunu kirletmesini engellemek için bilinen düşük kaliteli siteleri dışla.
EXCLUDED_DOMAINS = [
    "dreammoods.com",
    "dream-meaning.co.uk",
    "auntyflo.com",
    "dreamstop.com",
    "dreamastromeanings.com",
    "myastrologyguide.com",
    "ruyatabirleri.gen.tr",
    "ruyatabirlerisozlugu.com",
    "islamiruyatabirleri.gen.tr",
    "falcı.com",
    "zodiacsigns-horoscope.com",
    "dreamdictionary.org",
    "dream-dictionary.org",
    # Sosyal medya gönderileri ansiklopedik/mitolojik amplifikasyon için güvenilir
    # ve kalıcı kaynak sayılmaz.
    "instagram.com",
    "facebook.com",
    "tiktok.com",
    "pinterest.com",
    "twitter.com",
    "x.com",
]

# exclude_domains ve sorgudaki eksi kelimeler her zaman yeterli olmuyor; bu yüzden
# başlık/URL'de fal-burç-astroloji izi olan sonuçları ikinci bir süzgeçle eleriz.
BLOCKED_KEYWORDS = [
    "horoscope",
    "zodiac",
    "astroloji",
    "astrology",
    "burç",
    "burc",
    "tarot",
    "fal ",
    "-fal",
    "/fal",
    "melek sayı",
    "melek sayi",
    "tabir",
    "dream dictionary",
    "dream meaning",
    "dream interpretation",
]


def is_low_quality(title: str, url: str) -> bool:
    haystack = f"{title} {url}".lower()
    return any(kw in haystack for kw in BLOCKED_KEYWORDS)


_client = None


def _get_client() -> TavilyClient:
    global _client
    if _client is None:
        api_key = os.environ.get("TAVILY_API_KEY", "").strip()
        if not api_key:
            raise RuntimeError(
                "TAVILY_API_KEY tanımlı değil. .env dosyasına tavily.com üzerinden "
                "aldığınız ücretsiz API anahtarını ekleyin."
            )
        _client = TavilyClient(api_key=api_key)
    return _client


def _build_queries(symbol: str, symbol_en: str = "") -> list[str]:
    queries = [
        f"{symbol} sembolizm mitoloji arketip simya kültürler arası anlam "
        f"-rüya yorumu -fal -burç"
    ]
    symbol_en = (symbol_en or "").strip()
    if symbol_en and symbol_en.lower() != symbol.strip().lower():
        # İngilizce literatür (mitoloji ansiklopedileri, akademik makaleler,
        # Jungiyen kaynaklar) çok daha geniş; sembolü ayrıca İngilizce de tara.
        queries.append(
            f"{symbol_en} symbolism mythology archetype alchemy jungian "
            f"cross-cultural meaning -dream dictionary -horoscope"
        )
    return queries


def search_symbol(symbol: str, context: str = "", symbol_en: str = "") -> list[dict]:
    client = _get_client()
    queries = _build_queries(symbol, symbol_en)
    final_limit = 8
    per_query_cap = -(-final_limit // len(queries))  # ceil

    items = []
    seen_urls = set()
    for query in queries:
        result = client.search(
            query=query,
            search_depth="advanced",
            max_results=8,
            exclude_domains=EXCLUDED_DOMAINS,
        )
        added = 0
        for r in result.get("results", []):
            title = r.get("title", "")
            url = r.get("url", "")
            if not url or url in seen_urls or is_low_quality(title, url):
                continue
            seen_urls.add(url)
            items.append({"title": title, "url": url, "snippet": r.get("content", "")})
            added += 1
            if added >= per_query_cap:
                break
        if len(items) >= final_limit:
            break
    return items[:final_limit]
