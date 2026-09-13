# 001 — Stagger the Symbol Wheel's arrow entrance and fix its movement easing

- **Status**: DONE (mechanically verified, feel-check pending)
- **Commit**: b808ed7
- **Severity**: MEDIUM
- **Category**: Cohesion & tokens (7) + Easing & duration (2)
- **Estimated scope**: 2 files (`static/css/style.css`, `static/js/wheel.js`), ~15 lines changed, 1 file additive (`:root` tokens)

## Problem

The symbol wheel (`static/js/wheel.js`, rendered into `#wheel-svg`) is the app's
centerpiece, and its arrow entrance currently reads as mechanical compared to
the rest of the app. Two concrete, evidenced issues:

**1. No stagger on group entrance — every arrow blooms at the exact same instant.**

`static/css/style.css:1618-1631` (current):

```css
.wheel-arrow-group {
  transform-origin: 280px 280px;
}

@media (prefers-reduced-motion: no-preference) {
  .wheel-arrow-group {
    animation: rayGrow 0.4s cubic-bezier(0.16, 1, 0.3, 1) backwards;
  }
}

@keyframes rayGrow {
  from { opacity: 0; transform: scale(0.35); }
  to { opacity: 1; transform: scale(1); }
}
```

`static/js/wheel.js:249-295` (current) rebuilds the entire `.wheel-dynamic`
layer — and therefore recreates every `.wheel-arrow-group` — whenever the
user switches symbol (clicks a chip, uses the `‹ ›` cycle nav, or swipes).
The code's own comment at the top of the file even names the intended
effect ("güneş ışını gibi büyüyerek belirir" — appears growing like a sun
ray) but every arrow currently plays the identical 0.4s animation with zero
delay between them, so N arrows pop in unison rather than radiating outward
in sequence. This happens on every symbol switch — one of the most frequent
actions in the wheel view.

This exact "radiate outward, one after another" idea is **already solved
correctly elsewhere in this same app**, for the sunburst symbol map
(`static/js/symbolmap.js:467-468` sets `--i` per slice;
`static/css/style.css:1838-1848`):

```css
/* style.css:1844-1848 — current, for comparison, DO NOT MODIFY */
@media (prefers-reduced-motion: no-preference) {
  .map-sector-group {
    animation: itemIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) backwards;
    animation-delay: calc(var(--i, 0) * 45ms);
  }
}
```

