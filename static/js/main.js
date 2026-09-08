(() => {
  const state = {
    dreamText: "",
    dreamContext: "",
    symbols: [], // { name, name_en, context, associations: [{id,text,selected}], questions: {q1..q4} }
    activeIndex: null,
    resultReady: false,
    lastMainStep: null, // geçmiş ekranından geri dönülecek adım
    currentStepMeta: null, // { index, name } — ilerleme etiketi için
    lastRecord: null, // son sentezlenen kayıt — .txt indirmede kullanılır
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
    btnDownloadResult: document.getElementById("btn-download-result"),
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
  };

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

  function removeSymbol(index) {
    state.symbols.splice(index, 1);
    if (state.activeIndex === index) {
      state.activeIndex = null;
    } else if (state.activeIndex !== null && state.activeIndex > index) {
      state.activeIndex -= 1;
    }
    renderChips();
    updateProgress();
  }

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
      li.textContent = a.text;
      li.className = a.selected ? "selected" : "";
      li.style.setProperty("--i", i);
      li.addEventListener("click", () => onSelectAssociation(a.id));
      el.assocList.appendChild(li);
    });
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

  // ---------- Dışa aktarma (.txt) ----------
  // Kalıcı depolama (ruyalar/ klasörü) ücretsiz hosting'lerde sunucu her
  // yeniden başladığında silinebilir; bu yüzden kullanıcı sonucu kendi
  // cihazına indirip kalıcı hale getirebiliyor — sunucuya bağımlı değil.

  function buildExportText(record) {
    const lines = [];
    lines.push("SEMBOL ÇARKI — RÜYA KAYDI");
    lines.push(`Tarih: ${new Date().toLocaleString("tr-TR")}`);
    lines.push("");
    lines.push("RÜYA");
    lines.push(record.dream_text || "");
    lines.push("");
    lines.push("Bu rüyayı neden bu gece görmüş olabilirim:");
    lines.push(record.personal_context || "—");
    lines.push("");
    lines.push("SEMBOLLER");
    (record.symbols || []).forEach((s, i) => {
      lines.push("");
      lines.push(`${i + 1}. ${s.name}`);
      if (s.context) lines.push(`   Bağlam: ${s.context}`);
      lines.push(`   Seçilen çağrışım: ${s.selected_association || "—"}`);
      if (s.all_associations && s.all_associations.length) {
        lines.push(`   Diğer çağrışımlar: ${s.all_associations.join(", ")}`);
      }
      const q = s.questions || {};
      lines.push(`   Bu içimde hangi parçam? ${q.q1 || "—"}`);
      lines.push(`   Hayatımdaki işlevi ne / nereyi yönetiyor? ${q.q2 || "—"}`);
      lines.push(`   Kişiliğimin neresinde bunu görüyorum? ${q.q3 || "—"}`);
      lines.push(`   Kim içimde böyle davranıyor? ${q.q4 || "—"}`);
    });
    lines.push("");
    lines.push("YORUM");
    lines.push(record.interpretation || "");
    return lines.join("\n");
  }

  function downloadText(filename, content) {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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

  el.btnDownloadResult.addEventListener("click", () => {
    if (!state.lastRecord) return;
    const slug = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    downloadText(`ruya-${slug}.txt`, buildExportText(state.lastRecord));
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

  // JSON eklenmeden önceki oturumlardan kalan .txt export'lar da (aynı
  // "Dosyadan Aç" ile) açılabilsin diye buildExportText'in ürettiği formatı
  // tersine çeviren bir metin ayrıştırıcı — bu iki fonksiyon aynı formatı
  // paylaşıyor, biri değişirse öbürü de güncellenmeli.
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
    if (dreamIdx === -1 || ctxIdx === -1 || symIdx === -1 || yorumIdx === -1) return null;

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
    try {
      const text = await file.text();
      let record;
      const looksLikeJson = /\.json$/i.test(file.name) || text.trim().startsWith("{");
      if (looksLikeJson) {
        record = JSON.parse(text);
      } else {
        record = parseExportText(text);
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
        window.alert(I18N.t("import.invalid"));
        return;
      }
      state.lastRecord = record;
      state.resultReady = true;
      state.dreamText = record.dream_text || "";
      resetProgress();
      renderResult(record.interpretation || "");
      el.btnNewDream.classList.remove("hidden");
    } catch (err) {
      window.alert(I18N.t("import.error"));
    }
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
      downloadBtn.appendChild(makeIcon("download", "icon-sm"));
      downloadBtn.append(I18N.t("result.download"));
      downloadBtn.addEventListener("click", () => {
        const slug = (record.saved_at || fname).replace(/[^0-9]/g, "").slice(0, 14) || "ruya";
        downloadText(`ruya-${slug}.txt`, buildExportText(record));
      });

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

  // ---------- Başlangıç ----------
  // Sayfa "Rüyanı Yaz" adımıyla zaten açık geliyor; ilerleme göstergesini en
  // baştan "Adım 1/5" ile görünür kılıyoruz ki kullanıcı akışın ne kadar
  // sürdüğünü ilk andan itibaren görsün.
  updateStepLabel(el.stepDream);
})();
