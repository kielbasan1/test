// Sembol Haritası — rüyanın "bütün + parça" görünümü, sunburst (çember) düzeni.
//
// Amaç yorum yapmak değil, kullanıcının kendi bağlantıyı kendi kurabilmesi.
// Her sembol tam bir dilim (merkezden kenara); dilimde SADECE iki halka var:
// içte altın çağrışım, dışta sembol adı. Referans: Kaan'ın gönderdiği sunburst
// mockup'ı (2026-09-10) — yapı oradan, içerik değil (mockup metinleri örnek).
//
// Neden sadece iki halka: 6 halkalı ilk sürümde metinler okunamayacak kadar
// sıkışıyordu. "Less is more" (Kaan, 2026-09-11): çember tek bakışta bütünü
// verir, 4 soru ve TAM cevapları bir altın çağrışıma TIKLANINCA dışarıda
// açılan dört kutuda görünür (aynı anda yalnızca bir sembolünki açık kalır).
// Resim/rapor olarak dışa aktarıldığında bu kutular hiç çizilmez — çıktıda
// yalnızca sembol adı + altın çağrışım olur.
//
// Değişmez kural: hiçbir hücrede metin kesilmez. Sığmıyorsa font kademeli
// küçültülür (bkz. fitCellText); bu, 1-20 sembol × tüm açık kutular için
// otomatik testle doğrulanıyor.
//
// Veri şekli (main.js'deki state.lastRecord / geçmişten gelen record ile
// aynı — export/rapor/çalışma sayfasının beklediği şekille de örtüşür):
//   { dream_text, symbols: [{ name, context, selected_association,
//     all_associations, questions: {q1..q4} }] }

