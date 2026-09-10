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
    // Kâğıt & kalem: göbek koyu metal değil, sayfanın kendisi.
    centerGrad.appendChild(el("stop", { offset: "0%", "stop-color": "#fbf7ed" }));
    centerGrad.appendChild(el("stop", { offset: "100%", "stop-color": "#efe8d8" }));

    // Seçili ok ucu: parlayan altın değil, ikinci kalemin sepya mürekkebi.
    const goldGrad = el("radialGradient", {
      id: "wheelGoldGrad",
      cx: "35%",
      cy: "30%",
      r: "70%",
    });
    goldGrad.appendChild(el("stop", { offset: "0%", "stop-color": "#b0793d" }));
    goldGrad.appendChild(el("stop", { offset: "100%", "stop-color": "#7d4f24" }));

    // Kâğıdın üstüne düşen çok hafif gölge — "parıltı" değil.
    const ambientGrad = el("radialGradient", {
      id: "wheelAmbientGrad",
      cx: "50%",
      cy: "50%",
      r: "50%",
    });
    ambientGrad.appendChild(
      el("stop", { offset: "0%", "stop-color": "#8c764e", "stop-opacity": "0.1" })
    );
    ambientGrad.appendChild(
      el("stop", { offset: "100%", "stop-color": "#8c764e", "stop-opacity": "0" })
    );

    const ambientGoldGrad = el("radialGradient", {
      id: "wheelAmbientGoldGrad",
      cx: "68%",
      cy: "72%",
      r: "55%",
    });
    ambientGoldGrad.appendChild(
      el("stop", { offset: "0%", "stop-color": "#8a5a2b", "stop-opacity": "0.07" })
    );
    ambientGoldGrad.appendChild(
      el("stop", { offset: "100%", "stop-color": "#8a5a2b", "stop-opacity": "0" })
    );

    defs.appendChild(centerGrad);
    defs.appendChild(goldGrad);
    defs.appendChild(ambientGrad);
    defs.appendChild(ambientGoldGrad);
    defs.appendChild(Ink.handDrawnFilter("wheelInkWobble", 1.6));
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
    // Düz <line> yerine hafifçe yaylı bir <path>: kalemle çekilmiş bir çizgi
    // hiçbir zaman tam düz olmaz. Ayrıca teknik bir zorunluluk — dikey/yatay
    // bir <line>'ın sınırlayıcı kutusu sıfır genişlikte olduğu için üzerine
    // uygulanan SVG filtresi (elle çizilmiş sapma) onu tamamen görünmez
    // yapıyordu; yay bu sorunu da ortadan kaldırıyor.
    const line = el("path", { class: "wheel-arrow-line", fill: "none" });
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

  // Basit, kararlı bir string→sayı karması: aynı çağrışım her zaman aynı
  // eğriyi alsın diye (Math.random olsaydı her çizimde değişirdi).
  function hashSeed(str) {
    let h = 0;
    for (let i = 0; i < String(str).length; i++) {
      h = (h * 31 + String(str).charCodeAt(i)) % 100000;
    }
    return h;
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

    refs.hitArea.setAttribute("x1", x1);
    refs.hitArea.setAttribute("y1", y1);
    refs.hitArea.setAttribute("x2", x2);
    refs.hitArea.setAttribute("y2", y2);

    // Okun yayı: orta noktadan çizgiye DİK yönde küçük bir sapma. Sapmanın
    // yönü ve miktarı çağrışımın id'sinden türetiliyor — böylece her ok kendi
    // eğrisini korur (her yeniden çizimde zıplamaz) ama oklar birbirinin
    // kopyası da olmaz.
    const seed = hashSeed(assoc.id);
    const bow = ((seed % 100) / 100 - 0.5) * 22; // ±11 birim — eğri fark edilsin
    const mx = (x1 + x2) / 2 - sin * bow;
    const my = (y1 + y2) / 2 + cos * bow;
    refs.line.setAttribute("d", `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`);
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
