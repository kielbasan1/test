// Sembol çarkını SVG olarak çizen bağımsız modül.
// Bağımlılık yok; main.js state'i tutar, bu dosya sadece render eder.
//
// Akışkanlık için önemli tasarım kararı: aynı sembol üzerinde çalışırken
// (yeni çağrışım ekleme, "cuk oturan" oku seçme) SVG'yi baştan silip yeniden
// çizmiyoruz — bu her tıklamada görünür bir "flaş/yeniden çizim" hissi
// yaratır. Bunun yerine var olan ok elemanlarını (data-id ile eşleştirip)
// yerinde günceller, sadece GERÇEKTEN yeni bir çağrışım eklendiğinde yeni bir
// DOM elemanı oluştururuz. Böylece CSS geçişleri (renk, konum) yumuşakça
// oynar; sadece yeni oklar "güneş ışını gibi" büyüyerek belirir. Sembol
// değişince (kullanıcı başka bir sembole tıkladığında) çark tamamen
// yeniden kurulur, bu normal ve istenen bir davranıştır.
//
// SVG üç katmandan oluşur:
//   <defs>          — gradyanlar/parıltı filtresi, tek sefer kurulur, hiç silinmez.
//   <g class=frame> — dış kadran halkası + ortam parıltısı, tek sefer kurulur
//                      (sembol değişse de kalır, çünkü sembolden bağımsız).
//   <g class=dyn>   — merkez daire + oklar + kadran çentikleri; sembol
//                      değişince baştan kurulur, aynı sembolde güncellenir.

