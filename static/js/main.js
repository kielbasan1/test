(() => {
  const state = {
    dreamText: "",
    dreamContext: "",
    symbols: [], // { name, context, associations: [{id,text,selected}], questions: {q1..q4}, searchResults: [] }
    activeIndex: null,
    resultReady: false,
    lastMainStep: null, // geçmiş ekranından geri dönülecek adım
  };

  const el = {
    dreamText: document.getElementById("dream-text"),
    dreamContext: document.getElementById("dream-context"),
    btnExtract: document.getElementById("btn-extract"),
    extractStatus: document.getElementById("extract-status"),
    stepDream: document.getElementById("step-dream"),
    stepSymbols: document.getElementById("step-symbols"),
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
    fourQuestions: document.getElementById("four-questions"),
    btnNextSymbol: document.getElementById("btn-next-symbol"),
    stepFinalize: document.getElementById("step-finalize"),
    btnFinalize: document.getElementById("btn-finalize"),
    finalizeStatus: document.getElementById("finalize-status"),
    stepResult: document.getElementById("step-result"),
    resultText: document.getElementById("result-text"),
    resultSources: document.getElementById("result-sources"),
    btnCopyResult: document.getElementById("btn-copy-result"),
    btnShowHistory: document.getElementById("btn-show-history"),
    btnNewDream: document.getElementById("btn-new-dream"),
    stepHistory: document.getElementById("step-history"),
    historyEmpty: document.getElementById("history-empty"),
    historyList: document.getElementById("history-list"),
    historyDetail: document.getElementById("history-detail"),
    btnHistoryBack: document.getElementById("btn-history-back"),
    historyDetailContent: document.getElementById("history-detail-content"),
    progressBar: document.getElementById("progress-bar"),
    progressFill: document.getElementById("progress-fill"),
    progressLabel: document.getElementById("progress-label"),
  };

  function uid() {
    return (crypto.randomUUID && crypto.randomUUID()) || String(Date.now() + Math.random());
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

  function showOnlyStep(section) {
    allSteps().forEach((s) => s.classList.toggle("hidden", s !== section));
    if (section !== el.stepHistory) state.lastMainStep = section;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---------- İlerleme çubuğu ----------

  function updateProgress() {
    el.btnFinalize.disabled = !(
      state.symbols.length > 0 && state.symbols.every((s) => s.associations.some((a) => a.selected))
    );
    if (state.symbols.length === 0) return;
    const total = state.symbols.length + 2; // rüya + semboller + sonuç
    const doneSymbols = state.symbols.filter((s) => s.associations.some((a) => a.selected)).length;
    let completed = 1 + doneSymbols; // rüya zaten yazıldı
    if (state.resultReady) completed += 1;
    const pct = Math.round((completed / total) * 100);

    el.progressBar.classList.remove("hidden");
    el.progressLabel.classList.remove("hidden");
    el.progressFill.style.width = pct + "%";
    el.progressLabel.textContent = state.resultReady
      ? "Tamamlandı ✓"
      : `%${pct} tamamlandı — ${doneSymbols}/${state.symbols.length} sembolde çağrışım seçildi`;
  }

  function resetProgress() {
    el.progressBar.classList.add("hidden");
    el.progressLabel.classList.add("hidden");
    el.progressFill.style.width = "0%";
  }

  // ---------- Adım: rüya + sembol çıkarma ----------

  el.btnExtract.addEventListener("click", async () => {
    const text = el.dreamText.value.trim();
    if (!text) {
      setStatus(el.extractStatus, "Önce rüyanı yaz.", true);
      return;
    }
    state.dreamText = text;
    state.dreamContext = el.dreamContext.value.trim();
    el.btnExtract.disabled = true;
    setStatus(el.extractStatus, "Semboller çıkarılıyor...");
    el.extractStatus.classList.add("spinner");
    try {
      const data = await postJSON("/api/extract-symbols", { dream_text: text });
      state.symbols = data.symbols.map((s) => ({
        name: s.name,
        name_en: s.name_en || "",
        context: s.context,
        associations: [],
        questions: { q1: "", q2: "", q3: "", q4: "" },
        searchResults: [],
      }));
      setStatus(el.extractStatus, `${state.symbols.length} sembol bulundu.`);
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
      el.btnStartSymbols.textContent = "Yoruma Geç →";
    } else if (state.symbols.every((s) => s.associations.length === 0)) {
      el.btnStartSymbols.textContent = "Sembollerle Başla →";
    } else {
      el.btnStartSymbols.textContent = "Devam Et →";
    }
  }

  el.btnStartSymbols.addEventListener("click", () => {
    const incompleteIndex = firstIncompleteIndex();
    if (incompleteIndex === -1) {
      showOnlyStep(el.stepFinalize);
    } else {
      selectSymbol(incompleteIndex);
    }
  });

  function renderChips() {
    const doneCount = state.symbols.filter((s) => s.associations.some((a) => a.selected)).length;
    el.symbolProgress.textContent = state.symbols.length
      ? `${doneCount} / ${state.symbols.length} sembolde çağrışım seçildi.`
      : "";

    el.symbolChips.innerHTML = "";
    state.symbols.forEach((sym, i) => {
      const chip = document.createElement("div");
      const hasSelection = sym.associations.some((a) => a.selected);
      chip.className =
        "chip" + (i === state.activeIndex ? " active" : "") + (hasSelection ? " done" : "");

      const label = document.createElement("span");
      label.textContent = sym.name;
      chip.appendChild(label);

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "chip-remove";
      removeBtn.textContent = "×";
      removeBtn.setAttribute("aria-label", `${sym.name} sembolünü kaldır`);
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
      searchResults: [],
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
    el.wheelTitle.textContent = `Sembol Çarkı — ${sym.name}`;
    el.wheelContext.textContent = sym.context ? `Rüyadaki bağlam: ${sym.context}` : "";
    renderChips();
    renderWheelAndList();
    syncFourQuestionsPanel();
    showOnlyStep(el.stepWheel);
  }

  el.btnWheelBack.addEventListener("click", () => {
    showOnlyStep(el.stepSymbols);
  });

  function currentSymbol() {
    return state.activeIndex === null ? null : state.symbols[state.activeIndex];
  }

  function renderWheelAndList() {
    const sym = currentSymbol();
    if (!sym) return;
    SymbolWheel.render(el.wheelSvg, sym.name, sym.associations, onSelectAssociation);

    el.assocList.innerHTML = "";
    sym.associations.forEach((a) => {
      const li = document.createElement("li");
      li.textContent = a.text;
      li.className = a.selected ? "selected" : "";
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
    el.btnNextSymbol.textContent = anotherIncomplete ? "Sonraki Sembol →" : "Yoruma Geç →";
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

  // ---------- Amplifikasyon + sentez ----------

  el.btnFinalize.addEventListener("click", async () => {
    el.btnFinalize.disabled = true;
    try {
      setStatus(el.finalizeStatus, "Sembol anlamları internette taranıyor...");
      el.finalizeStatus.classList.add("spinner");
      // Aramalar birbirinden bağımsız; sırayla değil aynı anda yapılınca
      // (özellikle çok sembollü rüyalarda) toplam bekleme süresi katbekat kısalır.
      await Promise.all(
        state.symbols.map(async (sym) => {
          const data = await postJSON("/api/search-symbol", {
            symbol: sym.name,
            context: sym.context,
            symbol_en: sym.name_en || "",
          });
          sym.searchResults = data.results;
          sym.searchSource = data.source;
        })
      );

      setStatus(el.finalizeStatus, "Yorum sentezleniyor...");
      const payload = {
        dream_text: state.dreamText,
        personal_context: state.dreamContext,
        symbols: state.symbols.map((s) => ({
          name: s.name,
          context: s.context,
          selected_association: (s.associations.find((a) => a.selected) || {}).text || "",
          all_associations: s.associations.map((a) => a.text),
          questions: s.questions,
          amplification: s.searchResults.map((r) => ({ title: r.title, snippet: r.snippet })),
        })),
      };
      const synthData = await postJSON("/api/synthesize", payload);

      state.resultReady = true;
      updateProgress();
      renderResult(synthData.interpretation);

      await postJSON("/api/save-dream", { ...payload, interpretation: synthData.interpretation });

      setStatus(el.finalizeStatus, "Tamamlandı.");
      el.btnNewDream.classList.remove("hidden");
    } catch (err) {
      setStatus(el.finalizeStatus, err.message, true);
    } finally {
      el.btnFinalize.disabled = false;
      el.finalizeStatus.classList.remove("spinner");
    }
  });

  function renderResult(text) {
    el.resultText.textContent = text;
    el.resultSources.innerHTML = "<h3>Amplifikasyon Kaynakları</h3>";
    state.symbols.forEach((sym) => {
      if (!sym.searchResults.length) return;
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent =
        sym.name + (sym.searchSource === "duckduckgo" ? " (yedek kaynak: DuckDuckGo)" : "");
      details.appendChild(summary);
      const ul = document.createElement("ul");
      sym.searchResults.forEach((r) => {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = r.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = r.title || r.url;
        li.appendChild(a);
        ul.appendChild(li);
      });
      details.appendChild(ul);
      el.resultSources.appendChild(details);
    });
    showOnlyStep(el.stepResult);
  }

  el.btnCopyResult.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(el.resultText.textContent);
      const original = el.btnCopyResult.textContent;
      el.btnCopyResult.textContent = "Kopyalandı ✓";
      setTimeout(() => (el.btnCopyResult.textContent = original), 1500);
    } catch (err) {
      setStatus(el.finalizeStatus, "Kopyalanamadı, metni elle seçip kopyalayabilirsin.", true);
    }
  });

  // ---------- Yeni rüya ----------

  el.btnNewDream.addEventListener("click", () => {
    state.dreamText = "";
    state.dreamContext = "";
    state.symbols = [];
    state.activeIndex = null;
    state.resultReady = false;

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
      data.dreams.forEach((d) => {
        const li = document.createElement("li");
        const dateSpan = document.createElement("span");
        dateSpan.className = "history-date";
        dateSpan.textContent = d.saved_at ? new Date(d.saved_at).toLocaleString("tr-TR") : "";
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
      dreamHeading.textContent = "Rüya";
      const dreamPara = document.createElement("p");
      dreamPara.textContent = record.dream_text || "";

      const interpHeading = document.createElement("h3");
      interpHeading.textContent = "Yorum";
      const interpPara = document.createElement("div");
      interpPara.textContent = record.interpretation || "";
      interpPara.style.whiteSpace = "pre-wrap";

      el.historyDetailContent.appendChild(dreamHeading);
      el.historyDetailContent.appendChild(dreamPara);
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
})();
