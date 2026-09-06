# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A local Flask + vanilla JS web app implementing Robert Johnson's "Inner Work" dream-analysis
method: user writes a dream → Gemini extracts concrete symbols → each symbol becomes an
interactive SVG "wheel" where the user adds free personal associations as radiating arrows →
user marks the one that "clicks" → for the selected association per symbol, the user answers 4
Johnson-style deepening questions → the app searches the web (Tavily, falling back to
DuckDuckGo) for mythological/archetypal amplification of each symbol → Gemini synthesizes
everything into one Jungian interpretation that prioritizes personal association over generic
symbolism. No build step, no JS framework, no database — just Flask templating, static
JS/CSS, and JSON files on disk.

## Running

```
pip install -r requirements.txt
python app.py          # serves http://localhost:5000, debug=True (auto-reload)
```

Windows convenience launcher: double-click `baslat.bat` (runs `python app.py` from the repo
dir, keeps the console window open).

There is no test suite, linter, or build/lint/typecheck command configured in this repo.

### Required `.env`

- `GEMINI_API_KEY` — from https://ai.google.dev (free tier).
- `GEMINI_MODEL` — defaults to `gemini-flash-lite-latest` if unset (see Model choice below).
- `TAVILY_API_KEY` — from https://tavily.com (free tier, 1000 queries/month).

Flask's debug reloader spawns a child process that inherits the *parent's* OS environment, not
a freshly-read `.env` — `app.py` calls `load_dotenv(override=True)` specifically so edits to
`.env` actually take effect after a save-triggered reload. If a `.env` change still doesn't
seem to apply, fully kill and restart `python app.py` rather than trusting the reloader.

## Architecture

**Backend (`app.py`)** is a thin Flask layer over `services/`: it does request
validation/JSON-shaping only, all real logic (LLM calls, search, filtering) lives in the
service modules. Routes:

- `POST /api/extract-symbols` — dream text → Gemini → list of `{name, name_en, context}`.
- `POST /api/search-symbol` — symbol (+ `symbol_en`, `context`) → tries `tavily_client`
  first, falls back to `duckduckgo_client` on any exception, reports which one served the
  request via a `source` field in the response.
- `POST /api/synthesize` — full payload (dream + symbols + personal associations + 4-question
  answers + amplification results) → Gemini → one interpretation string.
- `POST /api/save-dream`, `GET /api/dreams`, `GET /api/dreams/<fname>` — dream records are
  plain JSON files under `ruyalar/`, named `<timestamp>_<uuid8>.json`. There is no DB.

`_friendly_error()` in `app.py` translates raw Gemini/Tavily error strings (quota
`RESOURCE_EXHAUSTED`/429, `UNAVAILABLE`/503, invalid API key) into short Turkish messages
before they reach the client — extend this function rather than leaking raw provider errors
when adding new failure modes.

**`services/gemini_client.py`** owns both LLM prompts as module-level string constants:
`EXTRACT_PROMPT` (symbol extraction — explicitly instructed to scan sentence-by-sentence with
no symbol-count cap, since capping/summarizing was a real regression found in testing) and
`SYNTHESIS_PROMPT` (final interpretation — encodes the actual Jungian method: personal
association outranks cultural/mythological amplification, dramatic-structure framing
(exposition → peripeteia → resolution), compensation-principle question, subjective-level
reading of human figures in the dream, shadow material handled without softening it, and a
closing prompt for a small concrete ritual action). When adjusting interpretation quality or
behavior, edit these prompts — don't add post-processing logic to shape the output instead.

`_extract_text(response)` defensively handles Gemini responses where `.text` is `None`
(happens on safety blocks, or when the "thinking" budget consumes all output tokens before any
visible text is produced) and raises a `RuntimeError` with the actual block/finish reason
instead of an opaque `AttributeError`. Both `extract_symbols()` and `synthesize_interpretation()`
must go through this helper.

