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
      'Додай нагадування про дедлайни — це дисциплінує.'
    ]
  },
  {
    id: 'habit',
    title: 'Habit Tracker',
    description: 'Щоденні звички й нагадування',
    commands: ['/start', '/help', '/add', '/habits', '/done', '/streak', '/plan', '/stats'],
    tips: [
      'Записуй назву звички, час доби та прогрес.',
      'Нагадування обов’язкові, інакше звички не закріпляться.',
      'Зберігання: JSON (старт) або SQLite (для статистики).'
    ]
  },
  {
    id: 'faq',
    title: 'FAQ / Support',
    description: 'Відповідає на типові питання',
    commands: ['/start', '/help', '/faq', '/contact', '/tips'],
    tips: [
      'Пари питання/відповідь тримай у Google Sheets — легко оновлювати.',
      'Додай швидкі кнопки “Написати менеджеру” та “Отримати знижку”.',
      'Використовуй короткі дружні тексти з емодзі.'
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
      'Налаштуй повідомлення менеджеру про нові замовлення.'
    ]
  },
  {
    id: 'booking',
    title: 'Booking',
    description: 'Запис на послуги',
    commands: ['/start', '/help', '/book', '/slots', '/cancel', '/contact'],
    tips: [
      'Зберігай дату, час, клієнта і статус бронювання.',
      'SQLite або Google Sheets — хороші варіанти для розкладу.',
      'Додай нагадування за 2 години до зустрічі.'
    ]
  },
  {
    id: 'custom',
    title: 'Custom',
    description: 'Свій сценарій',
    commands: ['/start', '/help'],
    tips: [
      'Почни з мінімуму: /start, /help та 2-3 власні команди.',
      'Поступово додавай модулі за прикладом цього гайда.',
      'JSON — хороший старт, SQLite дає більше можливостей.'
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
      { text: 'Попроси ШІ додати функції load/save для JSON.', prompt: 'Додай у проект функції load_data та save_data для файлу data/db.json. Функції мають створювати файл, якщо його немає.' },
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
      { text: 'Попроси ШІ створити таблицю tasks (id, name, status).', prompt: 'Додай у проект SQLite з таблицею tasks (id INTEGER PK, name TEXT, status TEXT) та CRUD-функціями.' },
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
      { text: 'Попроси ШІ підключити gspread до таблиці.', prompt: 'Підключи gspread до Google Sheets. Використай .env: GOOGLE_CREDENTIALS (JSON), SHEET_ID.' },
      { text: 'Додай функцію запису рядків (append row).' },
      { text: 'Тест: `/add` → новий рядок у Google Sheets.' }
    ]
  },
  {
    id: 'postgres',
    title: 'Postgres (Docker)',
    summary: 'Потужна база для командних проєктів.',
    steps: [
      { text: 'Встанови Docker Desktop.' },
      { text: 'Створи `docker-compose.yml` з Postgres.', prompt: 'Створи docker-compose.yml з Postgres (POSTGRES_PASSWORD=postgres, порт 5432) та сервісом для бота.' },
      { text: 'Додай psycopg2 та підключення до бота.', prompt: 'Підключи aiogram-бекап до Postgres: таблиця tasks (id SERIAL, name TEXT, status TEXT), CRUD-функції, виклик у хендлерах.' },
      { text: 'Інтегруй репозиторій у команди.' },
      { text: 'Тест: `/add` → запис у базі.' }
    ]
  }
];

const DESIGN_STEPS = [
  { title: 'Що таке дизайн', items: ['Кнопки, меню, тексти. Робимо просто та зрозуміло.'] },
  {
    title: 'Головне меню (Reply-кнопки)',
    items: [
      'Запитай: «Додай меню з кнопками: 📋 Завдання, 🧠 Поради, ⚙️ Налаштування».',
      'Встав код → збережи → у Telegram введи `/start`.'
    ]
  },
  {
    title: 'Inline-кнопки',
    items: [
      'Запитай: «Додай inline-кнопки на сторінці “Завдання”: [✅ Готово] [❌ Пропустити] [📊 Статистика]».',
      'Встав код → перевір у чаті.'
    ]
  },
  {
    title: 'Гарні тексти',
    items: [
      'Додай емодзі та короткі дружні фрази.',
      'Приклад:\n🌟 Твій прогрес сьогодні\n✅ Завдання виконано\n🔄 Повертайся завтра!'
    ]
  }
];

