const BOT_TYPE_ORDER = [
  "CRM",
  "TASK",
  "HABIT",
  "FAQ",
  "SHOP",
  "BOOKING",
  "CUSTOM",
];

const CHANNEL_OPTIONS = {
  dm: {
    label: "Приватний чат (1:1)",
    english: "Direct messages (1:1)",
  },
  group: {
    label: "Груповий чат",
    english: "Telegram group chats",
  },
  both: {
    label: "І приватні, і групові чати",
    english: "Both direct messages and group chats",
  },
};

const TONE_OPTIONS = {
  friendly: {
    label: "Дружній і підтримуючий",
    english: "Friendly and encouraging",
  },
  professional: {
    label: "Професійний і лаконічний",
    english: "Professional and concise",
  },
  playful: {
    label: "Надихаючий і мотивуючий",
    english: "Upbeat and motivational",
  },
};

const BOT_TYPES = {
  CRM: {
    cardTitle: "CRM",
    cardDesc: "Облік клієнтів, задач і нагадувань.",
    briefLabel: "CRM assistant",
    commands: "/start,/help,/add,/clients,/tasks,/done,/stats",
    defaultPurpose:
      "Help a small business track clients, tasks, and follow-ups inside Telegram.",
    defaultFlows: [
      "Onboard the operator with /start and remind available commands with /help",
      "Capture a new lead with /add and review open work with /clients and /tasks",
      "Complete tasks via /done and review team performance with /stats",
    ],
    defaultToneKey: "friendly",
    defaultChannelKey: "dm",
  },
  TASK: {
    cardTitle: "Task",
    cardDesc: "Керує списками справ та дедлайнами.",
    briefLabel: "Task manager bot",
    commands: "/start,/help,/add,/list,/done,/skip,/stats",
    defaultPurpose:
      "Organise daily tasks for a user or team and keep everyone accountable.",
    defaultFlows: [
      "Introduce the workflow via /start and /help",
      "Collect tasks with /add and review them with /list",
      "Mark progress using /done, handle blockers with /skip, and summarise with /stats",
    ],
    defaultToneKey: "friendly",
    defaultChannelKey: "dm",
  },
  HABIT: {
    cardTitle: "Habit",
    cardDesc: "Допомагає виробити звичку крок за кроком.",
    briefLabel: "Habit tracker",
    commands: "/start,/help,/add,/habits,/done,/streak,/plan,/stats",
    defaultPurpose:
      "Guide users through forming healthy habits with reminders and motivation.",
    defaultFlows: [
      "Kick off onboarding with /start and summarise tools via /help",
      "Create or import habits with /add and review them with /habits",
      "Track completions with /done, review streaks with /streak and /stats, and adjust the plan with /plan",
    ],
    defaultToneKey: "playful",
    defaultChannelKey: "dm",
  },
  FAQ: {
    cardTitle: "FAQ",
    cardDesc: "Автовідповіді на запитання клієнтів.",
    briefLabel: "FAQ and support bot",
    commands: "/start,/help,/faq,/contact,/tips",
    defaultPurpose:
      "Answer frequently asked questions and route people to support without waiting.",
    defaultFlows: [
      "Introduce the knowledge base via /start and /help",
      "Provide curated answers with /faq and tips via /tips",
      "Escalate complex requests with /contact",
    ],
    defaultToneKey: "professional",
    defaultChannelKey: "both",
  },
  SHOP: {
    cardTitle: "Shop",
    cardDesc: "Прийом замовлень і статусів оплат.",
    briefLabel: "Shop assistant bot",
    commands: "/start,/help,/catalog,/buy,/cart,/pay,/support",
    defaultPurpose:
      "Showcase a simple product catalogue and accept orders directly in Telegram.",
    defaultFlows: [
      "Welcome the shopper with /start and explain navigation via /help",
      "Browse offers through /catalog, add items with /buy, and review the basket with /cart",
      "Collect payments with /pay and handle post-purchase support via /support",
    ],
    defaultToneKey: "friendly",
    defaultChannelKey: "dm",
  },
  BOOKING: {
    cardTitle: "Booking",
    cardDesc: "Бронювання візитів, слотів чи зустрічей.",
    briefLabel: "Booking assistant bot",
    commands: "/start,/help,/book,/slots,/cancel,/contact",
    defaultPurpose:
      "Let clients reserve available slots and manage appointments on their own.",
    defaultFlows: [
      "Guide newcomers with /start and /help",
      "Show free slots via /slots and confirm reservations with /book",
      "Handle schedule changes through /cancel and /contact",
    ],
    defaultToneKey: "professional",
    defaultChannelKey: "dm",
  },
  CUSTOM: {
    cardTitle: "Custom",
    cardDesc: "Я опишу свою ідею самостійно.",
    briefLabel: "Custom Telegram assistant",
    commands: "/start,/help",
    defaultPurpose:
      "Describe the bespoke workflow the user needs inside Telegram.",
    defaultFlows: [
      "Clarify the goal with /start",
      "Offer guidance and manual actions via /help and any additional commands",
    ],
    defaultToneKey: "friendly",
    defaultChannelKey: "dm",
  },
};

function getBotConfig(currentState) {
  if (!currentState) return BOT_TYPES.CUSTOM;
  return BOT_TYPES[currentState.botType] || BOT_TYPES.CUSTOM;
}

function getCommandList(currentState) {
  const config = getBotConfig(currentState);
  const source =
    (currentState?.commands && currentState.commands.trim()) || config.commands ||
    "/start,/help";

  return Array.from(
    new Set(
      source
        .split(/[\s,\n]+/)
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => (item.startsWith("/") ? item : `/${item}`))
    )
  );
}

