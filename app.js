(function () {
  const STORAGE_KEY = "ztb_state_v1";
  const THEME_STORAGE_KEY = "ztb_theme_manual";
  const NOTES_HISTORY_LIMIT = 50;

  const panel = document.getElementById("ztb-panel");
  const mainTitle = document.getElementById("ztb-title");
  const stepHeading = document.getElementById("ztb-step-heading");
  const descEl = document.getElementById("ztb-desc");
  const tagsEl = document.getElementById("ztb-tags");
  const statusEl = document.getElementById("ztb-status");
  const promptEl = document.getElementById("ztb-prompt");
  const noteEl = document.getElementById("ztb-note");
  const contentEl = document.getElementById("ztb-content");
  const sectionsEl = document.getElementById("ztb-sections");
  const searchEl = document.getElementById("ztb-search");
  const progressFill = document.getElementById("ztb-progress-fill");
  const progressText = document.getElementById("ztb-progress-text");
  const toastEl = document.getElementById("ztb-toast");
  const backdrop = document.getElementById("ztb-backdrop");

  const helpModal = document.getElementById("ztb-modal-help");
  const troublesModal = document.getElementById("ztb-modal-troubles");
  const tokenModal = document.getElementById("ztb-modal-token");
  const tourModal = document.getElementById("ztb-modal-tour");
  const tourOverlay = document.getElementById("ztb-tour-overlay");
  const tourTooltip = document.getElementById("ztb-tour-tooltip");
  const tourText = document.getElementById("tour-text");

  const quickActions = document.getElementById("ztb-quick-actions");

  const defaultState = {
    started: false,
    currentStep: 0,
    botType: "",
    mode: "",
    environment: "",
    backend: "",
    addons: { design: false, stats: false, payments: false },
    payments: { provider: "" },
    notes: {},
    ack: {},
  };

  const clone = (value) =>
    typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));

  let state = loadState();
  let uiState = {
    sectionsOpen: {},
    search: "",
    tourIndex: 0,
    tourActive: false,
    lastMilestone: 0,
  };
    tourActive: false,
    lastMilestone: 0,
  };

  const botTypes = {
    crm: {
      title: "CRM",
      desc: "Веде клієнтів і завдання",
      commands: "/start,/help,/add,/clients,/tasks,/done,/stats",
    },
    task: {
      title: "Task Manager",
      desc: "Список справ для команди",
      commands: "/start,/help,/add,/list,/done,/skip,/stats",
    },
    habit: {
      title: "Habit Tracker",
      desc: "Щоденні звички й нагадування",
      commands: "/start,/help,/add,/habits,/done,/streak,/plan,/stats",
    },
    faq: {
      title: "FAQ / Support",
      desc: "Відповідає на типові питання",
      commands: "/start,/help,/faq,/contact,/tips",
    },
    shop: {
      title: "Shop",
      desc: "Міні-магазин у Telegram",
      commands: "/start,/help,/catalog,/buy,/cart,/pay,/support",
    },
    booking: {
      title: "Booking",
      desc: "Запис на послуги",
      commands: "/start,/help,/book,/slots,/cancel,/contact",
    },
    custom: {
      title: "Custom",
      desc: "Свій сценарій",
      commands: "/start,/help",
    },
  };

  const commandDescriptions = {
    "/start": "Почати роботу",
    "/help": "Пояснення команд",
    "/add": "Додати запис",
    "/clients": "Список клієнтів",
    "/tasks": "Список задач",
    "/done": "Позначити виконане",
    "/stats": "Показати статистику",
    "/list": "Показати список",
    "/skip": "Пропустити із поясненням",
    "/habits": "Список звичок",
    "/streak": "Прогрес серії",
    "/plan": "План на тиждень",
    "/faq": "Популярні питання",
    "/contact": "Зв’язатися з людиною",
    "/tips": "Корисні підказки",
    "/catalog": "Переглянути товари",
    "/buy": "Створити замовлення",
    "/cart": "Показати кошик",
    "/pay": "Оплата",
    "/support": "Підтримка",
    "/book": "Забронювати слот",
    "/slots": "Вільні часи",
    "/cancel": "Скасувати запис",
  };

  const iconLabels = {
    guide: { label: "guide", icon: "📘" },
    file: { label: "file", icon: "📄" },
    chatgpt: { label: "chatgpt", icon: "💬" },
    cursor: { label: "cursor", icon: "💻" },
    terminal: { label: "terminal", icon: "⌨️" },
    telegram: { label: "telegram", icon: "✉️" },
    check: { label: "check", icon: "✅" },
    env: { label: "env", icon: "🛠️" },
  };

  const backendOptions = {
    json: {
      title: "JSON файл",
      desc: "Простий файл data/db.json",
      steps: [
        {
          id: "backend-json-file",
          title: "Створи data/db.json",
          desc: "Створи папку data та порожній файл db.json — це твоя база.",
          prompt:
            "Створи у проекті папку data (якщо її немає) та додай порожній файл db.json. Він зберігатиме дані бота.",
        },
        {
          id: "backend-json-code",
          title: "Додай функції читання/запису",
          desc: "Попроси ШІ додати load_json() і save_json().",
          prompt:
            "Task: add helper functions load_json_data() and save_json_data(path='data/db.json') that safely read/write JSON. Handle відсутність файлу і порожній файл.",
          id: "backend-json-wire",
          title: "Підключи команди",
          desc: "Зроби, щоб /add, /list, /done працювали з новим файлом.",
          prompt:
            "Task: update command handlers so /add writes to data/db.json, /list читає записи, а /done оновлює статус через load_json_data/save_json_data.",
          chat: "chat2",
        },
        {
          id: "backend-json-test",
          title: "Перевір /add",
          desc: "Запусти бота та переконайся, що файл оновився.",
          prompt:
            "Manual test: activate venv, run python main.py, надішли /add і перевір, що у data/db.json з'явився новий запис.",
        },
      ],
    },
    sqlite: {
      title: "SQLite",
      desc: "База у файлі db.sqlite3",
      steps: [
        {
          id: "backend-sqlite-file",
          title: "Підготуйте db.sqlite3",
          desc: "Налаштуй ініціалізацію бази при старті.",
          prompt:
            "Task: add init_db() that створює файл db.sqlite3 та таблицю tasks (id INTEGER PRIMARY KEY, name TEXT, status TEXT, created_at TIMESTAMP). Викличи при запуску.",
          chat: "chat2",
        },
        {
          id: "backend-sqlite-crud",
          title: "CRUD-функції",
          desc: "Попроси ШІ додати aiosqlite-хелпери.",
          prompt:
            "Task: implement async add_task(), list_tasks(), update_task_status() using aiosqlite з db.sqlite3.",
          chat: "chat2",
        },
        {
          id: "backend-sqlite-wire",
          title: "З'єднай команди",
          desc: "Підключи /add, /list, /done до SQLite.",
          prompt:
            "Task: update command handlers щоб використовували add_task/list_tasks/update_task_status зі SQLite.",
          chat: "chat2",
        },
        {
          id: "backend-sqlite-test",
          title: "Тест запису",
          desc: "Запусти бота, додай запис і перевір таблицю.",
          prompt:
            "Manual test: run python main.py, виконай /add, потім SELECT * FROM tasks; переконайся, що запис з'явився.",
        },
      ],
    },
    sheets: {
      title: "Google Sheets",
      desc: "Онлайн-таблиця як база",
      steps: [
        {
          id: "backend-sheets-create",
          title: "Створи таблицю",
          desc: "Створи Google Sheet та дай доступ сервісному акаунту.",
          prompt:
            "Describe how to create a Google Sheet, share it with a service account, і збережи SHEET_ID у .env.",
        },
        {
          id: "backend-sheets-code",
          title: "Підключи gspread",
          desc: "Додай код авторизації через сервісний акаунт.",
          prompt:
            "Task: integrate gspread using credentials from .env (SERVICE_ACCOUNT_JSON, SHEET_ID). Напиши helpers append_row() і fetch_rows().",
          chat: "chat2",
        },
        {
          id: "backend-sheets-test",
          title: "Тест запису",
          desc: "Надішли /add і перевір, що рядок з'явився.",
          prompt:
            "Manual test: run bot, call /add, відкрий Google Sheet і переконайся у новому рядку. Додай поради для помилок доступу.",
        },
      ],
    },
    postgres: {
      title: "Postgres (Docker)",
      desc: "Потужна база у контейнері",
      steps: [
        {
          id: "backend-postgres-compose",
          title: "docker-compose.yml",
          desc: "Попроси файл із Postgres-службою.",
          prompt:
            "Task: create docker-compose.yml з postgres:15, змінними POSTGRES_DB, USER, PASSWORD, volume для даних.",
          chat: "chat2",
        },
        {
          id: "backend-postgres-run",
          title: "Запусти контейнер",
          desc: "Поясни, як виконати docker compose up -d.",
          prompt:
            "Manual instructions: from project root run docker compose up -d, перевір docker ps, і як зупинити (docker compose down).",
        },
        {
          id: "backend-postgres-connect",
          title: "Підключення з коду",
          desc: "Додай psycopg2/asyncpg підключення.",
          prompt:
            "Task: load DATABASE_URL із .env, створити таблицю tasks, реалізувати helpers add_task/list_tasks/update_task_status через asyncpg або psycopg2.",
          chat: "chat2",
        },
        {
          id: "backend-postgres-test",
          title: "Тест запису",
          desc: "Перевір, що /add додає рядок у Postgres.",
          prompt:
            "Manual test: run bot, виконай /add, через psql зроби SELECT * FROM tasks; опиши, як виправити помилки з'єднання.",
        },
      ],
    },
  };

  const addonMicroSteps = {
    design: [
      {
        id: "addon-design-menu",
        title: "Додай Reply-меню",
        prompt:
          "Task: add reply keyboard з кнопками 📋 Завдання, 🧠 Поради, ⚙️ Налаштування. Поясни, куди вставити код.",
        chat: "chat2",
      },
      {
        id: "addon-design-inline",
        title: "Inline-кнопки",
        prompt:
          "Task: додай inline-кнопки у списку завдань: ✅ Готово, ❌ Пропустити, 📊 Статистика. Використай callback_data та edit_message_text.",
        chat: "chat2",
      },
      {
        id: "addon-design-tone",
        title: "Дружні тексти",
        prompt:
          "Task: перепиши відповіді бота у дружньому тоні з емодзі. Додай приклади для /start і /help.",
      },
    ],
    stats: [
      {
        id: "addon-stats-command",
        title: "Команда /stats",
        prompt:
          "Task: додай команду /stats, що показує прогрес за сьогодні, тиждень і загалом з емодзі.",
        chat: "chat2",
      },
      {
        id: "addon-stats-report",
        title: "Форматований звіт",
        prompt:
          "Task: побудуй текстовий звіт з відсотками та прогрес-баром у символах. Поясни формат.",
        chat: "chat2",
      },
      {
        id: "addon-stats-reminder",
        title: "Нагадування 20:00",
        prompt:
          "Task: додай щоденне нагадування о 20:00 з інформацією про прогрес. Використай asyncio.create_task або APScheduler.",
        chat: "chat2",
      },
    ],
    payments: [
      {
        id: "addon-payments-provider",
        title: "Оберіть провайдера",
        render(container, ctx) {
          const providers = [
            { key: "stripe", title: "Stripe", desc: "Картки Visa/Mastercard" },
            { key: "wayforpay", title: "WayForPay", desc: "Українські платежі" },
          ];
          const list = document.createElement("div");
          list.className = "card-grid";
          providers.forEach((provider) => {
            const card = document.createElement("button");
            card.type = "button";
            card.className = "select-card";
            card.dataset.value = provider.key;
            card.innerHTML = `<strong>${provider.title}</strong><span>${provider.desc}</span>`;
            if ((state.payments?.provider || "") === provider.key) {
              card.classList.add("active");
            }
            card.addEventListener("click", () => {
              updateState((draft) => {
                draft.payments = { provider: provider.key };
              });
              ctx.markComplete();
            });
            list.appendChild(card);
          });
          container.appendChild(list);
        },
      },
      {
        id: "addon-payments-env",
        title: "Ключі у .env",
        prompt:
          "Task: додай до .env та .env.example ключі для платежів (наприклад STRIPE_SECRET_KEY / WAYFORPAY_SECRET_KEY) та онови README.",
        chat: "chat2",
      },
      {
        id: "addon-payments-handler",
        title: "Хендлер /buy",
        prompt:
          "Task: реалізуй /buy. Для Stripe — Checkout Session з посиланням. Для WayForPay — сформуй платіжне посилання. Поясни відповіді бота.",
        chat: "chat2",
      },
      {
        id: "addon-payments-success",
        title: "Повідомлення про успіх",
        prompt:
          "Task: після успішної оплати познач користувача як premium та відправ повідомлення з емодзі.",
      },
    ],
  };

  const milestoneToasts = [
    { threshold: 15, message: "Добрий старт. Продовжуємо." },
    { threshold: 30, message: "Є прогрес. Наступний крок простий." },
    { threshold: 50, message: "Половина готова." },
    { threshold: 75, message: "Фініш близько." },
    { threshold: 100, message: "Готово. Обери апґрейд." },
  ];

  const steps = buildSteps();

  attachEventListeners();
  applyTheme();
  render();

  function buildSteps() {
    const stepList = [];

    function addStep(step) {
      stepList.push(step);
    }

    const startSection = "Етап 1 · Старт";
    addStep({
      id: "1.1",
      section: startSection,
      icon: "guide",
      title: "Привітання",
      desc: "Запускаємо майстер створення власного Telegram-бота.",
      tags: ["guide"],
      render(container, ctx) {
        renderList(container, [
          "Що робимо: запускаємо майстер створення власного Telegram-бота.",
          "Дія: натисни «Почати».",
        ]);

        renderPrimary(container, ctx.isComplete() ? "Готово" : "Почати", () => {
          updateState((draft) => {
            draft.started = true;
          });
          ctx.markComplete();
        });

        const hint = document.createElement("p");
        hint.className = "hint";
        hint.textContent = "Якщо передумаєш — завжди можна повернутися до цього кроку.";
        container.appendChild(hint);
      },
    });

    addStep({
      id: "1.2",
      section: startSection,
      icon: "guide",
      title: "Вибір типу бота",
      desc: "Оберіть, що саме хочеш зробити. Система підставить команди автоматично.",
      tags: ["guide"],
      when(state) {
        return state.started;
      },
      render(container, ctx) {
        const intro = document.createElement("p");
        intro.className = "step-note";
        intro.textContent = "Вибери сценарій нижче — команди підтягнуться в подальших промптах.";
        container.appendChild(intro);

        const grid = document.createElement("div");
        });
        container.appendChild(action);

        const hint = document.createElement("p");
        hint.className = "hint";
        hint.textContent = "Якщо передумаєш — завжди можна повернутися до цього кроку.";
        container.appendChild(hint);
      },
    });

    addStep({
      id: "1.2",
      section: startSection,
      icon: "guide",
      title: "Вибір типу бота",
      desc: "Оберіть, що саме хочеш зробити. Система підставить команди автоматично.",
      tags: ["guide"],
      when(state) {
        return state.started;
      },
      render(container, ctx) {
        const intro = document.createElement("p");
        intro.className = "step-note";
        intro.textContent = "Вибери сценарій нижче — команди підтягнуться в подальших промптах.";
        container.appendChild(intro);

        const grid = document.createElement("div");
        grid.className = "card-grid";
        Object.entries(botTypes).forEach(([key, info]) => {
          const card = document.createElement("button");
          card.type = "button";
          card.className = "select-card";
          card.dataset.value = key;
          const commands = info.commands
            .split(",")
            .map((cmd) => cmd.trim())
            .filter(Boolean)
            .join(", ");
          card.innerHTML = `<strong>${info.title}</strong><span>${info.desc}</span><span class="card-commands">${commands}</span>`;
          if (state.botType === key) card.classList.add("active");
          card.addEventListener("click", () => {
            updateState((draft) => {
              draft.botType = key;
              draft.ack["commands"] = info.commands;
            });
            ctx.markComplete();
          });
          grid.appendChild(card);
        });
        container.appendChild(grid);
        const hint = document.createElement("p");
        hint.className = "hint";
        hint.innerHTML = "<strong>Пояснення:</strong> Команда — це слово з косою рискою, яке ти пишеш боту, наприклад <code>/start</code>.";
        container.appendChild(hint);
      },
    });

    addStep({
      id: "1.3",
      section: startSection,
      icon: "guide",
      title: "Вибір режиму ШІ",
      desc: "Обери режим роботи зі штучним інтелектом.",
      tags: ["guide"],
      when(state) {
        return state.botType !== "";
      },
      render(container, ctx) {
        const list = document.createElement("ul");
        list.className = "step-options";
        list.innerHTML = `
          <li><strong>ChatGPT-only</strong> — безкоштовно, але код копіюєш вручну.</li>
          <li><strong>ChatGPT + Codex (Copilot)</strong> — швидше і чистіше, але потрібна підписка на Copilot.</li>
      desc: "Працюємо локально або в браузері через Codespaces.",
      tags: ["env"],
      when(state) {
        return state.mode !== "";
      },
      render(container, ctx) {
        const options = [
          { key: "local", title: "Local", desc: "Python + редактор на твоєму ПК." },
          { key: "codespaces", title: "Codespaces", desc: "Усе в браузері. Потрібен GitHub." },
        ];
        renderSelectionCards(container, options, state.environment, (value) => {
          updateState((draft) => {
            draft.environment = value;
          });
          ctx.markComplete();
        });
      },
    });

    addStep({
      id: "1.5",
      section: startSection,
      icon: "check",
      title: "Перевірка інструментів",
      desc: "Постав галочки, що все готово до роботи.",
      tags: ["checklist"],
      when(state) {
        return state.environment !== "";
      },
      render(container, ctx) {
        const checklist = document.createElement("div");
        checklist.className = "checklist-grid";
        [
          { key: "tools-python", label: "Python 3.10+ встановлено" },
          { key: "tools-editor", label: "Редактор (VS Code / Cursor) відкривається" },
          { key: "tools-github", label: "Є обліковий запис GitHub" },
          { key: "tools-copilot", label: "Copilot активний (якщо обрано Codex)", when: (s) => s.mode === "codex" },
        ]
          .filter((item) => (item.when ? item.when(state) : true))
          .forEach((item) => {
            const wrapper = document.createElement("label");
            wrapper.className = "check-item";
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = Boolean(state.ack[item.key]);
            checkbox.addEventListener("change", () => {
              updateState((draft) => {
                draft.ack[item.key] = checkbox.checked;
              });
              if ([...checklist.querySelectorAll("input")].every((node) => node.checked)) {
                ctx.markComplete();
              }
            });
            const span = document.createElement("span");
            span.textContent = item.label;
            wrapper.append(checkbox, span);
            checklist.appendChild(wrapper);
          });
        container.appendChild(checklist);
      },
    });

    const prepSection = "Етап 2 · Підготовка";
    addStep({
      id: "2.1",
      section: prepSection,
      icon: "file",
      title: "Створи папку проєкту",
      desc: "Папка mybot у зручному місці.",
      tags: ["guide"],
      render(container, ctx) {
        renderList(container, [
          "Створи папку mybot (можна інша назва).",
          "Відкрий її у VS Code або Cursor.",
          "Якщо працюєш у Codespaces — створимо папку через інтерфейс GitHub.",
        ]);
      },
    });

    addStep({
      id: "2.2",
      section: prepSection,
      icon: "file",
      title: "requirements.txt",
      desc: "Додай бібліотеки.",
      tags: ["file"],
      prompt: "aiogram==3.*\npython-dotenv",
      render(container) {
        renderList(container, [
          "Створи файл requirements.txt.",
          "Скопіюй вміст та збережи.",
        ]);
        const pre = document.createElement("pre");
        pre.className = "code-block";
        pre.textContent = "aiogram==3.*\npython-dotenv";
        container.appendChild(pre);
      },
    });

    addStep({
      id: "2.3",
      section: prepSection,
      icon: "file",
      title: "main.py",
      desc: "Створи порожній файл — код вставимо згодом.",
      tags: ["file"],
      render(container, ctx) {
        renderList(container, [
          "Створи файл main.py у корені проєкту.",
          "Поки що залиш порожнім — після промпта вставимо код.",
        ]);
      },
    });

    addStep({
      id: "2.4",
      section: prepSection,
      icon: "file",
      title: ".env",
      desc: "Підготуємо місце для токена.",
      tags: ["file"],
      prompt: "TOKEN=сюди_вставиш_токен",
      render(container) {
        renderList(container, [
          "Створи файл .env у корені.",
          "Додай рядок TOKEN=... (без лапок).",
          "Збережи файл. Не коміть у відкритий репозиторій.",
        ]);
        const pre = document.createElement("pre");
        pre.className = "code-block";
        pre.textContent = "TOKEN=сюди_вставиш_токен";
        container.appendChild(pre);
      },
    });

    addStep({
      id: "2.5",
      section: prepSection,
      icon: "chatgpt",
      title: "DEV BRIEF",
      desc: "Короткий опис проєкту англійською.",
      tags: ["chat1"],
      promptProvider(ctx) {
        return makeDevBrief(state);
      },
      render(container) {
        const paragraph = document.createElement("p");
        paragraph.textContent = "Натисни кнопку нижче — текст з’явиться у блоці Промпт. Скопіюй його в ChatGPT.";
        container.appendChild(paragraph);
        const btn = document.createElement("button");
        btn.className = "btn";
        btn.type = "button";
        btn.textContent = "Скопіювати DEV BRIEF";
        btn.addEventListener("click", () => {
          navigator.clipboard.writeText(makeDevBrief(state)).then(() => showToast("DEV BRIEF скопійовано"));
        });
        container.appendChild(btn);
      },
    });

    addStep({
      id: "2.6",
      section: prepSection,
      icon: "chatgpt",
      title: "Промпт для коду",
      desc: "Запроси код у ChatGPT або Codex.",
      tags: ["chat1", "chat2"],
      promptProvider(ctx) {
        return makeCodexPrompt(state);
      },
      render(container) {
        renderList(container, [
          "Скопіюй промпт. Якщо користуєшся ChatGPT — встав у Чат 1.",
          "Отриманий код повністю встав у main.py.",
          "Переконайся, що файл збережено.",
        ]);
        const buttonRow = document.createElement("div");
        buttonRow.className = "prompt-buttons";
        const chatBtn = document.createElement("button");
        chatBtn.className = "btn";
        chatBtn.textContent = "Copy for ChatGPT";
        chatBtn.type = "button";
        chatBtn.addEventListener("click", () => {
          navigator.clipboard.writeText(makeDevBrief(state)).then(() => showToast("Контекст для ChatGPT скопійовано"));
        });
        const codexBtn = document.createElement("button");
        codexBtn.className = "btn primary";
        codexBtn.textContent = "Copy for Codex";
        codexBtn.type = "button";
        codexBtn.addEventListener("click", () => {
          navigator.clipboard.writeText(makeCodexPrompt(state)).then(() => showToast("Промпт для Codex скопійовано"));
        });
        buttonRow.append(chatBtn, codexBtn);
        container.appendChild(buttonRow);
      },
    });

    const backendSection = "Етап 3 · Бекенд";
    addStep({
      id: "3.1",
      section: backendSection,
      icon: "guide",
      title: "Вибір зберігання",
      desc: "Виріши, де будуть дані.",
      tags: ["guide"],
      render(container, ctx) {
        const grid = document.createElement("div");
        grid.className = "card-grid";
        Object.entries(backendOptions).forEach(([key, option]) => {
          const card = document.createElement("button");
          card.className = "select-card";
          card.type = "button";
          if (state.backend === key) card.classList.add("active");
          card.dataset.value = key;
          card.innerHTML = `<strong>${option.title}</strong><span>${option.desc}</span>`;
          card.addEventListener("click", () => {
            updateState((draft) => {
              draft.backend = key;
            });
            ctx.markComplete();
          });
          grid.appendChild(card);
        });
        container.appendChild(grid);
      },
    });

    Object.entries(backendOptions).forEach(([key, option]) => {
      option.steps.forEach((subStep, index) => {
        addStep({
          id: `3.${index + 2}-${subStep.id}`,
          section: backendSection,
          icon: subStep.chat === "chat2" ? "cursor" : "guide",
          title: subStep.title,
          desc: subStep.desc,
          tags: subStep.chat === "chat2" ? ["chat2"] : ["guide"],
          prompt: subStep.prompt,
          when(state) {
            return state.backend === key;
          },
          render(container, ctx) {
            if (subStep.render) {
              subStep.render(container, ctx);
            } else {
              renderList(container, [subStep.desc]);
            }
          },
        });
      });
    });

    const addonsSection = "Етап 4 · Доповнення";
    addStep({
      id: "4.1",
      section: addonsSection,
      icon: "guide",
      title: "Обери додаткові модулі",
      desc: "Можна увімкнути дизайн, статистику, оплати.",
      tags: ["guide"],
      render(container, ctx) {
        const toggles = [
          { key: "design", label: "Дизайн", desc: "Кнопки та красиві тексти" },
          { key: "stats", label: "Статистика", desc: "Команда /stats та звіти" },
          { key: "payments", label: "Оплати", desc: "Stripe або WayForPay" },
        ];
        const grid = document.createElement("div");
        grid.className = "toggle-grid";
        toggles.forEach((toggle) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "toggle-card";
          if (state.addons?.[toggle.key]) button.classList.add("active");
          button.innerHTML = `<strong>${toggle.label}</strong><span>${toggle.desc}</span>`;
          button.addEventListener("click", () => {
            updateState((draft) => {
              draft.addons[toggle.key] = !draft.addons[toggle.key];
              if (!draft.addons[toggle.key]) {
                if (toggle.key === "payments") {
                  draft.payments.provider = "";
                }
                Object.keys(draft.ack).forEach((ackKey) => {
                  if (ackKey.startsWith(`addon-${toggle.key}`)) delete draft.ack[ackKey];
                });
              }
            });
          });
          grid.appendChild(button);
        });
        container.appendChild(grid);
      },
    });

    Object.entries(addonMicroSteps).forEach(([addonKey, stepsList]) => {
      stepsList.forEach((subStep, index) => {
        addStep({
          id: `4.${index + 2}-${subStep.id}`,
          section: addonsSection,
          icon: subStep.chat === "chat2" ? "cursor" : "guide",
          title: subStep.title,
          desc: "Виконай дію та постав галочку, коли готово.",
          tags: subStep.chat === "chat2" ? ["chat2"] : ["guide"],
          prompt: subStep.prompt,
          when(state) {
            if (!state.addons?.[addonKey]) return false;
            if (addonKey === "payments" && index > 0 && !state.payments?.provider) {
              return false;
            }
            return true;
          },
          render(container, ctx) {
            if (subStep.render) {
              subStep.render(container, ctx);
            } else {
              renderList(container, [subStep.prompt ? "Скопіюй промпт і виконай крок." : subStep.title]);
            }
          },
        });
      });
    });

    const launchSection = "Етап 5 · Запуск і перевірка";
    addStep({
      id: "5.1",
      section: launchSection,
      icon: "telegram",
      title: "Отримай токен у BotFather",
      desc: "Створи бота та скопіюй TOKEN у .env.",
      tags: ["telegram"],
      render(container) {
        renderList(container, [
          "Відкрий @BotFather та натисни /newbot.",
          "Вигадай назву й отримаєш токен.",
          "Натисни кнопку нижче, щоб скопіювати шаблон .env і вставити TOKEN.",
        ]);
        const actions = document.createElement("div");
        actions.className = "prompt-buttons";
        const open = document.createElement("button");
        open.className = "btn";
        open.textContent = "Відкрити BotFather";
        open.type = "button";
        open.addEventListener("click", () => window.open("https://t.me/BotFather", "_blank", "noopener"));
        const copy = document.createElement("button");
        copy.className = "btn";
        copy.type = "button";
        copy.textContent = "Скопіювати шаблон .env";
        copy.addEventListener("click", () => {
          navigator.clipboard
            .writeText("TOKEN=сюди_вставиш_токен")
            .then(() => showToast("Шаблон скопійовано"));
        });
        actions.append(open, copy);
        container.appendChild(actions);
      },
    });

    addStep({
      id: "5.2",
      section: launchSection,
      icon: "telegram",
      title: "Додай команди у BotFather",
      desc: "Скопіюй список команд і додай через /setcommands.",
      tags: ["telegram"],
      promptProvider() {
        return makeCommandBlock(state);
      },
      render(container) {
        renderList(container, [
          "У BotFather напиши /setcommands та обери свого бота.",
          "Встав список команд нижче.",
          "Після відповіді BotFather закрий діалог і повернись сюди.",
        ]);
        const pre = document.createElement("pre");
        pre.className = "code-block";
        pre.textContent = makeCommandBlock(state);
        container.appendChild(pre);
      },
    });

    addStep({
      id: "5.3",
      section: launchSection,
      icon: "terminal",
      title: "Запуск бота",
      desc: "Скопіюй команди та виконай послідовно.",
      tags: ["terminal"],
      render(container) {
        const commands = buildLaunchCommands(state.environment || "local");
        renderList(container, [
          "Відкрий термінал у корені проєкту.",
          "Виконай команди по черзі.",
          "Якщо виникла помилка — натисни «Проблема?».",
        ]);
        const pre = document.createElement("pre");
        pre.className = "code-block";
        pre.textContent = commands.join("\n");
        container.appendChild(pre);
        promptEl.dataset.launch = commands.join("\n");
      },
      promptProvider() {
        return buildLaunchCommands(state.environment || "local").join("\n");
      },
    });

    addStep({
      id: "5.4",
      section: launchSection,
      icon: "check",
      title: "Перевірка в Telegram",
      desc: "Пройди чекліст.",
      tags: ["guide"],
      render(container) {
        const command = getPrimaryCommand();
        renderList(container, [
          "Відкрий свого бота у Telegram.",
          "Напиши /start — має прийти вітання.",
          "Напиши /help — побачиш коротку інструкцію.",
          `Виконай ${command} — переконайся, що команда працює.`,
        ]);
      },
    });

    addStep({
      id: "5.5",
      section: launchSection,
      icon: "guide",
      title: "Резервна копія",
      desc: "Збережи проєкт у безпечному місці.",
      tags: ["guide"],
      render(container) {
        renderList(container, [
          "Скопіюй папку проєкту у хмару або приватний GitHub репозиторій.",
          "Перевір, що після перезапуску бота все працює.",
        ]);
      },
    });

    const finishSection = "Етап 6 · Фініш";
    addStep({
      id: "6.1",
      section: finishSection,
      icon: "guide",
      title: "Готово!",
      desc: "Можеш створити нового бота або покращити поточного.",
      tags: ["guide"],
      render(container) {
        const paragraph = document.createElement("p");
        paragraph.textContent = "Вітаю! Бот готовий. Обери, що робимо далі.";
        container.appendChild(paragraph);

        const actions = document.createElement("div");
        actions.className = "finish-actions";

        const resetBtn = document.createElement("button");
        resetBtn.className = "btn";
        resetBtn.textContent = "Створити нового бота";
        resetBtn.addEventListener("click", () => {
          localStorage.removeItem(STORAGE_KEY);
          state = clone(defaultState);
          render();
        });

        const addonsBtn = document.createElement("button");
        addonsBtn.className = "btn primary";
        addonsBtn.textContent = "Покращити поточного";
        addonsBtn.addEventListener("click", () => {
          const index = visibleSteps().findIndex((step) => step.section === addonsSection);
          if (index >= 0) {
            setStep(index);
          }
        });

        actions.append(resetBtn, addonsBtn);
        container.appendChild(actions);
      },
    });

    return stepList;
  }

  function visibleSteps() {
    return steps.filter((step) => {
      if (typeof step.when === "function") {
        return step.when(state);
      }
      return true;
    });
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved) return clone(defaultState);
      return Object.assign(clone(defaultState), saved);
    } catch (error) {
      console.error("State load error", error);
      return clone(defaultState);
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function updateState(mutator) {
    const draft = clone(state);
    mutator(draft);
    state = draft;
    saveState();
    render();
  }

  function setStep(index) {
    const list = visibleSteps();
    const clamped = Math.max(0, Math.min(index, list.length - 1));
    updateState((draft) => {
      draft.currentStep = clamped;
    });
  }

  function getActiveStep() {
    const list = visibleSteps();
    if (!list.length) {
      return { step: null, index: 0, list };
    }
    const index = Math.max(0, Math.min(state.currentStep || 0, list.length - 1));
    return { step: list[index], index, list };
  }

  function markComplete(stepId) {
    updateState((draft) => {
      draft.ack[stepId] = true;
    });
  }

  function attachEventListeners() {
    document.getElementById("ztb-copy").addEventListener("click", () => {
      const { step } = getActiveStep();
      if (!step) {
        showToast("Кроки недоступні. Натисни «Скинути».");
        return;
      }
      const text = resolvePrompt(step);
      if (!text) {
        showToast("Немає тексту для копіювання");
        return;
      }
      navigator.clipboard.writeText(text).then(() => showToast("Скопійовано"));
    });

    document.getElementById("ztb-open").addEventListener("click", () => {
      const { step } = getActiveStep();
      if (!step) {
        showToast("Кроки недоступні. Натисни «Скинути».");
        return;
      }
      if (step && step.link) {
        window.open(step.link, "_blank", "noopener");
      } else {
        showToast("Немає посилання");
      }
    });

    document.getElementById("ztb-done").addEventListener("click", () => {
      const { step, index, list } = getActiveStep();
      if (!step) {
        showToast("Натисни «Скинути», щоб відновити маршрут.");
        return;
      }
      markComplete(step.id);
      if (index < list.length - 1) {
        setStep(index + 1);
      }
    });

    document.getElementById("ztb-problem").addEventListener("click", () => {
      openModal(troublesModal);
    });

    document.getElementById("ztb-help").addEventListener("click", () => openModal(helpModal));
    document.getElementById("ztb-troubles").addEventListener("click", () => openModal(troublesModal));
    document.getElementById("ztb-guide").addEventListener("click", startTour);
    document.getElementById("ztb-reset").addEventListener("click", () => {
      if (confirm("Скинути прогрес?")) {
        localStorage.removeItem(STORAGE_KEY);
        state = clone(defaultState);
        saveState();
        render();
      }
    });

    document.getElementById("toggle-theme").addEventListener("click", toggleTheme);
    document.getElementById("ztb-toggle").addEventListener("click", toggleSections);

    noteEl.addEventListener("input", () => {
      const { step } = getActiveStep();
      if (!step) return;
      updateState((draft) => {
        draft.notes[step.id] = noteEl.value;
      });
    });

    searchEl.addEventListener("input", () => {
      uiState.search = searchEl.value.toLowerCase();
      renderSidebar();
    });

    document.addEventListener("click", (event) => {
      if (event.target.matches("[data-close-modal]")) {
        closeModals();
      }

      if (event.target.matches(".quick-action")) {
        const link = event.target.dataset.link;
        if (link) window.open(link, "_blank", "noopener");
      }

      if (event.target.dataset.logChat !== undefined) {
        copyNavigatorLog();
      }

      if (event.target.dataset.openToken !== undefined) {
        openModal(tokenModal);
      }
    });

    document.getElementById("ztb-copy-env").addEventListener("click", () => {
      navigator.clipboard
        .writeText("TOKEN=тут_токен\nSTRIPE_SECRET_KEY=... (якщо треба)")
        .then(() => showToast("Шаблон .env скопійовано"));
    });

    document.getElementById("ztb-copy-problem").addEventListener("click", () => {
      const textArea = document.getElementById("ztb-problem-text");
      const context = buildProblemContext(textArea.value);
      navigator.clipboard.writeText(context).then(() => showToast("Запит скопійовано"));
    });

    backdrop.addEventListener("click", closeModals);

    document.getElementById("tour-next").addEventListener("click", () => advanceTour(1));
    document.getElementById("tour-prev").addEventListener("click", () => advanceTour(-1));
    document.getElementById("tour-skip").addEventListener("click", endTour);
    tourOverlay.addEventListener("click", endTour);

    troublesModal.querySelectorAll(".tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        troublesModal
          .querySelectorAll(".tab")
          .forEach((node) => node.classList.toggle("active", node === tab));
        troublesModal
          .querySelectorAll(".tab-panel")
          .forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === tab.dataset.tab));
      });
    });

    document.addEventListener("keydown", (event) => {
      if (uiState.tourActive && event.key === "Escape") {
        endTour();
      }
    });
  }

  function resolvePrompt(step) {
    if (!step) return "";
    if (typeof step.promptProvider === "function") {
      return step.promptProvider();
    }
    return step.prompt || "";
  }

  function render() {
    const { step, index, list } = getActiveStep();

    if (!step) {
      stepHeading.textContent = "Крок 0.0 · Онови панель";
      mainTitle.textContent = "Немає доступних кроків";
      descEl.textContent = "Скинь прогрес або перезавантаж сторінку.";
      promptEl.textContent = "";
      promptEl.classList.add("empty");
      tagsEl.innerHTML = "";
      contentEl.innerHTML = "";
      const message = document.createElement("p");
      message.className = "hint";
      message.textContent = "Онови сторінку або скористайся кнопкою «Скинути», щоб відновити маршрут.";
      contentEl.appendChild(message);
      noteEl.value = "";
      noteEl.disabled = true;
      renderSidebar(list, index);
      updateProgress(list);
      statusEl.textContent = "";
      return;
    }

    const prompt = resolvePrompt(step);

    stepHeading.textContent = `Крок ${step.id} · ${step.title}`;
    mainTitle.textContent = step.title;
    descEl.textContent = step.desc || "";
    promptEl.textContent = prompt || "";
    promptEl.classList.toggle("empty", !prompt);

    const note = state.notes?.[step.id] || "";
    noteEl.disabled = false;
    noteEl.value = note;

    renderTags(step);
    renderContent(step);
    renderSidebar(list, index);
    updateProgress(list);
    updateMilestone();

    const quickButtons = quickActions.querySelectorAll(".quick-action");
    quickButtons.forEach((btn) => btn.classList.toggle("highlight", false));

    const isDone = Boolean(state.ack?.[step.id]);
    statusEl.textContent = isDone ? "✅ Крок виконано" : "";
  }

  function renderTags(step) {
    if (!step) {
      tagsEl.innerHTML = "";
      return;
    }
    tagsEl.innerHTML = "";
    const baseTags = step.tags || [];
    baseTags.forEach((tag) => {
      const span = document.createElement("span");
      span.className = `tag tag--${tag}`;
      span.textContent = tag.toUpperCase();
      if (tag === "chat1") span.textContent = "CHAT 1 · Навігатор";
      if (tag === "chat2") span.textContent = "CHAT 2 · Cursor";
      tagsEl.appendChild(span);
    });
    if (step.tags?.includes("chat1")) {
      const chatBtn = quickActions.querySelector('[data-link="https://chat.openai.com/"]');
      chatBtn && chatBtn.classList.add("highlight");
    }
    if (step.tags?.includes("chat2")) {
      const cursorBtn = quickActions.querySelector('[data-link="https://cursor.sh/"]');
      cursorBtn && cursorBtn.classList.add("highlight");
    }
  }

  function renderContent(step) {
    contentEl.innerHTML = "";
    if (!step) {
      return;
    }
    if (typeof step.render === "function") {
      step.render(contentEl, {
        markComplete: () => markComplete(step.id),
        isComplete: () => Boolean(state.ack?.[step.id]),
      });
    }
  }

  function renderList(container, items) {
    const list = document.createElement("ol");
    list.className = "instructions-list";
    items.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      list.appendChild(li);
    });
    container.appendChild(list);
    return list;
  }

  function renderPrimary(container, label, onClick) {
    const button = document.createElement("button");
    button.className = "btn primary";
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", onClick);
    container.appendChild(button);
  }

  function renderSelectionCards(container, options, selected, onSelect) {
    const grid = document.createElement("div");
    grid.className = "card-grid";
    options.forEach((option) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "select-card";
      if (selected === option.key) card.classList.add("active");
      card.dataset.value = option.key;
      card.innerHTML = `<strong>${option.title}</strong><span>${option.desc}</span>`;
      card.addEventListener("click", () => {
        onSelect(option.key);
      });
      grid.appendChild(card);
    });
    container.appendChild(grid);
  }

  function renderSidebar(list = visibleSteps(), activeIndex = state.currentStep || 0) {
    sectionsEl.innerHTML = "";
    const search = uiState.search;
    const grouped = {};
    list.forEach((step, index) => {
      if (search && !(`${step.id} ${step.title}`.toLowerCase().includes(search))) {
        return;
      }
      if (!grouped[step.section]) {
        grouped[step.section] = [];
      }
      grouped[step.section].push({ step, index });
    });

    Object.entries(grouped).forEach(([sectionTitle, steps]) => {
      const section = document.createElement("div");
      section.className = "sidebar-section";
      const header = document.createElement("div");
      header.className = "sidebar-section__header";
      if (!(sectionTitle in uiState.sectionsOpen)) {
        uiState.sectionsOpen[sectionTitle] = true;
      }
      const open = uiState.sectionsOpen[sectionTitle];
      header.textContent = sectionTitle;
      header.addEventListener("click", () => {
        uiState.sectionsOpen[sectionTitle] = !(uiState.sectionsOpen[sectionTitle] ?? true);
        renderSidebar(list, activeIndex);
      });
      section.appendChild(header);
      if (open) {
        const stepsContainer = document.createElement("div");
        stepsContainer.className = "sidebar-steps";
        steps.forEach(({ step, index }) => {
          const item = document.createElement("div");
          item.className = "sidebar-step";
          if (index === activeIndex) item.classList.add("active");
          if (state.ack?.[step.id]) item.classList.add("done");
          item.addEventListener("click", () => setStep(index));

          const indexSpan = document.createElement("div");
          indexSpan.className = "sidebar-step__index";
          indexSpan.textContent = state.ack?.[step.id] ? "✓" : step.id;

          const body = document.createElement("div");
          body.className = "sidebar-step__title";
          body.textContent = step.title;

          const meta = document.createElement("div");
          meta.className = "sidebar-step__meta";
          const icon = iconLabels[step.icon]?.icon || "➡️";
          meta.textContent = icon;

          item.append(indexSpan, body, meta);
          stepsContainer.appendChild(item);
        });
        section.appendChild(stepsContainer);
      }
      sectionsEl.appendChild(section);
    });

    if (!Object.keys(grouped).length) {
      const empty = document.createElement("p");
      empty.className = "sidebar-empty";
      empty.textContent = "Кроки не знайдено. Натисни «Скинути», щоб почати заново.";
      sectionsEl.appendChild(empty);
    }
  }

  function updateProgress(list) {
    const total = list.length;
    const completed = list.filter((step) => state.ack?.[step.id]).length;
    const percent = total ? Math.round((completed / total) * 100) : 0;
    progressFill.style.width = `${percent}%`;
    progressText.textContent = `${percent}% виконано`;
    progressFill.parentElement.setAttribute("aria-valuenow", String(percent));
    uiState.progress = percent;
  }

  function updateMilestone() {
    const percent = uiState.progress || 0;
    for (const milestone of milestoneToasts) {
      if (percent >= milestone.threshold && uiState.lastMilestone < milestone.threshold) {
        uiState.lastMilestone = milestone.threshold;
        showToast(milestone.message);
        break;
      }
    }
  }

  function openModal(modal) {
    closeModals();
    modal.classList.add("open");
    backdrop.classList.add("visible");
  }

  function closeModals() {
    document.querySelectorAll(".modal.open").forEach((modal) => modal.classList.remove("open"));
    backdrop.classList.remove("visible");
    endTour();
  }

  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add("show");
    setTimeout(() => toastEl.classList.remove("show"), 2000);
  }

  function toggleTheme() {
    const next = panel.dataset.theme === "dark" ? "light" : "dark";
    panel.dataset.theme = next;
    document.body.dataset.theme = next;
    localStorage.setItem(THEME_STORAGE_KEY, next);
  }

  function applyTheme() {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    let theme = stored;
    if (!theme || theme === "auto") {
      theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    panel.dataset.theme = theme;
    document.body.dataset.theme = theme;
  }

  function toggleSections() {
    const openAll = Object.values(uiState.sectionsOpen).some((v) => !v);
    const value = openAll ? true : false;
    Object.keys(uiState.sectionsOpen).forEach((key) => (uiState.sectionsOpen[key] = value));
    renderSidebar();
  }

  function buildProblemContext(extra) {
    const { step } = getActiveStep();
    const notes = Object.values(state.notes || {});
    const tail = notes
      .map((note) => note.trim())
      .filter(Boolean)
      .slice(-NOTES_HISTORY_LIMIT)
      .join("\n---\n");
    const stepLine = step ? `Крок: ${step.id} · ${step.title}` : "Крок: недоступний (скинь прогрес)";

    return [
      "Привіт! Працюю через Zero-to-Bot Panel.",
      stepLine,
      extra ? `Опис користувача: ${extra}` : "",
      tail ? `Останні нотатки/логи:\n${tail}` : "",
      "Допоможи коротко: що робити далі крок за кроком?",
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  function copyNavigatorLog() {
    const context = buildProblemContext("Проблема: бот не запускається");
    navigator.clipboard.writeText(context).then(() => showToast("Контекст скопійовано"));
  }

  function buildLaunchCommands(environment) {
    const commands = ["python --version"];
    if (environment === "codespaces") {
      commands.push("python -m venv .venv", "source .venv/bin/activate");
    } else {
      commands.push("python -m venv .venv", "source .venv/bin/activate # Windows: .\\\\.venv\\\\Scripts\\\\activate");
    }
    commands.push("pip install -r requirements.txt", "python main.py");
    return commands;
  }

  function getPrimaryCommand() {
    const type = botTypes[state.botType] || botTypes.custom;
    const commands = (type.commands || "").split(",").map((item) => item.trim());
    const custom = commands.find((command) => !["/start", "/help"].includes(command));
    return custom || "/add";
  }

  function makeCommandBlock(currentState) {
    const type = botTypes[currentState.botType] || botTypes.custom;
    const commands = (type.commands || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    return commands
      .map((command) => `${command} - ${commandDescriptions[command] || "Додаткова команда"}`)
      .join("\n");
  }

  function describeBackend(currentState) {
    const key = currentState.backend || "json";
    switch (key) {
      case "sqlite":
        return "Persistent storage via SQLite database file db.sqlite3.";
      case "sheets":
        return "Records stored inside a shared Google Sheet via gspread.";
      case "postgres":
        return "PostgreSQL database running via docker-compose for teamwork.";
      default:
        return "Default storage is a JSON file located at data/db.json.";
    }
  }

  function makeDevBrief(currentState) {
    const type = botTypes[currentState.botType] || botTypes.custom;
    const commands = (type.commands || "").split(",").map((item) => item.trim()).filter(Boolean);
    const purposeMap = {
      crm: "Help a business track clients, tasks, and follow-ups in Telegram.",
      task: "Organise personal or team tasks with reminders and progress.",
      habit: "Coach users through daily habits with streaks and friendly nudges.",
      faq: "Answer frequent questions and route users to a human helper when needed.",
      shop: "Showcase a catalogue and accept orders with basic checkout.",
      booking: "Let clients browse free slots and manage appointments.",
      custom: "Build a bespoke helper tailored to the user’s idea.",
    };
    const purpose = purposeMap[currentState.botType] || purposeMap.custom;
    const tone = currentState.botType === "faq" || currentState.botType === "booking" ? "Professional and clear" : "Friendly and encouraging";
    const channel = currentState.botType === "faq" ? "Works in both private chats and groups" : "Works in private chats";
    const storage = describeBackend(currentState);

    return [
      `Project type: ${type.title} Telegram bot.`,
      `Purpose: ${purpose}`,
      commands.length ? `Planned commands: ${commands.join(", ")}.` : "",
      `Tone: ${tone}.`,
      `Channel: ${channel}.`,
      storage,
    ]
      .filter(Boolean)
      .join("\n");
  }

  function makeCodexPrompt(currentState) {
    const brief = makeDevBrief(currentState);
    const commands = (botTypes[currentState.botType]?.commands || botTypes.custom.commands)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const environment =
      currentState.environment === "codespaces"
        ? "Target environment: GitHub Codespaces (Linux, Python 3.10)."
        : "Target environment: Local machine with Python 3.10.";

    const repoStructure = [
      "README.md",
      "src/main.py",
      "src/handlers/__init__.py",
      "src/handlers/basic.py",
      "src/storage/__init__.py",
      "src/storage/engine.py",
      "src/config.py",
      ".env.example",
      "requirements.txt",
    ];

    const storage = describeBackend(currentState);

    return [
      "You are Copilot/Codex helping scaffold an aiogram v3 Telegram bot.",
      environment,
      "Use python-dotenv to read TOKEN from .env and handle missing values gracefully.",
      "\nProject brief:",
      brief,
      "\nCommands to implement:",
      commands.join(", "),
      "\nRepository structure:",
      ...repoStructure.map((entry) => `- ${entry}`),
      "\nKey tasks:",
      "1. Build src/main.py with aiogram bot, routers, and logging.",
      "2. Ensure .env.example lists TOKEN and any extra secrets.",
      `3. Storage layer: ${storage}`,
      "4. Generate README.md with setup (venv, pip install, python main.py).",
      "5. Provide clear explanations if additional steps are required.",
    ].join("\n");
  }

  function startTour() {
    uiState.tourActive = true;
    uiState.tourIndex = 0;
    tourOverlay.style.display = "block";
    tourTooltip.classList.add("show");
    showTourStep();
  }

  function showTourStep() {
    const steps = [
      { element: "#ztb-sidebar", text: "Сайдбар — тут усі етапи. Можна повертатися у будь-який крок." },
      { element: ".step-card", text: "Центр — інструкція поточного кроку. Дій за підказками." },
      { element: ".step-actions", text: "Кнопки: копіювати, відкрити посилання та відмітити «Виконано»." },
      { element: ".progress-wrapper", text: "Прогрес показує, скільки вже зроблено." },
      { element: "#ztb-help", text: "Траблшутінг та довідка допоможуть, якщо щось пішло не так." },
    ];
    const step = steps[uiState.tourIndex];
    document.querySelectorAll(".highlighted").forEach((node) => node.classList.remove("highlighted"));
    const target = document.querySelector(step.element);
    if (target) target.classList.add("highlighted");
    tourText.textContent = step.text;
    document.getElementById("tour-prev").disabled = uiState.tourIndex === 0;
    document.getElementById("tour-next").textContent = uiState.tourIndex === steps.length - 1 ? "Завершити" : "Далі";
  }

  function advanceTour(direction) {
    const stepsCount = 5;
    uiState.tourIndex += direction;
    if (uiState.tourIndex >= stepsCount) {
      endTour();
      return;
    }
    if (uiState.tourIndex < 0) uiState.tourIndex = 0;
    showTourStep();
  }

  function endTour() {
    uiState.tourActive = false;
    tourOverlay.style.display = "none";
    tourTooltip.classList.remove("show");
    document.querySelectorAll(".highlighted").forEach((node) => node.classList.remove("highlighted"));
  }

  window.ZeroToBot = {
    getState: () => clone(state),
    setStep,
    render,
    makeDevBrief,
    makeCodexPrompt,
  };
})();
