const STORAGE_KEY = 'ztb_v4_state';

// --- Довідкові дані ---
const BOT_TYPES = [
  {
    id: 'crm',
    title: 'CRM',
    description: 'Веде клієнтів і завдання',
    commands: ['/start', '/help', '/add', '/clients', '/tasks', '/done', '/stats'],
    tips: [
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
    tips: [
      'Фіксуй виконавця, дедлайн та статус.',
      'Стартуй із JSON, переходь на SQLite, коли команда виросте.',
      'Додай нагадування про дедлайни.'
    ]
  },
  {
    id: 'habit',
    title: 'Habit Tracker',
    description: 'Щоденні звички й нагадування',
    commands: ['/start', '/help', '/add', '/habits', '/done', '/streak', '/plan', '/stats'],
    tips: [
      'Записуй назву звички, час доби та прогрес.',
      'Нагадування — обов’язкові.',
      'Зберігання: JSON (старт) або SQLite (звітність).'
    ]
  },
  {
    id: 'faq',
    title: 'FAQ / Support',
    description: 'Відповідає на типові питання',
    commands: ['/start', '/help', '/faq', '/contact', '/tips'],
    tips: [
      'Контент тримай у Google Sheets — легко оновлювати.',
      'Додай кнопки “Написати менеджеру”, “Отримати знижку”.',
      'Пиши коротко, дружньо, з емодзі.'
    ]
  },
  {
    id: 'shop',
    title: 'Shop',
    description: 'Міні-магазин у Telegram',
    commands: ['/start', '/help', '/catalog', '/buy', '/cart', '/pay', '/support'],
    tips: [
      'Каталог = назва, опис, ціна, наявність.',
      'Бекенд: SQLite + Stripe/WayForPay.',
      'Повідомляй менеджера про нові замовлення.'
    ]
  },
  {
    id: 'booking',
    title: 'Booking',
    description: 'Запис на послуги',
    commands: ['/start', '/help', '/book', '/slots', '/cancel', '/contact'],
    tips: [
      'Фіксуй дату, час, клієнта, статус.',
      'SQLite або Google Sheets — чудовий вибір.',
      'Налаштуй нагадування за 2 години до зустрічі.'
    ]
  },
  {
    id: 'custom',
    title: 'Custom',
    description: 'Свій сценарій',
    commands: ['/start', '/help'],
    tips: [
      'Почни з мінімуму: /start, /help та 2-3 ключові команди.',
      'Розбивай фічі на модулі за прикладом цього гайда.',
      'JSON — для старту, SQLite — для масштабу.'
    ]
  }
];

const MODE_OPTIONS = [
  { id: 'chatgpt', title: 'ChatGPT-only', description: 'Безкоштовно, але код переносиш вручну.' },
  { id: 'codex', title: 'ChatGPT + Codex (Copilot)', description: 'Потрібна підписка. Швидше та чистіше.' }
];

const ENVIRONMENTS = [
  { id: 'local', title: '💻 Local', description: 'Працюєш на власному комп’ютері. Потрібно встановити Python.' },
  { id: 'codespaces', title: '☁️ Codespaces', description: 'Все у браузері через GitHub. Python встановлювати не треба.' }
];

const ENTRY_FILE_OPTIONS = [
  { id: 'main.py', label: 'main.py' },
  { id: 'app.py', label: 'app.py' }
];

const TOOL_CHECKLIST = [
  { id: 'python', label: 'Python 3.10+ встановлено' },
  { id: 'editor', label: 'Редактор відкривається (VS Code / Cursor)' },
  { id: 'github', label: 'Є обліковий запис GitHub' },
  { id: 'copilot', label: 'Copilot увімкнений (для режиму Codex)', optional: true }
];

const BACKEND_OPTIONS = [
  {
    id: 'json',
    title: 'JSON файл',
    summary: 'Найпростіше зберігання у файлі.',
    steps: [
      { text: 'Створи папку `data/` і файл `db.json`.' },
      {
        text: 'Попроси ШІ додати функції читання/запису JSON.',
        prompt: 'Додай у проект функції load_data та save_data для файлу data/db.json. Якщо файлу немає — створюй його автоматично.'
      },
      { text: 'Підключи функції у хендлері `/add`.' },
      { text: 'Тест: `/add` → запис з’явився у `db.json`.' }
    ]
  },
  {
    id: 'sqlite',
    title: 'SQLite',
    summary: 'База у файлі. Ідеальна для невеликих проєктів.',
    steps: [
      { text: 'Створи файл `db.sqlite3`.' },
      {
        text: 'Попроси ШІ створити таблицю tasks (id, name, status).',
        prompt: 'Додай SQLite з таблицею tasks (id INTEGER PK, name TEXT, status TEXT) та CRUD-функціями.'
      },
      { text: 'Підключи репозиторій до команд /add, /list, /done.' },
      { text: 'Тест: `/add` → запис у таблиці.' }
    ]
  },
  {
    id: 'gsheets',
    title: 'Google Sheets',
    summary: 'Онлайн-таблиця як база даних.',
    steps: [
      { text: 'Створи Google Sheet, увімкни доступ “за посиланням”.' },
      {
        text: 'Попроси ШІ підключити gspread до таблиці.',
        prompt: 'Підключи gspread до Google Sheets. Використай .env: GOOGLE_CREDENTIALS (JSON), SHEET_ID.'
      },
      { text: 'Додай функцію запису рядків.' },
      { text: 'Тест: `/add` → новий рядок у таблиці.' }
    ]
  },
  {
    id: 'postgres',
    title: 'Postgres (Docker)',
    summary: 'Потужна база для командних проєктів.',
    steps: [
      { text: 'Встанови Docker Desktop.' },
      {
        text: 'Створи `docker-compose.yml` з Postgres.',
        prompt: 'Створи docker-compose.yml з Postgres (POSTGRES_PASSWORD=postgres, порт 5432) та сервісом для бота.'
      },
      {
        text: 'Підключи Postgres до aiogram.',
        prompt: 'Додай підключення до Postgres і CRUD для таблиці tasks. Використай psycopg2 або SQLAlchemy.'
      },
      { text: 'Інтегруй репозиторій у хендлери.' },
      { text: 'Тест: `/add` → запис у базі.' }
    ]
  }
];

const FILE_STRUCTURE_STATIC_FILES = [
  {
    path: 'requirements.txt',
    title: 'requirements.txt',
    description: 'Список Python-залежностей. Встав у корені проєкту.',
    content: 'aiogram==3.*\npython-dotenv'
  },
  {
    path: '.env',
    title: '.env',
    description: 'Файл із секретами (TOKEN, креденшли). Не додавай у git.',
    content: 'TOKEN=сюди_вставиш_токен'
  }
];

const FILE_STRUCTURE_BACKEND_MAP = {
  json: [
    {
      type: 'dir',
      path: 'data/',
      description: 'Папка під JSON-базу. Створи поруч із основним файлом.'
    },
    {
      type: 'static',
      path: 'data/db.json',
      description: 'Порожній файл, бот заповнить його автоматично.',
      content: '[]'
    }
  ],
  sqlite: [
    {
      type: 'info',
      path: 'db.sqlite3',
      description: 'SQLite створить файл сам під час запуску. Переконайся, що каталог доступний для запису.'
    }
  ],
  gsheets: [
    {
      type: 'note',
      description: 'Google Sheets не вимагає додаткових файлів: просто збережи дані для підключення у `.env`.'
    }
  ],
  postgres: [
    {
      type: 'ai',
      path: 'docker-compose.yml',
      description: 'Шаблон Docker для Postgres + сервісу бота. Згенеруй через ШІ та збережи поруч із основним файлом.',
      prompt: 'Мені потрібен файл docker-compose.yml. Створи сервіс postgres (POSTGRES_PASSWORD=postgres, порт 5432) і сервіс для бота. Покажи весь файл одним блоком.'
    }
  ]
};

const defaultCustomState = {
  requirements: '',
  briefText: '',
  brief: null,
  files: [],
  commandsText: '',
  diag: {
    description: '',
    logs: '',
    prompt: ''
  }
};

const DESIGN_STEPS = [
  {
    title: 'Що таке дизайн',
    items: ['Дизайн — вигляд бота: кнопки, меню, тексти. Робимо просто та зрозуміло.']
  },
  {
    title: 'Головне меню (Reply-кнопки)',
    items: [
      'Попроси ШІ: «Додай меню з кнопками: 📋 Завдання, 🧠 Поради, ⚙️ Налаштування. Поясни, куди вставити код.»',
      'Встав код → збережи → у Telegram введи `/start`.'
    ]
  },
  {
    title: 'Inline-кнопки',
    items: [
      'Попроси ШІ: «Додай inline-кнопки на сторінці “Завдання”: [✅ Готово] [❌ Пропустити] [📊 Статистика]. Опиши зміни у коді.»',
      'Встав код → протестуй у чаті.'
    ]
  },
  {
    title: 'Гарні тексти',
    items: [
      'Попроси ШІ: «Зроби дружні тексти з емодзі для відповіді /stats.»',
      'Перевір, як виглядає у чаті.'
    ]
  }
];

const STATS_STEPS = [
  {
    title: 'Команда /stats',
    items: [
      'Попроси ШІ: «Додай команду /stats, яка показує прогрес за сьогодні, тиждень і загалом. Покажи, де в main.py її розмістити.»',
      'Встав код → перевір у Telegram.'
    ]
  },
  {
    title: 'Красивий звіт',
    items: [
      'Попроси ШІ: «Додай форматований звіт з емодзі та відсотками.»',
      'Переконайся, що текст легко читати.'
    ]
  },
  {
    title: 'Щоденні нагадування',
    items: [
      'Попроси ШІ: «Налаштуй щоденний звіт о 20:00 (apscheduler або asyncio). Поясни, куди додати код.»',
      'Переконайся, що планувальник не блокує основний цикл.'
    ]
  }
];

const PAYMENT_METHODS = [
  {
    id: 'stripe',
    title: 'Stripe',
    description: 'Міжнародні картки (USD та інші валюти).',
    steps: [
      {
        text: 'Попроси ШІ: «Додай оплату Stripe на $5 і команду /buy. Після успіху надішли “Дякую за оплату!”. Поясни, куди вставити код.»',
        prompt: 'Додай у бота оплату Stripe на $5: команда /buy, успішна оплата → повідомлення “Дякую за оплату!”. Опиши необхідні файли/блоки.'
      },
      { text: 'Тест: посилання на оплату працює, оплата проходить.' }
    ]
  },
  {
    id: 'wayforpay',
    title: 'WayForPay',
    description: 'Українська платіжка (гривня).',
    steps: [
      {
        text: 'Попроси ШІ: «Додай WayForPay на 100 грн для “Преміум-доступ”. Після оплати відправ “Дякую!”. Опиши кроки інтеграції.»',
        prompt: 'Додай WayForPay оплату на 100 грн для “Преміум-доступ”. Після успіху відправ “Дякую!”. Додай інструкцію, які файли / ендпоінти змінюємо.'
      },
      { text: 'Тест: форма оплати відкривається і працює.' }
    ]
  }
];

const PAYMENT_INTRO = [
  'Зареєструйся у Stripe (stripe.com) або WayForPay (wayforpay.com).',
  'Додай у `.env` ключі STRIPE_KEY або WAYFORPAY_KEY.',
  'API-ключ — секрет. Не ділись ним у репозиторії.'
];

const LAUNCH_STEPS = [
  {
    title: 'Створення бота у BotFather',
    items: ['Перейди у `@BotFather` → команда `/newbot`.', 'Скопіюй токен та додай у `.env` як `TOKEN=...`.']
  },
  {
    title: 'Запуск',
    items: ['Виконай у терміналі: `python main.py`.', 'Якщо бачиш “Bot started” — усе добре.']
  },
  {
    title: 'Перевір команди',
    type: 'commands'
  },
  {
    title: 'Резервна копія',
    items: ['Скопіюй код у хмару або на GitHub (без `.env`).', 'Перезапусти бота та переконайся, що все працює.']
  }
];

const GROWTH_STEPS = [
  {
    title: 'Додаткові модулі',
    items: ['🔁 автозбереження', '🌍 багатомовність (uk/en)', '🧩 адмін-панель']
  },
  {
    title: 'Фініш',
    items: ['Повідомлення: «Готово! Ти створив свого Telegram-бота.»', 'Кнопки: 🔄 «Створити нового бота», 🚀 «Покращити поточного».']
  }
];

const defaultState = {
  currentStep: 0,
  choices: {
    botType: null,
    mode: null,
    environment: null,
    backend: null,
    entryFile: ENTRY_FILE_OPTIONS[0].id,
    payment: 'none'
  },
  tools: TOOL_CHECKLIST.reduce((acc, tool) => {
    acc[tool.id] = false;
    return acc;
  }, { requirements: false, env: false }),
  commands: ['/start', '/help'],
  custom: structuredClone(defaultCustomState)
};

const AI_LINKS = {
  chatgpt: 'https://chat.openai.com/',
  codex: 'https://cursor.com/'
};

function getEntryFile(currentState = state) {
  const available = ENTRY_FILE_OPTIONS.map((item) => item.id);
  const value = currentState?.choices?.entryFile;
  return available.includes(value) ? value : ENTRY_FILE_OPTIONS[0].id;
}

function ensureCustomState(targetState = state) {
  if (!targetState.custom) {
    targetState.custom = structuredClone(defaultCustomState);
  } else {
    if (targetState.custom.diag === undefined) targetState.custom.diag = { description: '', logs: '', prompt: '' };
    if (targetState.custom.files === undefined) targetState.custom.files = [];
  }
  return targetState.custom;
}

function isCustomBot(currentState = state) {
  return currentState?.choices?.botType === 'custom';
}

function generateCustomBriefPrompt() {
  const custom = ensureCustomState();
  const requirements = custom.requirements?.trim() || 'Опис ще не додано.';
  return `ТЗ: ${requirements}.
Зроби бриф для розробки бота. Відповідай строго валідним JSON без коментарів і зайвого тексту:
{
  "commands": [...],
  "files": [
    {"path": "...", "purpose": "...", "isSimple": true|false}
  ],
  "backend": {"language": "...", "framework": "...", "notes": "..."},
  "storage": {"type": "...", "details": "...", "reason": "..."},
  "ui": {
    "reply": {
      "needed": true|false,
      "buttons": [
        {"text": "...", "purpose": "..."}
      ],
      "notes": "..."
    },
    "inline": {
      "needed": true|false,
      "buttons": [
        {"text": "...", "purpose": "...", "callback": "..."}
      ],
      "notes": "..."
    }
  }
}`;
}

function generateManualFilePromptForSpec(brief, fileSpec) {
  const serializedBrief = JSON.stringify(brief, null, 2);
  const path = fileSpec.path || 'main.py';
  const purpose = fileSpec.purpose || 'Основна логіка';
  return [
    `Контекст бота: ${serializedBrief}.`,
    `Файл: ${path}. Призначення: ${purpose}.`,
    'Згенеруй повний вміст файлу, самодостатній, без пропусків.'
  ].join('\n');
}

function createSimpleFileInstructions(fileSpec) {
  const path = fileSpec.path || 'file.txt';
  const purpose = fileSpec.purpose || 'Допоміжний файл';
  return `Створи файл ${path}. Призначення: ${purpose}. Заповни відповідно до брифу та збережи у зазначеній директорії.`;
}

function updateCustomFilePlan(parsedBrief) {
  const custom = ensureCustomState();
  const previousStatus = new Map(custom.files.map((item) => [item.path, !!item.done]));
  const files = Array.isArray(parsedBrief?.files) ? parsedBrief.files : [];
  custom.files = files.map((fileSpec, index) => {
    const path = fileSpec?.path || `file_${index + 1}.txt`;
    const isSimple = !!fileSpec?.isSimple;
    return {
      id: `${index}-${path}`,
      path,
      purpose: fileSpec?.purpose || '',
      isSimple,
      instructions: isSimple ? createSimpleFileInstructions(fileSpec) : null,
      prompt: isSimple ? null : generateManualFilePromptForSpec(parsedBrief, fileSpec),
      done: previousStatus.get(path) || false
    };
  });
}

function deriveDefaultCommands(customState, entryFile) {
  const commands = [];
  const hasRequirements = customState.files.some((file) => file.path === 'requirements.txt');
  if (hasRequirements) commands.push('pip install -r requirements.txt');
  const pythonFile = customState.files.find((file) => /\.py$/i.test(file.path) && !file.isSimple)?.path || entryFile || 'main.py';
  commands.push(`python ${pythonFile}`);
  return commands.join('\n');
}

function composeCustomDiagnosticPrompt(customState) {
  const briefText = customState.brief ? JSON.stringify(customState.brief, null, 2) : 'Бриф ще не збережено.';
  const knownFiles = customState.files.length
    ? customState.files.map((file) => `${file.path} — ${file.isSimple ? 'simple' : 'code'}`).join('\n')
    : 'Файли ще не сформовано.';
  return [
    `Контекст бота: ${briefText}.`,
    `Опис помилки: ${customState.diag.description || 'не вказано'}.`,
    `Логи терміналу: ${customState.diag.logs || 'не надано'}.`,
    `Поточна структура файлів: ${knownFiles}.`,
    'Покажи повністю виправлений код і чітко вкажи, в які файли його вставити.'
  ].join('\n');
}

function getCustomCommandsList(customState) {
  return customState.commandsText
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getRecommendedBackendId(currentState = state) {
  if (!isCustomBot(currentState)) return null;
  const custom = ensureCustomState(currentState);
  const brief = custom.brief || {};
  const candidates = [
    brief.storage?.type,
    brief.backend?.type,
    brief.storage?.name,
    brief.storage?.id
  ].map((value) => (typeof value === 'string' ? value.toLowerCase() : ''));

  const text = candidates.filter(Boolean).join(' ');
  const map = [
    { key: 'postgresql', value: 'postgres' },
    { key: 'postgres', value: 'postgres' },
    { key: 'sqlite', value: 'sqlite' },
    { key: 'google sheets', value: 'gsheets' },
    { key: 'gsheets', value: 'gsheets' },
    { key: 'sheets', value: 'gsheets' },
    { key: 'json', value: 'json' }
  ];
  for (const item of map) {
    if (text.includes(item.key)) return item.value;
  }
  return null;
}

function normalizeCommand(command) {
  if (typeof command !== 'string') return '';
  const trimmed = command.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function customBriefHasCommand(command) {
  const custom = ensureCustomState();
  const target = normalizeCommand(command);
  if (!target) return false;
  const commands = Array.isArray(custom.brief?.commands)
    ? custom.brief.commands
    : state.commands;
  return commands.some((cmd) => normalizeCommand(cmd).toLowerCase() === target.toLowerCase());
}

function customBriefHasReminder() {
  const custom = ensureCustomState();
  const commands = Array.isArray(custom.brief?.commands) ? custom.brief.commands : state.commands;
  const commandMatch = commands.some((cmd) => {
    const normalized = normalizeCommand(cmd).toLowerCase();
    return normalized.includes('remind') || normalized.includes('daily') || normalized.includes('schedule');
  });
  if (commandMatch) return true;
  const featuresCandidates = [].concat(
    Array.isArray(custom.brief?.features) ? custom.brief.features : [],
    Array.isArray(custom.brief?.modules) ? custom.brief.modules : [],
    Array.isArray(custom.brief?.capabilities) ? custom.brief.capabilities : []
  );
  return featuresCandidates.some((item) =>
    typeof item === 'string' && /нагад|remind|schedule|daily/i.test(item)
  );
}

function generateCommandFixPrompt(customState) {
  const briefText = customState.brief ? JSON.stringify(customState.brief, null, 2) : 'Бриф ще не збережено.';
  const commands = (state.commands || []).map((cmd) => normalizeCommand(cmd)).filter(Boolean).join(', ');
  const lines = [
    `Контекст бота: ${briefText}.`,
    `Поточний список команд: ${commands || 'не визначено'}.`,
    'Опиши, яка команда або набір команд працює некоректно.'
  ];
  if (state.choices.mode === 'chatgpt') {
    lines.push('Попроси ШІ повернути повні оновлені версії змінених файлів (цілком), щоб їх можна було вставити без правок.');
  } else {
    lines.push('Попроси ШІ пояснити, які зміни внести, та надати оновлений код для відповідних файлів.');
  }
  return lines.join('\n');
}

function getUiSection(section, currentState = state) {
  const custom = ensureCustomState(currentState);
  const ui = custom.brief?.ui;
  if (!ui || typeof ui !== 'object') return null;
  const data = ui[section];
  if (!data || typeof data !== 'object') return null;
  const needed = data.needed;
  const buttons = Array.isArray(data.buttons) ? data.buttons : [];
  const notes = typeof data.notes === 'string' ? data.notes : '';
  return { needed, buttons, notes };
}

function generateUiCodePrompt(section, buttons) {
  const custom = ensureCustomState();
  const briefText = custom.brief ? JSON.stringify(custom.brief, null, 2) : 'Бриф ще не збережено.';
  const entryFile = getEntryFile();
  const mode = state.choices.mode;
  const spec = JSON.stringify(buttons, null, 2);
  const readable = section === 'reply' ? 'reply-меню' : 'inline-кнопки';
  const lines = [
    `Контекст бота: ${briefText}.`,
    `Специфікація ${readable}:`,
    spec,
    `Онови файл ${entryFile}, додавши ${readable} та необхідні обробники.`,
    'Використовуй українські підписи та дружні повідомлення.'
  ];
  if (mode === 'chatgpt') {
    lines.push(`Поверни повний оновлений код файла ${entryFile} одним блоком без пропусків.`);
  } else {
    lines.push(`Опиши внесені зміни та наведи оновлений код для відповідних частин ${entryFile}.`);
  }
  return lines.join('\n');
}

function generateUiDiscoveryPrompt(section) {
  const custom = ensureCustomState();
  const briefText = custom.brief ? JSON.stringify(custom.brief, null, 2) : 'Бриф ще не збережено.';
  const entryFile = getEntryFile();
  const mode = state.choices.mode;
  const readable = section === 'reply' ? 'reply-меню' : 'inline-кнопки';
  const elementFormat = section === 'reply'
    ? '{"text": "...", "purpose": "..."}'
    : '{"text": "...", "purpose": "...", "callback": "..."}';
  const lines = [
    `Контекст бота: ${briefText}.`,
    `Запропонуй, чи потрібне ${readable}. Якщо так, сформуй масив об’єктів формату ${elementFormat}.`,
    `Після цього онови файл ${entryFile}, додавши ${readable} та необхідну логіку.`,
    'Використовуй українські підписи.'
  ];
  if (mode === 'chatgpt') {
    lines.push(`Поверни повний оновлений код файла ${entryFile} одним блоком.`);
  } else {
    lines.push(`Поясни, які зміни треба внести у ${entryFile}, та додай оновлений код для відповідних частин.`);
  }
  return lines.join('\n');
}

function parseCustomBrief(rawText) {
  if (!rawText) throw new Error('Бриф порожній.');
  let normalized = rawText.trim();
  if (normalized.startsWith('```')) {
    const fenceEnd = normalized.lastIndexOf('```');
    normalized = normalized.slice(normalized.indexOf('\n') + 1, fenceEnd).trim();
  }
  return JSON.parse(normalized);
}

const elements = {
  section: document.getElementById('section-label'),
  progressInner: document.getElementById('progress-inner'),
  progressLabel: document.getElementById('progress-label'),
  stepIndex: document.getElementById('step-index'),
  stepTitle: document.getElementById('step-title'),
  stepBody: document.getElementById('step-body'),
  prev: document.getElementById('prev-btn'),
  next: document.getElementById('next-btn'),
  reset: document.getElementById('reset-btn'),
  navToggle: document.getElementById('nav-toggle'),
  navMenu: document.getElementById('nav-menu'),
  navBackdrop: document.getElementById('nav-backdrop'),
  topNav: document.querySelector('.top-nav'),
  navSummary: document.getElementById('nav-summary'),
  docsBtn: document.getElementById('docs-btn'),
  docsBackdrop: document.getElementById('docs-backdrop'),
  docsClose: document.getElementById('docs-close'),
  jumpSelect: document.getElementById('jump-select'),
  jumpButton: document.getElementById('jump-btn'),
  footer: document.querySelector('footer.controls'),
  toast: document.getElementById('toast')
};

let state = loadState();
let steps = [];

elements.prev.addEventListener('click', () => {
  if (state.currentStep === 0) return;
  state.currentStep -= 1;
  saveState();
  draw(false);
});

elements.next.addEventListener('click', () => {
  const step = steps[state.currentStep];
  const validation = validateStep(step);
  if (!validation.allow) {
    showToast(validation.message);
    return;
  }
  if (state.currentStep < steps.length - 1) {
    state.currentStep += 1;
    saveState();
    draw(false);
  } else {
    showToast('Готово! Можеш переглядати попередні кроки.');
  }
});

if (elements.reset) {
  elements.reset.addEventListener('click', () => {
    if (!confirm('Скинути всі кроки та повернутися до початку?')) return;
    closeDocs();
    closeNavMenu();
    state = structuredClone(defaultState);
    saveState();
    draw(true);
    updateNavOnScroll();
    showToast('Майстер скинуто.');
  });
}

if (elements.jumpButton) {
  elements.jumpButton.addEventListener('click', () => {
    jumpToSelectedStep();
  });
}

if (elements.jumpSelect) {
  elements.jumpSelect.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      jumpToSelectedStep();
    }
  });
}

