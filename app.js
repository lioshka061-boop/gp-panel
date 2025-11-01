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

const PAYMENT_PROVIDERS = {
  stripe: {
    key: "stripe",
    title: "Stripe",
    description: "Онлайн-оплати картками Visa/Mastercard через Stripe Checkout.",
    docs: "https://stripe.com/docs/payments/checkout",
    envKeys: [
      { key: "STRIPE_SECRET_KEY", label: "Секретний ключ (Secret key)" },
      { key: "STRIPE_PUBLISHABLE_KEY", label: "Публічний ключ (Publishable key)" },
      { key: "STRIPE_PRICE_ID", label: "ID підписки або продукту (Price ID)" },
    ],
    envPrompt: [
      "Add STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, and STRIPE_PRICE_ID to .env and .env.example.",
      "Load them inside src/config.py using python-dotenv.",
      "Explain in README how to grab these keys from the Stripe Dashboard.",
    ],
    handlerPrompt: [
      "Install stripe if missing and initialise stripe.api_key from STRIPE_SECRET_KEY.",
      "Implement /buy handler that creates a Checkout Session (payment) with success and cancel URLs.",
      "Reply to the user with the generated Stripe payment link.",
    ],
    successPrompt: [
      "Handle the Stripe webhook or poll session status to confirm payment.",
      "Mark the user as premium in storage and send a friendly success message with emoji.",
    ],
  },
  wayforpay: {
    key: "wayforpay",
    title: "WayForPay",
    description: "Український провайдер платежів із швидкою реєстрацією.",
    docs: "https://wiki.wayforpay.com/en/view/852130/",
    envKeys: [
      { key: "WAYFORPAY_MERCHANT_ACCOUNT", label: "Merchant Account" },
      { key: "WAYFORPAY_SECRET_KEY", label: "Secret Key" },
      { key: "WAYFORPAY_RETURN_URL", label: "Return URL після оплати" },
    ],
    envPrompt: [
      "Add WAYFORPAY_MERCHANT_ACCOUNT, WAYFORPAY_SECRET_KEY, and WAYFORPAY_RETURN_URL to .env and .env.example.",
      "Load the values in src/config.py and document how to obtain them from the WayForPay cabinet.",
    ],
    handlerPrompt: [
      "Use WayForPay signature rules to build a payment link in /buy handler.",
      "Generate invoice/order data (orderReference, amount, currency) and respond with a URL button.",
      "Reuse the existing storage to flag the user as pending until payment is confirmed.",
    ],
    successPrompt: [
      "Explain how to verify the response from WayForPay (callback signature) and mark the user as premium.",
      "Send a success message with emoji and instructions on how to access premium features.",
    ],
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

const BACKEND_LIBRARY = {
  json: {
    cardTitle: "JSON файл",
    cardDesc: "Простий варіант: дані лежать у файлі на диску.",
    codexSummary:
      "Persist records inside data/db.json using helper functions that safely read and write JSON.",
    codexTasks: [
      "Create a data directory and add data/db.json to store records.",
      "Implement load_json_data()/save_json_data() helpers with missing-file and JSON decode handling.",
      "Update command handlers to use the helpers for adding, listing, and completing entries.",
      "Document how to run the bot and confirm that /add appends to the JSON file.",
    ],
    steps: [
      {
        id: "create-json-file",
        title: "Створіть data/db.json",
        explanation:
          "У корені проєкту створіть папку data і порожній файл db.json — це ваша база даних.",
        instructions: [
          "Task: Create a data directory at the repository root (if missing) and add an empty db.json file inside it.",
          "Show the updated file tree so data/db.json is visible.",
        ],
      },
      {
        id: "json-helpers",
        title: "Додайте функції читання/запису",
        explanation:
          "Створимо хелпери, які безпечно читають і записують JSON навіть якщо файл порожній.",
        instructions: [
          "Task: Update src/storage/engine.py to implement load_json_data() and save_json_data() that read/write data/db.json with UTF-8.",
          "Handle missing files by creating them with {} and catch json.JSONDecodeError by returning an empty dict.",
          "Return the full updated src/storage/engine.py file.",
        ],
      },
      {
        id: "json-wire",
        title: "Підключіть хелпери до команд",
        explanation:
          "Команди /add, /list та /done мають працювати через нові функції збереження.",
        instructions: [
          "Task: Update the command handlers (for example in src/handlers/basic.py) to call load_json_data()/save_json_data() when processing /add, /list, and /done.",
          "Ensure new items include at least an id, title/name, and status fields before saving.",
          "Return the updated handler module(s).",
        ],
      },
      {
        id: "json-test",
        title: "Перевірте /add",
        explanation:
          "Запустіть бота, додайте запис і переконайтеся, що файл оновився.",
        instructions: [
          "Task: Provide a short manual testing checklist for verifying that running the bot and calling /add appends a new record to data/db.json.",
          "Include shell commands for activating the virtual environment and running python src/main.py.",
        ],
      },
    ],
  },
  sqlite: {
    cardTitle: "SQLite",
    cardDesc: "Окрема база у файлі db.sqlite3 з таблицею задач.",
    codexSummary:
      "Store records in a local SQLite database (db.sqlite3) with helpers built around aiosqlite.",
    codexTasks: [
      "Ensure db.sqlite3 exists and is initialised on startup.",
      "Create a tasks table with id INTEGER PRIMARY KEY, name TEXT, status TEXT (and timestamps if needed).",
      "Expose helper functions for creating, listing, and updating tasks through aiosqlite.",
      "Wire the command handlers to these helpers and explain how to run a quick manual test.",
    ],
    steps: [
      {
        id: "sqlite-file",
        title: "Створіть db.sqlite3",
        explanation:
          "SQLite зберігає дані в одному файлі. Ми створимо його автоматично при старті.",
        instructions: [
          "Task: Add initialisation code (for example init_db()) that ensures db.sqlite3 exists at the project root when the bot starts.",
          "Return the updated storage module with this bootstrap logic.",
        ],
      },
      {
        id: "sqlite-table",
        title: "Створіть таблицю tasks",
        explanation:
          "У таблиці буде id, name та status — цього достатньо для перших версій.",
        instructions: [
          "Task: Within the initialisation code create a tasks table (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, status TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP).",
          "Show the SQL executed during startup.",
        ],
      },
      {
        id: "sqlite-crud",
        title: "Напишіть CRUD-хелпери",
        explanation:
          "Додамо функції для додавання, отримання списку та оновлення статусу записів.",
        instructions: [
          "Task: Implement async helpers such as add_task(), list_tasks(), and update_task_status() using aiosqlite.",
          "Return the updated Python module with these helpers.",
        ],
      },
      {
        id: "sqlite-wire",
        title: "Підключіть команди",
        explanation:
          "Команди /add, /list та /done мають звертатися до SQLite-helpers.",
        instructions: [
          "Task: Update the bot command handlers so /add inserts rows, /list fetches tasks, and /done updates status via the new helper functions.",
          "Provide the updated handler code.",
        ],
      },
      {
        id: "sqlite-test",
        title: "Перевірте запис",
        explanation:
          "Після запуску бота додайте запис і переконайтеся, що він з'явився у таблиці.",
        instructions: [
          "Task: Share manual testing steps (with shell commands) to run the bot and inspect the tasks table showing the new row.",
          "Include an example SQLite query for checking the inserted data.",
        ],
      },
    ],
  },
  sheets: {
    cardTitle: "Google Sheets",
    cardDesc: "Дані зберігаються у таблиці Google, доступній з будь-якого місця.",
    codexSummary:
      "Store records inside a Google Sheet via gspread with service account credentials loaded from environment variables.",
    codexTasks: [
      "Document how to create and share a Google Sheet with a service account.",
      "Load credentials (JSON file path or inline) from environment variables and initialise gspread.",
      "Expose helpers to append rows and read current items for bot commands.",
      "Explain how to run a manual test to confirm that a new row appears after /add.",
    ],
    steps: [
      {
        id: "sheets-create",
        title: "Створіть Google Sheet",
        explanation:
          "Створіть таблицю в Google Sheets і поділіться нею з сервісним акаунтом.",
        instructions: [
          "Task: Provide numbered instructions for creating a Google Sheet and sharing it with a Google Cloud service account email so the bot can edit it.",
          "Mention where to store the sheet ID in .env.",
        ],
      },
      {
        id: "sheets-code",
        title: "Додайте gspread у код",
        explanation:
          "Через gspread бот зможе читати та записувати рядки у таблицю.",
        instructions: [
          "Task: Update the project to load service account credentials from environment variables (e.g., GOOGLE_SERVICE_ACCOUNT_JSON) and initialise gspread in a storage helper module.",
          "Expose helper functions append_row() and fetch_rows() that the handlers can use.",
          "Return the updated Python files and .env.example changes.",
        ],
      },
      {
        id: "sheets-test",
        title: "Перевірте запис у таблиці",
        explanation:
          "Після виклику /add у Google Sheets має з'явитися новий рядок.",
        instructions: [
          "Task: Describe how to run the bot, trigger /add, and confirm in Google Sheets that a new row appears.",
          "Include tips for troubleshooting missing credentials or permissions.",
        ],
      },
    ],
  },
  postgres: {
    cardTitle: "Postgres (Docker)",
    cardDesc: "Більш серйозне рішення з окремою базою у Docker.",
    codexSummary:
      "Run PostgreSQL via docker-compose and connect with psycopg2 or asyncpg using environment variables.",
    codexTasks: [
      "Add a docker-compose.yml with a PostgreSQL service and persistent volume.",
      "Document DATABASE_URL (or individual credentials) in .env.example and README.",
      "Implement connection helpers and migrations to create required tables for commands.",
      "Provide instructions for docker compose up/down and a manual test that inserts data via /add.",
    ],
    steps: [
      {
        id: "postgres-compose",
        title: "Додайте docker-compose.yml",
        explanation:
          "Docker підніме локальний Postgres однією командою.",
        instructions: [
          "Task: Create a docker-compose.yml with a postgres service (port 5432, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB) and a volume for data.",
          "Return the full file content.",
        ],
      },
      {
        id: "postgres-run",
        title: "Запустіть контейнер",
        explanation:
          "Після додавання файлу підніміть базу через docker compose up -d.",
        instructions: [
          "Task: Provide shell commands to run docker compose up -d and check container status, plus how to stop it afterwards.",
          "Explain where to run these commands (project root).",
        ],
      },
      {
        id: "postgres-connect",
        title: "Підключіться з коду",
        explanation:
          "Бот має читати змінні з .env і підключатися до Postgres через psycopg2 або asyncpg.",
        instructions: [
          "Task: Update the storage layer to read DATABASE_URL (or HOST/USER/PASSWORD/DB) from .env and create tables for tasks using psycopg2/asyncpg.",
          "Return the updated Python modules and .env.example additions.",
        ],
      },
      {
        id: "postgres-test",
        title: "Перевірте запис",
        explanation:
          "Переконайтеся, що команда /add створює рядок у таблиці Postgres.",
        instructions: [
          "Task: Provide manual testing steps showing how to run the bot, call /add, and verify via psql (or SELECT query) that the record exists.",
          "Include troubleshooting tips if the connection fails.",
        ],
      },
    ],
  },
};

const ADDON_DEPENDENCIES = {
  design: [
    "addon-design-reply",
    "addon-design-inline",
    "addon-design-tone",
  ],
  stats: [
    "addon-stats-command",
    "addon-stats-report",
    "addon-stats-reminder",
  ],
  payments: [
    "addon-payments-provider",
    "addon-payments-env",
    "addon-payments-handler",
    "addon-payments-success",
  ],
};

function getBotConfig(currentState) {
  if (!currentState) return BOT_TYPES.CUSTOM;
  return BOT_TYPES[currentState.botType] || BOT_TYPES.CUSTOM;
}

function clearAddonProgress(currentState, addonKey) {
  if (!currentState) return;
  const ids = ADDON_DEPENDENCIES[addonKey];
  if (Array.isArray(ids) && currentState.ack) {
    ids.forEach((id) => {
      if (currentState.ack[id]) {
        delete currentState.ack[id];
      }
    });
  }
  if (addonKey === "payments") {
    currentState.payments = {
      ...(currentState.payments || {}),
      provider: "",
    };
  }
}

function getPaymentProviderConfig(currentState) {
  if (!currentState?.addons?.payments) return null;
  const key = (currentState.payments?.provider || "").toLowerCase();
  return PAYMENT_PROVIDERS[key] || null;
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

function getPrimaryCustomCommand(currentState) {
  const commands = getCommandList(currentState);
  const fallback = "/add";
  for (const command of commands) {
    const normalized = command.toLowerCase();
    if (normalized !== "/start" && normalized !== "/help") {
      return command;
    }
  }
  return commands.find((command) => command.toLowerCase() !== "/start") || fallback;
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

function resolveStoragePlan(currentState) {
  const key = (currentState?.backend || "json").toLowerCase();
  const entry = BACKEND_LIBRARY[key] || BACKEND_LIBRARY.json;
  return {
    summary: entry.codexSummary,
    tasks: entry.codexTasks,
  };
}

function getBackendDefinition(currentState) {
  const key = (currentState?.backend || "json").toLowerCase();
  return BACKEND_LIBRARY[key] || BACKEND_LIBRARY.json;
}

function backendPromptHeader(currentState) {
  const commands = getCommandList(currentState);
  const commandLine = commands.length
    ? `Commands in scope: ${commands.join(", ")}.`
    : "Commands in scope: /start, /help.";

  return [
    "You are Copilot helping me adjust an aiogram v3 Telegram bot.",
    commandLine,
    "",
    "Project brief:",
    makeDevBrief(currentState),
    "",
  ].join("\n");
}

function buildBackendPrompt(currentState, instructions) {
  const header = backendPromptHeader(currentState);
  const bodyLines = Array.isArray(instructions) ? instructions : [instructions];
  return [header, ...bodyLines].join("\n");
}

function enhancementPromptHeader(currentState) {
  const commands = getCommandList(currentState);
  const commandLine = commands.length
    ? `Planned commands: ${commands.join(", ")}.`
    : "Planned commands: /start, /help.";

  return [
    "You are Copilot helping me extend an aiogram v3 Telegram bot.",
    commandLine,
    "",
    "Project brief:",
    makeDevBrief(currentState),
    "",
  ].join("\n");
}

function buildEnhancementPrompt(currentState, instructions) {
  const header = enhancementPromptHeader(currentState);
  const bodyLines = Array.isArray(instructions) ? instructions : [instructions];
  return [header, ...bodyLines].join("\n");
}

function createPromptCopyBlock(promptValue, buttonLabel = "Скопіювати промпт") {
  const wrapper = document.createElement("div");
  wrapper.className = "prompt-wrapper";

  const textarea = document.createElement("textarea");
  textarea.className = "prompt-preview";
  textarea.readOnly = true;
  textarea.rows = 12;
  textarea.value = promptValue;
  textarea.setAttribute("aria-label", "Готовий промпт");

  const actions = document.createElement("div");
  actions.className = "prompt-actions";

  const status = document.createElement("span");
  status.className = "prompt-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.textContent = "";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "step__copy";
  button.textContent = buttonLabel;
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(textarea.value);
      status.textContent = "Скопійовано";
    } catch (error) {
      status.textContent = "Скопіюйте вручну";
    }
    window.clearTimeout(button._statusTimeout);
    button._statusTimeout = window.setTimeout(() => {
      status.textContent = "";
    }, 3000);
  });

  actions.append(button, status);
  wrapper.append(textarea, actions);

  return wrapper;
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
    id: "backend",
    title: "Як зберігати дані",
    desc: "Оберіть варіант збереження і виконайте маленькі підкроки для налаштування.",
    when(state) {
      return Boolean(state.environment);
    },
    render(container, ctx) {
      const info = document.createElement("p");
      info.textContent =
        "Кожен варіант підкаже, як налаштувати збереження даних. Оберіть той, що підходить проєкту.";

      const optionList = document.createElement("div");
      optionList.className = "option-list";

      Object.entries(BACKEND_LIBRARY).forEach(([value, option]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "option-card";
        button.dataset.value = value;
        const isActive = ctx.state.backend === value;
        button.setAttribute("aria-pressed", String(isActive));
        if (isActive) {
          button.classList.add("option-card--active");
        }

        const title = document.createElement("span");
        title.className = "option-card__title";
        title.textContent = option.cardTitle;

        const desc = document.createElement("span");
        desc.className = "option-card__desc";
        desc.textContent = option.cardDesc;

        button.append(title, desc);

        button.addEventListener("click", () => {
          ctx.updateState((draft) => {
            const changed = draft.backend !== value;
            draft.backend = value;
            draft.notes = {
              ...(draft.notes || {}),
            };
            if (changed) {
              draft.notes.backendChecklist = {};
            }
          }, { rerender: true });
        });

        optionList.appendChild(button);
      });

      const tip = document.createElement("p");
      tip.className = "step__hint";
      tip.textContent =
        "Не впевнені з вибором? JSON — найпростіший старт. Можна змінити варіант будь-коли.";

      container.append(info, optionList, tip);

      if (!ctx.state.backend) {
        const waitInfo = document.createElement("p");
        waitInfo.className = "step__hint";
        waitInfo.textContent = "Після вибору з'являться детальні підкроки.";
        container.appendChild(waitInfo);
        return;
      }

      const backend = getBackendDefinition(ctx.state);

      const summary = document.createElement("p");
      summary.className = "step__hint";
      summary.textContent = `${backend.cardTitle}: ${backend.codexSummary}`;
      container.appendChild(summary);

      const substeps = document.createElement("div");
      substeps.className = "backend-substeps";

      const checklistState = ctx.state.notes?.backendChecklist || {};

      backend.steps.forEach((subStep, index) => {
        const key = `${ctx.state.backend}:${subStep.id}`;
        const isDone = Boolean(checklistState[key]);

        const section = document.createElement("section");
        section.className = "backend-substep";

        const heading = document.createElement("h3");
        heading.className = "backend-substep__title";
        heading.textContent = `${index + 1}. ${subStep.title}`;

        const explanation = document.createElement("p");
        explanation.className = "backend-substep__body";
        explanation.textContent = subStep.explanation;

        const promptArea = document.createElement("textarea");
        promptArea.className = "backend-substep__prompt";
        promptArea.readOnly = true;
        promptArea.rows = 10;
        promptArea.value = buildBackendPrompt(ctx.state, subStep.instructions);
        promptArea.setAttribute("aria-label", subStep.title);

        const actions = document.createElement("div");
        actions.className = "backend-substep__actions";

        const status = document.createElement("span");
        status.className = "backend-substep__status";
        status.setAttribute("role", "status");
        status.setAttribute("aria-live", "polite");

        const copyButton = document.createElement("button");
        copyButton.type = "button";
        copyButton.className = "step__copy";
        copyButton.textContent = "Copy prompt";
        copyButton.addEventListener("click", async () => {
          try {
            await navigator.clipboard.writeText(promptArea.value);
            status.textContent = "Скопійовано";
          } catch (error) {
            status.textContent = "Не вдалося скопіювати — зробіть це вручну.";
          }
          window.clearTimeout(copyButton._statusTimeout);
          copyButton._statusTimeout = window.setTimeout(() => {
            status.textContent = "";
          }, 3000);
        });

        actions.append(copyButton, status);

        const checkboxLabel = document.createElement("label");
        checkboxLabel.className = "step-check";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = isDone;
        checkbox.addEventListener("change", (event) => {
          ctx.updateState((draft) => {
            draft.notes = {
              ...(draft.notes || {}),
              backendChecklist: {
                ...(draft.notes?.backendChecklist || {}),
              },
            };
            if (event.target.checked) {
              draft.notes.backendChecklist[key] = true;
            } else {
              delete draft.notes.backendChecklist[key];
            }
          });
        });

        const checkboxText = document.createElement("span");
        checkboxText.textContent = "✅ Виконано";

        checkboxLabel.append(checkbox, checkboxText);

        section.append(
          heading,
          explanation,
          promptArea,
          actions,
          checkboxLabel
        );

        substeps.appendChild(section);
      });

      container.appendChild(substeps);
    },
  },
  {
    id: "addons",
    title: "Додаткові можливості",
    desc: "Оберіть, які поліпшення потрібні саме вашому боту.",
    when(state) {
      return Boolean(state.environment);
    },
    render(container, ctx) {
      const info = document.createElement("p");
      info.textContent =
        "Можна додати візуальні покращення, розширену статистику або приймання оплат. Оберіть те, що справді допоможе користувачам.";

      const toggles = [
        {
          key: "design",
          title: "Дизайн і кнопки",
          desc: "Reply-меню, inline-кнопки та дружні тексти з емодзі.",
        },
        {
          key: "stats",
          title: "Статистика",
          desc: "Прокачана /stats і нагадування о 20:00.",
        },
        {
          key: "payments",
          title: "Оплати",
          desc: "Stripe або WayForPay + команда /buy.",
        },
      ];

      const optionList = document.createElement("div");
      optionList.className = "option-list";

      toggles.forEach((toggle) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "option-card";
        button.dataset.value = toggle.key;
        const isActive = Boolean(ctx.state.addons?.[toggle.key]);
        if (isActive) {
          button.classList.add("option-card--active");
        }
        button.setAttribute("aria-pressed", String(isActive));

        const title = document.createElement("span");
        title.className = "option-card__title";
        title.textContent = toggle.title;

        const description = document.createElement("span");
        description.className = "option-card__desc";
        description.textContent = toggle.desc;

        button.append(title, description);

        button.addEventListener("click", () => {
          ctx.updateState((draft) => {
            draft.addons = {
              ...(draft.addons || {}),
            };
            const nextValue = !draft.addons[toggle.key];
            draft.addons[toggle.key] = nextValue;
            if (!nextValue) {
              clearAddonProgress(draft, toggle.key);
            }
          }, { rerender: true });
        });

        optionList.appendChild(button);
      });

      const hint = document.createElement("p");
      hint.className = "step__hint";
      hint.textContent =
        "Обрані блоки з'являться нижче як окремі кроки. Можна повернутися та змінити вибір у будь-який момент.";

      container.append(info, optionList, hint);
    },
  },
  {
    id: "addon-design-reply",
    title: "Reply-меню з основними кнопками",
    desc: "Додамо головне меню, щоб команди були під рукою.",
    when(state) {
      return Boolean(state.addons?.design);
    },
    render(container, ctx) {
      const explanation = document.createElement("p");
      explanation.textContent =
        "Меню з кнопками під полем вводу допоможе новачкам — достатньо натиснути потрібну дію без ручного введення.";

      const checklist = document.createElement("ul");
      checklist.className = "step__list";
      [
        "У Cursor відкрийте файл із командами (src/main.py або src/handlers/basic.py).",
        "Скопіюйте промпт і вставте в Codex, щоб він додав ReplyKeyboardMarkup та показував його після /start і /help.",
        "Після відповіді запустіть бота й перевірте, що меню з кнопками з'являється у Telegram.",
      ].forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        checklist.appendChild(li);
      });

      const promptText = buildEnhancementPrompt(ctx.state, [
        "Task: Add a ReplyKeyboardMarkup main menu for the primary commands so users can tap instead of typing.",
        "Requirements:",
        "1. Create a helper (e.g. build_main_menu()) that returns ReplyKeyboardMarkup with resize_keyboard=True and row width 2.",
        "2. Send the keyboard in the /start handler and when replying to /help so the menu stays visible.",
        "3. Ensure handlers still react when the user presses the buttons (text payload).",
        "Return the updated Python files only.",
      ]);

      const promptBlock = createPromptCopyBlock(promptText);

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

      container.append(explanation, checklist, promptBlock, checkboxLabel);
    },
  },
  {
    id: "addon-design-inline",
    title: "Inline-кнопки під списками",
    desc: "Дамо можливість відмічати виконання без команд.",
    when(state) {
      return Boolean(state.addons?.design);
    },
    render(container, ctx) {
      const explanation = document.createElement("p");
      explanation.textContent =
        "Коли бот показує список задач, корисно відразу дати кнопки “Готово” чи “Пропустити”.";

      const checklist = document.createElement("ul");
      checklist.className = "step__list";
      [
        "Перевірте, яка команда показує список (/list, /clients тощо).",
        "Скопіюйте промпт у Codex, щоб він додав InlineKeyboardMarkup із кнопками Done/Skip/Info.",
        "Переконайтеся, що callback-обробники оновлюють повідомлення та дані збереження.",
      ].forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        checklist.appendChild(li);
      });

      const promptText = buildEnhancementPrompt(ctx.state, [
        "Task: Enhance the list output so every entry shows InlineKeyboardMarkup with actions (Done, Skip, Details/Stats).",
        "Requirements:",
        "1. Generate inline buttons with callback data that identifies the item id.",
        "2. Handle callbacks to mark items done/skip and update the message text using edit_message_text.",
        "3. Keep storage writes consistent with the selected backend and send confirmations to the user.",
        "Return the updated Python files only.",
      ]);

      const promptBlock = createPromptCopyBlock(promptText);

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

      container.append(explanation, checklist, promptBlock, checkboxLabel);
    },
  },
  {
    id: "addon-design-tone",
    title: "Дружні тексти з емодзі",
    desc: "Оновимо відповіді бота, щоб вони звучали тепліше.",
    when(state) {
      return Boolean(state.addons?.design);
    },
    render(container, ctx) {
      const explanation = document.createElement("p");
      explanation.textContent =
        "Короткі тексти з емодзі допомагають підтримати користувача та пояснити наступний крок.";

      const checklist = document.createElement("ul");
      checklist.className = "step__list";
      [
        "Перегляньте повідомлення, які бот надсилає у відповідь на /start, /help та інші успішні дії.",
        "Попросіть Codex замінити тексти на дружні українські фрази з емодзі, зберігши логіку коду.",
        "Перевірте у Telegram, що повідомлення читаються легко і без помилок.",
      ].forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        checklist.appendChild(li);
      });

      const promptText = buildEnhancementPrompt(ctx.state, [
        "Task: Refresh the bot messages so they use friendly Ukrainian copy with emoji aligned to the project tone.",
        "Requirements:",
        "1. Update responses for /start, /help, success confirmations, and error hints.",
        "2. Keep business logic untouched; change only the text shown to the user.",
        "3. Make sure the copy references the bot's goal described in the brief.",
        "Return the updated Python files only.",
      ]);

      const promptBlock = createPromptCopyBlock(promptText);

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

      container.append(explanation, checklist, promptBlock, checkboxLabel);
    },
  },
  {
    id: "addon-stats-command",
    title: "Розширена команда /stats",
    desc: "Зробимо короткий звіт за 7 та 30 днів.",
    when(state) {
      return Boolean(state.addons?.stats);
    },
    render(container, ctx) {
      const explanation = document.createElement("p");
      explanation.textContent =
        "Користувач одразу побачить прогрес: скільки задач виконано за тиждень і місяць.";

      const checklist = document.createElement("ul");
      checklist.className = "step__list";
      [
        "Перевірте, як зараз виглядає /stats або створіть її, якщо команди ще немає.",
        "Скопіюйте промпт і вставте в Codex, щоб додати підрахунок за 7 та 30 днів з урахуванням вашого сховища.",
        "Перевірте результат у Telegram і переконайтеся, що для пустих даних є дружнє повідомлення.",
      ].forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        checklist.appendChild(li);
      });

      const promptText = buildEnhancementPrompt(ctx.state, [
        "Task: Implement a /stats command that summarises progress for the last 7 and 30 days using the chosen storage backend.",
        "Requirements:",
        "1. Add helpers to compute totals of completed and pending items for 7 and 30 day windows.",
        "2. Handle the case where no data exists with a friendly Ukrainian message.",
        "3. Keep responses compact so they fit into one Telegram message.",
        "Return the updated Python modules only.",
      ]);

      const promptBlock = createPromptCopyBlock(promptText);

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

      container.append(explanation, checklist, promptBlock, checkboxLabel);
    },
  },
  {
    id: "addon-stats-report",
    title: "Красиве форматування звіту",
    desc: "Додамо табличку, відсотки та емодзі.",
    when(state) {
      return Boolean(state.addons?.stats);
    },
    render(container, ctx) {
      const explanation = document.createElement("p");
      explanation.textContent =
        "Зрозумілий формат допоможе швидко прочитати результати й мотивуватися далі.";

      const checklist = document.createElement("ul");
      checklist.className = "step__list";
      [
        "Перевірте, як /stats показує інформацію після попереднього кроку.",
        "Попросіть Codex відформатувати звіт: додати таблицю або список з емодзі та відсотками.",
        "Переконайтеся, що повідомлення не перевищує ліміти Telegram і легко читається на мобільному.",
      ].forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        checklist.appendChild(li);
      });

      const promptText = buildEnhancementPrompt(ctx.state, [
        "Task: Improve the /stats response with formatted output that highlights last 7 and 30 day results.",
        "Requirements:",
        "1. Use emoji, headings, or monospace tables so the report is easy to scan.",
        "2. Show totals, percentages, and streak information if available.",
        "3. Keep the message under Telegram's length limits and maintain Ukrainian copy.",
        "Return the updated Python files only.",
      ]);

      const promptBlock = createPromptCopyBlock(promptText);

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

      container.append(explanation, checklist, promptBlock, checkboxLabel);
    },
  },
  {
    id: "addon-stats-reminder",
    title: "Щоденне нагадування о 20:00",
    desc: "Бот ввічливо нагадає довести справи до кінця.",
    when(state) {
      return Boolean(state.addons?.stats);
    },
    render(container, ctx) {
      const explanation = document.createElement("p");
      explanation.textContent =
        "Регулярні нагадування допомагають не забути про задачі. Запустимо простий таймер у фоні.";

      const checklist = document.createElement("ul");
      checklist.className = "step__list";
      [
        "Визначте, куди найкраще додати запуск фонового таска (наприклад, on_startup у main.py).",
        "Скопіюйте промпт у Codex, щоб він створив нескінченний цикл з asyncio.sleep до 20:00 та надсилав нагадування.",
        "Протестуйте локально: тимчасово поставте короткий інтервал і перевірте, що бот надсилає повідомлення лише один раз на день.",
      ].forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        checklist.appendChild(li);
      });

      const promptText = buildEnhancementPrompt(ctx.state, [
        "Task: Add a background job that sends a friendly reminder every day at 20:00 local time if there are pending items.",
        "Requirements:",
        "1. Start the job on application startup using asyncio (no external scheduler required).",
        "2. Allow configuring the reminder time via a constant so it can be changed later.",
        "3. Use the storage layer to check whether the user still has unfinished tasks before sending the message.",
        "Return the updated Python files only and document the new behaviour in README.md.",
      ]);

      const promptBlock = createPromptCopyBlock(promptText);

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

      container.append(explanation, checklist, promptBlock, checkboxLabel);
    },
  },
  {
    id: "addon-payments-provider",
    title: "Оберіть платіжний провайдер",
    desc: "Stripe — міжнародні картки, WayForPay — українські.",
    when(state) {
      return Boolean(state.addons?.payments);
    },
    render(container, ctx) {
      const info = document.createElement("p");
      info.textContent =
        "Обраний провайдер визначить наступні інструкції. Якщо не впевнені — почніть зі Stripe (достатньо картки) або WayForPay (швидка реєстрація в Україні).";

      const optionList = document.createElement("div");
      optionList.className = "option-list";

      Object.values(PAYMENT_PROVIDERS).forEach((provider) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "option-card";
        button.dataset.value = provider.key;
        const isActive = ctx.state.payments?.provider === provider.key;
        if (isActive) {
          button.classList.add("option-card--active");
        }
        button.setAttribute("aria-pressed", String(isActive));

        const title = document.createElement("span");
        title.className = "option-card__title";
        title.textContent = provider.title;

        const description = document.createElement("span");
        description.className = "option-card__desc";
        description.textContent = provider.description;

        const meta = document.createElement("span");
        meta.className = "option-card__meta";
        meta.textContent = "Відкрити інструкцію";
        meta.addEventListener("click", (event) => {
          event.stopPropagation();
          const newWindow = window.open(provider.docs, "_blank", "noopener");
          if (newWindow) {
            newWindow.opener = null;
          }
        });

        button.append(title, description, meta);

        button.addEventListener("click", () => {
          ctx.updateState((draft) => {
            draft.payments = {
              ...(draft.payments || {}),
              provider: provider.key,
            };
            if (!draft.ack) {
              draft.ack = {};
            }
            ADDON_DEPENDENCIES.payments.forEach((stepId) => {
              if (stepId !== "addon-payments-provider" && draft.ack[stepId]) {
                delete draft.ack[stepId];
              }
            });
          }, { rerender: true });
          ctx.markComplete();
        });

        optionList.appendChild(button);
      });

      const hint = document.createElement("p");
      hint.className = "step__hint";
      hint.textContent =
        "Після вибору провайдера збережіть його акаунтні дані. Наступні кроки підкажуть, які саме.";

      container.append(info, optionList, hint);
    },
  },
  {
    id: "addon-payments-env",
    title: "Додайте ключі в .env",
    desc: "Збережемо конфіденційні дані для оплати.",
    when(state) {
      return Boolean(state.addons?.payments && state.payments?.provider);
    },
    render(container, ctx) {
      const provider = getPaymentProviderConfig(ctx.state);
      if (!provider) {
        const warning = document.createElement("p");
        warning.textContent =
          "Спочатку оберіть платіжний провайдер на попередньому кроці.";
        container.appendChild(warning);
        return;
      }

      const explanation = document.createElement("p");
      explanation.textContent =
        "Ключі з кабінету провайдера зберігаємо в .env і дублюємо у .env.example з підказками.";

      const envList = document.createElement("ul");
      envList.className = "step__list";
      provider.envKeys.forEach((entry) => {
        const li = document.createElement("li");
        li.textContent = `${entry.key} — ${entry.label}`;
        envList.appendChild(li);
      });

      const promptText = buildEnhancementPrompt(ctx.state, [
        ...provider.envPrompt,
        "Document the new variables in README.md so users know where to paste them.",
      ]);

      const promptBlock = createPromptCopyBlock(promptText);

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

      container.append(explanation, envList, promptBlock, checkboxLabel);
    },
  },
  {
    id: "addon-payments-handler",
    title: "Команда /buy",
    desc: "Бот згенерує посилання на оплату.",
    when(state) {
      return Boolean(state.addons?.payments && state.payments?.provider);
    },
    render(container, ctx) {
      const provider = getPaymentProviderConfig(ctx.state);
      if (!provider) {
        const warning = document.createElement("p");
        warning.textContent =
          "Спочатку оберіть платіжний провайдер на попередньому кроці.";
        container.appendChild(warning);
        return;
      }

      const explanation = document.createElement("p");
      explanation.textContent =
        "Створимо команду /buy, яка генерує безпечне посилання для оплати та пояснює наступні кроки користувачу.";

      const checklist = document.createElement("ul");
      checklist.className = "step__list";
      [
        "Скопіюйте промпт і попросіть Codex створити логіку /buy з урахуванням вашого сховища.",
        "Запустіть бота, виконайте /buy та переконайтеся, що отримали посилання.",
        "Перевірте, що README містить інструкцію як протестувати оплату в тестовому режимі.",
      ].forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        checklist.appendChild(li);
      });

      const promptText = buildEnhancementPrompt(ctx.state, [
        ...provider.handlerPrompt,
        "Update README.md with steps for running a test payment.",
      ]);

      const promptBlock = createPromptCopyBlock(promptText);

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

      container.append(explanation, checklist, promptBlock, checkboxLabel);
    },
  },
  {
    id: "addon-payments-success",
    title: "Підтвердження оплати",
    desc: "Відмітимо користувача як premium і подякуємо.",
    when(state) {
      return Boolean(state.addons?.payments && state.payments?.provider);
    },
    render(container, ctx) {
      const provider = getPaymentProviderConfig(ctx.state);
      if (!provider) {
        const warning = document.createElement("p");
        warning.textContent =
          "Спочатку оберіть платіжний провайдер на попередньому кроці.";
        container.appendChild(warning);
        return;
      }

      const explanation = document.createElement("p");
      explanation.textContent =
        "Після успішної оплати бот має подякувати, відкрити доступ до преміум-можливостей і записати статус користувача.";

      const checklist = document.createElement("ul");
      checklist.className = "step__list";
      [
        "Скопіюйте промпт у Codex, щоб він реалізував підтвердження оплати (webhook або перевірка статусу).",
        "Додайте дружнє повідомлення з емодзі, яке пояснює, що відкрито після оплати.",
        "Переконайтеся, що у сховищі з'являється позначка premium/purchased для користувача.",
      ].forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        checklist.appendChild(li);
      });

      const promptText = buildEnhancementPrompt(ctx.state, [
        ...provider.successPrompt,
        "Document how to run end-to-end payment testing (test cards or sandbox invoice).",
      ]);

      const promptBlock = createPromptCopyBlock(promptText);

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

      container.append(explanation, checklist, promptBlock, checkboxLabel);
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
  {
    id: "launch",
    title: "Запуск бота",
    desc: "Відкрийте термінал і виконайте команди по черзі, щоб запустити свій проєкт.",
    when(state) {
      return Boolean(state.environment);
    },
    render(container, ctx) {
      const env = ctx.state.environment || "local";

      const intro = document.createElement("p");
      intro.textContent =
        env === "local"
          ? "У VS Code або Cursor відкрийте вбудований термінал: меню View → Terminal або натисніть Ctrl+` (на macOS — ⌃`)."
          : "У GitHub Codespaces натисніть Terminal → New Terminal. Вікно з командами з'явиться внизу або праворуч.";

      const instructions = document.createElement("ol");
      instructions.className = "step__list";

      const instructionTexts =
        env === "local"
          ? [
              "Переконайтеся, що термінал відкрито в папці з вашим проєктом (підказка: в рядку має бути назва папки).",
              "Виконуйте команди нижче по одній: вводьте рядок, натискайте Enter і чекайте завершення (рядок із знаком $ не набираємо).",
              "Якщо бачите слово error — зупиніться, скопіюйте текст помилки та надішліть його Навігатору (ChatGPT) разом із запитанням.",
            ]
          : [
              "Переконайтеся, що відкрито вкладку Terminal в Codespaces. Якщо її не видно, натисніть кнопку "+" поруч із панеллю терміналів.",
              "Виконуйте команди по черзі: після кожної дочекайтеся завершення, потім переходьте до наступної.",
              "У разі помилки скористайтеся кнопкою “Проблема?” у панелі або опишіть ситуацію Навігатору, додавши текст помилки.",
            ];

      instructionTexts.forEach((text) => {
        const li = document.createElement("li");
        li.textContent = text;
        instructions.appendChild(li);
      });

      const commandSnippet = document.createElement("div");
      commandSnippet.className = "code-snippet";

      const commandBlock = document.createElement("pre");
      commandBlock.className = "code-block";

      const localCommands = [
        "# Перевірка встановленого Python",
        "python --version",
        "",
        "# Створення віртуального середовища",
        "python -m venv .venv",
        "source .venv/bin/activate  # macOS / Linux",
        ".\\.venv\\Scripts\\activate  # Windows PowerShell",
        "",
        "# Встановлення залежностей та запуск",
        "pip install -r requirements.txt",
        "python main.py",
      ].join("\n");

      const codespacesCommands = [
        "python --version",
        "pip install -r requirements.txt",
        "python main.py",
      ].join("\n");

      const commandText = env === "local" ? localCommands : codespacesCommands;
      commandBlock.textContent = commandText;

      const snippetActions = document.createElement("div");
      snippetActions.className = "code-snippet__actions";

      const snippetStatus = document.createElement("span");
      snippetStatus.className = "code-snippet__status";
      snippetStatus.setAttribute("role", "status");
      snippetStatus.setAttribute("aria-live", "polite");

      const copyButton = document.createElement("button");
      copyButton.type = "button";
      copyButton.className = "step__copy";
      copyButton.textContent = "Скопіювати команди";
      copyButton.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(commandText);
          snippetStatus.textContent = "Скопійовано";
        } catch (error) {
          snippetStatus.textContent = "Не вдалося — скопіюйте вручну.";
        }
        window.clearTimeout(copyButton._timeoutId);
        copyButton._timeoutId = window.setTimeout(() => {
          snippetStatus.textContent = "";
        }, 3000);
      });

      snippetActions.append(copyButton, snippetStatus);
      commandSnippet.append(commandBlock, snippetActions);

      const reminder = document.createElement("p");
      reminder.className = "step__hint";
      reminder.textContent =
        "Після кожного запуску переконайтеся, що Cursor повідомив “Bot is polling...”. Якщо вікно закрилося одразу — перегляньте помилку в терміналі.";

      const supportList = document.createElement("ul");
      supportList.className = "step__list";
      [
        "Команда не знайдена? Перевірте, що перебуваєте у правильній папці або активували .venv.",
        "Бібліотека не встановлена? Запустіть pip install -r requirements.txt ще раз і дочекайтеся зеленого повідомлення.",
        "Помилка з токеном? Переконайтеся, що файл .env містить правильний TOKEN і ви перезапустили python main.py.",
      ].forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        supportList.appendChild(li);
      });

      container.append(intro, instructions, commandSnippet, reminder, supportList);
    },
  },
  {
    id: "test-checklist",
    title: "Тестуємо бота в Telegram",
    desc: "Перевірте, що бот відповідає на ключові команди.",
    when(state) {
      return Boolean(state.environment);
    },
    render(container, ctx) {
      const customCommand = getPrimaryCustomCommand(ctx.state);

      const intro = document.createElement("p");
      intro.textContent =
        "Відкрийте чат із ботом у Telegram (можна натиснути на посилання з BotFather) і виконайте короткий тест.";

      const checklist = document.createElement("ol");
      checklist.className = "step__list";
      [
        "Надішліть /start — бот має привітатися та пояснити, що робити далі.",
        "Надішліть /help — переконайтеся, що список команд читається та зрозумілий.",
        `Спробуйте ${customCommand} — перевірте, що команда працює за сценарієм (наприклад, додає запис або показує дані).`,
      ].forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        checklist.appendChild(li);
      });

      const hint = document.createElement("p");
      hint.className = "step__hint";
      hint.textContent =
        "Якщо бот не відповідає, поверніться до попереднього кроку, перегляньте термінал або надішліть Навігатору текст помилки.";

      container.append(intro, checklist, hint);
    },
  },
  {
    id: "finish",
    title: "Вітаємо!", 
    desc: "Бот уже працює. Оберіть, що робимо далі.",
    when(state) {
      return Boolean(state.environment);
    },
    render(container, ctx) {
      const summary = document.createElement("p");
      summary.textContent =
        "Ви пройшли базовий шлях: зібрали опис, створили файли, запустили бота і перевірили команди.";

      const followUp = document.createElement("p");
      followUp.className = "step__hint";
      followUp.textContent =
        "Далі можна зробити нового бота або прокачати поточного — усі додаткові блоки доступні у розділі “Додаткові можливості”.";

      const actions = document.createElement("div");
      actions.className = "finish-actions";

      const restartButton = document.createElement("button");
      restartButton.type = "button";
      restartButton.className = "finish-button";
      restartButton.textContent = "Створити іншого бота";
      restartButton.addEventListener("click", () => {
        ctx.updateState((draft) => {
          const fresh = getDefaultState();
          Object.keys(draft).forEach((key) => {
            delete draft[key];
          });
          Object.assign(draft, fresh);
        });
        setStep(0);
      });

      const improveButton = document.createElement("button");
      improveButton.type = "button";
      improveButton.className = "finish-button finish-button--primary";
      improveButton.textContent = "Покращити цього бота";
      improveButton.addEventListener("click", () => {
        if (!ctx.isComplete()) {
          ctx.markComplete();
        }
        requestAnimationFrame(() => {
          const visible = getVisibleSteps();
          const addonsIndex = visible.findIndex((step) => step.id === "addons");
          if (addonsIndex >= 0) {
            setStep(addonsIndex);
          }
        });
      });

      actions.append(restartButton, improveButton);

      container.append(summary, followUp, actions);
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
    notes: {
      backendChecklist: {},
    },
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
