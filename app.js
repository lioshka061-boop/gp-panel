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
  const copyButton = document.getElementById("ztb-copy");
  const openButton = document.getElementById("ztb-open");
  const problemButton = document.getElementById("ztb-problem");

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
          chat: "chat2",
        },
        {
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
            "Task: add init_db() that створює файл db.sqlite3 та таблицю tasks (id INTEGER PRIMARY KEY, name TEXT, status TEXT,created_at TIMESTAMP). Викличи при запуску.",
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
          title: "Перевір /add",
          desc: "Запусти бота і переконайся, що запис додається.",
          prompt:
            "Manual test: activate venv, run python main.py, надішли /add і перевір, що у базі з'явився запис.",
        },
      ],
    },
    googlesheets: {
      title: "Google Sheets",
      desc: "Онлайн-таблиця як база",
      steps: [
        {
          id: "backend-sheets-file",
          title: "Підготуйте таблицю",
          desc: "Створи Google Sheet та дай доступ за посиланням.",
          prompt:
            "Task: створити Google Sheet для бота. Надішли посилання з доступом для редагування.",
        },
        {
          id: "backend-sheets-api",
          title: "Налаштуй gspread",
          desc: "Додай ключі та підключення через gspread.",
          prompt:
            "Task: додай gspread та google-auth. У .env збережи JSON ключ у змінній GOOGLE_SERVICE_ACCOUNT. Підключися до таблиці.",
          chat: "chat2",
        },
        {
          id: "backend-sheets-wire",
          title: "Підключи команди",
          desc: "Запис/читання даних у таблицю.",
          prompt:
            "Task: онови хендлери /add, /list, /done щоб працювали через gspread з Google Sheets.",
          chat: "chat2",
        },
        {
          id: "backend-sheets-test",
          title: "Перевір /add",
          desc: "Додай запис і переконайся, що з'явився рядок у таблиці.",
          prompt:
            "Manual test: надішли /add, перевір що в Google Sheets додався рядок.",
        },
      ],
    },
    postgres: {
      title: "Postgres (Docker)",
      desc: "Потужна база для команди",
      steps: [
        {
          id: "backend-postgres-docker",
          title: "Docker Compose",
          desc: "Підготуй docker-compose.yml з Postgres.",
          prompt:
            "Task: створи docker-compose.yml з Postgres 15, user=bot, password=botpass, db=botdb. Порт 5432.",
        },
        {
          id: "backend-postgres-up",
          title: "Запуск контейнера",
          desc: "Запусти docker compose up -d.",
          prompt: "Command: docker compose up -d",
        },
        {
          id: "backend-postgres-deps",
          title: "Додай залежності",
          desc: "Встанови psycopg2-binary.",
          prompt: "Command: pip install psycopg2-binary",
        },
        {
          id: "backend-postgres-code",
          title: "Підключися до бази",
          desc: "Налаштуй схему та CRUD.",
          prompt:
            "Task: додай PostgresRepository (async) з методами add_task, list_tasks, complete_task. Використай asyncpg.",
          chat: "chat2",
        },
        {
          id: "backend-postgres-test",
          title: "Перевір /add",
          desc: "Переконайся, що запис потрапляє у базу.",
          prompt:
            "Manual test: надішли /add, перевір SELECT * FROM tasks;",
        },
      ],
    },
  };

  const addonOptions = {
    design: {
      title: "Дизайн",
      desc: "Головне меню, кнопки, тексти з емодзі",
      steps: [
        {
          id: "addon-design-menu",
          title: "Додай головне меню",
          prompt: "Task: додай ReplyKeyboardMarkup з кнопками 📋 Завдання, 🧠 Поради, ⚙️ Налаштування.",
        },
        {
          id: "addon-design-inline",
          title: "Inline-кнопки",
          prompt:
            "Task: на сторінці 'Завдання' додай inline-кнопки [✅ Готово] [❌ Пропустити] [📊 Статистика].",
        },
        {
          id: "addon-design-copy",
          title: "Дружні тексти",
          prompt:
            "Task: онови відповіді бота з емодзі та підбадьорюючими фразами.",
        },
      ],
    },
    stats: {
      title: "Статистика",
      desc: "Команда /stats та щоденний звіт",
      steps: [
        {
          id: "addon-stats-command",
          title: "Команда /stats",
          prompt:
            "Task: додай команду /stats. Показуй статистику за день, тиждень, всього.",
          chat: "chat2",
        },
        {
          id: "addon-stats-report",
          title: "Красивий звіт",
          prompt:
            "Task: онови /stats, щоб показував прогрес з емодзі та відсотками.",
        },
        {
          id: "addon-stats-reminder",
          title: "Нагадування",
          prompt:
            "Task: додай щоденний нагадувальний job на 20:00 з коротким звітом.",
        },
      ],
    },
    payments: {
      title: "Оплати",
      desc: "Stripe або WayForPay",
      steps: [
        {
          id: "addon-payments-choice",
          title: "Обери систему оплати",
          render(container, ctx) {
            const list = document.createElement("div");
            list.className = "card-grid";
            [
              { key: "stripe", title: "Stripe", desc: "Підтримка USD та інших валют." },
              { key: "wayforpay", title: "WayForPay", desc: "Українська платіжка в гривні." },
            ].forEach((option) => {
              const card = document.createElement("button");
              card.type = "button";
              card.className = "select-card";
              if (state.payments?.provider === option.key) card.classList.add("active");
              card.dataset.value = option.key;
              card.innerHTML = `<strong>${option.title}</strong><span>${option.desc}</span>`;
              card.addEventListener("click", () => {
                updateState((draft) => {
                  draft.payments.provider = option.key;
                });
                ctx.markComplete();
              });
              list.appendChild(card);
            });
            container.appendChild(list);
          },
        },
        {
          id: "addon-payments-keys",
          title: "Підготуй ключі",
          render(container) {
            renderList(container, [
              "Зареєструйся на stripe.com або wayforpay.com.",
              "Додай у .env змінні STRIPE_KEY або WAYFORPAY_KEY.",
            ]);
          },
        },
        {
          id: "addon-payments-command",
          title: "Команда /buy",
          prompt:
            "Task: додай команду /buy. Для Stripe — Checkout Session. Для WayForPay — платіжна форма. Після оплати надішли 'Дякую за оплату!'.",
          chat: "chat2",
        },
        {
          id: "addon-payments-success",
          title: "Повідомлення про успіх",
          prompt:
            "Task: після успішної оплати познач користувача як premium та відправ повідомлення з емодзі.",
        },
      ],
    },
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
      onComplete(draft) {
        draft.started = true;
      },
      render(container, ctx) {
        renderList(container, [
          "Що робимо: запускаємо майстер створення власного Telegram-бота.",
          "Дія: натисни «Почати».",
        ]);

        const action = document.createElement("button");
        action.type = "button";
        action.className = "btn primary";
        action.textContent = "Почати";
        action.addEventListener("click", () => {
          ctx.markComplete();
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
        `;
        container.appendChild(list);

        const note = document.createElement("p");
        note.className = "step-note";
      icon: "guide",
      title: "Вибір середовища",
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
      tags: ["guide"],
      when(state) {
        return state.environment !== "";
      },
      render(container, ctx) {
        const checklist = document.createElement("div");
        checklist.className = "checklist-grid";
        [
          { key: "python", label: "Python 3.10+ встановлено" },
          { key: "editor", label: "Редактор відкривається (VS Code / Cursor)" },
          { key: "github", label: "Є обліковий запис GitHub" },
          { key: "copilot", label: "Copilot активний (для Codex режиму)", when: (s) => s.mode === "codex" },
        ]
          .filter((item) => (item.when ? item.when(state) : true))
          .forEach((item) => {
            const row = document.createElement("label");
            row.className = "check-item";
            const input = document.createElement("input");
            input.type = "checkbox";
            input.checked = Boolean(state.ack[`check-${item.key}`]);
            input.addEventListener("change", () => {
              updateState((draft) => {
                draft.ack[`check-${item.key}`] = input.checked;
              });
              if ([...checklist.querySelectorAll("input")].every((node) => node.checked)) {
                ctx.markComplete();
              }
            });
            const span = document.createElement("span");
            span.textContent = item.label;
            row.append(input, span);
            checklist.appendChild(row);
          });
        container.appendChild(checklist);
      },
    });

    addStep({
      id: "1.6",
      section: startSection,
      icon: "file",
      title: "DEV BRIEF",
      desc: "Короткий опис проекту для копіювання.",
      tags: ["chat1"],
      when(state) {
        return state.environment !== "";
      },
      promptProvider() {
        const type = botTypes[state.botType] || botTypes.custom;
        const commands = (state.ack["commands"] || type.commands || "")
          .split(",")
          .filter(Boolean)
          .join(", ");
        return [
          "## DEV BRIEF",
          `Тип бота: ${type.title}`,
          `Команди: ${commands}`,
          `Режим: ${state.mode === "codex" ? "ChatGPT + Codex" : "ChatGPT-only"}`,
          `Середовище: ${state.environment === "codespaces" ? "Codespaces (браузер)" : "Local (твій комп'ютер)"}`,
          "Збереження: JSON за замовчуванням",
          "Стиль: дружні тексти з емодзі",
          "Ціль: створити Telegram-бота за покроковою інструкцією",
        ].join("\n");
      },
      render(container) {
        renderList(container, [
          "Скопіюй DEV BRIEF в ChatGPT (або Cursor).",
          "Скажи, що хочеш створити бота за покроковим планом.",
        ]);
      },
    });

    addStep({
      id: "1.7",
      section: startSection,
      icon: "guide",
      title: "Промпт для коду",
      desc: "Згенеруємо код і вставимо в main.py.",
      tags: ["chat2"],
      when(state) {
        return Boolean(state.ack["1.6"]);
      },
      promptProvider() {
        const type = botTypes[state.botType] || botTypes.custom;
        const commandBlock = makeCommandBlock(state);
        return [
          "## Cursor Prompt",
          `Ціль: створити Telegram-бота типу ${type.title}`,
          "Бібліотека: aiogram 3",
          "Команди:",
          commandBlock,
          "",
          "Створи файл main.py з обробниками для команд вище.",
          "Використай дружні повідомлення з емодзі.",
          "Дані поки що зберігай у пам'яті.",
        ].join("\n");
      },
      render(container) {
        renderList(container, [
          "Натисни «Скопіювати» і встав у ChatGPT/Cursor.",
          "Отриманий код збережи у main.py.",
          "Повернись сюди і познач крок виконаним.",
        ]);
      },
    });

    const backendSection = "Етап 2 · База даних";
    addStep({
      id: "2.1",
      section: backendSection,
      icon: "guide",
      title: "Вибір бекенду",
      desc: "Оберемо, де зберігати дані бота.",
      when(state) {
        return Boolean(state.ack["1.7"]);
      },
      render(container, ctx) {
        const options = [
          { key: "json", title: "JSON файл", desc: "Найпростіше. Дані у файлі." },
          { key: "sqlite", title: "SQLite", desc: "База у файлі. Хороша для невеликих проектів." },
          { key: "googlesheets", title: "Google Sheets", desc: "Редагування через таблицю онлайн." },
          { key: "postgres", title: "Postgres (Docker)", desc: "Для команди або бізнесу." },
        ];
        renderSelectionCards(container, options, state.backend, (value) => {
          updateState((draft) => {
            draft.backend = value;
          });
          ctx.markComplete();
        });
      },
    });

    addStep({
      id: "2.2",
      section: backendSection,
      icon: "guide",
      title: "Кроки для бекенду",
      desc: "Виконай усі підкроки нижче.",
      when(state) {
        return Boolean(state.backend);
      },
      render(container) {
        const chosen = backendOptions[state.backend];
        if (!chosen) {
          container.textContent = "Оберіть варіант бекенду вище.";
          return;
        }
        const list = document.createElement("ol");
        list.className = "instructions-list";
        chosen.steps.forEach((step) => {
          const li = document.createElement("li");
          li.textContent = step.title;
          list.appendChild(li);
        });
        container.appendChild(list);

        const hint = document.createElement("p");
        hint.className = "hint";
        hint.textContent = "Натисни на будь-який крок ліворуч, щоб отримати детальні інструкції.";
        container.appendChild(hint);
      },
    });

    Object.entries(backendOptions).forEach(([key, option]) => {
      option.steps.forEach((subStep, index) => {
        addStep({
          id: `2.${index + 3}.${key}`,
          section: backendSection,
          icon: "file",
          title: subStep.title,
          desc: subStep.desc || "",
          tags: subStep.chat ? [subStep.chat] : undefined,
          list.appendChild(li);
        });
        container.appendChild(list);

        const hint = document.createElement("p");
        hint.className = "hint";
        hint.textContent = "Натисни на будь-який крок ліворуч, щоб отримати детальні інструкції.";
        container.appendChild(hint);
      },
    });

    Object.entries(backendOptions).forEach(([key, option]) => {
      option.steps.forEach((subStep, index) => {
        addStep({
          id: `2.${index + 3}.${key}`,
          section: backendSection,
          icon: "file",
          title: subStep.title,
          desc: subStep.desc || "",
          tags: subStep.chat ? [subStep.chat] : undefined,
          when(state) {
            return state.backend === key;
          },
          prompt: subStep.prompt,
          link: subStep.link,
          onComplete: subStep.onComplete,
          render(container) {
            if (subStep.render) {
              subStep.render(container);
            } else if (subStep.prompt) {
              renderList(container, ["Скопіюй промпт нижче і виконай інструкції."]);
            } else {
              renderList(container, ["Виконай дію, описану в тексті."]);
            }
          },
        });
      });
    });

    const designSection = "Етап 3 · Дизайн";
    addStep({
      id: "3
