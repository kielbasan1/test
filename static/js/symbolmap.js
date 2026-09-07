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
// aynı — export/buildExportText'in beklediği şekille de örtüşür):
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

  function pointAt(radius, angleDeg) {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad), cos: Math.cos(rad) };
  }

  function makeNode(x, y, r, labelText, anchor, dx, cls) {
    const group = el("g", { class: `map-node ${cls}` });
    group.appendChild(el("circle", { cx: x, cy: y, r, class: `map-node-circle ${cls}` }));
    group.appendChild(
      el("text", { x: x + dx, y: y + 4, "text-anchor": anchor, class: "map-label" }, labelText)
    );
    return group;
  }

  function render(svg, record) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.__nodes = new Map(); // id -> { data: {sym, angleDeg}, assocGroup, symGroup }
    svg.__expandedId = null;

    svg.appendChild(el("circle", { cx: CX, cy: CY, r: CENTER_R, class: "map-center-circle" }));
    svg.appendChild(el("text", { x: CX, y: CY + 5, class: "map-center-text" }, "Rüya"));

    const layer = el("g", { class: "map-flower-layer" });

    const symbols = record.symbols || [];
    const n = symbols.length || 1;

    symbols.forEach((sym, i) => {
      const id = `s${i}`;
      const angleDeg = -90 + (360 / n) * i;
      const { x: sx, y: sy, cos } = pointAt(SYMBOL_R, angleDeg);
      const anchor = anchorFor(cos);
      const dx = anchor === "start" ? 14 : anchor === "end" ? -14 : 0;

      svg.appendChild(
        el("line", { x1: CX, y1: CY, x2: sx, y2: sy, class: "map-edge map-edge-symbol" })
      );
      const symGroup = makeNode(sx, sy, 11, truncate(sym.name, 18), anchor, dx, "symbol");
      symGroup.addEventListener("click", () => toggleExpand(svg, id));
      svg.appendChild(symGroup);

      let assocGroup = null;
      if (sym.selected_association) {
        const { x: ax, y: ay } = pointAt(ASSOC_R, angleDeg);
        svg.appendChild(
          el("line", { x1: sx, y1: sy, x2: ax, y2: ay, class: "map-edge map-edge-assoc" })
        );
        assocGroup = makeNode(
          ax,
          ay,
          8,
          truncate(sym.selected_association, 22),
          anchor,
          dx,
          "assoc"
        );
        assocGroup.addEventListener("click", () => toggleExpand(svg, id));
        svg.appendChild(assocGroup);
      }

      svg.__nodes.set(id, { data: { sym, angleDeg }, symGroup, assocGroup });
    });

    svg.appendChild(layer);
    svg.__flowerLayer = layer;

    initPanZoom(svg);
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
      const { x: qx, y: qy, cos } = pointAt(Q_R, qAngle);
      const anchor = anchorFor(cos);
      const dx = anchor === "start" ? 12 : anchor === "end" ? -12 : 0;

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
          { x: qx + dx, y: qy + 4, "text-anchor": anchor, class: "map-label map-label-q" },
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
    const mkBtn = (label, title, onClick) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "map-zoom-btn";
      btn.textContent = label;
      btn.title = title;
      btn.setAttribute("aria-label", title);
      btn.addEventListener("click", onClick);
      return btn;
    };
    const center = () => ({
      x: svg.__vb.x + svg.__vb.w / 2,
      y: svg.__vb.y + svg.__vb.h / 2,
    });
    controls.appendChild(mkBtn("+", "Yakınlaştır", () => applyZoom(svg, center(), 0.8)));
    controls.appendChild(mkBtn("−", "Uzaklaştır", () => applyZoom(svg, center(), 1.25)));
    controls.appendChild(
      mkBtn("⟲", "Görünümü sıfırla", () => {
        svg.__vb = { ...svg.__vbBase };
        setViewBox(svg);
      })
    );
    wrap.appendChild(controls);

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

  return { render };
})();