function makeDevBrief(currentState) {
  const config = getBotConfig(currentState);
  const label = (currentState.botLabel || config?.briefLabel || "Telegram assistant").trim();
  const goal =
    (currentState.notes?.goalNote && currentState.notes.goalNote.trim()) ||
    config?.defaultPurpose ||
    "Summarise the main use case.";

  const flowNote = currentState.notes?.flowNote?.trim();
  const flows = flowNote
    ? flowNote.replace(/\s*\n\s*/g, "; ")
    : (config?.defaultFlows || []).join("; ");

  const commandsList = getCommandList(currentState);

  const channelKey =
    currentState.notes?.channel || config?.defaultChannelKey || "dm";
  const toneKey =
    currentState.notes?.tone || config?.defaultToneKey || "friendly";

  const channel =
    CHANNEL_OPTIONS[channelKey]?.english || CHANNEL_OPTIONS.dm.english;
  const tone = TONE_OPTIONS[toneKey]?.english || TONE_OPTIONS.friendly.english;

  let environmentLine = "";
  if (currentState.environment === "local") {
    environmentLine =
      "Environment: Local machine with Python 3.10+, virtual environment, and Cursor.";
  } else if (currentState.environment === "codespaces") {
    environmentLine =
      "Environment: GitHub Codespaces workspace with Python and Cursor in the browser.";
  }

  const lines = [
    `Project: ${label} Telegram bot.`,
    `Purpose: ${goal}`,
    flows ? `Primary flows: ${flows}` : "",
    commandsList.length ? `Commands: ${commandsList.join(", ")}` : "",
    "Storage: JSON file for persistence by default.",
    `Channel: ${channel}`,
    `Tone: ${tone}`,
    environmentLine,
  ].filter(Boolean);

  return lines.join("\n");
}

const STORAGE_STRATEGIES = {
  json: {
    label: "JSON file",
    summary:
      "Use a local JSON file for persistence with helper functions to load and save data safely.",
    tasks: [
      "Create a data directory if it doesn't exist and store data.json inside it.",
      "Implement load_data()/save_data() helpers that handle missing files and JSON decoding errors.",
    ],
  },
  sqlite: {
    label: "SQLite database",
    summary:
      "Set up an async SQLite database using aiosqlite for persistence and migrations.",
    tasks: [
      "Create database.py with get_connection() returning an aiosqlite connection.",
      "Provide init_db() that creates required tables and call it on startup.",
    ],
  },
  postgres: {
    label: "Postgres database",
    summary:
      "Use asyncpg to connect to PostgreSQL with connection pooling and migrations script.",
    tasks: [
      "Implement database.py with create_pool() and helpers for CRUD operations.",
      "Document required DATABASE_URL variable in .env.example and README.",
    ],
  },
  sheets: {
    label: "Google Sheets",
    summary:
      "Integrate Google Sheets through gspread or the Google API client with service account credentials.",
    tasks: [
      "Explain how to obtain credentials.json and reference it from the project.",
      "Provide helper functions to read/write rows that the bot handlers can call.",
    ],
  },
  notion: {
    label: "Notion API",
    summary:
      "Connect to Notion using the official API and keep a helper module for database interactions.",
    tasks: [
      "Document NOTION_TOKEN and NOTION_DATABASE_ID variables in .env.example.",
      "Expose functions for listing, creating, and updating entries that handlers can reuse.",
    ],
  },
  fastapi: {
    label: "FastAPI backend",
    summary:
      "Expose a FastAPI application to serve webhook endpoints and auxiliary HTTP routes if required.",
    tasks: [
      "Set up app/server.py with FastAPI instance and a /health endpoint.",
      "Document how to run uvicorn locally and configure webhook URLs in README.",
    ],
  },
  webhook: {
    label: "Webhook receiver",
    summary:
      "Prepare an HTTPS-ready webhook handler for Telegram updates (can be implemented with FastAPI).",
    tasks: [
      "Include instructions on setting TELEGRAM_WEBHOOK_URL in .env.example.",
      "Provide startup script that registers or deletes the webhook as needed.",
    ],
  },
};

function resolveStoragePlan(currentState) {
  const key = (currentState?.backend || "").toLowerCase();
  if (STORAGE_STRATEGIES[key]) {
    return STORAGE_STRATEGIES[key];
  }
  return STORAGE_STRATEGIES.json;
}

function makeNavigatorPrompt(currentState) {
  const visible = steps.filter((step) => {
    if (typeof step.when === "function") {
      return Boolean(step.when(currentState));
    }
    return true;
  });

  const totalSteps = visible.length;
  const index = clamp(
    typeof currentState.currentStep === "number" ? currentState.currentStep : 0,
    0,
    Math.max(totalSteps - 1, 0)
  );
  const activeStep = visible[index];

  const config = getBotConfig(currentState);
  const commands = getCommandList(currentState);
  const goal =
    (currentState.notes?.goalNote && currentState.notes.goalNote.trim()) ||
    config?.defaultPurpose ||
    "Сформулюй загальну мету бота.";
  const environment =
    currentState.environment === "codespaces"
      ? "Користуюся GitHub Codespaces у браузері."
      : currentState.environment === "local"
      ? "Працюю локально у VS Code з Cursor."
      : "Ще не обрав середовище, орієнтуйся на прості підказки.";

  const lines = [
    "Ти — Навігатор, який крок за кроком веде мене через Zero-to-Bot Panel.",
    `Проєкт: ${currentState.botLabel || config.briefLabel || "Telegram-бот"}.`,
    `Мета: ${goal}`,
    commands.length ? `Команди, які вже заплановано: ${commands.join(", ")}.` : "",
    environment,
    activeStep
      ? `Зараз я на кроці «${activeStep.title}». ${activeStep.desc || ""}`
      : "Покажи, як розпочати перший крок.",
    "Пояснюй українською, дуже простими реченнями.",
    "Дай нумерований список дій (1, 2, 3 …), без технічного жаргону.",
    "Якщо треба щось скопіювати — скажи що саме й куди вставити.",
    "Коли крок виконано, нагадай відмітити його у панелі й переходити далі.",
  ].filter(Boolean);

  return lines.join("\n");
}