**Model choice**: uses the `google-genai` SDK (`from google import genai`), not the deprecated
`google-generativeai`. Default model is `gemini-flash-lite-latest` — chosen specifically for
its much higher free-tier daily quota versus `gemini-3.6-flash` (20 req/day) or
`gemini-2.5-flash` (404s for new API keys, no longer available). `thinking_config` uses
`thinking_level` ("low"/"medium"/"high"), not `thinking_budget` — this model rejects
`thinking_budget=0` as invalid. Extraction uses `"medium"` (found `"low"` silently dropped
symbols on long dreams); synthesis uses `"high"`.

**`services/tavily_client.py`** / **`services/duckduckgo_client.py`** share the same
filtering contract: `EXCLUDED_DOMAINS` (horoscope/fal/dream-dictionary/social-media sites) and
a public `is_low_quality(title, url)` keyword check (`BLOCKED_KEYWORDS`, e.g. the broad
`"tabir"` catch-all for Turkish "dream interpretation" sites). Both build **two queries per
symbol** — Turkish and English (via `symbol_en` from extraction) — because English-language
mythology/Jungian sources are far more abundant, then dedupe by URL and cap combined results at
8. When adding a new low-quality source, add it to both `EXCLUDED_DOMAINS` lists (or centralize
if this diverges further) and to `BLOCKED_KEYWORDS` if a domain-based exclusion alone won't
catch it (e.g. mirrors/aggregators). `duckduckgo_client` uses the `ddgs` library (not a
hand-rolled scraper — a `requests`/`BeautifulSoup` version was tried and got TLS-reset on
DuckDuckGo's bot detection).

**Frontend** is a single Jinja template (`templates/index.html`) plus two script files, no
bundler:

- `static/js/wheel.js` — standalone SVG wheel renderer, stateless (state lives in `main.js`).
  Its `render(svg, symbolName, associations, onSelect)` is the only entry point. Critically, it
  does **incremental DOM diffing**, not full teardown/rebuild: `svg.dataset.symbol` detects a
  symbol change (triggers full rebuild via `buildCenter`), otherwise it keys existing arrow
  groups by association id in `svg.__arrows` (a `Map`) and only updates attributes on existing
  nodes / creates DOM for genuinely new associations. This was a deliberate fix for visible
  flash-on-every-click jank — do not reintroduce clear-and-rebuild-everything logic here.
- `static/js/main.js` — all app state and the single-screen "wizard" flow. `showOnlyStep(section)`
  shows exactly one top-level `<section class="card">` at a time (steps: history, dream input,
  symbol list, wheel, finalize, result) instead of a long scrolling page. `updateProgress()` is
  the single source of truth for the progress bar fill *and* for enabling `#btn-finalize` —
  if you change completion criteria, this is the one function to update (a prior rewrite bug
  came from splitting "enable the button" logic out of this progress computation and forgetting
  to keep it). The finalize step fetches amplification data for all symbols in parallel via
  `Promise.all(...)`, not a sequential loop — a sequential version was measured to be
  significantly slower and caused E2E test timeouts.
- `static/css/style.css` has a global `.hidden { display: none; }` rule specifically because
  several `classList.toggle("hidden", ...)` call sites had no matching type-specific CSS rule
  and silently did nothing — keep relying on the global rule rather than adding new
  per-component `.hidden` overrides. Motion/animation rules are wrapped in
  `prefers-reduced-motion` media queries; touch targets use `touch-action: manipulation` and
  `:active` scale transforms throughout.

## Key domain rule when touching prompts or synthesis logic

Personal association must always outrank cultural/mythological amplification data in the final
interpretation — this is the core methodological constraint from Johnson's book, not an
arbitrary preference, and it's what the `SYNTHESIS_PROMPT` is built around. Any change to how
amplification data is fetched, ranked, or merged into the synthesis payload should preserve
this priority.
