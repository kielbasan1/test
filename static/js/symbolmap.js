// Sembol Haritası — rüyanın "bütün + parça" görünümü.
//
// Amaç yorum yapmak değil, kullanıcının kendi bağlantıyı kendi kurabilmesi
// için tüm veriyi (rüya → semboller → seçilen çağrışımlar → 4 soru cevabı)
// tek bir radyal ağaç olarak, tamamen düğümler halinde göz önüne sermek —
// ayrı bir metin paneli yok, her şey grafiğin kendi içinde. Wheel.js'deki
// radyal yerleşim mantığını paylaşır ama bağımsız bir modüldür.
//
// Etkileşim: rüya merkezde → semboller ilk halka → seçilen çağrışım ikinci
// halka. Çağrışım düğümüne (ya da onun sembolüne) tıklayınca o düğüm biraz
// büyüyüp öne çıkar ve etrafında 4 soru-cevap düğümü ("yaprak") açılır. Aynı
// anda sadece bir çağrışımın yaprağı açık kalır; tekrar tıklamak kapatır.
//
// Veri şekli (main.js'deki state.lastRecord / geçmişten gelen record ile
// aynı — export/rapor/çalışma sayfasının beklediği şekille de örtüşür):
//   { dream_text, symbols: [{ name, context, selected_association,
//     all_associations, questions: {q1..q4} }] }

