/* app.js — Zero-to-Bot v4 UI logic */
/* Мінімум залежностей. Все у ванільному JS. */

(() => {
  // ===== DOM =====
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const seed = JSON.parse($("#seed").textContent);
  const tplSection = $("#tpl-section");
  const tplStep = $("#tpl-step");

  const stepsRoot = $("#steps-root");
  const progressText = $("#progress-text");
  const toastsRoot = $("#toasts");

  const rgType = $("#choice-type");
  const rgAI = $("#choice-ai");
  const rgEnv = $("#choice-env");
  const rgBackend = $("#choice-backend");
  const checklist = $("#tools-checklist");

  const devBriefBox = $("#dev-brief");
  const btnCopyChatGPT = $("#btn-copy-chatgpt");
  const btnOpenCodex = $("#btn-open-codex");
  const btnCopyBrief = $("#btn-copy-brief");
  const modalBrief = $("#modal-brief");
  const briefText = $("#brief-text");

  const modalDetails = $("#modal-details");
  const modalTitle = $("#modal-title");
  const modalContent = $("#modal-content");

  const modalImport = $("#modal-import");
  const btnApplyImport = $("#btn-apply-import");

  const btnNew = $("#btn-new-bot");
  const btnImprove = $("#btn-improve-bot");

  // ===== Constants =====
  const STORAGE_KEY = "ztb.v4.state";
  const THEME_KEY = "ztb.v4.theme";
  const FILTERS = { ALL: "all", TODO: "todo", DONE: "done" };

  // Кроки гілок бекенду
  const branchIds = {
    json: new Set(seed.backendBranches.json),
    sqlite: new Set(seed.backendBranches.sqlite),
    gsheets: new Set(seed.backendBranches.gsheets),
    postgres: new Set(seed.backendBranches.postgres),
  };
  const allBranchIds = new Set([...branchIds.json, ...branchIds.sqlite, ...branchIds.gsheets, ...branchIds.postgres]);

  // ===== State =====
  /** @type {{
   * type?: string, aiMode?: string, env?: string, backend?: string,
   * checklist: Record<string, boolean>,
   * stepsDone: string[], // "section:id"
   * filter: string
   * }} */
  let state = loadState() ?? {
    type: undefined,
    aiMode: undefined,
    env: undefined,
    backend: undefined,
    checklist: {},
    stepsDone: [],
    filter: FILTERS.ALL,
  };

  // ===== Init =====
  applyTheme(loadTheme());
  bindChoiceGroups();
  bindChecklist();
  bindFilters();
  bindDevBriefActions();
  bindHeaderActions();
  bindExportImport();
  renderAll();

  // ===== Load/Save =====
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    updateProgress();
  }

  // ===== Theme =====
  function loadTheme() {
    return localStorage.getItem(THEME_KEY) || "auto"; // "light" | "dark" | "auto"
  }
  function applyTheme(mode) {
    const html = document.documentElement;
    if (mode === "light") html.dataset.theme = "light";
    else if (mode === "dark") html.dataset.theme = "dark";
    else html.removeAttribute("data-theme");
    localStorage.setItem(THEME_KEY, mode);
  }
  // Глобальний перемикач: t — цикл авто→світла→темна
  window.toggleTheme = (mode) => applyTheme(mode);
  window.cycleTheme = () => {
    const cur = loadTheme();
    const nxt = cur === "auto" ? "light" : cur === "light" ? "dark" : "auto";
    applyTheme(nxt);
    toast(`Тема: ${nxt}`);
  };
  window.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "t" && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      window.cycleTheme();
    }
  });

  // ===== Rendering =====
  function renderAll() {
    renderChoiceGroups();
    renderDevBrief();
    renderSteps();
    updateProgress();
  }

  function renderChoiceGroups() {
    // radio groups set from state
    if (state.type) (rgType.querySelector(`input[value="${state.type}"]`) || {}).checked = true;
    if (state.aiMode) (rgAI.querySelector(`input[value="${state.aiMode}"]`) || {}).checked = true;
    if (state.env) (rgEnv.querySelector(`input[value="${state.env}"]`) || {}).checked = true;
    if (state.backend) (rgBackend.querySelector(`input[value="${state.backend}"]`) || {}).checked = true;

    // checklist
    $$(".checklist input", checklist).forEach((cb) => {
      const key = cb.dataset.key;
      cb.checked = !!state.checklist[key];
    });
  }

  function isStepVisible(step) {
    // Якщо крок належить до гілки бекенду — показуємо тільки для обраного бекенду
    if (allBranchIds.has(step.id)) {
      if (!state.backend) return false;
      const set = branchIds[state.backend] || new Set();
      return set.has(step.id);
    }
    // Інакше — крок завжди видимий
    return true;
  }

  function renderSteps() {
    stepsRoot.innerHTML = "";
    // Будуємо секції
    for (const section of seed.sections) {
      const sectionNode = tplSection.content.firstElementChild.cloneNode(true);
      sectionNode.dataset.sectionId = section.id;
      $(".section-title", sectionNode).textContent = section.title;

      const list = $(".step-list", sectionNode);
      const sectionSteps = seed.steps.filter((s) => s.section === section.id && isStepVisible(s));
      if (sectionSteps.length === 0) continue;

      sectionSteps.forEach((s) => {
        const node = tplStep.content.firstElementChild.cloneNode(true);
        node.dataset.stepId = s.id;
        $(".step-title", node).textContent = `${s.id}) ${s.title}`;
        $(".step-body", node).innerHTML = `
          <div>${escapeInline(s.body)}</div>
          <div><strong>Дія:</strong> ${escapeInline(s.action)}</div>
        `;

        // Done state
        const key = stepKey(s);
        const done = state.stepsDone.includes(key);
        node.classList.toggle("is-done", done);

        // Buttons
        $('[data-action="done"]', node).addEventListener("click", () => {
          toggleStepDone(s);
        });
        $('[data-action="details"]', node).addEventListener("click", () => {
          openDetails(s);
        });

        // Filter visibility
        applyFilterToNode(node, done);

        list.appendChild(node);
      });

      // Badge
      const doneCount = sectionSteps.filter((s) => state.stepsDone.includes(stepKey(s))).length;
      $(".badge", sectionNode).textContent = `${doneCount}/${sectionSteps.length}`;

      stepsRoot.appendChild(sectionNode);
    }
  }

  function updateProgress() {
    const visibleSteps = seed.steps.filter(isStepVisible);
    const done = visibleSteps.filter((s) => state.stepsDone.includes(stepKey(s))).length;
    progressText.textContent = `Прогрес: ${done}/${visibleSteps.length}`;
  }

  // ===== Filters =====
  function bindFilters() {
    $$(".chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$(".chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        state.filter = chip.dataset.filter;
        saveState();
        // Re-apply filter
        $$(".step-item").forEach((li) => {
          const isDone = li.classList.contains("is-done");
          applyFilterToNode(li, isDone);
        });
      });
    });
  }

  function applyFilterToNode(li, isDone) {
    if (state.filter === FILTERS.ALL) li.style.display = "";
    else if (state.filter === FILTERS.DONE) li.style.display = isDone ? "" : "none";
    else if (state.filter === FILTERS.TODO) li.style.display = isDone ? "none" : "";
  }

  // ===== Steps Done =====
  function stepKey(s) { return `${s.section}:${s.id}`; }
  function toggleStepDone(s) {
    const key = stepKey(s);
    const idx = state.stepsDone.indexOf(key);
    if (idx >= 0) state.stepsDone.splice(idx, 1);
    else state.stepsDone.push(key);
    saveState();
    renderSteps();
  }

  // ===== Dev Brief / Prompts =====
  function renderDevBrief() {
    const ready = !!(state.type && state.aiMode && state.env);
    const cmds = state.type ? seed.commandsByType[state.type] : [];
    const storageLabel = state.backend ? backendToLabel(state.backend) : "JSON (за замовчуванням)";

    const brief =
`# DEV BRIEF
Ціль: створити Telegram-бот (${typeToLabel(state.type) || "тип не обрано"}).
Команди: ${cmds && cmds.length ? cmds.join(", ") : "(оберіть тип бота)"}.
Мова: uk. Канал: приват/група. Збереження: ${storageLabel}.
Середовище: ${envToLabel(state.env) || "—"}. Режим ШІ: ${aiToLabel(state.aiMode) || "—"}.

## Інструкції
1) Згенеруй файл main.py під aiogram 3.*.
2) Додай команди і мінімальну логіку.
3) Підготуй хук для бекенду ${state.backend ? "(" + backendToLabel(state.backend) + ")" : "(обери бекенд)"}.
4) Виведи чіткі кроки запуску у README-фрагменті.`;

    devBriefBox.innerHTML = "";
    const p = document.createElement("pre");
    p.className = "codeblock";
    p.textContent = brief;
    devBriefBox.appendChild(p);

    briefText.textContent = brief;
    btnCopyChatGPT.disabled = !ready;
    btnOpenCodex.disabled = !ready;
  }

  function bindDevBriefActions() {
    btnCopyChatGPT.addEventListener("click", async () => {
      await navigator.clipboard.writeText(briefText.textContent);
      toast("Промпт скопійовано");
      modalBrief.showModal();
    });
    btnOpenCodex.addEventListener("click", async () => {
      await navigator.clipboard.writeText(briefText.textContent);
      toast("Промпт скопійовано. Відкрий Codex/Cursor і встав.");
      modalBrief.showModal();
    });
    btnCopyBrief?.addEventListener("click", async () => {
      await navigator.clipboard.writeText(briefText.textContent);
      toast("Скопійовано");
      modalBrief.close();
    });
  }

  // ===== Details Modal =====
  function openDetails(step) {
    modalTitle.textContent = `${step.id}) ${step.title}`;
    modalContent.innerHTML = makeDetailsHTML(step);
    modalDetails.showModal();
  }
  function makeDetailsHTML(step) {
    // Мінімальні підказки. Розширюй за потреби.
    const extra = {
      7: "Встав у requirements.txt:\n\n```\naiogram==3.*\npython-dotenv\n```",
      9: "Створи `.env` та додай:\n\n```\nTOKEN=сюди_вставиш_токен\n```",
      20: "Приклад reply-меню в aiogram 3:\n\n```\nfrom aiogram.types import ReplyKeyboardMarkup, KeyboardButton\nkb = ReplyKeyboardMarkup(keyboard=[[KeyboardButton(text='📋 Завдання'), KeyboardButton(text='🧠 Поради'), KeyboardButton(text='⚙️ Налаштування')]], resize_keyboard=True)\n```",
      23: "Порада: рахуйте події за today/week/all у репозиторії даних, не в хендлері.",
      31: "Запускай у терміналі:\n\n```\npython main.py\n```",
    }[step.id] || "";
    return `
      <p>${escapeInline(step.body)}</p>
      <p><strong>Дія:</strong> ${escapeInline(step.action)}</p>
      ${extra ? `<pre class="codeblock">${extra}</pre>` : ""}
    `;
  }

  // ===== Choices =====
  function bindChoiceGroups() {
    rgType.addEventListener("change", (e) => {
      const v = e.target.closest("input")?.value;
      if (!v) return;
      state.type = v;
      saveState();
      renderDevBrief();
    });
    rgAI.addEventListener("change", (e) => {
      const v = e.target.closest("input")?.value;
      if (!v) return;
      state.aiMode = v;
      saveState();
      renderDevBrief();
    });
    rgEnv.addEventListener("change", (e) => {
      const v = e.target.closest("input")?.value;
      if (!v) return;
      state.env = v;
      saveState();
      renderDevBrief();
    });
    rgBackend.addEventListener("change", (e) => {
      const v = e.target.closest("input")?.value;
      if (!v) return;
      state.backend = v;
      saveState();
      renderDevBrief();
      renderSteps();
    });
  }

  // ===== Checklist =====
  function bindChecklist() {
    $$(".checklist input", checklist).forEach((cb) => {
      cb.addEventListener("change", () => {
        state.checklist[cb.dataset.key] = cb.checked;
        saveState();
      });
    });
  }

  // ===== Header actions =====
  function bindHeaderActions() {
    btnNew.addEventListener("click", () => {
      if (!confirm("Скинути майстер до початкового стану?")) return;
      state = {
        type: undefined, aiMode: undefined, env: undefined, backend: undefined,
        checklist: {}, stepsDone: [], filter: FILTERS.ALL
      };
      saveState();
      renderAll();
      toast("Новий сценарій");
    });
    btnImprove.addEventListener("click", () => {
      // Прокрутка до розділу VIII
      const section = $('[data-section-id="growth"]');
      if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
      toast("Розділ «Розвиток»");
    });

    // Експорт/Імпорт кнопки у футері
    document.querySelector('[data-action="export-state"]').addEventListener("click", () => {
      const data = JSON.stringify(state, null, 2);
      navigator.clipboard.writeText(data).then(() => toast("Стан скопійовано в буфер"));
    });
    document.querySelector('[data-action="import-state"]').addEventListener("click", () => {
      $("#import-text").value = "";
      modalImport.showModal();
    });
  }

  // ===== Export / Import =====
  function bindExportImport() {
    btnApplyImport.addEventListener("click", () => {
      const raw = $("#import-text").value.trim();
      try {
        const parsed = JSON.parse(raw);
        // Мінімальна валідація
        state = {
          type: parsed.type,
          aiMode: parsed.aiMode,
          env: parsed.env,
          backend: parsed.backend,
          checklist: parsed.checklist || {},
          stepsDone: Array.isArray(parsed.stepsDone) ? parsed.stepsDone : [],
          filter: parsed.filter || FILTERS.ALL,
        };
        saveState();
        renderAll();
        modalImport.close();
        toast("Стан імпортовано");
      } catch {
        toast("Помилка JSON", "bad");
      }
    });
  }

  // ===== Utils =====
  function toast(msg, tone = "good") {
    const el = document.createElement("div");
    el.className = `toast ${tone}`;
    el.textContent = msg;
    toastsRoot.appendChild(el);
    setTimeout(() => el.remove(), 2400);
  }

  function escapeInline(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function typeToLabel(v) {
    return ({
      crm: "CRM",
      task: "Task Manager",
      habit: "Habit Tracker",
      faq: "FAQ / Support",
      shop: "Shop",
      booking: "Booking",
      custom: "Custom",
    })[v];
  }
  function aiToLabel(v) {
    return ({
      chatgpt: "ChatGPT-only",
      codex: "ChatGPT + Codex (Copilot)",
    })[v];
  }
  function envToLabel(v) {
    return ({
      local: "Local",
      codespaces: "Codespaces",
    })[v];
  }
  function backendToLabel(v) {
    return ({
      json: "JSON файл",
      sqlite: "SQLite",
      gsheets: "Google Sheets",
      postgres: "Postgres (Docker)",
    })[v];
  }
})();