if (elements.docsBtn && elements.docsBackdrop) {
  elements.docsBtn.addEventListener('click', openDocs);
}

if (elements.docsClose) {
  elements.docsClose.addEventListener('click', closeDocs);
}

if (elements.navToggle) {
  elements.navToggle.addEventListener('click', () => {
    if (elements.navMenu?.classList.contains('open')) {
      closeNavMenu();
    } else {
      openNavMenu();
    }
  });
}

if (elements.navBackdrop) {
  elements.navBackdrop.addEventListener('click', () => {
    closeNavMenu();
  });
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeDocs();
    closeNavMenu();
  }
});

function jumpToSelectedStep() {
  if (!elements.jumpSelect) return;
  const value = elements.jumpSelect.value;
  if (!value) return;
  const index = steps.findIndex((step) => step.id === value);
  if (index === -1) return;
  state.currentStep = index;
  saveState();
  draw(false);
}

function openDocs() {
  elements.docsBackdrop.hidden = false;
  document.body.classList.add('docs-open');
}

function closeDocs() {
  elements.docsBackdrop.hidden = true;
  document.body.classList.remove('docs-open');
}

function openNavMenu() {
  if (!elements.navMenu || !elements.navToggle) return;
  elements.navMenu.classList.add('open');
  elements.navToggle.classList.add('open');
  elements.navToggle.setAttribute('aria-expanded', 'true');
  elements.topNav?.classList.add('menu-active');
  elements.topNav?.classList.remove('scrolled');
  if (elements.navBackdrop) elements.navBackdrop.hidden = false;
  document.body.classList.add('nav-open');
}

