 HEAD
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
const STORAGE_KEY = 'ztb_v4_state';

const SECTION_MAP = [
  { range: [1, 5], label: 'I. Старт' },
  { range: [6, 11], label: 'II. Підготовка проєкту' },
  { range: [12, 18], label: 'III. База даних' },
  { range: [19, 22], label: 'IV. Дизайн' },
  { range: [23, 25], label: 'V. Статистика' },
  { range: [26, 29], label: 'VI. Оплати' },
  { range: [30, 33], label: 'VII. Запуск' },
  { range: [34, 35], label: 'VIII. Розвиток' },
  { range: [36, 36], label: 'Поради за типами' }
];

const BOT_TYPES = [
  {
    id: 'crm',
    title: 'CRM',
    description: 'Веде клієнтів і завдання',
    commands: ['/start', '/help', '/add', '/clients', '/tasks', '/done', '/stats'],
    advice: [
      'Зберігай клієнтів та завдання з полями: ім’я, статус, наступний крок.',
      'Комбінація команд: /add → /clients → /tasks → /done.',
      'Рекомендований бекенд: SQLite або Postgres.'
    ]
  },
  {
    id: 'task',
    title: 'Task Manager',
    description: 'Список справ для команди',
    commands: ['/start', '/help', '/add', '/list', '/done', '/skip', '/stats'],
    advice: [
      'Завдання містять виконавця, дедлайн і статус.',
      'Стартуй на JSON (малий проєкт), переходь на SQLite коли команда виросте.',
      'Додай нагадування про дедлайни через планувальник.'
    ]
  },
  {
    id: 'habit',
    title: 'Habit Tracker',
    description: 'Щоденні звички й нагадування',
    commands: ['/start', '/help', '/add', '/habits', '/done', '/streak', '/plan', '/stats'],
    advice: [
      'Записуй назву звички, час доби, дедлайн.',
      'Зроби автоматику нагадувань — без нагадувань звички не працюють.',
      'Зберігання: JSON (старт) або SQLite (гнучкі звіти).'
    ]
  },
  {
    id: 'faq',
    title: 'FAQ / Support',
    description: 'Відповідає на типові питання',
    commands: ['/start', '/help', '/faq', '/contact', '/tips'],
    advice: [
      'Зберігай питання-відповіді у таблиці — Google Sheets ідеально.',
      'Додай швидкі кнопки для “Написати менеджеру” та “Отримати знижку”.',
      'Тримай тексти лаконічними, з емодзі та виділенням важливого.'
    ]
  },
  {
    id: 'shop',
    title: 'Shop',
    description: 'Міні-магазин у Telegram',
    commands: ['/start', '/help', '/catalog', '/buy', '/cart', '/pay', '/support'],
    advice: [
      'Каталог = назва, опис, ціна, наявність.',
      'Бекенд: SQLite + Stripe/WayForPay для платежів.',
      'Налаштуй повідомлення менеджеру про нові замовлення.'
    ]
  },
  {
    id: 'booking',
    title: 'Booking',
    description: 'Запис на послуги',
    commands: ['/start', '/help', '/book', '/slots', '/cancel', '/contact'],
    advice: [
      'Фіксуй дату, час, клієнта, статус.',
      'SQLite або Google Sheets підійдуть для розкладу.',
      'Додай нагадування за 2 години до зустрічі.'
    ]
  },
  {
    id: 'custom',
    title: 'Custom',
    description: 'Свій сценарій',
    commands: ['/start', '/help'],
    advice: [
      'Почни з мінімуму: /start, /help, 2-3 основні команди.',
      'Стартуй на JSON, далі переходь на SQLite, коли треба масштаб.',
      'Розбий проєкт на маленькі модулі за прикладом гайду.'
    ]
  }
];

const MODES = [
  { id: 'chatgpt', title: 'ChatGPT-only', description: 'Безкоштовно. Код переносиш вручну.' },
  { id: 'codex', title: 'ChatGPT + Codex (Copilot)', description: 'Потрібна підписка на Copilot. Швидко й чисто.' }
];

const ENVIRONMENTS = [
  { id: 'local', title: '💻 Local', description: 'Ваш комп’ютер. Потрібно встановити Python.' },
  { id: 'codespaces', title: '☁️ Codespaces', description: 'Все в браузері через GitHub.' }
];

