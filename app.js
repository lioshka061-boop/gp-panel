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

const PAYMENT_INTRO = [
  'Зареєструйся у Stripe (stripe.com) або WayForPay (wayforpay.com).',
  'Додай у `.env` ключі STRIPE_KEY або WAYFORPAY_KEY.',
  'API-ключ — секрет. Не ділись ним у репозиторії.'
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
    items: ['`/start` — привітання є.', '`/help` — інструкція є.', 'Кастомна команда (наприклад `/add`) — працює.']
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
    payment: 'none'
  },
  tools: TOOL_CHECKLIST.reduce((acc, tool) => {
    acc[tool.id] = false;
    return acc;
  }, { requirements: false, env: false }),
  commands: ['/start', '/help']
};

const AI_LINKS = {
  chatgpt: 'https://chat.openai.com/',
  codex: 'https://cursor.com/'
};

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

if (elements.docsBackdrop) {
  elements.docsBackdrop.addEventListener('click', (event) => {
    if (event.target === elements.docsBackdrop) {
      closeDocs();
    }
  });
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !elements.docsBackdrop?.hidden) {
    closeDocs();
    return;
  }
  if (event.key === 'Escape' && isMobileNav() && elements.navMenu?.classList.contains('open')) {
    closeNavMenu();
  }
});

if (elements.navToggle && elements.navMenu) {
  elements.navToggle.addEventListener('click', () => {
    toggleNavMenu();
  });
}

if (elements.navBackdrop) {
  elements.navBackdrop.addEventListener('click', () => {
    if (elements.navMenu?.classList.contains('open')) closeNavMenu();
  });
}

document.addEventListener('click', (event) => {
  if (!isMobileNav()) return;
  if (!elements.navMenu?.classList.contains('open')) return;
  if (event.target.closest('.top-nav')) return;
  closeNavMenu();
});

const mobileMedia = window.matchMedia('(max-width: 720px)');
const handleMobileChange = () => {
  if (!mobileMedia.matches) {
    closeNavMenu();
  }
  updateNavOnScroll();
};
if (typeof mobileMedia.addEventListener === 'function') {
  mobileMedia.addEventListener('change', handleMobileChange);
} else if (typeof mobileMedia.addListener === 'function') {
  mobileMedia.addListener(handleMobileChange);
}

window.addEventListener('scroll', updateNavOnScroll, { passive: true });
handleMobileChange();

draw(true);
updateNavOnScroll();

// --- Головні функції ---
function draw(rebuild) {
  if (rebuild) rebuildSteps();
  updateJumpControls();
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
  result.push(createStep('main-file', 'II. Підготовка проєкту', 'Створення main.py', (c) =>
    renderInfo(c, ['• Створи файл `main.py` у корені.', '• Поки залиш порожнім — код додамо далі.'])
  ));
  result.push(createStep('dev-brief', 'II. Підготовка проєкту', 'DEV BRIEF', renderDevBriefStep));
  result.push(createStep('code-prompt', 'II. Підготовка проєкту', 'Промпт для коду', renderCodePromptStep));
  result.push(createStep('requirements', 'II. Підготовка проєкту', 'Створення requirements.txt', renderRequirementsStep));
  result.push(createStep('env-file', 'II. Підготовка проєкту', 'Створення .env', renderEnvStep));

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
  DESIGN_STEPS.forEach((item, index) => {
    result.push(createStep(`design-${index}`, 'IV. Дизайн', item.title, (c) => renderInfo(c, item.items)));
  });

  // V. Статистика
  STATS_STEPS.forEach((item, index) => {
    result.push(createStep(`stats-${index}`, 'V. Статистика', item.title, (c) => renderInfo(c, item.items)));
  });

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
    result.push(createStep(`launch-${index}`, 'VII. Запуск', item.title, (c) => renderInfo(c, item.items)));
  });

  // VIII. Розвиток
  GROWTH_STEPS.forEach((item, index) => {
    result.push(createStep(`growth-${index}`, 'VIII. Розвиток', item.title, (c) => renderInfo(c, item.items)));
  });

  // Поради
  result.push(createStep('advice', 'Поради за типами', 'Поради для обраного типу', renderAdviceStep));

  result.forEach((step, index) => {
    step.number = index + 1;
  });

  return result;
}

function createStep(id, section, title, renderFn, extras = {}) {
  return { id, section, title, render: renderFn, hideNav: !!extras.hideNav, number: 0 };
}

function jumpToSelectedStep() {
  if (!elements.jumpSelect) return;
  const targetId = elements.jumpSelect.value;
  if (!targetId) {
    showToast('Оберіть крок у списку.');
    return;
  }
  const index = steps.findIndex((step) => step.id === targetId);
  if (index === -1) {
    showToast('Цей крок недоступний для поточного маршруту.');
    updateJumpControls();
    return;
  }
  state.currentStep = index;
  saveState();
  elements.jumpSelect.value = '';
  elements.jumpSelect.selectedIndex = 0;
  closeNavMenu();
  draw(false);
}

function openDocs() {
  if (!elements.docsBackdrop) return;
  closeNavMenu();
  elements.docsBackdrop.hidden = false;
  document.body.classList.add('modal-open');
}

function closeDocs() {
  if (!elements.docsBackdrop) return;
  elements.docsBackdrop.hidden = true;
  document.body.classList.remove('modal-open');
}

function toggleNavMenu() {
  if (!isMobileNav()) return;
  if (!elements.navMenu || !elements.navToggle) return;
  const willOpen = !elements.navMenu.classList.contains('open');
  if (willOpen) {
    openNavMenu();
  } else {
    closeNavMenu();
  }
}

function updateNavOnScroll() {
  if (!elements.topNav) return;
  if (!isMobileNav()) {
    elements.topNav.classList.remove('scrolled');
    return;
  }
  if (elements.navMenu?.classList.contains('open')) {
    elements.topNav.classList.remove('scrolled');
    return;
  }
  const shouldBeTransparent = window.scrollY > 28;
  elements.topNav.classList.toggle('scrolled', shouldBeTransparent);
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
  return mobileMedia.matches;
}

// --- Рендери кроків ---
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
      if (mode.id !== 'codex') state.tools.copilot = false;
      saveState();
      draw(true);
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
      saveState();
      draw(true);
    });
    cards.appendChild(card);
  });
  container.appendChild(cards);
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

function renderRequirementsStep(container) {
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
      body: 'Переконайся, що файл поруч із main.py. Команда `pip install -r requirements.txt` встановить залежності.'
    }));

    container.appendChild(carousel);
  }
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

function renderAdviceStep(container) {
  const type = BOT_TYPES.find((item) => item.id === state.choices.botType);
  if (!type) {
    renderInfo(container, ['• Щоб отримати поради, спочатку обери тип бота.']);
    return;
  }
  renderInfo(container, [`${type.title} — ключові рекомендації:`]);
  renderInfo(container, type.tips.map((tip) => `• ${tip}`));
}

// --- Допоміжні рендер-утиліти ---
function renderInfo(container, lines, footer) {
  if (lines?.length) {
    const block = document.createElement('div');
    block.className = 'info-block';

    lines.forEach((line) => {
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
    note.textContent = footer;
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
    `Бекенд/зберігання: ${backend ? backend.title : 'JSON (просте збереження у файлі)'}.`,
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
    const merged = Object.assign(structuredClone(defaultState), parsed);
    merged.tools = Object.assign({}, defaultState.tools, merged.tools);
    if (merged.tools.requirements === undefined) merged.tools.requirements = false;
    if (merged.tools.env === undefined) merged.tools.env = false;
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