const SymbolWheel = (() => {
  const NS = "http://www.w3.org/2000/svg";
  const CX = 280;
  const CY = 280;
  const CENTER_R = 68;
  const TIP_R = 200;
  const LABEL_R = 230;
  const RIM_R = TIP_R + 20;
  const TICK_INNER_R = TIP_R + 8;
  const TICK_OUTER_R = TIP_R + 16;

  function el(tag, attrs, text) {
    const node = document.createElementNS(NS, tag);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function ensureDefs(svg) {
    if (svg.querySelector("defs")) return;
    const defs = el("defs", {});

    const centerGrad = el("radialGradient", {
      id: "wheelCenterGrad",
      cx: "35%",
      cy: "30%",
      r: "75%",
    });
    centerGrad.appendChild(el("stop", { offset: "0%", "stop-color": "#262b34" }));
    centerGrad.appendChild(el("stop", { offset: "100%", "stop-color": "#0e1015" }));

    const goldGrad = el("radialGradient", {
      id: "wheelGoldGrad",
      cx: "35%",
      cy: "30%",
      r: "70%",
    });
    goldGrad.appendChild(el("stop", { offset: "0%", "stop-color": "#f3d9a8" }));
    goldGrad.appendChild(el("stop", { offset: "100%", "stop-color": "#a97b3f" }));

    // Aletin gövdesi: sıcak mor değil, soğuk çelik/gunmetal ambient parıltı.
    const ambientGrad = el("radialGradient", {
      id: "wheelAmbientGrad",
      cx: "50%",
      cy: "50%",
      r: "50%",
    });
    ambientGrad.appendChild(
      el("stop", { offset: "0%", "stop-color": "#5a6472", "stop-opacity": "0.18" })
    );
    ambientGrad.appendChild(
      el("stop", { offset: "100%", "stop-color": "#5a6472", "stop-opacity": "0" })
    );

    // İkinci, pirinç tonlu ve merkezden kaydırılmış ışık lekesi — çelik
    // zemine karşı tek, sıcak bir kadran ışığı hissi verir.
    const ambientGoldGrad = el("radialGradient", {
      id: "wheelAmbientGoldGrad",
      cx: "68%",
      cy: "72%",
      r: "55%",
    });
    ambientGoldGrad.appendChild(
      el("stop", { offset: "0%", "stop-color": "#c49a5f", "stop-opacity": "0.12" })
    );
    ambientGoldGrad.appendChild(
      el("stop", { offset: "100%", "stop-color": "#c49a5f", "stop-opacity": "0" })
    );

    const glowFilter = el("filter", {
      id: "wheelArrowGlow",
      x: "-60%",
      y: "-60%",
      width: "220%",
      height: "220%",
    });
    glowFilter.appendChild(el("feGaussianBlur", { stdDeviation: "3.2", result: "blur" }));
    const merge = el("feMerge", {});
    merge.appendChild(el("feMergeNode", { in: "blur" }));
    merge.appendChild(el("feMergeNode", { in: "SourceGraphic" }));
    glowFilter.appendChild(merge);

    defs.appendChild(centerGrad);
    defs.appendChild(goldGrad);
    defs.appendChild(ambientGrad);
    defs.appendChild(ambientGoldGrad);
    defs.appendChild(glowFilter);
    svg.appendChild(defs);
  }

  function ensureFrame(svg) {
    if (svg.querySelector(".wheel-frame")) return;
    const frame = el("g", { class: "wheel-frame" });
    frame.appendChild(
      el("circle", { cx: CX, cy: CY, r: RIM_R + 34, class: "wheel-glow-bg" })
    );
    frame.appendChild(
      el("circle", {
        cx: CX,
        cy: CY,
        r: RIM_R + 50,
        class: "wheel-glow-bg-gold",
        fill: "url(#wheelAmbientGoldGrad)",
      })
    );
    frame.appendChild(el("circle", { cx: CX, cy: CY, r: RIM_R, class: "wheel-rim" }));
    frame.appendChild(el("circle", { cx: CX, cy: CY, r: TIP_R - 24, class: "wheel-rim-inner" }));
    svg.appendChild(frame);
  }

  function wrapCenterLabel(name) {
    if (name.length <= 12) return [name];
    const words = name.split(" ");
    if (words.length === 1) return [name];
    const mid = Math.ceil(words.length / 2);
    return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
  }

  function buildCenter(group, symbolName) {
    group.appendChild(el("circle", { cx: CX, cy: CY, r: CENTER_R + 10, class: "wheel-center-halo" }));
    group.appendChild(el("circle", { cx: CX, cy: CY, r: CENTER_R, class: "wheel-center-circle" }));
    const lines = wrapCenterLabel(symbolName);
    lines.forEach((line, i) => {
      const dy = (i - (lines.length - 1) / 2) * 18;
      group.appendChild(el("text", { x: CX, y: CY + dy + 5, class: "wheel-center-text" }, line));
    });
  }

  function createArrow(assoc, onSelect) {
    const group = el("g", {
      class: "wheel-arrow-group",
      "data-id": assoc.id,
      role: "button",
      tabindex: "0",
      "aria-label": assoc.text || "",
    });
    const hitArea = el("line", { class: "wheel-arrow-hitarea" });
    const line = el("line", { class: "wheel-arrow-line" });
    const tip = el("circle", { r: 7, class: "wheel-arrow-tip" });
    const tipHitArea = el("circle", { r: 18, class: "wheel-arrow-hitarea" });
    const label = el("text", { class: "wheel-arrow-label" });

    group.appendChild(hitArea);
    group.appendChild(line);
    group.appendChild(tipHitArea);
    group.appendChild(tip);
    group.appendChild(label);
    group.addEventListener("click", () => onSelect(assoc.id));
    group.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        onSelect(assoc.id);
      }
    });

    return { group, hitArea, line, tip, tipHitArea, label };
  }

  function positionArrow(refs, assoc, angleDeg) {
    const rad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const x1 = CX + CENTER_R * cos;
    const y1 = CY + CENTER_R * sin;
    const x2 = CX + TIP_R * cos;
    const y2 = CY + TIP_R * sin;
    const lx = CX + LABEL_R * cos;
    const ly = CY + LABEL_R * sin;

    let anchor = "middle";
    if (cos > 0.25) anchor = "start";
    else if (cos < -0.25) anchor = "end";

    for (const node of [refs.hitArea, refs.line]) {
      node.setAttribute("x1", x1);
      node.setAttribute("y1", y1);
      node.setAttribute("x2", x2);
      node.setAttribute("y2", y2);
    }
    for (const node of [refs.tip, refs.tipHitArea]) {
      node.setAttribute("cx", x2);
      node.setAttribute("cy", y2);
    }
    refs.label.setAttribute("x", lx);
    refs.label.setAttribute("y", ly);
    refs.label.setAttribute("text-anchor", anchor);
    refs.label.textContent = assoc.text;

    const selected = !!assoc.selected;
    refs.line.classList.toggle("selected", selected);
    refs.tip.classList.toggle("selected", selected);
    refs.label.classList.toggle("selected", selected);
  }

  // Kadranın etrafına, her okun açısı hizasına küçük bir çentik çizer —
  // bir pusula/kadran hissi verir. Sadece pozisyon taşıdığı için (durum
  // yok) her render'da sıfırdan kurulur, arrow'lardaki gibi kalıcı
  // eşleştirmeye ihtiyaç duymaz.
  function buildTicks(group, n) {
    for (let i = 0; i < n; i++) {
      const angleDeg = -90 + (360 / n) * i;
      const rad = (angleDeg * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      group.appendChild(
        el("line", {
          x1: CX + TICK_INNER_R * cos,
          y1: CY + TICK_INNER_R * sin,
          x2: CX + TICK_OUTER_R * cos,
          y2: CY + TICK_OUTER_R * sin,
          class: "wheel-tick",
        })
      );
    }
  }

  function render(svg, symbolName, associations, onSelect) {
    ensureDefs(svg);
    ensureFrame(svg);

    let dyn = svg.querySelector(".wheel-dynamic");
    if (svg.dataset.symbol !== symbolName || !dyn) {
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
        arrowsLayer.appendChild(refs.group);
        arrows.set(assoc.id, refs);
      }
      positionArrow(refs, assoc, angleDeg);
    });
  }

  return { render };
})();