The wheel is the odd one out: the same visual idea ("radiate outward on
open"), same app, but only one of the two components staggers it.

**2. Position transitions use `ease` instead of `ease-in-out`.**

When the number of associations changes, every arrow's endpoints re-animate
to their new angle. These are on-screen movement/morph transitions, not
color or hover changes, so per this app's own animation rules they should
use an `ease-in-out` curve — but they currently share the same bare `ease`
used for color transitions:

`static/css/style.css:1602-1612` (current):

```css
.wheel-arrow-hitarea {
  stroke: transparent;
  stroke-width: 26;
  fill: transparent;
  cursor: pointer;
  touch-action: manipulation;
  /* Bu class hem çizgi (x1/y1/x2/y2) hem uç dairesi (cx/cy) dokunma alanında
     kullanılıyor; ilgisiz özellik sessizce yok sayılır, zararsız. */
  transition: x1 0.35s ease, y1 0.35s ease, x2 0.35s ease, y2 0.35s ease,
    cx 0.35s ease, cy 0.35s ease;
}
```

(Corrected 2026-09-14: the quote above was missing this rule's existing
two-line comment in the first version of this plan — a transcription
omission when the plan was authored, not a drift in the codebase. The
`transition` value itself was always byte-identical. The comment is
untouched by this plan; only the `transition` line's easing changes, per
Target below.)

`static/css/style.css:1633-1641` (current):

```css
.wheel-arrow-line {
  fill: none;
  stroke: var(--accent);
  stroke-width: 2;
  stroke-linecap: round;
  cursor: pointer;
  touch-action: manipulation;
  transition: stroke 0.2s ease, stroke-width 0.2s ease, d 0.35s ease;
}
```

`static/css/style.css:1653-1657` (current):

```css
.wheel-arrow-tip {
  fill: var(--muted);
  cursor: pointer;
  transition: fill 0.2s ease, r 0.2s ease, cx 0.35s ease, cy 0.35s ease, filter 0.2s ease;
}
```

`static/css/style.css:1665-1677` (current):

```css
.wheel-arrow-label {
  fill: var(--text);
  font-size: 13px;
  font-family: var(--font-body);
  cursor: pointer;
  user-select: none;
  touch-action: manipulation;
  paint-order: stroke;
  stroke: var(--card-bg);
  stroke-width: 5px;
  stroke-linejoin: round;
  transition: fill 0.2s ease, x 0.35s ease, y 0.35s ease;
}
```

In each of these, the color/paint properties (`stroke`, `stroke-width` as a
weight change, `fill`, `r`, `filter`) are correctly left on `ease` — that
part is not a finding. Only the position/geometry properties
(`x1,y1,x2,y2,cx,cy,d,x,y`) are the finding: they move the element on
screen and should use `ease-in-out`, not `ease`.

Neither of these is a HIGH finding on its own — nothing is broken or
janky-looking in a screenshot — but together they're exactly the gap
between "it animates" and "it feels engineered." This plan closes both in
the wheel specifically.

## Target

**No shared easing tokens exist anywhere in this stylesheet today** (0
matches for `--ease` in `static/css/style.css`) — every curve is hand-typed
inline. Introduce two tokens at `:root`. The entrance curve must match this
app's own established entrance convention (`cubic-bezier(0.16, 1, 0.3, 1)`,
already used identically by `screenIn`, `itemIn`, `rayGrow`, and
`.map-sector-group` — do not replace it with a different "textbook"
ease-out value, that would create two competing ease-out flavors). The
move curve has no existing convention to match, so use this skill's
standard `--ease-in-out` value.

`static/css/style.css:3-43` (add at the end of the existing `:root` block,
right before its closing `}`):

```css
  /* Hareket token'ları — bkz. .wheel-arrow-* kuralları. --ease-out mevcut
     giriş eğrisiyle (screenIn/itemIn/rayGrow/.map-sector-group) birebir
     aynı, yeni bir eğri değil, var olanı adlandırıyor. */
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
```

`static/css/style.css:1618-1631` (target — stagger + token, duration
trimmed from 0.4s to 0.3s to match `.map-sector-group`'s exact precedent
now that entrances overlap in a sequence):

```css
.wheel-arrow-group {
  transform-origin: 280px 280px;
}

@media (prefers-reduced-motion: no-preference) {
  .wheel-arrow-group {
    animation: rayGrow 0.3s var(--ease-out) backwards;
    animation-delay: calc(var(--i, 0) * 45ms);
  }
}

@keyframes rayGrow {
  from { opacity: 0; transform: scale(0.35); }
  to { opacity: 1; transform: scale(1); }
}
```

`static/css/style.css:1602-1612` (target):

```css
.wheel-arrow-hitarea {
  stroke: transparent;
  stroke-width: 26;
  fill: transparent;
  cursor: pointer;
  touch-action: manipulation;
  /* Bu class hem çizgi (x1/y1/x2/y2) hem uç dairesi (cx/cy) dokunma alanında
     kullanılıyor; ilgisiz özellik sessizce yok sayılır, zararsız. */
  transition: x1 0.35s var(--ease-in-out), y1 0.35s var(--ease-in-out),
    x2 0.35s var(--ease-in-out), y2 0.35s var(--ease-in-out),
    cx 0.35s var(--ease-in-out), cy 0.35s var(--ease-in-out);
}
```

`static/css/style.css:1633-1641` (target):

```css
.wheel-arrow-line {
  fill: none;
  stroke: var(--accent);
  stroke-width: 2;
  stroke-linecap: round;
  cursor: pointer;
  touch-action: manipulation;
  transition: stroke 0.2s ease, stroke-width 0.2s ease, d 0.35s var(--ease-in-out);
}
```

`static/css/style.css:1653-1657` (target):

```css
.wheel-arrow-tip {
  fill: var(--muted);
  cursor: pointer;
  transition: fill 0.2s ease, r 0.2s ease, cx 0.35s var(--ease-in-out),
    cy 0.35s var(--ease-in-out), filter 0.2s ease;
}
```

