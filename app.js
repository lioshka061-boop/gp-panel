/* app.js — двопанельний майстер з “деревом виборів” */

(() => {
  // ===== Helpers =====
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const escape = (s) => String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");

  // ===== Elements =====
  const seed = JSON.parse($("#seed").textContent);
  const sectionsRoot = $("#sections");
  const searchInput = $("#search");
  const progressLbl = $("#progress");
  const btnTheme = $("#btn-theme");
  const btnNew = $("#btn-new");
  const btnExport = document.querySelector('[data-action="export-state"]');
  const btnImport = document.querySelector('[data-action="import-state"]');
  const modalImport = $("#modal-import");
  const btnApplyImport = $("#btn-apply-import");

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
    body: $(".detail-body"),
  };

  // ===== Constants =====
  const STORAGE_KEY = "ztb.v4.state";
  const THEME_KEY = "ztb.v4.theme";
  const FILTERS = { ALL: "all", TODO: "todo", DONE: "done" };

  // Гілки бекенду — які кроки додаються
  const BACKEND_BRANCHES = {
    json: [
      {section:"db", id:15, title:"JSON: створити data/db.json", body:"Створи папку data/ і файл db.json.", action:"Створи data/db.json"},
      {section:"db", id:16, title:"JSON: функції читання/запису", body:"Додай у код функції для роботи з JSON.", action:"Попроси ChatGPT/Codex додати CRUD для db.json"},
      {section:"db", id:17, title:"JSON: інтеграція в /add", body:"Підключи запис у файл у хендлері.", action:"Встав код у main.py"},
      {section:"db", id:18, title:"Тест JSON", body:"Команда /add створює запис у db.json.", action:"Напиши /add й перевір"}
    ],
    sqlite: [
      {section:"db", id:15, title:"SQLite: створити db.sqlite3", body:"Створи файл бази.", action:"Створи db.sqlite3"},
      {section:"db", id:16, title:"SQLite: таблиця tasks", body:"Створи tasks(id, name, status).", action:"Попроси ChatGPT CRUD"},
      {section:"db", id:17, title:"SQLite: репозиторій", body:"Винеси в repository.py або в main.py.", action:"Підключи до хендлерів"},
      {section:"db", id:18, title:"Тест SQLite", body:"/add додає рядок у таблиці.", action:"Перевір через sqlite3"}
    ],
    gsheets: [
      {section:"db", id:15, title:"Google Sheets: таблиця", body:"Створи Google Sheet з доступом за посиланням.", action:"Створи таблицю"},
      {section:"db", id:16, title:"gspread підключення", body:"gspread, креденшали у .env.", action:"Попроси згенерувати код підключення"},
      {section:"db", id:17, title:"Запис рядків", body:"Зроби функцію appendRow.", action:"Встав код у main.py"},
      {section:"db", id:18, title:"Тест Sheets", body:"/add додає рядок у таблиці.", action:"Перевір у Google Sheets"}
    ],
    postgres: [
      {section:"db", id:15, title:"Docker Desktop", body:"Встанови Docker.", action:"Встанови Docker"},
      {section:"db", id:16, title:"docker-compose.yml", body:"Підніми Postgres контейнер.", action:"Запусти docker compose up -d"},
      {section:"db", id:17, title:"Psycopg2 + міграції", body:"Додай залежність, створи таблиці.", action:"Попроси код під aiogram + psycopg2"},
      {section:"db", id:18, title:"CRUD і хендлери", body:"Підключи репозиторій до команд.", action:"Інтегруй /add"},
      {section:"db", id:19, title:"Тест Postgres", body:"/add створює запис у БД.", action:"Перевір через psql"}
    ]
  };

  // ===== State =====
  /** @type {{
   * stepsDone: string[],
   * filter: string,
   * selected?: string,
   * notes: Record<string,string>,
   * type?: string, aiMode?: string, env?: string, backend?: string,
   * checklist: Record<string, boolean>
   * }} */
  let state = loadState() ?? {
    stepsDone: [],
    filter: FILTERS.ALL,
    selected: undefined,
    notes: {},
    type: undefined,
    aiMode: undefined,
    env: undefined,
    backend: undefined,
    checklist: { python:false, editor:false, github:false, copilot:false }
  };

  // ===== Theme =====
  initTheme();

  // ===== Build =====
  rebuild(); // будуємо ліво + деталь

  // ===== Theme handling =====
  function initTheme() {
    const cur = localStorage.getItem(THEME_KEY) || "auto";
    applyTheme(cur);
    btnTheme.addEventListener("click", () => {
      const next = curTheme() === "auto" ? "light" : curTheme() === "light" ? "dark" : "auto";
      applyTheme(next); toast(`Тема: ${next}`);
    });
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

  // ===== Build/Render =====
  function rebuild() {
    buildSections();
    bindFilters();
    applyFilters();
    selectFirstIfNone();
    updateProgress();
  }

  function visibleSteps() {
    const base = seed.steps.slice();
    if (state.backend && BACKEND_BRANCHES[state.backend]) {
      base.push(...BACKEND_BRANCHES[state.backend]);
    }
    return base;
  }

  function groupBy(arr, fn) {
    return arr.reduce((acc, x) => {
      const k = fn(x);
      (acc[k] ||= []).push(x);
      return acc;
    }, {});
  }

  function buildSections() {
    sectionsRoot.innerHTML = "";
    const steps = visibleSteps();
    const grouped = groupBy(steps, s => s.section);

    for (const sec of seed.sections) {
      const arr = grouped[sec.id] || [];
      if (!arr.length) continue;

      const section = document.createElement("section");
      section.className = "section";
      section.dataset.sectionId = sec.id;

      const head = document.createElement("div");
      head.className = "section-head";
      head.innerHTML = `<h3 class="section-title">${sec.title}</h3><span class="muted small" data-badge>0/${arr.length}</span>`;
      const body = document.createElement("div");
      body.className = "section-body";

      head.addEventListener("click", () => body.toggleAttribute("hidden"));

      section.append(head, body);

      arr.forEach(s => {
        const key = stepKey(s.section, s.id);
        const el = document.createElement("div");
        el.className = "step";
        el.dataset.key = key;
        el.innerHTML = `
          <input type="checkbox" ${state.stepsDone.includes(key) ? "checked" : ""} aria-label="готово" />
          <div>
            <div class="title">${s.id}) ${s.title}</div>
            <div class="meta">${escape(s.body)}</div>
          </div>
          <div class="badge">Відкрити</div>
        `;
        if (state.selected === key) el.classList.add("is-selected");
        if (state.stepsDone.includes(key)) el.classList.add("is-done");

        // open
        el.addEventListener("click", (ev) => {
          if (ev.target.tagName !== "INPUT") selectStep(key);
        });
        // done
        el.querySelector('input').addEventListener("change", (ev) => {
          toggleDone(key);
          el.classList.toggle("is-done", ev.target.checked);
          updateBadge(section, arr.length);
          if (state.selected === key) syncDetailDone();
        });

        body.appendChild(el);
      });

      updateBadge(section, arr.length);
      sectionsRoot.appendChild(section);
    }
  }

  function updateBadge(sectionEl, total) {
    const done = $$('[type="checkbox"]:checked', sectionEl).length;
    sectionEl.querySelector('[data-badge]').textContent = `${done}/${total}`;
    updateProgress();
  }

  // ===== Filters/Search =====
  function bindFilters() {
    $$(".chip").forEach(ch => ch.addEventListener("click", () => {
      $$(".chip").forEach(c => c.classList.remove("is-active"));
      ch.classList.add("is-active");
      state.filter = ch.dataset.filter;
      saveState();
      applyFilters();
    }));
    searchInput.addEventListener("input", applyFilters);
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

  // ===== Selection/Detail =====
  function selectStep(key) {
    state.selected = key; saveState();
    $$(".step").forEach(s => s.classList.toggle("is-selected", s.dataset.key === key));

    const {sectionId, id} = parseKey(key);
    const step = (visibleSteps().find(x => x.section === sectionId && String(x.id) === String(id)));
    const secTitle = seed.sections.find(ss => ss.id === sectionId)?.title || "";

    // Header
    detail.title.textContent = `${step.id}) ${step.title}`;
    detail.path.textContent = `${secTitle}`;
    syncDetailDone();

    // Body basics
    detail.desc.textContent = step.body;
    detail.action.textContent = step.action || "";
    const extra = extraById(step.id);
    detail.extraWrap.hidden = !extra;
    if (extra) detail.extra.textContent = extra;

    // Notes
    detail.notes.value = state.notes[key] || "";
    detail.notesStatus.textContent = "Збережено";

    // Custom widgets per step
    renderCustomFor(step);
  }

  function syncDetailDone() {
    const k = state.selected;
    const done = state.stepsDone.includes(k);
    detail.btnDone.textContent = done ? "↩️ Невиконано" : "✅ Зроблено";
  }

  function selectFirstIfNone() {
    if (state.selected) { selectStep(state.selected); return; }
    const first = $(".step")?.dataset.key;
    if (first) selectStep(first);
  }

  // ===== Done/Notes/Buttons =====
  detail.btnDone.addEventListener("click", () => {
    if (!state.selected) return;
    toggleDone(state.selected); syncDetailDone();
    const node = $(`.step[data-key="${state.selected}"]`);
    if (node) {
      const cb = node.querySelector('input');
      cb.checked = !cb.checked;
      node.classList.toggle("is-done", cb.checked);
      const section = node.closest(".section");
      const total = section.querySelectorAll('.step').length;
      updateBadge(section, total);
    }
  });

  detail.btnDetails.addEventListener("click", () => {
    toast("Підказки внизу. Детальна інструкція додається поступово.");
    if (detail.extraWrap.hidden) detail.extraWrap.hidden = false;
  });

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

  // ===== Export/Import/New =====
  btnExport.addEventListener("click", () => {
    navigator.clipboard.writeText(JSON.stringify(state, null, 2));
    toast("Стан скопійовано");
  });
  btnImport.addEventListener("click", () => { $("#import-text").value = ""; modalImport.showModal(); });
  btnApplyImport.addEventListener("click", () => {
    try {
      const parsed = JSON.parse($("#import-text").value);
      state = {
        stepsDone: Array.isArray(parsed.stepsDone) ? parsed.stepsDone : [],
        filter: parsed.filter || FILTERS.ALL,
        selected: parsed.selected,
        notes: parsed.notes || {},
        type: parsed.type, aiMode: parsed.aiMode, env: parsed.env, backend: parsed.backend,
        checklist: parsed.checklist || {python:false,editor:false,github:false,copilot:false}
      };
      saveState(); rebuild(); modalImport.close(); toast("Імпортовано");
    } catch { toast("Помилка JSON"); }
  });
  btnNew.addEventListener("click", () => {
    if (!confirm("Скинути прогрес і вибори?")) return;
    state = { stepsDone: [], filter: FILTERS.ALL, selected: undefined, notes: {}, type:undefined, aiMode:undefined, env:undefined, backend:undefined, checklist:{python:false,editor:false,github:false,copilot:false} };
    saveState(); rebuild(); toast("Готово");
  });

  // ===== Mechanics =====
  function toggleDone(key) {
    const i = state.stepsDone.indexOf(key);
    if (i >= 0) state.stepsDone.splice(i, 1);
    else state.stepsDone.push(key);
    saveState();
  }

  function updateProgress() {
    const total = visibleSteps().length;
    const done = state.stepsDone.length;
    progressLbl.textContent = `Прогрес: ${done}/${total}`;
  }

  function stepKey(sectionId, id) { return `${sectionId}:${id}`; }
  function parseKey(key) { const [sectionId, id] = key.split(":"); return { sectionId, id }; }

  function toast(msg) {
    const box = $("#toasts");
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => el.remove(), 2200);
  }

  // ===== Custom content for required TZ steps =====
  function renderCustomFor(step) {
    // Очистити попередні кастом-блоки, якщо були
    $$("[data-custom]", detail.body).forEach(n => n.remove());

    if (step.id === 2) renderChoice("Тип бота", "type", [
      ["crm","CRM"],["task","Task Manager"],["habit","Habit Tracker"],
      ["faq","FAQ / Support"],["shop","Shop"],["booking","Booking"],["custom","Custom"]
    ]);
    if (step.id === 3) renderChoice("Режим ШІ", "aiMode", [
      ["chatgpt","ChatGPT-only"],["codex","ChatGPT + Codex (Copilot)"]
    ]);
    if (step.id === 4) renderChoice("Середовище", "env", [
      ["local","💻 Local"],["codespaces","☁️ Codespaces"]
    ]);
    if (step.id === 12) {
      renderChoice("Бекенд", "backend", [
        ["json","JSON файл"],["sqlite","SQLite"],["gsheets","Google Sheets"],["postgres","Postgres (Docker)"]
      ], () => { rebuild(); });
    }
    if (step.id === 5) renderChecklist();
  }

  function renderChoice(label, key, options, onChange) {
    const wrap = document.createElement("div");
    wrap.dataset.custom = "choice";
    wrap.className = "detail-block";
    const cur = state[key];
    wrap.innerHTML = `<h3>${label}</h3>`;
    const list = document.createElement("div");
    list.style.display = "grid"; list.style.gap = "8px";
    options.forEach(([val, text]) => {
      const id = `${key}-${val}`;
      const row = document.createElement("label");
      row.style.display = "grid";
      row.style.gridTemplateColumns = "20px 1fr";
      row.style.gap = "8px";
      row.innerHTML = `<input type="radio" name="${key}" id="${id}" value="${val}" ${cur===val?"checked":""}/><span>${text}</span>`;
      list.appendChild(row);
    });
    wrap.appendChild(list);
    detail.body.prepend(wrap);

    list.addEventListener("change", (e) => {
      const v = e.target.closest("input")?.value;
      if (!v) return;
      state[key] = v; saveState();
      toast(`${label}: ${options.find(o=>o[0]===v)?.[1]}`);
      if (typeof onChange === "function") onChange();
    });
  }

  function renderChecklist() {
    const wrap = document.createElement("div");
    wrap.dataset.custom = "checklist";
    wrap.className = "detail-block";
    wrap.innerHTML = `<h3>Чек-лист інструментів</h3>`;
    const ul = document.createElement("ul");
    ul.style.listStyle = "none"; ul.style.padding = "0"; ul.style.margin = "0";
    const items = [
      ["python","Python 3.10+ встановлено"],
      ["editor","Редактор відкривається (VS Code / Cursor)"],
      ["github","Є обліковий запис GitHub"],
      ["copilot","Якщо Codex — увімкнений Copilot"]
    ];
    items.forEach(([key,label]) => {
      const li = document.createElement("li");
      li.style.padding = "6px 0";
      li.innerHTML = `<label style="display:grid;grid-template-columns:20px 1fr;gap:8px;align-items:center;">
        <input type="checkbox" ${state.checklist[key]?"checked":""} data-k="${key}"/>
        <span>${label}</span>
      </label>`;
      ul.appendChild(li);
    });
    wrap.appendChild(ul);
    detail.body.appendChild(wrap);

    ul.addEventListener("change",(e)=>{
      const k = e.target.dataset.k;
      state.checklist[k] = e.target.checked;
      saveState();
    });
  }

  // Підказки
  function extraById(id) {
    const map = {
      7: "requirements.txt:\n\naiogram==3.*\npython-dotenv",
      9: "Файл .env:\n\nTOKEN=сюди_вставиш_токен",
      20: "Приклад reply-меню (aiogram 3):\n\nfrom aiogram.types import ReplyKeyboardMarkup, KeyboardButton\nkb = ReplyKeyboardMarkup(keyboard=[[KeyboardButton(text='📋 Завдання'), KeyboardButton(text='🧠 Поради'), KeyboardButton(text='⚙️ Налаштування')]], resize_keyboard=True)",
      31: "Запуск:\n\npython main.py"
    };
    return map[id] || "";
  }
})();