function makeCodexPrompt(currentState) {
  const commands = getCommandList(currentState);
  const brief = makeDevBrief(currentState);
  const storagePlan = resolveStoragePlan(currentState);

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

  const environment =
    currentState.environment === "codespaces"
      ? "Target environment: GitHub Codespaces (Linux, Python 3.10)."
      : "Target environment: local machine with Python 3.10 and Cursor.";

  const lines = [
    "You are Copilot/Codex helping me scaffold an aiogram v3 Telegram bot.",
    environment,
    "Follow modern Python best practices and keep responses concise.",
    "\nProject brief:",
    brief,
    "\nCommands to implement:",
    commands.length ? commands.join(", ") : "/start, /help",
    "\nRepository structure (create files if missing):",
    ...repoStructure.map((entry) => `- ${entry}`),
    "\nKey tasks:",
    "1. Build src/main.py with aiogram 3 bot setup, command handlers, and startup logging.",
    "2. Load environment variables via python-dotenv; read TOKEN from .env and fail gracefully if missing.",
    `3. Implement storage layer: ${storagePlan.summary}`,
    ...storagePlan.tasks.map((task, index) => `   • ${task}`),
    "4. Generate a README.md with setup, installation, and run instructions.",
    "5. Provide .env.example containing TOKEN and any extra variables you mention.",
    "6. Include notes on how to run the bot locally (venv, pip install, python src/main.py).",
    "7. If you modify multiple files, show each path with the final content.",
  ];

  return lines.join("\n");
}