function closeNavMenu() {
  if (!elements.navMenu || !elements.navToggle) return;
  elements.navMenu.classList.remove('open');
  elements.navToggle.classList.remove('open');
  elements.navToggle.setAttribute('aria-expanded', 'false');
  if (elements.navBackdrop) elements.navBackdrop.hidden = true;
  document.body.classList.remove('nav-open');
  elements.topNav?.classList.remove('menu-active');
  updateNavOnScroll();
}

function isMobileNav() {
  return window.matchMedia('(max-width: 720px)').matches;
}

window.addEventListener('scroll', updateNavOnScroll, { passive: true });
updateNavOnScroll();

function updateNavOnScroll() {
  if (!elements.topNav) return;
  const scrolled = window.scrollY > 24;
  elements.topNav.classList.toggle('scrolled', scrolled && !document.body.classList.contains('nav-open'));
}

function updateNavSummary() {
  if (!elements.navSummary) return;
  const type = BOT_TYPES.find((item) => item.id === state.choices.botType)?.title || 'не обрано';
  const environment = ENVIRONMENTS.find((item) => item.id === state.choices.environment)?.title || 'не обрано';
  const mode = MODE_OPTIONS.find((item) => item.id === state.choices.mode)?.title || 'не обрано';
  elements.navSummary.innerHTML = `Тип: <span>${type}</span> | Середовище: <span>${environment}</span> | ШІ: <span>${mode}</span>`;
}

draw(true);

// --- Головні функції ---
function draw(rebuild) {
  if (rebuild) rebuildSteps();
  updateJumpControls();
  updateNavSummary();
  if (!steps.length) return;
  const step = steps[state.currentStep];

  elements.section.textContent = step.section;
  elements.stepIndex.textContent = `Крок ${step.number}`;
  elements.stepTitle.textContent = step.title;
  elements.stepBody.innerHTML = '';
  step.render(elements.stepBody);

  const progress = ((state.currentStep + 1) / steps.length) * 100;
  elements.progressInner.style.width = `${progress}%`;
  elements.progressLabel.textContent = `${state.currentStep + 1} / ${steps.length}`;

  elements.prev.disabled = state.currentStep === 0;
  elements.next.textContent = state.currentStep === steps.length - 1 ? 'Завершити' : 'Далі ➡️';
  elements.footer.style.display = step.hideNav ? 'none' : '';
}

function rebuildSteps() {
  const currentId = steps[state.currentStep]?.id ?? null;
  steps = buildSteps(state);
  if (!steps.length) return;

  if (currentId) {
    const idx = steps.findIndex((step) => step.id === currentId);
    if (idx >= 0) {
      state.currentStep = idx;
      return;
    }
  }
  state.currentStep = Math.min(state.currentStep, steps.length - 1);
}

function updateJumpControls() {
  if (!elements.jumpSelect || !elements.jumpButton) return;

  const select = elements.jumpSelect;
  const button = elements.jumpButton;
  const previousValue = select.value;

  select.innerHTML = '';

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Повернутися до кроку';
  placeholder.disabled = true;
  placeholder.selected = true;
  select.appendChild(placeholder);

  steps.forEach((step) => {
    const option = document.createElement('option');
    option.value = step.id;
    option.textContent = `Крок ${step.number}. ${step.title}`;
    select.appendChild(option);
  });

  const availableValues = new Set(steps.map((step) => step.id));
  if (availableValues.has(previousValue)) {
    select.value = previousValue;
  } else {
    select.value = '';
    select.selectedIndex = 0;
  }

  const disabled = steps.length === 0;
  select.disabled = disabled;
  button.disabled = disabled;
}

