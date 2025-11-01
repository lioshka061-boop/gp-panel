/* app.js — двопанельний майстер */

(() => {
  // DOM helpers
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // Elements
  const seed = JSON.parse($("#seed").textContent);
  const sectionsRoot = $("#sections");
  const searchInput = $("#search");
  const progressLbl = $("#progress");
  const btnTheme = $("#btn-theme");
  const btnNew = $("#btn-new");
  const btnExport = document.querySelector('[data-action="export-state"]');
  const btnImport = document.querySelector('[data-action="import-state"]');

  // Detail panel
  const detail = {
    title: $("#detail-title"),
    path: $("#detail-path"),
    desc: $("#detail-desc"),
    action: $("#detail-action"),
    extraWrap: $("#detail-extra-wrap"),
    extra: $("#detail-extra"),
    notes: $("#notes"),
    notesStatus: $("#notes-status"),
    btnDone: $("#btn-toggle-done"),
    btnDetails: $("#btn-details"),
  };

  // State
  const STORAGE_KEY = "ztb.v4.state";
  const THEME_KEY = "ztb.v4.theme";
  const FILTERS = { ALL: "all", TODO: "todo", DONE: "done" };

  /** @type {{
   * stepsDone: string[], filter: string, selected?: string, notes: Record<string,string>
   * }} */
  let state = loadState() ?? { stepsDone: [], filter: FILTERS.ALL, selected: undefined, notes: {} };

  // Theme
  initTheme();

  // Build UI
  buildSections();
  bindGlobal();
  selectFirstIfNone();
  updateProgress();

  // ===== Functions =====
  function loadState() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); }
    catch { return null; }
  }
  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    updateProgress();
  }

  function initTheme() {
    const cur = localStorage.getItem(THEME_KEY) || "auto";
    applyTheme(cur);
    btnTheme.addEventListener("click", () => {
      const next = cycle(curTheme());
      applyTheme(next);
      toast(`Тема: ${next}`);
    });
    function cycle(x){ return x==="auto"?"light":x==="light"?"dark":"auto"; }
    function curTheme(){ return localStorage.getItem(THEME_KEY) || "auto"; }
    function applyTheme(mode){
      const html = document.documentElement;
      if (mode==="light") html.dataset.theme="light";
      else if (mode==="dark") html.dataset.theme="dark";
      else html.removeAttribute("data-theme");
      localStorage.setItem(THEME_KEY, mode);
    }
    window.applyTheme = applyTheme;
  }

  function buildSections() {
    sectionsRoot.innerHTML = "";
    const grouped = groupBy(seed.steps, s => s.section);

    for (const sec of seed.sections) {
      const steps = (grouped[sec.id] || []);
      if (!steps.length) continue;

      const section = document.createElement("section");
      section.className = "section";
      section.dataset.sectionId = sec.id;

      // Head
      const head = document.createElement("div");
      head.className = "section-head";
      head.innerHTML = `<h3 class="section-title">${sec.title}</h3><span class="muted small" data-badge>0/${steps.length}</span>`;
      head.addEventListener("click", () => body.toggleAttribute("hidden"));
      section.appendChild(head);

      // Body
      const body = document.createElement("div");
      body.className = "section-body";
      section.appendChild(body);

      steps.forEach(s => {
        const key = stepKey(sec.id, s.id);
        const el = document.createElement("div");
        el.className = "step";
        el.dataset.key = key;
        el.innerHTML = `
          <input type="checkbox" ${state.stepsDone.includes(key) ? "checked" : ""} aria-label="готово" />
          <div>
            <div class="title">${s.id}) ${s.title}</div>
            <div class="meta">${escape(s.body)}</div>
          </div>
          <div class="badge">Деталі</div>
        `;
        if (state.selected === key) el.classList.add("is-selected");
        if (state.stepsDone.includes(key)) el.classList.add("is-done");

        // Click select
        el.addEventListener("click", (ev) => {
          const isCheckbox = ev.target.tagName === "INPUT";
          if (!isCheckbox) selectStep(key);
        });
        // Toggle done
        el.querySelector('input').addEventListener("change", (ev) => {
          toggleDone(key);
          el.classList.toggle("is-done", ev.target.checked);
          updateBadge(section, steps.length);
          if (state.selected === key) syncDetailDone();
        });

        body.appendChild(el);
      });

      updateBadge(section, steps.length);
      sectionsRoot.appendChild(section);
    }

    // Filter + search hooks
    $$(".chip").forEach(ch => ch.addEventListener("click", () => {
      $$(".chip").forEach(c => c.classList.remove("is-active"));
      ch.classList.add("is-active");
      state.filter = ch.dataset.filter;
      saveState();
      applyFilters();
    }));
    searchInput.addEventListener("input", applyFilters);
    applyFilters();
  }

  function updateBadge(sectionEl, total) {
    const done = $$('[type="checkbox"]:checked', sectionEl).length;
    sectionEl.querySelector('[data-badge]').textContent = `${done}/${total}`;
    updateProgress();
  }

  function applyFilters() {
    const q = searchInput.value.trim().toLowerCase();
    $$(".step", sectionsRoot).forEach(step => {
      const key = step.dataset.key;
      const isDone = state.stepsDone.includes(key);
      const text = step.textContent.toLowerCase();
      const byFilter = state.filter === FILTERS.ALL ? true : state.filter === FILTERS.DONE ? isDone : !isDone;
      const bySearch = !q || text.includes(q);
      step.style.display = byFilter && bySearch ? "" : "none";
    });
  }

  function selectStep(key) {
    state.selected = key;
    saveState();

    // left highlight
    $$(".step").forEach(s => s.classList.toggle("is-selected", s.dataset.key === key));

    // right panel fill
    const {sectionId, id} = parseKey(key);
    const s = seed.steps.find(x => x.section === sectionId && String(x.id) === String(id));
    const secTitle = seed.sections.find(ss => ss.id === sectionId)?.title || "";

    detail.title.textContent = `${s.id}) ${s.title}`;
    detail.path.textContent = `${secTitle}`;
    detail.desc.textContent = s.body;
    detail.action.textContent = s.action;
    const extra = extraById(s.id);
    detail.extraWrap.hidden = !extra;
    if (extra) detail.extra.textContent = extra;

    detail.notes.value = state.notes[key] || "";
    syncDetailDone();
  }

  function syncDetailDone() {
    const k = state.selected;
    const done = state.stepsDone.includes(k);
    detail.btnDone.textContent = done ? "↩️ Позначити як невиконано" : "✅ Зроблено";
  }

  function selectFirstIfNone() {
    if (state.selected) { selectStep(state.selected); return; }
    const first = $(".step")?.dataset.key;
    if (first) selectStep(first);
  }

  function toggleDone(key) {
    const i = state.stepsDone.indexOf(key);
    if (i >= 0) state.stepsDone.splice(i, 1);
    else state.stepsDone.push(key);
    saveState();
  }

  function updateProgress() {
    const total = seed.steps.length;
    const done = state.stepsDone.length;
    progressLbl.textContent = `Прогрес: ${done}/${total}`;
  }

  function bindGlobal() {
    // detail buttons
    detail.btnDone.addEventListener("click", () => {
      if (!state.selected) return;
      toggleDone(state.selected);
      // sync checkbox on the left
      const node = $(`.step[data-key="${state.selected}"]`);
      if (node) {
        const cb = node.querySelector('input');
        cb.checked = !cb.checked;
        node.classList.toggle("is-done", cb.checked);
        updateBadge(node.closest(".section"), node.closest(".section").querySelectorAll('.step').length);
      }
      syncDetailDone();
    });

    detail.btnDetails.addEventListener("click", () => {
      toast("Детальна інструкція відкриється у вашому потоці. Поки що — дивись підказку нижче.");
      if (detail.extraWrap.hidden) detail.extraWrap.hidden = false;
    });

    // notes save
    let notesTimer;
    detail.notes.addEventListener("input", () => {
      clearTimeout(notesTimer);
      detail.notesStatus.textContent = "Зберігаю…";
      notesTimer = setTimeout(() => {
        if (state.selected) {
          state.notes[state.selected] = detail.notes.value;
          saveState();
          detail.notesStatus.textContent = "Збережено";
        }
      }, 300);
    });
    $("#btn-copy-notes").addEventListener("click", async () => {
      await navigator.clipboard.writeText(detail.notes.value);
      toast("Нотатки скопійовано");
    });

    // export/import/new
    btnExport.addEventListener("click", () => {
      navigator.clipboard.writeText(JSON.stringify(state, null, 2));
      toast("Стан скопійовано в буфер");
    });
    const modalImport = $("#modal-import");
    btnImport.addEventListener("click", () => { $("#import-text").value = ""; modalImport.showModal(); });
    $("#btn-apply-import").addEventListener("click", () => {
      try {
        const parsed = JSON.parse($("#import-text").value);
        state = {
          stepsDone: Array.isArray(parsed.stepsDone) ? parsed.stepsDone : [],
          filter: parsed.filter || FILTERS.ALL,
          selected: parsed.selected,
          notes: parsed.notes || {}
        };
        saveState();
        buildSections();
        selectFirstIfNone();
        modalImport.close();
        toast("Стан імпортовано");
      } catch { toast("Помилка JSON"); }
    });

    btnNew.addEventListener("click", () => {
      if (!confirm("Скинути прогрес?")) return;
      state = { stepsDone: [], filter: FILTERS.ALL, selected: undefined, notes: {} };
      saveState();
      buildSections();
      selectFirstIfNone();
      toast("Готово");
    });
  }

  // Extras for some steps
  function extraById(id) {
    const map = {
      7: "requirements.txt:\n\naiogram==3.*\npython-dotenv",
      9: "Файл .env:\n\nTOKEN=ваш_токен",
      20: "Приклад reply-меню (aiogram 3):\n\nfrom aiogram.types import ReplyKeyboardMarkup, KeyboardButton\nkb = ReplyKeyboardMarkup(keyboard=[[KeyboardButton(text='📋 Завдання'), KeyboardButton(text='🧠 Поради'), KeyboardButton(text='⚙️ Налаштування')]], resize_keyboard=True)",
      31: "Запуск:\n\npython main.py"
    };
    return map[id] || "";
  }

  // Utils
  function groupBy(arr, fn) {
    return arr.reduce((acc, x) => {
      const k = fn(x);
      (acc[k] ||= []).push(x);
      return acc;
    }, {});
  }
  function stepKey(sectionId, id) { return `${sectionId}:${id}`; }
  function parseKey(key) { const [sectionId, id] = key.split(":"); return { sectionId, id }; }
  function escape(s){ return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;"); }
  function toast(msg) {
    const box = $("#toasts");
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => el.remove(), 2200);
  }
})();
