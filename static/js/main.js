(() => {
  const state = {
    dreamText: "",
    dreamContext: "",
    symbols: [], // { name, name_en, context, associations: [{id,text,selected}], questions: {q1..q4} }
    activeIndex: null,
    resultReady: false,
    lastMainStep: null, // geçmiş ekranından geri dönülecek adım
    currentStepMeta: null, // { index, name } — ilerleme etiketi için
    lastRecord: null, // son sentezlenen kayıt — rapor/harita/çalışma sayfası bundan üretilir
  };

  const el = {
    dreamText: document.getElementById("dream-text"),
    dreamContext: document.getElementById("dream-context"),
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
    wheelTitle: document.getElementById("wheel-symbol-title"),
    wheelContext: document.getElementById("wheel-symbol-context"),
    wheelSvg: document.getElementById("wheel-svg"),
    assocInput: document.getElementById("assoc-input"),
    btnAddAssoc: document.getElementById("btn-add-assoc"),
    assocList: document.getElementById("assoc-list"),
    btnAmplify: document.getElementById("btn-amplify"),
    amplifyResult: document.getElementById("amplify-result"),
    fourQuestions: document.getElementById("four-questions"),
    btnNextSymbol: document.getElementById("btn-next-symbol"),
    stepFinalize: document.getElementById("step-finalize"),
    btnFinalizeBack: document.getElementById("btn-finalize-back"),
    btnFinalize: document.getElementById("btn-finalize"),
    finalizeStatus: document.getElementById("finalize-status"),
    stepResult: document.getElementById("step-result"),
    resultText: document.getElementById("result-text"),
    btnCopyResult: document.getElementById("btn-copy-result"),
    btnReport: document.getElementById("btn-report"),
    btnDownloadJson: document.getElementById("btn-download-json"),
    symbolMapSvg: document.getElementById("symbol-map-svg"),
    btnShowHistory: document.getElementById("btn-show-history"),
    btnImport: document.getElementById("btn-import"),
    importFileInput: document.getElementById("import-file-input"),
    btnLoadDraft: document.getElementById("btn-load-draft"),
    draftFileInput: document.getElementById("draft-file-input"),
    btnSaveDraft: document.getElementById("btn-save-draft"),
    btnNewDream: document.getElementById("btn-new-dream"),
    stepHistory: document.getElementById("step-history"),
    historyEmpty: document.getElementById("history-empty"),
    historyList: document.getElementById("history-list"),
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

  async function postJSON(url, body) {
    const res = await fetch(url, {
      method: "POST",
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
    return [el.stepDream, el.stepSymbols, el.stepWheel, el.stepFinalize, el.stepResult, el.stepHistory];
  }

  const prefersReducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function showOnlyStep(section) {
    const current = allSteps().find((s) => !s.classList.contains("hidden"));

    const finish = () => {
      allSteps().forEach((s) => s.classList.toggle("hidden", s !== section));
      if (section !== el.stepHistory) {
        state.lastMainStep = section;
        updateStepLabel(section);
      }
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
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

  function updateProgress() {
    el.btnFinalize.disabled = !(
      state.symbols.length > 0 && state.symbols.every((s) => s.associations.some((a) => a.selected))
    );
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
  }

  function resetProgress() {
    el.progressWrap.classList.add("hidden");
    el.progressFill.style.width = "0%";
    state.currentStepMeta = null;
  }

  // ---------- Adım: rüya + sembol çıkarma ----------

  el.btnExtract.addEventListener("click", async () => {
    const text = el.dreamText.value.trim();
    if (!text) {
      setStatus(el.extractStatus, I18N.t("dream.status.empty"), true);
      return;
    }
    state.dreamText = text;
    state.dreamContext = el.dreamContext.value.trim();
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
    renderChips();
    renderWheelAndList();
    syncFourQuestionsPanel();
    resetAmplifyBox();
    showOnlyStep(el.stepWheel);
  }

  el.btnWheelBack.addEventListener("click", () => {
    showOnlyStep(el.stepSymbols);
  });

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
    el.btnNextSymbol.classList.toggle("hidden", !hasSelection);
    if (!hasSelection) return;

    el.fourQuestions.querySelectorAll("textarea[data-q]").forEach((ta) => {
      ta.value = sym.questions[ta.dataset.q] || "";
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

  el.btnFinalize.addEventListener("click", async () => {
    el.btnFinalize.disabled = true;
    try {
      setStatus(el.finalizeStatus, I18N.t("finalize.status.synthesizing"));
      el.finalizeStatus.classList.add("spinner");
      const payload = {
        dream_text: state.dreamText,
        personal_context: state.dreamContext,
        symbols: state.symbols.map((s) => ({
          name: s.name,
          name_en: s.name_en || "",
          context: s.context,
          selected_association: (s.associations.find((a) => a.selected) || {}).text || "",
          all_associations: s.associations.map((a) => a.text),
          questions: s.questions,
        })),
      };
      const synthData = await postJSON("/api/synthesize", payload);

      state.resultReady = true;
      state.lastRecord = { ...payload, interpretation: synthData.interpretation };
      updateProgress();
      renderResult(synthData.interpretation);

      await postJSON("/api/save-dream", state.lastRecord);

      setStatus(el.finalizeStatus, I18N.t("finalize.status.done"));
      el.btnNewDream.classList.remove("hidden");
    } catch (err) {
      setStatus(el.finalizeStatus, err.message, true);
    } finally {
      el.btnFinalize.disabled = false;
      el.finalizeStatus.classList.remove("spinner");
    }
  });

  function renderResult(text) {
    SymbolMap.render(el.symbolMapSvg, state.lastRecord);
    el.resultText.textContent = text;
    showOnlyStep(el.stepResult);
  }

  // ---------- Rapor (yazdır/PDF) ----------
  // Ham .txt dökümü yerine gerçek bir rapor: harici bağımlılık eklemeden
  // (yeni pencere + tarayıcının kendi yazdır/PDF-olarak-kaydet akışı),
  // metni seçilebilir/aranabilir kalan bir belge. Harita bölümü kâğıt
  // paletiyle (bkz. symbolmap.js PALETTE_PAPER) gömülü SVG olarak basılıyor;
  // sembol kartları gerçek HTML — böylece tarayıcı sayfa bölmesini
  // (`break-inside: avoid`) doğru uyguluyor, SVG'de elle hesaplamaya gerek
  // kalmıyor. "Yorum" bölümü şu an tek AI sentezini gösteriyor; ileride
  // "yorumu genişlet" (kullanıcının kendi yorumu + AI'ın kör nokta notları)
  // geldiğinde bu bölüm güncellenecek — veri yoksa (interpretation boşsa)
  // bölüm hiç basılmıyor.

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
    const others = (sym.all_associations || []).filter((a) => a && a !== sym.selected_association);
    const contextHtml = sym.context
      ? `<div class="field-label">${escapeHtml(I18N.t("worksheet.context"))}</div><div class="field-value muted">${escapeHtml(sym.context)}</div>`
      : "";
    const othersHtml = others.length
      ? `<div class="field-label">${escapeHtml(I18N.t("worksheet.otherAssoc"))}</div><div class="field-value muted">${escapeHtml(others.join(", "))}</div>`
      : "";
    const questionsHtml = SymbolMap.questionLabels
      .map(([key, label]) => {
        const answer = q[key] && q[key].trim() ? q[key] : "—";
        return `<div class="field-label">${escapeHtml(label)}</div><div class="field-value">${escapeHtml(answer)}</div>`;
      })
      .join("");
    return `<article class="report-card">
      <h3>${escapeHtml(sym.name || "")}</h3>
      ${contextHtml}
      <div class="field-label">${escapeHtml(I18N.t("worksheet.goldAssoc"))}</div>
      <div class="field-value">${escapeHtml(sym.selected_association || "—")}</div>
      ${othersHtml}
      ${questionsHtml}
    </article>`;
  }

  function buildReportHtml(record) {
    const locale = I18N.getLang() === "en" ? "en-US" : "tr-TR";
    const dateStr = new Date().toLocaleString(locale);
    const dreamSnippet = (record.dream_text || "").replace(/\s+/g, " ").trim().slice(0, 220);
    const symbols = record.symbols || [];
    const mapSvgString = symbols.length ? SymbolMap.svgToString(SymbolMap.buildMapSvg(record, "paper")) : "";
    const contextBlock = record.personal_context
      ? `<div class="field-label">${escapeHtml(I18N.t("report.contextHeading"))}</div><p class="context-text">${escapeHtml(record.personal_context)}</p>`
      : "";
    const cardsHtml = symbols.map(buildReportCardHtml).join("\n");
    const interpretationSection = record.interpretation
      ? `<section class="section">
          <h2>${escapeHtml(I18N.t("report.interpretationHeading"))}</h2>
          <p class="interpretation-text">${escapeHtml(record.interpretation)}</p>
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
  </section>

  ${mapSvgString ? `<section class="section"><h2>${escapeHtml(I18N.t("report.mapHeading"))}</h2><div class="map-wrap">${mapSvgString}</div></section>` : ""}

  ${cardsHtml ? `<section class="section"><h2>${escapeHtml(I18N.t("report.cardsHeading"))}</h2>${cardsHtml}</section>` : ""}

  ${interpretationSection}
</body>
</html>`;
  }

  function openReport(record) {
    if (!record) return;
    const html = buildReportHtml(record);
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

  el.btnReport.addEventListener("click", () => openReport(state.lastRecord));

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
    resetProgress();
    renderResult(record.interpretation || "");
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

  function loadDraftIntoState(record) {
    state.dreamText = record.dream_text || "";
    state.dreamContext = record.personal_context || "";
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
    }));
    state.activeIndex = null;
    state.resultReady = false;
    state.lastRecord = null;

    el.dreamText.value = state.dreamText;
    el.dreamContext.value = state.dreamContext;
    el.btnNewDream.classList.add("hidden");
    renderChips();
    updateProgress();
    showOnlyStep(el.stepFinalize);
  }

  el.btnSaveDraft.addEventListener("click", () => {
    const slug = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    downloadJSON(`ruya-taslak-${slug}.json`, {
      is_draft: true,
      dream_text: state.dreamText,
      personal_context: state.dreamContext,
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
      await navigator.clipboard.writeText(el.resultText.textContent);
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
    state.dreamContext = "";
    state.symbols = [];
    state.activeIndex = null;
    state.resultReady = false;
    state.lastRecord = null;

    el.dreamText.value = "";
    el.dreamContext.value = "";
    el.manualSymbolInput.value = "";
    setStatus(el.extractStatus, "");
    setStatus(el.finalizeStatus, "");
    el.btnNewDream.classList.add("hidden");
    resetProgress();

    showOnlyStep(el.stepDream);
  });

  // ---------- Geçmiş rüyalar ----------

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
      if (!data.dreams.length) {
        el.historyEmpty.classList.remove("hidden");
        return;
      }
      data.dreams.forEach((d, i) => {
        const li = document.createElement("li");
        li.style.setProperty("--i", i);
        const dateSpan = document.createElement("span");
        dateSpan.className = "history-date";
        dateSpan.textContent = d.saved_at
          ? new Date(d.saved_at).toLocaleString(I18N.getLang() === "en" ? "en-US" : "tr-TR")
          : "";
        const textSpan = document.createElement("span");
        textSpan.textContent = d.dream_text + (d.dream_text.length >= 120 ? "…" : "");
        li.appendChild(dateSpan);
        li.appendChild(textSpan);
        li.addEventListener("click", () => showHistoryDetail(d.file));
        el.historyList.appendChild(li);
      });
    } catch (err) {
      el.historyEmpty.textContent = err.message;
      el.historyEmpty.classList.remove("hidden");
    }
  });

  async function showHistoryDetail(fname) {
    try {
      const record = await getJSON(`/api/dreams/${encodeURIComponent(fname)}`);
      el.historyList.classList.add("hidden");
      el.historyDetail.classList.remove("hidden");
      el.historyDetailContent.innerHTML = "";

      const dreamHeading = document.createElement("h3");
      dreamHeading.textContent = I18N.t("history.dreamHeading");
      const dreamPara = document.createElement("p");
      dreamPara.textContent = record.dream_text || "";

      const interpHeading = document.createElement("h3");
      interpHeading.textContent = I18N.t("result.heading");
      const interpPara = document.createElement("div");
      interpPara.textContent = record.interpretation || "";
      interpPara.style.whiteSpace = "pre-wrap";

      const downloadBtn = document.createElement("button");
      downloadBtn.type = "button";
      downloadBtn.className = "btn-secondary";
      downloadBtn.style.marginBottom = "14px";
      downloadBtn.appendChild(makeIcon("print", "icon-sm"));
      downloadBtn.append(I18N.t("result.report"));
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

      el.historyDetailContent.appendChild(interpHeading);
      el.historyDetailContent.appendChild(interpPara);
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

  // ---------- Başlangıç ----------
  // Sayfa "Rüyanı Yaz" adımıyla zaten açık geliyor; ilerleme göstergesini en
  // baştan "Adım 1/5" ile görünür kılıyoruz ki kullanıcı akışın ne kadar
  // sürdüğünü ilk andan itibaren görsün.
  updateStepLabel(el.stepDream);
})();