const SymbolMap = (() => {
  const NS = "http://www.w3.org/2000/svg";

  const QUESTIONS = [
    ["q1", "Bu içimde hangi parçam?"],
    ["q2", "Hayatımdaki işlevi ne / nereyi yönetiyor?"],
    ["q3", "Kişiliğimin neresinde bunu görüyorum?"],
    ["q4", "Kim içimde böyle davranıyor?"],
  ];

  // İÇTEN DIŞA sıralı — çizim merkezden başlıyor. Dıştan içe okunuşu:
  // sembol adı (en dış) → altın çağrışım (içte).
  //
  // Çemberde SADECE bu iki alan var (Kaan'ın son kararı, 2026-09-11):
  // "less is more" — her hücre bol yer bulsun, metinler kesilmeden tam
  // görünsün. 4 soru ve tam cevapları, bir altın çağrışıma TIKLANINCA
  // dışarıda açılan 4 kutuda görünüyor (bkz. Q_BAND / expandedIndex);
  // resim olarak dışa aktarılırken bu kutular hiç çizilmiyor.
  const RING_ORDER = ["assoc", "name"];
  // Halkanın iç/dış kenarından ne kadarını metin için "kullanılamaz" pay
  // bırakacağımız (komşu halkayla net bir ayrım için) ve satırlar arası
  // minimum boşluğun font boyutunun kaç katı olacağı — ikisi de hem satır
  // sayısı hesabında (maxLines) hem de gerçek yerleşimde (drawRadialCellText)
  // aynı sayılar kullanılsın diye paylaşılıyor.
  const RING_TEXT_PAD = 0.15;
  const RING_LINE_GAP = 1.6;

  function el(tag, attrs, text) {
    const node = document.createElementNS(NS, tag);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function truncate(text, max) {
    if (!text) return "";
    return text.length > max ? text.slice(0, max - 1) + "…" : text;
  }

  // Kelime bazlı sarma — karakter sayımı gerçek metin genişliği ölçmüyor,
  // charsPerLine()'ın kaba yay-uzunluğu tahminiyle aynı pragmatizmde.
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
  // son gösterilen satırı "…" ile işaretler.
  function wrapForLabel(text, maxCharsPerLine, maxLines) {
    const all = wrapLines(text, maxCharsPerLine);
    const shown = all.slice(0, maxLines);
    if (all.length > shown.length && shown.length) {
      shown[shown.length - 1] = shown[shown.length - 1] + "…";
    }
    return shown;
  }

  // Canvas ölçüm API'sine bağımlı olmadan (dışa aktarılan SVG bağımsız bir
  // data-URI olduğu için) kaba bir karakter-genişliği tahmini. 0.54 gerçek
  // glif genişliğini (özellikle Türkçe ğ/ş/İ gibi karakterlerle) hafife
  // alıyordu — sunburst'ün dar iç halkalarında komşu dilime taşmaya yol
  // açtı (Kaan'ın 15 sembollü testinde canlıda görüldü), 0.68'e çıkarıldı.
  // Taban 3'e indirildi (önceki 6, çalışma sayfasının geniş kartları için
  // hiç bağlayıcı olmayan bir taban gerçek sunburst darlığında satırı
  // gereğinden uzun tutup taşmaya zorluyordu).
  function charsPerLine(fontSize, widthPx) {
    return Math.max(5, Math.floor(widthPx / (fontSize * 0.6)));
  }

  function polar(cx, cy, r, angleDeg) {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  // Bir halka-dilim hücresinin (annular sector) dış hattı — standart SVG ark
  // yolu: dış yayı bir yönde, iç yayı ters yönde çizip kapatıyor (donut
  // dilimi). r0 < r1, a0 < a1 (derece) varsayılır.
  function sectorPath(cx, cy, r0, r1, a0, a1) {
    const largeArc = a1 - a0 > 180 ? 1 : 0;
    const p0 = polar(cx, cy, r0, a0);
    const p1 = polar(cx, cy, r1, a0);
    const p2 = polar(cx, cy, r1, a1);
    const p3 = polar(cx, cy, r0, a1);
    return [
      `M ${p0.x} ${p0.y}`,
      `L ${p1.x} ${p1.y}`,
      `A ${r1} ${r1} 0 ${largeArc} 1 ${p2.x} ${p2.y}`,
      `L ${p3.x} ${p3.y}`,
      `A ${r0} ${r0} 0 ${largeArc} 0 ${p0.x} ${p0.y}`,
      "Z",
    ].join(" ");
  }

  // Bir hücrenin metnini (birden fazla satır olabilir) GERÇEK bir yay
  // boyunca çizer — düz bir <text>'i rotate() ile döndürmek yerine (eski
  // yöntem), her satır için görünmez bir yay <path> tanımlayıp metni
  // <textPath> ile o yayın üzerine oturtuyoruz. Fark önemli: düz/döndürülmüş
  // metin, hücrenin eğri sınırından bir "kiriş" gibi sapıyordu — özellikle
  // iç (küçük yarıçaplı, yüksek eğrilikli) halkalarda metnin uçları komşu
  // dilime taşıyordu. Yay üzerindeki metin bu sapmayı yapısal olarak ortadan
  // kaldırır (Kaan'ın "yazılar çemberin eğimiyle eğilmemiş" gözlemi,
  // 2026-09-10).
  //
  // Yay boyunca akan metinde çevirme kriteri ÜST/ALT yarıdır, sol/sağ değil:
  // üstte saat yönü soldan sağa akar (düz okunur), altta ise saat yönü
  // sağdan sola akar — o yüzden SADECE alt yarıda (0°-180°, yani sin>0) yayın
  // çizim yönü ters çevrilir (a1→a0). İlk sürümde kriter yanlışlıkla sol yarı
  // (90°-270°) idi; bu yüzden tam alttaki dilimler baş aşağı kalıyor, kimi
  // düz kimi ters görünüyordu (Kaan'ın gözlemi, 2026-09-11).
  function drawRadialCellText(svg, defs, arcIdPrefix, lines, cx, cy, r0, r1, a0, a1, fontSize, fill, haloColor) {
    const shown = lines.length ? lines : ["—"];
    const n = shown.length;
    // Metni r0..r1'in TAMAMINA değil, ortadaki bir kısmına sığdır — aksi
    // halde bir halkanın son satırı bir sonraki halkanın ilk satırına
    // neredeyse değiyor, ikisi aynı açısal doğrultuda (aynı "ışın") olduğu
    // için tek bir kesintisiz metin bloğu gibi görünüyor.
    const pad = (r1 - r0) * RING_TEXT_PAD;
    const ir0 = r0 + pad;
    const ir1 = r1 - pad;
    const band = (ir1 - ir0) / n;
    const amid = (a0 + a1) / 2;
    const norm = ((amid % 360) + 360) % 360;
    const flip = norm > 0 && norm < 180;
    const start = flip ? a1 : a0;
    const end = flip ? a0 : a1;
    const largeArc = Math.abs(end - start) > 180 ? 1 : 0;
    const sweep = end > start ? 1 : 0;
    shown.forEach((line, i) => {
      // Satır sırası da yarıya göre değişir: üst yarıda ekranda "daha
      // yukarısı" merkeze UZAK olan yarıçaptır, alt yarıda ise merkeze
      // YAKIN olan. İlk satır her zaman görsel olarak üstte kalsın diye
      // üst yarıda dıştan içe, alt yarıda içten dışa diziyoruz.
      const r = flip ? ir0 + band * (i + 0.5) : ir1 - band * (i + 0.5);
      const p0 = polar(cx, cy, r, start);
      const p1 = polar(cx, cy, r, end);
      const pathId = `${arcIdPrefix}-${i}`;
      defs.appendChild(
        el("path", { id: pathId, d: `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${largeArc} ${sweep} ${p1.x} ${p1.y}` })
      );
      const text = el("text", {
        fill,
        "font-family": EX_FONT_BODY,
        "font-size": fontSize,
        "paint-order": "stroke",
        stroke: haloColor,
        "stroke-width": Math.max(1.5, fontSize * 0.22),
        "stroke-linejoin": "round",
      });
      text.appendChild(el("textPath", { href: `#${pathId}`, startOffset: "50%", "text-anchor": "middle" }, line));
      svg.appendChild(text);
    });
  }

  // Bir hücrenin metnini TAM göstermeye çalışır: taban font boyutuyla
  // sığmıyorsa fontu kademeli küçültür (Kaan'ın izniyle — "biri büyük punto
  // diğeri küçük punto olabilir, sığdırmak için sıkıntı yok", 2026-09-11).
  // Küçültmek iki yönden birden yardım eder: satır başına daha çok karakter
  // sığar VE her satır daha az dikey yer kaplar. Ancak en küçük boyutta bile
  // sığmıyorsa son çare olarak keser (…), aksi halde metin hücreden taşardı.
  function fitCellText(text, r0, r1, a0, a1, baseFontSize, maxChars, minFactor) {
    const insetThickness = (r1 - r0) * (1 - 2 * RING_TEXT_PAD);
    // İç kenardan (r0) hesapla, orta yarıçaptan değil — hücredeki en dar
    // yay orası, en güvenli taban.
    const arcAtRing = ((a1 - a0) * Math.PI) / 180 * r0 * 0.75;
    const minFontSize = baseFontSize * (minFactor || 0.55);
    for (let fontSize = baseFontSize; fontSize >= minFontSize; fontSize -= 0.5) {
      const chars = Math.min(maxChars, charsPerLine(fontSize, arcAtRing));
      const lines = wrapLines(text, chars);
      const maxLines = Math.max(1, Math.floor(insetThickness / (fontSize * RING_LINE_GAP)));
      if (lines.length <= maxLines) return { lines, fontSize };
    }
    const chars = Math.min(maxChars, charsPerLine(minFontSize, arcAtRing));
    const maxLines = Math.max(1, Math.floor(insetThickness / (minFontSize * RING_LINE_GAP)));
    return { lines: wrapForLabel(text, chars, maxLines), fontSize: minFontSize };
  }

  function cellText(sym, key) {
    if (key === "name") return sym.name || "";
    if (key === "assoc") return sym.selected_association || "";
    return (sym.questions || {})[key] || "";
  }

  // Halkaların göreli kalınlığı — iç halka (Q1) dıştakilere göre daha az
  // yay uzunluğuna sahip (yarıçap küçük) ama cevabı genelde daha uzun bir
  // cümle, bu yüzden ona daha fazla RADYAL kalınlık (daha çok satır
  // sığdırma payı) veriliyor; dış halkalar (isim/çağrışım) zaten geniş yay
  // uzunluğuna sahip olduğu için ince kalabiliyor. 6 halkadan 3'e inince
  // (bkz. RING_ORDER) her halkaya düşen pay ciddi büyüdü, font boyutları da
  // buna göre yukarı çekildi.
  const RING_WEIGHT = { assoc: 2.3, name: 1.25 };
  const HUB_WEIGHT = 1.15;
  // Tıklanınca açılan 4 soru kutusu: en dış halkanın dışında, dört eş
  // kalınlıkta bant. Sadece etkileşimli haritada ve sadece açık olan
  // sembol için çizilir; PNG/rapor çıktısında hiç yer almaz.
  const Q_BAND_WEIGHT = 2.1; // her soru kutusunun kalınlığı (unit cinsinden)
  const Q_BAND_MIN_DEG = 140; // dar dilimlerde bile kutular bu kadar geniş açılır
  // Kutunun ne kadarı cevaba ayrılacak — cevap sorudan uzun olduğu için
  // aslan payı cevapta (ilk denemede tersiydi, cevaplar kesiliyordu).
  const Q_ANSWER_SHARE = 0.66;
  // Font boyutu BİLEREK unit'e (yarıçapa) bağlı değil, sabit — sembol
  // sayısı arttıkça unit'i (ve yarıçapı) büyütüp fontu SABİT tutmak, bir
  // dilime düşen karakter bütçesini gerçekten artıran tek şey. İkisi
  // birlikte ölçeklenseydi (ilk denemede olduğu gibi) oran hiç değişmez,
  // dar dilimlerde metin komşu dilime taşardı — bu, Kaan'ın 15 sembollü
  // test verisiyle canlıda görülüp düzeltildi (2026-09-10).
  const RING_FONT = {
    interactive: { name: 15, assoc: 13.5, question: 11, answer: 12.5 },
    export: { name: 28, assoc: 25, question: 20, answer: 23 },
  };
  // Satır başına karakter tavanı — sadece çok geniş dilimlerde (az sembollü
  // rüya) bir satırın çemberin üçte birini kaplamasını engellemek için var;
  // asıl sınırlayıcı yay uzunluğu hesabı (bkz. fitCellText). Otomatik font
  // küçültme bu tavana takılıp boşa çalışmasın diye cömert tutuldu.
  const RING_MAXCHARS = { name: 36, assoc: 46, question: 52, answer: 52 };

  // Sembol sayısı taban değerin (8) üzerindeyse yarıçapı (ve tuvali)
  // orantılı büyüt — bir sembole düşen yay uzunluğunu sembol sayısından
  // bağımsız tutmaya çalışır (font sabit kaldığı için gerçekten işe yarar).
  function radialScaleFor(n) {
    return Math.min(3, Math.max(1, n / 8));
  }

  function ringRadii(hubR, unit) {
    const radii = {};
    let r = hubR;
    RING_ORDER.forEach((key) => {
      const t = RING_WEIGHT[key] * unit;
      radii[key] = [r, r + t];
      r += t;
    });
    return { radii, outerR: r };
  }

  // Bir altın çağrışıma tıklandığında, o sembolün dört sorusunu ve TAM
  // cevaplarını dış halkanın dışında dört kutu olarak çizer. Kutular
  // dilimden daha geniş bir açıya yayılabilir (Q_BAND_MIN_DEG) — aynı anda
  // sadece bir sembol açık olduğu için komşu dilimlerle çakışma riski yok,
  // bu da uzun cevaplara bol yer bırakıyor. Her kutu iki parçaya bölünür:
  // dışta soru (küçük punto, vurgu rengi), içte cevap (normal punto).
  function drawQuestionBand(svg, defs, arcPrefix, sym, cx, cy, outerR, unit, a0, a1, P, fonts) {
    const amid = (a0 + a1) / 2;
    const span = Math.max(a1 - a0, Q_BAND_MIN_DEG);
    const qa0 = amid - span / 2;
    const qa1 = amid + span / 2;
    const t = Q_BAND_WEIGHT * unit;
    const band = el("g", { class: "map-question-band" });

    QUESTIONS.forEach(([key, label], qi) => {
      const r0 = outerR + 22 + qi * t;
      const r1 = r0 + t * 0.9; // kutular arasında ince boşluk
      const path = sectorPath(cx, cy, r0, r1, qa0, qa1);
      band.appendChild(
        el("path", { d: path, fill: P.card, stroke: P.gold, "stroke-width": 1.25, "fill-opacity": 0.96 })
      );

      const answer = (sym.questions || {})[key];
      const shownAnswer = answer && answer.trim() ? answer : "—";
      // Kutunun içi cevap (büyük pay), dış şeridi soru.
      const split = r0 + (r1 - r0) * Q_ANSWER_SHARE;
      const qFit = fitCellText(label, split, r1, qa0, qa1, fonts.question, RING_MAXCHARS.question, 0.4);
      drawRadialCellText(band, defs, `${arcPrefix}-${qi}-s`, qFit.lines, cx, cy, split, r1, qa0, qa1, qFit.fontSize, P.accentStrong, P.card);
      const aFit = fitCellText(shownAnswer, r0, split, qa0, qa1, fonts.answer, RING_MAXCHARS.answer, 0.4);
      drawRadialCellText(band, defs, `${arcPrefix}-${qi}-c`, aFit.lines, cx, cy, r0, split, qa0, qa1, aFit.fontSize, P.ink, P.card);
    });

    svg.appendChild(band);
  }

  // Bir dilim çemberini tam olarak çizer (kadran halkası + tüm sembol
  // dilimleri + merkez göbek) — 15'ten fazla sembolde birden fazla kez
  // çağrılıp alt alta dizilir (bkz. buildSunburstSvg).
  function drawOneCircle(svg, defs, arcPrefix, symbols, cx, cy, unit, P, fonts, interactive, centerGradId, ambientGradId, centerLabel, expandedIndex, onExpand) {
    const n = symbols.length || 1;
    const hubR = HUB_WEIGHT * unit;
    const { radii, outerR } = ringRadii(hubR, unit);

    if (interactive) {
      svg.appendChild(
        el("circle", { cx, cy, r: outerR + 26, class: "map-glow-bg", fill: `url(#${ambientGradId})` })
      );
    }

    // Gravürlü dış kadran halkası — Astrolab dilinin bu haritada da
    // sürmesi için (bkz. .map-rim CSS'i, yavaşça dönen kesikli çizgi).
    svg.appendChild(
      el("circle", { cx, cy, r: outerR + 14, fill: "none", stroke: P.ring, "stroke-width": 1, class: interactive ? "map-rim" : "" })
    );

    const slot = 360 / n;
    // Dilimler arası ince boşluk — çok sembolde otomatik daralır, hiç
    // kaybolmaz (dilimlerin birbirine değmesini önler).
    const gapDeg = Math.min(2.2, slot * 0.1);

    symbols.forEach((sym, i) => {
      const a0 = -90 + slot * i + gapDeg / 2;
      const a1 = -90 + slot * (i + 1) - gapDeg / 2;

      const group = el("g", { class: interactive ? "map-sector-group" : "" });
      if (interactive) group.style.setProperty("--i", i);

      const isOpen = expandedIndex === i;

      RING_ORDER.forEach((key) => {
        const [r0, r1] = radii[key];
        const isAssoc = key === "assoc";
        const path = sectorPath(cx, cy, r0, r1, a0, a1);
        const cell = el("path", {
          d: path,
          fill: i % 2 === 0 ? P.card : P.bg,
          stroke: P.ring,
          "stroke-width": 1,
        });
        group.appendChild(cell);
        if (isAssoc) {
          group.appendChild(
            el("path", {
              d: path,
              fill: P.gold,
              "fill-opacity": isOpen ? 0.34 : 0.16,
              stroke: isOpen ? P.gold : "none",
              "stroke-width": isOpen ? 2 : 0,
            })
          );
        }

        const fit = fitCellText(cellText(sym, key), r0, r1, a0, a1, fonts[key], RING_MAXCHARS[key], 0.42);
        const fill = isAssoc ? P.ink : P.accentStrong;
        drawRadialCellText(group, defs, `${arcPrefix}-${i}-${key}`, fit.lines, cx, cy, r0, r1, a0, a1, fit.fontSize, fill, P.bg);

        // Altın çağrışım hücresi tıklanabilir: 4 soru kutusunu açar/kapatır.
        if (isAssoc && interactive && onExpand) {
          const hit = el("path", {
            d: path,
            fill: "transparent",
            class: "map-assoc-hit",
            role: "button",
            tabindex: "0",
            "aria-label": `${sym.name || ""} — ${I18N.t("map.openQuestions")}`,
          });
          hit.addEventListener("click", (e) => {
            e.stopPropagation();
            onExpand(isOpen ? null : i);
          });
          hit.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
              e.preventDefault();
              onExpand(isOpen ? null : i);
            }
          });
          group.appendChild(hit);
        }
      });

      svg.appendChild(group);

      if (isOpen && interactive) {
        drawQuestionBand(svg, defs, `${arcPrefix}-q${i}`, sym, cx, cy, outerR, unit, a0, a1, P, fonts);
      }
    });

    svg.appendChild(
      el("circle", {
        cx,
        cy,
        r: hubR,
        class: interactive ? "map-center-circle" : "",
        stroke: P.accent,
        "stroke-width": 2.5,
        style: `fill:url(#${centerGradId})`,
      })
    );
    svg.appendChild(
      el(
        "text",
        Object.assign(
          {
            x: cx,
            y: cy + hubR * 0.1,
            "text-anchor": "middle",
            "dominant-baseline": "middle",
            "font-family": EX_FONT_HEAD,
            "font-size": Math.max(13, hubR * 0.32),
            "font-weight": 600,
          },
          interactive ? { class: "map-center-text" } : { fill: P.ink }
        ),
        centerLabel
      )
    );

    return outerR;
  }

  // ---------- Ana çizim — hem etkileşimli harita hem PNG/rapor export'u bu
  // tek fonksiyonu kullanıyor, sadece boyut/tema/etkileşim farklı. ----------
  //
  // 15'ten fazla sembolde tek çembere sıkıştırmak yerine (Kaan'ın kararı,
  // 2026-09-10) ikinci/üçüncü bir çember üretilip altına diziliyor — her
  // çember en fazla 15 sembol taşır, aynı rüyanın farklı bir "sayfası" gibi.
  const MAX_SYMBOLS_PER_CIRCLE = 15;

  function buildSunburstSvg(record, opts) {
    const { theme = "dark", interactive = false, existingSvg = null, expandedIndex = null } = opts || {};
    const P = theme === "paper" ? PALETTE_PAPER : PALETTE;
    const allSymbols = record.symbols || [];
    const fonts = RING_FONT[interactive ? "interactive" : "export"];
    const marginBase = interactive ? 30 : 130; // export'ta alt yazı (özet+watermark) için daha geniş pay
    const circleGap = interactive ? 60 : 150;

    const chunks = [];
    for (let i = 0; i < allSymbols.length; i += MAX_SYMBOLS_PER_CIRCLE) {
      chunks.push(allSymbols.slice(i, i + MAX_SYMBOLS_PER_CIRCLE));
    }
    if (!chunks.length) chunks.push([]);

    const unitBase = interactive ? 58 : 120;
    const geoms = chunks.map((chunk) => {
      const n = chunk.length || 1;
      const unit = unitBase * radialScaleFor(n);
      const { outerR } = ringRadii(HUB_WEIGHT * unit, unit);
      // Etkileşimli haritada soru kutuları için dışarıda yer AYRILIR (hiçbir
      // şey açık değilken boş durur ama tuval yeniden boyutlanmasın diye
      // baştan hesaba katılıyor); dışa aktarımda böyle bir bant hiç yok.
      const qBandR = interactive ? 22 + 4 * Q_BAND_WEIGHT * unit : 0;
      return { chunk, unit, outerR, reachR: outerR + 14 + qBandR };
    });

    const width = Math.round(Math.max(...geoms.map((g) => g.reachR * 2)) + marginBase * 2);
    let cursorY = marginBase;
    const placed = geoms.map((g, idx) => {
      const cy = cursorY + g.reachR;
      cursorY = cy + g.reachR + (idx < geoms.length - 1 ? circleGap : 0);
      return Object.assign({}, g, { cx: width / 2, cy });
    });
    const height = Math.round(cursorY + marginBase);

    const svg = existingSvg || document.createElementNS(NS, "svg");
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);
    if (!interactive) {
      svg.appendChild(el("rect", { x: 0, y: 0, width, height, fill: P.bg }));
    }

    // Aynı sayfada birden fazla harita (sonuç ekranı + geçmiş detayı) aynı
    // anda DOM'da bulunabiliyor — gradyan id'leri belge genelinde çözüldüğü
    // için her çizime özel bir önek şart. Tüm çemberler (birden fazlaysa)
    // aynı iki gradyanı paylaşır, tema aynı olduğu için ayrı tanıma gerek yok.
    const uid = `sm${++uidCounter}`;
    const centerGradId = `${uid}-center`;
    const ambientGradId = `${uid}-ambient`;

    const defs = el("defs", {});
    const centerGrad = el("radialGradient", { id: centerGradId, cx: "35%", cy: "30%", r: "75%" });
    centerGrad.appendChild(el("stop", { offset: "0%", "stop-color": theme === "paper" ? "#fffdf7" : "#262b34" }));
    centerGrad.appendChild(el("stop", { offset: "100%", "stop-color": P.bg }));
    defs.appendChild(centerGrad);
    if (interactive) {
      const ambientGrad = el("radialGradient", { id: ambientGradId, cx: "50%", cy: "50%", r: "50%" });
      ambientGrad.appendChild(el("stop", { offset: "0%", "stop-color": "#5a6472", "stop-opacity": "0.14" }));
      ambientGrad.appendChild(el("stop", { offset: "100%", "stop-color": "#5a6472", "stop-opacity": "0" }));
      defs.appendChild(ambientGrad);
    }
    svg.appendChild(defs);

    // Tıklanınca (veya kapanınca) haritayı aynı elemanın içine yeniden çiz;
    // aynı anda yalnızca tek bir sembolün soru kutuları açık kalır.
    const onExpand = interactive
      ? (globalIdx) => {
          const vb = svg.__vb ? { ...svg.__vb } : null;
          buildSunburstSvg(record, { theme, interactive: true, existingSvg: svg, expandedIndex: globalIdx });
          if (vb) {
            svg.__vb = vb;
            svg.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
          }
        }
      : null;

    placed.forEach((pc, idx) => {
      const centerLabel = chunks.length > 1 ? `${I18N.t("map.center")} ${idx + 1}/${chunks.length}` : I18N.t("map.center");
      const offset = idx * MAX_SYMBOLS_PER_CIRCLE;
      const localExpanded =
        expandedIndex !== null && expandedIndex >= offset && expandedIndex < offset + pc.chunk.length
          ? expandedIndex - offset
          : null;
      drawOneCircle(
        svg,
        defs,
        `${uid}-c${idx}`,
        pc.chunk,
        pc.cx,
        pc.cy,
        pc.unit,
        P,
        fonts,
        interactive,
        centerGradId,
        ambientGradId,
        centerLabel,
        localExpanded,
        onExpand ? (localIdx) => onExpand(localIdx === null ? null : offset + localIdx) : null
      );
    });

    if (!interactive) {
      const dreamSnippet = truncate((record.dream_text || "").replace(/\s+/g, " ").trim(), 100);
      svg.appendChild(
        el(
          "text",
          { x: width / 2, y: height - 34, "text-anchor": "middle", fill: P.muted, "font-family": EX_FONT_BODY, "font-size": 15 },
          dreamSnippet
        )
      );
      svg.appendChild(
        el(
          "text",
          { x: width - 24, y: height - 14, "text-anchor": "end", fill: P.muted, "font-family": EX_FONT_BODY, "font-size": 12, opacity: 0.7 },
          I18N.t("map.watermark")
        )
      );
    }

    if (interactive) {
      svg.__record = record;
      initPanZoom(svg);
    }

    return svg;
  }

  let uidCounter = 0;

  function render(svg, record) {
    buildSunburstSvg(record, { theme: "dark", interactive: true, existingSvg: svg });
  }

  function buildExportSvg(record, theme = "dark") {
    return buildSunburstSvg(record, { theme, interactive: false });
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
      // Altın çağrışım hücresine basıldıysa pan başlatma ve pointer'ı
      // yakalama — yoksa setPointerCapture click olayını SVG'ye taşıyıp
      // hücrenin kendi tıklamasını (4 soruyu açma) yutuyor.
      if (e.target.closest && e.target.closest(".map-assoc-hit")) return;
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

  // ---------- Renk paletleri ----------

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

  // ---------- Sembol Çalışma Sayfası ----------
  //
  // Çember "bütünü" taşır (sembol → altın çağrışım → 4 soru, hepsi tek
  // bakışta), bu ise "parçaları" okumak/üzerine not almak isteyenler için:
  // her sembolün kendi kartı, bağlamı, altın çağrışımı, diğer çağrışımları
  // ve 4 sorunun cevabıyla birlikte. Radyal değil — tek sütun, kart kart
  // akan bir sayfa. Aynı satır-içi öznitelik / harici-kaynak-yok
  // felsefesini paylaşıyor (bkz. buildSunburstSvg başındaki not) çünkü PNG
  // dışa aktarımında kullanılıyor.

  const WS_WIDTH = 900;
  const WS_OUTER_PAD = 44;
  const WS_CARD_PAD = 28;
  const WS_CARD_GAP = 22;
  const WS_TITLE_H = 92;

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