const TOOLS = [
  { id: 'python', label: 'Python 3.10+ встановлено' },
  { id: 'editor', label: 'Редактор відкривається (VS Code / Cursor)' },
  { id: 'github', label: 'Є обліковий запис GitHub' },
  { id: 'copilot', label: 'Copilot увімкнений (якщо обрано Codex)', optional: true }
];

const BACKEND_OPTIONS = [
  {
    id: 'json',
    title: 'JSON файл',
    description: 'Найпростіше. Дані зберігаються у файлі.',
    steps: [
      { number: 15, text: 'Створи папку `data/` та файл `db.json`.' },
      { number: 16, text: 'Запитай: «Додай у код функції для читання і запису JSON db.json».', prompt: 'Додай у код функції load_data/save_data для роботи з файлом data/db.json.' },
      { number: 17, text: 'Встав отриманий код у `main.py` і збережи.' },
      { number: 18, text: 'Тест: команда `/add` → перевір, що `db.json` оновився.' }
    ]
  },
  {
    id: 'sqlite',
    title: 'SQLite',
    description: 'База у файлі. Ідеально для невеликих проєктів.',
    steps: [
      { number: 15, text: 'Створи файл `db.sqlite3`.' },
      { number: 16, text: 'Запитай: «Додай SQLite: таблиця tasks (id, name, status). CRUD-функції».', prompt: 'Додай у проект SQLite з таблицею tasks (id INTEGER PK, name TEXT, status TEXT) та функціями створити/прочитати/оновити/видалити.' },
      { number: 17, text: 'Встав код у проект (`repository.py` або `main.py`).' },
      { number: 18, text: 'Тест: `/add` → у таблиці з’явився запис → ✅.' }
    ]
  },
  {
    id: 'gsheets',
    title: 'Google Sheets',
    description: 'Онлайн-таблиця як база даних.',
    steps: [
      { number: 15, text: 'Створи Google Sheet та увімкни доступ “за посиланням”.' },
      { number: 16, text: 'Запитай: «Підключи gspread до Google Sheets, ключ у .env».', prompt: 'Підключи aiogram-проєкт до Google Sheets через gspread. Використай ключі у .env: GOOGLE_CREDENTIALS, SHEET_ID.' },
      { number: 17, text: 'Додай ключі до `.env`, встав код підключення та запису.' },
      { number: 18, text: 'Тест: `/add` → новий рядок у таблиці → ✅.' }
    ]
  },
  {
    id: 'postgres',
    title: 'Postgres (Docker)',
    description: 'Потужна база для команди/бізнесу.',
    steps: [
      { number: 15, text: 'Встанови Docker Desktop.' },
      { number: 16, text: 'Створи `docker-compose.yml` (візьми шаблон панелі).', prompt: 'Згенеруй docker-compose.yml з Postgres (пароль postgres, порт 5432) та сервісом для бота.' },
      { number: 17, text: 'Запусти `docker compose up -d`. Додай `psycopg2` у залежності.' },
      { number: 18, text: 'Запитай: «Підключи aiogram до Postgres, створення таблиць, CRUD».', prompt: 'Додай у проєкт підключення до Postgres (SQLAlchemy або psycopg2) з таблицею tasks та CRUD-функціями.' },
      { number: 19, text: 'Тест: `/add` → запис у базі → ✅.' }
    ]
  }
];

const DESIGN_STEPS = [
  { number: 19, title: 'Що таке дизайн', content: 'Дизайн — це зовнішній вигляд бота: кнопки, меню, тексти. Робимо просто та зрозуміло.' },
  { number: 20, title: 'Головне меню (Reply-кнопки)', instructions: [
    'Запитай: «Додай меню з кнопками: 📋 Завдання, 🧠 Поради, ⚙️ Налаштування».',
    'Встав код, збережи, у Telegram напиши `/start` → меню повинно з’явитися.'
  ]},
  { number: 21, title: 'Inline-кнопки у повідомленнях', instructions: [
    'Запитай: «Додай inline-кнопки на сторінці “Завдання”: [✅ Готово] [❌ Пропустити] [📊 Статистика]».',
    'Застосуй код, протестуй кнопки в чаті.'
  ]},
  { number: 22, title: 'Гарні тексти', instructions: [
    'Додай емодзі, короткі дружні фрази.',
    'Приклад блоку: \n🌟 Твій прогрес сьогодні\n✅ Завдання виконано\n🔄 Повертайся завтра!'
  ]}
];