const steps = [
  {
    id: "welcome",
    title: "Ласкаво просимо!",
    desc:
      "Ця панель проведе вас через створення Telegram-бота без програмування.",
    render(container, ctx) {
      const intro = document.createElement("p");
      intro.textContent =
        "Ми рухаємося маленькими кроками. Спершу переконайтеся, що маєте час і готові слідувати інструкціям.";

      const checklist = document.createElement("ol");
      checklist.className = "step__list";
      [
        "Виділіть 15 хвилин, щоб пройти всі кроки без поспіху.",
        "Підготуйте короткий опис ідеї вашого бота.",
        "Налаштуйте окреме вікно браузера для спілкування з ChatGPT та Cursor.",
      ].forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        checklist.appendChild(li);
      });

      const hint = document.createElement("p");
      hint.className = "step__hint";
      hint.textContent =
        "Натисніть кнопку нижче, коли будете готові рухатися далі.";

      const startButton = document.createElement("button");
      startButton.type = "button";
      startButton.className = "step__primary";
      startButton.textContent = ctx.isComplete()
        ? "Готово"
        : "Я готовий почати";
      startButton.addEventListener("click", () => {
        ctx.updateState((draft) => {
          draft.started = true;
        });
        ctx.markComplete();
      });

      container.append(intro, checklist, hint, startButton);
    },
  },
  {
    id: "bot-type",
    title: "Оберіть тип бота",
    desc: "Натисніть на картку, яка найкраще описує вашого майбутнього бота.",
    when(state) {
      return Boolean(state.started);
    },
    render(container, ctx) {
      const info = document.createElement("p");
      info.textContent =
        "Це допоможе підібрати правильні модулі та приклади під ваш сценарій.";

      const options = BOT_TYPE_ORDER.map((value) => ({
        value,
        title: BOT_TYPES[value]?.cardTitle || value,
        desc: BOT_TYPES[value]?.cardDesc || "",
      }));

      const optionList = document.createElement("div");
      optionList.className = "option-list";

      options.forEach((option) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "option-card";
        button.dataset.value = option.value;
        button.setAttribute(
          "aria-pressed",
          String(ctx.state.botType === option.value)
        );
        if (ctx.state.botType === option.value) {
          button.classList.add("option-card--active");
        }

        const title = document.createElement("span");
        title.className = "option-card__title";
        title.textContent = option.title;

        const description = document.createElement("span");
        description.className = "option-card__desc";
        description.textContent = option.desc;

        button.append(title, description);
        button.addEventListener("click", () => {
          const config = BOT_TYPES[option.value] || BOT_TYPES.CUSTOM;
          ctx.updateState((draft) => {
            const previousType = draft.botType;
            draft.botType = option.value;
            if (config?.briefLabel) {
              draft.botLabel = config.briefLabel;
            }
            if (config?.commands) {
              if (!draft.commands || previousType !== option.value) {
                draft.commands = config.commands;
              }
            }
            draft.notes = {
              ...(draft.notes || {}),
            };
            if (config?.defaultToneKey) {
              if (!draft.notes.tone || previousType !== option.value) {
                draft.notes.tone = config.defaultToneKey;
              }
            }
            if (config?.defaultChannelKey) {
              if (!draft.notes.channel || previousType !== option.value) {
                draft.notes.channel = config.defaultChannelKey;
              }
            }
          }, { rerender: true });
          ctx.markComplete();
        });

        optionList.appendChild(button);
      });

      const tip = document.createElement("p");
      tip.className = "step__hint";
      tip.textContent =
        "Не знайшли потрібний варіант? Оберіть Custom і деталізуйте на наступних кроках.";

      container.append(info, optionList, tip);
    },
  },
  {
    id: "mode-choice",
    title: "Як будемо створювати промпти",
    desc: "Виберіть, хто генеруватиме технічні інструкції для Cursor.",
    when(state) {
      return Boolean(state.botType);
    },
    render(container, ctx) {
      const info = document.createElement("p");
      info.textContent =
        "Якщо ще не користувалися Copilot, оберіть ChatGPT — він безкоштовний.";

      const options = [
        {
          value: "chatgpt",
          title: "CHATGPT — безкоштовно",
          desc: "Ви копіюєте наші промпти в ChatGPT, він формує DEV BRIEF і тексти для Cursor.",
        },
        {
          value: "codex",
          title: "CODEX — швидше",
          desc: "Потрібен Copilot / Cursor Premium. Код генерується одразу з наших інструкцій.",
        },
      ];

      const optionList = document.createElement("div");
      optionList.className = "option-list";

      options.forEach((option) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "option-card";
        button.dataset.value = option.value;
        button.setAttribute(
          "aria-pressed",
          String(ctx.state.mode === option.value)
        );
        if (ctx.state.mode === option.value) {
          button.classList.add("option-card--active");
        }

        const title = document.createElement("span");
        title.className = "option-card__title";
        title.textContent = option.title;

        const description = document.createElement("span");
        description.className = "option-card__desc";
        description.textContent = option.desc;

        button.append(title, description);
        button.addEventListener("click", () => {
          ctx.updateState((draft) => {
            draft.mode = option.value;
          }, { rerender: true });
          ctx.markComplete();
        });

        optionList.appendChild(button);
      });

      const tip = document.createElement("p");
      tip.className = "step__hint";
      tip.textContent =
        "Обраний режим вплине на підказки далі. Можна повернутися і змінити його будь-коли.";

      container.append(info, optionList, tip);
    },
  },
  {
    id: "environment",
    title: "Де будемо запускати бота",
    desc: "Оберіть середовище, з яким вам буде зручніше працювати.",
    when(state) {
      return Boolean(state.mode);
    },
    render(container, ctx) {
      const info = document.createElement("p");
      info.textContent =
        "Не хвилюйтеся, ми пояснимо кожен крок для вибраного середовища.";

      const options = [
        {
          value: "local",
          title: "Local",
          desc: "Працюємо на вашому комп'ютері: встановимо Python і відкриємо Cursor.",
        },
        {
          value: "codespaces",
          title: "Codespaces",
          desc: "Усе в браузері. Потрібен лише акаунт GitHub і стабільний інтернет.",
        },
      ];

      const optionList = document.createElement("div");
      optionList.className = "option-list";

      options.forEach((option) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "option-card";
        button.dataset.value = option.value;
        button.setAttribute(
          "aria-pressed",
          String(ctx.state.environment === option.value)
        );
        if (ctx.state.environment === option.value) {
          button.classList.add("option-card--active");
        }

        const title = document.createElement("span");
        title.className = "option-card__title";
        title.textContent = option.title;

        const description = document.createElement("span");
        description.className = "option-card__desc";
        description.textContent = option.desc;

        button.append(title, description);
        button.addEventListener("click", () => {
          ctx.updateState((draft) => {
            draft.environment = option.value;
          }, { rerender: true });
          ctx.markComplete();
        });

        optionList.appendChild(button);
      });

      const tip = document.createElement("p");
      tip.className = "step__hint";
      tip.textContent =
        "Не впевнені, що обрати? Local — якщо вже маєте Python. Codespaces — якщо хочете все в браузері.";

      container.append(info, optionList, tip);
    },
  },
  {
    id: "bot-outline",
    title: "Опишіть свого бота",
    desc: "Сформуйте короткий опис, щоб система могла підготувати бриф.",
    when(state) {
      return Boolean(state.environment);
    },
    render(container, ctx) {
      const defaults = BOT_TYPES[ctx.state.botType] || BOT_TYPES.CUSTOM;
      const needsLabel = Boolean(defaults?.briefLabel && !ctx.state.botLabel);
      const needsCommands = Boolean(
        defaults?.commands && (!ctx.state.commands || ctx.state.commands.trim() === "")
      );
      const needsTone = Boolean(
        defaults?.defaultToneKey && !ctx.state.notes?.tone
      );
      const needsChannel = Boolean(
        defaults?.defaultChannelKey && !ctx.state.notes?.channel
      );

      if (needsLabel || needsCommands || needsTone || needsChannel) {
        ctx.updateState((draft) => {
          draft.notes = draft.notes || {};
          if (needsLabel && defaults?.briefLabel) {
            draft.botLabel = defaults.briefLabel;
          }
          if (needsCommands && defaults?.commands) {
            draft.commands = defaults.commands;
          }
          if (needsTone && defaults?.defaultToneKey) {
            draft.notes.tone = defaults.defaultToneKey;
          }
          if (needsChannel && defaults?.defaultChannelKey) {
            draft.notes.channel = defaults.defaultChannelKey;
          }
        });
      }

      const form = document.createElement("form");
      form.className = "step-form";
      form.noValidate = true;

      const fields = [
        {
          key: "botLabel",
          label: "Назва або роль бота",
          placeholder: "Наприклад: CRM assistant або Habit tracker",
          type: "input",
        },
        {
          key: "goalNote",
          label: "Яку задачу він вирішує?",
          placeholder: "Опишіть головну мету в одному-двох реченнях",
          type: "textarea",
        },
        {
          key: "flowNote",
          label: "Які дії має виконувати користувач?",
          placeholder: "Наприклад: /start для вітання, /add щоб внести дані, /stats для звіту",
          type: "textarea",
        },
        {
          key: "commands",
          label: "Команди бота",
          placeholder: "Наприклад: /start, /help, /add, /stats",
          type: "textarea",
        },
        {
          key: "tone",
          label: "Який стиль спілкування обрати?",
          type: "select",
          options: [
            { value: "friendly", label: TONE_OPTIONS.friendly.label },
            { value: "professional", label: TONE_OPTIONS.professional.label },
            { value: "playful", label: TONE_OPTIONS.playful.label },
          ],
        },
        {
          key: "channel",
          label: "Де працюватиме бот?",
          type: "select",
          options: [
            { value: "dm", label: CHANNEL_OPTIONS.dm.label },
            { value: "group", label: CHANNEL_OPTIONS.group.label },
            { value: "both", label: CHANNEL_OPTIONS.both.label },
          ],
        },
      ];

      fields.forEach((field) => {
        const group = document.createElement("label");
        group.className = "field-group";

        const title = document.createElement("span");
        title.className = "field-group__label";
        title.textContent = field.label;

        let control;
        let value = "";
        if (field.key === "botLabel") {
          value = ctx.state.botLabel || "";
        } else if (field.key === "commands") {
          value = ctx.state.commands || "";
        } else if (field.type === "select") {
          value = ctx.state.notes?.[field.key] || "";
        } else {
          value = ctx.state.notes?.[field.key] || "";
        }

        if (field.type === "textarea") {
          control = document.createElement("textarea");
          control.rows = 3;
          control.placeholder = field.placeholder || "";
        } else {
          if (field.type === "select") {
            control = document.createElement("select");
            (field.options || []).forEach((option) => {
              const opt = document.createElement("option");
              opt.value = option.value;
              opt.textContent = option.label;
              control.appendChild(opt);
            });
          } else {
            control = document.createElement("input");
            control.type = "text";
            control.placeholder = field.placeholder || "";
          }
        }

        control.value = value;

        const eventName = field.type === "select" ? "change" : "input";
        control.addEventListener(eventName, (event) => {
          const nextValue = event.target.value;
          ctx.updateState((draft) => {
            if (field.key === "botLabel") {
              draft.botLabel = nextValue;
            } else if (field.key === "commands") {
              draft.commands = nextValue;
            } else {
              draft.notes = {
                ...(draft.notes || {}),
                [field.key]: nextValue,
              };
            }
          });
        });

        group.append(title, control);
        form.appendChild(group);
      });

      const helper = document.createElement("p");
      helper.className = "step__hint";
      helper.textContent =
        "Ці нотатки збережуться автоматично. Коли все готово — позначте крок виконаним, щоб перейти до формування DEV BRIEF.";

      container.append(form, helper);
    },
  },
  {
    id: "dev-brief",
    title: "DEV BRIEF для ChatGPT",
    desc: "Згенерований англійський опис допоможе швидко пояснити бота йому або Cursor.",
    when(state) {
      return Boolean(state.environment);
    },
    render(container, ctx) {
      const explanation = document.createElement("p");
      explanation.textContent =
        "Перевірте текст нижче. За потреби поверніться до попередніх кроків і внесіть правки.";

      const briefText = makeDevBrief(ctx.state);

      const output = document.createElement("textarea");
      output.className = "brief-output";
      output.setAttribute("aria-label", "DEV BRIEF");
      output.readOnly = true;
      output.rows = 10;
      output.value = briefText;

      const copyWrap = document.createElement("div");
      copyWrap.className = "brief-actions";

      const status = document.createElement("span");
      status.className = "brief-actions__status";
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      status.textContent = "";

      const copyButton = document.createElement("button");
      copyButton.type = "button";
      copyButton.className = "step__copy";
      copyButton.textContent = "Copy DEV BRIEF";
      copyButton.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(output.value);
          status.textContent = "Скопійовано у буфер обміну";
        } catch (error) {
          status.textContent = "Не вдалося скопіювати. Скопіюйте вручну.";
        }
        window.clearTimeout(copyButton._statusTimeout);
        copyButton._statusTimeout = window.setTimeout(() => {
          status.textContent = "";
        }, 3000);
      });

      copyWrap.append(copyButton, status);

      const hint = document.createElement("p");
      hint.className = "step__hint";
      hint.textContent =
        "Вставте DEV BRIEF у ChatGPT або Cursor, коли будете готові, і попросіть згенерувати код за цим описом.";

      container.append(explanation, output, copyWrap, hint);
    },
  },
  {
    id: "prompt-pack",
    title: "Промпти для Навігатора і Codex",
    desc: "Скопіюйте готові підказки: перша для ChatGPT, друга для Copilot/Codex у Cursor.",
    when(state) {
      return Boolean(state.environment);
    },
    render(container, ctx) {
      const helper = document.createElement("p");
      helper.textContent =
        "Навігатор пояснить поточний крок українською, а Copilot збере повний кодовий проєкт.";

      const grid = document.createElement("div");
      grid.className = "prompt-grid";

      function createPromptCard({ title, subtitle, prompt, buttonLabel }) {
        const card = document.createElement("section");
        card.className = "prompt-card";

        const header = document.createElement("header");
        header.className = "prompt-card__header";

        const heading = document.createElement("h3");
        heading.className = "prompt-card__title";
        heading.textContent = title;

        const sub = document.createElement("p");
        sub.className = "prompt-card__subtitle";
        sub.textContent = subtitle;

        header.append(heading, sub);

        const textarea = document.createElement("textarea");
        textarea.className = "prompt-card__text";
        textarea.readOnly = true;
        textarea.rows = 14;
        textarea.value = prompt;
        textarea.setAttribute("aria-label", title);

        const actions = document.createElement("div");
        actions.className = "prompt-card__actions";

        const status = document.createElement("span");
        status.className = "prompt-card__status";
        status.setAttribute("role", "status");
        status.setAttribute("aria-live", "polite");

        const copyButton = document.createElement("button");
        copyButton.type = "button";
        copyButton.className = "step__copy";
        copyButton.textContent = buttonLabel;
        copyButton.addEventListener("click", async () => {
          try {
            await navigator.clipboard.writeText(textarea.value);
            status.textContent = "Скопійовано";
          } catch (error) {
            status.textContent = "Скопіюйте вручну";
          }
          window.clearTimeout(copyButton._statusTimeout);
          copyButton._statusTimeout = window.setTimeout(() => {
            status.textContent = "";
          }, 3000);
        });

        actions.append(copyButton, status);

        card.append(header, textarea, actions);
        return card;
      }

      const navigatorPrompt = makeNavigatorPrompt(ctx.state);
      const codexPrompt = makeCodexPrompt(ctx.state);

      grid.append(
        createPromptCard({
          title: "Навігатор (ChatGPT)",
          subtitle:
            "Вставте у чат українською — він поверне прості інструкції для поточного кроку.",
          prompt: navigatorPrompt,
          buttonLabel: "Copy for ChatGPT",
        }),
        createPromptCard({
          title: "Copilot / Codex",
          subtitle:
            "Цей промпт вставте у Cursor (Copilot), щоб отримати структуру коду та файли.",
          prompt: codexPrompt,
          buttonLabel: "Copy for Codex",
        })
      );

      const hint = document.createElement("p");
      hint.className = "step__hint";
      hint.textContent =
        "Після копіювання поверніться сюди, виконайте поради від Навігатора та позначте крок виконаним.";

      container.append(helper, grid, hint);
    },
  },
  {
    id: "requirements-file",
    title: "Файл requirements.txt",
    desc: "Створіть файл із залежностями і додайте базові бібліотеки.",
    when(state) {
      return Boolean(state.environment);
    },
    render(container, ctx) {
      const info = document.createElement("p");
      info.textContent =
        "У файловому дереві Cursor або VS Code натисніть правою кнопкою → New File → введіть requirements.txt.";

      const details = document.createElement("p");
      details.className = "step__hint";
      details.textContent =
        "Скопіюйте вміст нижче. Ці залежності потрібні для aiogram 3 та завантаження токена з .env.";

      const snippet = document.createElement("div");
      snippet.className = "code-snippet";

      const code = document.createElement("pre");
      code.className = "code-block";
      code.textContent = "aiogram==3.*\npython-dotenv";

      const actions = document.createElement("div");
      actions.className = "code-snippet__actions";

      const status = document.createElement("span");
      status.className = "code-snippet__status";
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");

      const copyButton = document.createElement("button");
      copyButton.type = "button";
      copyButton.className = "step__copy";
      copyButton.textContent = "Скопіювати";
      copyButton.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(code.textContent);
          status.textContent = "Скопійовано";
        } catch (error) {
          status.textContent = "Не вдалося — скопіюйте вручну.";
        }
        window.clearTimeout(copyButton._timeoutId);
        copyButton._timeoutId = window.setTimeout(() => {
          status.textContent = "";
        }, 3000);
      });

      actions.append(copyButton, status);
      snippet.append(code, actions);

      const checkboxLabel = document.createElement("label");
      checkboxLabel.className = "step-check";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = ctx.isComplete();
      checkbox.addEventListener("change", () => {
        ctx.toggleComplete();
      });

      const checkboxText = document.createElement("span");
      checkboxText.textContent = "✅ done";

      checkboxLabel.append(checkbox, checkboxText);

      container.append(info, details, snippet, checkboxLabel);
    },
  },
  {
    id: "main-placeholder",
    title: "Порожній main.py",
    desc: "Підготуйте файл для майбутнього коду бота.",
    when(state) {
      return Boolean(state.environment);
    },
    render(container, ctx) {
      const info = document.createElement("p");
      info.textContent =
        "У тій самій папці створіть новий файл main.py. Поки залиште його порожнім.";

      const hint = document.createElement("p");
      hint.className = "step__hint";
      hint.textContent =
        "Коли отримаєте код від Codex або ChatGPT — просто вставте його сюди і збережіть файл.";

      const tip = document.createElement("p");
      tip.className = "step__hint";
      tip.textContent =
        "Як створити файл: у Cursor натисніть правою кнопкою на папку → New File → main.py. У VS Code — File → New File, потім збережіть як main.py в корені проєкту.";

      const checkboxLabel = document.createElement("label");
      checkboxLabel.className = "step-check";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = ctx.isComplete();
      checkbox.addEventListener("change", () => {
        ctx.toggleComplete();
      });

      const checkboxText = document.createElement("span");
      checkboxText.textContent = "✅ done";

      checkboxLabel.append(checkbox, checkboxText);

      container.append(info, hint, tip, checkboxLabel);
    },
  },
  {
    id: "env-files",
    title: "Файли .env та .env.example",
    desc: "Збережіть токен бота окремо і підготуйте шаблон для команди.",
    when(state) {
      return Boolean(state.environment);
    },
    render(container, ctx) {
      const intro = document.createElement("p");
      intro.textContent =
        "Створіть два файли: .env (для реального токена) та .env.example (для прикладу в репозиторії).";

      const reminder = document.createElement("p");
      reminder.className = "step__hint";
      reminder.textContent =
        "Токен видає BotFather. У .env зберігайте справжнє значення, а в .env.example — підказку для інших.";

      const envSnippet = document.createElement("div");
      envSnippet.className = "code-snippet";

      const envCode = document.createElement("pre");
      envCode.className = "code-block";
      envCode.textContent = "# .env\nTOKEN=123456:telegram-bot-token";

      const envActions = document.createElement("div");
      envActions.className = "code-snippet__actions";

      const envStatus = document.createElement("span");
      envStatus.className = "code-snippet__status";
      envStatus.setAttribute("role", "status");
      envStatus.setAttribute("aria-live", "polite");

      const envCopy = document.createElement("button");
      envCopy.type = "button";
      envCopy.className = "step__copy";
      envCopy.textContent = "Скопіювати .env";
      envCopy.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText("TOKEN=123456:telegram-bot-token");
          envStatus.textContent = "Скопійовано";
        } catch (error) {
          envStatus.textContent = "Скопіюйте вручну";
        }
        window.clearTimeout(envCopy._timeoutId);
        envCopy._timeoutId = window.setTimeout(() => {
          envStatus.textContent = "";
        }, 3000);
      });

      envActions.append(envCopy, envStatus);
      envSnippet.append(envCode, envActions);

      const exampleSnippet = document.createElement("div");
      exampleSnippet.className = "code-snippet";

      const exampleCode = document.createElement("pre");
      exampleCode.className = "code-block";
      exampleCode.textContent = "# .env.example\nTOKEN=put-your-telegram-token-here";

      const exampleActions = document.createElement("div");
      exampleActions.className = "code-snippet__actions";

      const exampleStatus = document.createElement("span");
      exampleStatus.className = "code-snippet__status";
      exampleStatus.setAttribute("role", "status");
      exampleStatus.setAttribute("aria-live", "polite");

      const exampleCopy = document.createElement("button");
      exampleCopy.type = "button";
      exampleCopy.className = "step__copy";
      exampleCopy.textContent = "Скопіювати .env.example";
      exampleCopy.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(
            "TOKEN=put-your-telegram-token-here"
          );
          exampleStatus.textContent = "Скопійовано";
        } catch (error) {
          exampleStatus.textContent = "Скопіюйте вручну";
        }
        window.clearTimeout(exampleCopy._timeoutId);
        exampleCopy._timeoutId = window.setTimeout(() => {
          exampleStatus.textContent = "";
        }, 3000);
      });

      exampleActions.append(exampleCopy, exampleStatus);
      exampleSnippet.append(exampleCode, exampleActions);

      const checklist = document.createElement("ul");
      checklist.className = "step__list";
      [
        "Збережіть .env у корені проєкту. Не додавайте його в Git.",
        "Додайте .env.example до репозиторію — це підказка для інших користувачів.",
      ].forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        checklist.appendChild(li);
      });

      const checkboxLabel = document.createElement("label");
      checkboxLabel.className = "step-check";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = ctx.isComplete();
      checkbox.addEventListener("change", () => {
        ctx.toggleComplete();
      });

      const checkboxText = document.createElement("span");
      checkboxText.textContent = "✅ done";

      checkboxLabel.append(checkbox, checkboxText);

      container.append(
        intro,
        reminder,
        envSnippet,
        exampleSnippet,
        checklist,
        checkboxLabel
      );
    },
  },
];

