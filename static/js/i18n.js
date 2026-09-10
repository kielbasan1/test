// Arayüz dili (TR/EN) — sadece arayüz metinleri çevriliyor. Rüya metni,
// Gemini'ye giden promptlar ve Gemini'den dönen (extract/synthesis/amplify)
// içerik her zaman aynı kalır; kullanıcı hangi dilde yazarsa yazsın, model
// zaten o dilde yanıt veriyor — bu dosya o boru hattına dokunmaz.
//
// Yöntem: her statik metin `data-i18n="anahtar"` (textContent),
// `data-i18n-placeholder="anahtar"` ya da `data-i18n-aria="anahtar"`
// taşıyor. `applyLanguage()` DOM'u tarayıp bu anahtarları sözlükten
// dolduruyor. Dinamik olarak JS'in ürettiği metinler (durum mesajları,
// buton varyantları, geçmiş listesi vb.) kendi render fonksiyonlarında
// doğrudan `I18N.t(key)` çağırıyor — o yüzden dil değişince main.js
// `symbolcarki:langchange` olayını dinleyip ilgili render'ları tekrar
// çalıştırıyor.

const I18N = (() => {
  const STORAGE_KEY = "symbolCarki.lang";
  const DEFAULT_LANG = "tr";

  const STRINGS = {
    tr: {
      "page.title": "Sembol Çarkı — Jungiyen Rüya Analizi",
      "brand.name": "Sembol Çarkı",
      "brand.subtitle": "Robert Johnson'ın \"Inner Work\" yöntemiyle rüya sembol amplifikasyonu",
      "login.pageTitle": "Giriş — Sembol Çarkı",
      "login.subtitle": "Devam etmek için şifreni gir",
      "login.password": "Şifre",
      "login.submit": "Giriş Yap",
      "header.history": "Geçmiş Rüyalarım",
      "header.import": "Dosyadan Aç",
      "header.importTitle": "Dosyadan bir rüya kaydı (.json ya da .txt) aç",
      "header.loadDraft": "Taslak Yükle",
      "header.loadDraftTitle": "Yorumlanmamış bir taslak (.json) yükle — sembolleri/çağrışımları yeniden yazmadan Yorum adımına geçersin",
      "header.newDream": "Yeni Rüya Başlat",
      "header.logout": "Çıkış Yap",
      "history.heading": "Geçmiş Rüyalarım",
      "history.empty": "Henüz kaydedilmiş bir rüya yok.",
      "history.backToList": "Listeye dön",
      "dream.heading": "Rüyanı Yaz",
      "onboard.body": "Bu uygulama Robert Johnson'ın rüya çalışması yöntemini adım adım senin için açar — yöntemi önceden bilmen gerekmiyor. Rüyanı yazacaksın, çıkan her sembol için kendi çağrışımlarını ekleyeceksin, sonunda hem görsel bir harita hem de (istersen) bir yapay zeka bakış açısı göreceksin.",
      "onboard.dismiss": "Anladım",
      "dream.textareaPlaceholder": "Rüyanı hatırladığın kadarıyla, detaylarıyla buraya yaz...",
      "dream.contextLabel": "Bu rüyayı neden bu gece görmüş olabilirsin?",
      "dream.contextHint": "(opsiyonel — bugün/bu aralar yaşadığın bir şey, bir kaygı, bir karar)",
      "dream.contextPlaceholder": "Örn: yarın önemli bir karar vermem gerekiyor, gerginim...",
      "dream.extract": "Sembolleri Çıkar",
      "dream.status.empty": "Önce rüyanı yaz.",
      "dream.status.extracting": "Semboller çıkarılıyor...",
      "dream.status.found": "{n} sembol bulundu.",
      "symbols.back": "Rüyaya dön",
      "symbols.heading": "Semboller",
      "symbols.hint": "Bir sembole tıklayıp çarkını aç, sonra kendi çağrışımlarını serbestçe ekle. AI bir sembolü atladıysa aşağıdan elle ekleyebilirsin.",
      "symbols.dreamRecapHeading": "Rüyan",
      "symbols.progress": "{done} / {total} sembolde çağrışım seçildi.",
      "symbols.manualPlaceholder": "Atlanan bir sembol varsa buraya yaz (örn. saat)",
      "symbols.addSymbol": "Sembol Ekle",
      "symbols.chipRemove": "{name} sembolünü kaldır",
      "symbols.removed": "\"{name}\" ve o sembole ait çağrışımlar/cevaplar kaldırıldı.",
      "symbols.undo": "Geri Al",
      "symbols.start": "Sembollerle Başla →",
      "symbols.continue": "Devam Et →",
      "symbols.goToInterpretation": "Yoruma Geç →",
      "wheel.back": "Tüm sembollere dön",
      "wheel.title": "Sembol Çarkı — {name}",
      "wheel.context": "Rüyadaki bağlam: {context}",
      "wheel.assocPlaceholder": "Bu sembol seni neye götürüyor? (çağrışımını yaz)",
      "wheel.addAssoc": "Ok Ekle",
      "wheel.assocHint": "Aşağıdakilerden sana en çok \"oturan\" — en tanıdık, en doğru gelen — çağrışımına tıkla: o ok altın rengine dönecek.",
      "wheel.editAssoc": "\"{text}\" çağrışımını düzenle",
      "wheel.removeAssoc": "\"{text}\" çağrışımını sil",
      "wheel.amplify": "Sembolün anlamını bulamadım, amplifiye et",
      "wheel.amplifying": "Amplifiye ediliyor…",
      "wheel.nextSymbol": "Sonraki Sembol →",
      "fourQ.heading": "Seçtiğin çağrışımı derinleştir",
      "fourQ.why": "Bu sorular seçtiğin çağrışımı senin gerçek hayatına bağlar — Johnson'ın yönteminde yorumu doğrulayan asıl adım burasıdır.",
      "fourQ.q1": "Bu içimde hangi parçam?",
      "fourQ.q2": "Hayatımdaki işlevi ne / nereyi yönetiyor?",
      "fourQ.q3": "Kişiliğimin neresinde bunu görüyorum?",
      "fourQ.q4": "Kim içimde böyle davranıyor?",
      "finalize.back": "Sembollere dön",
      "finalize.heading": "Yorum",
      "finalize.hint": "Tüm sembollerde bir çağrışım seçtiğinde bu adım aktif olur. Devam edersen kişisel çağrışımların ve (gerektiğinde modelin kendi bilgisinden gelen) amplifikasyonla birlikte son bir Jungiyen yorum üretilecek.",
      "finalize.submit": "Yorumu Oluştur",
      "finalize.saveDraft": "Taslak Kaydet (.json)",
      "finalize.draftSaved": "Taslak indirildi.",
      "finalize.status.synthesizing": "Yorum sentezleniyor...",
      "finalize.status.done": "Tamamlandı.",
      "result.heading": "Yorum",
      "result.frame": "Bu, çağrışımların ve modelin bilgisinden derlenmiş bir bakış açısı — son söz değil. Kendi yorumunla karşılaştır.",
      "result.report": "Rapor (Yazdır/PDF)",
      "result.downloadJson": "Yedek İndir (.json)",
      "result.copy": "Kopyala",
      "result.copied": "Kopyalandı",
      "result.copyError": "Kopyalanamadı, metni elle seçip kopyalayabilirsin.",
      "history.dreamHeading": "Rüya",
      "result.hint": "Sunucudaki kayıt geçici olabilir (ücretsiz hosting'te silinebilir) — .json yedeğini indirip \"Dosyadan Aç\" ile istediğin an (bu haritayla birlikte) geri açabilirsin.",
      "import.invalidJson": "Bu dosya geçerli bir JSON değil — dosya bozulmuş ya da elle düzenlenirken bir yer bozulmuş olabilir.",
      "import.missingSections": "Bu .txt dosyasında beklenen bölüm(ler) bulunamadı: {sections}. Format eski/değişmiş olabilir — en güvenilir yol sonuç ekranındaki \".json\" yedeğini kullanmak.",
      "import.missingFields": "Dosya okundu ama beklenen alanlar (rüya metni, semboller) eksik veya hatalı görünüyor.",
      "import.error": "Dosya okunamadı, tekrar dener misin?",
      "loadDraft.invalid": "Bu dosya geçerli bir taslak gibi görünmüyor.",
      "loadDraft.error": "Taslak okunamadı, tekrar dener misin?",
      "result.mapHeading": "Sembol Haritası",
      "result.mapHint": "Her sembol kendi dilimi: dışta sembol adı, içte altın çağrışım. Altın çağrışıma tıkla — o sembolün 4 sorusu ve tam cevapları dışarıda açılır. Sürükleyerek kaydır, tekerlek/iki parmakla yakınlaştır.",
      "step.label": "Adım {index}/{total} · {name}",
      "step.done": "{prefix} — tamamlandı ✓",
      "step.symbolsDone": "{prefix} — {done}/{total} sembolde çağrışım seçildi",
      "step.name.dream": "Rüya",
      "step.name.symbols": "Semboller",
      "step.name.wheel": "Çark",
      "step.name.finalize": "Yorum",
      "step.name.result": "Sonuç",
      "map.zoomIn": "Yakınlaştır",
      "map.zoomOut": "Uzaklaştır",
      "map.reset": "Görünümü sıfırla",
      "map.openQuestions": "4 soruyu aç",
      "map.exportPng": "Harita PNG indir",
      "map.exportWorksheet": "Çalışma Sayfası PNG indir",
      "map.exportPreparing": "Hazırlanıyor…",
      "map.exportError": "Harita PNG olarak oluşturulamadı, tekrar dener misin?",
      "map.exportWorksheetError": "Çalışma sayfası PNG olarak oluşturulamadı, tekrar dener misin?",
      "map.center": "Rüya",
      "map.watermark": "Sembol Çarkı",
      "worksheet.title": "Sembol Çalışma Sayfası",
      "worksheet.context": "Bağlam",
      "worksheet.goldAssoc": "Altın Çağrışım",
      "worksheet.otherAssoc": "Diğer Çağrışımlar",
      "report.title": "Rüya Kaydı",
      "report.coverSymbolCount": "sembol",
      "report.dreamHeading": "Rüya",
      "report.contextHeading": "Bu rüyayı neden bu gece görmüş olabilirim",
      "report.mapHeading": "Sembol Haritası",
      "report.cardsHeading": "Sembol Çalışma Sayfası",
      "report.interpretationHeading": "Yorum",
      "report.printButton": "Yazdır / PDF olarak kaydet",
      "report.popupBlocked": "Rapor penceresi açılamadı — tarayıcının açılır pencere engelleyicisine izin vermen gerekebilir.",
      "lang.toggleLabel": "EN",
      "lang.toggleTitle": "Switch to English",
    },
    en: {
      "page.title": "Symbol Wheel — Jungian Dream Analysis",
      "brand.name": "Symbol Wheel",
      "brand.subtitle": "Dream symbol amplification using Robert Johnson's \"Inner Work\" method",
      "login.pageTitle": "Log In — Symbol Wheel",
      "login.subtitle": "Enter your password to continue",
      "login.password": "Password",
      "login.submit": "Log In",
      "header.history": "Past Dreams",
      "header.import": "Open from File",
      "header.importTitle": "Open a dream record (.json or .txt) from a file",
      "header.loadDraft": "Load Draft",
      "header.loadDraftTitle": "Load an un-interpreted draft (.json) — skip straight to the Interpretation step without retyping symbols/associations",
      "header.newDream": "Start New Dream",
      "header.logout": "Log Out",
      "history.heading": "Past Dreams",
      "history.empty": "No dreams saved yet.",
      "history.backToList": "Back to list",
      "dream.heading": "Write Your Dream",
      "onboard.body": "This app walks you through Robert Johnson's dream-work method step by step — you don't need to know it beforehand. You'll write your dream, add your own associations for each symbol that comes up, and end with a visual map plus, if you want it, an AI perspective.",
      "onboard.dismiss": "Got it",
      "dream.textareaPlaceholder": "Write your dream here, with as much detail as you remember...",
      "dream.contextLabel": "Why might you have had this dream tonight?",
      "dream.contextHint": "(optional — something you're going through, a worry, a decision)",
      "dream.contextPlaceholder": "E.g.: I have an important decision to make tomorrow, I'm anxious...",
      "dream.extract": "Extract Symbols",
      "dream.status.empty": "Write your dream first.",
      "dream.status.extracting": "Extracting symbols...",
      "dream.status.found": "{n} symbols found.",
      "symbols.back": "Back to dream",
      "symbols.heading": "Symbols",
      "symbols.hint": "Click a symbol to open its wheel, then freely add your own associations. If the AI missed a symbol, add it by hand below.",
      "symbols.dreamRecapHeading": "Your dream",
      "symbols.progress": "{done} / {total} symbols have a chosen association.",
      "symbols.manualPlaceholder": "If a symbol was missed, write it here (e.g. clock)",
      "symbols.addSymbol": "Add Symbol",
      "symbols.chipRemove": "Remove symbol {name}",
      "symbols.removed": "\"{name}\" and its associations/answers were removed.",
      "symbols.undo": "Undo",
      "symbols.start": "Start With Symbols →",
      "symbols.continue": "Continue →",
      "symbols.goToInterpretation": "Go to Interpretation →",
      "wheel.back": "Back to all symbols",
      "wheel.title": "Symbol Wheel — {name}",
      "wheel.context": "Context in the dream: {context}",
      "wheel.assocPlaceholder": "Where does this symbol take you? (write your association)",
      "wheel.addAssoc": "Add Arrow",
      "wheel.assocHint": "Click whichever association \"clicks\" the most — feels most familiar or true — and that arrow will turn gold.",
      "wheel.editAssoc": "Edit association \"{text}\"",
      "wheel.removeAssoc": "Remove association \"{text}\"",
      "wheel.amplify": "I couldn't find the symbol's meaning, amplify it",
      "wheel.amplifying": "Amplifying…",
      "wheel.nextSymbol": "Next Symbol →",
      "fourQ.heading": "Deepen the association you chose",
      "fourQ.why": "These questions tie your chosen association to your actual life — this is the step in Johnson's method that confirms an interpretation.",
      "fourQ.q1": "Which part of me is this?",
      "fourQ.q2": "What is its function in my life / what does it govern?",
      "fourQ.q3": "Where in my personality do I see this?",
      "fourQ.q4": "Who inside me behaves like this?",
      "finalize.back": "Back to symbols",
      "finalize.heading": "Interpretation",
      "finalize.hint": "This step activates once you've chosen an association for every symbol. Continuing will produce a final Jungian interpretation using your personal associations and, where needed, amplification drawn from the model's own knowledge.",
      "finalize.submit": "Create Interpretation",
      "finalize.saveDraft": "Save Draft (.json)",
      "finalize.draftSaved": "Draft downloaded.",
      "finalize.status.synthesizing": "Synthesizing interpretation...",
      "finalize.status.done": "Done.",
      "result.heading": "Interpretation",
      "result.frame": "This is one lens drawn from your associations and the model's knowledge — not the final word. Compare it with your own reading.",
      "result.report": "Report (Print/PDF)",
      "result.downloadJson": "Download Backup (.json)",
      "result.copy": "Copy",
      "result.copied": "Copied",
      "result.copyError": "Couldn't copy — you can select and copy the text by hand.",
      "history.dreamHeading": "Dream",
      "result.hint": "The server copy may be temporary (free hosting can wipe it) — download the .json backup and reopen it anytime with \"Open from File\" (map included).",
      "import.invalidJson": "This file isn't valid JSON — it may be corrupted or was damaged while editing.",
      "import.missingSections": "This .txt file is missing expected section(s): {sections}. The format may be old or changed — the most reliable option is the \".json\" backup from the result screen.",
      "import.missingFields": "The file was read but the expected fields (dream text, symbols) look missing or malformed.",
      "import.error": "Couldn't read the file, want to try again?",
      "loadDraft.invalid": "This file doesn't look like a valid draft.",
      "loadDraft.error": "Couldn't read the draft, want to try again?",
      "result.mapHeading": "Symbol Map",
      "result.mapHint": "Each symbol is its own slice: symbol name outside, golden association inside. Click a golden association — that symbol's 4 questions and full answers open up around it. Drag to pan, scroll wheel / pinch to zoom.",
      "step.label": "Step {index}/{total} · {name}",
      "step.done": "{prefix} — done ✓",
      "step.symbolsDone": "{prefix} — {done}/{total} symbols have a chosen association",
      "step.name.dream": "Dream",
      "step.name.symbols": "Symbols",
      "step.name.wheel": "Wheel",
      "step.name.finalize": "Interpretation",
      "step.name.result": "Result",
      "map.zoomIn": "Zoom in",
      "map.zoomOut": "Zoom out",
      "map.reset": "Reset view",
      "map.openQuestions": "Open the 4 questions",
      "map.exportPng": "Download Map PNG",
      "map.exportWorksheet": "Download Worksheet PNG",
      "map.exportPreparing": "Preparing…",
      "map.exportError": "Couldn't render the map as a PNG, want to try again?",
      "map.exportWorksheetError": "Couldn't render the worksheet as a PNG, want to try again?",
      "map.center": "Dream",
      "map.watermark": "Symbol Wheel",
      "worksheet.title": "Symbol Worksheet",
      "worksheet.context": "Context",
      "worksheet.goldAssoc": "Golden Association",
      "worksheet.otherAssoc": "Other Associations",
      "report.title": "Dream Record",
      "report.coverSymbolCount": "symbols",
      "report.dreamHeading": "Dream",
      "report.contextHeading": "Why I may have had this dream tonight",
      "report.mapHeading": "Symbol Map",
      "report.cardsHeading": "Symbol Worksheet",
      "report.interpretationHeading": "Interpretation",
      "report.printButton": "Print / Save as PDF",
      "report.popupBlocked": "Couldn't open the report window — you may need to allow pop-ups for this site.",
      "lang.toggleLabel": "TR",
      "lang.toggleTitle": "Türkçe'ye geç",
    },
  };

  let lang = DEFAULT_LANG;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "tr" || saved === "en") lang = saved;
  } catch (_) {
    // localStorage erişilemez olabilir (gizli sekme vb.) — sessizce varsayılana düş.
  }

  function interpolate(str, vars) {
    if (!vars) return str;
    return str.replace(/\{(\w+)\}/g, (_, key) => (key in vars ? vars[key] : `{${key}}`));
  }

  function t(key, vars) {
    const table = STRINGS[lang] || STRINGS[DEFAULT_LANG];
    const str = table[key] ?? STRINGS[DEFAULT_LANG][key] ?? key;
    return interpolate(str, vars);
  }

  function getLang() {
    return lang;
  }

  function applyStaticDom(root = document) {
    root.querySelectorAll("[data-i18n]").forEach((elNode) => {
      elNode.textContent = t(elNode.getAttribute("data-i18n"));
    });
    root.querySelectorAll("[data-i18n-placeholder]").forEach((elNode) => {
      elNode.setAttribute("placeholder", t(elNode.getAttribute("data-i18n-placeholder")));
    });
    root.querySelectorAll("[data-i18n-aria]").forEach((elNode) => {
      elNode.setAttribute("aria-label", t(elNode.getAttribute("data-i18n-aria")));
    });
    root.querySelectorAll("[data-i18n-title]").forEach((elNode) => {
      elNode.setAttribute("title", t(elNode.getAttribute("data-i18n-title")));
    });
  }

  function setLang(next) {
    if (next !== "tr" && next !== "en") return;
    lang = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch (_) {
      // yazılamıyorsa da akış bozulmasın.
    }
    document.documentElement.lang = lang;
    applyStaticDom();
    updateToggleButton();
    document.dispatchEvent(new CustomEvent("symbolcarki:langchange", { detail: { lang } }));
  }

  function updateToggleButton() {
    const btn = document.getElementById("btn-lang-toggle");
    if (!btn) return;
    btn.textContent = t("lang.toggleLabel");
    btn.title = t("lang.toggleTitle");
    btn.setAttribute("aria-label", t("lang.toggleTitle"));
  }

  function initToggleButton() {
    const btn = document.getElementById("btn-lang-toggle");
    if (!btn) return;
    btn.addEventListener("click", () => setLang(lang === "tr" ? "en" : "tr"));
    updateToggleButton();
  }

  function init() {
    document.documentElement.lang = lang;
    applyStaticDom();
    initToggleButton();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  return { t, getLang, setLang, applyStaticDom };
})();
