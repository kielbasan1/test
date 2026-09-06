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

const SymbolWheel = (() => {
  const NS = "http://www.w3.org/2000/svg";
  const CX = 280;
  const CY = 280;
  const CENTER_R = 65;
  const TIP_R = 205;
  const LABEL_R = 232;

  function el(tag, attrs, text) {
    const node = document.createElementNS(NS, tag);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function wrapCenterLabel(name) {
    if (name.length <= 12) return [name];
    const words = name.split(" ");
    if (words.length === 1) return [name];
    const mid = Math.ceil(words.length / 2);
    return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
  }

  function buildCenter(svg, symbolName) {
    svg.appendChild(
      el("circle", { cx: CX, cy: CY, r: CENTER_R, class: "wheel-center-circle" })
    );
    const lines = wrapCenterLabel(symbolName);
    lines.forEach((line, i) => {
      const dy = (i - (lines.length - 1) / 2) * 18;
      svg.appendChild(el("text", { x: CX, y: CY + dy + 5, class: "wheel-center-text" }, line));
    });
  }

  function createArrow(assoc, onSelect) {
    const group = el("g", { class: "wheel-arrow-group", "data-id": assoc.id });
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

  function render(svg, symbolName, associations, onSelect) {
    if (svg.dataset.symbol !== symbolName) {
      // Farklı bir sembole geçildi: çarkı tamamen baştan kur.
      svg.dataset.symbol = symbolName;
      svg.__arrows = new Map();
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      buildCenter(svg, symbolName);
    }

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

    const n = associations.length;
    associations.forEach((assoc, i) => {
      const angleDeg = -90 + (360 / n) * i;
      let refs = arrows.get(assoc.id);
      if (!refs) {
        refs = createArrow(assoc, onSelect);
        svg.appendChild(refs.group);
        arrows.set(assoc.id, refs);
      }
      positionArrow(refs, assoc, angleDeg);
    });
  }

  return { render };
})();