const STORAGE_KEY = "ztb_state_v1";
const THEME_STORAGE_KEY = "ztb_theme_manual";

function getDefaultState() {
  return {
    started: false,
    currentStep: 0,
    botType: "",
    botLabel: "",
    commands: "",
    mode: "",
    environment: "",
    backend: "",
    addons: {
      design: false,
      stats: false,
      payments: false,
    },
    payments: {
      provider: "",
    },
    notes: {},
    ack: {},
  };
}

function loadState() {
  const baseState = getDefaultState();
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!stored || typeof stored !== "object") {
      return baseState;
    }

    return {
      ...baseState,
      ...stored,
      addons: {
        ...baseState.addons,
        ...(stored.addons || {}),
      },
      payments: {
        ...baseState.payments,
        ...(stored.payments || {}),
      },
      notes: {
        ...baseState.notes,
        ...(stored.notes || {}),
      },
      ack: {
        ...baseState.ack,
        ...(stored.ack || {}),
      },
    };
  } catch (error) {
    return baseState;
  }
}

let state = loadState();

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const app = document.querySelector("#app");
const progress = document.querySelector(".progress");
const progressBar = document.querySelector(".progress__bar");
const prevButton = document.querySelector('[data-action="prev"]');
const nextButton = document.querySelector('[data-action="next"]');
const toggleThemeButton = document.querySelector("#toggle-theme");
const bodyElement = document.body;