`static/css/style.css:1665-1677` (target):

```css
.wheel-arrow-label {
  fill: var(--text);
  font-size: 13px;
  font-family: var(--font-body);
  cursor: pointer;
  user-select: none;
  touch-action: manipulation;
  paint-order: stroke;
  stroke: var(--card-bg);
  stroke-width: 5px;
  stroke-linejoin: round;
  transition: fill 0.2s ease, x 0.35s var(--ease-in-out), y 0.35s var(--ease-in-out);
}
```

`static/js/wheel.js:249-295` (target — set `--i` only on a full symbol
switch, and only at element creation; a single new arrow added within the
same symbol must NOT get a stagger delay, it should react instantly since
it is direct feedback for the action the user just took, not a group
entrance):

```js
  function render(svg, symbolName, associations, onSelect) {
    ensureDefs(svg);
    ensureFrame(svg);

    let dyn = svg.querySelector(".wheel-dynamic");
    const freshRender = svg.dataset.symbol !== symbolName || !dyn;
    if (freshRender) {
      // Farklı bir sembole geçildi: dinamik katmanı tamamen baştan kur.
      // defs/frame katmanları sembolden bağımsız olduğu için dokunulmaz.
      svg.dataset.symbol = symbolName;
      svg.__arrows = new Map();
      if (dyn) dyn.remove();
      dyn = el("g", { class: "wheel-dynamic" });
      svg.appendChild(dyn);
      dyn.appendChild(el("g", { class: "wheel-ticks" }));
      dyn.appendChild(el("g", { class: "wheel-arrows" }));
      buildCenter(dyn, symbolName);
    }

    const arrowsLayer = dyn.querySelector(".wheel-arrows");
    const ticksLayer = dyn.querySelector(".wheel-ticks");
    const arrows = svg.__arrows || (svg.__arrows = new Map());

    // Artık listede olmayan bir çağrışım varsa (şu an silme özelliği yok ama
    // ileride eklenebilir) DOM'dan da kaldır.
    const currentIds = new Set(associations.map((a) => a.id));
    for (const [id, refs] of arrows) {
      if (!currentIds.has(id)) {
        refs.group.remove();
        arrows.delete(id);
      }
    }

    while (ticksLayer.firstChild) ticksLayer.removeChild(ticksLayer.firstChild);
    const n = associations.length;
    buildTicks(ticksLayer, n);

    associations.forEach((assoc, i) => {
      const angleDeg = -90 + (360 / n) * i;
      let refs = arrows.get(assoc.id);
      if (!refs) {
        refs = createArrow(assoc, onSelect);
        // Sembol değişimiyle tüm ok grubu birden kuruluyorsa güneş ışını
        // gibi sırayla büyüsünler diye kademe uygula (bkz. symbolmap.js'de
        // .map-sector-group'un aynı deseni); tek bir yeni çağrışım
        // eklenmişse (freshRender=false) --i hiç set edilmez, CSS'teki
        // var(--i, 0) varsayılanı gecikmesiz devreye girer.
        if (freshRender) {
          refs.group.style.setProperty("--i", i);
        }
        arrowsLayer.appendChild(refs.group);
        arrows.set(assoc.id, refs);
      }
      positionArrow(refs, assoc, angleDeg);
    });
  }
```

Only the `let dyn = ...` through end-of-function region changes; every
other function in the file (`ensureDefs`, `ensureFrame`, `buildCenter`,
`createArrow`, `hashSeed`, `positionArrow`, `buildTicks`) is untouched.

## Repo conventions to follow