const STATS_STEPS = [
  {
    title: 'Команда /stats',
    items: [
      'Запитай: «Додай команду /stats. Показуй прогрес за сьогодні, тиждень, всього».',
      'Встав код → збережи → перевір у Telegram.'
    ]
  },
  {
    title: 'Красивий звіт',
    items: [
      'Запитай: «Зроби звіт із емодзі та відсотками».',
      'Приклад звіту:\n📊 Твій прогрес\n✅ За сьогодні: 3/5\n📅 За тиждень: 17/25\n🌟 Молодець!'
    ]
  },
  {
    title: 'Щоденні нагадування',
    items: [
      'Запитай: «Надсилай щоденний звіт о 20:00».',
      'Додай планувальник (apscheduler або asyncio).'
    ]
  }
];

const PAYMENT_INTRO = [
  'Зареєструйся у Stripe (stripe.com) або WayForPay (wayforpay.com).',
  'Додай у `.env` ключі: STRIPE_KEY / WAYFORPAY_KEY.',
  'API-ключ — секрет. Зберігай його лише у `.env`.'
];

const PAYMENT_METHODS = [
  {
    id: 'stripe',
    title: 'Stripe',
    description: 'Міжнародні картки (USD та інші валюти).',
    steps: [
      {
        text: 'Запитай: «Додай оплату Stripe на $5 і команду /buy. Після успіху — “Дякую за оплату!”».',
        prompt: 'Додай у бота оплату Stripe на $5: команда /buy, успішна оплата → повідомлення “Дякую за оплату!”.'
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
        text: 'Запитай: «Додай WayForPay на 100 грн для “Преміум-доступ”. Після оплати — “Дякую!”».',
        prompt: 'Додай WayForPay оплату на 100 грн для “Преміум-доступ”. Після успіху відправ “Дякую!”.'
      },
      { text: 'Тест: форма оплати відкривається і працює.' }
    ]
  }
];

const LAUNCH_STEPS = [
  {
    title: 'Створення бота у BotFather',
    items: [
      'Відкрий `@BotFather` → команда `/newbot`.',
      'Скопіюй токен і додай у `.env` як `TOKEN=...`.'
    ]
  },
  {
    title: 'Запуск',
    items: [
      'У терміналі (в папці проєкту) виконай:',
      '```bash\npython main.py\n```',
      'Якщо бачиш “Bot started” — все гаразд.'
    ]
  },
  {
    title: 'Перевір команди',
    items: [
      '`/start` — привітання є.',
      '`/help` — інструкція є.',
      'Кастомна команда (наприклад `/add`) — працює.'
    ]
  },
  {
    title: 'Резервна копія',
    items: [
      'Скопіюй папку у хмару або на GitHub.',
      'Перезапусти бота та переконайся, що все працює.'
    ]
  }
];