const STATS_STEPS = [
  { number: 23, title: 'Команда /stats', instructions: [
    'Запитай: «Додай команду /stats. Показуй скільки зроблено за сьогодні, тиждень, всього».',
    'Встав код, перевір у Telegram.'
  ]},
  { number: 24, title: 'Красивий звіт', instructions: [
    'Запитай: «Зроби звіт із емодзі та відсотками».',
    'Приклад:\n📊 Твій прогрес:\n✅ За сьогодні: 3/5\n📅 За тиждень: 17/25\n🌟 Молодець!'
  ]},
  { number: 25, title: 'Щоденні нагадування', instructions: [
    'Запитай: «Надсилай щоденний звіт о 20:00».',
    'Додай розклад (apscheduler або asyncio).'
  ]}
];

const PAYMENT_OPTIONS = [
  {
    id: 'stripe',
    title: 'Stripe',
    description: 'Міжнародні картки (USD і не тільки).',
    steps: [
      { number: 28, text: 'Запитай: «Додай оплату Stripe на $5 і команду /buy. Після успіху — “Дякую за оплату!”».', prompt: 'Додай у бота оплату Stripe на $5: команда /buy, після успіху повідомлення “Дякую за оплату!”.' },
      { number: 29, text: 'Встав код → тест: посилання на оплату працює → ✅.' }
    ]
  },
  {
    id: 'wayforpay',
    title: 'WayForPay',
    description: 'Українська платіжка (грн).',
    steps: [
      { number: 28, text: 'Запитай: «Додай WayForPay на 100 грн для “Преміум-доступ”. Після оплати — “Дякую!”».', prompt: 'Додай WayForPay оплату на 100 грн для “Преміум-доступ”. Після успіху відправ “Дякую!”.' },
      { number: 29, text: 'Встав код → тест: форма відкривається та проходить → ✅.' }
    ]
  }
];

const PAYMENTS_PREP_STEP = {
  number: 27,
  instructions: [
    'Зареєструйся у вибраній платіжці: stripe.com / wayforpay.com.',
    'Додай ключі в `.env`:\nSTRIPE_KEY=...\nWAYFORPAY_KEY=... (залежно від вибору).',
    'API-ключ — це секретний код для доступу до сервісу оплати. Не ділись ним.'
  ]
};

const LAUNCH_STEPS = [
  { number: 30, title: 'Створення бота у BotFather', instructions: [
    'Відкрий `@BotFather` → `/newbot`.',
    'Отримай токен → встав у `.env` як `TOKEN=...`.'
  ]},
  { number: 31, title: 'Запуск', instructions: [
    'У терміналі (всередині папки проєкту):',
    '```bash\npython main.py\n```',
    'Якщо бачиш “Bot started” — все добре.'
  ]},
  { number: 32, title: 'Перевір команди', instructions: [
    '`/start` — привітання є.',
    '`/help` — інструкція є.',
    'Кастомна команда (наприклад `/add`) — працює.'
  ]},
  { number: 33, title: 'Резервна копія', instructions: [
    'Скопіюй папку у хмару або на GitHub.',
    'Перезапусти бота і перевір, що все працює.'
  ]}
];

const GROWTH_STEPS = [
  { number: 34, title: 'Додаткові модулі', instructions: [
    '🔁 автозбереження',
    '🌍 багатомовність (uk/en)',
    '🧩 адмін-панель'
  ]},
  { number: 35, title: 'Фініш', instructions: [
    'Покажи: «Готово! Ти створив свого Telegram-бота.»',
    'Кнопки: 🔄 «Створити нового бота», 🚀 «Покращити поточного».'
  ]}
];

