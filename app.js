const STORAGE_KEY = 'ztb_v4_state';

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
      'Фіксуй виконавця, дедлайн і статус кожного завдання.',
      'Стартуй із JSON, переходь на SQLite, коли команда виросте.',
      'Додай нагадування про дедлайни, щоб команда не забувала.'
    ]
  },
  {
    id: 'habit',
    title: 'Habit Tracker',
    description: 'Щоденні звички й нагадування',
    commands: ['/start', '/help', '/add', '/habits', '/done', '/streak', '/plan', '/stats'],
    tips: [
      'Записуй назву звички, час доби та прогрес.',
      'Обов’язково додай нагадування — інакше звички не працюють.',
      'Зберігання: JSON (старт) або SQLite (гнучкі звіти).'
    ]
  },
  {
    id: 'faq',
    title: 'FAQ / Support',
    description: 'Відповідає на типові питання',
    commands: ['/start', '/help', '/faq', '/contact', '/tips'],
    tips: [
      'Питання/відповіді тримай у таблиці — Google Sheets ідеально.',
      'Додай швидкі кнопки: «Написати менеджеру», «Отримати знижку».',
      'Стислий дружній текст з емодзі підвищує довіру.'
    ]
  },
  {
    id: 'shop',
    title: 'Shop',
    description: 'Міні-магазин у Telegram',
    commands: ['/start', '/help', '/catalog', '/buy', '/cart', '/pay', '/support'],
    tips: [
      'Каталог = назва, опис, ціна, наявність.',
      'Бекенд: SQLite + Stripe або WayForPay.',
      'Сповіщай менеджера про нові замовлення.'
    ]
  },
  {
    id: 'booking',
    title: 'Booking',
    description: 'Запис на послуги',
    commands: ['/start', '/help', '/book', '/slots', '/cancel', '/contact'],
    tips: [
      'Зберігай дату, час, клієнта й статус бронювання.',
      'SQLite або Google Sheets підійдуть для розкладу.',
      'Налаштуй нагадування за 2 години до зустрічі.'
    ]
  },
  {
    id: 'custom',
    title: 'Custom',
    description: 'Свій сценарій',
    commands: ['/start', '/help'],
    tips: [
      'Почни з мінімуму: /start, /help та 2-3 власні команди.',
      'Стартуй із JSON, далі переходь на SQLite для масштабу.',
      'Розбивай проєкт на модулі — як у цьому гайді.'
    ]
  }
];

const MODE_OPTIONS = [
  { id: 'chatgpt', title: 'ChatGPT-only', description: 'Безкоштовно. Код переносиш вручну.' },
  { id: 'codex', title: 'ChatGPT + Codex (Copilot)', description: 'Потрібна підписка на Copilot. Швидше і чистіше.' }
];

const ENVIRONMENTS = [
  { id: 'local', title: '💻 Local', description: 'Працюєш на власному комп’ютері. Потрібно встановити Python.' },
  { id: 'codespaces', title: '☁️ Codespaces', description: 'Усе в браузері через GitHub. Python встановлювати не треба.' }
];

const TOOL_CHECKLIST = [
  { id: 'python', label: 'Python 3.10+ встановлено' },
  { id: 'editor', label: 'Редактор відкривається (VS Code або Cursor)' },
  { id: 'github', label: 'Є обліковий запис GitHub' },
  { id: 'copilot', label: 'Copilot увімкнений (для режиму Codex)', optional: true }
];