function buildSteps(currentState) {
  const result = [];
  const entryFile = getEntryFile(currentState);
  const customBot = isCustomBot(currentState);
  if (customBot) ensureCustomState(currentState);

  // I. Старт
  result.push(createStep('start', 'I. Старт', 'Привітання', renderStartStep, { hideNav: true }));
  result.push(createStep('bot-type', 'I. Старт', 'Вибір типу бота', renderBotTypeStep));
  result.push(createStep('mode', 'I. Старт', 'Вибір режиму ШІ', renderModeStep));
  result.push(createStep('environment', 'I. Старт', 'Вибір середовища', renderEnvironmentStep));
  result.push(createStep('tools', 'I. Старт', 'Перевірка інструментів', renderToolsStep));

  // II. Підготовка проєкту
  result.push(createStep('folder', 'II. Підготовка проєкту', 'Створення папки', (c) =>
    renderInfo(c, ['• Створи папку `mybot`.', '• Відкрий її у редакторі (VS Code / Cursor).'], 'Мета: мати чисте місце для файлів бота.')
  ));
  if (customBot) {
    result.push(createStep('custom-requirements', 'II. Підготовка проєкту', 'Опис кастомного бота', renderCustomRequirementsStep));
    result.push(createStep('custom-brief-prompt', 'II. Підготовка проєкту', 'Промпт для брифу', renderCustomBriefPromptStep));
    result.push(createStep('custom-brief-import', 'II. Підготовка проєкту', 'Збереження брифу', renderCustomBriefInputStep));
    result.push(createStep('custom-files', 'III. Файли', 'Файли проєкту', renderCustomFilesStep));
    result.push(createStep('custom-terminal', 'IV. Запуск', 'Команди для терміналу', renderCustomTerminalStep));
    result.push(createStep('custom-diagnostics', 'IV. Запуск', 'Діагностика помилок', renderCustomDiagnosticsStep));
  } else {
    result.push(createStep('main-file', 'II. Підготовка проєкту', `Створення ${entryFile}`, (c) =>
      renderInfo(c, [`• Створи файл \`${entryFile}\` у корені.`, '• Поки залиш порожнім — код додамо далі.'])
    ));
    result.push(createStep('file-structure', 'II. Підготовка проєкту', 'Структура файлів', renderFileStructureStep));
    result.push(createStep('dev-brief', 'II. Підготовка проєкту', 'DEV BRIEF', renderDevBriefStep));
    result.push(createStep('code-prompt', 'II. Підготовка проєкту', 'Промпт для коду', renderCodePromptStep));
    result.push(createStep('requirements', 'II. Підготовка проєкту', 'Створення requirements.txt', renderRequirementsStep));
    result.push(createStep('env-file', 'II. Підготовка проєкту', 'Створення .env', renderEnvStep));
  }

  // III. База даних
  result.push(createStep('backend-explain', 'III. База даних', 'Пояснення від панелі', (c) =>
    renderInfo(c, ['• Без зберігання бот “забуває” все після перезапуску.', '• Обери один варіант і доведи його до тесту.'])
  ));
  result.push(createStep('backend-choice', 'III. База даних', 'Вибір типу зберігання', renderBackendChoiceStep));
  result.push(createStep('backend-confirm', 'III. База даних', 'Підтвердження вибору', renderBackendConfirmStep));

  const backend = BACKEND_OPTIONS.find((option) => option.id === currentState.choices.backend);
  if (backend) {
    backend.steps.forEach((step, index) => {
      result.push(createStep(`backend-${backend.id}-${index}`, 'III. База даних', step.text.split('.')[0], (c) =>
        renderBackendStep(c, backend.title, step)
      ));
    });
  }

  // IV. Дизайн
  if (customBot) {
    result.push(createStep('design-reply', 'IV. Дизайн', 'Головне меню (Reply-кнопки)', renderCustomReplyStep));
    result.push(createStep('design-inline', 'IV. Дизайн', 'Inline-кнопки', renderCustomInlineStep));
  } else {
    DESIGN_STEPS.forEach((item, index) => {
      result.push(createStep(`design-${index}`, 'IV. Дизайн', item.title, (c) => renderInfo(c, item.items)));
    });
  }

  // V. Статистика
  if (customBot) {
    if (customBriefHasCommand('/stats')) {
      result.push(createStep('stats-commands', 'V. Статистика', STATS_STEPS[0].title, (c) => renderInfo(c, STATS_STEPS[0].items)));
      result.push(createStep('stats-report', 'V. Статистика', STATS_STEPS[1].title, (c) => renderInfo(c, STATS_STEPS[1].items)));
    }
    if (customBriefHasReminder()) {
      result.push(createStep('stats-reminder', 'V. Статистика', STATS_STEPS[2].title, (c) => renderInfo(c, STATS_STEPS[2].items)));
    }
  } else {
    STATS_STEPS.forEach((item, index) => {
      result.push(createStep(`stats-${index}`, 'V. Статистика', item.title, (c) => renderInfo(c, item.items)));
    });
  }

  // VI. Оплати
  result.push(createStep('payments-choice', 'VI. Оплати', 'Вибір системи оплати', renderPaymentsChoiceStep));
  result.push(createStep('payments-prep', 'VI. Оплати', 'Підготовка ключів', renderPaymentPrepStep));
  const payment = PAYMENT_METHODS.find((option) => option.id === currentState.choices.payment);
  if (payment && payment.id !== 'none') {
    payment.steps.forEach((step, index) => {
      result.push(createStep(`payment-${payment.id}-${index}`, 'VI. Оплати', step.text.split('.')[0], (c) =>
        renderPaymentStep(c, payment.title, step)
      ));
    });
  }

  // VII. Запуск
  LAUNCH_STEPS.forEach((item, index) => {
    result.push(createStep(`launch-${index}`, 'VII. Запуск', item.title, (c) => renderLaunchStep(c, item)));
  });

  // VIII. Розвиток
  GROWTH_STEPS.forEach((item, index) => {
    result.push(createStep(`growth-${index}`, 'VIII. Розвиток', item.title, (c) => renderInfo(c, item.items)));
  });

  return result;
}

function createStep(id, section, title, renderFn, extras = {}) {
  const step = {
    id,
    section,
    title,
    render: renderFn,
    number: 0
  };
  Object.assign(step, extras);
  return step;
}

function renderStartStep(container) {
  const block = document.createElement('div');
  block.className = 'start-screen';

  const img = document.createElement('img');
  img.src = 'assets/intro.gif';
  img.alt = 'Onboarding';
  img.className = 'start-gif';
  img.loading = 'lazy';
  block.appendChild(img);

  const title = document.createElement('h3');
  title.textContent = 'Запускаємо майстер створення власного Telegram-бота.';
  block.appendChild(title);

  const desc = document.createElement('p');
  desc.textContent = 'Принцип: одна дія = один крок. Готові? Натисни кнопку — рухаємось.';
  block.appendChild(desc);

  const button = document.createElement('button');
  button.className = 'primary';
  button.textContent = 'Почати';
  button.addEventListener('click', () => {
    state.currentStep += 1;
    saveState();
    draw(true);
  });
  block.appendChild(button);

  container.appendChild(block);
}

function renderBotTypeStep(container) {
  const tableWrap = document.createElement('div');
  tableWrap.className = 'table-wrapper';
  const table = document.createElement('table');
  table.innerHTML = `
    <thead>
      <tr>
        <th>Тип</th>
        <th>Опис</th>
        <th>Рекомендовані команди</th>
      </tr>
    </thead>
    <tbody>
      ${BOT_TYPES.map((type) => `
        <tr>
          <td>
            <label>
              <input type="radio" name="bot-type" value="${type.id}" ${state.choices.botType === type.id ? 'checked' : ''} />
              <span>${type.title}</span>
            </label>
          </td>
          <td>${type.description}</td>
          <td>${type.commands.join(', ')}</td>
        </tr>
      `).join('')}
    </tbody>
  `;
  table.addEventListener('change', (event) => {
    if (event.target.name === 'bot-type') {
      state.choices.botType = event.target.value;
      const type = BOT_TYPES.find((item) => item.id === state.choices.botType);
      if (type) state.commands = [...type.commands];
      saveState();
      draw(false);
    }
  });
  tableWrap.appendChild(table);
  container.appendChild(tableWrap);

  renderInfo(container, ['• Обери сценарій, який найближчий до твого проєкту.']);
}

function renderModeStep(container) {
  const cards = document.createElement('div');
  cards.className = 'card-grid';
  MODE_OPTIONS.forEach((option) => {
    const card = document.createElement('div');
    card.className = 'card';
    if (state.choices.mode === option.id) card.classList.add('active');
    card.innerHTML = `<h3>${option.title}</h3><p>${option.description}</p>`;
    card.addEventListener('click', () => {
      state.choices.mode = option.id;
      saveState();
      draw(false);
    });
    cards.appendChild(card);
  });
  container.appendChild(cards);

  renderInfo(container, ['• Режим впливає на кнопки «Скопіювати для ChatGPT / Codex».']);
}

function renderEnvironmentStep(container) {
  const cards = document.createElement('div');
  cards.className = 'card-grid';
  ENVIRONMENTS.forEach((env) => {
    const card = document.createElement('div');
    card.className = 'card';
    if (state.choices.environment === env.id) card.classList.add('active');
    card.innerHTML = `<h3>${env.title}</h3><p>${env.description}</p>`;
    card.addEventListener('click', () => {
      state.choices.environment = env.id;
      saveState();
      draw(false);
    });
    cards.appendChild(card);
  });
  container.appendChild(cards);

  renderInfo(container, ['• Вибір середовища підлаштує підказки та команди.']);
}

function renderToolsStep(container) {
  renderInfo(container, [
    '• Python 3.10+ — встанови останню версію із офіційного сайту.',
    '• IDE — VS Code або Cursor з розширеннями Python, Pylance, Copilot.',
    '• GitHub — авторизуйся або створи акаунт.'
  ].concat(state.choices.mode === 'codex' ? ['• Copilot — увімкни GitHub Copilot у VS Code.'] : []));

  const grid = document.createElement('div');
  grid.className = 'card-grid';

  const aiTarget = state.choices.mode === 'codex' ? 'codex' : 'chatgpt';

  grid.appendChild(createToolCard({
    title: 'Python 3.12',
    description: 'Офіційний інсталятор для Windows / macOS / Linux.',
    link: 'https://www.python.org/downloads/',
    prompt: 'Поясни, як встановити Python 3.12 на мою систему. Додай кроки для перевірки python --version.',
    ai: aiTarget
  }));

  grid.appendChild(createToolCard({
    title: 'VS Code',
    description: 'Редактор із потрібними плагінами: Python, Pylance, Copilot.',
    link: 'https://code.visualstudio.com/',
    prompt: 'Поясни, як встановити VS Code та додати розширення Python, Pylance і GitHub Copilot.',
    ai: aiTarget
  }));

  grid.appendChild(createToolCard({
    title: 'GitHub',
    description: 'Створи або увійди у свій акаунт.',
    link: 'https://github.com/',
    prompt: 'Поясни, як зареєструватися на GitHub, увімкнути 2FA та налаштувати git config.',
    ai: aiTarget
  }));

  if (state.choices.mode === 'codex') {
    grid.appendChild(createToolCard({
      title: 'Copilot',
      description: 'Активуй Copilot у VS Code, щоб працювати з Codex.',
      link: 'https://github.com/features/copilot',
      prompt: 'Поясни, як увімкнути GitHub Copilot у VS Code та авторизуватися.',
      ai: aiTarget
    }));
  }

  container.appendChild(grid);

  const checklist = document.createElement('div');
  checklist.className = 'checklist';
  TOOL_CHECKLIST.forEach((tool) => {
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
    label.append(input, document.createTextNode(tool.label));
    row.appendChild(label);
    checklist.appendChild(row);
  });
  container.appendChild(checklist);
}