const defaultState = {
  currentStep: 0,
  choices: {
    botType: null,
    mode: null,
    environment: null,
    backend: null,
    payment: 'none'
  },
  tools: TOOLS.reduce((acc, item) => {
    acc[item.id] = false;
    return acc;
  }, {}),
  commands: ['/start', '/help'],
  devBriefLanguage: 'uk',
  devBriefChannel: 'dm'
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    return Object.assign(structuredClone(defaultState), parsed);
  } catch (error) {
    console.error('Failed to load state', error);
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();
let steps = [];

const elements = {
  section: document.getElementById('section-label'),
  progressBar: document.getElementById('progress-inner'),
  progressLabel: document.getElementById('progress-label'),
  stepIndex: document.getElementById('step-index'),
  stepTitle: document.getElementById('step-title'),
  stepBody: document.getElementById('step-body'),
  prev: document.getElementById('prev-btn'),
  next: document.getElementById('next-btn'),
  toast: document.getElementById('toast'),
  footer: document.querySelector('footer.controls')
};

elements.prev.addEventListener('click', () => {
  if (state.currentStep === 0) return;
  setStep(state.currentStep - 1);
});

elements.next.addEventListener('click', () => {
  const step = steps[state.currentStep];
  const validation = validateStep(step);
  if (!validation.allow) {
    showToast(validation.message);
    return;
  }
  setStep(Math.min(state.currentStep + 1, steps.length - 1));
});

function setStep(index) {
  state.currentStep = Math.max(0, Math.min(index, steps.length - 1));
  saveState();
  render();
}

function rebuildSteps() {
  const prevId = steps[state.currentStep]?.id;
  steps = buildSteps();
  const newIndex = steps.findIndex((step) => step.id === prevId);
  if (newIndex >= 0) {
    state.currentStep = newIndex;
  } else {
    state.currentStep = Math.min(state.currentStep, steps.length - 1);
  }
  saveState();
}

function buildSteps() {
  const result = [];

  // Section I
  result.push({
    id: 'start',
    number: 1,
    title: 'Привітання',
    section: 'I. Старт',
    hideNav: true,
    render: renderStartStep
  });
  result.push({
    id: 'bot-type',
    number: 2,
    title: 'Вибір типу бота',
    section: 'I. Старт',
    render: renderBotTypeStep
  });
  result.push({
    id: 'mode',
    number: 3,
    title: 'Вибір режиму ШІ',
    section: 'I. Старт',
    render: renderModeStep
  });
  result.push({
    id: 'environment',
    number: 4,
    title: 'Вибір середовища',
    section: 'I. Старт',
    render: renderEnvironmentStep
  });
  result.push({
    id: 'tools',
    number: 5,
    title: 'Перевірка інструментів',
    section: 'I. Старт',
    render: renderToolsStep
  });

  // Section II
  result.push({
    id: 'folder',
    number: 6,
    title: 'Створення папки',
    section: 'II. Підготовка проєкту',
    render: (container) => renderInfoStep(container, [
      'Створи папку `mybot`.',
      'Відкрий її у своєму редакторі (VS Code / Cursor).'
    ], 'Мета — мати чисте місце для файлів бота.')
  });
  result.push({
    id: 'requirements',
    number: 7,
    title: 'Створення requirements.txt',
    section: 'II. Підготовка проєкту',
    render: renderRequirementsStep
  });
  result.push({
    id: 'main-file',
    number: 8,
    title: 'Створення main.py',
    section: 'II. Підготовка проєкту',
    render: (container) => renderInfoStep(container, [
      'Створи файл `main.py` у корені проєкту.',
      'Поки що залиш його порожнім — код додамо далі.'
    ], 'main.py буде головною точкою запуску бота.')
  });
  result.push({
    id: 'env-file',
    number: 9,
    title: 'Створення .env',
    section: 'II. Підготовка проєкту',
    render: renderEnvStep
  });
  result.push({
    id: 'dev-brief',
    number: 10,
    title: 'DEV BRIEF',
    section: 'II. Підготовка проєкту',
    render: renderDevBriefStep
  });
  result.push({
    id: 'code-prompt',
    number: 11,
    title: 'Промпт для коду',
    section: 'II. Підготовка проєкту',
    render: renderCodePromptStep
  });

  // Section III
  result.push({
    id: 'backend-choice',
    number: 12,
    title: 'Вибір типу зберігання',
    section: 'III. База даних',
    render: renderBackendChoiceStep
  });
  result.push({
    id: 'backend-explain',
    number: 13,
    title: 'Пояснення від панелі',
    section: 'III. База даних',
    render: (container) => renderInfoStep(container, [
      'Без зберігання бот “забуває” все після перезапуску.',
      'Обери один варіант і доведи його до тесту.'
    ])
  });
  result.push({
    id: 'backend-confirm',
    number: 14,
    title: 'Підтвердження вибору',
    section: 'III. База даних',
    render: renderBackendConfirmStep
  });

  const backend = BACKEND_OPTIONS.find((option) => option.id === state.choices.backend);
  if (backend) {
    backend.steps.forEach((item) => {
      result.push({
        id: `${backend.id}-${item.number}`,
        number: item.number,
        title: `${backend.title}: крок ${item.number}`,
        section: 'III. База даних',
        render: (container) => renderBackendActionStep(container, backend.title, item)
      });
    });
  }

  // Section IV
  DESIGN_STEPS.forEach(({ number, title, content, instructions }) => {
    result.push({
      id: `design-${number}`,
      number,
      title,
      section: 'IV. Дизайн',
      render: (container) => renderInstructionStep(container, content, instructions)
    });
  });

  // Section V
  STATS_STEPS.forEach(({ number, title, instructions }) => {
    result.push({
      id: `stats-${number}`,
      number,
      title,
      section: 'V. Статистика',
      render: (container) => renderInstructionStep(container, null, instructions)
    });
  });

  // Section VI
  result.push({
    id: 'payments-choice',
    number: 26,
    title: 'Вибір системи оплати (опційно)',
    section: 'VI. Оплати',
    render: renderPaymentsChoiceStep
  });
  result.push({
    id: 'payments-prep',
    number: 27,
    title: 'Підготовка ключів',
    section: 'VI. Оплати',
    render: (container) => renderInstructionStep(container, null, PAYMENTS_PREP_STEP.instructions)
  });

  const payment = PAYMENT_OPTIONS.find((option) => option.id === state.choices.payment);
  if (payment) {
    payment.steps.forEach((step) => {
      result.push({
        id: `${payment.id}-${step.number}`,
        number: step.number,
        title: `${payment.title}: крок ${step.number}`,
        section: 'VI. Оплати',
        render: (container) => renderPaymentStep(container, payment.title, step)
      });
    });
  }

  // Section VII
  LAUNCH_STEPS.forEach(({ number, title, instructions }) => {
    result.push({
      id: `launch-${number}`,
      number,
      title,
      section: 'VII. Запуск',
      render: (container) => renderInstructionStep(container, null, instructions)
    });
  });

  // Section VIII
  GROWTH_STEPS.forEach(({ number, title, instructions }) => {
    result.push({
      id: `growth-${number}`,
      number,
      title,
      section: 'VIII. Розвиток',
      render: (container) => renderInstructionStep(container, null, instructions)
    });
  });

  // Advice step
  result.push({
    id: 'advice',
    number: 36,
    title: 'Поради для обраного типу',
    section: 'Поради за типами',
    render: renderAdviceStep
  });

  return result;
}

function render() {
  rebuildSteps();
  const step = steps[state.currentStep];

  elements.stepIndex.textContent = `Крок ${step.number}`;
  elements.stepTitle.textContent = step.title;

  const section = SECTION_MAP.find(({ range }) => step.number >= range[0] && step.number <= range[1]);
  elements.section.textContent = section ? section.label : '';

  const progress = ((state.currentStep + 1) / steps.length) * 100;
  elements.progressBar.style.width = `${progress}%`;
  elements.progressLabel.textContent = `${state.currentStep + 1} / ${steps.length}`;

  if (step.hideNav) {
    elements.footer.style.display = 'none';
  } else {
    elements.footer.style.display = '';
  }

  elements.prev.disabled = state.currentStep === 0;
  elements.next.textContent = state.currentStep === steps.length - 1 ? 'Завершити' : 'Далі ➡️';

  elements.stepBody.innerHTML = '';
  step.render(elements.stepBody);
}

function renderStartStep(container) {
  const block = document.createElement('div');
  block.className = 'start-screen';

  const title = document.createElement('h3');
  title.textContent = 'Запускаємо майстер створення власного Telegram-бота.';
  block.appendChild(title);

  const description = document.createElement('p');
  description.textContent = 'Принцип простий: одна дія = один крок. Кожен крок займає до 3 хвилин.';
  block.appendChild(description);

  const startButton = document.createElement('button');
  startButton.className = 'primary';
  startButton.textContent = 'Почати';
  startButton.addEventListener('click', () => {
    setStep(1);
    showToast('Крок 1 — обери тип бота.');
  });
  block.appendChild(startButton);

  container.appendChild(block);
}

function renderBotTypeStep(container) {
  const tableWrap = document.createElement('div');
  tableWrap.className = 'table-wrapper';
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th>Тип</th>
      <th>Короткий опис</th>
      <th>Рекомендовані команди</th>
    </tr>
  `;
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  BOT_TYPES.forEach((type) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${type.title}</strong></td>
      <td>${type.description}</td>
      <td>${type.commands.join(', ')}</td>
    `;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  tableWrap.appendChild(table);
  container.appendChild(tableWrap);

  const cards = document.createElement('div');
  cards.className = 'card-grid';
  BOT_TYPES.forEach((type) => {
    const card = document.createElement('div');
    card.className = 'card';
    if (state.choices.botType === type.id) card.classList.add('active');
    card.innerHTML = `
      <h3>${type.title}</h3>
      <p>${type.description}</p>
      <div class="commands">${type.commands.join(', ')}</div>
    `;
    card.addEventListener('click', () => {
      state.choices.botType = type.id;
      state.commands = [...type.commands];
      saveState();
      render();
    });
    cards.appendChild(card);
  });
  container.appendChild(cards);

  const note = document.createElement('div');
  note.className = 'note-block';
  note.innerHTML = `
    <strong>Пояснення:</strong> команда — це слово з косою рискою, яке ти пишеш боту. Наприклад, <code>/start</code>.
  `;
  container.appendChild(note);
}

function renderModeStep(container) {
  const cards = document.createElement('div');
  cards.className = 'card-grid';
  MODES.forEach((mode) => {
    const card = document.createElement('div');
    card.className = 'card';
    if (state.choices.mode === mode.id) card.classList.add('active');
    card.innerHTML = `
      <h3>${mode.title}</h3>
      <p>${mode.description}</p>
    `;
    card.addEventListener('click', () => {
      state.choices.mode = mode.id;
      saveState();
      render();
    });
    cards.appendChild(card);
  });
  container.appendChild(cards);

  const info = document.createElement('div');
  info.className = 'info-block';
  info.innerHTML = `
    <strong>Що це означає?</strong>
    <div>Система підлаштує інструкції: «Скопіювати для ChatGPT» або «Відкрити в Codex».</div>
  `;
  container.appendChild(info);
}

function renderEnvironmentStep(container) {
  const cards = document.createElement('div');
  cards.className = 'card-grid';
  ENVIRONMENTS.forEach((env) => {
    const card = document.createElement('div');
    card.className = 'card';
    if (state.choices.environment === env.id) card.classList.add('active');
    card.innerHTML = `
      <h3>${env.title}</h3>
      <p>${env.description}</p>
    `;
    card.addEventListener('click', () => {
      state.choices.environment = env.id;
      if (env.id !== 'codespaces') {
        state.tools.copilot = false;
      }
      saveState();
      render();
    });
    cards.appendChild(card);
  });
  container.appendChild(cards);
}

function renderToolsStep(container) {
  const checklist = document.createElement('div');
  checklist.className = 'checklist';
  TOOLS.forEach((tool) => {
    if (tool.optional && state.choices.mode !== 'codex') {
      state.tools[tool.id] = false;
      return;
    }
    const row = document.createElement('div');
    row.className = 'check-item';
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !!state.tools[tool.id];
    input.addEventListener('change', (event) => {
      state.tools[tool.id] = event.target.checked;
      saveState();
    });
    label.appendChild(input);
    const span = document.createElement('span');
    span.textContent = tool.label + (tool.optional ? ' (для Codex)' : '');
    label.appendChild(span);
    row.appendChild(label);
    checklist.appendChild(row);
  });
  container.appendChild(checklist);
}

function renderRequirementsStep(container) {
  const info = document.createElement('div');
  info.className = 'info-block';
  info.innerHTML = `
    <strong>Встав у requirements.txt:</strong>
    <pre><code>aiogram==3.*\npython-dotenv</code></pre>
    <div>Залежності — це сторонні частини коду, які ми використовуємо.</div>
  `;
  container.appendChild(info);
}

function renderEnvStep(container) {
  const info = document.createElement('div');
  info.className = 'info-block';
  info.innerHTML = `
    <strong>Створи файл .env зі строкою:</strong>
    <pre><code>TOKEN=сюди_вставиш_токен</code></pre>
    <div>.env — це секрети: ключі, токени. Їх не публікуємо.</div>
  `;
  container.appendChild(info);
}

function renderDevBriefStep(container) {
  const brief = generateDevBrief();
  const block = document.createElement('div');
  block.className = 'prompt-area';
  block.textContent = brief;

  const copy = document.createElement('button');
  copy.className = 'copy-btn';
  copy.textContent = 'Скопіювати';
  copy.addEventListener('click', () => copyText(brief));
  block.appendChild(copy);

  container.appendChild(block);
}

function renderCodePromptStep(container) {
  const mode = state.choices.mode === 'codex' ? 'Codex/Cursor' : 'ChatGPT';
  const prompt = generateCodePrompt();
  const info = document.createElement('div');
  info.className = 'info-block';
  info.innerHTML = `
    <strong>Що робимо:</strong> вставляємо ${mode} промпт, отриманий код копіюємо у <code>main.py</code>.
  `;
  container.appendChild(info);

  const block = document.createElement('div');
  block.className = 'prompt-area';
  block.textContent = prompt;
  const copy = document.createElement('button');
  copy.className = 'copy-btn';
  copy.textContent = 'Скопіювати промпт';
  copy.addEventListener('click', () => copyText(prompt));
  block.appendChild(copy);
  container.appendChild(block);
}

function renderBackendChoiceStep(container) {
  const cards = document.createElement('div');
  cards.className = 'card-grid';
  BACKEND_OPTIONS.forEach((option) => {
    const card = document.createElement('div');
    card.className = 'card';
    if (state.choices.backend === option.id) card.classList.add('active');
    card.innerHTML = `
      <h3>${option.title}</h3>
      <p>${option.description}</p>
    `;
    card.addEventListener('click', () => {
      state.choices.backend = option.id;
      saveState();
      render();
    });
    cards.appendChild(card);
  });
  container.appendChild(cards);
}

function renderBackendConfirmStep(container) {
  const backend = BACKEND_OPTIONS.find((option) => option.id === state.choices.backend);
  const info = document.createElement('div');
  info.className = 'info-block';
  if (backend) {
    info.innerHTML = `
      <strong>Обрано:</strong> ${backend.title}. Натисни «Далі», щоб виконати кроки ${backend.title}.
    `;
  } else {
    info.innerHTML = `
      <strong>Спочатку обери варіант.</strong> Без бекенду бот не зберігатиме дані.
    `;
  }
  container.appendChild(info);
}

function renderBackendActionStep(container, backendTitle, item) {
  const info = document.createElement('div');
  info.className = 'info-block';
  info.innerHTML = `
    <strong>${backendTitle}</strong>
    <div>${item.text}</div>
  `;
  container.appendChild(info);

  if (item.prompt) {
    const promptArea = document.createElement('div');
    promptArea.className = 'prompt-area';
    promptArea.textContent = item.prompt;
    const copy = document.createElement('button');
    copy.className = 'copy-btn';
    copy.textContent = 'Скопіювати промпт';
    copy.addEventListener('click', () => copyText(item.prompt));
    promptArea.appendChild(copy);
    container.appendChild(promptArea);
  }
}

function renderInstructionStep(container, intro, instructions) {
  if (intro) {
    const info = document.createElement('div');
    info.className = 'info-block';
    info.textContent = intro;
    container.appendChild(info);
  }
  if (instructions?.length) {
    const list = document.createElement('div');
    list.className = 'info-block';
    list.innerHTML = instructions.map((item) => `<div>• ${item}</div>`).join('');
    container.appendChild(list);
  }
}

function renderPaymentsChoiceStep(container) {
  const cards = document.createElement('div');
  cards.className = 'card-grid';

  PAYMENT_OPTIONS.forEach((option) => {
    const card = document.createElement('div');
    card.className = 'card';
    if (state.choices.payment === option.id) card.classList.add('active');
    card.innerHTML = `
      <h3>${option.title}</h3>
      <p>${option.description}</p>
    `;
    card.addEventListener('click', () => {
      state.choices.payment = option.id;
      saveState();
      render();
    });
    cards.appendChild(card);
  });

  const skipCard = document.createElement('div');
  skipCard.className = 'card';
  if (state.choices.payment === 'none') skipCard.classList.add('active');
  skipCard.innerHTML = `
    <h3>Пропустити оплати</h3>
    <p>Можна додати платежі пізніше. Натисни, якщо хочеш перейти далі.</p>
  `;
  skipCard.addEventListener('click', () => {
    state.choices.payment = 'none';
    saveState();
    render();
  });
  cards.appendChild(skipCard);

  container.appendChild(cards);
}

function renderPaymentStep(container, title, step) {
  const info = document.createElement('div');
  info.className = 'info-block';
  info.innerHTML = `<strong>${title}</strong><div>${step.text}</div>`;
  container.appendChild(info);

  if (step.prompt) {
    const promptArea = document.createElement('div');
    promptArea.className = 'prompt-area';
    promptArea.textContent = step.prompt;
    const copy = document.createElement('button');
    copy.className = 'copy-btn';
    copy.textContent = 'Скопіювати промпт';
    copy.addEventListener('click', () => copyText(step.prompt));
    promptArea.appendChild(copy);
    container.appendChild(promptArea);
  }
}

function renderAdviceStep(container) {
  const type = BOT_TYPES.find((item) => item.id === state.choices.botType);
  if (!type) {
    const info = document.createElement('div');
    info.className = 'info-block';
    info.textContent = 'Спочатку обери тип бота, щоб отримати поради.';
    container.appendChild(info);
    return;
  }
  const info = document.createElement('div');
  info.className = 'info-block';
  info.innerHTML = `<strong>${type.title}</strong> — ключові рекомендації`;
  container.appendChild(info);

  const list = document.createElement('div');
  list.className = 'info-block';
  list.innerHTML = type.advice.map((item) => `<div>• ${item}</div>`).join('');
  container.appendChild(list);
}

function renderInfoStep(container, points, footer) {
  const list = document.createElement('div');
  list.className = 'info-block';
  list.innerHTML = points.map((item) => `<div>• ${item}</div>`).join('');
  container.appendChild(list);
  if (footer) {
    const foot = document.createElement('div');
    foot.className = 'note-block';
    foot.textContent = footer;
    container.appendChild(foot);
  }
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('Скопійовано у буфер.');
  });
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.style.display = 'inline-flex';
  setTimeout(() => {
    elements.toast.style.display = 'none';
  }, 2200);
}

function structuredClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validateStep(step) {
  switch (step.id) {
    case 'bot-type':
      return state.choices.botType ? { allow: true } : { allow: false, message: 'Оберіть тип бота.' };
    case 'mode':
      return state.choices.mode ? { allow: true } : { allow: false, message: 'Оберіть режим ШІ.' };
    case 'environment':
      return state.choices.environment ? { allow: true } : { allow: false, message: 'Оберіть середовище.' };
    case 'tools': {
      const requiredTools = TOOLS.filter((tool) => !tool.optional || state.choices.mode === 'codex');
      const allChecked = requiredTools.every((tool) => state.tools[tool.id]);
      return allChecked ? { allow: true } : { allow: false, message: 'Познач, що всі інструменти готові.' };
    }
    case 'backend-choice':
      return state.choices.backend ? { allow: true } : { allow: false, message: 'Оберіть тип зберігання.' };
    default:
      return { allow: true };
  }
}

function generateDevBrief() {
  const type = BOT_TYPES.find((item) => item.id === state.choices.botType);
  const commands = state.commands.join(', ');
  const backend = BACKEND_OPTIONS.find((item) => item.id === state.choices.backend);
  const mode = MODES.find((item) => item.id === state.choices.mode);
  const env = ENVIRONMENTS.find((item) => item.id === state.choices.environment);
  return [
    `Тип бота: ${type ? type.title : 'не обрано'} (${type ? type.description : '---'}).`,
    `Режим роботи: ${mode ? mode.title : 'не обрано'}.`,
    `Середовище: ${env ? env.title : 'не обрано'}.`,
    `Мова інтерфейсу: українська.`,
    `Команди: ${commands || '---'}.`,
    `Бекенд: ${backend ? backend.title : 'JSON (за замовчуванням)'}.`,
    `Канал: приватні чати (dm).`,
    '',
    'Ціль: створити робочого Telegram-бота з покроковим налаштуванням.',
    'Скопіюй цей бриф у ChatGPT або Codex, щоб отримати інструкції з коду.'
  ].join('\n');
}

function generateCodePrompt() {
  const type = BOT_TYPES.find((item) => item.id === state.choices.botType);
  const backend = BACKEND_OPTIONS.find((item) => item.id === state.choices.backend);
  const backendNote = backend ? backend.title : 'JSON (просте збереження)';
  const commands = state.commands.join(', ');
  return [
    'Ти — досвідчений Python-розробник. Побудуй Telegram-бота на aiogram v3.',
    `Тип бота: ${type ? type.title : 'базовий'} (${type ? type.description : ''}).`,
    `Команди: ${commands}.`,
    `Бекенд/зберігання: ${backendNote}.`,
    'Файли в проекті:',
    '- requirements.txt (aiogram==3.*, python-dotenv)',
    '- main.py (головний файл)',
    '- .env (TOKEN, та інші секрети)',
    'Додай логіку обробки команд, структуруй код, поясни як запустити.',
    'Використай дружні повідомлення українською.'
  ].join('\n');
}

