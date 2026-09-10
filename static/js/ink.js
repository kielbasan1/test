// Elle çizilmiş mürekkep hissi — çark ve harita ortak kullanır.
//
// Kâğıt & kalem temasında çizgilerin cetvelle çekilmiş gibi durmaması
// gerekiyor (Kaan: "elle çizilmiş gibi değil, ona da dikkat edelim").
// Bunu boyayarak değil, SVG filtresiyle yapıyoruz: feTurbulence ile düşük
// frekanslı bir gürültü üretip feDisplacementMap ile çizgiyi o gürültü
// kadar yerinden oynatıyoruz — sonuç, kalemin tam düz gitmemesi.
//
// Sadece ÇİZGİ/DOLGU elemanlarına uygulanır, metne ASLA: displacement
// harflerin kenarını bozup okunurluğu düşürüyor.
const Ink = (() => {
  const NS = "http://www.w3.org/2000/svg";

  function el(tag, attrs) {
    const node = document.createElementNS(NS, tag);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    return node;
  }

  // scale: sapmanın piksel cinsinden büyüklüğü. 1.5 civarı "elle çizilmiş"
  // okunuyor; 3'ün üstü titrek/bozuk görünmeye başlıyor.
  function handDrawnFilter(id, scale) {
    const filter = el("filter", {
      id,
      // Sapma kenarlardan taşabildiği için filtre kutusu elemandan geniş.
      x: "-6%",
      y: "-6%",
      width: "112%",
      height: "112%",
      filterUnits: "objectBoundingBox",
    });
    filter.appendChild(
      el("feTurbulence", {
        type: "fractalNoise",
        baseFrequency: "0.018",
        numOctaves: "2",
        seed: "7",
        result: "noise",
      })
    );
    filter.appendChild(
      el("feDisplacementMap", {
        in: "SourceGraphic",
        in2: "noise",
        scale: String(scale || 1.6),
        xChannelSelector: "R",
        yChannelSelector: "G",
      })
    );
    return filter;
  }

  return { handDrawnFilter };
})();