const GROWTH_STEPS = [
  {
    title: 'Додаткові модулі',
    items: ['🔁 автозбереження', '🌍 багатомовність (uk/en)', '🧩 адмін-панель']
  },
  {
    title: 'Фініш',
    items: [
      'Повідомлення: «Готово! Ти створив свого Telegram-бота.»',
      'Кнопки: 🔄 «Створити нового бота», 🚀 «Покращити поточного».'
    ]
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
  if (state.currentStep > 0) {
    state.currentStep -= 1;
    saveState();
    draw(false);
  }
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

draw(true);

function draw(rebuild) {
  if (rebuild) {
    rebuildSteps();
  }
  const step = steps[state.currentStep];
  if (!step) return;

  elements.section.textContent = step.section;
  elements.stepIndex.textContent = `Крок ${step.number}`;
  elements.stepTitle.textContent = step.title;
  elements.stepBody.innerHTML = '';
  step.render(elements.stepBody);

  elements.prev.disabled = state.currentStep === 0;
  elements.next.textContent = state.currentStep === steps.length - 1 ? 'Готово' : 'Далі ➡️';
  elements.footer.style.display = step.hideNav ? 'none' : '';

  const progress = ((state.currentStep + 1) / steps.length) * 100;
  elements.progressBar.style.width = `${progress}%`;
  elements.progressLabel.textContent = `${state.currentStep + 1} / ${steps.length}`;
}

function rebuildSteps() {
  const currentId = steps[state.currentStep]?.id ?? null;
  steps = buildSteps(state);
  if (!steps.length) return;
  if (currentId) {
    const idx = steps.findIndex((step) => step.id === currentId);
    if (idx >= 0) {
      state.currentStep = idx;
    } else {
      state.currentStep = Math.min(state.currentStep, steps.length - 1);
    }
  } else {
    state.currentStep = Math.min(state.currentStep, steps.length - 1);
  }
}

function buildSteps(currentState) {
  const result = [];

  // I. Старт
  result.push(createStep('start', 'I. Старт', 'Привітання', renderStartStep, { hideNav: true }));
  result.push(createStep('bot-type', 'I. Старт', 'Вибір типу бота', renderBotTypeStep));
  result.push(createStep('mode', 'I. Старт', 'Вибір режиму ШІ', renderModeStep));
  result.push(createStep('environment', 'I. Старт', 'Вибір середовища', renderEnvironmentStep));
  result.push(createStep('tools', 'I. Старт', 'Перевірка інструментів', renderToolsStep));

  // II. Підготовка
  result.push(createStep('folder', 'II. Підготовка проєкту', 'Створення папки', (container) =>
    renderInfo(container, ['Створи папку `mybot`.', 'Відкрий її у редакторі (VS Code або Cursor).'], 'Мета: мати чисте місце для файлів бота.')
  ));
  result.push(createStep('requirements', 'II. Підготовка проєкту', 'Створення requirements.txt', renderRequirementsStep));
  result.push(createStep('main-file', 'II. Підготовка проєкту', 'Створення main.py', (container) =>
    renderInfo(container, ['Створи файл `main.py` у корені.', 'Поки залиш порожнім — код додамо далі.'])
  ));
  result.push(createStep('env-file', 'II. Підготовка проєкту', 'Створення .env', renderEnvStep));
  result.push(createStep('dev-brief', 'II. Підготовка проєкту', 'DEV BRIEF', renderDevBriefStep));
  result.push(createStep('code-prompt', 'II. Підготовка проєкту', 'Промпт для коду', renderCodePromptStep));

  // III. Бекенд
  result.push(createStep('backend-choice', 'III. База даних', 'Вибір типу зберігання', renderBackendChoiceStep));
  result.push(createStep('backend-explain', 'III. База даних', 'Пояснення від панелі', (container) =>
    renderInfo(container, [
      'Без зберігання бот “забуває” все після перезапуску.',
      'Обери один варіант і доведи його до тесту.'
    ])
  ));
  result.push(createStep('backend-confirm', 'III. База даних', 'Підтвердження вибору', renderBackendConfirmStep));

  const chosenBackend = BACKEND_OPTIONS.find((option) => option.id === currentState.choices.backend);
  if (chosenBackend) {
    chosenBackend.steps.forEach((step, index) => {
      result.push(
        createStep(
          `backend-${chosenBackend.id}-${index}`,
          'III. База даних',
          step.text.split('.')[0],
          (container) => renderBackendStep(container, chosenBackend.title, step)
        )
      );
    });
  }

  // IV. Дизайн
  DESIGN_STEPS.forEach((item, index) => {
    result.push(
      createStep(`design-${index}`, 'IV. Дизайн', item.title, (container) => {
        if (item.items) renderListBlock(container, item.items);
      })
    );
  });

  // V. Статистика
  STATS_STEPS.forEach((item, index) => {
    result.push(createStep(`stats-${index}`, 'V. Статистика', item.title, (container) => renderListBlock(container, item.items)));
  });

  // VI. Оплати
  result.push(createStep('payments-choice', 'VI. Оплати', 'Вибір системи оплати', renderPaymentsChoiceStep));
  result.push(createStep('payments-prep', 'VI. Оплати', 'Підготовка ключів', renderPaymentPrepStep));

  const payment = PAYMENT_METHODS.find((option) => option.id === currentState.choices.payment);
  if (payment) {
    payment.steps.forEach((step, index) => {
      result.push(
        createStep(
          `payment-${payment.id}-${index}`,
          'VI. Оплати',
          step.text.split('.')[0],
          (container) => renderPaymentStep(container, payment.title, step)
        )
      );
    });
  }

  // VII. Запуск
  LAUNCH_STEPS.forEach((item, index) => {
    result.push(createStep(`launch-${index}`, 'VII. Запуск', item.title, (container) => renderListBlock(container, item.items)));
  });

  // VIII. Розвиток
  GROWTH_STEPS.forEach((item, index) => {
    result.push(createStep(`growth-${index}`, 'VIII. Розвиток', item.title, (container) => renderListBlock(container, item.items)));
  });

  // Поради
  result.push(createStep('advice', 'Поради за типами', 'Поради для обраного типу', renderAdviceStep));

  result.forEach((step, index) => {
    step.number = index + 1;
  });

  return result;
}

function createStep(id, section, title, renderer, extras = {}) {
  return { id, section, title, render: renderer, hideNav: !!extras.hideNav, number: 0 };
}

function renderStartStep(container) {
  const block = document.createElement('div');
  block.className = 'start-screen';

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
  const tableWrapper = document.createElement('div');
  tableWrapper.className = 'table-wrapper';
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
  tableWrapper.appendChild(table);
  container.appendChild(tableWrapper);

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
      draw(true);
    });
    cards.appendChild(card);
  });
  container.appendChild(cards);

  renderInfo(container, ['Команда — це слово з косою рискою, яке ти пишеш боту. Наприклад, `/start`.']);
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
      draw(true);
    });
    cards.appendChild(card);
  });
  container.appendChild(cards);

  renderInfo(container, ['Система підлаштує інструкції: “Скопіювати для ChatGPT” або “Відкрити в Codex”.']);
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
      draw(true);
    });
    cards.appendChild(card);
  });
  container.appendChild(cards);
}