const SymbolMap = (() => {
  const NS = "http://www.w3.org/2000/svg";
  const CX = 320;
  const CY = 320;
  const CENTER_R = 46;
  const SYMBOL_R = 150;
  const ASSOC_R = 225;
  const Q_R = 300;
  const Q_FAN_DEG = [-24, -8, 8, 24];

  const QUESTIONS = [
    ["q1", "Bu içimde hangi parçam?"],
    ["q2", "Hayatımdaki işlevi ne / nereyi yönetiyor?"],
    ["q3", "Kişiliğimin neresinde bunu görüyorum?"],
    ["q4", "Kim içimde böyle davranıyor?"],
  ];

  function el(tag, attrs, text) {
    const node = document.createElementNS(NS, tag);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function anchorFor(cos) {
    if (cos > 0.2) return "start";
    if (cos < -0.2) return "end";
    return "middle";
  }

  function truncate(text, max) {
    if (!text) return "";
    return text.length > max ? text.slice(0, max - 1) + "…" : text;
  }

  // Kelime bazlı sarma — tek satırda kesip "…" ile boğmak yerine (eski
  // davranış, Kaan'ın "isimler tam sığmıyor" şikayetinin kaynağıydı) etiketi
  // birden fazla satıra yayar. Karakter sayımı yaklaşımı truncate() ile aynı
  // pragmatizmde (gerçek metin genişliği ölçmüyor, bkz. charsPerLine).
  function wrapLines(text, maxChars) {
    const words = (text || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
    if (!words.length) return [];
    const lines = [];
    let line = "";
    words.forEach((w) => {
      const candidate = line ? `${line} ${w}` : w;
      if (candidate.length > maxChars && line) {
        lines.push(line);
        line = w;
      } else {
        line = candidate;
      }
    });
    if (line) lines.push(line);
    return lines;
  }

  // wrapLines'ı en fazla maxLines satırla sınırlar; daha fazlası gerekiyorsa
  // son gösterilen satırı "…" ile işaretler — truncate()'in çok satırlı
  // karşılığı. Harita düğüm etiketlerinde (render + PNG export) kullanılıyor.
  function wrapForLabel(text, maxCharsPerLine, maxLines) {
    const all = wrapLines(text, maxCharsPerLine);
    const shown = all.slice(0, maxLines);
    if (all.length > shown.length && shown.length) {
      shown[shown.length - 1] = shown[shown.length - 1] + "…";
    }
    return shown;
  }

  // Birden çok satırı tek bir <text> düğümünde, (attrs.x, attrs.y) referans
  // noktası etrafında dikey ortalanmış <tspan>'lar olarak çizer.
  function multilineText(attrs, lines, lineHeight) {
    const text = el("text", attrs);
    const shown = lines.length ? lines : [""];
    const n = shown.length;
    shown.forEach((line, i) => {
      const dy = i === 0 ? -((n - 1) * lineHeight) / 2 : lineHeight;
      text.appendChild(el("tspan", { x: attrs.x, dy }, line));
    });
    return text;
  }

  function pointAt(radius, angleDeg) {
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: CX + radius * Math.cos(rad),
      y: CY + radius * Math.sin(rad),
      cos: Math.cos(rad),
      sin: Math.sin(rad),
    };
  }

  // Düğüm tam tepede/altta (cos ~ 0) ise anchorFor "middle" döner ve dx=0
  // olur — bu durumda etiket, düğümün merkezine bindirilmiş gibi çiziliyordu
  // (küçük dairenin üstüne oturan metin). Bu düzeltme etiketi radyal yönde
  // (yukarı/aşağı) düğümün dışına iter, dx=0 kaldığı için yatayda ortalı kalır.
  function verticalNudge(anchor, sin, baseline, pushOut) {
    if (anchor !== "middle") return baseline;
    return sin < 0 ? -pushOut : pushOut;
  }

  // Etiket başına satır/karakter bütçesi — tek satır kesip "…" ile boğmak
  // yerine (eski davranış) iki satıra kadar sarıyoruz, gerçek isim/çağrışım
  // metninin tamamı okunabilsin diye.
  const SYMBOL_LABEL_CHARS = 14;
  const ASSOC_LABEL_CHARS = 16;
  const LABEL_LINE_HEIGHT = 12.5;
  const LABEL_MAX_LINES = 2;

  function makeNode(x, y, r, labelText, anchor, dx, cls, dy, fillUrl) {
    const group = el("g", {
      class: `map-node ${cls}`,
      role: "button",
      tabindex: "0",
      "aria-label": labelText,
    });
    const circleAttrs = { cx: x, cy: y, r, class: `map-node-circle ${cls}` };
    // fill CSS'te (.map-node-circle) değil öznitelik olarak veriliyor —
    // öznitelikler CSS sınıf kurallarından daha düşük öncelikli, bu yüzden
    // .assoc.expanded gibi daha spesifik bir kural (fill: var(--gold))
    // tıklanınca bu gradyanın üzerine sorunsuz yazabiliyor.
    if (fillUrl) circleAttrs.fill = fillUrl;
    group.appendChild(el("circle", circleAttrs));
    const maxChars = cls === "assoc" ? ASSOC_LABEL_CHARS : SYMBOL_LABEL_CHARS;
    const lines = wrapForLabel(labelText, maxChars, LABEL_MAX_LINES);
    group.appendChild(
      multilineText(
        { x: x + dx, y: y + dy, "text-anchor": anchor, class: `map-label map-label-${cls}` },
        lines,
        LABEL_LINE_HEIGHT
      )
    );
    return group;
  }

  let uidCounter = 0;

  function render(svg, record) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.__nodes = new Map(); // id -> { data: {sym, angleDeg}, assocGroup, symGroup }
    svg.__expandedId = null;
    svg.__record = record;

    // Aynı sayfada birden fazla harita (sonuç ekranı + geçmiş detayı) aynı
    // anda DOM'da bulunabiliyor — gradyan/filtre id'leri belge genelinde
    // çözüldüğü için her render'a özel bir önek şart, yoksa ikinci harita
    // birincinin tanımını "çalar".
    const uid = `sm${++uidCounter}`;

    const defs = el("defs", {});
    const ambientGrad = el("radialGradient", { id: `${uid}-ambient`, cx: "50%", cy: "50%", r: "50%" });
    ambientGrad.appendChild(el("stop", { offset: "0%", "stop-color": "#5a6472", "stop-opacity": "0.16" }));
    ambientGrad.appendChild(el("stop", { offset: "100%", "stop-color": "#5a6472", "stop-opacity": "0" }));
    const centerGrad = el("radialGradient", { id: `${uid}-center`, cx: "35%", cy: "30%", r: "75%" });
    centerGrad.appendChild(el("stop", { offset: "0%", "stop-color": "#262b34" }));
    centerGrad.appendChild(el("stop", { offset: "100%", "stop-color": "#0e1015" }));
    // Çarktaki gibi ikinci, pirinç tonlu ve merkezden kaydırılmış ışık lekesi —
    // haritayı da tek renkli düz bir parıltı yerine iki tonlu hissettirir.
    const ambientGoldGrad = el("radialGradient", { id: `${uid}-ambient-gold`, cx: "68%", cy: "72%", r: "55%" });
    ambientGoldGrad.appendChild(el("stop", { offset: "0%", "stop-color": "#c49a5f", "stop-opacity": "0.11" }));
    ambientGoldGrad.appendChild(el("stop", { offset: "100%", "stop-color": "#c49a5f", "stop-opacity": "0" }));
    // Düğümler artık düz bir zemin rengi değil, hafif hacimli birer "boncuk" —
    // objectBoundingBox varsayılanı sayesinde tek bir tanım her düğümde kendi
    // konumuna göre aynı sol-üst vurgulu ışık yönünü veriyor, düğüm başına
    // ayrı gradyan gerekmiyor.
    const nodeGrad = el("radialGradient", { id: `${uid}-node`, cx: "32%", cy: "28%", r: "75%" });
    nodeGrad.appendChild(el("stop", { offset: "0%", "stop-color": "#3c434d" }));
    nodeGrad.appendChild(el("stop", { offset: "100%", "stop-color": "#14161c" }));
    const goldNodeGrad = el("radialGradient", { id: `${uid}-gold-node`, cx: "32%", cy: "28%", r: "75%" });
    goldNodeGrad.appendChild(el("stop", { offset: "0%", "stop-color": "#4a3a20" }));
    goldNodeGrad.appendChild(el("stop", { offset: "100%", "stop-color": "#181209" }));
    defs.appendChild(ambientGrad);
    defs.appendChild(ambientGoldGrad);
    defs.appendChild(centerGrad);
    defs.appendChild(nodeGrad);
    defs.appendChild(goldNodeGrad);
    svg.appendChild(defs);

    svg.appendChild(
      el("circle", { cx: CX, cy: CY, r: Q_R + 40, class: "map-glow-bg", fill: `url(#${uid}-ambient)` })
    );
    svg.appendChild(
      el("circle", { cx: CX, cy: CY, r: Q_R + 55, class: "map-glow-bg-gold", fill: `url(#${uid}-ambient-gold)` })
    );

    // Çarktaki gravürlü kadran halkasıyla aynı dil: harita da bir alet
    // yüzeyi, sadece bir diyagram değil.
    svg.appendChild(el("circle", { cx: CX, cy: CY, r: ASSOC_R + 38, class: "map-rim" }));
    svg.appendChild(el("circle", { cx: CX, cy: CY, r: SYMBOL_R + 24, class: "map-rim-inner" }));

    svg.appendChild(
      el("circle", {
        cx: CX,
        cy: CY,
        r: CENTER_R,
        class: "map-center-circle",
        style: `fill:url(#${uid}-center)`,
      })
    );
    svg.appendChild(
      el("text", { x: CX, y: CY + 5, class: "map-center-text", "data-i18n": "map.center" }, I18N.t("map.center"))
    );

    const layer = el("g", { class: "map-flower-layer" });

    const symbols = record.symbols || [];
    const n = symbols.length || 1;

    symbols.forEach((sym, i) => {
      const id = `s${i}`;
      const angleDeg = -90 + (360 / n) * i;
      const { x: sx, y: sy, cos, sin } = pointAt(SYMBOL_R, angleDeg);
      const anchor = anchorFor(cos);
      const dx = anchor === "start" ? 14 : anchor === "end" ? -14 : 0;
      // pushOut 22 (önceden 18) — etiketler artık 2 satıra sarabiliyor,
      // "middle" hizalı (tam tepe/alt) düğümlerde bloğun düğüm dairesine
      // binmemesi için biraz daha pay gerekiyor.
      const dy = verticalNudge(anchor, sin, 4, 22);

      const symEdge = el("line", { x1: CX, y1: CY, x2: sx, y2: sy, class: "map-edge map-edge-symbol map-entrance" });
      symEdge.style.setProperty("--i", i);
      svg.appendChild(symEdge);
      const symGroup = makeNode(sx, sy, 11, sym.name || "", anchor, dx, "symbol", dy, `url(#${uid}-node)`);
      symGroup.classList.add("map-entrance");
      symGroup.style.setProperty("--i", i);
      symGroup.addEventListener("click", () => toggleExpand(svg, id));
      symGroup.addEventListener("keydown", (e) => onNodeKeydown(e, svg, id));
      svg.appendChild(symGroup);

      let assocGroup = null;
      if (sym.selected_association) {
        const { x: ax, y: ay } = pointAt(ASSOC_R, angleDeg);
        const assocEdge = el("line", { x1: sx, y1: sy, x2: ax, y2: ay, class: "map-edge map-edge-assoc map-entrance" });
        assocEdge.style.setProperty("--i", i + 0.3);
        svg.appendChild(assocEdge);
        assocGroup = makeNode(
          ax,
          ay,
          8,
          sym.selected_association,
          anchor,
          dx,
          "assoc",
          dy,
          `url(#${uid}-gold-node)`
        );
        assocGroup.classList.add("map-entrance");
        assocGroup.style.setProperty("--i", i + 0.3);
        assocGroup.addEventListener("click", () => toggleExpand(svg, id));
        assocGroup.addEventListener("keydown", (e) => onNodeKeydown(e, svg, id));
        svg.appendChild(assocGroup);
      }

      svg.__nodes.set(id, { data: { sym, angleDeg }, symGroup, assocGroup });
    });

    svg.appendChild(layer);
    svg.__flowerLayer = layer;

    initPanZoom(svg);
  }

  function onNodeKeydown(e, svg, id) {
    if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      toggleExpand(svg, id);
    }
  }

  function toggleExpand(svg, id) {
    const entry = svg.__nodes.get(id);
    if (!entry || !entry.assocGroup) return;

    const wasExpanded = svg.__expandedId === id;
    collapse(svg);
    if (!wasExpanded) expand(svg, id, entry);
  }

  function collapse(svg) {
    if (svg.__expandedId) {
      const prev = svg.__nodes.get(svg.__expandedId);
      if (prev && prev.assocGroup) prev.assocGroup.classList.remove("expanded");
    }
    while (svg.__flowerLayer.firstChild) svg.__flowerLayer.removeChild(svg.__flowerLayer.firstChild);
    svg.__expandedId = null;
  }

  function expand(svg, id, entry) {
    const { sym, angleDeg } = entry.data;
    entry.assocGroup.classList.add("expanded");
    svg.__expandedId = id;

    const assocPoint = pointAt(ASSOC_R, angleDeg);
    const q = sym.questions || {};

    QUESTIONS.forEach(([key, label], i) => {
      const qAngle = angleDeg + Q_FAN_DEG[i];
      const { x: qx, y: qy, cos, sin } = pointAt(Q_R, qAngle);
      const anchor = anchorFor(cos);
      const dx = anchor === "start" ? 12 : anchor === "end" ? -12 : 0;
      // Sembol kutupta ise (bkz. buildExportSvg'deki aynı düzeltme) birden
      // fazla yaprak "middle" hizalamaya düşüp üst üste binebilir — o
      // durumda y'de kademeli ayrıştır.
      const dy = anchor === "middle" ? (sin < 0 ? -1 : 1) * (15 + i * 14) : verticalNudge(anchor, sin, 4, 15);

      const edge = el("line", {
        x1: assocPoint.x,
        y1: assocPoint.y,
        x2: qx,
        y2: qy,
        class: "map-edge map-edge-q",
      });
      svg.__flowerLayer.appendChild(edge);

      const answer = q[key] && q[key].trim() ? q[key] : "—";
      const group = el("g", { class: "map-node q" });
      group.style.setProperty("--i", i);
      group.appendChild(el("circle", { cx: qx, cy: qy, r: 7, class: "map-node-circle q" }));
      group.appendChild(
        el(
          "text",
          { x: qx + dx, y: qy + dy, "text-anchor": anchor, class: "map-label map-label-q" },
          `${i + 1}. ${truncate(answer, 26)}`
        )
      );
      group.appendChild(el("title", {}, `${label}\n${answer}`));
      svg.__flowerLayer.appendChild(group);
    });
  }

  // ---------- Pan / Zoom ----------

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function setViewBox(svg) {
    const vb = svg.__vb;
    svg.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  }

  function svgPointFromClient(svg, clientX, clientY) {
    const rect = svg.getBoundingClientRect();
    const vb = svg.__vb;
    return {
      x: vb.x + ((clientX - rect.left) / rect.width) * vb.w,
      y: vb.y + ((clientY - rect.top) / rect.height) * vb.h,
    };
  }

  function applyZoom(svg, focus, factor) {
    const vb = svg.__vb;
    const base = svg.__vbBase;
    const newW = clamp(vb.w * factor, base.w * 0.28, base.w * 2.2);
    const ratio = newW / vb.w;
    vb.x = focus.x - (focus.x - vb.x) * ratio;
    vb.y = focus.y - (focus.y - vb.y) * ratio;
    vb.w = newW;
    vb.h = newW; // kare viewBox
    setViewBox(svg);
  }

  function initPanZoom(svg) {
    if (svg.__panZoomReady) return;
    svg.__panZoomReady = true;

    const [bx, by, bw, bh] = (svg.getAttribute("viewBox") || "0 0 640 640")
      .split(/\s+/)
      .map(Number);
    svg.__vbBase = { x: bx, y: by, w: bw, h: bh };
    svg.__vb = { x: bx, y: by, w: bw, h: bh };

    svg.classList.add("map-pannable");

    // ---- Yakınlaştırma kontrolleri (SVG dışı, .symbol-map-wrap içine) ----
    const wrap = svg.parentElement;
    const controls = document.createElement("div");
    controls.className = "map-zoom-controls";
    const mkBtn = (glyph, titleKey, onClick) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "map-zoom-btn";
      btn.textContent = glyph;
      btn.title = I18N.t(titleKey);
      btn.setAttribute("aria-label", I18N.t(titleKey));
      btn.setAttribute("data-i18n-title", titleKey);
      btn.setAttribute("data-i18n-aria", titleKey);
      btn.addEventListener("click", onClick);
      return btn;
    };
    const center = () => ({
      x: svg.__vb.x + svg.__vb.w / 2,
      y: svg.__vb.y + svg.__vb.h / 2,
    });
    controls.appendChild(mkBtn("+", "map.zoomIn", () => applyZoom(svg, center(), 0.8)));
    controls.appendChild(mkBtn("−", "map.zoomOut", () => applyZoom(svg, center(), 1.25)));
    controls.appendChild(
      mkBtn("⟲", "map.reset", () => {
        svg.__vb = { ...svg.__vbBase };
        setViewBox(svg);
      })
    );
    wrap.appendChild(controls);

    // ---- Dışa aktarma düğmeleri (harita PNG + çalışma sayfası PNG) ----
    const exportControls = document.createElement("div");
    exportControls.className = "map-export-controls";

    function makeExportBtn(labelKey, run, errorMessageKey) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "map-export-btn";
      btn.title = I18N.t(labelKey);
      btn.setAttribute("aria-label", I18N.t(labelKey));
      btn.setAttribute("data-i18n-title", labelKey);
      btn.setAttribute("data-i18n-aria", labelKey);
      btn.innerHTML = `<svg class="icon icon-sm"><use href="#icon-download"/></svg><span data-i18n="${labelKey}"></span>`;
      btn.querySelector("span").textContent = I18N.t(labelKey);
      btn.addEventListener("click", async () => {
        if (!svg.__record) return;
        btn.disabled = true;
        const original = btn.innerHTML;
        btn.textContent = I18N.t("map.exportPreparing");
        try {
          await run(svg.__record);
        } catch (err) {
          console.error("Dışa aktarma başarısız:", err);
          window.alert(I18N.t(errorMessageKey));
        } finally {
          btn.disabled = false;
          btn.innerHTML = original;
        }
      });
      return btn;
    }

    exportControls.appendChild(makeExportBtn("map.exportPng", exportPng, "map.exportError"));
    exportControls.appendChild(
      makeExportBtn("map.exportWorksheet", exportWorksheetPng, "map.exportWorksheetError")
    );
    wrap.appendChild(exportControls);

    // ---- Fare tekerleği ile yakınlaştırma ----
    svg.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const focus = svgPointFromClient(svg, e.clientX, e.clientY);
        applyZoom(svg, focus, e.deltaY > 0 ? 1.1 : 0.9);
      },
      { passive: false }
    );

    // ---- Tekil sürükleme (pan) + iki parmak sıkıştırma (pinch-zoom) ----
    const pointers = new Map(); // pointerId -> {x, y}
    let dragId = null;
    let dragStart = null; // {clientX, clientY, vb}
    let pinchStartDist = null;
    let pinchStartVb = null;

    function pointerDistance() {
      const pts = [...pointers.values()];
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      return Math.hypot(dx, dy);
    }

    svg.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".map-node")) return; // düğüm kendi click'ini yönetsin
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      svg.setPointerCapture(e.pointerId);

      if (pointers.size === 1) {
        dragId = e.pointerId;
        dragStart = { clientX: e.clientX, clientY: e.clientY, vb: { ...svg.__vb } };
        svg.classList.add("panning");
      } else if (pointers.size === 2) {
        dragId = null; // pinch başladı, tekil sürüklemeyi iptal et
        pinchStartDist = pointerDistance();
        pinchStartVb = { ...svg.__vb };
      }
    });

    svg.addEventListener("pointermove", (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.size === 2 && pinchStartDist) {
        const dist = pointerDistance();
        const factor = pinchStartDist / Math.max(dist, 1);
        const pts = [...pointers.values()];
        const midClientX = (pts[0].x + pts[1].x) / 2;
        const midClientY = (pts[0].y + pts[1].y) / 2;
        svg.__vb = { ...pinchStartVb };
        const focus = svgPointFromClient(svg, midClientX, midClientY);
        applyZoom(svg, focus, factor);
        return;
      }

      if (dragId === e.pointerId && dragStart) {
        const rect = svg.getBoundingClientRect();
        const scale = dragStart.vb.w / rect.width;
        const dx = (e.clientX - dragStart.clientX) * scale;
        const dy = (e.clientY - dragStart.clientY) * scale;
        svg.__vb.x = dragStart.vb.x - dx;
        svg.__vb.y = dragStart.vb.y - dy;
        setViewBox(svg);
      }
    });

    function endPointer(e) {
      pointers.delete(e.pointerId);
      if (e.pointerId === dragId) {
        dragId = null;
        dragStart = null;
        svg.classList.remove("panning");
      }
      if (pointers.size < 2) {
        pinchStartDist = null;
        pinchStartVb = null;
      }
      // Pinch'ten tek parmağa dönüldüyse kalan parmakla pan'a devam et.
      if (pointers.size === 1) {
        const [id, pt] = [...pointers.entries()][0];
        dragId = id;
        dragStart = { clientX: pt.x, clientY: pt.y, vb: { ...svg.__vb } };
      }
    }

    svg.addEventListener("pointerup", endPointer);
    svg.addEventListener("pointercancel", endPointer);
    svg.addEventListener("pointerleave", (e) => {
      if (e.pointerId === dragId) endPointer(e);
    });
  }

  // ---------- PNG dışa aktarma ----------
  //
  // Etkileşimli haritada aynı anda tek bir çağrışımın 4 soru-cevap yaprağı
  // açık olabiliyor (ekranda yer yok). PNG'de bu kısıt yok — dışa aktarılan
  // görüntüde HER sembolün altın çağrışımı ve 4 soru cevabı aynı anda,
  // sembolün etrafında açık halde çiziliyor. Etkileşimli render()'dan bağımsız,
  // kendi geometrisini kuran ayrı bir çizim: tüm stiller CSS sınıflarına değil
  // satır-içi (inline) SVG özniteliklerine dayanıyor — <img>/canvas'a
  // rasterize ederken sayfanın harici stylesheet'ine (ve Google Fonts gibi
  // dış kaynaklara, olası canvas "tainting" riskine karşı) bağımlı olmamak
  // için bilinçli bir tercih.

  // Taban ölçüler ~8 sembole göre kalibre edildi. Sembol sayısı arttıkça
  // (özellikle 4 soru cevabı + altın çağrışım aynı anda çizildiği için)
  // düğümler birbirinin içine geçmeye başlıyordu — çünkü sabit yarıçapta bir
  // sembole düşen açısal yay payı sembol sayısıyla ters orantılı küçülüyor,
  // ama etiket genişliği sabit kalıyor. Çözüm: yarıçapı (ve tuvali) sembol
  // sayısıyla ORANTILI büyütmek — bu, sembol başına düşen yay UZUNLUĞUNU
  // (açı × yarıçap) sembol sayısından bağımsız, sabit tutar.
  const BASE_N = 8;
  // 4 soru-cevap yaprağı PNG'den kaldırılınca en dış halka artık altın
  // çağrışım (ASSOC_R) oldu — tuval de ona göre daraltıldı, eskiden Q_R'a
  // göre ayrılmış geniş boş kenar boşluğu kalmasın diye.
  //
  // 1200 değeri (kenar boşluğu 240px) uzun çağrışım etiketleriyle (26 karakter,
  // 17px font, start/end hizalı) yetersiz kaldı — metin kenardan taşıp kesildi
  // (Kaan'ın bulduğu hata, 2026-09-10). EX_ASSOC_R/EXPORT_SIZE oranı sembol
  // sayısından bağımsız sabit kaldığı için bu, her ölçekte aynı oranda
  // yaşanıyordu. 1440'a çıkarmak kenar boşluğunu 360px'e çıkarıyor — en kötü
  // durum metin genişliğinin (~300px) güvenle üzerinde.
  const BASE_EXPORT_SIZE = 1440;
  const BASE_CENTER_R = 66;
  const BASE_SYMBOL_R = 230;
  const BASE_ASSOC_R = 360;
  const MAX_RADIAL_SCALE = 3; // aşırı sembol sayısında (25+) tuvali sınırsız büyütmeyi engelle

  const PALETTE = {
    bg: "#0e1015",
    card: "#1c1f27",
    ink: "#e9e4d8",
    muted: "#9d9788",
    accent: "#9c7a4a",
    accentStrong: "#c49a5f",
    gold: "#e0ab52",
    ring: "#3a352b",
    ringSoft: "#26221a",
  };
  // Rapor/yazdırma için ayrı, aydınlık palet — koyu zeminli export kâğıda
  // basılınca hem mürekkep israf eder hem kötü görünür. Aynı yapı, ters
  // kontrast: gravür çizgileri koyu, altın çağrışım koyulaştırılmış (açık
  // kâğıtta okunabilir kalsın diye).
  const PALETTE_PAPER = {
    bg: "#f8f4e9",
    card: "#fffdf7",
    ink: "#241f16",
    muted: "#6b6252",
    accent: "#7a5a2e",
    accentStrong: "#5e4322",
    gold: "#96692a",
    ring: "#cdbfa0",
    ringSoft: "#e2d6b8",
  };
  // Google Fonts (Cormorant Garamond/Inter) sayfanın <link>'i üzerinden
  // yükleniyor; dışa aktarılan SVG bağımsız bir data-URI olarak
  // rasterize edildiği için o kaynağa erişemeyebilir — burada güvenli,
  // yerel yedek fontlar kullanılıyor.
  const EX_FONT_HEAD = "Georgia, 'Times New Roman', serif";
  const EX_FONT_BODY = "system-ui, -apple-system, 'Segoe UI', sans-serif";

  function exportPointAt(cx, cy, radius, angleDeg) {
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad),
      cos: Math.cos(rad),
      sin: Math.sin(rad),
    };
  }

  function labelAttrs(extra, P = PALETTE) {
    // Halo stroke-width font-size'a göre orantılı olmalı — sabit 5px, küçük
    // fontta (özellikle "—" gibi ince glifli kısa metinlerde) harfi bir
    // yumruya dönüştürüp okunmaz kılıyordu.
    const fontSize = extra["font-size"] || 14;
    return Object.assign(
      {
        "font-family": EX_FONT_BODY,
        "paint-order": "stroke",
        stroke: P.bg,
        "stroke-width": Math.max(2.5, fontSize * 0.3),
        "stroke-linejoin": "round",
      },
      extra
    );
  }

  function buildExportSvg(record, theme = "dark") {
    const P = theme === "paper" ? PALETTE_PAPER : PALETTE;
    const symbols = record.symbols || [];
    const n = symbols.length || 1;

    // Sembol sayısı taban değerin (8) üzerindeyse yarıçapları (ve tuvali)
    // orantılı büyüt — bkz. yukarıdaki BASE_N yorumu.
    const radialScale = Math.min(MAX_RADIAL_SCALE, Math.max(1, n / BASE_N));
    const EXPORT_SIZE = Math.round(BASE_EXPORT_SIZE * radialScale);
    const EX_CX = EXPORT_SIZE / 2;
    const EX_CY = EXPORT_SIZE / 2;
    const EX_CENTER_R = BASE_CENTER_R * radialScale;
    const EX_SYMBOL_R = BASE_SYMBOL_R * radialScale;
    const EX_ASSOC_R = BASE_ASSOC_R * radialScale;
    const pt = (radius, angleDeg) => exportPointAt(EX_CX, EX_CY, radius, angleDeg);

    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${EXPORT_SIZE} ${EXPORT_SIZE}`);
    svg.setAttribute("width", EXPORT_SIZE);
    svg.setAttribute("height", EXPORT_SIZE);

    svg.appendChild(el("rect", { x: 0, y: 0, width: EXPORT_SIZE, height: EXPORT_SIZE, fill: P.bg }));

    // Filtre id'si render()'daki gibi uid'li değil, sabit "sm-gold-glow" —
    // ama exportPng her çağrıda yeni, DOM'a hiç eklenmeyen bağımsız bir <svg>
    // üretiyor (bkz. svgToPngDownload), o yüzden aynı sayfada iki export SVG'i
    // aynı anda bulunmuyor ve çakışma riski yok (render()'daki interaktif
    // haritadan farklı olarak, o ikisi aynı DOM'da birlikte durabiliyor).
    const defs = el("defs", {});
    const glow = el("filter", { id: "sm-gold-glow", x: "-60%", y: "-60%", width: "220%", height: "220%" });
    glow.appendChild(el("feGaussianBlur", { stdDeviation: 5, result: "blur" }));
    const merge = el("feMerge", {});
    merge.appendChild(el("feMergeNode", { in: "blur" }));
    merge.appendChild(el("feMergeNode", { in: "SourceGraphic" }));
    glow.appendChild(merge);
    defs.appendChild(glow);
    // Etkileşimli haritadaki (render()) "boncuk" gradyanlarının export eşdeğeri —
    // düğümler düz renk yerine hafif hacimli, tutarlı görünsün diye.
    const nodeGrad = el("radialGradient", { id: "sm-ex-node", cx: "32%", cy: "28%", r: "75%" });
    nodeGrad.appendChild(el("stop", { offset: "0%", "stop-color": theme === "paper" ? "#efe6cf" : "#3c434d" }));
    nodeGrad.appendChild(el("stop", { offset: "100%", "stop-color": P.bg }));
    const goldNodeGrad = el("radialGradient", { id: "sm-ex-gold-node", cx: "32%", cy: "28%", r: "75%" });
    goldNodeGrad.appendChild(el("stop", { offset: "0%", "stop-color": P.gold }));
    goldNodeGrad.appendChild(el("stop", { offset: "100%", "stop-color": P.accent }));
    defs.appendChild(nodeGrad);
    defs.appendChild(goldNodeGrad);
    svg.appendChild(defs);

    svg.appendChild(
      el("circle", { cx: EX_CX, cy: EX_CY, r: EX_CENTER_R, fill: P.card, stroke: P.accent, "stroke-width": 2.5 })
    );
    svg.appendChild(
      el(
        "text",
        {
          x: EX_CX,
          y: EX_CY + 8,
          "text-anchor": "middle",
          fill: P.ink,
          "font-family": EX_FONT_HEAD,
          "font-size": 26,
          "font-weight": 600,
        },
        I18N.t("map.center")
      )
    );
    const slot = 360 / n;

    symbols.forEach((sym, i) => {
      const angleDeg = -90 + slot * i;
      const { x: sx, y: sy, cos, sin } = pt(EX_SYMBOL_R, angleDeg);
      const anchor = anchorFor(cos);
      const dx = anchor === "start" ? 16 : anchor === "end" ? -16 : 0;
      // pushOut 24 (önceden 20) — etiketler artık 2 satıra kadar sarabiliyor.
      const dy = verticalNudge(anchor, sin, 5, 24);

      svg.appendChild(
        el("line", { x1: EX_CX, y1: EX_CY, x2: sx, y2: sy, stroke: P.accent, "stroke-width": 1.75, opacity: 0.6 })
      );
      svg.appendChild(
        el("circle", { cx: sx, cy: sy, r: 13, fill: "url(#sm-ex-node)", stroke: P.accent, "stroke-width": 2.5 })
      );
      svg.appendChild(
        multilineText(
          labelAttrs(
            {
              x: sx + dx,
              y: sy + dy,
              "text-anchor": anchor,
              fill: P.accentStrong,
              "font-size": 16,
              "font-weight": 600,
            },
            P
          ),
          wrapForLabel(sym.name, 16, 2),
          19
        )
      );

      if (!sym.selected_association) return;

      const { x: ax, y: ay } = pt(EX_ASSOC_R, angleDeg);
      svg.appendChild(
        el("line", {
          x1: sx,
          y1: sy,
          x2: ax,
          y2: ay,
          stroke: P.gold,
          "stroke-width": 1.25,
          opacity: 0.45,
        })
      );
      svg.appendChild(
        el("circle", {
          cx: ax,
          cy: ay,
          r: 15,
          fill: "url(#sm-ex-gold-node)",
          stroke: P.gold,
          "stroke-width": 2,
          filter: "url(#sm-gold-glow)",
        })
      );
      svg.appendChild(
        multilineText(
          labelAttrs(
            {
              x: ax + dx,
              // pushOut 30 (önceden 24) — 2 satıra kadar sarabilen daha uzun
              // çağrışım etiketi için ek pay.
              y: ay + verticalNudge(anchor, sin, 6, 30),
              "text-anchor": anchor,
              fill: P.ink,
              "font-size": 17,
              "font-weight": 700,
            },
            P
          ),
          wrapForLabel(sym.selected_association, 18, 2),
          20
        )
      );
      // Kaan'ın isteğiyle: PNG'de 4 soru-cevap yaprağı artık çizilmiyor —
      // yoğun rüyalarda (çok sembollü) görsel gürültü yapıyordu. Harita
      // artık sadece rüya → sembol → altın çağrışım üçlüsünü gösteriyor;
      // 4 soru cevapları hâlâ uygulama içinde (interaktif haritada,
      // düğüme tıklayınca) ve çalışma sayfasında (bkz. buildWorksheetSvg)
      // görülebiliyor.
    });

    const dreamSnippet = truncate((record.dream_text || "").replace(/\s+/g, " ").trim(), 100);
    svg.appendChild(
      el(
        "text",
        {
          x: EX_CX,
          y: EXPORT_SIZE - 34,
          "text-anchor": "middle",
          fill: P.muted,
          "font-family": EX_FONT_BODY,
          "font-size": 15,
        },
        dreamSnippet
      )
    );
    svg.appendChild(
      el(
        "text",
        {
          x: EXPORT_SIZE - 24,
          y: EXPORT_SIZE - 14,
          "text-anchor": "end",
          fill: P.muted,
          "font-family": EX_FONT_BODY,
          "font-size": 12,
          opacity: 0.7,
        },
        I18N.t("map.watermark")
      )
    );

    return svg;
  }

  // ---------- Sembol Çalışma Sayfası ----------
  //
  // Harita "bütünü" taşır (sembol → altın çağrışım), bu ise "parçaları":
  // her sembolün kendi kartı, bağlamı, altın çağrışımı, diğer çağrışımları
  // ve 4 sorunun cevabıyla birlikte. Radyal değil — okunmak ve üzerine kafa
  // yorulmak için tek sütun, kart kart akan bir sayfa. Aynı satır-içi
  // öznitelik / harici-kaynak-yok felsefesini paylaşıyor (bkz. buildExportSvg
  // başındaki not) çünkü PNG dışa aktarımında kullanılıyor.

  const WS_WIDTH = 900;
  const WS_OUTER_PAD = 44;
  const WS_CARD_PAD = 28;
  const WS_CARD_GAP = 22;
  const WS_TITLE_H = 92;

  // Canvas ölçüm API'sine bağımlı olmadan (dışa aktarılan SVG bağımsız bir
  // data-URI olduğu için) kaba bir karakter-genişliği tahmini — mevcut
  // truncate() fonksiyonunun kullandığı karakter-sayımı yaklaşımıyla aynı
  // düzeyde pragmatik.
  function charsPerLine(fontSize, widthPx) {
    return Math.max(12, Math.floor(widthPx / (fontSize * 0.54)));
  }

  // wrapLines dosyanın başında (truncate()'in yanında) tanımlı — harita
  // düğüm etiketleri de aynı fonksiyonu kullanıyor.

  // Bir "alan"ın (mikro-etiket + değer) kaç satıra saracağını ve ne kadar
  // dikey yer tutacağını önceden hesaplar — kart arka planının yüksekliğini
  // metni çizmeden ÖNCE bilmemiz gerekiyor (bkz. buildWorksheetSvg'deki
  // iki geçişli düzen: önce ölçüm, sonra çizim).
  function layoutField(value, contentW, fontSize, lineHeight) {
    const lines = wrapLines(value, charsPerLine(fontSize, contentW));
    return { lines, height: lines.length ? 18 + lines.length * lineHeight + 12 : 0 };
  }

  function drawField(group, x, y, labelText, field, fontSize, lineHeight, fill, P, weight) {
    if (!field.lines.length) return y;
    group.appendChild(
      el(
        "text",
        { x, y: y + 13, "font-family": EX_FONT_BODY, "font-size": 11, "font-weight": 700, fill: P.accent, "letter-spacing": "0.08em" },
        labelText.toUpperCase()
      )
    );
    let ty = y + 13 + lineHeight;
    field.lines.forEach((line) => {
      group.appendChild(
        el(
          "text",
          { x, y: ty, "font-family": EX_FONT_BODY, "font-size": fontSize, "font-weight": weight || 400, fill },
          line
        )
      );
      ty += lineHeight;
    });
    return ty + 12;
  }

  function buildWorksheetSvg(record, theme = "dark") {
    const P = theme === "paper" ? PALETTE_PAPER : PALETTE;
    const symbols = record.symbols || [];
    const contentW = WS_WIDTH - WS_OUTER_PAD * 2 - WS_CARD_PAD * 2;

    // ---- Geçiş 1: sadece ölçüm — her kartın kaç satır tutacağını,
    // dolayısıyla ne kadar yükseklik gerektireceğini hesapla.
    const cardLayouts = symbols.map((sym) => {
      const context = layoutField(sym.context, contentW, 14, 19);
      const assoc = layoutField(sym.selected_association, contentW, 16, 21);
      const others = (sym.all_associations || []).filter((a) => a && a !== sym.selected_association);
      const othersField = layoutField(others.join(", "), contentW, 13, 18);
      const questions = QUESTIONS.map(([key, label]) => ({
        label,
        field: layoutField((sym.questions || {})[key], contentW, 14, 19),
      }));
      const qHeight = questions.reduce((sum, q) => sum + q.field.height, 0);
      const nameH = 40;
      const height =
        nameH + context.height + assoc.height + othersField.height + qHeight + WS_CARD_PAD * 2;
      return { sym, context, assoc, othersField, questions, height };
    });

    const totalCardsH = cardLayouts.reduce((sum, c) => sum + c.height + WS_CARD_GAP, 0);
    const totalHeight = WS_OUTER_PAD * 2 + WS_TITLE_H + totalCardsH;

    // ---- Geçiş 2: çizim — artık her kartın yüksekliği belli, arka plan
    // ve içeriği sırayla yerleştir.
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${WS_WIDTH} ${totalHeight}`);
    svg.setAttribute("width", WS_WIDTH);
    svg.setAttribute("height", totalHeight);

    svg.appendChild(el("rect", { x: 0, y: 0, width: WS_WIDTH, height: totalHeight, fill: P.bg }));
    svg.appendChild(
      el(
        "text",
        { x: WS_OUTER_PAD, y: WS_OUTER_PAD + 22, "font-family": EX_FONT_HEAD, "font-size": 28, "font-weight": 600, fill: P.ink },
        I18N.t("worksheet.title")
      )
    );
    const dreamSnippet = truncate((record.dream_text || "").replace(/\s+/g, " ").trim(), 110);
    svg.appendChild(
      el(
        "text",
        { x: WS_OUTER_PAD, y: WS_OUTER_PAD + 46, "font-family": EX_FONT_BODY, "font-size": 14, fill: P.muted },
        dreamSnippet
      )
    );

    let cardY = WS_OUTER_PAD + WS_TITLE_H;
    cardLayouts.forEach((card) => {
      const cardX = WS_OUTER_PAD;
      const cardW = WS_WIDTH - WS_OUTER_PAD * 2;
      const group = el("g", {});
      group.appendChild(
        el("rect", {
          x: cardX,
          y: cardY,
          width: cardW,
          height: card.height,
          rx: 10,
          fill: P.card,
          stroke: P.ring,
          "stroke-width": 1.5,
        })
      );
      group.appendChild(
        el("rect", { x: cardX, y: cardY, width: 5, height: card.height, rx: 2.5, fill: P.gold })
      );

      const tx = cardX + WS_CARD_PAD;
      let ty = cardY + WS_CARD_PAD;
      group.appendChild(
        el(
          "text",
          { x: tx, y: ty + 12, "font-family": EX_FONT_HEAD, "font-size": 22, "font-weight": 600, fill: P.accentStrong },
          truncate(card.sym.name, 46)
        )
      );
      ty += 40;

      ty = drawField(group, tx, ty, I18N.t("worksheet.context"), card.context, 14, 19, P.muted, P);
      ty = drawField(group, tx, ty, I18N.t("worksheet.goldAssoc"), card.assoc, 16, 21, P.ink, P, 700);
      ty = drawField(group, tx, ty, I18N.t("worksheet.otherAssoc"), card.othersField, 13, 18, P.muted, P);
      card.questions.forEach((q) => {
        ty = drawField(group, tx, ty, q.label, q.field, 14, 19, P.ink, P);
      });

      svg.appendChild(group);
      cardY += card.height + WS_CARD_GAP;
    });

    svg.appendChild(
      el(
        "text",
        { x: WS_WIDTH - WS_OUTER_PAD, y: totalHeight - 16, "text-anchor": "end", "font-family": EX_FONT_BODY, "font-size": 12, fill: P.muted, opacity: 0.7 },
        I18N.t("map.watermark")
      )
    );

    return svg;
  }

  // ---------- PNG dışa aktarma (ortak) ----------

  async function svgToPngDownload(svg, filenamePrefix) {
    const xml = new XMLSerializer().serializeToString(svg);
    const dataUrl = "data:image/svg+xml;charset=utf-8;base64," + btoa(unescape(encodeURIComponent(xml)));

    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error("SVG görüntüye çevrilemedi"));
      img.src = dataUrl;
    });

    const exportW = Number(svg.getAttribute("width"));
    const exportH = Number(svg.getAttribute("height"));
    const scale = 2; // yüksek çözünürlük için süper-örnekleme
    const canvas = document.createElement("canvas");
    canvas.width = exportW * scale;
    canvas.height = exportH * scale;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("PNG oluşturulamadı");

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const slug = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.href = url;
    a.download = `${filenamePrefix}-${slug}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function exportPng(record) {
    await svgToPngDownload(buildExportSvg(record, "dark"), "sembol-haritasi");
  }

  async function exportWorksheetPng(record) {
    await svgToPngDownload(buildWorksheetSvg(record, "dark"), "calisma-sayfasi");
  }

  return {
    render,
    buildMapSvg: buildExportSvg,
    buildWorksheetSvg,
    exportWorksheetPng,
    svgToString: (svg) => new XMLSerializer().serializeToString(svg),
    questionLabels: QUESTIONS,
    fonts: { head: EX_FONT_HEAD, body: EX_FONT_BODY },
  };
})();