const BACKEND_OPTIONS = [
  {
    id: 'json',
    title: 'JSON файл',
    summary: 'Найпростіший варіант. Дані зберігаються у файлі.',
    steps: [
      {
        title: 'Створи папку data/ і файл db.json',
        details: 'Файл буде головним сховищем даних.',
        prompt: null
      },
      {
        title: 'Додай функції читання/запису JSON',
        details: 'Попроси ШІ написати функції load/save для файлу.',
        prompt: 'Додай у проект функції load_data та save_data, які працюють з файлом data/db.json (створюють файл, якщо його немає).'
      },
      {
        title: 'Підключи у хендлері /add',
        details: 'Інтегруй функції у логіку додавання даних.',
        prompt: null
      },
      {
        title: 'Тест: /add → запис у db.json',
        details: 'Перевір, що новий запис з’явився у файлі.',
        prompt: null
      }
    ]
  },
  {
    id: 'sqlite',
    title: 'SQLite',
    summary: 'База у файлі. Ідеальна для невеликих проєктів.',
    steps: [
      {
        title: 'Створи файл db.sqlite3',
        details: 'Файл можна створити прямо в редакторі.',
        prompt: null
      },
      {
        title: 'Додай таблицю tasks (id, name, status)',
        details: 'Попроси ШІ описати схему та CRUD-функції.',
        prompt: 'Додай у проект SQLite із таблицею tasks (id INTEGER PK, name TEXT, status TEXT) і функціями створити/прочитати/оновити/видалити.'
      },
      {
        title: 'Підключи репозиторій до бота',
        details: 'Використай функції у хендлерах /add, /list, /done.',
        prompt: null
      },
      {
        title: 'Тест: /add → запис у таблиці',
        details: 'Перевір через sqlite3 або вивід у консоль.',
        prompt: null
      }
    ]
  },
  {
    id: 'gsheets',
    title: 'Google Sheets',
    summary: 'Онлайн-таблиця як база даних.',
    steps: [
      {
        title: 'Створи Google Sheet',
        details: 'Увімкни доступ “за посиланням” і скопіюй ID.',
        prompt: null
      },
      {
        title: 'Підключи gspread',
        details: 'Додай бібліотеку, ключі у .env.',
        prompt: 'Підключи gspread до Google Sheets. Використай змінні .env: GOOGLE_CREDENTIALS (JSON), SHEET_ID.'
      },
      {
        title: 'Зроби функцію запису рядків',
        details: 'append_row для збереження даних.',
        prompt: null
      },
      {
        title: 'Тест: /add → новий рядок у таблиці',
        details: 'Перевір результат у Sheets.',
        prompt: null
      }
    ]
  },
  {
    id: 'postgres',
    title: 'Postgres (Docker)',
    summary: 'Потужна база для команди/бізнесу.',
    steps: [
      {
        title: 'Встанови Docker Desktop',
        details: 'Скачай з офіційного сайту і встанови.',
        prompt: null
      },
      {
        title: 'Створи docker-compose.yml',
        details: 'Підніми Postgres у контейнері.',
        prompt: 'Згенеруй docker-compose.yml з Postgres (POSTGRES_PASSWORD=postgres, порт 5432) та сервісом для бота.'
      },
      {
        title: 'Додай psycopg2 та підключення',
        details: 'Описати таблиці та CRUD-функції.',
        prompt: 'Підключи aiogram-проєкт до Postgres через psycopg2 або SQLAlchemy. Створи таблицю tasks (id SERIAL, name TEXT, status TEXT) і CRUD-функції.'
      },
      {
        title: 'Інтегруй у хендлери',
        details: 'Використай репозиторій у /add, /list, /done.',
        prompt: null
      },
      {
        title: 'Тест: /add → запис у базі',
        details: 'Перевір через psql або pgAdmin.',
        prompt: null
      }
    ]
  }
];

const DESIGN_STEPS = [
  {
    title: 'Що таке дизайн',
    body: 'Дизайн — це вигляд бота: кнопки, меню, тексти. Робимо просто та зрозуміло.'
  },
  {
    title: 'Головне меню (Reply-кнопки)',
    steps: [
      'Запитай: «Додай меню з кнопками: 📋 Завдання, 🧠 Поради, ⚙️ Налаштування».',
      'Встав код → збережи → у Telegram введи `/start` → меню має з’явитися.'
    ]
  },
  {
    title: 'Inline-кнопки',
    steps: [
      'Запитай: «Додай inline-кнопки на сторінці “Завдання”: [✅ Готово] [❌ Пропустити] [📊 Статистика]».',
      'Встав код → протестуй у чаті.'
    ]
  },
  {
    title: 'Гарні тексти',
    steps: [
      'Додай емодзі, короткі дружні фрази.',
      'Приклад:\n🌟 Твій прогрес сьогодні\n✅ Завдання виконано\n🔄 Повертайся завтра!'
    ]
  }
];