const prefersDarkQuery = window.matchMedia("(prefers-color-scheme: dark)");
let manualTheme = localStorage.getItem(THEME_STORAGE_KEY);

function getInitialTheme() {
  if (manualTheme === "light" || manualTheme === "dark") {
    return manualTheme;
  }
  return prefersDarkQuery.matches ? "dark" : "light";
}

let currentTheme = getInitialTheme();

function applyTheme(theme, { persist = false } = {}) {
  currentTheme = theme;
  bodyElement.dataset.theme = theme;
  bodyElement.style.colorScheme = theme;
  updateThemeToggleLabel();
  if (persist) {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    manualTheme = theme;
  }
}

function updateThemeToggleLabel() {
  if (!toggleThemeButton) return;
  const nextTheme = currentTheme === "dark" ? "light" : "dark";
  const nextThemeLabel = nextTheme === "dark" ? "Темна тема" : "Світла тема";
  toggleThemeButton.textContent = `🌗 ${nextThemeLabel}`;
  toggleThemeButton.setAttribute(
    "aria-label",
    `Перемкнути на ${nextTheme === "dark" ? "темну" : "світлу"} тему`
  );
  toggleThemeButton.setAttribute("aria-pressed", String(currentTheme === "dark"));
}

applyTheme(currentTheme);