function renderToolsStep(container) {
  const list = document.createElement('div');
  list.className = 'checklist';
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
    label.appendChild(input);
    const caption = document.createElement('span');
    caption.textContent = tool.label;
    label.appendChild(caption);
    row.appendChild(label);
    list.appendChild(row);
  });
  container.appendChild(list);
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
    `Використай ${state.choices.mode === 'codex' ? 'Codex/Cursor' : 'ChatGPT'} промпт, встав код у main.py і збережи.`
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
      draw(true);
    });
    cards.appendChild(card);
  });
  container.appendChild(cards);
}

function renderBackendConfirmStep(container) {
  const backend = BACKEND_OPTIONS.find((option) => option.id === state.choices.backend);
  if (!backend) {
    renderInfo(container, ['Спочатку обери варіант зберігання, щоб побачити кроки для нього.']);
    return;
  }
  renderInfo(container, [
    `Обрано: ${backend.title}. Нижче — покрокові дії.`,
    'Виконуй їх послідовно та тестуй після кожного.'
  ]);
}

function renderBackendStep(container, backendTitle, step) {
  renderInfo(container, [`${backendTitle}: ${step.text}`]);
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
      draw(true);
    });
    cards.appendChild(card);
  });

  const skip = document.createElement('div');
  skip.className = 'card';
  if (state.choices.payment === 'none') skip.classList.add('active');
  skip.innerHTML = `<h3>Пропустити оплати</h3><p>Можна додати платежі пізніше. Натисни, щоб перейти далі без них.</p>`;
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
    renderInfo(container, ['Оплати поки що пропущено. Можеш повернутися до цього кроку пізніше.']);
    return;
  }
  renderListBlock(container, PAYMENT_INTRO);
}

function renderPaymentStep(container, title, step) {
  renderInfo(container, [`${title}: ${step.text}`]);
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
    renderInfo(container, ['Щоб отримати поради, спочатку обери тип бота.']);
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
    case 'backend-choice':
      return state.choices.backend ? ok() : fail('Оберіть тип зберігання.');
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

function generateCodePrompt() {
  const type = BOT_TYPES.find((item) => item.id === state.choices.botType);
  const backend = BACKEND_OPTIONS.find((item) => item.id === state.choices.backend);

  return [
    'Ти — досвідчений Python-розробник. Побудуй Telegram-бота на aiogram v3.',
    `Тип бота: ${type ? `${type.title} — ${type.description}` : 'базовий асистент'}.`,
    `Команди: ${state.commands.length ? state.commands.join(', ') : '/start, /help'}.`,
    `Бекенд/зберігання: ${backend ? backend.title : 'JSON (просте зберігання у файлі)'}.`,
    'Файли проєкту:',
    '- requirements.txt (aiogram==3.*, python-dotenv)',
    '- main.py (головний файл)',
    '- .env (TOKEN та інші секрети)',
    'Опиши, як запустити бота (python main.py). Використовуй дружні повідомлення українською.'
  ].join('\n');
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    return Object.assign(structuredClone(defaultState), parsed);
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