const STATS_STEPS = [
  {
    title: 'Команда /stats',
    steps: [
      'Запитай: «Додай команду /stats. Показуй скільки зроблено за сьогодні, тиждень, всього».',
      'Встав код → збережи → перевір у Telegram.'
    ]
  },
  {
    title: 'Красивий звіт',
    steps: [
      'Запитай: «Зроби звіт із емодзі та відсотками».',
      'Приклад:\n📊 Твій прогрес:\n✅ За сьогодні: 3/5\n📅 За тиждень: 17/25\n🌟 Молодець!'
    ]
  },
  {
    title: 'Щоденні нагадування',
    steps: [
      'Запитай: «Надсилай щоденний звіт о 20:00».',
      'Додай планувальник (apscheduler або asyncio) й перевір.'
    ]
  }
];

const PAYMENT_INTRO = [
  'Зареєструйся у вибраній платіжній системі: stripe.com або wayforpay.com.',
  'Додай у `.env` ключі: `STRIPE_KEY=...`, `WAYFORPAY_KEY=...` (залежно від вибору).',
  'API-ключ — секретний код для доступу до сервісу. Не ділись ним.'
];

const PAYMENT_METHODS = [
  {
    id: 'stripe',
    title: 'Stripe',
    description: 'Міжнародні картки (USD та інші валюти).',
    steps: [
      {
        title: 'Додай оплату Stripe на $5',
        details: 'Команда /buy. Після успіху — повідомлення «Дякую за оплату!».',
        prompt: 'Додай у бота оплату Stripe на $5: команда /buy, успішна оплата → повідомлення “Дякую за оплату!”.'
      },
      {
        title: 'Перевір оплату',
        details: 'Посилання на оплату відкривається й працює.',
        prompt: null
      }
    ]
  },
  {
    id: 'wayforpay',
    title: 'WayForPay',
    description: 'Українська платіжка (гривня).',
    steps: [
      {
        title: 'Додай WayForPay на 100 грн',
        details: 'Продаємо «Преміум-доступ». Після оплати — «Дякую!».',
        prompt: 'Додай WayForPay оплату на 100 грн для “Преміум-доступ”. Після успіху відправ “Дякую!”.'
      },
      {
        title: 'Перевір форму оплати',
        details: 'Форма відкривається, тестова оплата проходить.',
        prompt: null
      }
    ]
  }
];

const LAUNCH_STEPS = [
  {
    title: 'Створення бота у BotFather',
    steps: [
      'Відкрий `@BotFather` → команда `/newbot`.',
      'Скопіюй токен і встав у `.env` як `TOKEN=...`.'
    ]
  },
  {
    title: 'Запуск',
    steps: [
      'У терміналі (всередині папки проєкту) виконай:',
      '```bash\npython main.py\n```',
      'Якщо бачиш “Bot started” — все добре.'
    ]
  },
  {
    title: 'Перевір команди',
    steps: [
      '`/start` — привітання є.',
      '`/help` — інструкція є.',
      'Кастомна команда (наприклад `/add`) — працює.'
    ]
  },
  {
    title: 'Резервна копія',
    steps: [
      'Скопіюй папку у хмару або на GitHub.',
      'Перезапусти бота й переконайся, що все працює.'
    ]
  }
];