- The `--i` stagger pattern (set once per element at creation time via
  `style.setProperty("--i", i)`, consumed by `animation-delay: calc(var(--i,
  0) * Nms)`) is already established in three places — imitate the exact
  shape of `symbolmap.js:467-468` / `style.css:1844-1848`
  (`.map-sector-group`), not the `40ms` variant used for `.chip` /
  `.history-list li` (`style.css:182-188`). The map's `45ms` + `0.3s
  itemIn` is the closer sibling to this wheel case (both are "ring of
  elements radiating outward on open"), so this plan reuses `45ms` and
  `0.3s` exactly rather than a third value.
- Every existing `@media (prefers-reduced-motion: no-preference)` block in
  this file already gates its motion this way — this plan does not
  introduce a new pattern, it stays inside the existing block at
  `style.css:1622-1626`.
- `var(--token)` for colors is used everywhere in this file
  (`var(--accent)`, `var(--ring)`, etc.) — `var(--ease-out)` /
  `var(--ease-in-out)` follow the identical convention for motion values.

## Boundaries

- Do NOT touch `.map-sector-group`, `.map-question-band`, `screenIn`,
  `stepOut`, or plain `itemIn` — they already work correctly and are out of
  scope. Migrating their literal `cubic-bezier(0.16, 1, 0.3, 1)` to
  `var(--ease-out)` is a valid follow-up but a separate plan (it touches
  unrelated components this plan has no reason to risk).
- Do NOT add an exit/teardown animation for the *previous* symbol's arrows
  when switching symbols. The instant `dyn.remove()` on symbol switch
  (`wheel.js`, inside the `freshRender` branch) is a documented, deliberate
  choice per the file's own header comment — this is a settled decision,
  not a finding.
- Do NOT change `wheelRimSpin`, `haloBreathe`, `attachTilt`
  (`static/js/main.js:213-232`), or any hover/`:active` state — none of
  them are part of this finding.
- Do NOT touch `ensureDefs`, `ensureFrame`, `buildCenter`, `createArrow`,
  `hashSeed`, `positionArrow`, or `buildTicks` in `wheel.js` — only the
  `render` function's dynamic-layer setup and the `associations.forEach`
  loop change.
- Do NOT add a JS-driven stagger (`setTimeout` loop, etc.) — this stays
  pure CSS + one `style.setProperty` call, consistent with how the map does
  it.
- If the current code at any cited `file:line` does not match what's shown
  above (drift since commit `b808ed7`), STOP and report the mismatch
  instead of improvising a fix.

## Verification

- **Mechanical**: no build step for this static-file Flask app. Confirm
  syntax only:
  - `node --check static/js/wheel.js` — must exit 0.
  - Open `static/css/style.css` and confirm no duplicate `--ease-out` /
    `--ease-in-out` declaration was introduced (should appear exactly once
    each, inside `:root`).
- **Feel check** — run the app (`python app.py` or the existing
  `baslat.bat`), open a dream that has already been extracted into symbols,
  and:
  - Click through 2-3 different symbol chips (or use the `‹ ›` cycle-nav).
    Confirm the arrows no longer pop in all at once — they should bloom in
    a visible clockwise sweep starting from the top (12 o'clock), each one
    slightly after the last, finishing within roughly half a second for a
    typical symbol (4-8 associations).
  - With a symbol open, add ONE new manual association (or trigger
    whatever action creates a single new arrow without switching symbol).
    Confirm that one arrow appears immediately, with no stagger delay —
    only full symbol switches should show the sweep.
  - In Chrome DevTools' Animations panel, set playback to 10% while
    switching symbols, and confirm each `.wheel-arrow-group`'s `rayGrow`
    starts at a distinct, increasing offset rather than all starting at
    frame 0.
  - Resize the browser or add/remove associations so the ring's angles
    recompute; confirm the arrows visibly ease into their new positions
    (not snap), and that the motion has a slightly different character
    (symmetric ease-in-out) than the color/selection change on click
    (which stays a plain `ease`).
  - Toggle `prefers-reduced-motion` (DevTools Rendering panel → Emulate CSS
    media feature) and confirm the wheel's arrows appear with no
    entrance/stagger animation at all (this app runs `showOnlyStep`
    equivalents instantly for reduced-motion users, and the
    `@media (prefers-reduced-motion: no-preference)` gate around
    `.wheel-arrow-group` already handles this — just confirm it still does
    after the edit).
- **Done when**: switching between symbols in the wheel shows a visible,
  clockwise, sequential bloom of arrows (not a simultaneous pop), a single
  new association still appears instantly with no delay, and position
  transitions on the arrows visibly use a symmetric ease rather than the
  plain default `ease` used for color changes.
