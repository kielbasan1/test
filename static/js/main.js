(() => {
  const state = {
    dreamTitle: "", // rüyayı en baştan isimlendirme (kütüphaneden sonradan da değiştirilebilir)
    dreamText: "",
    dreamContext: "",
    dreamAttitude: "", // rüyadaki genel tutum (katılan/izleyen/kaçan/duran) — Faz 1.1
    dreamEmotion: "", // rüyada hissedilen / uyanınca kalan duygu — Faz 1.1
    dreamArc: "", // rüya nasıl başladı, nasıl bitti — Faz 1.1
    myInterpretation: "", // kullanıcının KENDİ yorumu — asıl olan bu, AI ondan sonra gelir
    symbols: [], // { name, name_en, context, associations: [{id,text,selected}], questions: {q1..q4},
    //            meditation (rapora girmez), report_note (rapora girer) }
    activeIndex: null,
    workIndex: 0, // "Çalışman" bölümündeki tek-kart gezinmesinin hangi sembolde olduğu
    resultReady: false,
    lastMainStep: null, // geçmiş ekranından geri dönülecek adım
    currentStepMeta: null, // { index, name } — ilerleme etiketi için
    lastRecord: null, // son sentezlenen kayıt — rapor/harita/çalışma sayfası bundan üretilir
    lastSavedFile: null, // /api/save-dream'in en son döndürdüğü dosya adı — rezonans PATCH'i buraya yazar
    libraryDreams: [], // kütüphaneden son çekilen ham rüya özet listesi — sırala/filtrele yeniden çekmeden çalışır
  };

  const el = {
    devPanel: document.getElementById("dev-panel"),
    devStepDream: document.getElementById("dev-step-dream"),
    devStepSymbols: document.getElementById("dev-step-symbols"),
    devStepWheel: document.getElementById("dev-step-wheel"),
    devStepFinalize: document.getElementById("dev-step-finalize"),
    devStepResultOwn: document.getElementById("dev-step-result-own"),
    devStepResultAi: document.getElementById("dev-step-result-ai"),
    devStepLibrary: document.getElementById("dev-step-library"),
    dreamTitle: document.getElementById("dream-title"),
    dreamText: document.getElementById("dream-text"),
    dreamContext: document.getElementById("dream-context"),
    dreamAttitude: document.getElementById("dream-attitude"),
    dreamEmotion: document.getElementById("dream-emotion"),
    dreamArc: document.getElementById("dream-arc"),
    btnExtract: document.getElementById("btn-extract"),
    extractStatus: document.getElementById("extract-status"),
    stepDream: document.getElementById("step-dream"),
    stepSymbols: document.getElementById("step-symbols"),
    btnSymbolsBack: document.getElementById("btn-symbols-back"),
    symbolsDreamText: document.getElementById("symbols-dream-text"),
    symbolChips: document.getElementById("symbol-chips"),
    symbolProgress: document.getElementById("symbol-progress"),
    manualSymbolInput: document.getElementById("manual-symbol-input"),
    btnAddSymbol: document.getElementById("btn-add-symbol"),
    btnStartSymbols: document.getElementById("btn-start-symbols"),
    stepWheel: document.getElementById("step-wheel"),
    btnWheelBack: document.getElementById("btn-wheel-back"),
    btnWheelCyclePrev: document.getElementById("btn-wheel-cycle-prev"),
    btnWheelCycleNext: document.getElementById("btn-wheel-cycle-next"),
    wheelCycleLabel: document.getElementById("wheel-cycle-label"),
    wheelSvgWrap: document.getElementById("wheel-svg-wrap"),
    wheelTitle: document.getElementById("wheel-symbol-title"),
    wheelContext: document.getElementById("wheel-symbol-context"),
    wheelSvg: document.getElementById("wheel-svg"),
    assocInput: document.getElementById("assoc-input"),
    btnAddAssoc: document.getElementById("btn-add-assoc"),
    assocList: document.getElementById("assoc-list"),
    btnAmplify: document.getElementById("btn-amplify"),
    amplifyResult: document.getElementById("amplify-result"),
    fourQuestions: document.getElementById("four-questions"),
    symbolNotes: document.getElementById("symbol-notes"),
    btnNextSymbol: document.getElementById("btn-next-symbol"),
    stepFinalize: document.getElementById("step-finalize"),
    btnFinalizeBack: document.getElementById("btn-finalize-back"),
    btnFinalize: document.getElementById("btn-finalize"),
    btnFinish: document.getElementById("btn-finish"),
    myInterpretation: document.getElementById("my-interpretation"),
    finalizeGate: document.getElementById("finalize-gate"),
    finalizeMapSvg: document.getElementById("finalize-map-svg"),
    btnWorkCyclePrev: document.getElementById("btn-work-cycle-prev"),
    btnWorkCycleNext: document.getElementById("btn-work-cycle-next"),
    workCycleLabel: document.getElementById("work-cycle-label"),
    finalizeCards: document.getElementById("finalize-cards"),
    finalizeStatus: document.getElementById("finalize-status"),
    stepResult: document.getElementById("step-result"),
    myInterpBlock: document.getElementById("my-interpretation-block"),
    myInterpText: document.getElementById("my-interpretation-text"),
    expandOffer: document.getElementById("expand-offer"),
    btnExpandLater: document.getElementById("btn-expand-later"),
    expandStatus: document.getElementById("expand-status"),
    aiBlock: document.getElementById("ai-block"),
    resultText: document.getElementById("result-text"),
    resonancePanel: document.getElementById("resonance-panel"),
    resonanceNote: document.getElementById("resonance-note"),
    resonanceStatus: document.getElementById("resonance-status"),
    ritualText: document.getElementById("ritual-text"),
    btnSaveRitual: document.getElementById("btn-save-ritual"),
    ritualStatus: document.getElementById("ritual-status"),
    btnCopyResult: document.getElementById("btn-copy-result"),
    btnReport: document.getElementById("btn-report"),
    reportMenu: document.getElementById("report-menu"),
    reportIncludeAi: document.getElementById("report-include-ai"),
    btnReportMd: document.getElementById("btn-report-md"),
    btnReportPrint: document.getElementById("btn-report-print"),
    btnDownloadJson: document.getElementById("btn-download-json"),
    symbolMapSvg: document.getElementById("symbol-map-svg"),
    btnShowHistory: document.getElementById("btn-show-history"),
    btnShowGuide: document.getElementById("btn-show-guide"),
    stepGuide: document.getElementById("step-guide"),
    btnGuideBack: document.getElementById("btn-guide-back"),
    btnImport: document.getElementById("btn-import"),
    importFileInput: document.getElementById("import-file-input"),
    btnLoadDraft: document.getElementById("btn-load-draft"),
    draftFileInput: document.getElementById("draft-file-input"),
    btnSaveDraft: document.getElementById("btn-save-draft"),
    btnNewDream: document.getElementById("btn-new-dream"),
    stepHistory: document.getElementById("step-history"),
    historyEmpty: document.getElementById("history-empty"),
    historyList: document.getElementById("history-list"),
    librarySort: document.getElementById("library-sort"),
    libraryOnlyIncomplete: document.getElementById("library-only-incomplete"),
    btnLibraryDownloadAll: document.getElementById("btn-library-download-all"),
    btnToggleRecurring: document.getElementById("btn-toggle-recurring"),
    recurringPanel: document.getElementById("recurring-symbols-panel"),
    recurringEmpty: document.getElementById("recurring-empty"),
    recurringList: document.getElementById("recurring-list"),
    btnToggleTimeline: document.getElementById("btn-toggle-timeline"),
    timelinePanel: document.getElementById("timeline-panel"),
    timelineEmpty: document.getElementById("timeline-empty"),
    timelineList: document.getElementById("timeline-list"),
    btnDeleteAll: document.getElementById("btn-delete-all"),
    historyDetail: document.getElementById("history-detail"),
    btnHistoryBack: document.getElementById("btn-history-back"),
    historyDetailContent: document.getElementById("history-detail-content"),
    progressWrap: document.getElementById("progress-wrap"),
    progressFill: document.getElementById("progress-fill"),
    progressLabel: document.getElementById("progress-label"),
    onboardIntro: document.getElementById("onboard-intro"),
    btnOnboardDismiss: document.getElementById("btn-onboard-dismiss"),
    removeSymbolToast: document.getElementById("remove-symbol-toast"),
    removeSymbolToastText: document.getElementById("remove-symbol-toast-text"),
    btnUndoRemoveSymbol: document.getElementById("btn-undo-remove-symbol"),
  };

  const ONBOARD_SEEN_KEY = "symbolcarki:onboarded";
  const UNDO_REMOVE_TIMEOUT_MS = 8000;
  let pendingRemoval = null; // { symbol, index, activeIndexBefore, timerId }

  // Ana akıştaki 5 adım, sırasıyla — geçmiş rüyalar paneli bu sayıma dahil
  // değil, ayrı bir taşma ekranı sayılır.
  const STEP_ORDER = [
    { key: "stepDream", nameKey: "step.name.dream" },
    { key: "stepSymbols", nameKey: "step.name.symbols" },
    { key: "stepWheel", nameKey: "step.name.wheel" },
    { key: "stepFinalize", nameKey: "step.name.finalize" },
    { key: "stepResult", nameKey: "step.name.result" },
  ];

  function uid() {
    return (crypto.randomUUID && crypto.randomUUID()) || String(Date.now() + Math.random());
  }

  const SVG_NS = "http://www.w3.org/2000/svg";
  function makeIcon(name, extraClass) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", extraClass ? `icon ${extraClass}` : "icon");
    const use = document.createElementNS(SVG_NS, "use");
    use.setAttribute("href", `#icon-${name}`);
    svg.appendChild(use);
    return svg;
  }

  function setStatus(node, msg, isError) {
    node.textContent = msg || "";
    node.classList.toggle("error", !!isError);
  }

  // Dokunmatik kaydırma — ‹ › düğmeleriyle aynı gezinmeyi tetikler, sadece
  // ek bir girdi yolu (Kaan'ın isteği, 2026-09-11: "telefonda parmakla
  // kaydırma"). Düğmeler masaüstü için kalmaya devam ediyor. Dikey hareket
  // yatay hareketten belirgin büyükse kaydırma sayılmaz — aksi halde sayfa
  // kaydırmasıyla (veya kart içi metin seçimiyle) karışır.
  const SWIPE_MIN_DISTANCE = 40;
  const SWIPE_MAX_OFF_AXIS = 60;

  function attachSwipe(node, { onLeft, onRight }) {
    if (!node) return;
    let startX = null;
    let startY = null;
    node.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length !== 1) return;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
      },
      { passive: true }
    );
    node.addEventListener(
      "touchend",
      (e) => {
        if (startX === null) return;
        const touch = e.changedTouches[0];
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;
        startX = null;
        startY = null;
        if (Math.abs(dy) > SWIPE_MAX_OFF_AXIS) return;
        if (dx <= -SWIPE_MIN_DISTANCE) onLeft();
        else if (dx >= SWIPE_MIN_DISTANCE) onRight();
      },
      { passive: true }
    );
  }

  // Fare/kalem konumuna göre çarkı hafifçe eğen 3D parallax — "Gece
  // Rasathanesi" tasarımı (2026-09-13). Dokunmatikte devre dışı: parmak
  // zaten swipe-cycle jestini kullanıyor (bkz. attachSwipe), ikisi çakışmasın.
  const TILT_MAX_DEG = 9;

  function attachTilt(wrap, target) {
    if (!wrap || !target) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    wrap.addEventListener("pointermove", (e) => {
      if (e.pointerType === "touch") return;
      const rect = wrap.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      target.style.transition = "transform 0.08s linear";
      target.style.transform =
        `perspective(1400px) rotateX(${(-py * TILT_MAX_DEG * 2).toFixed(2)}deg) ` +
        `rotateY(${(px * TILT_MAX_DEG * 2).toFixed(2)}deg)`;
    });

    wrap.addEventListener("pointerleave", () => {
      target.style.transition = "transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)";
      target.style.transform = "perspective(1400px) rotateX(0deg) rotateY(0deg)";
    });
  }

  async function postJSON(url, body, method) {
    const res = await fetch(url, {
      method: method || "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "İstek başarısız oldu.");
    return data;
  }

  async function getJSON(url) {
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "İstek başarısız oldu.");
    return data;
  }

  // ---------- Tek-ekran gezinme ----------
  // Bu, "adım adım tamamlanan görev" akışının temeli: her an yalnızca TEK bir
  // adım görünür, uzun bir sayfa boyunca kayan bir form değil. Geçmiş rüyalar
  // paneli hariç tüm adımlar birbirini dışlar; geçmiş paneli açıldığında
  // hangi adımdan geldiğimiz hatırlanır (lastMainStep) ki kapatınca oraya
  // dönebilelim.
  function allSteps() {
    return [el.stepDream, el.stepSymbols, el.stepWheel, el.stepFinalize, el.stepResult, el.stepHistory, el.stepGuide];
  }

  const prefersReducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function showOnlyStep(section) {
    const current = allSteps().find((s) => !s.classList.contains("hidden"));

    const finish = () => {
      allSteps().forEach((s) => s.classList.toggle("hidden", s !== section));
      // Yorum adımına her girişte metin alanı state ile eşitlenir — kullanıcı
      // sembollere geri dönüp tekrar geldiğinde yazdığı yorum kaybolmasın —
      // ve harita/veri paneli o anki veriyle yeniden çizilir.
      if (section === el.stepFinalize) {
        el.myInterpretation.value = state.myInterpretation || "";
        renderFinalizeWorkspace();
      }
      if (section !== el.stepHistory && section !== el.stepGuide) {
        state.lastMainStep = section;
        updateStepLabel(section);
      }
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
      saveProgress();
    };

    // Adım değişiminde önceki kart kısa bir "çıkış" animasyonuyla solur, sonra
    // yeni kart görünür olur — anlık zıplama yerine akıcı bir geçiş hissi.
    if (!current || current === section || prefersReducedMotion()) {
      finish();
      return;
    }
    current.classList.add("step-leaving");
    setTimeout(() => {
      current.classList.remove("step-leaving");
      finish();
    }, 160);
  }

  // ---------- İlerleme çubuğu ----------

  function updateStepLabel(section) {
    const stepIdx = STEP_ORDER.findIndex((s) => el[s.key] === section);
    if (stepIdx === -1) return; // geçmiş paneli gibi ana akış dışı ekranlar

    el.progressWrap.classList.remove("hidden");
    state.currentStepMeta = { index: stepIdx + 1, nameKey: STEP_ORDER[stepIdx].nameKey };
    updateProgress();
  }

  // Yapay zeka yardımının açılması için kendi yorumunun ulaşması gereken
  // en az uzunluk. Amaç bir kalite ölçütü değil — tek kelime yazıp geçmeyi,
  // yani yöntemin asıl işini (kendi yorumunu kurmayı) atlamayı zorlaştırmak.
  // Rüya işinin değeri yavaşlıkta: AI'ın anında cevap vermesi, beklemesi
  // gereken yerde kişiyi kısayola çeker (bkz. Threads.md, "trickster dürtüsü").
  const MIN_OWN_INTERPRETATION_CHARS = 120;

  function ownInterpretationText() {
    return (el.myInterpretation.value || state.myInterpretation || "").trim();
  }

  function symbolsComplete() {
    return state.symbols.length > 0 && state.symbols.every((s) => s.associations.some((a) => a.selected));
  }

  function updateFinalizeGate() {
    const ready = symbolsComplete();
    const own = ownInterpretationText();
    el.btnFinish.disabled = !ready || own.length === 0;
    el.btnFinalize.disabled = !ready || own.length < MIN_OWN_INTERPRETATION_CHARS;
    const remaining = MIN_OWN_INTERPRETATION_CHARS - own.length;
    el.finalizeGate.textContent =
      remaining > 0 ? I18N.t("finalize.gate", { remaining }) : I18N.t("finalize.gateOpen");
  }

  function updateProgress() {
    updateFinalizeGate();
    if (!state.currentStepMeta) return;
    const { index, nameKey } = state.currentStepMeta;
    const stepPrefix = I18N.t("step.label", { index, total: STEP_ORDER.length, name: I18N.t(nameKey) });

    if (state.symbols.length === 0) {
      const pct = index === 1 ? 8 : Math.round((index / STEP_ORDER.length) * 100);
      el.progressFill.style.width = pct + "%";
      el.progressLabel.textContent = stepPrefix;
      return;
    }

    const total = state.symbols.length + 2; // rüya + semboller + sonuç
    const doneSymbols = state.symbols.filter((s) => s.associations.some((a) => a.selected)).length;
    let completed = 1 + doneSymbols; // rüya zaten yazıldı
    if (state.resultReady) completed += 1;
    const pct = Math.round((completed / total) * 100);

    el.progressFill.style.width = pct + "%";
    el.progressLabel.textContent = state.resultReady
      ? I18N.t("step.done", { prefix: stepPrefix })
      : I18N.t("step.symbolsDone", { prefix: stepPrefix, done: doneSymbols, total: state.symbols.length });
    saveProgress();
  }

  function resetProgress() {
    el.progressWrap.classList.add("hidden");
    el.progressFill.style.width = "0%";
    state.currentStepMeta = null;
  }

  // ---------- Otomatik ilerleme kaydı (yarım bırak, sonra dön) ----------
  //
  // Rüya işi tek oturumda bitmek zorunda değil — "cuk oturan" anlam bazen
  // günler sonra gelir, takılmak bir başarısızlık değil yöntemin normal
  // hâli. Bu yüzden akış her adımda sessizce tarayıcıya yazılıyor ve sayfa
  // yeniden açıldığında kaldığı adımdan devam ediyor: kullanıcıya tek bir
  // düğme, tek bir "kaydet" işi bile yüklemeden (PRODUCT.md: angarya yok,
  // akışkan olacak).
  //
  // Sunucuya gitmiyor, kayıt kullanıcının kendi tarayıcısında kalıyor
  // (Kaan'ın tercihi) — yani başka cihazdan görünmez, tarayıcı verisi
  // silinirse gider. Kalıcı kopya hâlâ .json yedeği / rapor.
  const PROGRESS_KEY = "symbolcarki:inprogress";
  const STEP_KEYS = { stepDream: "dream", stepSymbols: "symbols", stepWheel: "wheel", stepFinalize: "finalize" };
  let progressSaveTimer = null;
  let restoringProgress = false;

  function currentStepKey() {
    const visible = allSteps().find((s) => !s.classList.contains("hidden"));
    const entry = Object.entries(STEP_KEYS).find(([key]) => el[key] === visible);
    return entry ? entry[1] : null;
  }

  function clearProgress() {
    clearTimeout(progressSaveTimer);
    try {
      localStorage.removeItem(PROGRESS_KEY);
    } catch (_e) {
      /* gizli mod / kapalı depolama: yapacak bir şey yok */
    }
  }

  function saveProgress() {
    if (restoringProgress) return;
    // Sonuç ekranına gelindiyse iş bitti; yarım kayıt tutmanın anlamı yok.
    if (state.resultReady) {
      clearProgress();
      return;
    }
    const step = currentStepKey();
    if (!step) return; // geçmiş paneli gibi ana akış dışı ekranlar
    const dreamText = el.dreamText.value || state.dreamText || "";
    if (!dreamText.trim() && !state.symbols.length) {
      clearProgress();
      return;
    }
    clearTimeout(progressSaveTimer);
    progressSaveTimer = setTimeout(() => {
      try {
        localStorage.setItem(
          PROGRESS_KEY,
          JSON.stringify({
            v: 1,
            saved_at: new Date().toISOString(),
            step,
            activeIndex: state.activeIndex,
            dream_text: dreamText,
            title: el.dreamTitle.value || state.dreamTitle || "",
            personal_context: el.dreamContext.value || state.dreamContext || "",
            dream_attitude: el.dreamAttitude.value || state.dreamAttitude || "",
            dream_emotion: el.dreamEmotion.value || state.dreamEmotion || "",
            dream_arc: el.dreamArc.value || state.dreamArc || "",
            my_interpretation: el.myInterpretation.value || state.myInterpretation || "",
            symbols: state.symbols,
          })
        );
      } catch (_e) {
        /* kota dolu ya da depolama kapalı — sessizce vazgeç, akışı bozma */
      }
    }, 400);
  }

  function readProgress() {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      if (!raw) return null;
      const saved = JSON.parse(raw);
      if (!saved || typeof saved.dream_text !== "string" || !Array.isArray(saved.symbols)) return null;
      if (!saved.dream_text.trim() && !saved.symbols.length) return null;
      return saved;
    } catch (_e) {
      return null;
    }
  }

  function daysAgoLabel(iso) {
    const then = new Date(iso).getTime();
    if (!then) return "";
    const days = Math.floor((Date.now() - then) / 86400000);
    if (days <= 0) return I18N.t("resume.today");
    return I18N.t("resume.daysAgo", { days });
  }

  function showResumeNote(saved) {
    const note = document.createElement("div");
    note.className = "resume-note";
    const text = document.createElement("span");
    text.textContent = I18N.t("resume.text", { when: daysAgoLabel(saved.saved_at) });
    const fresh = document.createElement("button");
    fresh.type = "button";
    fresh.className = "resume-note-action";
    fresh.textContent = I18N.t("resume.startOver");
    fresh.addEventListener("click", () => {
      clearProgress();
      note.remove();
      el.btnNewDream.click();
    });
    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.className = "resume-note-close";
    dismiss.setAttribute("aria-label", I18N.t("resume.dismiss"));
    dismiss.textContent = "×";
    dismiss.addEventListener("click", () => note.remove());
    note.appendChild(text);
    note.appendChild(fresh);
    note.appendChild(dismiss);
    const main = document.querySelector("main");
    if (main) main.insertBefore(note, main.firstChild);
  }

  function restoreProgress(saved) {
    restoringProgress = true;
    const draft = {
      is_draft: true,
      dream_text: saved.dream_text,
      title: saved.title || "",
      personal_context: saved.personal_context,
      dream_attitude: saved.dream_attitude || "",
      dream_emotion: saved.dream_emotion || "",
      dream_arc: saved.dream_arc || "",
      my_interpretation: saved.my_interpretation || "",
      symbols: saved.symbols,
    };
    const hasSymbols = Array.isArray(saved.symbols) && saved.symbols.length > 0;
    const wheelIndex =
      saved.step === "wheel" && hasSymbols && saved.symbols[saved.activeIndex] ? saved.activeIndex : null;
    let target = el.stepFinalize;
    if (saved.step === "dream" || !hasSymbols) target = el.stepDream;
    else if (saved.step === "symbols") target = el.stepSymbols;
    else if (wheelIndex !== null) target = el.stepWheel;

    loadDraftIntoState(draft, target);
    if (wheelIndex !== null) selectSymbol(wheelIndex);
    restoringProgress = false;
    showResumeNote(saved);
  }

  // ---------- Adım: rüya + sembol çıkarma ----------

  el.btnExtract.addEventListener("click", async () => {
    const text = el.dreamText.value.trim();
    if (!text) {
      setStatus(el.extractStatus, I18N.t("dream.status.empty"), true);
      return;
    }
    state.dreamText = text;
    state.dreamTitle = el.dreamTitle.value.trim();
    state.dreamContext = el.dreamContext.value.trim();
    state.dreamAttitude = el.dreamAttitude.value.trim();
    state.dreamEmotion = el.dreamEmotion.value.trim();
    state.dreamArc = el.dreamArc.value.trim();
    el.btnExtract.disabled = true;
    setStatus(el.extractStatus, I18N.t("dream.status.extracting"));
    el.extractStatus.classList.add("spinner");
    try {
      const data = await postJSON("/api/extract-symbols", { dream_text: text });
      state.symbols = data.symbols.map((s) => ({
        name: s.name,
        name_en: s.name_en || "",
        context: s.context,
        associations: [],
        questions: { q1: "", q2: "", q3: "", q4: "" },
        meditation: "",
        report_note: "",
      }));
      setStatus(el.extractStatus, I18N.t("dream.status.found", { n: state.symbols.length }));
      renderChips();
      updateProgress();
      showOnlyStep(el.stepSymbols);
    } catch (err) {
      setStatus(el.extractStatus, err.message, true);
    } finally {
      el.btnExtract.disabled = false;
      el.extractStatus.classList.remove("spinner");
    }
  });

  // ---------- Sembol listesi (hub ekranı) ----------

  function firstIncompleteIndex() {
    return state.symbols.findIndex((s) => !s.associations.some((a) => a.selected));
  }

  function updateStartButton() {
    if (state.symbols.length === 0) {
      el.btnStartSymbols.classList.add("hidden");
      return;
    }
    el.btnStartSymbols.classList.remove("hidden");
    const incompleteIndex = firstIncompleteIndex();
    if (incompleteIndex === -1) {
      el.btnStartSymbols.textContent = I18N.t("symbols.goToInterpretation");
    } else if (state.symbols.every((s) => s.associations.length === 0)) {
      el.btnStartSymbols.textContent = I18N.t("symbols.start");
    } else {
      el.btnStartSymbols.textContent = I18N.t("symbols.continue");
    }
  }

  el.btnSymbolsBack.addEventListener("click", () => {
    showOnlyStep(el.stepDream);
  });

  el.btnStartSymbols.addEventListener("click", () => {
    const incompleteIndex = firstIncompleteIndex();
    if (incompleteIndex === -1) {
      showOnlyStep(el.stepFinalize);
    } else {
      selectSymbol(incompleteIndex);
    }
  });

  function renderChips() {
    el.symbolsDreamText.textContent = state.dreamText;
    const doneCount = state.symbols.filter((s) => s.associations.some((a) => a.selected)).length;
    el.symbolProgress.textContent = state.symbols.length
      ? I18N.t("symbols.progress", { done: doneCount, total: state.symbols.length })
      : "";

    el.symbolChips.innerHTML = "";
    state.symbols.forEach((sym, i) => {
      const chip = document.createElement("div");
      const hasSelection = sym.associations.some((a) => a.selected);
      chip.className =
        "chip" + (i === state.activeIndex ? " active" : "") + (hasSelection ? " done" : "");
      chip.style.setProperty("--i", i);
      chip.setAttribute("role", "button");
      chip.setAttribute("tabindex", "0");
      chip.setAttribute("aria-label", sym.name);

      if (hasSelection) {
        chip.appendChild(makeIcon("check", "icon-sm"));
      }

      const label = document.createElement("span");
      label.textContent = sym.name;
      chip.appendChild(label);

      const renameBtn = makeRenameControl(
        sym.name,
        (newName) => renameSymbol(i, newName),
        renderChips
      );
      chip.appendChild(renameBtn);

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "chip-remove";
      removeBtn.setAttribute("aria-label", I18N.t("symbols.chipRemove", { name: sym.name }));
      removeBtn.appendChild(makeIcon("x", "icon-sm"));
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        removeSymbol(i);
      });
      chip.appendChild(removeBtn);

      chip.addEventListener("click", () => selectSymbol(i));
      chip.addEventListener("keydown", (e) => {
        if (e.target !== chip) return; // remove butonundan gelen Enter/Space'i tekrar tetikleme
        if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
          e.preventDefault();
          selectSymbol(i);
        }
      });
      el.symbolChips.appendChild(chip);
    });

    updateStartButton();
  }

  function addManualSymbol() {
    const name = el.manualSymbolInput.value.trim();
    if (!name) return;
    state.symbols.push({
      name,
      name_en: "",
      context: "",
      associations: [],
      questions: { q1: "", q2: "", q3: "", q4: "" },
      meditation: "",
      report_note: "",
    });
    el.manualSymbolInput.value = "";
    renderChips();
    updateProgress();
    selectSymbol(state.symbols.length - 1);
  }

  function hideRemoveSymbolToast() {
    if (pendingRemoval && pendingRemoval.timerId) clearTimeout(pendingRemoval.timerId);
    pendingRemoval = null;
    el.removeSymbolToast.classList.add("hidden");
  }

  function removeSymbol(index) {
    // Geri alınabilir silme: veri hemen state'ten çıkıyor ama bir süre bellekte
    // tutuluyor. "Sil = kalıcı yok olur" onayı yerine Nielsen #3'ün önerdiği
    // yol — çünkü kurtarma burada güvenli ve ucuz, engelleyici bir dialog
    // gereksiz sürtünme olurdu.
    const [removedSymbol] = state.symbols.splice(index, 1);
    const activeIndexBefore = state.activeIndex;
    if (state.activeIndex === index) {
      state.activeIndex = null;
    } else if (state.activeIndex !== null && state.activeIndex > index) {
      state.activeIndex -= 1;
    }
    renderChips();
    updateProgress();

    if (pendingRemoval && pendingRemoval.timerId) clearTimeout(pendingRemoval.timerId);
    el.removeSymbolToastText.textContent = I18N.t("symbols.removed", { name: removedSymbol.name });
    el.removeSymbolToast.classList.remove("hidden");
    pendingRemoval = {
      symbol: removedSymbol,
      index,
      activeIndexBefore,
      timerId: setTimeout(hideRemoveSymbolToast, UNDO_REMOVE_TIMEOUT_MS),
    };
  }

  function renameSymbol(index, newName) {
    // Sadece aktif oturumun state'inde — sunucuya/kaydedilmiş rüyalara
    // dokunmaz. Kaydedince yeni isim zaten JSON'a yazılır.
    const sym = state.symbols[index];
    if (!sym) return;
    const trimmed = (newName || "").trim();
    if (!trimmed || trimmed === sym.name) return;
    sym.name = trimmed;
    // buildRecord() sembolleri kopyalayarak yeni nesneler üretiyor (bkz.
    // buildRecord), yani state.lastRecord.symbols[i] state.symbols[i] ile
    // aynı referans değil — çalışma kartı ayrıca güncellenmeli.
    if (state.lastRecord && state.lastRecord.symbols && state.lastRecord.symbols[index]) {
      state.lastRecord.symbols[index].name = trimmed;
    }
    renderChips();
    if (state.activeIndex === index) {
      el.wheelTitle.textContent = I18N.t("wheel.title", { name: sym.name });
      el.wheelCycleLabel.textContent = sym.name;
    }
    if (state.workIndex === index && state.lastRecord) {
      renderWorkCard(state.lastRecord);
    }
  }

  function makeRenameControl(name, onSave, redraw) {
    // Kalem ikonuna tıklanınca etiketi bir <input>'a dönüştüren ortak
    // davranış — hem sembol çipleri hem çalışma kartı başlığı kullanır.
    // Hem kaydetme hem iptal, çağıranın kendi tam-yeniden-çizim
    // fonksiyonunu (renderChips/renderWorkCard) tetikleyerek eski hale
    // döner — burada elle DOM geri alma yok.
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "symbol-rename-btn";
    btn.setAttribute("aria-label", I18N.t("symbols.chipRename", { name }));
    btn.appendChild(makeIcon("edit", "icon-sm"));
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const input = document.createElement("input");
      input.type = "text";
      input.className = "symbol-rename-input";
      input.value = name;
      let done = false;
      const commit = async () => {
        if (done) return;
        done = true;
        // onSave semboller için senkron, rüya başlığı için PATCH bekleyen
        // async bir Promise olabilir — redraw ikisinde de sonucu görsün diye
        // await ediliyor (senkron bir onSave için await no-op'tur).
        await onSave(input.value);
        redraw();
      };
      const cancel = () => {
        if (done) return;
        done = true;
        redraw();
      };
      input.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          commit();
        } else if (ev.key === "Escape") {
          ev.preventDefault();
          cancel();
        }
      });
      input.addEventListener("blur", commit);
      input.addEventListener("click", (ev) => ev.stopPropagation());
      btn.replaceWith(input);
      input.focus();
      input.select();
    });
    return btn;
  }

  el.btnUndoRemoveSymbol.addEventListener("click", () => {
    if (!pendingRemoval) return;
    const { symbol, index, activeIndexBefore } = pendingRemoval;
    state.symbols.splice(index, 0, symbol);
    state.activeIndex = activeIndexBefore;
    hideRemoveSymbolToast();
    renderChips();
    updateProgress();
  });

  el.btnAddSymbol.addEventListener("click", addManualSymbol);
  el.manualSymbolInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addManualSymbol();
    }
  });

  // ---------- Sembol çarkı ekranı ----------

  function selectSymbol(index) {
    state.activeIndex = index;
    const sym = state.symbols[index];
    el.wheelTitle.textContent = I18N.t("wheel.title", { name: sym.name });
    el.wheelContext.textContent = sym.context ? I18N.t("wheel.context", { context: sym.context }) : "";
    el.wheelCycleLabel.textContent = sym.name || "";
    renderChips();
    renderWheelAndList();
    syncFourQuestionsPanel();
    resetAmplifyBox();
    showOnlyStep(el.stepWheel);
  }

  el.btnWheelBack.addEventListener("click", () => {
    showOnlyStep(el.stepSymbols);
  });

  // Çarktaki serbest gezinme: "Sonraki Sembol"dan (ilk eksik sembole
  // ilerler) ayrı — burada tüm semboller arasında dairesel gidilip gelinir.
  function cycleWheelSymbol(delta) {
    const n = state.symbols.length;
    if (!n) return;
    const current = state.activeIndex ?? 0;
    selectSymbol(((current + delta) % n + n) % n);
  }

  el.btnWheelCyclePrev.addEventListener("click", () => cycleWheelSymbol(-1));
  el.btnWheelCycleNext.addEventListener("click", () => cycleWheelSymbol(1));
  attachSwipe(el.wheelSvgWrap, { onLeft: () => cycleWheelSymbol(1), onRight: () => cycleWheelSymbol(-1) });
  attachTilt(el.wheelSvgWrap, el.wheelSvg);

  // ---------- Amplifikasyon (tek sembol, kişisel çağrışım bulunamadığında) ----------

  function resetAmplifyBox() {
    el.amplifyResult.classList.add("hidden");
    el.amplifyResult.classList.remove("error", "status", "spinner");
    el.amplifyResult.textContent = "";
  }

  el.btnAmplify.addEventListener("click", async () => {
    const sym = currentSymbol();
    if (!sym) return;
    el.btnAmplify.disabled = true;
    el.amplifyResult.classList.remove("hidden", "error");
    el.amplifyResult.classList.add("status", "spinner");
    el.amplifyResult.textContent = I18N.t("wheel.amplifying");
    try {
      const data = await postJSON("/api/amplify-symbol", {
        name: sym.name,
        name_en: sym.name_en || "",
        context: sym.context || "",
      });
      el.amplifyResult.classList.remove("status", "spinner");
      el.amplifyResult.textContent = data.amplification;
    } catch (err) {
      el.amplifyResult.classList.remove("status", "spinner");
      el.amplifyResult.classList.add("error");
      el.amplifyResult.textContent = err.message;
    } finally {
      el.btnAmplify.disabled = false;
    }
  });

  function currentSymbol() {
    return state.activeIndex === null ? null : state.symbols[state.activeIndex];
  }

  function renderWheelAndList() {
    const sym = currentSymbol();
    if (!sym) return;
    SymbolWheel.render(el.wheelSvg, sym.name, sym.associations, onSelectAssociation);

    el.assocList.innerHTML = "";
    sym.associations.forEach((a, i) => {
      const li = document.createElement("li");
      li.className = a.selected ? "selected" : "";
      li.style.setProperty("--i", i);
      li.setAttribute("role", "button");
      li.setAttribute("tabindex", "0");
      li.setAttribute("aria-label", a.text);

      const label = document.createElement("span");
      label.className = "assoc-text";
      label.textContent = a.text;
      li.appendChild(label);

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "assoc-edit";
      editBtn.setAttribute("aria-label", I18N.t("wheel.editAssoc", { text: a.text }));
      editBtn.appendChild(makeIcon("edit", "icon-sm"));
      editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        startEditAssociation(li, label, a);
      });
      li.appendChild(editBtn);

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "assoc-remove";
      removeBtn.setAttribute("aria-label", I18N.t("wheel.removeAssoc", { text: a.text }));
      removeBtn.appendChild(makeIcon("x", "icon-sm"));
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        sym.associations.splice(i, 1);
        renderWheelAndList();
        syncFourQuestionsPanel();
      });
      li.appendChild(removeBtn);

      li.addEventListener("click", () => onSelectAssociation(a.id));
      li.addEventListener("keydown", (e) => {
        if (e.target !== li) return; // edit/sil butonlarından gelen tuşu tekrar tetikleme
        if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
          e.preventDefault();
          onSelectAssociation(a.id);
        }
      });
      el.assocList.appendChild(li);
    });
  }

  function startEditAssociation(li, label, assoc) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "assoc-edit-input";
    input.value = assoc.text;
    li.replaceChild(input, label);
    input.focus();
    input.select();

    const commit = () => {
      const next = input.value.trim();
      if (next) assoc.text = next;
      renderWheelAndList();
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        renderWheelAndList();
      }
    });
    input.addEventListener("blur", commit);
    input.addEventListener("click", (e) => e.stopPropagation());
  }

  function addAssociation() {
    const sym = currentSymbol();
    if (!sym) return;
    const text = el.assocInput.value.trim();
    if (!text) return;
    sym.associations.push({ id: uid(), text, selected: false });
    el.assocInput.value = "";
    renderWheelAndList();
  }

  el.btnAddAssoc.addEventListener("click", addAssociation);
  el.assocInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addAssociation();
    }
  });

  function onSelectAssociation(id) {
    const sym = currentSymbol();
    if (!sym) return;
    sym.associations.forEach((a) => (a.selected = a.id === id));
    renderWheelAndList();
    renderChips();
    syncFourQuestionsPanel();
    updateProgress();
  }

  // ---------- 4 soru + sonraki sembol ----------

  function syncFourQuestionsPanel() {
    const sym = currentSymbol();
    const hasSelection = sym && sym.associations.some((a) => a.selected);
    el.fourQuestions.classList.toggle("hidden", !hasSelection);
    el.symbolNotes.classList.toggle("hidden", !hasSelection);
    el.btnNextSymbol.classList.toggle("hidden", !hasSelection);
    if (!hasSelection) return;

    el.fourQuestions.querySelectorAll("textarea[data-q]").forEach((ta) => {
      ta.value = sym.questions[ta.dataset.q] || "";
    });
    el.symbolNotes.querySelectorAll("textarea[data-note]").forEach((ta) => {
      ta.value = sym[ta.dataset.note] || "";
    });

    const anotherIncomplete = state.symbols.some(
      (s, idx) => idx !== state.activeIndex && !s.associations.some((a) => a.selected)
    );
    el.btnNextSymbol.textContent = anotherIncomplete
      ? I18N.t("wheel.nextSymbol")
      : I18N.t("symbols.goToInterpretation");
  }

  el.fourQuestions.querySelectorAll("textarea[data-q]").forEach((ta) => {
    ta.addEventListener("input", () => {
      const sym = currentSymbol();
      if (!sym) return;
      sym.questions[ta.dataset.q] = ta.value;
      saveProgress();
    });
  });

  // Serbest notlar: "meditation" kişiye özel kalır (rapora hiç girmez),
  // "report_note" rapora girer. Ayrım bilinçli — kullanıcı sembolle otururken
  // yazdığı her şeyi paylaşmak zorunda kalmasın, ama işine yarayan kısmı
  // rapora taşıyabilsin (Kaan'ın isteği, 2026-09-11).
  el.symbolNotes.querySelectorAll("textarea[data-note]").forEach((ta) => {
    ta.addEventListener("input", () => {
      const sym = currentSymbol();
      if (!sym) return;
      sym[ta.dataset.note] = ta.value;
      saveProgress();
    });
  });

  el.btnNextSymbol.addEventListener("click", () => {
    const nextIndex = firstIncompleteIndex();
    if (nextIndex === -1) {
      showOnlyStep(el.stepFinalize);
    } else {
      selectSymbol(nextIndex);
    }
  });

  // ---------- Sentez (amplifikasyon ayrı bir arama adımı değil, Gemini
  // gerektiğinde kendi eğitim verisindeki bilgiyi kullanıyor — bkz.
  // services/gemini_client.py ADIM 9. Google Arama grounding'i denenmişti
  // ama billing gerektirdiği ortaya çıktı, kaldırıldı.) ----------

  el.btnFinalizeBack.addEventListener("click", () => {
    showOnlyStep(el.stepSymbols);
  });

  el.myInterpretation.addEventListener("input", () => {
    state.myInterpretation = el.myInterpretation.value;
    updateFinalizeGate();
    saveProgress();
  });

  // Yorum adımı, yazarken bakılacak her şeyi taşır: üstte harita, ortada
  // yazma kutusu, altta toplanan verinin tamamı (Kaan'ın isteği,
  // 2026-09-11 — "bakıp bakıp yazabileyim"). Harita, sonuç ekranındakiyle
  // aynı bileşen: kendi yakınlaştırma ve PNG indirme düğmeleriyle geliyor.
  function renderFinalizeWorkspace() {
    const record = buildRecord("");
    if (!record.symbols.length) return;
    SymbolMap.render(el.finalizeMapSvg, record);

    if (!(state.workIndex >= 0 && state.workIndex < record.symbols.length)) {
      state.workIndex = 0;
    }
    renderWorkCard(record);
  }

  // Çalışma sayfası da çark gibi tek seferde tek sembol gösterir (Kaan'ın
  // isteği, 2026-09-11 — kartlar alt alta uzun bir liste yerine tek tek
  // dolaşılabilsin, özellikle mobilde).
  // liveSym = state.symbols[state.workIndex]: buildRecord() sembolleri
  // kopyalayarak yeni nesneler ürettiği için (bkz. buildRecord) `record`
  // parametresi salt-okunur bir anlık görüntü — düzenleme geri yazmaları
  // her zaman liveSym'e, yani gerçek state'e yapılmalı.
  function renderWorkCard(record) {
    const sym = record.symbols[state.workIndex];
    const liveSym = state.symbols[state.workIndex];
    el.workCycleLabel.textContent = sym.name || "";

    el.finalizeCards.innerHTML = "";
    const card = document.createElement("article");
    card.className = "finalize-card";

    const redraw = () => renderWorkCard(buildRecord(""));

    const headingRow = document.createElement("div");
    headingRow.className = "finalize-card-heading";
    const h = document.createElement("h4");
    h.textContent = sym.name || "";
    headingRow.appendChild(h);
    headingRow.appendChild(
      makeRenameControl(sym.name || "", (newName) => renameSymbol(state.workIndex, newName), redraw)
    );
    card.appendChild(headingRow);

    // Kişinin aklına daha iyi bir kelime gelebilir diye (Kaan'ın isteği,
    // 2026-09-13): bağlam, seçilen çağrışım ve 4 soru cevabı burada da aynı
    // kalem-ikonu deseniyle düzenlenebilir — sadece sembol adı değil. Boş
    // gönderim yok sayılır (renameSymbol'daki davranışla aynı).
    const addField = (label, value, muted, onSave) => {
      if (!value || !String(value).trim()) return;
      const l = document.createElement("div");
      l.className = "field-label";
      l.textContent = label;
      const v = document.createElement("div");
      v.className = muted ? "field-value muted" : "field-value";
      v.textContent = value;
      if (!onSave) {
        card.appendChild(l);
        card.appendChild(v);
        return;
      }
      const row = document.createElement("div");
      row.className = "field-value-row";
      row.appendChild(v);
      row.appendChild(makeRenameControl(value, onSave, redraw));
      card.appendChild(l);
      card.appendChild(row);
    };

    addField(I18N.t("worksheet.context"), sym.context, true, (newValue) => {
      const trimmed = (newValue || "").trim();
      if (!trimmed) return;
      liveSym.context = trimmed;
      saveProgress();
    });
    addField(I18N.t("worksheet.goldAssoc"), sym.selected_association, false, (newValue) => {
      const trimmed = (newValue || "").trim();
      if (!trimmed) return;
      const selected = liveSym.associations.find((a) => a.selected);
      if (selected) selected.text = trimmed;
      saveProgress();
    });
    SymbolMap.questionLabels.forEach(([key, label]) => {
      addField(label, (sym.questions || {})[key], false, (newValue) => {
        const trimmed = (newValue || "").trim();
        if (!trimmed) return;
        liveSym.questions[key] = trimmed;
        saveProgress();
      });
    });
    addField(I18N.t("notes.report"), sym.report_note);

    el.finalizeCards.appendChild(card);
  }

  function cycleWorkCard(delta) {
    const record = buildRecord("");
    const n = record.symbols.length;
    if (!n) return;
    state.workIndex = ((state.workIndex + delta) % n + n) % n;
    renderWorkCard(record);
  }

  el.btnWorkCyclePrev.addEventListener("click", () => cycleWorkCard(-1));
  el.btnWorkCycleNext.addEventListener("click", () => cycleWorkCard(1));
  attachSwipe(el.finalizeCards, { onLeft: () => cycleWorkCard(1), onRight: () => cycleWorkCard(-1) });

  function buildRecord(interpretation) {
    return {
      dream_text: state.dreamText,
      title: state.dreamTitle,
      personal_context: state.dreamContext,
      dream_attitude: state.dreamAttitude,
      dream_emotion: state.dreamEmotion,
      dream_arc: state.dreamArc,
      my_interpretation: ownInterpretationText(),
      symbols: state.symbols.map((s) => ({
        name: s.name,
        name_en: s.name_en || "",
        context: s.context,
        selected_association: (s.associations.find((a) => a.selected) || {}).text || "",
        all_associations: s.associations.map((a) => a.text),
        questions: s.questions,
        report_note: s.report_note || "",
      })),
      interpretation: interpretation || "",
    };
  }

  // Rüyayı bitirmenin ASIL yolu bu: kendi yorumunu kaydet, yapay zekaya hiç
  // sorma. Genişletme sonuç ekranından istendiği an ayrıca çağrılabiliyor
  // (bkz. btnExpandLater) — ürün kararı: AI birincil değil, istek üzerine.
  async function finishWithOwnInterpretation() {
    state.myInterpretation = ownInterpretationText();
    state.resultReady = true;
    state.lastRecord = buildRecord("");
    updateProgress();
    renderResult(state.lastRecord);
    el.btnNewDream.classList.remove("hidden");
    try {
      const saveRes = await postJSON("/api/save-dream", state.lastRecord);
      state.lastSavedFile = saveRes.saved_as || null;
      setStatus(el.finalizeStatus, I18N.t("finalize.status.saved"));
    } catch (err) {
      // Sunucuya yazamamak akışı bozmamalı — .json yedeği zaten asıl kopya.
      setStatus(el.finalizeStatus, err.message, true);
    }
  }

  // Sonuç ekranından finalize/symbols/wheel'e geri dönüş yok (bkz. PLAN.md,
  // "Modüler akış" kararı, 2026-09-13) — bu yüzden buraya geçmeden hemen
  // önce, geri dönemeyeceğini net bir şekilde söyleyen bir onay var.
  // Geri dönüp düzenleme özelliği eklemek yerine, kilidi baştan görünür
  // yapmak seçildi (Kaan'ın kararı).
  el.btnFinish.addEventListener("click", () => {
    if (!window.confirm(I18N.t("finalize.lockConfirm"))) return;
    el.btnFinish.disabled = true;
    finishWithOwnInterpretation().finally(() => updateFinalizeGate());
  });

  // Genişletme: kullanıcının kendi yorumunu da göndererek kör noktaları ister.
  // statusNode/button parametreleri, aynı işin hem Yorum adımından hem sonuç
  // ekranından çağrılabilmesi için.
  async function runExpansion(button, statusNode) {
    button.disabled = true;
    statusNode.classList.add("spinner");
    setStatus(statusNode, I18N.t("finalize.status.expanding"));
    try {
      const payload = buildRecord("");
      delete payload.interpretation;
      const data = await postJSON("/api/expand-interpretation", payload);

      state.resultReady = true;
      state.lastRecord = buildRecord(data.interpretation);
      updateProgress();
      renderResult(state.lastRecord);
      el.btnNewDream.classList.remove("hidden");

      const saveRes = await postJSON("/api/save-dream", state.lastRecord);
      state.lastSavedFile = saveRes.saved_as || null;
      setStatus(statusNode, I18N.t("finalize.status.done"));
    } catch (err) {
      setStatus(statusNode, err.message, true);
    } finally {
      button.disabled = false;
      statusNode.classList.remove("spinner");
      updateFinalizeGate();
    }
  }

  el.btnFinalize.addEventListener("click", () => {
    if (!window.confirm(I18N.t("finalize.lockConfirm"))) return;
    state.myInterpretation = ownInterpretationText();
    runExpansion(el.btnFinalize, el.finalizeStatus);
  });

  el.btnExpandLater.addEventListener("click", () => {
    // Sonuç ekranından çağrıldığında state, kayıttaki değerlerden tazelenir —
    // geçmişten/dosyadan açılmış bir kayıtta form alanları boş olabilir.
    const rec = state.lastRecord || {};
    state.dreamText = rec.dream_text || state.dreamText;
    state.dreamTitle = rec.title || state.dreamTitle;
    state.dreamContext = rec.personal_context || state.dreamContext;
    state.dreamAttitude = rec.dream_attitude || state.dreamAttitude;
    state.dreamEmotion = rec.dream_emotion || state.dreamEmotion;
    state.dreamArc = rec.dream_arc || state.dreamArc;
    state.myInterpretation = rec.my_interpretation || state.myInterpretation;
    runExpansion(el.btnExpandLater, el.expandStatus);
  });

  function renderResult(record) {
    const rec = record && typeof record === "object" ? record : state.lastRecord || {};
    SymbolMap.render(el.symbolMapSvg, rec);

    const own = (rec.my_interpretation || "").trim();
    el.myInterpText.textContent = own;
    el.myInterpBlock.classList.toggle("hidden", !own);

    const ai = (rec.interpretation || "").trim();
    el.resultText.textContent = ai;
    el.aiBlock.classList.toggle("hidden", !ai);
    // Genişletme yoksa ama kendi yorumu varsa teklif göster — istek üzerine,
    // hiçbir zaman otomatik.
    el.expandOffer.classList.toggle("hidden", !!ai || !own);
    setStatus(el.expandStatus, "");

    renderResonance(rec);
    renderRitual(rec);

    showOnlyStep(el.stepResult);
  }

  // ---------- Rezonans geri bildirimi (Faz 1.3) ----------
  // Johnson'ın rezonans testi: bir yorum ancak bedensel bir tanıma
  // uyandırdığında doğrulanmış sayılır. Sadece AI genişletmesine bağlı
  // (kendi yorumuna "oturdu mu" sormak anlamsız) — bu yüzden #ai-block'un
  // içinde. Butona basınca hemen kaydediliyor, ayrı bir "kaydet" düğmesi yok.

  function renderResonance(rec) {
    el.resonancePanel.querySelectorAll(".resonance-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.value === (rec.resonance || ""));
    });
    el.resonanceNote.value = rec.resonance_note || "";
    el.resonanceNote.classList.toggle("hidden", !rec.resonance);
    setStatus(el.resonanceStatus, "");
  }

  async function saveResonance(value, note) {
    if (!state.lastSavedFile) return; // kaydedilmemiş bir kayıt için gönderilecek dosya yok
    try {
      await postJSON(
        `/api/dreams/${encodeURIComponent(state.lastSavedFile)}`,
        { resonance: value, resonance_note: note || "" },
        "PATCH"
      );
      setStatus(el.resonanceStatus, I18N.t("resonance.saved"));
    } catch (err) {
      setStatus(el.resonanceStatus, err.message, true);
    }
  }

  el.resonancePanel.querySelectorAll(".resonance-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      el.resonancePanel
        .querySelectorAll(".resonance-btn")
        .forEach((b) => b.classList.toggle("active", b === btn));
      el.resonanceNote.classList.remove("hidden");
      const value = btn.dataset.value;
      if (state.lastRecord) state.lastRecord.resonance = value;
      saveResonance(value, el.resonanceNote.value);
    });
  });

  let resonanceNoteTimer = null;
  el.resonanceNote.addEventListener("input", () => {
    clearTimeout(resonanceNoteTimer);
    resonanceNoteTimer = setTimeout(() => {
      const active = el.resonancePanel.querySelector(".resonance-btn.active");
      if (!active) return; // önce bir değer seçilmeden not tek başına anlamsız
      if (state.lastRecord) state.lastRecord.resonance_note = el.resonanceNote.value;
      saveResonance(active.dataset.value, el.resonanceNote.value);
    }, 500);
  });

  // ---------- Ritüel (Johnson'ın 4. adımı) ----------
  // Kendi yorum ya da AI genişletmesi fark etmeksizin, sonuç ekranına ulaşan
  // herkes için görünür (rezonansın aksine, o sadece AI genişletmesine bağlı).
  // Ritüelin kendisini bu uygulama önermiyor — sadece yazıp kaydedecek bir yer
  // veriyor; "yaptım" işareti kütüphaneden, günler sonra da atılabilir.

  function renderRitual(rec) {
    el.ritualText.value = rec.ritual_text || "";
    setStatus(el.ritualStatus, "");
  }

  el.btnSaveRitual.addEventListener("click", async () => {
    if (!state.lastSavedFile) return; // kaydedilmemiş bir kayıt için gönderilecek dosya yok
    const text = el.ritualText.value.trim();
    try {
      await postJSON(
        `/api/dreams/${encodeURIComponent(state.lastSavedFile)}`,
        { ritual_text: text },
        "PATCH"
      );
      if (state.lastRecord) state.lastRecord.ritual_text = text;
      setStatus(el.ritualStatus, I18N.t("ritual.saved"));
    } catch (err) {
      setStatus(el.ritualStatus, err.message, true);
    }
  });

  // ---------- Rapor (.md ve yazdır/PDF) ----------
  // İki çıktı, tek kaynak: aynı kayıttan hem Markdown dosyası hem yazdırılabilir
  // HTML üretiliyor. Markdown asıl arşiv formatı — düz metin, sürüm kontrolüne
  // ve Obsidian gibi not sistemlerine doğrudan girer, yıllar sonra da açılır
  // (PRODUCT.md: arşivleme birinci sınıf özellik). Yazdır/PDF ise okumak ve
  // basmak için: harita kâğıt paletiyle (bkz. symbolmap.js PALETTE_PAPER)
  // gömülü SVG olarak basılıyor, sembol kartları gerçek HTML — böylece
  // tarayıcı sayfa bölmesini (`break-inside: avoid`) doğru uyguluyor.
  //
  // Her iki çıktıda da kullanıcının KENDİ yorumu asıl bölümdür; yapay zeka
  // genişletmesi rapora girip girmeyeceği bir seçenektir (includeAi) — kişi
  // raporu kendi yorumu olarak saklamak isteyebilir.

  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));
  }

  function buildReportCardHtml(sym) {
    const q = sym.questions || {};
    const contextHtml = sym.context
      ? `<div class="field-label">${escapeHtml(I18N.t("worksheet.context"))}</div><div class="field-value muted">${escapeHtml(sym.context)}</div>`
      : "";
    const questionsHtml = SymbolMap.questionLabels
      .map(([key, label]) => {
        const answer = q[key] && q[key].trim() ? q[key] : "—";
        return `<div class="field-label">${escapeHtml(label)}</div><div class="field-value">${escapeHtml(answer)}</div>`;
      })
      .join("");
    // Sembol notlarının SADECE "rapora eklensin" kutusu basılır; meditasyon
    // notu kayıtta kalır ama hiçbir çıktıya girmez.
    const noteHtml = (sym.report_note || "").trim()
      ? `<div class="field-label">${escapeHtml(I18N.t("notes.report"))}</div><div class="field-value note-text">${escapeHtml(sym.report_note.trim())}</div>`
      : "";
    return `<article class="report-card">
      <h3>${escapeHtml(sym.name || "")}</h3>
      ${contextHtml}
      <div class="field-label">${escapeHtml(I18N.t("worksheet.goldAssoc"))}</div>
      <div class="field-value">${escapeHtml(sym.selected_association || "—")}</div>
      ${questionsHtml}
      ${noteHtml}
    </article>`;
  }

  // --- Markdown ---
  // Markdown'da kaçış minimumda tutuluyor: kullanıcının kendi yazdığı metin
  // olduğu gibi okunabilir kalmalı. Sadece satır başındaki, paragrafı yanlışlıkla
  // başlık/liste yapacak işaretler etkisizleştiriliyor.
  function mdBlock(text) {
    return String(text ?? "")
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((line) => line.replace(/^(\s*)([#>*+-]|\d+\.)(\s)/, "$1\\$2$3"))
      .join("\n")
      .trim();
  }

  function mdInline(text) {
    return String(text ?? "").replace(/\r?\n+/g, " ").trim();
  }

  // Yerel tarih/saat — toISOString() UTC'ye çevirdiği için gece yazılan bir
  // rüyanın dosya adı ve frontmatter tarihi bir gün geriye kayabiliyordu.
  function localStamp(date, withTime) {
    const p = (n) => String(n).padStart(2, "0");
    const d = `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
    return withTime ? `${d}-${p(date.getHours())}-${p(date.getMinutes())}-${p(date.getSeconds())}` : d;
  }

  function buildReportMarkdown(record, options) {
    const includeAi = !(options && options.includeAi === false);
    const locale = I18N.getLang() === "en" ? "en-US" : "tr-TR";
    const saved = record.saved_at ? new Date(record.saved_at) : new Date();
    const symbols = record.symbols || [];
    const out = [];

    // YAML frontmatter: Obsidian/Dataview gibi araçlar rüyaları tarih ve
    // sembollerine göre süzebilsin diye — "biriktir, sonra aralarında bağ kur"
    // hedefinin en ucuz karşılığı.
    out.push("---");
    out.push(`title: ${JSON.stringify(I18N.t("report.title"))}`);
    out.push(`date: ${localStamp(saved, false)}`);
    out.push("type: dream");
    if (symbols.length) {
      out.push("symbols:");
      symbols.forEach((s) => out.push(`  - ${JSON.stringify(mdInline(s.name || ""))}`));
    }
    out.push(`has_ai_expansion: ${includeAi && !!(record.interpretation || "").trim()}`);
    if ((record.ritual_text || "").trim()) {
      out.push(`ritual_done: ${!!record.ritual_done}`);
    }
    out.push("---");
    out.push("");
    out.push(`# ${I18N.t("report.title")}`);
    out.push("");
    out.push(`*${saved.toLocaleString(locale)} — ${symbols.length} ${I18N.t("report.coverSymbolCount")}*`);
    out.push("");

    out.push(`## ${I18N.t("report.dreamHeading")}`);
    out.push("");
    out.push(mdBlock(record.dream_text || ""));
    out.push("");
    if (record.personal_context) {
      out.push(`**${I18N.t("report.contextHeading")}**`);
      out.push("");
      out.push(mdBlock(record.personal_context));
      out.push("");
    }
    if (record.dream_attitude) {
      out.push(`**${I18N.t("report.attitudeHeading")}**`);
      out.push("");
      out.push(mdBlock(record.dream_attitude));
      out.push("");
    }
    if (record.dream_emotion) {
      out.push(`**${I18N.t("report.emotionHeading")}**`);
      out.push("");
      out.push(mdBlock(record.dream_emotion));
      out.push("");
    }
    if (record.dream_arc) {
      out.push(`**${I18N.t("report.arcHeading")}**`);
      out.push("");
      out.push(mdBlock(record.dream_arc));
      out.push("");
    }

    if (symbols.length) {
      // Kısa özet: her sembol → seçtiği çağrışım, tek satırda — ekrandaki
      // haritanın iki halkasının (sembol adı / altın çağrışım) metin
      // karşılığı. Haritanın kendisi markdown'a hiç gömülmüyor (SVG'yi
      // gömmek dosyayı okunmaz hale getiriyor), bunun yerine aşağıdaki
      // "Rapor Kartları" zaten tüm detayı (bağlam, 4 soru) veriyor — bu
      // liste sadece hızlı bir bakış/özet, o bölümün tekrarı değil.
      out.push(`## ${I18N.t("report.mapHeading")}`);
      out.push("");
      symbols.forEach((sym) => {
        const assoc = (sym.selected_association || "").trim();
        out.push(`- **${mdInline(sym.name || "")}**${assoc ? ` → ${mdInline(assoc)}` : ""}`);
      });
      out.push("");
    }

    if (symbols.length) {
      out.push(`## ${I18N.t("report.cardsHeading")}`);
      out.push("");
      symbols.forEach((sym) => {
        const q = sym.questions || {};
        out.push(`### ${mdInline(sym.name || "")}`);
        out.push("");
        if (sym.context) out.push(`*${mdInline(sym.context)}*`);
        out.push("");
        out.push(`**${I18N.t("worksheet.goldAssoc")}:** ${mdInline(sym.selected_association) || "—"}`);
        out.push("");
        SymbolMap.questionLabels.forEach(([key, label]) => {
          const answer = q[key] && q[key].trim() ? mdInline(q[key]) : "—";
          out.push(`- **${label}** ${answer}`);
        });
        out.push("");
        if ((sym.report_note || "").trim()) {
          out.push(`**${I18N.t("notes.report")}**`);
          out.push("");
          out.push(mdBlock(sym.report_note));
          out.push("");
        }
      });
    }

    const own = (record.my_interpretation || "").trim();
    if (own) {
      out.push(`## ${I18N.t("result.myHeading")}`);
      out.push("");
      out.push(mdBlock(own));
      out.push("");
    }

    const ai = (record.interpretation || "").trim();
    if (includeAi && ai) {
      out.push(`## ${I18N.t("result.aiHeading")}`);
      out.push("");
      out.push(`> ${I18N.t("result.frame")}`);
      out.push("");
      out.push(mdBlock(ai));
      out.push("");
    }

    const ritual = (record.ritual_text || "").trim();
    if (ritual) {
      out.push(`## ${I18N.t("ritual.heading")}`);
      out.push("");
      out.push(mdBlock(ritual));
      out.push("");
      out.push(`*${I18N.t(record.ritual_done ? "ritual.reportDone" : "ritual.reportPending")}*`);
      out.push("");
    }

    return out.join("\n").replace(/\n{3,}/g, "\n\n") + "\n";
  }

  function downloadText(filename, text, mime) {
    const blob = new Blob([text], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // --- Yazdırılabilir HTML ---

  function buildReportHtml(record, options) {
    const includeAi = !(options && options.includeAi === false);
    const locale = I18N.getLang() === "en" ? "en-US" : "tr-TR";
    const dateStr = new Date().toLocaleString(locale);
    const dreamSnippet = (record.dream_text || "").replace(/\s+/g, " ").trim().slice(0, 220);
    const symbols = record.symbols || [];
    const mapSvgString = symbols.length ? SymbolMap.svgToString(SymbolMap.buildMapSvg(record, "paper")) : "";
    const contextBlock = record.personal_context
      ? `<div class="field-label">${escapeHtml(I18N.t("report.contextHeading"))}</div><p class="context-text">${escapeHtml(record.personal_context)}</p>`
      : "";
    const attitudeBlock = record.dream_attitude
      ? `<div class="field-label">${escapeHtml(I18N.t("report.attitudeHeading"))}</div><p class="context-text">${escapeHtml(record.dream_attitude)}</p>`
      : "";
    const emotionBlock = record.dream_emotion
      ? `<div class="field-label">${escapeHtml(I18N.t("report.emotionHeading"))}</div><p class="context-text">${escapeHtml(record.dream_emotion)}</p>`
      : "";
    const arcBlock = record.dream_arc
      ? `<div class="field-label">${escapeHtml(I18N.t("report.arcHeading"))}</div><p class="context-text">${escapeHtml(record.dream_arc)}</p>`
      : "";
    const cardsHtml = symbols.map(buildReportCardHtml).join("\n");
    const own = (record.my_interpretation || "").trim();
    const ownSection = own
      ? `<section class="section">
          <h2>${escapeHtml(I18N.t("result.myHeading"))}</h2>
          <p class="interpretation-text">${escapeHtml(own)}</p>
        </section>`
      : "";
    const ai = (record.interpretation || "").trim();
    const interpretationSection =
      includeAi && ai
        ? `<section class="section">
          <h2>${escapeHtml(I18N.t("result.aiHeading"))}</h2>
          <p class="report-frame">${escapeHtml(I18N.t("result.frame"))}</p>
          <p class="interpretation-text">${escapeHtml(ai)}</p>
        </section>`
        : "";
    const ritual = (record.ritual_text || "").trim();
    const ritualSection = ritual
      ? `<section class="section">
          <h2>${escapeHtml(I18N.t("ritual.heading"))}</h2>
          <p class="interpretation-text">${escapeHtml(ritual)}</p>
          <p class="report-frame">${escapeHtml(I18N.t(record.ritual_done ? "ritual.reportDone" : "ritual.reportPending"))}</p>
        </section>`
      : "";

    return `<!doctype html>
<html lang="${I18N.getLang()}">
<head>
<meta charset="utf-8">
<title>${escapeHtml(I18N.t("report.title"))}</title>
<style>
  :root {
    --ink:#241f16; --muted:#6b6252; --accent:#7a5a2e; --accent-strong:#5e4322;
    --gold:#96692a; --ring:#cdbfa0; --paper:#f8f4e9; --card:#fffdf7;
  }
  * { box-sizing: border-box; }
  body {
    margin:0; padding:32px 40px 60px; background:var(--paper); color:var(--ink);
    font-family:${SymbolMap.fonts.body}; font-size:14px; line-height:1.6;
  }
  h1, h2, h3 { font-family:${SymbolMap.fonts.head}; color:var(--accent-strong); font-weight:600; margin:0 0 10px; }
  h1 { font-size:30px; }
  h2 { font-size:20px; margin-top:0; border-bottom:1px solid var(--ring); padding-bottom:8px; }
  h3 { font-size:17px; color:var(--accent); margin-bottom:6px; }
  .cover { text-align:center; padding:70px 0 44px; }
  .cover .date { color:var(--muted); font-size:13px; margin-bottom:6px; }
  .cover .snippet { font-style:italic; color:var(--muted); max-width:520px; margin:18px auto 0; }
  .section { break-before: page; padding-top:8px; }
  .section:first-of-type { break-before: auto; }
  .dream-text, .context-text, .interpretation-text { white-space:pre-wrap; }
  .map-wrap { display:flex; justify-content:center; margin-top:12px; }
  .map-wrap svg { width:100%; max-width:600px; height:auto; }
  .report-card {
    break-inside: avoid; border:1px solid var(--ring); border-radius:10px;
    padding:18px 22px; margin-bottom:16px; background:var(--card);
    border-left:5px solid var(--gold);
  }
  .field-label { font-size:11px; letter-spacing:0.08em; text-transform:uppercase; color:var(--accent); font-weight:700; margin-top:12px; }
  .field-value { margin-top:2px; }
  .field-value.muted { color:var(--muted); }
  .report-frame { font-style:italic; color:var(--muted); margin:0 0 12px; }
  .print-bar { text-align:center; margin-bottom:24px; }
  .print-bar button {
    font-family:${SymbolMap.fonts.body}; font-size:13px; padding:8px 18px; border-radius:999px;
    border:1px solid var(--ring); background:var(--card); color:var(--accent-strong); cursor:pointer;
  }
  @media print { .print-bar { display:none; } body { padding:0 20mm 20mm; } }
  @page { margin:16mm; }
</style>
</head>
<body>
  <div class="print-bar">
    <button type="button" onclick="window.print()">${escapeHtml(I18N.t("report.printButton"))}</button>
  </div>
  <div class="cover">
    <div class="date">${escapeHtml(dateStr)}</div>
    <h1>${escapeHtml(I18N.t("report.title"))}</h1>
    <div class="snippet">${escapeHtml(dreamSnippet)}</div>
    <div class="date">${symbols.length} ${escapeHtml(I18N.t("report.coverSymbolCount"))}</div>
  </div>

  <section class="section">
    <h2>${escapeHtml(I18N.t("report.dreamHeading"))}</h2>
    <p class="dream-text">${escapeHtml(record.dream_text || "")}</p>
    ${contextBlock}
    ${attitudeBlock}
    ${emotionBlock}
    ${arcBlock}
  </section>

  ${mapSvgString ? `<section class="section"><h2>${escapeHtml(I18N.t("report.mapHeading"))}</h2><div class="map-wrap">${mapSvgString}</div></section>` : ""}

  ${cardsHtml ? `<section class="section"><h2>${escapeHtml(I18N.t("report.cardsHeading"))}</h2>${cardsHtml}</section>` : ""}

  ${ownSection}

  ${interpretationSection}

  ${ritualSection}
</body>
</html>`;
  }

  function openReport(record, options) {
    if (!record) return;
    const html = buildReportHtml(record, options);
    const win = window.open("", "_blank");
    if (!win) {
      window.alert(I18N.t("report.popupBlocked"));
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    // document.write üzerine bir "load" olayı güvenilir tetiklenmiyor
    // (pencere about:blank olarak zaten bir kez yüklendi) — kısa bir
    // gecikmeyle yazdırmayı tetikliyoruz; içerik tamamen satır-içi
    // olduğu için (harici font/kaynak yok) render için uzun süre gerekmiyor.
    // Otomatik tetiklenmezse sayfanın üstündeki "Yazdır" düğmesi yedek.
    setTimeout(() => {
      win.focus();
      win.print();
    }, 150);
  }

  function downloadJSON(filename, record) {
    const blob = new Blob([JSON.stringify(record, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // Rapor menüsü: tek düğme, iki çıktı (.md / yazdır) ve tek seçenek
  // (yapay zeka genişletmesi dahil mi). Kayıtta genişletme yoksa onay kutusu
  // anlamsız — gizleniyor, ki seçenek gürültüsü olmasın.
  function reportRecord() {
    return state.lastRecord;
  }

  function closeReportMenu() {
    el.reportMenu.classList.add("hidden");
    el.btnReport.setAttribute("aria-expanded", "false");
  }

  function reportSlug(record) {
    const base = record && record.saved_at ? new Date(record.saved_at) : new Date();
    return localStamp(base, true);
  }

  el.btnReport.addEventListener("click", (e) => {
    e.stopPropagation();
    const opening = el.reportMenu.classList.contains("hidden");
    if (!opening) {
      closeReportMenu();
      return;
    }
    const hasAi = !!((reportRecord() || {}).interpretation || "").trim();
    el.reportIncludeAi.closest(".report-menu-check").classList.toggle("hidden", !hasAi);
    if (!hasAi) el.reportIncludeAi.checked = false;
    el.reportMenu.classList.remove("hidden");
    el.btnReport.setAttribute("aria-expanded", "true");
  });

  el.reportMenu.addEventListener("click", (e) => e.stopPropagation());
  document.addEventListener("click", closeReportMenu);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeReportMenu();
  });

  el.btnReportMd.addEventListener("click", () => {
    const record = reportRecord();
    if (!record) return;
    const options = { includeAi: el.reportIncludeAi.checked };
    downloadText(`ruya-${reportSlug(record)}.md`, buildReportMarkdown(record, options), "text/markdown");
    closeReportMenu();
  });

  el.btnReportPrint.addEventListener("click", () => {
    const record = reportRecord();
    if (!record) return;
    openReport(record, { includeAi: el.reportIncludeAi.checked });
    closeReportMenu();
  });

  // ---------- Dışa/içe aktarma (.json) ----------
  // Render gibi ücretsiz hosting'lerde disk kalıcı değil — sunucudaki
  // ruyalar/ klasörü her yeniden başlatmada silinebilir. .json yedeği bu
  // yüzden ikincil bir depolama değil, ASIL depolama: kullanıcı kendi
  // cihazında/bulutunda tutar, "Dosyadan Aç" ile istediği an (harita dahil)
  // tam sonuç ekranını sunucuya hiç ihtiyaç duymadan geri açabilir.

  el.btnDownloadJson.addEventListener("click", () => {
    if (!state.lastRecord) return;
    const slug = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    downloadJSON(`ruya-${slug}.json`, state.lastRecord);
  });

  function isValidDreamRecord(record) {
    return (
      record &&
      typeof record === "object" &&
      typeof record.dream_text === "string" &&
      Array.isArray(record.symbols)
    );
  }

  // Rapor (yazdır/PDF) .txt export'un yerini almadan önceki oturumlardan
  // kalan eski .txt dosyaları da (aynı "Dosyadan Aç" ile) açılabilsin diye —
  // artık üretilmeyen ama geçmişte kullanılan formatı tersine çeviren bir
  // metin ayrıştırıcı. Bu format burada sabit kodlanmıştır; geriye dönük
  // uyumluluk için değiştirilmemeli.
  function parseExportText(text) {
    const DREAM_H = "\nRÜYA\n";
    const CTX_H = "\nBu rüyayı neden bu gece görmüş olabilirim:\n";
    const SYM_H = "\nSEMBOLLER\n";
    const YORUM_H = "\nYORUM\n";

    const withLeadingNl = "\n" + text.trim() + "\n";
    const dreamIdx = withLeadingNl.indexOf(DREAM_H);
    const ctxIdx = withLeadingNl.indexOf(CTX_H);
    const symIdx = withLeadingNl.indexOf(SYM_H);
    const yorumIdx = withLeadingNl.indexOf(YORUM_H);
    const missingSections = [];
    if (dreamIdx === -1) missingSections.push("RÜYA");
    if (ctxIdx === -1) missingSections.push("Bu rüyayı neden bu gece görmüş olabilirim");
    if (symIdx === -1) missingSections.push("SEMBOLLER");
    if (yorumIdx === -1) missingSections.push("YORUM");
    if (missingSections.length) {
      const err = new Error("missing-sections");
      err.missingSections = missingSections;
      throw err;
    }

    const dream_text = withLeadingNl.slice(dreamIdx + DREAM_H.length, ctxIdx).replace(/\n+$/, "");
    const ctxRaw = withLeadingNl.slice(ctxIdx + CTX_H.length, symIdx).replace(/\n+$/, "");
    const personal_context = ctxRaw === "—" ? "" : ctxRaw;
    const symbolsBlock = withLeadingNl.slice(symIdx + SYM_H.length, yorumIdx);
    const interpretation = withLeadingNl.slice(yorumIdx + YORUM_H.length).replace(/\n+$/, "");

    const fieldValue = (line, label) => {
      const v = line.slice(label.length).trim();
      return v === "—" ? "" : v;
    };

    const symbols = symbolsBlock
      .split(/\n(?=\d+\.\s)/)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const lines = entry.split("\n");
        const nameMatch = lines[0].match(/^\d+\.\s(.+)$/);
        const sym = {
          name: nameMatch ? nameMatch[1].trim() : lines[0].trim(),
          name_en: "",
          context: "",
          selected_association: "",
          all_associations: [],
          questions: { q1: "", q2: "", q3: "", q4: "" },
        };
        lines.slice(1).forEach((raw) => {
          const l = raw.trim();
          if (l.startsWith("Bağlam:")) sym.context = fieldValue(l, "Bağlam:");
          else if (l.startsWith("Seçilen çağrışım:")) sym.selected_association = fieldValue(l, "Seçilen çağrışım:");
          else if (l.startsWith("Diğer çağrışımlar:"))
            sym.all_associations = fieldValue(l, "Diğer çağrışımlar:")
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
          else if (l.startsWith("Bu içimde hangi parçam?")) sym.questions.q1 = fieldValue(l, "Bu içimde hangi parçam?");
          else if (l.startsWith("Hayatımdaki işlevi ne / nereyi yönetiyor?"))
            sym.questions.q2 = fieldValue(l, "Hayatımdaki işlevi ne / nereyi yönetiyor?");
          else if (l.startsWith("Kişiliğimin neresinde bunu görüyorum?"))
            sym.questions.q3 = fieldValue(l, "Kişiliğimin neresinde bunu görüyorum?");
          else if (l.startsWith("Kim içimde böyle davranıyor?"))
            sym.questions.q4 = fieldValue(l, "Kim içimde böyle davranıyor?");
        });
        return sym;
      });

    return { dream_text, personal_context, symbols, interpretation };
  }

  el.btnImport.addEventListener("click", () => el.importFileInput.click());

  el.importFileInput.addEventListener("change", async () => {
    const file = el.importFileInput.files && el.importFileInput.files[0];
    el.importFileInput.value = ""; // aynı dosya arka arkaya seçilebilsin diye
    if (!file) return;
    let text;
    try {
      text = await file.text();
    } catch (err) {
      window.alert(I18N.t("import.error"));
      return;
    }

    const looksLikeJson = /\.json$/i.test(file.name) || text.trim().startsWith("{");
    let record;
    if (looksLikeJson) {
      try {
        record = JSON.parse(text);
      } catch (err) {
        window.alert(I18N.t("import.invalidJson"));
        return;
      }
    } else {
      try {
        record = parseExportText(text);
      } catch (err) {
        window.alert(I18N.t("import.missingSections", { sections: err.missingSections.join(", ") }));
        return;
      }
    }

    // Kullanıcı "Dosyadan Aç" ile yanlışlıkla bir taslak seçerse (interpretation
    // yok) burada takılıp boş bir sonuç ekranı göstermek yerine, doğru akışa
    // (taslak yükleme) yönlendir.
    if (record && record.is_draft === true) {
      if (!isValidDraftRecord(record)) {
        window.alert(I18N.t("loadDraft.invalid"));
        return;
      }
      loadDraftIntoState(record);
      return;
    }
    if (!isValidDreamRecord(record)) {
      window.alert(I18N.t("import.missingFields"));
      return;
    }
    state.lastRecord = record;
    state.resultReady = true;
    state.dreamText = record.dream_text || "";
    state.myInterpretation = record.my_interpretation || "";
    resetProgress();
    renderResult(record);
    el.btnNewDream.classList.remove("hidden");
  });

  // ---------- Taslak kaydet/yükle (.json, yorumsuz) ----------
  // Model/prompt testi için: aynı rüya + semboller + çağrışımlar + 4 soru
  // cevabını her seferinde elle yeniden girmeden, "Yorumu Oluştur"a basmadan
  // hemen önceki durumu (interpretation henüz YOK) kaydedip geri yükleyebilmek
  // içindir. Tam sonuç JSON'undan (result.downloadJson) farkı: interpretation
  // alanı yok, symbols ham associations/questions şeklinde duruyor — yani
  // yüklendiğinde Yorum adımından hemen önceki, hâlâ düzenlemeye açık duruma
  // döner (renderResult ile doğrudan sonuç göstermez).

  function isValidDraftRecord(record) {
    return (
      record &&
      typeof record === "object" &&
      record.is_draft === true &&
      typeof record.dream_text === "string" &&
      Array.isArray(record.symbols)
    );
  }

  // targetSection: taslak yüklendikten sonra açılacak adım. Varsayılan Yorum
  // adımı (taslak dosyası yükleme akışı böyle çalışıyor), ama yarım kalmış
  // ilerleme geri yüklenirken kaydedilen adım veriliyor — iki ayrı
  // showOnlyStep çağrısı yapılırsa geçiş animasyonunun zamanlayıcısı yüzünden
  // yanlış adım kazanıyor (yarış koşulu), o yüzden tek çağrı.
  function loadDraftIntoState(record, targetSection) {
    state.dreamText = record.dream_text || "";
    state.dreamTitle = record.title || "";
    state.dreamContext = record.personal_context || "";
    state.dreamAttitude = record.dream_attitude || "";
    state.dreamEmotion = record.dream_emotion || "";
    state.dreamArc = record.dream_arc || "";
    state.myInterpretation = record.my_interpretation || "";
    state.symbols = (record.symbols || []).map((s) => ({
      name: s.name || "",
      name_en: s.name_en || "",
      context: s.context || "",
      associations: Array.isArray(s.associations)
        ? s.associations.map((a) => ({
            id: a.id || uid(),
            text: a.text || "",
            selected: !!a.selected,
          }))
        : [],
      questions: {
        q1: (s.questions && s.questions.q1) || "",
        q2: (s.questions && s.questions.q2) || "",
        q3: (s.questions && s.questions.q3) || "",
        q4: (s.questions && s.questions.q4) || "",
      },
      meditation: s.meditation || "",
      report_note: s.report_note || "",
    }));
    state.activeIndex = null;
    state.resultReady = false;
    state.lastRecord = null;

    el.dreamText.value = state.dreamText;
    el.dreamTitle.value = state.dreamTitle;
    el.dreamContext.value = state.dreamContext;
    el.dreamAttitude.value = state.dreamAttitude;
    el.dreamEmotion.value = state.dreamEmotion;
    el.dreamArc.value = state.dreamArc;
    el.myInterpretation.value = state.myInterpretation;
    el.btnNewDream.classList.add("hidden");
    renderChips();
    updateProgress();
    showOnlyStep(targetSection || el.stepFinalize);
  }

  el.btnSaveDraft.addEventListener("click", () => {
    const slug = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    downloadJSON(`ruya-taslak-${slug}.json`, {
      is_draft: true,
      dream_text: state.dreamText,
      title: state.dreamTitle,
      personal_context: state.dreamContext,
      dream_attitude: state.dreamAttitude,
      dream_emotion: state.dreamEmotion,
      dream_arc: state.dreamArc,
      my_interpretation: ownInterpretationText(),
      symbols: state.symbols,
    });
    setStatus(el.finalizeStatus, I18N.t("finalize.draftSaved"));
  });

  el.btnLoadDraft.addEventListener("click", () => el.draftFileInput.click());

  el.draftFileInput.addEventListener("change", async () => {
    const file = el.draftFileInput.files && el.draftFileInput.files[0];
    el.draftFileInput.value = ""; // aynı dosya arka arkaya seçilebilsin diye
    if (!file) return;
    try {
      const record = JSON.parse(await file.text());
      if (!isValidDraftRecord(record)) {
        window.alert(I18N.t("loadDraft.invalid"));
        return;
      }
      loadDraftIntoState(record);
    } catch (err) {
      window.alert(I18N.t("loadDraft.error"));
    }
  });

  el.btnCopyResult.addEventListener("click", async () => {
    try {
      const parts = [el.myInterpText.textContent, el.resultText.textContent].filter((t) => t && t.trim());
      await navigator.clipboard.writeText(parts.join("\n\n———\n\n"));
      const original = el.btnCopyResult.innerHTML;
      el.btnCopyResult.innerHTML = "";
      el.btnCopyResult.appendChild(makeIcon("check", "icon-sm"));
      el.btnCopyResult.append(I18N.t("result.copied"));
      setTimeout(() => (el.btnCopyResult.innerHTML = original), 1500);
    } catch (err) {
      setStatus(el.finalizeStatus, I18N.t("result.copyError"), true);
    }
  });

  // ---------- Yeni rüya ----------

  el.btnNewDream.addEventListener("click", () => {
    state.dreamText = "";
    state.dreamTitle = "";
    state.dreamContext = "";
    state.dreamAttitude = "";
    state.dreamEmotion = "";
    state.dreamArc = "";
    state.myInterpretation = "";
    state.symbols = [];
    state.activeIndex = null;
    state.resultReady = false;
    state.lastRecord = null;
    state.lastSavedFile = null;

    el.dreamText.value = "";
    el.dreamTitle.value = "";
    el.dreamContext.value = "";
    el.dreamAttitude.value = "";
    el.dreamEmotion.value = "";
    el.dreamArc.value = "";
    el.myInterpretation.value = "";
    el.manualSymbolInput.value = "";
    setStatus(el.extractStatus, "");
    setStatus(el.finalizeStatus, "");
    el.btnNewDream.classList.add("hidden");
    resetProgress();
    clearProgress();

    showOnlyStep(el.stepDream);
  });

  // ---------- Geçmiş rüyalar ----------

  function renderLibrary() {
    const onlyIncomplete = el.libraryOnlyIncomplete.checked;
    const sortKey = el.librarySort.value;
    const dreams = Library.sortDreams(
      Library.filterDreams(state.libraryDreams, { onlyIncomplete }),
      sortKey
    );

    el.historyList.innerHTML = "";
    if (!dreams.length) {
      el.historyEmpty.classList.remove("hidden");
      return;
    }
    el.historyEmpty.classList.add("hidden");

    dreams.forEach((d, i) => {
      const li = document.createElement("li");
      li.className = "history-card";
      li.style.setProperty("--i", i);

      const displayName = d.title || dreamSnippet(d);

      const titleRow = document.createElement("div");
      titleRow.className = "history-card-title-row";
      const titleSpan = document.createElement("strong");
      titleSpan.className = "history-card-title";
      titleSpan.textContent = d.title || I18N.t("library.untitled");
      titleRow.appendChild(titleSpan);
      titleRow.appendChild(
        makeRenameControl(
          d.title || "",
          (newTitle) => renameDreamTitle(d.file, newTitle),
          renderLibrary
        )
      );
      titleRow.querySelector(".symbol-rename-btn").setAttribute(
        "aria-label",
        I18N.t("library.renameTitle", { name: displayName })
      );

      const dateSpan = document.createElement("span");
      dateSpan.className = "history-date";
      dateSpan.textContent = d.saved_at
        ? new Date(d.saved_at).toLocaleString(I18N.getLang() === "en" ? "en-US" : "tr-TR")
        : "";

      const badge = document.createElement("span");
      badge.className = "completion-badge";
      badge.textContent = I18N.t("library.completion", { pct: d.completion_pct ?? 0 });

      const metaRow = document.createElement("div");
      metaRow.className = "history-card-meta";
      metaRow.appendChild(dateSpan);
      metaRow.appendChild(badge);
      if (d.ritual_done) {
        const ritualBadge = document.createElement("span");
        ritualBadge.className = "completion-badge ritual-done-badge";
        ritualBadge.textContent = I18N.t("library.ritualBadge");
        metaRow.appendChild(ritualBadge);
      }

      const textSpan = document.createElement("p");
      textSpan.className = "history-card-text";
      textSpan.textContent = d.dream_text + (d.dream_text.length >= 120 ? "…" : "");

      const footerRow = document.createElement("div");
      footerRow.className = "history-card-footer";
      const countSpan = document.createElement("span");
      countSpan.className = "history-card-count";
      countSpan.textContent = I18N.t("library.symbolCount", { count: d.symbol_count ?? 0 });
      const downloadBtn = document.createElement("button");
      downloadBtn.type = "button";
      downloadBtn.className = "symbol-rename-btn";
      downloadBtn.setAttribute("aria-label", I18N.t("library.download", { name: displayName }));
      downloadBtn.appendChild(makeIcon("download", "icon-sm"));
      downloadBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        downloadDreamReport(d.file);
      });
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "symbol-rename-btn danger";
      deleteBtn.setAttribute("aria-label", I18N.t("library.delete", { name: displayName }));
      deleteBtn.appendChild(makeIcon("trash", "icon-sm"));
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteDream(d.file, displayName);
      });
      footerRow.appendChild(countSpan);
      footerRow.appendChild(downloadBtn);
      footerRow.appendChild(deleteBtn);

      // Ritüel günler sonra yapılabileceği için (rezonansın aksine) bu
      // işaret sadece kütüphaneden, her zaman değiştirilebilir.
      if (d.has_ritual) {
        const ritualBtn = document.createElement("button");
        ritualBtn.type = "button";
        ritualBtn.className = "symbol-rename-btn ritual-toggle" + (d.ritual_done ? " active" : "");
        ritualBtn.setAttribute(
          "aria-label",
          I18N.t(d.ritual_done ? "library.ritualUndo" : "library.ritualMark", { name: displayName })
        );
        ritualBtn.appendChild(makeIcon("check", "icon-sm"));
        ritualBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          toggleRitualDone(d);
        });
        footerRow.appendChild(ritualBtn);
      }

      li.appendChild(titleRow);
      li.appendChild(metaRow);
      li.appendChild(textSpan);
      li.appendChild(footerRow);
      li.addEventListener("click", () => showHistoryDetail(d.file));
      el.historyList.appendChild(li);
    });
  }

  function dreamSnippet(d) {
    return d.dream_text + (d.dream_text.length >= 120 ? "…" : "");
  }

  async function downloadDreamReport(fname) {
    const record = await getJSON(`/api/dreams/${encodeURIComponent(fname)}`);
    downloadText(`ruya-${reportSlug(record)}.md`, buildReportMarkdown(record), "text/markdown");
  }

  async function renameDreamTitle(fname, newTitle) {
    const trimmed = (newTitle || "").trim();
    const dream = state.libraryDreams.find((d) => d.file === fname);
    if (!dream || trimmed === (dream.title || "")) return;
    await postJSON(`/api/dreams/${encodeURIComponent(fname)}`, { title: trimmed }, "PATCH");
    dream.title = trimmed;
  }

  async function toggleRitualDone(dream) {
    const next = !dream.ritual_done;
    try {
      await postJSON(`/api/dreams/${encodeURIComponent(dream.file)}`, { ritual_done: next }, "PATCH");
      dream.ritual_done = next;
      renderLibrary();
    } catch (err) {
      // sessiz geç — kart eski durumuyla kalır, kullanıcı tekrar deneyebilir
    }
  }

  // Silme geri alınamaz — tek onay yeterli (toplu silmeden farklı olarak
  // burada tek bir kayıt riske giriyor).
  async function deleteDream(fname, displayName) {
    if (!window.confirm(I18N.t("library.deleteConfirm", { name: displayName }))) return;
    try {
      await postJSON(`/api/dreams/${encodeURIComponent(fname)}`, null, "DELETE");
      state.libraryDreams = state.libraryDreams.filter((d) => d.file !== fname);
      renderLibrary();
    } catch (err) {
      window.alert(err.message);
    }
  }

  el.btnDeleteAll.addEventListener("click", async () => {
    const count = state.libraryDreams.length;
    if (!count) return;
    // Filtreden bağımsız, kütüphanedeki TÜM kayıtları siler — "Tümünü İndir"den
    // farklı olarak burada yıkıcı bir eylem söz konusu, belirsizlik istenmedi
    // (Kaan'ın seçimi, 2026-09-13).
    if (!window.confirm(I18N.t("library.deleteAllConfirm", { count }))) return;
    try {
      await postJSON("/api/dreams", null, "DELETE");
      state.libraryDreams = [];
      renderLibrary();
    } catch (err) {
      window.alert(err.message);
    }
  });

  el.librarySort.addEventListener("change", renderLibrary);
  el.libraryOnlyIncomplete.addEventListener("change", renderLibrary);

  el.btnLibraryDownloadAll.addEventListener("click", async () => {
    const onlyIncomplete = el.libraryOnlyIncomplete.checked;
    const sortKey = el.librarySort.value;
    const dreams = Library.sortDreams(
      Library.filterDreams(state.libraryDreams, { onlyIncomplete }),
      sortKey
    );
    if (!dreams.length) return;

    const originalLabel = el.btnLibraryDownloadAll.textContent;
    el.btnLibraryDownloadAll.disabled = true;
    el.btnLibraryDownloadAll.textContent = I18N.t("library.downloadingAll");
    try {
      const records = await Promise.all(
        dreams.map((d) => getJSON(`/api/dreams/${encodeURIComponent(d.file)}`))
      );
      const zip = new JSZip();
      records.forEach((record) => {
        zip.file(`ruya-${reportSlug(record)}.md`, buildReportMarkdown(record));
      });
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ruya-kutuphanesi-${localStamp(new Date(), true)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      el.btnLibraryDownloadAll.disabled = false;
      el.btnLibraryDownloadAll.textContent = originalLabel;
    }
  });

  el.btnToggleRecurring.addEventListener("click", async () => {
    const opening = el.recurringPanel.classList.contains("hidden");
    if (!opening) {
      el.recurringPanel.classList.add("hidden");
      return;
    }
    el.recurringPanel.classList.remove("hidden");
    el.recurringList.innerHTML = "";
    el.recurringEmpty.classList.add("hidden");
    try {
      const data = await getJSON("/api/dreams/recurring-symbols");
      renderRecurringSymbols(data.symbols);
    } catch (err) {
      el.recurringEmpty.textContent = err.message;
      el.recurringEmpty.classList.remove("hidden");
    }
  });

  function renderRecurringSymbols(symbols) {
    el.recurringList.innerHTML = "";
    if (!symbols.length) {
      el.recurringEmpty.textContent = I18N.t("library.recurringEmpty");
      el.recurringEmpty.classList.remove("hidden");
      return;
    }
    el.recurringEmpty.classList.add("hidden");
    symbols.forEach((s) => {
      const li = document.createElement("li");
      li.className = "recurring-item";

      const summary = document.createElement("button");
      summary.type = "button";
      summary.className = "recurring-summary";
      summary.textContent = `${s.name} — ${I18N.t("library.recurringCount", { count: s.count })}`;

      const details = document.createElement("ul");
      details.className = "recurring-occurrences hidden";
      s.occurrences.forEach((occ) => {
        const item = document.createElement("li");
        const date = occ.saved_at
          ? new Date(occ.saved_at).toLocaleDateString(I18N.getLang() === "en" ? "en-US" : "tr-TR")
          : "";
        const label = occ.title || date;
        item.textContent = occ.selected_association ? `${label}: ${occ.selected_association}` : label;
        details.appendChild(item);
      });

      summary.addEventListener("click", () => details.classList.toggle("hidden"));

      li.appendChild(summary);
      li.appendChild(details);
      el.recurringList.appendChild(li);
    });
  }

  // Zaman içinde değişim: AI'sız, statik bir zaman şeridi — Faz 1.1'in üç
  // alanını (genel tutum / duygu / başlangıç-bitiş) tarih sırasıyla (eskiden
  // yeniye) alt alta dizer, örüntüyü AI değil kullanıcı kendi gözüyle görür.
  // Kütüphanenin kendi state.libraryDreams'ine (zamanlama yarışına girmemek
  // için) güvenmek yerine, tıklanınca kendi /api/dreams çağrısını yapar —
  // tekrar eden semboller panelinin izlediği desenin aynısı.
  el.btnToggleTimeline.addEventListener("click", async () => {
    const opening = el.timelinePanel.classList.contains("hidden");
    if (!opening) {
      el.timelinePanel.classList.add("hidden");
      return;
    }
    el.timelinePanel.classList.remove("hidden");
    el.timelineList.innerHTML = "";
    el.timelineEmpty.classList.add("hidden");
    try {
      const data = await getJSON("/api/dreams");
      renderTimeline(data.dreams);
    } catch (err) {
      el.timelineEmpty.textContent = err.message;
      el.timelineEmpty.classList.remove("hidden");
    }
  });

  function renderTimeline(dreams) {
    el.timelineList.innerHTML = "";
    const withData = (dreams || [])
      .filter((d) => d.dream_attitude || d.dream_emotion || d.dream_arc)
      .slice()
      .sort((a, b) => new Date(a.saved_at) - new Date(b.saved_at));

    if (!withData.length) {
      el.timelineEmpty.textContent = I18N.t("library.timelineEmpty");
      el.timelineEmpty.classList.remove("hidden");
      return;
    }
    el.timelineEmpty.classList.add("hidden");

    const locale = I18N.getLang() === "en" ? "en-US" : "tr-TR";
    withData.forEach((d) => {
      const li = document.createElement("li");
      li.className = "timeline-item";

      const dateSpan = document.createElement("strong");
      dateSpan.className = "timeline-date";
      const dateText = d.saved_at ? new Date(d.saved_at).toLocaleDateString(locale) : "";
      dateSpan.textContent = d.title ? (dateText ? `${dateText} — ${d.title}` : d.title) : dateText;
      li.appendChild(dateSpan);

      const rows = document.createElement("ul");
      rows.className = "timeline-fields";
      [
        ["dream.attitudeLabel", d.dream_attitude],
        ["dream.emotionLabel", d.dream_emotion],
        ["dream.arcLabel", d.dream_arc],
      ].forEach(([labelKey, value]) => {
        if (!value) return;
        const row = document.createElement("li");
        const label = document.createElement("span");
        label.className = "timeline-field-label";
        label.textContent = I18N.t(labelKey);
        const val = document.createElement("span");
        val.className = "timeline-field-value";
        val.textContent = value;
        row.appendChild(label);
        row.appendChild(val);
        rows.appendChild(row);
      });
      li.appendChild(rows);
      el.timelineList.appendChild(li);
    });
  }

  el.btnShowHistory.addEventListener("click", async () => {
    const opening = el.stepHistory.classList.contains("hidden");
    if (!opening) {
      showOnlyStep(state.lastMainStep || el.stepDream);
      return;
    }
    showOnlyStep(el.stepHistory);
    el.historyDetail.classList.add("hidden");
    el.historyList.classList.remove("hidden");
    el.historyList.innerHTML = "";
    el.historyEmpty.classList.add("hidden");
    try {
      const data = await getJSON("/api/dreams");
      state.libraryDreams = data.dreams;
      renderLibrary();
    } catch (err) {
      el.historyEmpty.textContent = err.message;
      el.historyEmpty.classList.remove("hidden");
    }
  });

  // Rehber: geçmiş paneliyle aynı desen (aç/kapat, lastMainStep'e dön) —
  // tamamen statik içerik, veri çekmiyor.
  el.btnShowGuide.addEventListener("click", () => {
    const opening = el.stepGuide.classList.contains("hidden");
    if (!opening) {
      showOnlyStep(state.lastMainStep || el.stepDream);
      return;
    }
    showOnlyStep(el.stepGuide);
  });

  el.btnGuideBack.addEventListener("click", () => {
    showOnlyStep(state.lastMainStep || el.stepDream);
  });

  async function showHistoryDetail(fname) {
    try {
      const record = await getJSON(`/api/dreams/${encodeURIComponent(fname)}`);
      const summary = state.libraryDreams.find((d) => d.file === fname) || {};
      el.historyList.classList.add("hidden");
      el.historyDetail.classList.remove("hidden");
      el.historyDetailContent.innerHTML = "";

      // ---------- Kuş bakışı: kompakt üst şerit (2026-09-13, Kaan'ın isteği) ----------
      // "Bütünü uzaktan tek bakışta görebilme" — ama DOKÜMAN değil, HUD:
      // tam metin kartları yok, sadece rozetler + tek satırlık alanlar +
      // sembol adı → seçilen çağrışım listesi. Detay (4 soru, bağlam) hâlâ
      // aşağıdaki haritaya tıklayarak açılıyor, burada tekrar edilmiyor.
      const titleHeading = document.createElement("h3");
      titleHeading.textContent = record.title || I18N.t("library.untitled");

      const metaRow = document.createElement("div");
      metaRow.className = "history-detail-meta";
      if (record.saved_at) {
        const dateSpan = document.createElement("span");
        dateSpan.textContent = new Date(record.saved_at).toLocaleString(
          I18N.getLang() === "en" ? "en-US" : "tr-TR"
        );
        metaRow.appendChild(dateSpan);
      }
      const countSpan = document.createElement("span");
      countSpan.textContent = I18N.t("library.symbolCount", { count: (record.symbols || []).length });
      metaRow.appendChild(countSpan);
      const pctBadge = document.createElement("span");
      pctBadge.className = "completion-badge";
      pctBadge.textContent = I18N.t("library.completion", { pct: summary.completion_pct ?? 0 });
      metaRow.appendChild(pctBadge);
      if ((record.ritual_text || "").trim()) {
        const ritualBadge = document.createElement("span");
        ritualBadge.className = "completion-badge" + (record.ritual_done ? " ritual-done-badge" : "");
        ritualBadge.textContent = I18N.t(record.ritual_done ? "library.ritualBadge" : "library.ritualPending");
        metaRow.appendChild(ritualBadge);
      }

      const fieldsList = document.createElement("ul");
      fieldsList.className = "timeline-fields";
      [
        ["dream.attitudeLabel", record.dream_attitude],
        ["dream.emotionLabel", record.dream_emotion],
        ["dream.arcLabel", record.dream_arc],
      ].forEach(([labelKey, value]) => {
        if (!value) return;
        const row = document.createElement("li");
        const label = document.createElement("span");
        label.className = "timeline-field-label";
        label.textContent = I18N.t(labelKey);
        const val = document.createElement("span");
        val.className = "timeline-field-value";
        val.textContent = value;
        row.appendChild(label);
        row.appendChild(val);
        fieldsList.appendChild(row);
      });

      const symbolList = document.createElement("ul");
      symbolList.className = "history-symbol-list";
      (record.symbols || []).forEach((sym) => {
        const li = document.createElement("li");
        const nameSpan = document.createElement("span");
        nameSpan.className = "history-symbol-name";
        nameSpan.textContent = sym.name || "";
        li.appendChild(nameSpan);
        if ((sym.selected_association || "").trim()) {
          const arrow = document.createElement("span");
          arrow.className = "history-symbol-arrow";
          arrow.textContent = "→";
          const assocSpan = document.createElement("span");
          assocSpan.className = "history-symbol-assoc";
          assocSpan.textContent = sym.selected_association;
          li.appendChild(arrow);
          li.appendChild(assocSpan);
        }
        symbolList.appendChild(li);
      });

      el.historyDetailContent.appendChild(titleHeading);
      el.historyDetailContent.appendChild(metaRow);
      if (fieldsList.children.length) el.historyDetailContent.appendChild(fieldsList);
      if (symbolList.children.length) el.historyDetailContent.appendChild(symbolList);

      const dreamHeading = document.createElement("h3");
      dreamHeading.textContent = I18N.t("history.dreamHeading");
      const dreamPara = document.createElement("p");
      dreamPara.textContent = record.dream_text || "";

      const ownHeading = document.createElement("h3");
      ownHeading.textContent = I18N.t("result.myHeading");
      const ownPara = document.createElement("div");
      ownPara.textContent = record.my_interpretation || "";
      ownPara.style.whiteSpace = "pre-wrap";

      const interpHeading = document.createElement("h3");
      interpHeading.textContent = I18N.t("result.aiHeading");
      const interpPara = document.createElement("div");
      interpPara.textContent = record.interpretation || "";
      interpPara.style.whiteSpace = "pre-wrap";

      // Geçmişteki bir kayıt için de aynı iki çıktı — burada menü yerine iki
      // ayrı düğme, çünkü panel zaten dar ve kayıt sabit.
      const mdBtn = document.createElement("button");
      mdBtn.type = "button";
      mdBtn.className = "btn-secondary";
      mdBtn.style.marginBottom = "14px";
      mdBtn.appendChild(makeIcon("file-text", "icon-sm"));
      mdBtn.append(I18N.t("report.downloadMd"));
      mdBtn.addEventListener("click", () =>
        downloadText(`ruya-${reportSlug(record)}.md`, buildReportMarkdown(record), "text/markdown")
      );

      const downloadBtn = document.createElement("button");
      downloadBtn.type = "button";
      downloadBtn.className = "btn-secondary";
      downloadBtn.style.marginBottom = "14px";
      downloadBtn.style.marginLeft = "8px";
      downloadBtn.appendChild(makeIcon("print", "icon-sm"));
      downloadBtn.append(I18N.t("report.print"));
      downloadBtn.addEventListener("click", () => openReport(record));

      const downloadJsonBtn = document.createElement("button");
      downloadJsonBtn.type = "button";
      downloadJsonBtn.className = "btn-secondary";
      downloadJsonBtn.style.marginBottom = "14px";
      downloadJsonBtn.style.marginLeft = "8px";
      downloadJsonBtn.appendChild(makeIcon("download", "icon-sm"));
      downloadJsonBtn.append(I18N.t("result.downloadJson"));
      downloadJsonBtn.addEventListener("click", () => {
        const slug = (record.saved_at || fname).replace(/[^0-9]/g, "").slice(0, 14) || "ruya";
        downloadJSON(`ruya-${slug}.json`, record);
      });

      el.historyDetailContent.appendChild(mdBtn);
      el.historyDetailContent.appendChild(downloadBtn);
      el.historyDetailContent.appendChild(downloadJsonBtn);
      el.historyDetailContent.appendChild(dreamHeading);
      el.historyDetailContent.appendChild(dreamPara);

      if (record.symbols && record.symbols.length) {
        const mapHeading = document.createElement("h3");
        mapHeading.textContent = I18N.t("result.mapHeading");
        const mapWrap = document.createElement("div");
        mapWrap.className = "symbol-map-wrap";
        const mapSvg = document.createElementNS(SVG_NS, "svg");
        mapSvg.setAttribute("class", "history-map-svg");
        mapSvg.setAttribute("viewBox", "0 0 640 640");
        mapWrap.appendChild(mapSvg);

        el.historyDetailContent.appendChild(mapHeading);
        el.historyDetailContent.appendChild(mapWrap);
        SymbolMap.render(mapSvg, record);
      }

      if (record.my_interpretation) {
        el.historyDetailContent.appendChild(ownHeading);
        el.historyDetailContent.appendChild(ownPara);
      }
      if (record.interpretation) {
        el.historyDetailContent.appendChild(interpHeading);
        el.historyDetailContent.appendChild(interpPara);
      }
    } catch (err) {
      el.historyDetailContent.textContent = err.message;
      el.historyDetail.classList.remove("hidden");
    }
  }

  el.btnHistoryBack.addEventListener("click", () => {
    el.historyDetail.classList.add("hidden");
    el.historyList.classList.remove("hidden");
  });

  // ---------- Dil değişimi ----------
  // Statik metinler i18n.js'in kendi DOM taramasıyla güncelleniyor; burada
  // sadece main.js'in kendi ürettiği (state'e bağlı) dinamik metinleri
  // yeniden çiziyoruz ki dil değişince ekranda bayat bir dil kalmasın.
  document.addEventListener("symbolcarki:langchange", () => {
    renderChips();
    updateProgress();
    if (state.activeIndex !== null) {
      const sym = currentSymbol();
      if (sym) {
        el.wheelTitle.textContent = I18N.t("wheel.title", { name: sym.name });
        el.wheelContext.textContent = sym.context ? I18N.t("wheel.context", { context: sym.context }) : "";
        syncFourQuestionsPanel();
      }
    }
  });

  // ---------- İlk kullanım açıklaması ----------
  // Yöntemi hiç bilmeyen kullanıcılar için tek seferlik, kapatılabilir bir
  // açıklama — bir daha gösterilmez (localStorage), akışı bloklamaz.
  try {
    if (!localStorage.getItem(ONBOARD_SEEN_KEY)) {
      el.onboardIntro.classList.remove("hidden");
    }
  } catch (_e) {
    el.onboardIntro.classList.remove("hidden");
  }
  el.btnOnboardDismiss.addEventListener("click", () => {
    el.onboardIntro.classList.add("hidden");
    try {
      localStorage.setItem(ONBOARD_SEEN_KEY, "1");
    } catch (_e) {
      /* localStorage yoksa sessizce yok say, sadece bu oturumda tekrar sorulur */
    }
  });

  // Rüya metni/bağlamı henüz state'e işlenmeden (sembol çıkarımından önce)
  // yazılıyor — yarım yazılmış bir rüya da kaybolmasın diye doğrudan
  // alanları dinliyoruz.
  el.dreamText.addEventListener("input", saveProgress);
  el.dreamTitle.addEventListener("input", saveProgress);
  el.dreamContext.addEventListener("input", saveProgress);
  el.dreamAttitude.addEventListener("input", saveProgress);
  el.dreamEmotion.addEventListener("input", saveProgress);
  el.dreamArc.addEventListener("input", saveProgress);

  // ---------- Başlangıç ----------
  // Sayfa "Rüyanı Yaz" adımıyla zaten açık geliyor; ilerleme göstergesini en
  // baştan "Adım 1/5" ile görünür kılıyoruz ki kullanıcı akışın ne kadar
  // sürdüğünü ilk andan itibaren görsün.
  updateStepLabel(el.stepDream);

  // Yarım kalmış bir rüya varsa kaldığı adımdan devam et — hiçbir soru
  // sormadan, tek tıkla geri dönülebilir bir bilgi notuyla.
  const savedProgress = readProgress();
  if (savedProgress) restoreProgress(savedProgress);

  // ---------- Test/Dev paneli ----------
  // Sadece ?dev=1 ile açılır (Kaan'ın isteği, 2026-09-13: "her adımdaki
  // sayfaları görebileceğim bir test ekranı"). Uydurma bir örnek kayıt
  // kullanır — PRODUCT.md kuralı: gerçek rüya verisi asla demo/test içeriği
  // olarak kullanılamaz. Kütüphane adımı istisna: orada gerçek /api/dreams
  // verisi gösterilir (salt-okunur, normal "Geçmiş Rüyalarım" düğmesiyle
  // aynı davranış), çünkü kişinin kendi verisini kendi test ekranında
  // görmesinde bir sakınca yok.
  if (new URLSearchParams(location.search).get("dev") === "1") {
    el.devPanel.classList.remove("hidden");

    const buildDevFixtureSymbols = () => [
      {
        name: "deniz feneri",
        name_en: "lighthouse",
        context: "rüyanın başında üstünde durduğum yer, ışığı dönüyor",
        associations: [
          { id: uid(), text: "yalnızlık", selected: false },
          { id: uid(), text: "yön gösteren ama kendisi hareket etmeyen bir şey", selected: true },
          { id: uid(), text: "sabit nokta", selected: false },
        ],
        questions: {
          q1: "Başkalarına yol gösterirken kendim hareketsiz kalan tarafım.",
          q2: "İş seçimlerimde hep başkalarına tavsiye verip kendi kararımı ertelediğim yer.",
          q3: "Arkadaşlarıma öğüt verirken.",
          q4: "Babam böyle, hep yönlendirir ama kendisi risk almaz.",
        },
        meditation: "",
        report_note: "",
      },
      {
        name: "değişen merdiven",
        name_en: "shifting stairs",
        context: "inmeye çalışırken basamaklar sürekli değişiyor",
        associations: [
          { id: uid(), text: "kontrol kaybı", selected: false },
          { id: uid(), text: "ilerlemeye çalıştıkça zemin kayan bir belirsizlik", selected: true },
        ],
        questions: {
          q1: "Bir karara yaklaştıkça zeminin kaydığı hissi.",
          q2: "Yeni işe başlama kararımı sürekli ertelediğim yer.",
          q3: "Plan yaparken, her adımda yeni bir 'ama' bulduğumda.",
          q4: "",
        },
        meditation: "",
        report_note: "",
      },
      {
        name: "anahtarlı yabancı",
        name_en: "stranger with a key",
        context: "kapının dışında duruyor, anahtarı vermiyor sadece gülümsüyor",
        associations: [
          { id: uid(), text: "bilmediğim ama elinde çözümü tutan bir parçam", selected: true },
          { id: uid(), text: "bekleyiş", selected: false },
        ],
        questions: {
          q1: "Cevabı zaten bildiğim ama kendime henüz vermediğim taraf.",
          q2: "Kararı hep 'doğru an'a erteleyen taraf.",
          q3: "Uykuya dalmadan önceki düşüncelerimde.",
          q4: "Kimse — bu tamamen kendimle ilgili.",
        },
        meditation: "",
        report_note: "Bu sembolü unutma, önemli.",
      },
    ];

    const applyDevFixture = () => {
      state.dreamText =
        "Bir deniz fenerinin tepesindeydim, ışık dönüyordu ama aşağısı tamamen " +
        "karanlıktı. Merdivenlerden inmeye çalıştım ama basamaklar sürekli " +
        "değişiyordu. Sonunda bir kapı buldum, açtığımda dışarıda tanımadığım " +
        "biri duruyordu, elinde bir anahtar tutuyordu ama bana vermedi, sadece " +
        "gülümsedi.";
      state.dreamTitle = "Deniz Feneri Rüyası";
      state.dreamContext = "Bu aralar yeni bir işe başlayıp başlamama konusunda kararsızım.";
      state.dreamAttitude = "Önce izliyordum, sonra telaşla inmeye çalıştım.";
      state.dreamEmotion = "Endişe ile başladı, kapıyı bulunca hafif bir merak duygusuna döndü.";
      state.dreamArc = "Karanlıkta, yukarıda başladı; kapı açılınca, çözülmeden bitti.";
      state.myInterpretation =
        "Sanırım bu rüya yeni işe başlama kararımdaki tereddüdü anlatıyor — " +
        "yol göstermeyi biliyorum ama kendi adımımı atmıyorum, ve elimdeki " +
        "anahtarı kendime henüz vermiyorum.";
      state.symbols = buildDevFixtureSymbols();
    };

    const devFixtureInterpretation =
      "Kapıdaki yabancıyı hiç sorgulamıyorsun — elindeki anahtarı neden sana " +
      "vermediğini değil, neden istemediğini sormuyorsun. Bu, uydurma bir " +
      "test metnidir.";

    el.devStepDream.addEventListener("click", () => el.btnNewDream.click());

    el.devStepSymbols.addEventListener("click", () => {
      applyDevFixture();
      renderChips();
      showOnlyStep(el.stepSymbols);
    });

    el.devStepWheel.addEventListener("click", () => {
      applyDevFixture();
      renderChips();
      selectSymbol(0);
    });

    el.devStepFinalize.addEventListener("click", () => {
      applyDevFixture();
      showOnlyStep(el.stepFinalize);
    });

    el.devStepResultOwn.addEventListener("click", () => {
      applyDevFixture();
      state.resultReady = true;
      state.lastSavedFile = null;
      state.lastRecord = buildRecord("");
      renderResult(state.lastRecord);
      el.btnNewDream.classList.remove("hidden");
    });

    el.devStepResultAi.addEventListener("click", () => {
      applyDevFixture();
      state.resultReady = true;
      state.lastSavedFile = null;
      state.lastRecord = buildRecord(devFixtureInterpretation);
      renderResult(state.lastRecord);
      el.btnNewDream.classList.remove("hidden");
    });

    el.devStepLibrary.addEventListener("click", () => el.btnShowHistory.click());
  }
})();