function renderFileStructureStep(container) {
  const entryFile = getEntryFile();

  const selector = document.createElement('div');
  selector.className = 'file-structure-selector';

  const selectorLabel = document.createElement('label');
  selectorLabel.textContent = 'Основний файл проєкту:';
  selector.appendChild(selectorLabel);

  const select = document.createElement('select');
  select.id = 'entry-file-select';
  selectorLabel.setAttribute('for', select.id);
  ENTRY_FILE_OPTIONS.forEach((option) => {
    const opt = document.createElement('option');
    opt.value = option.id;
    opt.textContent = option.label;
    select.appendChild(opt);
  });
  select.value = entryFile;
  select.addEventListener('change', (event) => {
    state.choices.entryFile = event.target.value;
    saveState();
    draw(true);
  });
  selector.appendChild(select);

  container.appendChild(selector);

  // Секція з індивідуальним кодом
  const manualSection = createFileSection('Файли з індивідуальним кодом', 'Попроси ШІ згенерувати ці файли та встав їх вручну.');
  const manualList = document.createElement('div');
  manualList.className = 'file-card-stack';
  manualList.appendChild(createManualFileCard(entryFile));
  manualSection.appendChild(manualList);
  container.appendChild(manualSection);

  // Статичні файли
  const staticSection = createFileSection('Готові заготовки', 'Скопіюй вказаний код та встав у відповідні файли без змін.');
  const staticList = document.createElement('div');
  staticList.className = 'file-card-stack';
  FILE_STRUCTURE_STATIC_FILES.forEach((item) => {
    staticList.appendChild(createStaticFileCard(item));
  });
  staticSection.appendChild(staticList);
  container.appendChild(staticSection);

  // Бекенд-специфічні файли
  const backend = state.choices.backend;
  const backendEntries = FILE_STRUCTURE_BACKEND_MAP[backend] || [];
  const backendSection = createFileSection('Додатково для обраного бекенду', backend
    ? 'Створи ці елементи, щоб сховище працювало коректно.'
    : 'Оберіть бекенд, щоб побачити додаткові файли/папки.');

  if (!backend) {
    const info = document.createElement('p');
    info.className = 'file-section-hint';
    info.textContent = 'Бекенд ще не обрано. Перейдіть на крок «Вибір типу зберігання».';
    backendSection.appendChild(info);
  } else if (!backendEntries.length) {
    const info = document.createElement('p');
    info.className = 'file-section-hint';
    info.textContent = 'Для цього бекенду немає додаткових файлів — достатньо основної структури.';
    backendSection.appendChild(info);
  } else {
    const backendList = document.createElement('div');
    backendList.className = 'file-card-stack';
    backendEntries.forEach((item) => {
      backendList.appendChild(createBackendCard(item));
    });
    backendSection.appendChild(backendList);
  }

  container.appendChild(backendSection);

  function createFileSection(title, subtitle) {
    const section = document.createElement('section');
    section.className = 'file-structure-section';

    const head = document.createElement('header');
    head.className = 'file-section-head';

    const h3 = document.createElement('h3');
    h3.textContent = title;
    head.appendChild(h3);

    if (subtitle) {
      const p = document.createElement('p');
      p.textContent = subtitle;
      head.appendChild(p);
    }

    section.appendChild(head);
    return section;
  }

  function createManualFileCard(fileName) {
    const wrapper = document.createElement('article');
    wrapper.className = 'file-card manual';

    const title = document.createElement('header');
    title.className = 'file-card-path';
    title.textContent = fileName;
    wrapper.appendChild(title);

    const desc = document.createElement('p');
    desc.className = 'file-card-description';
    desc.textContent = 'Цей файл містить бізнес-логіку бота. Запроси у ШІ повний вміст і встав його в редактор.';
    wrapper.appendChild(desc);

    const prompt = generateManualFilePrompt(fileName);
    const aiTarget = state.choices.mode === 'codex' ? 'codex' : 'chatgpt';
    wrapper.appendChild(createPromptBlock(prompt, {
      copyLabel: 'Скопіювати промпт для ШІ',
      ai: aiTarget,
      openLabel: getAiLabel(aiTarget)
    }));

    const note = document.createElement('p');
    note.className = 'file-card-note';
    note.textContent = 'Після вставки коду збережи файл та переходь до наступних кроків.';
    wrapper.appendChild(note);

    return wrapper;
  }

  function createStaticFileCard(item) {
    const card = document.createElement('article');
    card.className = 'file-card static';

    const title = document.createElement('header');
    title.className = 'file-card-path';
    title.textContent = item.title;
    card.appendChild(title);

    if (item.description) {
      const desc = document.createElement('p');
      desc.className = 'file-card-description';
      desc.textContent = item.description;
      card.appendChild(desc);
    }

    if (item.content) {
      const code = document.createElement('pre');
      code.className = 'file-card-code';
      code.textContent = item.content;
      card.appendChild(code);

      const actions = document.createElement('div');
      actions.className = 'file-card-actions';
      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'ghost copy-btn';
      copyBtn.textContent = 'Скопіювати вміст';
      copyBtn.addEventListener('click', () => copyText(item.content));
      actions.appendChild(copyBtn);
      card.appendChild(actions);
    }

    return card;
  }

  function createBackendCard(item) {
    if (item.type === 'note') {
      const note = document.createElement('p');
      note.className = 'file-section-hint';
      note.textContent = item.description;
      return note;
    }

    const card = document.createElement('article');
    card.className = `file-card backend ${item.type || 'info'}`;

    if (item.path) {
      const title = document.createElement('header');
      title.className = 'file-card-path';
      title.textContent = item.path;
      card.appendChild(title);
    }

    if (item.description) {
      const desc = document.createElement('p');
      desc.className = 'file-card-description';
      desc.textContent = item.description;
      card.appendChild(desc);
    }

    if (item.type === 'static' && item.content) {
      const code = document.createElement('pre');
      code.className = 'file-card-code';
      code.textContent = item.content;
      card.appendChild(code);

      const actions = document.createElement('div');
      actions.className = 'file-card-actions';
      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'ghost copy-btn';
      copyBtn.textContent = 'Скопіювати вміст';
      copyBtn.addEventListener('click', () => copyText(item.content));
      actions.appendChild(copyBtn);
      card.appendChild(actions);
    }

    if (item.type === 'dir' || item.type === 'info') {
      const actions = document.createElement('div');
      actions.className = 'file-card-actions';
      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'ghost copy-btn';
      copyBtn.textContent = 'Скопіювати шлях';
      copyBtn.addEventListener('click', () => copyText(item.path));
      actions.appendChild(copyBtn);
      card.appendChild(actions);
    }

    if (item.type === 'ai' && item.prompt) {
      const aiTarget = state.choices.mode === 'codex' ? 'codex' : 'chatgpt';
      card.appendChild(createPromptBlock(item.prompt, {
        copyLabel: 'Скопіювати промпт',
        ai: aiTarget,
        openLabel: getAiLabel(aiTarget)
      }));
    }

    return card;
  }
}

function renderDevBriefStep(container) {
  const panel = document.createElement('div');
  panel.className = 'review-card';

  const h = document.createElement('h3');
  h.textContent = 'Огляд виборів та швидке редагування';
  panel.appendChild(h);

  panel.appendChild(makeRow('Тип бота', makeSelect(
    BOT_TYPES.map((t) => [t.id, `${t.title} — ${t.description}`]),
    state.choices.botType,
    (value) => {
      state.choices.botType = value;
      const type = BOT_TYPES.find((item) => item.id === value);
      if (type) state.commands = [...type.commands];
      saveState();
      draw(false);
    }
  )));

  panel.appendChild(makeRow('Режим ШІ', makeSelect(
    MODE_OPTIONS.map((m) => [m.id, m.title]),
    state.choices.mode,
    (value) => {
      state.choices.mode = value;
      if (value !== 'codex') state.tools.copilot = false;
      saveState();
      draw(false);
    }
  )));

  panel.appendChild(makeRow('Середовище', makeSelect(
    ENVIRONMENTS.map((env) => [env.id, env.title]),
    state.choices.environment,
    (value) => {
      state.choices.environment = value;
      saveState();
      draw(false);
    }
  )));

  const commandsTextarea = document.createElement('textarea');
  commandsTextarea.value = state.commands.join(', ');
  commandsTextarea.addEventListener('input', (event) => {
    const commands = event.target.value.split(',').map((item) => item.trim()).filter(Boolean);
    state.commands = commands.map((cmd) => (cmd.startsWith('/') ? cmd : `/${cmd}`));
    saveState();
  });
  panel.appendChild(makeRow('Команди', wrapControl(commandsTextarea)));

  container.appendChild(panel);

  const brief = generateDevBrief();
  const block = createPromptBlock(brief, {
    copyLabel: 'Скопіювати DEV BRIEF',
    ai: state.choices.mode === 'codex' ? 'codex' : 'chatgpt',
    openLabel: state.choices.mode === 'codex' ? 'Відкрити Codex' : 'Відкрити ChatGPT'
  });
  container.appendChild(block);
}

function renderCodePromptStep(container) {
  const prompt = generateCodePrompt();
  renderInfo(container, ['Використай промпт нижче, щоб отримати код.']);
  const block = createPromptBlock(prompt, {
    copyLabel: 'Скопіювати промпт',
    ai: state.choices.mode === 'codex' ? 'codex' : 'chatgpt',
    openLabel: state.choices.mode === 'codex' ? 'Відкрити Codex' : 'Відкрити ChatGPT'
  });
  container.appendChild(block);
}

function renderRequirementsStep(container) {
  const entryFile = getEntryFile();
  const aiTarget = state.choices.mode === 'codex' ? 'codex' : 'chatgpt';
  const promptBlock = createPromptBlock(
    `Створи файл requirements.txt і додай рядки:\n\naiogram==3.*\npython-dotenv`,
    {
      copyLabel: 'Скопіювати інструкцію',
      ai: aiTarget,
      openLabel: getAiLabel(aiTarget)
    }
  );
  container.appendChild(promptBlock);

  const checklist = document.createElement('div');
  checklist.className = 'info-block';
  const label = document.createElement('label');
  label.className = 'info-line';
  const text = document.createElement('span');
  text.textContent = 'Познач, що файл requirements.txt створено:';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = !!state.tools.requirements;
  input.addEventListener('change', (event) => {
    state.tools.requirements = event.target.checked;
    saveState();
    draw(false);
  });
  label.append(text, input);
  checklist.appendChild(label);
  container.appendChild(checklist);

  if (!state.tools.requirements) {
    const carousel = document.createElement('div');
    carousel.className = 'carousel';

    carousel.appendChild(createCarouselSlide({
      title: 'Крок 1. Створи файл',
      body: 'У редакторі натисни New File, назви файл requirements.txt та збережи його у корені проєкту.'
    }));

    carousel.appendChild(createCarouselSlide({
      title: 'Крок 2. Додай залежності',
      body: 'Встав рядки aiogram==3.* та python-dotenv, збережи (Ctrl/Cmd+S).',
      code: 'aiogram==3.*\npython-dotenv'
    }));

    carousel.appendChild(createCarouselSlide({
      title: 'Крок 3. Перевір',
      body: `Переконайся, що файл поруч із ${entryFile}. Команда \`pip install -r requirements.txt\` встановить залежності.`
    }));

    container.appendChild(carousel);
  }
}