const handleSystemThemeChange = (event) => {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") {
    return;
  }
  applyTheme(event.matches ? "dark" : "light");
};

if (typeof prefersDarkQuery.addEventListener === "function") {
  prefersDarkQuery.addEventListener("change", handleSystemThemeChange);
} else if (typeof prefersDarkQuery.addListener === "function") {
  prefersDarkQuery.addListener(handleSystemThemeChange);
}

toggleThemeButton?.addEventListener("click", () => {
  const nextTheme = currentTheme === "dark" ? "light" : "dark";
  applyTheme(nextTheme, { persist: true });
});

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getVisibleSteps() {
  return steps.filter((step) => {
    if (typeof step.when === "function") {
      return Boolean(step.when(state));
    }
    return true;
  });
}

function markStep(stepId, completed = true) {
  if (completed) {
    state.ack = {
      ...state.ack,
      [stepId]: true,
    };
  } else {
    const nextAck = { ...state.ack };
    delete nextAck[stepId];
    state.ack = nextAck;
  }
  saveState();
  render();
}

function createStepContext(step) {
  return {
    state,
    updateState(updater, options = {}) {
      if (typeof updater === "function") {
        updater(state);
      } else if (updater && typeof updater === "object") {
        Object.assign(state, updater);
      }
      saveState();
      if (options.rerender) {
        render();
      }
    },
    markComplete() {
      markStep(step.id, true);
    },
    markIncomplete() {
      markStep(step.id, false);
    },
    toggleComplete() {
      const next = !this.isComplete();
      markStep(step.id, next);
    },
    isComplete() {
      return Boolean(state.ack?.[step.id]);
    },
  };
}