const GROWTH_STEPS = [
  {
    title: 'Додаткові модулі',
    steps: ['🔁 автозбереження', '🌍 багатомовність (uk/en)', '🧩 адмін-панель']
  },
  {
    title: 'Фініш',
    steps: ['Покажи повідомлення: «Готово! Ти створив свого Telegram-бота.»', 'Кнопки: 🔄 «Створити нового бота», 🚀 «Покращити поточного».']
  }
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
  tools: TOOL_CHECKLIST.reduce((acc, tool) => {
    acc[tool.id] = false;
    return acc;
  }, {}),
  commands: ['/start', '/help']
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return clone(defaultState);
    const parsed = JSON.parse(raw);
    return Object.assign(clone(defaultState), parsed);
  } catch (error) {
    console.error('Failed to load state', error);
    return clone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const elements = {
  section: document.getElementById('section-label'),
  progressBar: document.getElementById('progress-inner'),
  progressLabel: document.getElementById('progress-label'),
  stepIndex: document.getElementById('step-index'),
  stepTitle: document.getElementById('step-title'),
  stepBody: document.getElementById('step-body'),
  prev: document.getElementById('prev-btn'),
  next: document.getElementById('next-btn'),
  footer: document.querySelector('footer.controls'),
  toast: document.getElementById('toast')
};

let state = loadState();
let steps = [];

elements.prev.addEventListener('click', () => {
  if (state.currentStep === 0) return;
  goToStep(state.currentStep - 1);
});

elements.next.addEventListener('click', () => {
  const step = steps[state.currentStep];
  const validation = validateStep(step);
  if (!validation.allow) {
    showToast(validation.message);
    return;
  }
  if (state.currentStep === steps.length - 1) {
    showToast('Готово! Тепер можеш повертатися до будь-якого кроку.');
    return;
  }
  goToStep(state.currentStep + 1);
});

function goToStep(index) {
  rebuildSteps(false);
  state.currentStep = Math.max(0, Math.min(index, steps.length - 1));
  saveState();
  render();
}

function refreshCurrentStep() {
  rebuildSteps(true);
  saveState();
  render();
}

function rebuildSteps(preserveCurrent = true) {
  const previousId = preserveCurrent && steps.length ? steps[state.currentStep]?.id : null;
  steps = buildSteps();
  if (!steps.length) {
    state.currentStep = 0;
    return;
  }
  if (preserveCurrent && previousId) {
    const index = steps.findIndex((step) => step.id === previousId);
    if (index >= 0) {
      state.currentStep = index;
      return;
    }
  }
  state.currentStep = Math.min(state.currentStep, steps.length - 1);
}

function buildSteps() {
  const result = [];

  // I. Start
  result.push(makeStep('start', 'I. Старт', 'Привітання', renderStartStep, { hideNav: true }));
  result.push(makeStep('bot-type', 'I. Старт', 'Вибір типу бота', renderBotTypeStep));
  result.push(makeStep('mode', 'I. Старт', 'Вибір режиму ШІ', renderModeStep));
  result.push(makeStep('environment', 'I. Старт', 'Вибір середовища', renderEnvironmentStep));
  result.push(makeStep('tools', 'I. Старт', 'Перевірка інструментів', renderToolsStep));

  // II. Project preparation
  result.push(makeStep('folder', 'II. Підготовка проєкту', 'Створення папки', (c) =>
    renderInfo(c, ['Створи папку `mybot`.', 'Відкрий її у редакторі (VS Code / Cursor).'], 'Мета: мати чисте місце для файлів бота.'))
  );
  result.push(makeStep('requirements', 'II. Підготовка проєкту', 'Створення requirements.txt', renderRequirementsStep));
  result.push(makeStep('main-file', 'II. Підготовка проєкту', 'Створення main.py', (c) =>
    renderInfo(c, ['Створи файл `main.py` у корені.', 'Залиш порожнім — код додамо пізніше.']))
  );
  result.push(makeStep('env-file', 'II. Підготовка проєкту', 'Створення .env', renderEnvStep));
  result.push(makeStep('dev-brief', 'II. Підготовка проєкту', 'DEV BRIEF', renderDevBriefStep));
  result.push(makeStep('code-prompt', 'II. Підготовка проєкту', 'Промпт для коду', renderCodePromptStep));

  // III. Backend
  result.push(makeStep('backend-choice', 'III. База даних', 'Вибір типу зберігання', renderBackendChoiceStep));
  result.push(makeStep('backend-explain', 'III. База даних', 'Пояснення від панелі', (c) =>
    renderInfo(c, [
      'Без зберігання бот “забуває” все після перезапуску.',
      'Обери варіант і доведи його до тесту.'
    ]))
  );
  result.push(makeStep('backend-confirm', 'III. База даних', 'Підтвердження вибору', renderBackendConfirmStep));

  const backend = BACKEND_OPTIONS.find((option) => option.id === state.choices.backend);
  if (backend) {
    backend.steps.forEach((item, index) => {
      result.push(makeStep(`backend-${backend.id}-${index}`, 'III. База даних', item.title, (container) =>
        renderBackendStep(container, backend.title, item)
      ));
    });
  }

  // IV. Design
  DESIGN_STEPS.forEach((item, idx) => {
    result.push(makeStep(`design-${idx}`, 'IV. Дизайн', item.title, (container) => {
      if (item.body) {
        renderInfo(container, [item.body]);
      }
      if (item.steps) {
        renderListBlock(container, item.steps);
      }
    }));
  });

  // V. Stats
  STATS_STEPS.forEach((item, idx) => {
    result.push(makeStep(`stats-${idx}`, 'V. Статистика', item.title, (container) => renderListBlock(container, item.steps)));
  });

  // VI. Payments
  result.push(makeStep('payments-choice', 'VI. Оплати', 'Вибір системи оплати', renderPaymentsChoiceStep));
  result.push(makeStep('payments-prep', 'VI. Оплати', 'Підготовка ключів', renderPaymentPrepStep));
  const payment = PAYMENT_METHODS.find((option) => option.id === state.choices.payment);
  if (payment) {
    payment.steps.forEach((item, index) => {
      result.push(makeStep(`payment-${payment.id}-${index}`, 'VI. Оплати', item.title, (container) =>
        renderPaymentStep(container, payment.title, item)
      ));
    });
  }

  // VII. Launch
  LAUNCH_STEPS.forEach((item, idx) => {
    result.push(makeStep(`launch-${idx}`, 'VII. Запуск', item.title, (container) => renderListBlock(container, item.steps)));
  });

  // VIII. Growth
  GROWTH_STEPS.forEach((item, idx) => {
    result.push(makeStep(`growth-${idx}`, 'VIII. Розвиток', item.title, (container) => renderListBlock(container, item.steps)));
  });

  // Advice
  result.push(makeStep('advice', 'Поради за типами', 'Поради для обраного типу', renderAdviceStep));

  result.forEach((step, index) => {
    step.number = index + 1;
  });

  return result;
}

function makeStep(id, section, title, renderFn, extra = {}) {
  return { id, section, title, render: renderFn, hideNav: !!extra.hideNav, number: 0 };
}

function render() {
  if (!steps.length) return;
  const step = steps[state.currentStep];

  elements.section.textContent = step.section;
  elements.stepIndex.textContent = `Крок ${step.number}`;
  elements.stepTitle.textContent = step.title;
  elements.stepBody.innerHTML = '';
  step.render(elements.stepBody);

  const progress = ((state.currentStep + 1) / steps.length) * 100;
  elements.progressBar.style.width = `${progress}%`;
  elements.progressLabel.textContent = `${state.currentStep + 1} / ${steps.length}`;

  elements.prev.disabled = state.currentStep === 0;
  elements.next.textContent = state.currentStep === steps.length - 1 ? 'Завершити' : 'Далі ➡️';
  elements.footer.style.display = step.hideNav ? 'none' : '';
}

function renderStartStep(container) {
  const block = document.createElement('div');
  block.className = 'start-screen';

  const title = document.createElement('h3');
  title.textContent = 'Запускаємо майстер створення власного Telegram-бота.';
  block.appendChild(title);

  const desc = document.createElement('p');
  desc.textContent = 'Принцип: одна дія = один крок. Готові? Натисни кнопку й рухаємось.';
  block.appendChild(desc);

  const button = document.createElement('button');
  button.className = 'primary';
  button.textContent = 'Почати';
  button.addEventListener('click', () => goToStep(state.currentStep + 1));
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
        <th>Короткий опис</th>
        <th>Рекомендовані команди</th>
      </tr>
    </thead>
    <tbody>
      ${BOT_TYPES.map((type) => `
        <tr>
          <td><strong>${type.title}</strong></td>
          <td>${type.description}</td>
          <td>${type.commands.join(', ')}</td>
        </tr>
      `).join('')}
    </tbody>
  `;
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
      refreshCurrentStep();
    });
    cards.appendChild(card);
  });
  container.appendChild(cards);

  renderInfo(container, ['Команда — це слово з косою рискою, яке ти пишеш боту. Наприклад, /start.']);
}

function renderModeStep(container) {
  const cards = document.createElement('div');
  cards.className = 'card-grid';
  MODE_OPTIONS.forEach((mode) => {
    const card = document.createElement('div');
    card.className = 'card';
    if (state.choices.mode === mode.id) card.classList.add('active');
    card.innerHTML = `<h3>${mode.title}</h3><p>${mode.description}</p>`;
    card.addEventListener('click', () => {
      state.choices.mode = mode.id;
      saveState();
      refreshCurrentStep();
    });
    cards.appendChild(card);
  });
  container.appendChild(cards);

  renderInfo(container, ['Система підлаштує підказки: «Скопіювати для ChatGPT» або «Відкрити в Codex».']);
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
      if (env.id !== 'codespaces') {
        state.tools.copilot = false;
      }
      saveState();
      refreshCurrentStep();
    });
    cards.appendChild(card);
  });
  container.appendChild(cards);
}

function renderToolsStep(container) {
  const checklist = document.createElement('div');
  checklist.className = 'checklist';

  TOOL_CHECKLIST.forEach((tool) => {
    const isVisible = !tool.optional || state.choices.mode === 'codex';
    if (!isVisible) {
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
    span.textContent = tool.label;
    label.appendChild(span);
    row.appendChild(label);
    checklist.appendChild(row);
  });

  container.appendChild(checklist);
}

function renderRequirementsStep(container) {
  renderInfo(container, [
    'Створи файл `requirements.txt` з вмістом:',
    '```\naiogram==3.*\npython-dotenv\n```',
    'Це залежності проєкту.'
  ]);
}

function renderEnvStep(container) {
  renderInfo(container, [
    'Створи файл `.env` з рядком:',
    '```\nTOKEN=сюди_вставиш_токен\n```',
    '.env зберігає секретні ключі. Не публікуємо його.'
  ]);
}

function renderDevBriefStep(container) {
  const brief = generateDevBrief();
  const block = document.createElement('div');
  block.className = 'prompt-area';
  block.textContent = brief;

  const button = document.createElement('button');
  button.className = 'copy-btn';
  button.textContent = 'Скопіювати';
  button.addEventListener('click', () => copyText(brief));
  block.appendChild(button);

  container.appendChild(block);
}

function renderCodePromptStep(container) {
  const prompt = generateCodePrompt();
  renderInfo(container, [
    `Використай ${state.choices.mode === 'codex' ? 'Codex/Cursor' : 'ChatGPT'} промпт, встав код у main.py та збережи.`
  ]);
  const block = document.createElement('div');
  block.className = 'prompt-area';
  block.textContent = prompt;

  const button = document.createElement('button');
  button.className = 'copy-btn';
  button.textContent = 'Скопіювати промпт';
  button.addEventListener('click', () => copyText(prompt));
  block.appendChild(button);

  container.appendChild(block);
}

function renderBackendChoiceStep(container) {
  const cards = document.createElement('div');
  cards.className = 'card-grid';
  BACKEND_OPTIONS.forEach((option) => {
    const card = document.createElement('div');
    card.className = 'card';
    if (state.choices.backend === option.id) card.classList.add('active');
    card.innerHTML = `<h3>${option.title}</h3><p>${option.summary}</p>`;
    card.addEventListener('click', () => {
      state.choices.backend = option.id;
      saveState();
      refreshCurrentStep();
    });
    cards.appendChild(card);
  });
  container.appendChild(cards);
}

function renderBackendConfirmStep(container) {
  const backend = BACKEND_OPTIONS.find((option) => option.id === state.choices.backend);
  if (!backend) {
    renderInfo(container, ['Спочатку обери тип зберігання, щоб ми побудували гілку кроків.']);
    return;
  }
  renderInfo(container, [
    `Обрано: ${backend.title}. Нижче — покрокові дії для цього варіанту.`,
    'Виконуй їх послідовно і став галочки у списку.'
  ]);
}

function renderBackendStep(container, backendTitle, step) {
  renderInfo(container, [`${backendTitle}: ${step.details}`]);
  if (step.prompt) {
    const block = document.createElement('div');
    block.className = 'prompt-area';
    block.textContent = step.prompt;
    const button = document.createElement('button');
    button.className = 'copy-btn';
    button.textContent = 'Скопіювати промпт';
    button.addEventListener('click', () => copyText(step.prompt));
    block.appendChild(button);
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
      refreshCurrentStep();
    });
    cards.appendChild(card);
  });

  const skipCard = document.createElement('div');
  skipCard.className = 'card';
  if (state.choices.payment === 'none') skipCard.classList.add('active');
  skipCard.innerHTML = `<h3>Пропустити оплати</h3><p>Можна додати платежі пізніше. Натисни, щоб перейти далі без них.</p>`;
  skipCard.addEventListener('click', () => {
    state.choices.payment = 'none';
    saveState();
    refreshCurrentStep();
  });
  cards.appendChild(skipCard);

  container.appendChild(cards);
}

function renderPaymentPrepStep(container) {
  if (state.choices.payment === 'none') {
    renderInfo(container, ['Оплати поки що пропущено. Можеш повернутися до цього кроку пізніше.']);
    return;
  }
  renderListBlock(container, PAYMENT_INTRO);
}

function renderPaymentStep(container, title, step) {
  renderInfo(container, [`${title}: ${step.details}`]);
  if (step.prompt) {
    const block = document.createElement('div');
    block.className = 'prompt-area';
    block.textContent = step.prompt;
    const button = document.createElement('button');
    button.className = 'copy-btn';
    button.textContent = 'Скопіювати промпт';
    button.addEventListener('click', () => copyText(step.prompt));
    block.appendChild(button);
    container.appendChild(block);
  }
}

function renderAdviceStep(container) {
  const type = BOT_TYPES.find((item) => item.id === state.choices.botType);
  if (!type) {
    renderInfo(container, ['Щоб отримати поради, обери тип бота на початку.']);
    return;
  }
  renderInfo(container, [`${type.title} — ключові рекомендації:`]);
  renderListBlock(container, type.tips);
}

function renderInfo(container, lines, footer) {
  if (lines?.length) {
    const block = document.createElement('div');
    block.className = 'info-block';
    block.innerHTML = lines.map((line) => `<div>${line}</div>`).join('');
    container.appendChild(block);
  }
  if (footer) {
    const note = document.createElement('div');
    note.className = 'note-block';
    note.textContent = footer;
    container.appendChild(note);
  }
}

function renderListBlock(container, items) {
  const block = document.createElement('div');
  block.className = 'info-block';
  block.innerHTML = items.map((item) => `<div>• ${item}</div>`).join('');
  container.appendChild(block);
}

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
      return state.choices.botType ? { allow: true } : { allow: false, message: 'Оберіть тип бота.' };
    case 'mode':
      return state.choices.mode ? { allow: true } : { allow: false, message: 'Оберіть режим ШІ.' };
    case 'environment':
      return state.choices.environment ? { allow: true } : { allow: false, message: 'Оберіть середовище.' };
    case 'tools': {
      const required = TOOL_CHECKLIST.filter((tool) => !tool.optional || state.choices.mode === 'codex');
      const ready = required.every((tool) => state.tools[tool.id]);
      return ready ? { allow: true } : { allow: false, message: 'Постав галочки у чек-листі.' };
    }
    case 'backend-choice':
      return state.choices.backend ? { allow: true } : { allow: false, message: 'Оберіть тип зберігання.' };
    default:
      return { allow: true };
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

function generateCodePrompt() {
  const type = BOT_TYPES.find((item) => item.id === state.choices.botType);
  const backend = BACKEND_OPTIONS.find((item) => item.id === state.choices.backend);
  return [
    'Ти — досвідчений Python-розробник. Побудуй Telegram-бота на aiogram v3.',
    `Тип бота: ${type ? `${type.title} — ${type.description}` : 'базовий асистент'}.`,
    `Команди: ${state.commands.join(', ') || '/start, /help'}.`,
    `Бекенд/зберігання: ${backend ? backend.title : 'JSON (просте збереження у файлі)'}.`,
    'Файли проєкту:',
    '- requirements.txt (aiogram==3.*, python-dotenv)',
    '- main.py (головний файл)',
    '- .env (TOKEN та інші секрети)',
    'Опиши, як запустити бота (python main.py). Використовуй дружні повідомлення українською.'
  ].join('\n');
}

rebuildSteps(false);
render();