function renderCustomRequirementsStep(container) {
  const custom = ensureCustomState();
  renderInfo(container, [
    '• Опиши словами, що робитиме твій бот: сценарії, команди, інтеграції.',
    '• Чим детальніше поясниш — тим точніше буде бриф.'
  ]);

  const textarea = document.createElement('textarea');
  textarea.value = custom.requirements;
  textarea.placeholder = 'Наприклад: “Бот для фітнес-коуча: збір заявок, розклад, нагадування...”';
  textarea.addEventListener('input', (event) => {
    custom.requirements = event.target.value;
    saveState();
  });
  container.appendChild(makeRow('Опис бота', wrapControl(textarea)));
}

function renderCustomBriefPromptStep(container) {
  const custom = ensureCustomState();
  if (!custom.requirements.trim()) {
    renderInfo(container, ['• Спочатку заповни опис бота, щоб сформувати промпт.']);
    return;
  }
  renderInfo(container, ['Скопіюй промпт і встав у ChatGPT / Codex, щоб отримати JSON-бриф.']);
  const prompt = generateCustomBriefPrompt();
  const aiTarget = state.choices.mode === 'codex' ? 'codex' : 'chatgpt';
  container.appendChild(createPromptBlock(prompt, {
    copyLabel: 'Скопіювати промпт для брифу',
    ai: aiTarget,
    openLabel: getAiLabel(aiTarget)
  }));
}

function renderCustomBriefInputStep(container) {
  const custom = ensureCustomState();
  renderInfo(container, ['Встав JSON із брифом. Після збереження система побудує план файлів.']);

  const textarea = document.createElement('textarea');
  textarea.value = custom.briefText;
  textarea.placeholder = '{\n  "commands": [...],\n  "files": [...],\n  ...\n}';
  textarea.rows = 12;
  textarea.addEventListener('input', (event) => {
    custom.briefText = event.target.value;
    saveState();
  });
  container.appendChild(makeRow('JSON-бриф', wrapControl(textarea)));

  const actions = document.createElement('div');
  actions.className = 'prompt-actions';
  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'primary';
  saveBtn.textContent = 'Зберегти бриф';
  saveBtn.addEventListener('click', () => {
    try {
      const parsed = parseCustomBrief(custom.briefText);
      custom.brief = parsed;
      updateCustomFilePlan(parsed);
      if (Array.isArray(parsed.commands) && parsed.commands.length) {
        state.commands = parsed.commands.map((cmd) => normalizeCommand(cmd)).filter(Boolean);
      }
      if (!custom.commandsText?.trim()) {
        custom.commandsText = deriveDefaultCommands(custom, getEntryFile());
      }
      const recommendedBackend = getRecommendedBackendId();
      if (recommendedBackend && !state.choices.backend) {
        state.choices.backend = recommendedBackend;
      }
      custom.diag.prompt = '';
      saveState();
      draw(true);
      showToast('Бриф збережено.');
    } catch (error) {
      console.error('Не вдалося розпарсити бриф', error);
      showToast('Помилка JSON. Перевір синтаксис. Якщо ChatGPT повернув відповідь у ```json``` — скопіюй лише вміст без кодових блоків.');
    }
  });
  actions.appendChild(saveBtn);
  container.appendChild(actions);
}

function renderCustomFilesStep(container) {
  const custom = ensureCustomState();
  if (!custom.brief) {
    renderInfo(container, ['• Спочатку збережи JSON-бриф, щоб побачити перелік файлів.']);
    return;
  }

  if (!custom.files.length) {
    renderInfo(container, ['• Бриф не містить файлів. Додай їх у відповідь ШІ, щоб побудувати план.']);
    return;
  }

  renderInfo(container, ['Познач файли як виконані після того, як вставиш код або заповниш прості шаблони.']);

  const stack = document.createElement('div');
  stack.className = 'file-card-stack';

  custom.files.forEach((file) => {
    const card = document.createElement('article');
    card.className = `file-card ${file.isSimple ? 'static' : 'manual'}`;

    const header = document.createElement('header');
    header.className = 'file-card-path';
    header.textContent = file.path;
    card.appendChild(header);

    if (file.purpose) {
      const desc = document.createElement('p');
      desc.className = 'file-card-description';
      desc.textContent = file.purpose;
      card.appendChild(desc);
    }

    const statusRow = document.createElement('label');
    statusRow.className = 'form-label';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = !!file.done;
    checkbox.addEventListener('change', (event) => {
      file.done = event.target.checked;
      saveState();
    });
    const span = document.createElement('span');
    span.textContent = 'Файл готовий';
    statusRow.append(checkbox, span);
    card.appendChild(statusRow);

    if (file.isSimple) {
      const note = document.createElement('p');
      note.className = 'file-card-note';
      note.textContent = file.instructions;
      card.appendChild(note);
    } else if (file.prompt) {
      const aiTarget = state.choices.mode === 'codex' ? 'codex' : 'chatgpt';
      card.appendChild(createPromptBlock(file.prompt, {
        copyLabel: `Промпт для ${file.path}`,
        ai: aiTarget,
        openLabel: getAiLabel(aiTarget),
        collapsible: true
      }));
      const tip = document.createElement('p');
      tip.className = 'file-card-note';
      tip.textContent = 'Згенеруй код, встав у файл і познач, що він готовий.';
      card.appendChild(tip);
    }

    stack.appendChild(card);
  });

  container.appendChild(stack);
}

function renderCustomTerminalStep(container) {
  const custom = ensureCustomState();
  if (!custom.files.length) {
    renderInfo(container, ['• Спочатку сформуй і виконай кроки зі створення файлів.']);
    return;
  }

  renderInfo(container, ['Ці команди допоможуть перевірити проєкт. Можеш редагувати список під себе.']);

  const textarea = document.createElement('textarea');
  textarea.value = custom.commandsText;
  textarea.placeholder = 'pip install -r requirements.txt\npython main.py';
  textarea.rows = 6;
  textarea.addEventListener('input', (event) => {
    custom.commandsText = event.target.value;
    saveState();
  });
  textarea.addEventListener('blur', () => {
    draw(false);
  });
  container.appendChild(makeRow('Команди для запуску', wrapControl(textarea)));

  const commands = getCustomCommandsList(custom);
  if (commands.length) {
    const list = document.createElement('div');
    list.className = 'file-card-stack';
    commands.forEach((cmd, index) => {
      const card = document.createElement('article');
      card.className = 'file-card static';
      const header = document.createElement('header');
      header.className = 'file-card-path';
      header.textContent = `Крок ${index + 1}`;
      card.appendChild(header);
      const pre = document.createElement('pre');
      pre.className = 'file-card-code';
      pre.textContent = cmd;
      card.appendChild(pre);
      const actions = document.createElement('div');
      actions.className = 'file-card-actions';
      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'ghost copy-btn';
      copyBtn.textContent = 'Скопіювати команду';
      copyBtn.addEventListener('click', () => copyText(cmd));
      actions.appendChild(copyBtn);
      card.appendChild(actions);
      list.appendChild(card);
    });
    const allActions = document.createElement('div');
    allActions.className = 'prompt-actions';
    const copyAll = document.createElement('button');
    copyAll.type = 'button';
    copyAll.className = 'ghost copy-btn';
    copyAll.textContent = 'Скопіювати всі команди';
    copyAll.addEventListener('click', () => copyText(custom.commandsText));
    allActions.appendChild(copyAll);
    container.appendChild(list);
    container.appendChild(allActions);
  }
}

function renderCustomDiagnosticsStep(container) {
  const custom = ensureCustomState();
  renderInfo(container, [
    'Якщо команда впала або бот не працює, зафіксуй помилку й згенеруй діагностичний промпт.'
  ]);

  const descArea = document.createElement('textarea');
  descArea.value = custom.diag.description;
  descArea.placeholder = 'Короткий опис: що робили, що очікували, що сталося.';
  descArea.rows = 4;
  descArea.addEventListener('input', (event) => {
    custom.diag.description = event.target.value;
    saveState();
  });

  const logsArea = document.createElement('textarea');
  logsArea.value = custom.diag.logs;
  logsArea.placeholder = 'Скопіюй сюди логи з терміналу або текст помилки.';
  logsArea.rows = 6;
  logsArea.addEventListener('input', (event) => {
    custom.diag.logs = event.target.value;
    saveState();
  });

  container.appendChild(makeRow('Опис помилки', wrapControl(descArea)));
  container.appendChild(makeRow('Логи терміналу', wrapControl(logsArea)));

  const actions = document.createElement('div');
  actions.className = 'prompt-actions';
  const composeBtn = document.createElement('button');
  composeBtn.type = 'button';
  composeBtn.className = 'primary';
  composeBtn.textContent = 'Зібрати діагностичний промпт';
  composeBtn.addEventListener('click', () => {
    custom.diag.prompt = composeCustomDiagnosticPrompt(custom);
    saveState();
    draw(false);
    showToast('Промпт зібрано.');
  });
  actions.appendChild(composeBtn);
  container.appendChild(actions);

  if (custom.diag.prompt) {
    const aiTarget = state.choices.mode === 'codex' ? 'codex' : 'chatgpt';
    container.appendChild(createPromptBlock(custom.diag.prompt, {
      copyLabel: 'Скопіювати промпт',
      ai: aiTarget,
      openLabel: getAiLabel(aiTarget)
    }));
    renderInfo(container, ['Після виправлень повернись до кроку з командами та протестуй знову.']);
  }
}

function renderCustomReplyStep(container) {
  const custom = ensureCustomState();
  if (!custom.brief) {
    renderInfo(container, ['• Спочатку збережи бриф, щоб побачити рекомендоване меню.']);
    return;
  }
  const section = getUiSection('reply');
  const aiTarget = state.choices.mode === 'codex' ? 'codex' : 'chatgpt';

  if (section && section.needed === false) {
    renderInfo(container, ['У брифі зазначено, що reply-меню не потрібне. Пропусти цей крок або, за бажанням, згенеруй меню через промпт.']);
    const prompt = generateUiDiscoveryPrompt('reply');
    container.appendChild(createPromptBlock(prompt, {
      copyLabel: 'Все ж згенерувати меню',
      ai: aiTarget,
      openLabel: getAiLabel(aiTarget),
      collapsible: true
    }));
    return;
  }

  if (section && section.buttons.length) {
    const items = section.buttons.map((button) => {
      const text = button.text || button.label || button.title || 'Кнопка';
      const details = [button.purpose, button.target, button.note].filter(Boolean).join('; ');
      return details ? `• ${text} — ${details}` : `• ${text}`;
    });
    if (section.notes) items.push(`Примітка брифу: ${section.notes}`);
    renderInfo(container, items, 'Додай кнопки у бота та протестуй `/start`.');
    const prompt = generateUiCodePrompt('reply', section.buttons);
    container.appendChild(createPromptBlock(prompt, {
      copyLabel: 'Оновити код для меню',
      ai: aiTarget,
      openLabel: getAiLabel(aiTarget),
      collapsible: true
    }));
    return;
  }

  renderInfo(container, ['У брифі немає готового reply-меню. Використай промпт, щоб згенерувати його.']);
  const prompt = generateUiDiscoveryPrompt('reply');
  container.appendChild(createPromptBlock(prompt, {
    copyLabel: 'Запросити варіанти меню',
    ai: aiTarget,
    openLabel: getAiLabel(aiTarget),
    collapsible: true
  }));
}