function setStep(index) {
  const visible = getVisibleSteps();
  const maxIndex = Math.max(visible.length - 1, 0);
  const clampedIndex = clamp(index, 0, maxIndex);
  const changed = clampedIndex !== state.currentStep;
  state.currentStep = clampedIndex;
  if (!state.started && clampedIndex > 0) {
    state.started = true;
  }
  if (changed) {
    saveState();
  }
  render();
  focusMain();
}

function render() {
  if (!app) return;

  const visibleSteps = getVisibleSteps();
  const totalSteps = visibleSteps.length;
  if (totalSteps === 0) {
    app.innerHTML =
      '<article class="step"><h2 class="step__title">Немає доступних кроків</h2><p class="step__body">Перевірте налаштування або скиньте прогрес.</p></article>';
    progress?.setAttribute("aria-valuenow", "0");
    progress?.setAttribute("aria-valuetext", "0% завершено");
    if (progressBar) {
      progressBar.style.width = "0%";
    }
    prevButton && (prevButton.disabled = true);
    nextButton && (nextButton.disabled = true);
    return;
  }

  const maxIndex = totalSteps - 1;
  const safeIndex = clamp(state.currentStep || 0, 0, maxIndex);
  if (safeIndex !== state.currentStep) {
    state.currentStep = safeIndex;
    saveState();
  }

  const step = visibleSteps[safeIndex];
  const completedVisible = visibleSteps.reduce(
    (count, item) => count + (state.ack?.[item.id] ? 1 : 0),
    0
  );
  const percent = totalSteps
    ? Math.round((completedVisible / totalSteps) * 100)
    : 0;

  progress?.setAttribute("aria-valuenow", String(percent));
  progress?.setAttribute(
    "aria-valuetext",
    `${completedVisible} з ${totalSteps} кроків виконано`
  );
  if (progressBar) {
    progressBar.style.width = `${percent}%`;
  }

  if (prevButton) {
    prevButton.disabled = safeIndex === 0;
  }
  if (nextButton) {
    nextButton.disabled = safeIndex === maxIndex;
  }

  app.innerHTML = "";

  if (!step) {
    return;
  }

  const article = document.createElement("article");
  article.className = "step";
  article.setAttribute("data-step-id", step.id);

  const header = document.createElement("header");
  const title = document.createElement("h2");
  title.className = "step__title";
  title.textContent = step.title;
  header.appendChild(title);
  article.appendChild(header);

  if (step.desc) {
    const description = document.createElement("p");
    description.className = "step__body";
    description.textContent = step.desc;
    article.appendChild(description);
  }

  const content = document.createElement("div");
  content.className = "step__content";

  const ctx = createStepContext(step);
  if (typeof step.render === "function") {
    step.render(content, ctx);
  }

  if (content.childNodes.length > 0) {
    article.appendChild(content);
  }

  const actions = document.createElement("div");
  actions.className = "step__actions";

  const status = document.createElement("span");
  status.className = "step__status";

  const completeButton = document.createElement("button");
  completeButton.type = "button";
  completeButton.className = "step__complete";

  function syncCompleteState() {
    const done = ctx.isComplete();
    status.textContent = done
      ? "Крок позначено як виконаний"
      : "Крок ще не виконано";
    completeButton.textContent = done
      ? "Позначити як невиконаний"
      : "Позначити крок виконаним";
    completeButton.classList.toggle("step__complete--done", done);
  }

  syncCompleteState();

  completeButton.addEventListener("click", () => {
    ctx.toggleComplete();
  });

  actions.append(status, completeButton);
  article.appendChild(actions);

  app.appendChild(article);
}

function focusMain() {
  requestAnimationFrame(() => {
    app?.focus();
  });
}

prevButton?.addEventListener("click", () => {
  setStep(state.currentStep - 1);
});

nextButton?.addEventListener("click", () => {
  setStep(state.currentStep + 1);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowRight") {
    setStep(state.currentStep + 1);
  }
  if (event.key === "ArrowLeft") {
    setStep(state.currentStep - 1);
  }
});

render();
focusMain();

window.ZeroToBotPanel = {
  getState: () => state,
  setStep,
  render,
  loadState,
  saveState,
  steps,
  makeDevBrief,
  makeNavigatorPrompt,
  makeCodexPrompt,
};