function renderCustomInlineStep(container) {
  const custom = ensureCustomState();
  if (!custom.brief) {
    renderInfo(container, ['• Спочатку збережи бриф, щоб побачити inline-кнопки.']);
    return;
  }
  const section = getUiSection('inline');
  const aiTarget = state.choices.mode === 'codex' ? 'codex' : 'chatgpt';

  if (section && section.needed === false) {
    renderInfo(container, ['У брифі вказано, що inline-кнопки не потрібні. Пропусти цей крок або створи власні за промптом.']);
    const prompt = generateUiDiscoveryPrompt('inline');
    container.appendChild(createPromptBlock(prompt, {
      copyLabel: 'Все ж додати inline-кнопки',
      ai: aiTarget,
      openLabel: getAiLabel(aiTarget),
      collapsible: true
    }));
    return;
  }

  if (section && section.buttons.length) {
    const items = section.buttons.map((button) => {
      const text = button.text || button.label || button.title || 'Кнопка';
      const parts = [button.purpose, button.callback, button.url, button.note].filter(Boolean);
      return parts.length ? `• ${text} — ${parts.join('; ')}` : `• ${text}`;
    });
    if (section.notes) items.push(`Примітка брифу: ${section.notes}`);
    renderInfo(container, items, 'Налаштуй callback-и та протестуй сценарії.');
    const prompt = generateUiCodePrompt('inline', section.buttons);
    container.appendChild(createPromptBlock(prompt, {
      copyLabel: 'Оновити код для inline-кнопок',
      ai: aiTarget,
      openLabel: getAiLabel(aiTarget),
      collapsible: true
    }));
    return;
  }

  renderInfo(container, ['У брифі немає даних про inline-кнопки. Використай промпт, щоб згенерувати їх.']);
  const prompt = generateUiDiscoveryPrompt('inline');
  container.appendChild(createPromptBlock(prompt, {
    copyLabel: 'Попросити inline-кнопки',
    ai: aiTarget,
    openLabel: getAiLabel(aiTarget),
    collapsible: true
  }));
}

function renderEnvStep(container) {
  const aiTarget = state.choices.mode === 'codex' ? 'codex' : 'chatgpt';
  const promptBlock = createPromptBlock(
    `Створи файл .env і додай рядок:\n\nTOKEN=сюди_вставиш_токен`,
    {
      copyLabel: 'Скопіювати інструкцію',
      ai: aiTarget,
      openLabel: getAiLabel(aiTarget)
    }
  );
  container.appendChild(promptBlock);

  const checklist = document.createElement('div');
  checklist.className = 'info-block';
  const label = document.createElement('label');
  label.className = 'info-line';
  const text = document.createElement('span');
  text.textContent = 'Познач, що файл .env створено:';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = !!state.tools.env;
  input.addEventListener('change', (event) => {
    state.tools.env = event.target.checked;
    saveState();
    draw(false);
  });
  label.append(text, input);
  checklist.appendChild(label);
  container.appendChild(checklist);

  if (!state.tools.env) {
    const carousel = document.createElement('div');
    carousel.className = 'carousel';

    carousel.appendChild(createCarouselSlide({
      title: 'Крок 1. Створи файл',
      body: 'У редакторі натисни New File, назви файл .env та збережи його у корені проєкту.'
    }));

    carousel.appendChild(createCarouselSlide({
      title: 'Крок 2. Додай токен',
      body: 'Встав рядок TOKEN=сюди_вставиш_токен, заміни значення на реальний токен.',
      code: 'TOKEN=сюди_вставиш_токен'
    }));

    carousel.appendChild(createCarouselSlide({
      title: 'Крок 3. Захисти токен',
      body: 'Переконайся, що .env доданий у .gitignore та не потрапить у репозиторій.'
    }));

    container.appendChild(carousel);
  }
}

function renderBackendChoiceStep(container) {
  const cards = document.createElement('div');
  cards.className = 'card-grid';
  const recommendedId = isCustomBot() ? getRecommendedBackendId() : null;
  BACKEND_OPTIONS.forEach((option) => {
    const card = document.createElement('div');
    card.className = 'card';
    if (state.choices.backend === option.id) card.classList.add('active');
    card.innerHTML = `<h3>${option.title}</h3><p>${option.summary}</p>`;
    if (recommendedId && option.id === recommendedId) {
      card.classList.add('recommended');
      const badge = document.createElement('div');
      badge.className = 'backend-recommend';
      badge.textContent = 'Рекомендуємо для вашого бота';
      card.appendChild(badge);
    }
    card.addEventListener('click', () => {
      state.choices.backend = option.id;
      saveState();
      draw(true);
    });
    cards.appendChild(card);
  });
  container.appendChild(cards);
}

function renderBackendConfirmStep(container) {
  const backend = BACKEND_OPTIONS.find((option) => option.id === state.choices.backend);
  if (!backend) {
    renderInfo(container, ['• Спочатку обери варіант зберігання, щоб побачити кроки.']);
    return;
  }
  renderInfo(container, [`Обрано: ${backend.title}. Нижче — кроки, які потрібно виконати.`]);
}

function renderBackendStep(container, backendTitle, step) {
  renderInfo(container, [`${backendTitle}: ${step.text}`]);
  if (step.prompt) {
    const aiTarget = state.choices.mode === 'codex' ? 'codex' : 'chatgpt';
    const block = createPromptBlock(step.prompt, {
      copyLabel: 'Скопіювати промпт',
      ai: aiTarget,
      openLabel: getAiLabel(aiTarget)
    });
    container.appendChild(block);
  }
}

function renderPaymentsChoiceStep(container) {
  const cards = document.createElement('div');
  cards.className = 'card-grid';

  PAYMENT_METHODS.forEach((method) => {
    const card = document.createElement('div');
    card.className = 'card';
    if (state.choices.payment === method.id) card.classList.add('active');
    card.innerHTML = `<h3>${method.title}</h3><p>${method.description}</p>`;
    card.addEventListener('click', () => {
      state.choices.payment = method.id;
      saveState();
      draw(true);
    });
    cards.appendChild(card);
  });

  const skip = document.createElement('div');
  skip.className = 'card';
  if (state.choices.payment === 'none') skip.classList.add('active');
  skip.innerHTML = `<h3>Пропустити</h3><p>Платежі можна додати пізніше.</p>`;
  skip.addEventListener('click', () => {
    state.choices.payment = 'none';
    saveState();
    draw(true);
  });
  cards.appendChild(skip);

  container.appendChild(cards);
}

function renderPaymentPrepStep(container) {
  if (state.choices.payment === 'none') {
    renderInfo(container, ['• Оплати поки що пропущено. Можеш повернутися до цього кроку пізніше.']);
    return;
  }
  renderInfo(container, PAYMENT_INTRO.map((item) => `• ${item}`));
}

function renderPaymentStep(container, title, step) {
  renderInfo(container, [`• ${title}: ${step.text}`]);
  if (step.prompt) {
    const aiTarget = state.choices.mode === 'codex' ? 'codex' : 'chatgpt';
    const block = createPromptBlock(step.prompt, {
      copyLabel: 'Скопіювати промпт',
      ai: aiTarget,
      openLabel: getAiLabel(aiTarget)
    });
    container.appendChild(block);
  }
}

function renderLaunchStep(container, step) {
  if (step.type === 'commands') {
    const commands = (state.commands && state.commands.length ? state.commands : ['/start', '/help']).map((cmd) => cmd.trim()).filter(Boolean);
    if (!commands.length) {
      commands.push('/start', '/help');
    }
    const lines = ['Перевір, що ключові команди працюють у чаті:'].concat(commands.map((cmd) => `• ${cmd}`));
    renderInfo(container, lines);
    if (isCustomBot() && ensureCustomState().brief) {
      renderInfo(container, ['Якщо якась команда не працює, скористайся промптом нижче для виправлення.']);
      const aiTarget = state.choices.mode === 'codex' ? 'codex' : 'chatgpt';
      const prompt = generateCommandFixPrompt(ensureCustomState());
      container.appendChild(createPromptBlock(prompt, {
        copyLabel: 'Промпт для виправлення команд',
        ai: aiTarget,
        openLabel: getAiLabel(aiTarget),
        collapsible: true
      }));
    }
    return;
  }
  renderInfo(container, step.items || []);
}

function renderInfo(container, lines, footer) {
  const entryFile = getEntryFile();
  const processedLines = lines?.map((line) => replaceEntryFileTokens(line, entryFile));

  if (processedLines?.length) {
    const block = document.createElement('div');
    block.className = 'info-block';

    processedLines.forEach((line) => {
      const parsed = parseAiLine(line);
      if (parsed) {
        const label = document.createElement('div');
        label.className = 'info-ai-label';
        label.textContent = 'Попроси ШІ:';
        block.appendChild(label);

        const promptText = extractAiPrompt(parsed);
        const target = state.choices.mode === 'codex' ? 'codex' : 'chatgpt';
        const promptBlock = createPromptBlock(promptText, {
          copyLabel: 'Скопіювати завдання',
          ai: target,
          openLabel: target === 'codex' ? 'Відкрити Codex' : 'Відкрити ChatGPT'
        });
        block.appendChild(promptBlock);
      } else {
        appendInfoLine(block, line);
      }
    });

    container.appendChild(block);
  }

  if (footer) {
    const note = document.createElement('div');
    note.className = 'note-block';
    note.textContent = replaceEntryFileTokens(footer, entryFile);
    container.appendChild(note);
  }
}

function makeRow(labelText, control) {
  const row = document.createElement('div');
  row.className = 'form-row';

  const label = document.createElement('div');
  label.className = 'form-label';
  label.textContent = labelText;
  row.appendChild(label);

  row.appendChild(control);
  return row;
}

function makeSelect(options, value, onChange) {
  const wrapper = document.createElement('div');
  wrapper.className = 'form-control';
  const select = document.createElement('select');
  options.forEach(([val, title]) => {
    const option = document.createElement('option');
    option.value = val;
    option.textContent = title;
    if (val === value) option.selected = true;
    select.appendChild(option);
  });
  select.addEventListener('change', (event) => onChange(event.target.value));
  wrapper.appendChild(select);
  return wrapper;
}

function wrapControl(control) {
  const wrapper = document.createElement('div');
  wrapper.className = 'form-control';
  wrapper.appendChild(control);
  return wrapper;
}

function createPromptBlock(text, options = {}) {
  const block = document.createElement('div');
  block.className = 'prompt-area';

  const content = document.createElement('pre');
  content.className = 'prompt-text';
  content.textContent = text;

  if (options.collapsible) {
    block.classList.add('prompt-collapsible', 'collapsed');
    const toggleWrap = document.createElement('div');
    toggleWrap.className = 'prompt-collapse-head';
    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'ghost prompt-toggle';
    const collapsedLabel = options.expandLabel || 'Розгорнути весь промт';
    const expandedLabel = options.collapseLabel || 'Згорнути промт';
    toggleBtn.textContent = collapsedLabel;
    toggleBtn.addEventListener('click', () => {
      const collapsed = block.classList.toggle('collapsed');
      content.hidden = collapsed;
      toggleBtn.textContent = collapsed ? collapsedLabel : expandedLabel;
    });
    toggleWrap.appendChild(toggleBtn);
    block.appendChild(toggleWrap);
    content.hidden = true;
  }

  block.appendChild(content);

  const actions = document.createElement('div');
  actions.className = 'prompt-actions';

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'ghost copy-btn';
  copyBtn.textContent = options.copyLabel || 'Скопіювати';
  copyBtn.addEventListener('click', () => copyText(text));
  actions.appendChild(copyBtn);

  if (options.ai) {
    const target = options.ai;
    const aiBtn = document.createElement('button');
    aiBtn.type = 'button';
    aiBtn.className = 'primary prompt-open';
    aiBtn.textContent = options.openLabel || getAiLabel(target);
    aiBtn.addEventListener('click', () => openAi(target));
    actions.appendChild(aiBtn);
  }

  block.appendChild(actions);
  return block;
}

function createToolCard({ title, description, link, prompt, ai }) {
  const card = document.createElement('div');
  card.className = 'card';

  const h = document.createElement('h3');
  h.textContent = title;
  card.appendChild(h);

  if (description) {
    const p = document.createElement('p');
    p.textContent = description;
    card.appendChild(p);
  }

  if (prompt) {
    const aiTarget = ai || 'chatgpt';
    card.appendChild(createPromptBlock(prompt, {
      copyLabel: 'Скопіювати інструкцію',
      ai: aiTarget,
      openLabel: getAiLabel(aiTarget)
    }));
  }

  if (link) {
    const actions = document.createElement('div');
    actions.className = 'prompt-actions';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'primary prompt-open';
    btn.textContent = 'Відкрити сайт';
    btn.addEventListener('click', () => openAi(link));
    actions.appendChild(btn);
    card.appendChild(actions);
  }

  return card;
}

function createCarouselSlide({ title, body, code }) {
  const slide = document.createElement('div');
  slide.className = 'carousel-slide';

  const h = document.createElement('h4');
  h.textContent = title;
  slide.appendChild(h);

  const p = document.createElement('p');
  p.textContent = body;
  slide.appendChild(p);

  if (code) {
    const pre = document.createElement('pre');
    pre.className = 'carousel-code';
    pre.textContent = code;
    slide.appendChild(pre);

    const actions = document.createElement('div');
    actions.className = 'prompt-actions';
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'ghost copy-btn';
    copyBtn.textContent = 'Скопіювати код';
    copyBtn.addEventListener('click', () => copyText(code));
    actions.appendChild(copyBtn);
    slide.appendChild(actions);
  }

  return slide;
}

function getAiLabel(target) {
  switch (target) {
    case 'codex':
      return 'Відкрити Codex';
    case 'chatgpt':
    default:
      return 'Відкрити ChatGPT';
  }
}

function openAi(target) {
  const url = AI_LINKS[target] || target;
  window.open(url, '_blank', 'noopener');
}

function parseAiLine(line) {
  const trimmed = line.trim();
  const withoutBullet = trimmed.startsWith('•') ? trimmed.slice(1).trim() : trimmed;
  return withoutBullet.startsWith('Попроси ШІ') ? withoutBullet : null;
}

function extractAiPrompt(line) {
  let prompt = line.replace(/^Попроси ШІ:\s*/, '').trim();
  if (prompt.startsWith('«') && prompt.endsWith('»')) prompt = prompt.slice(1, -1);
  prompt = prompt.replace(/^[«"]/u, '').replace(/[»"]?\.?$/u, '').trim();
  return prompt;
}

function extractBackticked(line) {
  const items = [];
  const regex = /`([^`]+)`/g;
  let match;
  while ((match = regex.exec(line)) !== null) {
    if (match[1]) items.push(match[1]);
  }
  return items;
}

function replaceEntryFileTokens(text, entryFile) {
  if (typeof text !== 'string') return text;
  return text.replace(/main\.py/g, entryFile || 'main.py');
}

function appendInfoLine(block, line) {
  const row = document.createElement('div');
  row.className = 'info-line';

  const text = document.createElement('div');
  text.className = 'info-line-text';
  text.textContent = line;
  row.appendChild(text);

  const actions = document.createElement('div');
  actions.className = 'inline-actions';

  const snippets = extractBackticked(line);
  snippets.forEach((snippet) => {
    if (snippet === '@BotFather') return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ghost copy-btn';
    btn.textContent = `Скопіювати ${snippet}`;
    btn.addEventListener('click', () => copyText(snippet));
    actions.appendChild(btn);
  });

  if (/BotFather/i.test(line)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'primary prompt-open';
    btn.textContent = 'Відкрити BotFather';
    btn.addEventListener('click', () => openAi('https://t.me/BotFather'));
    actions.appendChild(btn);
  }

  if (actions.childElementCount) row.appendChild(actions);
  block.appendChild(row);
}

// --- Загальні утиліти ---
function copyText(text) {
  if (!navigator.clipboard) {
    showToast('Скопіювати не вдалося (обмеження браузера).');
    return;
  }
  navigator.clipboard.writeText(text).then(() => showToast('Скопійовано у буфер.'));
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.style.display = 'inline-flex';
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    elements.toast.style.display = 'none';
  }, 2200);
}

function validateStep(step) {
  switch (step.id) {
    case 'bot-type':
      return state.choices.botType ? ok() : fail('Оберіть тип бота.');
    case 'mode':
      return state.choices.mode ? ok() : fail('Оберіть режим ШІ.');
    case 'environment':
      return state.choices.environment ? ok() : fail('Оберіть середовище.');
    case 'tools': {
      const required = TOOL_CHECKLIST.filter((tool) => !tool.optional || state.choices.mode === 'codex');
      const ready = required.every((tool) => state.tools[tool.id]);
      return ready ? ok() : fail('Постав галочки у чек-листі.');
    }
    case 'requirements':
      return state.tools.requirements ? ok() : fail('Створи requirements.txt або познач, що зробиш це.');
    case 'env-file':
      return state.tools.env ? ok() : fail('Створи .env або познач, що зробиш це.');
    case 'backend-choice':
      return state.choices.backend ? ok() : fail('Оберіть тип зберігання.');
    case 'custom-requirements': {
      const custom = ensureCustomState();
      return custom.requirements?.trim() ? ok() : fail('Опиши, якого бота ти хочеш.');
    }
    case 'custom-brief-import': {
      const custom = ensureCustomState();
      return custom.brief ? ok() : fail('Додай JSON-бриф і натисни «Зберегти бриф».');
    }
    case 'custom-files': {
      const custom = ensureCustomState();
      if (!custom.files.length) return fail('Спочатку збережи бриф, щоб побудувати список файлів.');
      const allDone = custom.files.every((file) => file.done);
      return allDone ? ok() : fail('Познач усі файли як виконані.');
    }
    case 'custom-terminal': {
      const custom = ensureCustomState();
      return custom.commandsText?.trim() ? ok() : fail('Додай або підтвердь команди для запуску.');
    }
    default:
      return ok();
  }

  function ok() {
    return { allow: true };
  }
  function fail(message) {
    return { allow: false, message };
  }
}

function generateDevBrief() {
  const type = BOT_TYPES.find((item) => item.id === state.choices.botType);
  const mode = MODE_OPTIONS.find((item) => item.id === state.choices.mode);
  const environment = ENVIRONMENTS.find((item) => item.id === state.choices.environment);
  const backend = BACKEND_OPTIONS.find((item) => item.id === state.choices.backend);

  return [
    `Тип бота: ${type ? `${type.title} (${type.description})` : 'ще не обрано'}.`,
    `Режим роботи: ${mode ? mode.title : 'ще не обрано'}.`,
    `Середовище: ${environment ? environment.title : 'ще не обрано'}.`,
    `Команди: ${state.commands.length ? state.commands.join(', ') : '/start, /help'}.`,
    `Бекенд: ${backend ? backend.title : 'JSON (за замовчуванням)'}.`,
    'Мова інтерфейсу: українська.',
    'Канал: приватні чати (dm).',
    '',
    'Ціль: створити робочого Telegram-бота з покроковим налаштуванням.',
    'Скопіюй цей бриф у ChatGPT або Codex, щоб отримати інструкції з коду.'
  ].join('\n');
}

function generateManualFilePrompt(entryFile, currentState = state) {
  const type = BOT_TYPES.find((item) => item.id === currentState.choices.botType);
  const backend = BACKEND_OPTIONS.find((item) => item.id === currentState.choices.backend);

  return [
    `Мені потрібен файл ${entryFile}.`,
    `Тип бота: ${type ? `${type.title} — ${type.description}` : 'базовий асистент'}.`,
    `Команди: ${currentState.commands.length ? currentState.commands.join(', ') : '/start, /help'}.`,
    `Бекенд/зберігання: ${backend ? backend.title : 'JSON (просте збереження у файлі)'}.`,
    `Покажи повний код файла ${entryFile} одним блоком без коментарів та зайвих пояснень.`,
    'Наприкінці коротко нагадай, як запустити бота (python ' + entryFile + ').'
  ].join('\n');
}

function generateCodePrompt() {
  const entryFile = getEntryFile();
  const manualPrompt = generateManualFilePrompt(entryFile);

  return [
    'Ти — досвідчений Python-розробник. Побудуй Telegram-бота на aiogram v3.',
    manualPrompt,
    'Не додавай інші файли чи розрізнені фрагменти — тільки повний код зазначеного файла.',
    'Після коду дай інструкції з встановлення залежностей (pip install -r requirements.txt) та запуску бота.',
    'Використовуй дружні повідомлення українською.'
  ].join('\n');
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    const merged = Object.assign(structuredClone(defaultState), parsed);
    merged.tools = Object.assign({}, defaultState.tools, merged.tools);
    if (merged.tools.requirements === undefined) merged.tools.requirements = false;
    if (merged.tools.env === undefined) merged.tools.env = false;
    merged.custom = Object.assign(structuredClone(defaultCustomState), merged.custom || {});
    if (!Array.isArray(merged.custom.files)) merged.custom.files = [];
    if (!merged.custom.diag) merged.custom.diag = { description: '', logs: '', prompt: '' };
    if (!merged.choices.entryFile) merged.choices.entryFile = ENTRY_FILE_OPTIONS[0].id;
    return merged;
  } catch (error) {
    console.error('Не вдалося завантажити стан', error);
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function structuredClone(value) {
  return JSON.parse(JSON.stringify(value));
}
