const API_URL = window.location.hostname.includes('localhost')
  ? 'http://localhost:4000'
  : 'https://api.genieprompts.net';

async function api(path, options = {}) {
  const res = await fetch(API_URL + path, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    console.error('API error', res.status, data);
    throw new Error(data?.message || 'API error');
  }
  return data;
}
async function handleLoginSubmit(e) {
  e.preventDefault();
  const email = document.querySelector('#login-email').value.trim();
  const password = document.querySelector('#login-password').value.trim();

  try {
    const result = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    console.log('Logged in', result.user);
    // зберігаємо користувача та показуємо панель
    window.currentUser = result.user;
    resetBotAccessCache();
    showAppShell();

    // підтягуємо дані для панелі
    await loadBots();
    await loadEnvironments();
    promptEnvironmentSelection(true);
    if (isAdmin()) {
      await loadAdminData();
    }
  } catch (err) {
    alert('Помилка входу');
  }
}
function setupAuthTabs() {
  const tabs = document.querySelectorAll(".auth-tab");
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  if (!tabs.length || !loginForm || !registerForm) return;

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const mode = tab.dataset.mode || "login";
      tabs.forEach((btn) =>
        btn.classList.toggle("auth-tab--active", btn === tab)
      );
      loginForm.hidden = mode !== "login";
      registerForm.hidden = mode !== "register";
    });
  });
}

function showAppShell() {
  const loginScreen = document.getElementById("login-screen");
  const appShell = document.getElementById("app");
  const topbar = document.getElementById("topbar");
  if (loginScreen) loginScreen.hidden = true;
  if (appShell) appShell.hidden = false;
  if (topbar) topbar.hidden = false;
  updateAdminButtons();
  if (!isAdmin()) {
    toggleAdminPanel(false);
  }
}

function showLoginScreen() {
  const loginScreen = document.getElementById("login-screen");
  const appShell = document.getElementById("app");
  const topbar = document.getElementById("topbar");
  if (loginScreen) loginScreen.hidden = false;
  if (appShell) appShell.hidden = true;
  if (topbar) topbar.hidden = true;
  toggleAdminPanel(false);
  updateAdminButtons();
}

async function initApp() {
  try {
    const me = await api('/auth/me', { method: 'GET' });
    if (me?.user) {
      window.currentUser = me.user;
    } else if (me?.id) {
      window.currentUser = me;
    }
    if (!window.currentUser) {
      showLoginScreen();
      return;
    }
    resetBotAccessCache();
    showAppShell();
    await Promise.all([loadBots(), loadEnvironments()]);
    promptEnvironmentSelection(true);
    if (isAdmin()) {
      await loadAdminData();
    }
  } catch (error) {
    window.currentUser = null;
    showLoginScreen();
  }
}

document
  .querySelector('#login-form')
  .addEventListener('submit', handleLoginSubmit);
const registerFormEl = document.querySelector('#register-form');
if (registerFormEl) {
  registerFormEl.addEventListener('submit', handleRegisterSubmit);
}

async function handleRegisterSubmit(e) {
  e.preventDefault();
  const firstName = document.querySelector('#reg-first-name')?.value.trim();
  const lastName = document.querySelector('#reg-last-name')?.value.trim();
  const patronymic = document.querySelector('#reg-patronymic')?.value.trim();
  const phoneCode = document.querySelector('#reg-phone-code')?.value || '';
  const phoneDigits = (document
    .querySelector('#reg-phone-number')
    ?.value || ''
  ).replace(/\D/g, '');
  const email = document.querySelector('#reg-email')?.value.trim();
  const password = document.querySelector('#reg-password')?.value.trim();

  if (!firstName || !lastName || !phoneDigits || !email || !password) {
    alert('Заповніть усі обовʼязкові поля.');
    return;
  }
  if (password.length < 8) {
    alert('Пароль має містити щонайменше 8 символів.');
    return;
  }
  const full_name = [lastName, firstName, patronymic].filter(Boolean).join(' ');
  const phone = `${phoneCode}${phoneDigits}`;
  try {
    const result = await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        full_name,
        phone,
        email,
        password,
      }),
    });
    window.currentUser = result.user;
    resetBotAccessCache();
    showAppShell();
    await loadBots();
    await loadEnvironments();
    promptEnvironmentSelection(true);
    if (isAdmin()) {
      await loadAdminData();
    }
  } catch (error) {
    console.error('Register error', error);
    alert('Помилка реєстрації');
  }
}
let backendBots = [];
let mergedBots = [];

async function loadBots() {
  const botsResponse = await api('/bots', { method: 'GET' });
  const botsArray = Array.isArray(botsResponse?.bots)
    ? botsResponse.bots
    : Array.isArray(botsResponse)
    ? botsResponse
    : [];
  backendBots = botsArray;
  mergedBots = mergeBotMetadata();
  const activeEnv = getActiveEnvironmentMeta();
  if (activeEnv && syncActiveEnvironmentState(activeEnv)) {
    saveState();
  }
  draw(true);
}

function mergeBotMetadata() {
  if (!backendBots.length) {
    return BOT_TYPES.map((type) => ({
      id: type.id,
      title: type.title,
      description: type.description,
      commands: type.commands,
      backendId: null,
      price: null,
      currency: '',
      isFree: false,
    }));
  }
  return BOT_TYPES.map((type) => {
    const backendCode = BOT_BACKEND_CODES[type.id] || type.id;
    const backend = backendBots.find((bot) => bot.code === backendCode);
    return {
      id: type.id,
      title: type.title,
      description: type.description,
      commands: type.commands,
      backendId: backend?.id ?? null,
      price: backend?.price ?? null,
      currency: backend?.currency ?? '',
      isFree: backend?.is_free ?? backend?.price === 0,
    };
  });
}
async function handlePay(botId) {
  const bot =
    mergedBots.find((item) => item.backendId === botId) ||
    mergedBots.find((item) => item.id === botId);
  if (!bot?.backendId) {
    showToast("Бот поки недоступний для оплати.");
    return;
  }
  const activeEnv = getActiveEnvironmentMeta();
  if (
    activeEnv?.bot_id &&
    activeEnv.bot_id !== bot.backendId &&
    !isAdmin()
  ) {
    showToast("Це середовище вже привʼязане до іншого бота. Створи нове.");
    return;
  }
  const res = await api('/payments/create', {
    method: 'POST',
    body: JSON.stringify({ botId })
  });

  if (res.status === 'pending' && res.redirectUrl) {
    window.location.href = res.redirectUrl;
    return;
  }

  const successStatuses = ['free', 'test_mode'];
  const isDevPending = res.status === 'pending' && !res.redirectUrl;
  if (isDevPending || successStatuses.includes(res.status)) {
    if (bot.id) {
      applyBotTypeSelection(bot.id, { preserveCustomCommands: true });
      if (state.currentStep < 2) {
        state.currentStep = 2;
      }
      saveState();
      scheduleProgressSync(true);
    }
    botAccessCache.set(bot.backendId, true);
    if (envState.activeId && bot.backendId) {
      try {
        await patchEnvironment(envState.activeId, {
          bot_id: bot.backendId,
          current_step: Math.max(state.currentStep + 1, 3),
        });
      } catch (error) {
        console.error('Failed to sync environment bot', error);
      }
    }
    await loadBots();
    await loadEnvironments();
    draw(true);
    showToast('Оплата створена. Можна починати.');
    return;
  }

  alert('Невідома відповідь платіжної системи. Спробуй ще раз.');
}

const STORAGE_KEY = "ztb_v4_state";
const ENV_STATE_PREFIX = "gp_env_state_";
const ACTIVE_ENV_KEY = "gp_active_env_id";

const envState = {
  items: [],
  activeId: null,
};
let envSelectionShown = false;
const storedActiveEnvRaw = localStorage.getItem(ACTIVE_ENV_KEY);
if (storedActiveEnvRaw) {
  const parsed = Number(storedActiveEnvRaw);
  if (!Number.isNaN(parsed)) {
    envState.activeId = parsed;
  }
}

const adminState = {
  overview: null,
  users: [],
  selectedUserId: null,
  userAnalytics: null,
  bots: [],
  settings: {},
  userPurchases: [],
  supportTickets: [],
};

const botAccessCache = new Map();
let progressSyncTimer = null;
let progressSyncInFlight = false;
let pendingProgressSync = false;
const PROGRESS_SYNC_DELAY = 500;
const stepOverrides = loadStepOverrides();
const STEP_OVERRIDES_KEY = "gp_step_overrides_v1";
const SUPPORT_TICKETS_KEY = "gp_support_tickets";

function loadSupportTickets() {
  try {
    const raw = localStorage.getItem(SUPPORT_TICKETS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    adminState.supportTickets = Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Failed to load support tickets", error);
    adminState.supportTickets = [];
  }
}

function saveSupportTickets() {
  try {
    localStorage.setItem(
      SUPPORT_TICKETS_KEY,
      JSON.stringify(adminState.supportTickets || [])
    );
  } catch (error) {
    console.warn("Failed to save support tickets", error);
  }
}

function addSupportTicket(ticket) {
  const user = window.currentUser || {};
  const base = {
    id: Date.now(),
    createdAt: new Date().toISOString(),
    status: "open",
    user: {
      id: user.id || null,
      name: user.full_name || user.name || "",
      email: user.email || "",
      phone: user.phone || "",
    },
    ...ticket,
  };
  adminState.supportTickets = [base, ...(adminState.supportTickets || [])].slice(
    0,
    200
  );
  saveSupportTickets();
  if (isAdmin()) renderAdminPanel();
  return base.id;
}

function updateSupportTicket(ticketId, patch) {
  if (!ticketId) return;
  adminState.supportTickets = (adminState.supportTickets || []).map((item) =>
    item.id === ticketId ? { ...item, ...patch } : item
  );
  saveSupportTickets();
  if (isAdmin()) renderAdminPanel();
}

function isAdmin() {
  return window.currentUser?.role === "admin";
}

function getActiveEnvironmentMeta() {
  if (!envState.activeId) return null;
  return envState.items.find((env) => env.id === envState.activeId) || null;
}

function getBotMetaByType(typeId) {
  if (!typeId) return null;
  return mergedBots.find((bot) => bot.id === typeId) || null;
}

function getBackendIdByType(typeId) {
  const bot = getBotMetaByType(typeId);
  return bot?.backendId ?? null;
}

function resetBotAccessCache() {
  botAccessCache.clear();
}

function getOverrideKey(currentState = state) {
  return [
    currentState.choices.botType || "none",
    currentState.choices.mode || "chatgpt",
    currentState.choices.environment || "local",
  ].join("|");
}

function loadStepOverrides() {
  try {
    const raw = localStorage.getItem(STEP_OVERRIDES_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.warn("Failed to load step overrides", error);
    return {};
  }
}

function saveStepOverrides() {
  try {
    localStorage.setItem(STEP_OVERRIDES_KEY, JSON.stringify(stepOverrides));
  } catch (error) {
    console.warn("Failed to save step overrides", error);
  }
}

function applyStepOverrides(steps, currentState = state) {
  const key = getOverrideKey(currentState);
  const override = stepOverrides[key];
  if (!override) return steps;
  let result = steps;
  if (Array.isArray(override.order) && override.order.length) {
    const map = new Map(steps.map((s) => [s.id, s]));
    result = override.order
      .map((id) => map.get(id))
      .filter(Boolean)
      .concat(steps.filter((s) => !override.order.includes(s.id)));
  }
  if (override.titles) {
    result = result.map((step) => {
      if (override.titles[step.id]) {
        return { ...step, title: override.titles[step.id] };
      }
      return step;
    });
  }
  return result;
}

// --- Довідкові дані ---
const RAW_BOT_TYPES = [
  {
    id: "crm",
    title: "CRM",
    description: "Веде клієнтів і завдання",
    commands: [
      "/start",
      "/help",
      "/add",
      "/clients",
      "/tasks",
      "/done",
      "/stats",
    ],
    tips: [
      "Зберігай клієнтів та завдання з полями: ім’я, статус, наступний крок.",
      "Комбінація команд: /add → /clients → /tasks → /done.",
      "Рекомендований бекенд: SQLite або Postgres.",
    ],
    ui: {
      reply: {
        variants: [
          {
            id: "default",
            title: "Повне меню CRM",
            description: "Доступ до бази клієнтів, завдань і аналітики.",
            buttons: [
              {
                text: "📋 Клієнти",
                purpose: "показати список активних клієнтів",
              },
              { text: "➕ Новий клієнт", purpose: "створити нову заявку" },
              {
                text: "✅ Завдання",
                purpose: "перейдіть до актуальних завдань",
              },
              {
                text: "📈 Статистика",
                purpose: "показати короткий звіт по продажах",
              },
            ],
          },
          {
            id: "minimal",
            title: "Мінімальне меню",
            description: "Для старту з коротким переліком дій.",
            buttons: [
              { text: "📋 Клієнти", purpose: "активні клієнти" },
              { text: "📝 Завдання", purpose: "список завдань" },
              {
                text: "➕ Додати",
                purpose: "швидко додати клієнта або завдання",
              },
            ],
            notes: "Підійде, якщо команда працює лише з базовими сценаріями.",
          },
        ],
        discoveryHint:
          "Сфокусуйся на кнопках для продажів: клієнти, завдання, аналітика.",
      },
      inline: {
        variants: [
          {
            id: "default",
            title: "Менеджмент ліда",
            description: "Кнопки в картці клієнта або завдання.",
            buttons: [
              {
                text: "✅ Взяти в роботу",
                purpose: "перевести лід у роботу",
                callback: "lead_take",
              },
              {
                text: "➕ Коментар",
                purpose: "додати нотатку до клієнта",
                callback: "lead_add_note",
              },
              {
                text: "📅 Нагадати",
                purpose: "створити нагадування",
                callback: "lead_remind",
              },
              {
                text: "❌ Закрити",
                purpose: "позначити лід як закритий",
                callback: "lead_close",
              },
            ],
          },
          {
            id: "minimal",
            title: "Керування завданням",
            description: "Стисла панель для оновлення статусу.",
            buttons: [
              {
                text: "✅ Готово",
                purpose: "позначити завдання виконаним",
                callback: "task_done",
              },
              {
                text: "↩️ Назад",
                purpose: "повернутися до переліку завдань",
                callback: "task_back",
              },
            ],
          },
        ],
        discoveryHint:
          "Надішли кнопки для роботи з лідами: брати в роботу, залишати коментар, нагадування.",
      },
    },
  },
  {
    id: "task",
    title: "Task Manager",
    description: "Список справ для команди",
    commands: ["/start", "/help", "/add", "/list", "/done", "/skip", "/stats"],
    tips: [
      "Фіксуй виконавця, дедлайн та статус.",
      "Стартуй із JSON, переходь на SQLite, коли команда виросте.",
      "Додай нагадування про дедлайни.",
    ],
    ui: {
      reply: {
        variants: [
          {
            id: "default",
            title: "Командне меню",
            description: "Повний доступ до завдань і плану на день.",
            buttons: [
              { text: "🆕 Додати", purpose: "створити нове завдання" },
              { text: "📋 Список", purpose: "показати всі активні завдання" },
              {
                text: "🔥 Сьогодні",
                purpose: "переглянути задачі на сьогодні",
              },
              {
                text: "⚙️ Налаштування",
                purpose: "увімкнути нагадування та ролі",
              },
            ],
          },
          {
            id: "minimal",
            title: "Мінімалістичне меню",
            description: "Коли потрібні лише базові дії.",
            buttons: [
              { text: "🆕 Додати", purpose: "нове завдання" },
              { text: "📋 Завдання", purpose: "актуальний список" },
              { text: "✅ Готові", purpose: "переглянути виконані задачі" },
            ],
          },
        ],
        discoveryHint:
          "Підкажи кнопки для створення, перегляду та завершення завдань.",
      },
      inline: {
        variants: [
          {
            id: "default",
            title: "Керування завданням",
            description: "Для картки конкретного завдання.",
            buttons: [
              {
                text: "✅ Готово",
                purpose: "закрити завдання",
                callback: "task_done",
              },
              {
                text: "❌ Пропустити",
                purpose: "позначити як пропущене",
                callback: "task_skip",
              },
              {
                text: "⏰ Відкласти",
                purpose: "перенести дедлайн",
                callback: "task_delay",
              },
              {
                text: "📎 Деталі",
                purpose: "показати розширену інформацію",
                callback: "task_details",
              },
            ],
          },
          {
            id: "minimal",
            title: "Швидкі дії",
            description: "Базові кнопки для оновлення статусу.",
            buttons: [
              {
                text: "✅ Закрити",
                purpose: "завершити завдання",
                callback: "task_done",
              },
              {
                text: "🔁 Повернути",
                purpose: "повернути в роботу",
                callback: "task_return",
              },
            ],
          },
        ],
        discoveryHint:
          "Запропонуй inline-кнопки для зміни статусу завдання та перегляду деталей.",
      },
    },
  },
  {
    id: "habit",
    title: "Habit Tracker",
    description: "Щоденні звички й нагадування",
    commands: [
      "/start",
      "/help",
      "/add",
      "/habits",
      "/done",
      "/streak",
      "/plan",
      "/stats",
    ],
    tips: [
      "Записуй назву звички, час доби та прогрес.",
      "Нагадування — обов’язкові.",
      "Зберігання: JSON (старт) або SQLite (звітність).",
    ],
    ui: {
      reply: {
        variants: [
          {
            id: "default",
            title: "Трекер прогресу",
            description: "Фокус на щоденних звичках і плані.",
            buttons: [
              {
                text: "🔥 Сьогодні",
                purpose: "звички, заплановані на сьогодні",
              },
              { text: "➕ Нова звичка", purpose: "додати нову звичку" },
              {
                text: "📈 Прогрес",
                purpose: "переглянути статистику по звичках",
              },
              { text: "⚙️ План", purpose: "налаштувати нагадування та графік" },
            ],
          },
          {
            id: "wellness",
            title: "Велнес-режим",
            description: "Для ботів з порадами та мотивацією.",
            buttons: [
              { text: "🌅 Ранок", purpose: "поради на ранок і звички" },
              { text: "🌙 Вечір", purpose: "вечірній чек-ін" },
              { text: "📊 Статистика", purpose: "дні підряд та прогрес" },
            ],
            notes: "Підійде, якщо бот працює за сценаріями ранку/вечора.",
          },
        ],
        discoveryHint:
          "Запропонуй кнопки для трекінгу звичок, статистики та плану.",
      },
      inline: {
        variants: [
          {
            id: "default",
            title: "Оновлення звички",
            description: "Кнопки в повідомленні зі звичкою.",
            buttons: [
              {
                text: "✅ Виконав",
                purpose: "позначити звичку виконаною",
                callback: "habit_done",
              },
              {
                text: "🔁 Відкласти",
                purpose: "перенести на пізніше",
                callback: "habit_skip",
              },
              {
                text: "📊 Деталі",
                purpose: "показати історію виконань",
                callback: "habit_stats",
              },
            ],
          },
          {
            id: "streak",
            title: "Робота з прогресом",
            description: "Для повідомлень зі статистикою.",
            buttons: [
              {
                text: "📅 Календар",
                purpose: "відкрити календар виконань",
                callback: "habit_calendar",
              },
              {
                text: "🔔 Нагадування",
                purpose: "налаштувати час нагадувань",
                callback: "habit_reminder",
              },
            ],
          },
        ],
        discoveryHint:
          "Потрібні кнопки, щоб відмічати звичку, відкладати та дивитись прогрес.",
      },
    },
  },
  {
    id: "faq",
    title: "FAQ / Support",
    description: "Відповідає на типові питання",
    commands: ["/start", "/help", "/faq", "/contact", "/tips"],
    tips: [
      "Контент тримай у Google Sheets — легко оновлювати.",
      "Додай кнопки “Написати менеджеру”, “Отримати знижку”.",
      "Пиши коротко, дружньо, з емодзі.",
    ],
    ui: {
      reply: {
        variants: [
          {
            id: "default",
            title: "Підтримка клієнтів",
            description: "Швидкий доступ до основних розділів.",
            buttons: [
              { text: "ℹ️ FAQ", purpose: "переглянути популярні питання" },
              {
                text: "📩 Залишити запит",
                purpose: "залишити заявку менеджеру",
              },
              { text: "☎️ Контакти", purpose: "отримати контакти підтримки" },
              { text: "🎁 Акції", purpose: "актуальні пропозиції" },
            ],
          },
          {
            id: "support",
            title: "Фокус на підтримці",
            description: "Коли головне — зв’язок з менеджером.",
            buttons: [
              { text: "🆘 Підтримка", purpose: "написати менеджеру" },
              { text: "📄 Інструкції", purpose: "короткі гайди" },
              { text: "💬 Зв’язок", purpose: "месенджери/телефон" },
            ],
          },
        ],
        discoveryHint:
          "Запропонуй меню для FAQ-бота: часті питання, заявка на підтримку, контакти.",
      },
      inline: {
        variants: [
          {
            id: "default",
            title: "Категорії питань",
            description: "Для повідомлень з переліком тем.",
            buttons: [
              {
                text: "🧾 Доставка",
                purpose: "роз’яснення умов доставки",
                callback: "faq_delivery",
              },
              {
                text: "💳 Оплата",
                purpose: "інформація про оплату",
                callback: "faq_payment",
              },
              {
                text: "⌚️ Графік",
                purpose: "години роботи",
                callback: "faq_schedule",
              },
              {
                text: "👤 Менеджер",
                purpose: "звʼязок із менеджером",
                callback: "faq_manager",
              },
            ],
          },
          {
            id: "links",
            title: "Швидкі посилання",
            description: "Для повідомлень з ресурсами.",
            buttons: [
              {
                text: "📘 Інструкція",
                purpose: "посилання на довідник",
                url: "https://example.com/manual",
              },
              {
                text: "🎟 Знижка",
                purpose: "отримати промокод",
                callback: "faq_discount",
              },
              {
                text: "🔙 Назад",
                purpose: "повернутися до списку тем",
                callback: "faq_back",
              },
            ],
            notes: "Замініть URL на власний ресурс.",
          },
        ],
        discoveryHint:
          "Потрібні inline-кнопки для різних категорій FAQ або переходу до менеджера.",
      },
    },
  },
  {
    id: "shop",
    title: "Shop",
    description: "Міні-магазин у Telegram",
    commands: [
      "/start",
      "/help",
      "/catalog",
      "/buy",
      "/cart",
      "/pay",
      "/support",
    ],
    tips: [
      "Каталог = назва, опис, ціна, наявність.",
      "Бекенд: SQLite + Stripe/WayForPay.",
      "Повідомляй менеджера про нові замовлення.",
    ],
    ui: {
      reply: {
        variants: [
          {
            id: "default",
            title: "Повний магазин",
            description: "Базові розділи онлайн-магазину.",
            buttons: [
              { text: "🛍 Каталог", purpose: "переглянути товари" },
              { text: "🛒 Кошик", purpose: "відкрити кошик" },
              { text: "📦 Замовлення", purpose: "історія та статус замовлень" },
              { text: "💬 Підтримка", purpose: "зв’язок з менеджером" },
            ],
          },
          {
            id: "minimal",
            title: "Швидкий старт",
            description: "Для MVP з двома діями.",
            buttons: [
              { text: "🛍 Каталог", purpose: "переглянути доступні товари" },
              { text: "🛒 Кошик", purpose: "перейти до кошика" },
              { text: "📞 Контакт", purpose: "зв’язатися з продавцем" },
            ],
          },
        ],
        discoveryHint:
          "Запропонуй меню для магазину: каталог, кошик, підтримка.",
      },
      inline: {
        variants: [
          {
            id: "default",
            title: "Картка товару",
            description: "Кнопки під повідомленням з товаром.",
            buttons: [
              {
                text: "➕ У кошик",
                purpose: "додати товар у кошик",
                callback: "product_add",
              },
              {
                text: "💳 Купити",
                purpose: "оформити миттєву покупку",
                callback: "product_buy",
              },
              {
                text: "ℹ️ Деталі",
                purpose: "показати опис та характеристики",
                callback: "product_details",
              },
              {
                text: "🔙 Назад",
                purpose: "повернутися до каталогу",
                callback: "product_back",
              },
            ],
          },
          {
            id: "upsell",
            title: "Upsell-пропозиції",
            description: "Додаткові товари чи бонуси.",
            buttons: [
              {
                text: "🎁 Бонус",
                purpose: "додати супутній товар",
                callback: "product_bonus",
              },
              {
                text: "⭐️ Відгуки",
                purpose: "показати відгуки",
                callback: "product_reviews",
              },
              {
                text: "📦 Доставка",
                purpose: "інформація про доставку",
                callback: "product_shipping",
              },
            ],
          },
        ],
        discoveryHint:
          "Потрібні inline-кнопки: додати в кошик, купити, показати деталі.",
      },
    },
  },
  {
    id: "booking",
    title: "Booking",
    description: "Запис на послуги",
    commands: ["/start", "/help", "/book", "/slots", "/cancel", "/contact"],
    tips: [
      "Фіксуй дату, час, клієнта, статус.",
      "SQLite або Google Sheets — чудовий вибір.",
      "Налаштуй нагадування за 2 години до зустрічі.",
    ],
    ui: {
      reply: {
        variants: [
          {
            id: "default",
            title: "Запис на послуги",
            description: "Кнопки для клієнтів і адміністратора.",
            buttons: [
              { text: "📅 Записатися", purpose: "почати процес бронювання" },
              { text: "🕒 Розклад", purpose: "показати доступні слоти" },
              { text: "📋 Мої броні", purpose: "переглянути поточні записи" },
              { text: "☎️ Контакти", purpose: "зв’язатися з адміністратором" },
            ],
          },
          {
            id: "services",
            title: "Меню послуг",
            description: "Підходить, якщо є декілька різних послуг.",
            buttons: [
              { text: "💇‍♀️ Послуги", purpose: "перелік доступних послуг" },
              { text: "📆 Обрати час", purpose: "перейти до розкладу" },
              { text: "📞 Адміністратор", purpose: "швидкий зв’язок" },
            ],
          },
        ],
        discoveryHint:
          "Потрібні кнопки для запису, перегляду розкладу та зв’язку.",
      },
      inline: {
        variants: [
          {
            id: "default",
            title: "Керування бронюванням",
            description: "Під повідомленням з конкретною бронню.",
            buttons: [
              {
                text: "✅ Підтвердити",
                purpose: "підтвердити вибране вікно",
                callback: "booking_confirm",
              },
              {
                text: "🔄 Інший час",
                purpose: "запросити інший слот",
                callback: "booking_reschedule",
              },
              {
                text: "❌ Скасувати",
                purpose: "скасувати бронювання",
                callback: "booking_cancel",
              },
              {
                text: "💬 Менеджер",
                purpose: "зв’язок зі спеціалістом",
                callback: "booking_support",
              },
            ],
          },
          {
            id: "slots",
            title: "Вибір слоту",
            description: "Для повідомлень зі списком часових слотів.",
            buttons: [
              {
                text: "🕒 10:00",
                purpose: "забронювати час 10:00",
                callback: "slot_1000",
              },
              {
                text: "🕒 12:00",
                purpose: "забронювати час 12:00",
                callback: "slot_1200",
              },
              {
                text: "🕒 14:00",
                purpose: "забронювати час 14:00",
                callback: "slot_1400",
              },
              {
                text: "🔙 Назад",
                purpose: "повернутися до переліку дат",
                callback: "slot_back",
              },
            ],
            notes: "Замініть часи на реальні доступні інтервали.",
          },
        ],
        discoveryHint:
          "Запропонуй inline-кнопки для підтвердження запису, вибору іншого часу та скасування.",
      },
    },
  },
  {
    id: "custom",
    title: "Custom",
    description: "Свій сценарій",
    commands: ["/start", "/help"],
    tips: [
      "Почни з мінімуму: /start, /help та 2-3 ключові команди.",
      "Розбивай фічі на модулі за прикладом цього гайда.",
      "JSON — для старту, SQLite — для масштабу.",
    ],
  },
];

const BOT_TYPES = (() => {
  const order = ["task", "crm", "habit", "faq", "shop", "booking", "custom"];
  const map = new Map(RAW_BOT_TYPES.map((item) => [item.id, item]));
  return order.map((id) => map.get(id)).filter(Boolean);
})();

const BOT_BACKEND_CODES = {
  crm: "crm_bot",
  task: "task_manager",
  habit: "habit_bot",
  faq: "faq_bot",
  shop: "shop_bot",
  booking: "booking_bot",
  custom: "custom_bot",
};

const BOT_STORAGE_RECOMMENDATIONS = {
  task: {
    storage: "sqlite",
    reason: "Трек задач потребує фільтрів та сортування без складного деплою.",
    modules: { autosave: true },
  },
  crm: {
    storage: "postgres",
    reason: "CRM збирає багато заявок, потрібні надійні транзакції й фільтри.",
    modules: { adminPanel: true, autosave: true },
  },
  habit: {
    storage: "sqlite",
    reason: "Звички — щоденні записи, SQLite достатньо для персонального трекера.",
    modules: { autosave: true },
  },
  faq: {
    storage: "gsheets",
    reason: "Контент зручно оновлювати у таблиці без оновлення коду.",
    modules: {},
  },
  shop: {
    storage: "postgres",
    reason: "Магазин із оплатами та кошиком краще тримати у надійному Postgres.",
    modules: { adminPanel: true, autosave: true },
  },
  booking: {
    storage: "postgres",
    reason: "Бронювання часу/слотів потребує транзакцій та унікальності слотів.",
    modules: { adminPanel: true },
  },
};

function resolveTypeIdByBackendBotId(backendBotId) {
  if (!backendBotId || !backendBots.length) return null;
  const backend = backendBots.find((bot) => bot.id === backendBotId);
  if (!backend) return null;
  const entry = Object.entries(BOT_BACKEND_CODES).find(
    ([, code]) => code === backend.code
  );
  return entry ? entry[0] : backend.code;
}

const MODE_OPTIONS = [
  {
    id: "chatgpt",
    title: "ChatGPT-only",
    description: "Безкоштовно, але код переносиш вручну.",
  },
  {
    id: "codex",
    title: "ChatGPT + Codex",
    description: "Потрібна підписка. Швидше та чистіше.",
  },
];

const ENVIRONMENTS = [
  {
    id: "local",
    title: "💻 Local",
    description: "Працюєш на власному комп’ютері. Потрібно встановити Python.",
  },
  {
    id: "codespaces",
    title: "☁️ Codespaces",
    description: "Все у браузері через GitHub. Python встановлювати не треба.",
  },
];

const ENTRY_FILE_OPTIONS = [
  { id: "main.py", label: "main.py" },
  { id: "app.py", label: "app.py" },
];

const TOOL_CHECKLIST = [
  { id: "python", label: "Python 3.10+ встановлено" },
  { id: "editor", label: "Редактор відкривається (VS Code)" },
  { id: "github", label: "Є обліковий запис GitHub" },
  {
    id: "Codex",
    label: "Codex увімкнений",
    optional: true,
  },
];

const CODESPACES_TOOL_CHECKLIST = [
  { id: "github", label: "Увійшов / створив GitHub акаунт" },
  {
    id: "codespace",
    label: "Створив Codespace і відкрив репозиторій у браузері",
  },
  {
    id: "browser",
    label: "Відкрив термінал у Codespaces та запустив тестову команду",
  },
  {
    id: "Codex",
    label: "Codex увімкнений",
    optional: true,
  },
];

const BACKEND_OPTIONS = [
  {
    id: "json",
    title: "JSON файл",
    summary: "Найпростіше зберігання у файлі.",
    steps: [
      { text: "Створи папку `data/` і файл `db.json`." },
      {
        text: "Попроси ШІ додати функції читання/запису JSON.",
        prompt:
          "Додай у проект функції load_data та save_data для файлу data/db.json. Якщо файлу немає — створюй його автоматично.",
      },
      { text: "Підключи функції у хендлері `/add`." },
      { text: "Тест: `/add` → запис з’явився у `db.json`." },
    ],
  },
  {
    id: "sqlite",
    title: "SQLite",
    summary: "База у файлі. Ідеальна для невеликих проєктів.",
    steps: [
      { text: "Створи файл `db.sqlite3`." },
      {
        text: "Попроси ШІ створити таблицю tasks (id, name, status).",
        prompt:
          "Додай SQLite з таблицею tasks (id INTEGER PK, name TEXT, status TEXT) та CRUD-функціями.",
      },
      { text: "Підключи репозиторій до команд /add, /list, /done." },
      { text: "Тест: `/add` → запис у таблиці." },
    ],
  },
  {
    id: "gsheets",
    title: "Google Sheets",
    summary: "Онлайн-таблиця як база даних.",
    steps: [
      { text: "Створи Google Sheet, увімкни доступ “за посиланням”." },
      {
        text: "Попроси ШІ підключити gspread до таблиці.",
        prompt:
          "Підключи gspread до Google Sheets. Використай .env: GOOGLE_CREDENTIALS (JSON), SHEET_ID.",
      },
      { text: "Додай функцію запису рядків." },
      { text: "Тест: `/add` → новий рядок у таблиці." },
    ],
  },
  {
    id: "postgres",
    title: "Postgres (Docker)",
    summary: "Потужна база для командних проєктів.",
    steps: [
      { text: "Встанови Docker Desktop." },
      {
        text: "Створи `docker-compose.yml` з Postgres.",
        prompt:
          "Створи docker-compose.yml з Postgres (POSTGRES_PASSWORD=postgres, порт 5432) та сервісом для бота.",
      },
      {
        text: "Підключи Postgres до aiogram.",
        prompt:
          "Додай підключення до Postgres і CRUD для таблиці tasks. Використай psycopg2 або SQLAlchemy.",
      },
      { text: "Інтегруй репозиторій у хендлери." },
      { text: "Тест: `/add` → запис у базі." },
    ],
  },
];



const FILE_STRUCTURE_BACKEND_MAP = {
  json: [
    {
      type: "dir",
      path: "data/",
      description: "Папка під JSON-базу. Створи поруч із основним файлом.",
    },
    {
      type: "static",
      path: "data/db.json",
      description: "Порожній файл, бот заповнить його автоматично.",
      content: "[]",
    },
  ],
  sqlite: [
    {
      type: "info",
      path: "db.sqlite3",
      description:
        "SQLite створить файл сам під час запуску. Переконайся, що каталог доступний для запису.",
    },
  ],
  gsheets: [
    {
      type: "note",
      description:
        "Google Sheets не вимагає додаткових файлів: просто збережи дані для підключення у `.env`.",
    },
  ],
  postgres: [
    {
      type: "ai",
      path: "docker-compose.yml",
      description:
        "Шаблон Docker для Postgres + сервісу бота. Згенеруй через ШІ та збережи поруч із основним файлом.",
      prompt:
        "Мені потрібен файл docker-compose.yml. Створи сервіс postgres (POSTGRES_PASSWORD=postgres, порт 5432) і сервіс для бота. Покажи весь файл одним блоком.",
    },
  ],
};

const defaultCustomState = {
  requirements: "",
  briefText: "",
  brief: null,
  files: [],
  commandsText: "",
  diag: {
    description: "",
    logs: "",
    prompt: "",
  },
  briefLocked: false,
};

const defaultUiState = {
  replyVariant: "default",
  inlineVariant: "default",
  replyCustomSpec: "",
  inlineCustomSpec: "",
};

const DESIGN_STEPS = [
  {
    title: "Що таке дизайн",
    items: [
      "Дизайн — вигляд бота: кнопки, меню, тексти. Робимо просто та зрозуміло.",
    ],
  },
  {
    title: "Головне меню (Reply-кнопки)",
    items: [
      "Попроси ШІ: «Додай меню з кнопками: 📋 Завдання, 🧠 Поради, ⚙️ Налаштування. Поясни, куди вставити код.»",
      "Встав код → збережи → у Telegram введи `/start`.",
    ],
  },
  {
    title: "Inline-кнопки",
    items: [
      "Попроси ШІ: «Додай inline-кнопки на сторінці “Завдання”: [✅ Готово] [❌ Пропустити] [📊 Статистика]. Опиши зміни у коді.»",
      "Встав код → протестуй у чаті.",
    ],
  },
  {
    title: "Гарні тексти",
    items: [
      "Попроси ШІ: «Зроби дружні тексти з емодзі для відповіді /stats.»",
      "Перевір, як виглядає у чаті.",
    ],
  },
];

const STATS_STEPS = [
  {
    title: "Команда /stats",
    items: [
      "Попроси ШІ: «Додай команду /stats, яка показує прогрес за сьогодні, тиждень і загалом. Покажи, де в main.py її розмістити.»",
      "Встав код → перевір у Telegram.",
    ],
  },
  {
    title: "Красивий звіт",
    items: [
      "Попроси ШІ: «Додай форматований звіт з емодзі та відсотками.»",
      "Переконайся, що текст легко читати.",
    ],
  },
  {
    title: "Щоденні нагадування",
    items: [
      "Попроси ШІ: «Налаштуй щоденний звіт о 20:00 (apscheduler або asyncio). Поясни, куди додати код.»",
      "Переконайся, що планувальник не блокує основний цикл.",
    ],
  },
];

const PAYMENT_METHODS = [
  {
    id: "stripe",
    title: "Stripe",
    description: "Міжнародні картки (USD та інші валюти).",
    steps: [
      {
        text: "Попроси ШІ: «Додай оплату Stripe на $5 і команду /buy. Після успіху надішли “Дякую за оплату!”. Поясни, куди вставити код.»",
        prompt:
          "Додай у бота оплату Stripe на $5: команда /buy, успішна оплата → повідомлення “Дякую за оплату!”. Опиши необхідні файли/блоки.",
      },
      { text: "Тест: посилання на оплату працює, оплата проходить." },
    ],
  },
  {
    id: "wayforpay",
    title: "WayForPay",
    description: "Українська платіжка (гривня).",
    steps: [
      {
        text: "Попроси ШІ: «Додай WayForPay на 100 грн для “Преміум-доступ”. Після оплати відправ “Дякую!”. Опиши кроки інтеграції.»",
        prompt:
          "Додай WayForPay оплату на 100 грн для “Преміум-доступ”. Після успіху відправ “Дякую!”. Додай інструкцію, які файли / ендпоінти змінюємо.",
      },
      { text: "Тест: форма оплати відкривається і працює." },
    ],
  },
];

const PAYMENT_INTRO = [
  "Зареєструйся у Stripe (stripe.com) або WayForPay (wayforpay.com).",
  "Додай у `.env` ключі STRIPE_KEY або WAYFORPAY_KEY.",
  "API-ключ — секрет. Не ділись ним у репозиторії.",
];

const STEP_DETAILS = {
  folder: [
    {
      title: "GitHub Codespaces",
      description:
        "Увійди в GitHub, відкрий свій репозиторій, натисни Code → Codespaces → Create codespace on main. Через кілька секунд відкриється веб‑VS Code, де вже встановлений Python та git.",
      gif: "assets/intro.gif",
    },
    {
      title: "Локальне середовище",
      description:
        "Якщо обрав локальний варіант: створи папку `mybot`, відкрий її у VS Code, переконайся, що Python 3.10+ встановлений, та підготуй термінал (pip, venv).",
    },
  ],
  requirements: [
    {
      title: "Створення файла",
      description:
        "У VS Code натисни `File → New File`, назви його `requirements.txt` та збережи поруч із основним файлом бота.",
      gif: "assets/details/requirements-create.gif",
    },
    {
      title: "Додавання залежностей",
      description:
        "Скопіюй рядки з кроку та встав у файл. Збережи, щоб pip міг встановити бібліотеки.",
      gif: "assets/details/requirements-fill.gif",
    },
  ],
  "env-file": [
    {
      title: "Створення .env",
      description:
        "У корені проєкту створи файл `.env`. У ньому будемо тримати секретні змінні.",
      gif: "assets/details/env-create.gif",
    },
    {
      title: "Додавання BOT_TOKEN",
      description:
        "Скопіюй токен із BotFather та встав рядок `BOT_TOKEN=тут_твій_токен`. Файл повинен бути в .gitignore.",
      gif: "assets/details/env-fill.gif",
    },
  ],
};

const LAUNCH_STEPS = [
  {
    title: "Запуск",
    items: [
      "Виконай у терміналі: `python main.py`.",
      "Якщо бачиш “Bot started” — усе добре.",
    ],
  },
  {
    title: "Перевір команди",
    type: "commands",
  },
  {
    title: "Резервна копія",
    items: [
      "Скопіюй код у хмару або на GitHub (без `.env`).",
      "Перезапусти бота та переконайся, що все працює.",
    ],
  },
];

const EXTRA_MODULE_OPTIONS = [
  {
    id: "autosave",
    title: "Автозбереження",
    description: "Зберігає та відновлює стан користувачів у наявному сховищі.",
    icon: "🔁",
  },
  {
    id: "adminPanel",
    title: "Адмін-панель",
    description: "Окремий режим із меню, статистикою та керуванням заявками.",
    icon: "🧩",
  },
  {
    id: "i18n",
    title: "Багатомовність",
    description: "Словники мов + перемикач мови для користувача (UA/PL/EN).",
    icon: "🌍",
  },
];

const defaultExtraModulesState = {
  autosave: false,
  adminPanel: false,
  i18n: false,
};

const defaultExtraModuleData = {
  autosave: {
    storage: { file: "storage.py", code: "" },
    hooks: { file: "main.py", code: "" },
    restore: { file: "main.py", code: "" },
  },
  adminPanel: {
    config: { file: "config.py", code: "" },
    envSnippet: "",
    handlers: { file: "handlers_admin.py", code: "" },
    leads: { file: "handlers_admin.py", code: "" },
    security: { file: "handlers_admin.py", code: "" },
  },
  i18n: {
    helper: { file: "i18n.py", code: "" },
    locales: {
      ua: { file: "locales/ua.json", code: "" },
      pl: { file: "locales/pl.json", code: "" },
      en: { file: "locales/en.json", code: "" },
    },
    storage: { file: "storage.py", code: "" },
    language: { file: "main.py", code: "" },
    usage: { file: "main.py", code: "" },
  },
};

const FINISH_STEP = {
  title: "Фініш",
  items: [
    "Повідомлення: «Готово! Ти створив свого Telegram-бота.»",
    "Якщо щось пішло не так — відкрий чат помічника (кнопка 💬) і опиши проблему.",
  ],
};

const defaultTools = TOOL_CHECKLIST.reduce(
  (acc, tool) => {
    acc[tool.id] = false;
    return acc;
  },
  { requirements: false, env: false }
);
defaultTools.codespace = false;
defaultTools.browser = false;
defaultTools.requirementsCreated = false;
defaultTools.dbFileCreated = false;
defaultTools.repoFileCreated = false;
defaultTools.storageFileCreated = false;
defaultTools.requirementsCreated = false;
defaultTools.dbFileCreated = false;
defaultTools.repoFileCreated = false;
defaultTools.storageFileCreated = false;

const defaultState = {
  currentStep: 0,
  choices: {
    botType: null,
    mode: null,
    environment: null,
    backend: null,
    entryFile: ENTRY_FILE_OPTIONS[0].id,
    payment: "none",
  },
  tools: structuredClone(defaultTools),
  commands: ["/start", "/help"],
  ui: structuredClone(defaultUiState),
  custom: structuredClone(defaultCustomState),
  extraModules: structuredClone(defaultExtraModulesState),
  extraModuleData: structuredClone(defaultExtraModuleData),
};

const AI_LINKS = {
  chatgpt: "https://chat.openai.com/",
  codex: "https://chatgpt.com/codex/",
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
    if (targetState.custom.diag === undefined)
      targetState.custom.diag = { description: "", logs: "", prompt: "" };
    if (targetState.custom.files === undefined) targetState.custom.files = [];
    if (typeof targetState.custom.briefLocked !== "boolean") {
      targetState.custom.briefLocked = false;
    }
  }
  return targetState.custom;
}

function ensureUiState(targetState = state) {
  if (!targetState.ui) {
    targetState.ui = structuredClone(defaultUiState);
  } else {
    if (!targetState.ui.replyVariant) targetState.ui.replyVariant = "default";
    if (!targetState.ui.inlineVariant) targetState.ui.inlineVariant = "default";
    if (typeof targetState.ui.replyCustomSpec !== "string")
      targetState.ui.replyCustomSpec = "";
    if (typeof targetState.ui.inlineCustomSpec !== "string")
      targetState.ui.inlineCustomSpec = "";
  }
  return targetState.ui;
}

function ensureExtraModules(targetState = state) {
  if (!targetState.extraModules) {
    targetState.extraModules = structuredClone(defaultExtraModulesState);
  } else {
    targetState.extraModules = Object.assign(
      {},
      defaultExtraModulesState,
      targetState.extraModules
    );
  }
  return targetState.extraModules;
}

function ensureExtraModuleData(targetState = state) {
  if (!targetState.extraModuleData) {
    targetState.extraModuleData = structuredClone(defaultExtraModuleData);
  } else {
    const base = structuredClone(defaultExtraModuleData);
    mergePlainObject(base, targetState.extraModuleData);
    targetState.extraModuleData = base;
  }
  const data = targetState.extraModuleData;
  const entryFile = getEntryFile(targetState);

  if (!data.autosave.hooks.file) data.autosave.hooks.file = entryFile;
  if (!data.autosave.restore.file) data.autosave.restore.file = entryFile;
  if (!data.adminPanel.handlers.file) data.adminPanel.handlers.file = entryFile;
  if (!data.adminPanel.leads.file) data.adminPanel.leads.file =
    data.adminPanel.handlers.file || entryFile;
  if (!data.adminPanel.security.file) data.adminPanel.security.file =
    data.adminPanel.handlers.file || entryFile;
  if (!data.i18n.language.file) data.i18n.language.file = entryFile;
  if (!data.i18n.usage.file) data.i18n.usage.file = entryFile;

  return data;
}

function applyBotTypeSelection(value, options = {}) {
  if (!value || !state?.choices) return false;
  const previous = state.choices.botType;
  state.choices.botType = value;

  const resetUi = options.resetUi !== false;
  if (resetUi) {
    state.ui = structuredClone(defaultUiState);
  }

  const typeMeta = BOT_TYPES.find((item) => item.id === value);
  const isCustom = value === "custom";
  const customState = ensureCustomState();
  const hasCustomBriefCommands =
    Array.isArray(customState?.brief?.commands) &&
    customState.brief.commands.length > 0;
  const prevCommands = Array.isArray(state.commands)
    ? [...state.commands]
    : [];
  let commandsChanged = false;
  let customStateChanged = false;

  let shouldUpdateCommands = true;
  if (isCustom && !options.forceCustomReset) {
    if (options.preserveCustomCommands !== false && hasCustomBriefCommands) {
      shouldUpdateCommands = false;
    }
  }

  if (shouldUpdateCommands) {
    const newCommands = typeMeta?.commands?.length
      ? [...typeMeta.commands]
      : ["/start", "/help"];
    commandsChanged =
      newCommands.length !== prevCommands.length ||
      newCommands.some((cmd, idx) => cmd !== prevCommands[idx]);
    state.commands = newCommands;
  }

  if (isCustom && previous !== "custom") {
    state.custom = structuredClone(defaultCustomState);
    state.choices.entryFile = ENTRY_FILE_OPTIONS[0].id;
    customStateChanged = true;
  }
  if (!isCustom && previous === "custom") {
    state.custom = structuredClone(defaultCustomState);
    state.choices.entryFile = ENTRY_FILE_OPTIONS[0].id;
    customStateChanged = true;
  }

  return previous !== value || commandsChanged || customStateChanged;
}

function mergePlainObject(target, source) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return;
  Object.keys(source).forEach((key) => {
    const value = source[key];
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof target[key] === "object" &&
      target[key] !== null &&
      !Array.isArray(target[key])
    ) {
      mergePlainObject(target[key], value);
    } else {
      target[key] = value;
    }
  });
}

function isCustomBot(currentState = state) {
  return currentState?.choices?.botType === "custom";
}

function generateCustomBriefPrompt() {
  const custom = ensureCustomState();
  const requirements = custom.requirements?.trim() || "Опис ще не додано.";
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
  const path = fileSpec.path || "main.py";
  const purpose = fileSpec.purpose || "Основна логіка";
  return [
    `Контекст бота: ${serializedBrief}.`,
    `Файл: ${path}. Призначення: ${purpose}.`,
    "Згенеруй повний вміст файлу, самодостатній, без пропусків.",
  ].join("\n");
}

function createSimpleFileInstructions(fileSpec) {
  const path = fileSpec.path || "file.txt";
  const purpose = fileSpec.purpose || "Допоміжний файл";
  return `Створи файл ${path}. Призначення: ${purpose}. Заповни відповідно до брифу та збережи у зазначеній директорії.`;
}

function generateCodexFileCreationPrompt(brief) {
  const serializedBrief = JSON.stringify(brief, null, 2);
  const files = Array.isArray(brief?.files) ? brief.files : [];
  const fileSummary = files.length
    ? files
        .map((file, index) => {
          const path = file?.path || `file_${index + 1}.txt`;
          const purpose = file?.purpose || "Призначення не вказано.";
          const simpleLabel = file?.isSimple ? " (простий/статичний файл)" : "";
          return `- ${path}: ${purpose}${simpleLabel}`;
        })
        .join("\n")
    : "- Створи базову структуру файлів за брифом.";

  return [
    "Ти працюєш у Codex у VS Code.",
    `JSON-бриф: ${serializedBrief}.`,
    "Створи структуру проєкту та всі перелічені файли/папки (поки без бізнес-логіки):",
    fileSummary,
    "Правила:",
    "- Не додавай зайвих залежностей чи файлів поза списком.",
    "- Для простих файлів можна одразу додати статичні дані або заглушки.",
    "- Додай мінімальні імпорти/коментарі, щоб файли відкривались без помилок.",
    "Після створення файлів дай коротке підтвердження. Детальний код додамо окремими промптами для кожного файла.",
  ].join("\n");
}

function updateCustomFilePlan(parsedBrief) {
  const custom = ensureCustomState();
  const previousStatus = new Map(
    custom.files.map((item) => [item.path, !!item.done])
  );
  const files = Array.isArray(parsedBrief?.files) ? parsedBrief.files : [];
  custom.files = files.map((fileSpec, index) => {
    const path = fileSpec?.path || `file_${index + 1}.txt`;
    const isSimple = !!fileSpec?.isSimple;
    return {
      id: `${index}-${path}`,
      path,
      purpose: fileSpec?.purpose || "",
      isSimple,
      instructions: isSimple ? createSimpleFileInstructions(fileSpec) : null,
      prompt: isSimple
        ? null
        : generateManualFilePromptForSpec(parsedBrief, fileSpec),
      done: previousStatus.get(path) || false,
    };
  });
}

function deriveDefaultCommands(customState, entryFile) {
  const commands = [];
  const hasRequirements = customState.files.some(
    (file) => file.path === "requirements.txt"
  );
  if (hasRequirements) commands.push("pip install -r requirements.txt");
  const pythonFile =
    customState.files.find((file) => /\.py$/i.test(file.path) && !file.isSimple)
      ?.path ||
    entryFile ||
    "main.py";
  commands.push(`python ${pythonFile}`);
  return commands.join("\n");
}

function composeCustomDiagnosticPrompt(customState) {
  const briefText = customState.brief
    ? JSON.stringify(customState.brief, null, 2)
    : "Бриф ще не збережено.";
  const knownFiles = customState.files.length
    ? customState.files
        .map((file) => `${file.path} — ${file.isSimple ? "simple" : "code"}`)
        .join("\n")
    : "Файли ще не сформовано.";
  return [
    `Контекст бота: ${briefText}.`,
    `Опис помилки: ${customState.diag.description || "не вказано"}.`,
    `Логи терміналу: ${customState.diag.logs || "не надано"}.`,
    `Поточна структура файлів: ${knownFiles}.`,
    "Покажи повністю виправлений код і чітко вкажи, в які файли його вставити.",
  ].join("\n");
}

function getCustomCommandsList(customState) {
  return customState.commandsText
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getBotStorageRecommendation(currentState = state) {
  const type = currentState?.choices?.botType;
  if (!type) return null;

  if (type !== "custom") {
    const recommendation = BOT_STORAGE_RECOMMENDATIONS[type];
    if (!recommendation) return null;
    return {
      id: recommendation.storage,
      reason: recommendation.reason,
      modules: recommendation.modules || {},
    };
  }

  const custom = ensureCustomState(currentState);
  const brief = custom.brief || {};
  const candidates = [
    brief.storage?.type,
    brief.backend?.type,
    brief.storage?.name,
    brief.storage?.id,
  ].map((value) => (typeof value === "string" ? value.toLowerCase() : ""));

  const text = candidates.filter(Boolean).join(" ");
  const map = [
    { key: "postgresql", value: "postgres" },
    { key: "postgres", value: "postgres" },
    { key: "sqlite", value: "sqlite" },
    { key: "google sheets", value: "gsheets" },
    { key: "gsheets", value: "gsheets" },
    { key: "sheets", value: "gsheets" },
    { key: "json", value: "json" },
  ];
  for (const item of map) {
    if (text.includes(item.key))
      return { id: item.value, reason: "Рекомендація на основі брифу" };
  }
  return null;
}

function getRecommendedBackendId(currentState = state) {
  const rec = getBotStorageRecommendation(currentState);
  return rec?.id || null;
}

function normalizeCommand(command) {
  if (typeof command !== "string") return "";
  const trimmed = command.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function customBriefHasCommand(command) {
  const custom = ensureCustomState();
  const target = normalizeCommand(command);
  if (!target) return false;
  const commands = Array.isArray(custom.brief?.commands)
    ? custom.brief.commands
    : state.commands;
  return commands.some(
    (cmd) => normalizeCommand(cmd).toLowerCase() === target.toLowerCase()
  );
}

function customBriefHasReminder() {
  const custom = ensureCustomState();
  const commands = Array.isArray(custom.brief?.commands)
    ? custom.brief.commands
    : state.commands;
  const commandMatch = commands.some((cmd) => {
    const normalized = normalizeCommand(cmd).toLowerCase();
    return (
      normalized.includes("remind") ||
      normalized.includes("daily") ||
      normalized.includes("schedule")
    );
  });
  if (commandMatch) return true;
  const featuresCandidates = [].concat(
    Array.isArray(custom.brief?.features) ? custom.brief.features : [],
    Array.isArray(custom.brief?.modules) ? custom.brief.modules : [],
    Array.isArray(custom.brief?.capabilities) ? custom.brief.capabilities : []
  );
  return featuresCandidates.some(
    (item) =>
      typeof item === "string" && /нагад|remind|schedule|daily/i.test(item)
  );
}

function generateCommandFixPrompt(customState) {
  const briefText = customState.brief
    ? JSON.stringify(customState.brief, null, 2)
    : "Бриф ще не збережено.";
  const commands = (state.commands || [])
    .map((cmd) => normalizeCommand(cmd))
    .filter(Boolean)
    .join(", ");
  const lines = [
    `Контекст бота: ${briefText}.`,
    `Поточний список команд: ${commands || "не визначено"}.`,
    "Опиши, яка команда або набір команд працює некоректно.",
  ];
  if (state.choices.mode === "chatgpt") {
    lines.push(
      "Попроси ШІ повернути повні оновлені версії змінених файлів (цілком), щоб їх можна було вставити без правок."
    );
  } else {
    lines.push(
      "Попроси ШІ пояснити, які зміни внести, та надати оновлений код для відповідних файлів."
    );
  }
  return lines.join("\n");
}

function getUiSection(section, currentState = state) {
  const custom = ensureCustomState(currentState);
  const ui = custom.brief?.ui;
  if (!ui || typeof ui !== "object") return null;
  const data = ui[section];
  if (!data || typeof data !== "object") return null;
  const needed = data.needed;
  const buttons = Array.isArray(data.buttons) ? data.buttons : [];
  const notes = typeof data.notes === "string" ? data.notes : "";
  return { needed, buttons, notes };
}

function generateUiCodePrompt(section, buttons) {
  const custom = ensureCustomState();
  const briefText = custom.brief
    ? JSON.stringify(custom.brief, null, 2)
    : "Бриф ще не збережено.";
  const entryFile = getEntryFile();
  const mode = state.choices.mode;
  const spec = JSON.stringify(buttons, null, 2);
  const readable = section === "reply" ? "reply-меню" : "inline-кнопки";
  const lines = [
    `Контекст бота: ${briefText}.`,
    `Специфікація ${readable}:`,
    spec,
    `Онови файл ${entryFile}, додавши ${readable} та необхідні обробники.`,
    "Використовуй українські підписи та дружні повідомлення.",
  ];
  if (mode === "chatgpt") {
    lines.push(
      `Поверни повний оновлений код файла ${entryFile} одним блоком без пропусків.`
    );
  } else {
    lines.push(
      `Опиши внесені зміни та наведи оновлений код для відповідних частин ${entryFile}.`
    );
  }
  return lines.join("\n");
}

function generateUiDiscoveryPrompt(section) {
  const custom = ensureCustomState();
  const briefText = custom.brief
    ? JSON.stringify(custom.brief, null, 2)
    : "Бриф ще не збережено.";
  const entryFile = getEntryFile();
  const mode = state.choices.mode;
  const readable = section === "reply" ? "reply-меню" : "inline-кнопки";
  const elementFormat =
    section === "reply"
      ? '{"text": "...", "purpose": "..."}'
      : '{"text": "...", "purpose": "...", "callback": "..."}';
  const lines = [
    `Контекст бота: ${briefText}.`,
    `Запропонуй, чи потрібне ${readable}. Якщо так, сформуй масив об’єктів формату ${elementFormat}.`,
    `Після цього онови файл ${entryFile}, додавши ${readable} та необхідну логіку.`,
    "Використовуй українські підписи.",
  ];
  if (mode === "chatgpt") {
    lines.push(`Поверни повний оновлений код файла ${entryFile} одним блоком.`);
  } else {
    lines.push(
      `Поясни, які зміни треба внести у ${entryFile}, та додай оновлений код для відповідних частин.`
    );
  }
  return lines.join("\n");
}

function getPresetUiSpec(section, currentState = state) {
  const typeId = currentState?.choices?.botType;
  if (!typeId) return null;
  const type = BOT_TYPES.find((item) => item.id === typeId);
  if (!type || !type.ui) return null;
  const config = type.ui[section];
  if (!config) return null;

  const baseNotes = typeof config.notes === "string" ? config.notes : "";
  const discoveryHint =
    typeof config.discoveryHint === "string" ? config.discoveryHint : "";

  let variants = [];
  if (Array.isArray(config.variants) && config.variants.length) {
    variants = config.variants.map((variant, index) => ({
      id: variant.id || `variant-${index}`,
      title: variant.title || "Варіант",
      description: variant.description || "",
      buttons: Array.isArray(variant.buttons) ? variant.buttons : [],
      notes: typeof variant.notes === "string" ? variant.notes : "",
    }));
  } else if (Array.isArray(config.buttons) && config.buttons.length) {
    variants = [
      {
        id: "default",
        title: "Рекомендовані кнопки",
        description: "",
        buttons: config.buttons,
        notes: baseNotes,
      },
    ];
  }

  return {
    needed: config.needed !== false,
    variants,
    notes: baseNotes,
    discoveryHint,
    type,
  };
}

function generatePresetUiCodePrompt(section, variant, type) {
  const entryFile = getEntryFile();
  const mode = state.choices.mode;
  const commands = state.commands.length
    ? state.commands.join(", ")
    : "/start, /help";
  const readable = section === "reply" ? "reply-меню" : "inline-кнопки";
  const spec = JSON.stringify(variant.buttons, null, 2);
  const lines = [
    `Тип бота: ${type.title}.`,
    `Опис: ${type.description}.`,
    `Доступні команди: ${commands}.`,
    `Онови файл ${entryFile}, додавши ${readable} за цією специфікацією:`,
    spec,
    "Додай обробники натискань та дружні українські повідомлення.",
    "Використовуй aiogram v3.",
  ];
  if (variant.notes) lines.push(`Примітка: ${variant.notes}`);
  if (mode === "chatgpt") {
    lines.push(
      `Поверни повний оновлений код файла ${entryFile} одним блоком без скорочень.`
    );
  } else {
    lines.push(
      `Опиши, які частини ${entryFile} треба змінити, і додай оновлені фрагменти коду.`
    );
  }
  return lines.join("\n");
}

function generatePresetUiDiscoveryPrompt(section, type) {
  const entryFile = getEntryFile();
  const mode = state.choices.mode;
  const commands = state.commands.length
    ? state.commands.join(", ")
    : "/start, /help";
  const readable = section === "reply" ? "reply-меню" : "inline-кнопки";
  const format =
    section === "reply"
      ? '{"text": "...", "purpose": "..."}'
      : '{"text": "...", "purpose": "...", "callback": "..."}';
  const lines = [
    `Тип бота: ${type.title}.`,
    `Опис: ${type.description}.`,
    `Команди: ${commands}.`,
    `Запропонуй кілька варіантів ${readable} у форматі масиву об’єктів ${format}.`,
    `Після узгодження додай ${readable} до файла ${entryFile} (aiogram v3).`,
    "Використовуй українські тексти кнопок.",
  ];
  if (mode === "chatgpt") {
    lines.push(`Поверни повний оновлений код файла ${entryFile} одним блоком.`);
  } else {
    lines.push(`Опиши зміни у ${entryFile} та додай оновлені фрагменти коду.`);
  }
  return lines.join("\n");
}

function generatePresetUiCustomPrompt(section, rawSpec, type) {
  const spec = rawSpec.trim();
  if (!spec) return "";
  const entryFile = getEntryFile();
  const mode = state.choices.mode;
  const readable = section === "reply" ? "reply-меню" : "inline-кнопки";
  const lines = [
    `Тип бота: ${type.title}.`,
    `Опис: ${type.description}.`,
    `Необхідно додати ${readable} до файла ${entryFile} за наступним описом (формат "Назва — призначення — callback/URL"):`,
    spec,
    "Збудуй колбеки, онови хендлери та відповіді українською.",
    "Використовуй aiogram v3.",
  ];
  if (mode === "chatgpt") {
    lines.push(
      `Поверни повний оновлений код файла ${entryFile} одним блоком без скорочень.`
    );
  } else {
    lines.push(`Опиши зміни у ${entryFile} та додай оновлені фрагменти коду.`);
  }
  return lines.join("\n");
}

function parseCustomBrief(rawText) {
  if (!rawText) throw new Error("Бриф порожній.");
  let normalized = rawText.trim();
  if (normalized.startsWith("```")) {
    const fenceEnd = normalized.lastIndexOf("```");
    normalized = normalized
      .slice(normalized.indexOf("\n") + 1, fenceEnd)
      .trim();
  }
  return JSON.parse(normalized);
}

const elements = {
  section: document.getElementById("section-label"),
  progressInner: document.getElementById("progress-inner"),
  progressLabel: document.getElementById("progress-label"),
  stepIndex: document.getElementById("step-index"),
  stepTitle: document.getElementById("step-title"),
  stepBody: document.getElementById("step-body"),
  prev: document.getElementById("prev-btn"),
  next: document.getElementById("next-btn"),
  reset: document.getElementById("reset-btn"),
  navToggle: document.getElementById("nav-toggle"),
  navMenu: document.getElementById("nav-menu"),
  navBackdrop: document.getElementById("nav-backdrop"),
  topNav: document.querySelector(".top-nav"),
  navSummary: document.getElementById("nav-summary"),
  docsBtn: document.getElementById("docs-btn"),
  docsBackdrop: document.getElementById("docs-backdrop"),
  docsClose: document.getElementById("docs-close"),
  detailsOverlay: document.getElementById("details-overlay"),
  detailsBody: document.getElementById("details-body"),
  detailsClose: document.getElementById("details-close"),
  jumpSelect: document.getElementById("jump-select"),
  jumpButton: document.getElementById("jump-btn"),
  footer: document.querySelector(".step-actions"),
  toast: document.getElementById("toast"),
  toastBody: document.querySelector("#toast .toast-body"),
};

let state = loadState();
let steps = [];
let setupOverlayTimer = null;
let setupOverlayTick = null;
let lastSupportIssue = null;

elements.prev.addEventListener("click", () => {
  if (state.currentStep === 0) return;
  state.currentStep -= 1;
  saveState();
  draw(false);
  scheduleProgressSync();
});

elements.next.addEventListener("click", async () => {
  const step = steps[state.currentStep];
  const validation = validateStep(step);
  if (!validation.allow) {
    showToast(validation.message);
    return;
  }
  const targetIndex = state.currentStep + 1;
  if (targetIndex < steps.length && needsBotAccess(targetIndex)) {
    const allowed = await ensureAccessForCurrentBot();
    if (!allowed) return;
  }
  if (state.currentStep < steps.length - 1) {
    state.currentStep += 1;
    saveState();
    draw(false);
    scheduleProgressSync();
  } else {
    showToast("Готово! Можеш переглядати попередні кроки.");
  }
});

if (elements.reset) {
  elements.reset.addEventListener("click", () => {
    if (!confirm("Скинути всі кроки та повернутися до початку?")) return;
    closeDocs();
    closeNavMenu();
    state = structuredClone(defaultState);
    saveState();
    draw(true);
    updateNavOnScroll();
    showToast("Майстер скинуто.");
  });
}

if (elements.jumpButton) {
  elements.jumpButton.addEventListener("click", () => {
    jumpToSelectedStep();
  });
}

if (elements.jumpSelect) {
  elements.jumpSelect.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      jumpToSelectedStep();
    }
  });
}

if (elements.docsBtn && elements.docsBackdrop) {
  elements.docsBtn.addEventListener("click", openDocs);
}

if (elements.docsClose) {
  elements.docsClose.addEventListener("click", closeDocs);
}

if (elements.detailsClose) {
  elements.detailsClose.addEventListener("click", closeDetailsOverlay);
}

if (elements.detailsOverlay) {
  elements.detailsOverlay.addEventListener("click", (event) => {
    if (event.target === elements.detailsOverlay) {
      closeDetailsOverlay();
    }
  });
}

if (elements.navToggle) {
  elements.navToggle.addEventListener("click", () => {
    if (elements.navMenu?.classList.contains("open")) {
      closeNavMenu();
    } else {
      openNavMenu();
    }
  });
}

if (elements.navBackdrop) {
  elements.navBackdrop.addEventListener("click", () => {
    closeNavMenu();
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeDocs();
    closeNavMenu();
    closeDetailsOverlay();
  }
});

async function jumpToSelectedStep() {
  if (!elements.jumpSelect) return;
  const value = elements.jumpSelect.value;
  if (!value) return;
  const index = steps.findIndex((step) => step.id === value);
  if (index === -1) return;
  if (needsBotAccess(index)) {
    const allowed = await ensureAccessForCurrentBot();
    if (!allowed) return;
  }
  state.currentStep = index;
  saveState();
  draw(false);
  scheduleProgressSync();
}

function openDocs() {
  elements.docsBackdrop.hidden = false;
  document.body.classList.add("docs-open");
}

function closeDocs() {
  elements.docsBackdrop.hidden = true;
  document.body.classList.remove("docs-open");
}

function openDetailsOverlay(stepId) {
  const details = STEP_DETAILS[stepId];
  if (
    !details ||
    !details.length ||
    !elements.detailsOverlay ||
    !elements.detailsBody
  )
    return;
  elements.detailsBody.innerHTML = details
    .map((item, index) => {
      const order = item.title || `Крок ${index + 1}`;
      const image = item.gif
        ? `<img src="${item.gif}" alt="${order}" loading="lazy" />`
        : "";
      const description = item.description
        ? `<p>${item.description}</p>`
        : "";
      return `
        <article class="step-details-card">
          <header>${order}</header>
          ${image}
          ${description}
        </article>
      `;
    })
    .join("");
  elements.detailsOverlay.hidden = false;
  document.body.classList.add("details-open");
}

function closeDetailsOverlay() {
  if (!elements.detailsOverlay) return;
  elements.detailsOverlay.hidden = true;
  if (elements.detailsBody) {
    elements.detailsBody.innerHTML = "";
  }
  document.body.classList.remove("details-open");
}

function openNavMenu() {
  if (!elements.navMenu || !elements.navToggle) return;
  elements.navMenu.classList.add("open");
  elements.navToggle.classList.add("open");
  elements.navToggle.setAttribute("aria-expanded", "true");
  elements.topNav?.classList.add("menu-active");
  elements.topNav?.classList.remove("scrolled");
  if (elements.navBackdrop) elements.navBackdrop.hidden = false;
  document.body.classList.add("nav-open");
}

function closeNavMenu() {
  if (!elements.navMenu || !elements.navToggle) return;
  elements.navMenu.classList.remove("open");
  elements.navToggle.classList.remove("open");
  elements.navToggle.setAttribute("aria-expanded", "false");
  if (elements.navBackdrop) elements.navBackdrop.hidden = true;
  document.body.classList.remove("nav-open");
  elements.topNav?.classList.remove("menu-active");
  updateNavOnScroll();
}

function isMobileNav() {
  return window.matchMedia("(max-width: 720px)").matches;
}

window.addEventListener("scroll", updateNavOnScroll, { passive: true });
updateNavOnScroll();

function updateNavOnScroll() {
  if (!elements.topNav) return;
  const scrolled = window.scrollY > 24;
  elements.topNav.classList.toggle(
    "scrolled",
    scrolled && !document.body.classList.contains("nav-open")
  );
}

function updateNavSummary() {
  if (!elements.navSummary) return;
  const type =
    BOT_TYPES.find((item) => item.id === state.choices.botType)?.title ||
    "не обрано";
  const environment =
    ENVIRONMENTS.find((item) => item.id === state.choices.environment)?.title ||
    "не обрано";
  const mode =
    MODE_OPTIONS.find((item) => item.id === state.choices.mode)?.title ||
    "не обрано";
elements.navSummary.innerHTML = `Тип: <span>${type}</span> | Середовище: <span>${environment}</span> | ШІ: <span>${mode}</span>`;
}

setupTopbarControls();
setupAuthTabs();
updateAdminButtons();
setupSupportChat();
loadSupportTickets();
const envCreateBtn = document.getElementById("env-create-btn");
const envBackBtn = document.getElementById("env-back-btn");
if (envCreateBtn) {
  envCreateBtn.addEventListener("click", () => createEnvironmentPrompt());
}
if (envBackBtn) {
  envBackBtn.addEventListener("click", () => hideEnvScreen());
}
draw(true);
initApp();

function updateAdminButtons() {
  const show = isAdmin();
  const navBtn = document.getElementById("nav-admin");
  const popupBtn = document.querySelector('#nav-popup button[data-action="admin"]');
  if (navBtn) navBtn.hidden = !show;
  if (popupBtn) popupBtn.hidden = !show;
}

function handleReset() {
  if (!confirm("Скинути всі кроки та повернутися до початку?")) return;
  state = structuredClone(defaultState);
  saveState();
  draw(true);
  scheduleProgressSync(true);
  showToast("Майстер скинуто.");
}

async function handleLogout() {
  try {
    await api("/auth/logout", { method: "POST" });
  } catch (error) {
    console.warn("Logout error", error);
  }
  window.currentUser = null;
  resetBotAccessCache();
  if (progressSyncTimer) {
    clearTimeout(progressSyncTimer);
    progressSyncTimer = null;
  }
  pendingProgressSync = false;
  progressSyncInFlight = false;
  envState.activeId = null;
  envSelectionShown = false;
  localStorage.removeItem(ACTIVE_ENV_KEY);
  envState.items = [];
  renderEnvironmentList();
  state = structuredClone(defaultState);
  saveState();
  draw(true);
  showLoginScreen();
}

async function loadEnvironments() {
  try {
    const response = await api("/envs", { method: "GET" });
    const list = Array.isArray(response?.envs)
      ? response.envs
      : Array.isArray(response)
      ? response
      : [];
    envState.items = list;
    if (
      envState.activeId &&
      !envState.items.some((env) => env.id === envState.activeId)
    ) {
      envState.activeId = null;
      localStorage.removeItem(ACTIVE_ENV_KEY);
      state = structuredClone(defaultState);
      saveState();
      draw(true);
    }
    let mutated = false;
    const activeEnv = getActiveEnvironmentMeta();
    if (activeEnv) {
      mutated = syncActiveEnvironmentState(activeEnv);
    }
    renderEnvironmentList();
    if (mutated) {
      saveState();
      draw(true);
    }
  } catch (error) {
    console.error("Failed to load environments", error);
    envState.items = [];
    renderEnvironmentList();
  }
}

function renderEnvironmentList() {
  const listEl = document.getElementById("env-list");
  if (!listEl) return;
  if (!envState.items.length) {
    listEl.innerHTML = `<div class="env-card env-empty">Поки немає середовищ. Створи перше, щоб зберегти прогрес.</div>`;
    listEl.onclick = null;
    return;
  }

  listEl.innerHTML = envState.items
    .map((env) => {
      const updated = env.updated_at
        ? new Date(env.updated_at).toLocaleString("uk-UA", {
            dateStyle: "medium",
            timeStyle: "short",
          })
        : "—";
      const total = Number(env.total_steps || 30);
      const progress = total
        ? Math.min(100, Math.round(((env.current_step || 0) / total) * 100))
        : 0;
      return `
        <article class="env-card" data-env-id="${env.id}">
          <div class="env-card-header">
            <div class="env-card-title">${env.title || "Без назви"}</div>
            <div class="env-card-step">Крок ${env.current_step ?? 1}</div>
            <button type="button" class="env-card-delete" data-delete-env="${env.id}" title="Видалити середовище">Видалити</button>
          </div>
          <div class="env-card-meta">
            <span>Оновлено: ${updated}</span>
          </div>
          <div class="env-card-progress">
            <span class="env-card-progress-bar" style="width:${progress}%"></span>
          </div>
        </article>
      `;
    })
    .join("");

  listEl.onclick = (event) => {
    const deleteBtn = event.target.closest("[data-delete-env]");
    if (deleteBtn) {
      const envId = Number(deleteBtn.dataset.deleteEnv);
      if (envId) deleteEnvironment(envId);
      return;
    }
    const card = event.target.closest(".env-card");
    if (!card) return;
    const envId = Number(card.dataset.envId);
    if (envId) {
      enterEnvironment(envId);
    }
  };
}

function updateEnvironmentCache(updatedEnv) {
  if (!updatedEnv?.id) return;
  const idx = envState.items.findIndex((env) => env.id === updatedEnv.id);
  if (idx >= 0) {
    envState.items[idx] = { ...envState.items[idx], ...updatedEnv };
  } else {
    envState.items = [...envState.items, updatedEnv];
  }
  renderEnvironmentList();
}

async function patchEnvironment(envId, payload) {
  if (!envId) return null;
  const result = await api(`/envs/${envId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  const updated = result?.env || result;
  if (updated?.id) {
    updateEnvironmentCache(updated);
  }
  return updated;
}

async function deleteEnvironment(envId) {
  if (!envId) return;
  const env = envState.items.find((item) => item.id === envId);
  const title = env?.title || "середовище";
  if (
    !confirm(
      `Видалити «${title}»? Прогрес і локальні дані цього середовища буде втрачено.`
    )
  ) {
    return;
  }
  try {
    await api(`/envs/${envId}`, { method: "DELETE" });
    localStorage.removeItem(getEnvStorageKey(envId));
    envState.items = envState.items.filter((item) => item.id !== envId);
    if (envState.activeId === envId) {
      envState.activeId = null;
      state = structuredClone(defaultState);
      saveState();
      draw(true);
    }
    renderEnvironmentList();
    showToast("Середовище видалено.");
  } catch (error) {
    console.error("Failed to delete environment", error);
    showToast("Не вдалося видалити середовище.");
  }
}

function syncActiveEnvironmentState(envMeta = getActiveEnvironmentMeta()) {
  if (!envMeta) return false;
  let mutated = false;

  const serverStepRaw = Number(envMeta.current_step);
  if (!Number.isNaN(serverStepRaw)) {
    const serverIndex = Math.max(0, serverStepRaw - 1);
    if (serverIndex > state.currentStep) {
      state.currentStep = serverIndex;
      mutated = true;
    }
  }

  if (envMeta.bot_id) {
    const resolvedType = resolveTypeIdByBackendBotId(envMeta.bot_id);
    if (resolvedType) {
      const changed = applyBotTypeSelection(resolvedType, {
        preserveCustomCommands: true,
        resetUi: false,
      });
      if (changed) mutated = true;
    }
    botAccessCache.set(envMeta.bot_id, true);
  }

  if (envMeta.brief_locked !== undefined) {
    const custom = ensureCustomState();
    const locked = Boolean(envMeta.brief_locked);
    if (custom.briefLocked !== locked) {
      custom.briefLocked = locked;
      mutated = true;
    }
  }

  return mutated;
}

function scheduleProgressSync(immediate = false) {
  if (progressSyncTimer) {
    clearTimeout(progressSyncTimer);
    progressSyncTimer = null;
  }
  const delay = immediate ? 0 : PROGRESS_SYNC_DELAY;
  progressSyncTimer = setTimeout(() => {
    progressSyncTimer = null;
    runProgressSync();
  }, delay);
}

async function runProgressSync() {
  if (progressSyncInFlight) {
    pendingProgressSync = true;
    return;
  }
  progressSyncInFlight = true;
  try {
    await syncEnvironmentProgress();
    await syncBotProgress();
  } finally {
    progressSyncInFlight = false;
    if (pendingProgressSync) {
      pendingProgressSync = false;
      runProgressSync();
    }
  }
}

async function syncEnvironmentProgress() {
  if (!window.currentUser) return;
  const envId = envState.activeId;
  if (!envId) return;
  const envMeta = getActiveEnvironmentMeta();
  const currentStepNumber = state.currentStep + 1;
  const payload = {};

  if (!envMeta || envMeta.current_step !== currentStepNumber) {
    payload.current_step = currentStepNumber;
  }

  const maxReached = Math.max(envMeta?.max_step_reached || 0, currentStepNumber);
  if (!envMeta || envMeta.max_step_reached !== maxReached) {
    payload.max_step_reached = maxReached;
  }

  if (!Object.keys(payload).length) return;

  try {
    await patchEnvironment(envId, payload);
  } catch (error) {
    console.warn("Failed to sync environment progress", error);
  }
}

async function syncBotProgress() {
  if (!window.currentUser) return;
  const backendId = getBackendIdByType(state.choices.botType);
  if (!backendId) return;
  try {
    await api(`/bots/${backendId}/progress`, {
      method: "POST",
      body: JSON.stringify({
        step: Math.max(1, state.currentStep + 1),
      }),
    });
  } catch (error) {
    console.warn("Failed to sync bot progress", error);
  }
}

function needsBotAccess(targetIndex) {
  if (isAdmin()) return false;
  const guardIndex = steps.findIndex((step) => step.id === "bot-type");
  if (guardIndex === -1) return false;
  return targetIndex > guardIndex;
}

async function ensureAccessForCurrentBot() {
  if (!window.currentUser) {
    showToast("Увійди, щоб продовжити.");
    showLoginScreen();
    return false;
  }
  if (isAdmin()) return true;
  const typeId = state.choices.botType;
  if (!typeId) {
    showToast("Спочатку обери тип бота.");
    return false;
  }
  const backendId = getBackendIdByType(typeId);
  if (!backendId) {
    showToast("Для цього бота ще немає даних. Спробуй пізніше.");
    return false;
  }
  if (botAccessCache.get(backendId)) {
    return true;
  }
  try {
    const access = await api(`/bots/${backendId}/access`, { method: "GET" });
    if (access?.hasAccess) {
      botAccessCache.set(backendId, true);
      return true;
    }
  } catch (error) {
    console.warn("Failed to verify bot access", error);
  }
  showToast("Оплати або активуй бота перед тим, як продовжити.");
  return false;
}

function enterEnvironment(envId) {
  envState.activeId = envId;
  if (envId) {
    localStorage.setItem(ACTIVE_ENV_KEY, String(envId));
  } else {
    localStorage.removeItem(ACTIVE_ENV_KEY);
  }
  state = loadState(envId);
  const envMeta = envState.items.find((env) => env.id === envId);
  syncActiveEnvironmentState(envMeta);
  saveState();
  draw(true);
  hideEnvScreen();
  showToast("Середовище активовано.");
}

function showEnvScreen() {
  const envScreen = document.getElementById("env-screen");
  const wizard = document.getElementById("wizard-root");
  if (envScreen) envScreen.hidden = false;
  if (wizard) wizard.hidden = true;
}

function hideEnvScreen() {
  const envScreen = document.getElementById("env-screen");
  const wizard = document.getElementById("wizard-root");
  if (envScreen) envScreen.hidden = true;
  if (wizard) wizard.hidden = false;
}

function promptEnvironmentSelection(force = false) {
  if (!window.currentUser) return;
  if (force) {
    envSelectionShown = true;
    showEnvScreen();
    return;
  }
  if (!envSelectionShown && !envState.activeId) {
    envSelectionShown = true;
    showEnvScreen();
  }
}

function toggleAdminPanel(force) {
  const panel = document.getElementById("admin-panel");
  if (!panel) return;
  const shouldShow =
    typeof force === "boolean" ? force : panel.hidden !== false;
  if (shouldShow) {
    panel.hidden = false;
    renderAdminPanel();
  } else {
    panel.hidden = true;
  }
}

async function createEnvironmentPrompt() {
  const title = prompt("Назва середовища", "Мій бот");
  if (!title) return;
  try {
    const res = await api("/envs", {
      method: "POST",
      body: JSON.stringify({ title }),
    });
    const created = res?.env || res;
    await loadEnvironments();
    if (created?.id) {
      enterEnvironment(created.id);
    }
  } catch (error) {
    console.error("Failed to create environment", error);
    showToast("Не вдалося створити середовище", "error");
  }
}

async function loadAdminData() {
  if (!isAdmin()) return;
  try {
    const [overview, users, bots, settings] = await Promise.all([
      api("/admin/analytics/overview", { method: "GET" }),
      api("/admin/users", { method: "GET" }),
      api("/admin/bots", { method: "GET" }),
      api("/admin/settings", { method: "GET" }),
    ]);
    adminState.overview = overview || null;
    adminState.users = Array.isArray(users?.users)
      ? users.users
      : Array.isArray(users)
      ? users
      : [];
    adminState.bots = Array.isArray(bots?.bots)
      ? bots.bots
      : Array.isArray(bots)
      ? bots
      : [];
    adminState.settings = settings?.settings || {};
    adminState.selectedUserId = null;
    adminState.userAnalytics = null;
    adminState.userPurchases = [];
    renderAdminPanel();
  } catch (error) {
    console.error("Failed to load admin data", error);
  }
}

async function loadUserAnalytics(userId) {
  if (!userId || !isAdmin()) return;
  try {
    const [analytics, purchases] = await Promise.all([
      api(`/admin/users/${userId}/analytics`, {
        method: "GET",
      }),
      api(`/admin/users/${userId}/purchases`, {
        method: "GET",
      }),
    ]);
    adminState.selectedUserId = userId;
    adminState.userAnalytics = analytics || null;
    adminState.userPurchases = Array.isArray(purchases?.purchases)
      ? purchases.purchases
      : Array.isArray(purchases)
      ? purchases
      : [];
    renderAdminPanel();
  } catch (error) {
    console.error("Failed to load user analytics", error);
  }
}

async function handleAdminSettingUpdate(key, value) {
  if (!isAdmin() || !key) return;
  try {
    await api("/admin/settings", {
      method: "POST",
      body: JSON.stringify({ key, value: String(value) }),
    });
    adminState.settings = { ...adminState.settings, [key]: String(value) };
    showToast("Налаштування збережені.");
    renderAdminPanel();
  } catch (error) {
    console.error("Failed to update setting", error);
    showToast("Не вдалося зберегти налаштування.");
  }
}

async function handleAdminBotSave(botId, row) {
  if (!isAdmin() || !botId || !row) return;
  const payload = {};
  const getValue = (name) =>
    row.querySelector(`[data-field="${name}"]`);
  const nameInput = getValue("name");
  if (nameInput) payload.name = nameInput.value.trim();
  const descInput = getValue("description");
  if (descInput) payload.description = descInput.value.trim();
  const priceInput = getValue("price");
  if (priceInput) {
    const val = parseFloat(priceInput.value);
    if (!Number.isNaN(val)) payload.price = val;
  }
  const currencyInput = getValue("currency");
  if (currencyInput) payload.currency = currencyInput.value.trim().toUpperCase();
  const isFreeInput = getValue("is_free");
  if (isFreeInput) payload.is_free = isFreeInput.checked;
  const isActiveInput = getValue("is_active");
  if (isActiveInput) payload.is_active = isActiveInput.checked;
  const stepsInput = getValue("total_steps");
  if (stepsInput) {
    const stepsVal = parseInt(stepsInput.value, 10);
    if (!Number.isNaN(stepsVal)) payload.total_steps = stepsVal;
  }
  try {
    await api(`/admin/bots/${botId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    showToast("Бота оновлено.");
    await loadAdminData();
  } catch (error) {
    console.error("Failed to update bot", error);
    showToast("Не вдалося зберегти зміни бота.");
  }
}

async function handleAdminMarkPaid(purchaseId) {
  if (!isAdmin() || !purchaseId) return;
  try {
    await api(`/admin/purchases/${purchaseId}/mark-paid`, {
      method: "POST",
    });
    showToast("Оплату позначено як успішну.");
    if (adminState.selectedUserId) {
      await loadUserAnalytics(adminState.selectedUserId);
    }
  } catch (error) {
    console.error("Failed to mark purchase paid", error);
    showToast("Не вдалося оновити покупку.");
  }
}

async function handleAdminResetProgress(userId, botId) {
  if (!isAdmin() || !userId || !botId) return;
  try {
    await api(`/admin/users/${userId}/reset-progress`, {
      method: "POST",
      body: JSON.stringify({ botId }),
    });
    showToast("Прогрес скинуто.");
    await loadUserAnalytics(userId);
  } catch (error) {
    console.error("Failed to reset progress", error);
    showToast("Не вдалося скинути прогрес.");
  }
}

function renderAdminPanel() {
  const panel = document.getElementById("admin-panel");
  if (!panel) return;
  if (!isAdmin()) {
    panel.hidden = true;
    panel.innerHTML = "";
    return;
  }
  panel.hidden = false;

  const overview = adminState.overview || {};
  const revenueChips = (overview.totalRevenueByCurrency || [])
    .map(
      (item) =>
        `<span class="admin-chip">${item.currency}: ${Number(
          item.total || 0
        ).toFixed(2)}</span>`
    )
    .join("");

  const botsStatsRows =
    overview.botsStats && overview.botsStats.length
      ? overview.botsStats
          .map(
            (stat) => `
        <tr>
          <td>${escapeHtml(stat.name || stat.code || "—")}</td>
          <td>${stat.envCount ?? 0}</td>
          <td>${stat.paidUsers ?? 0}</td>
          <td>${
            stat.price !== undefined && stat.price !== null
              ? `${Number(stat.price).toFixed(2)} ${stat.currency || ""}`
              : "—"
          }</td>
          <td>${
            stat.revenueByCurrency && stat.revenueByCurrency.length
              ? stat.revenueByCurrency
                  .map(
                    (entry) =>
                      `${entry.currency || ""} ${Number(entry.total || 0).toFixed(
                        2
                      )}`
                  )
                  .join("<br>")
              : "—"
          }</td>
        </tr>`
          )
          .join("")
      : `<tr><td colspan="5">Ще немає даних по ботах.</td></tr>`;

  const paymentsEnabled =
    String(adminState.settings?.payments_enabled ?? "true") !== "false";

  const botsCrudRows = adminState.bots.length
    ? adminState.bots
        .map((bot) => {
          return `
        <tr data-bot-row="${bot.id}">
          <td>${bot.id}</td>
          <td>${escapeHtml(bot.code)}</td>
          <td><input type="text" data-field="name" value="${escapeHtml(
            bot.name || ""
          )}" /></td>
          <td><input type="text" data-field="description" value="${escapeHtml(
            bot.description || ""
          )}" /></td>
          <td><input type="number" step="0.01" data-field="price" value="${
            bot.price ?? 0
          }" /></td>
          <td><input type="text" data-field="currency" value="${escapeHtml(
            bot.currency || ""
          )}" /></td>
          <td><input type="number" min="0" data-field="total_steps" value="${
            bot.total_steps ?? 0
          }" /></td>
          <td>
            <label class="admin-switch">
              <input type="checkbox" data-field="is_free" ${
                bot.is_free ? "checked" : ""
              } />
              <span>Free</span>
            </label>
          </td>
          <td>
            <label class="admin-switch">
              <input type="checkbox" data-field="is_active" ${
                bot.is_active ? "checked" : ""
              } />
              <span>Active</span>
            </label>
          </td>
          <td>
            <button type="button" class="ghost admin-bot-save" data-bot-id="${
              bot.id
            }">Зберегти</button>
          </td>
        </tr>
      `;
        })
        .join("")
    : `<tr><td colspan="10">Ще немає ботів у базі.</td></tr>`;

  const usersTable = (adminState.users || [])
    .map(
      (user) => `
        <tr>
          <td>${user.id}</td>
          <td>${user.full_name || "—"}</td>
          <td>${user.phone || "—"}</td>
          <td>${user.email || "—"}</td>
          <td>${user.created_at || "—"}</td>
          <td><button type="button" class="admin-user-details" data-user-id="${user.id}">Детальніше</button></td>
        </tr>
      `
    )
    .join("");

  const supportRows = (adminState.supportTickets || []).length
    ? adminState.supportTickets
        .map((ticket) => {
          const created = ticket.createdAt
            ? new Date(ticket.createdAt).toLocaleString("uk-UA")
            : "—";
          const contact = ticket.contact || ticket.user?.phone || ticket.user?.email || "—";
          const userName =
            ticket.user?.name ||
            (ticket.user?.email ? `Користувач ${ticket.user.email}` : "Анонім");
          return `
            <tr>
              <td>${ticket.id}</td>
              <td>${userName}</td>
              <td>${escapeHtml(ticket.user?.email || "—")}</td>
              <td>${escapeHtml(ticket.user?.phone || "—")}</td>
              <td>${escapeHtml(contact)}</td>
              <td>${escapeHtml(ticket.problem || "").slice(0, 140)}</td>
              <td>${ticket.status || "open"}</td>
              <td>${created}</td>
            </tr>
          `;
        })
        .join("")
    : `<tr><td colspan="8">Звернень поки немає.</td></tr>`;

  let userDetails = "<p>Оберіть користувача, щоб переглянути статистику.</p>";
  if (adminState.userAnalytics) {
    const info = adminState.userAnalytics;
    const revenue =
      info.revenueByCurrency && info.revenueByCurrency.length
        ? info.revenueByCurrency
            .map(
              (item) =>
                `<span class="admin-chip">${item.currency}: ${Number(
                  item.total || 0
                ).toFixed(2)}</span>`
            )
            .join("")
        : '<span class="admin-chip admin-chip--muted">Ще немає оплат</span>';

    const envRows =
      info.envs && info.envs.length
        ? info.envs
            .map(
              (env) => `
          <tr>
            <td>${env.title || "Без назви"}</td>
            <td>${env.botName || env.botCode || "—"}</td>
            <td>${env.currentStep ?? 0}</td>
            <td>${new Date(env.updatedAt || env.updated_at || "").toLocaleString(
              "uk-UA"
            )}</td>
          </tr>`
            )
            .join("")
        : `<tr><td colspan="4">Середовищ ще нема.</td></tr>`;

    const botRows =
      info.botsBreakdown && info.botsBreakdown.length
        ? info.botsBreakdown
            .map(
              (bot) => `
          <tr>
            <td>${bot.botName || bot.botCode || "—"}</td>
            <td>${bot.paidPurchases ?? 0}</td>
            <td>${Number(bot.totalAmount || 0).toFixed(2)}</td>
          </tr>`
            )
            .join("")
        : `<tr><td colspan="3">Оплат ще нема.</td></tr>`;

    const purchasesRows = adminState.userPurchases.length
      ? adminState.userPurchases
          .map(
            (purchase) => `
            <tr>
              <td>${purchase.id}</td>
              <td>${purchase.bot_id ?? "—"}</td>
              <td>${Number(purchase.amount || 0).toFixed(2)} ${
              purchase.currency || ""
            }</td>
              <td>${purchase.status}</td>
              <td>${
                purchase.created_at
                  ? new Date(purchase.created_at).toLocaleString("uk-UA")
                  : "—"
              }</td>
              <td>
                ${
                  purchase.status === "paid"
                    ? "-"
                    : `<button type="button" class="ghost admin-purchase-mark" data-purchase-id="${purchase.id}">Mark paid</button>`
                }
              </td>
            </tr>`
          )
          .join("")
      : `<tr><td colspan="6">Ще немає покупок.</td></tr>`;

    const resetOptions = adminState.bots
      .map(
        (bot) =>
          `<option value="${bot.id}">${escapeHtml(bot.name || bot.code)}</option>`
      )
      .join("");

    userDetails = `
      <div class="admin-user-analytics">
        <header>
          <div class="admin-user-meta">
            <h4>${info.user?.full_name || "Користувач"} (ID ${info.user?.id})</h4>
            <p>
              ${info.user?.email || "—"}
              ${
                info.user?.phone
                  ? ` • ${info.user.phone}`
                  : ""
              }
              • Середовищ: ${info.totalEnvs} • Оплат: ${info.totalPaidPurchases}
            </p>
          </div>
          <div class="admin-chip-row">
            ${revenue}
          </div>
        </header>
        <div class="admin-user-analytics-grid">
          <div class="admin-table-card">
            <h5>Середовища</h5>
            <div class="admin-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Назва</th>
                    <th>Бот</th>
                    <th>Крок</th>
                    <th>Оновлено</th>
                  </tr>
                </thead>
                <tbody>${envRows}</tbody>
              </table>
            </div>
          </div>
          <div class="admin-table-card">
            <h5>Оплати за ботами</h5>
            <div class="admin-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Бот</th>
                    <th>Кількість</th>
                    <th>Сума</th>
                  </tr>
                </thead>
                <tbody>${botRows}</tbody>
              </table>
            </div>
          </div>
          <div class="admin-table-card">
            <h5>Покупки</h5>
            <div class="admin-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Бот</th>
                    <th>Сума</th>
                    <th>Статус</th>
                    <th>Створено</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>${purchasesRows}</tbody>
              </table>
            </div>
          </div>
          <div class="admin-table-card">
            <h5>Скидання прогресу</h5>
            <form data-admin-reset data-user-id="${info.user?.id || ""}">
              <label>
                Бот
                <select name="botId" required>
                  <option value="">Оберіть бота</option>
                  ${resetOptions}
                </select>
              </label>
              <button type="submit" class="ghost">Скинути прогрес</button>
            </form>
          </div>
        </div>
      </div>
    `;
  }

  panel.innerHTML = `
    <div class="admin-analytics">
      <div class="admin-analytics-card">
        <span class="admin-analytics-label">Користувачів</span>
        <strong>${overview.totalUsers ?? 0}</strong>
      </div>
      <div class="admin-analytics-card">
        <span class="admin-analytics-label">Оплат</span>
        <strong>${overview.totalPaidPurchases ?? 0}</strong>
      </div>
    </div>
    <div class="admin-analytics-revenue">
      <span>Дохід:</span>
      <div class="admin-chip-row">
        ${revenueChips || '<span class="admin-chip admin-chip--muted">Ще немає</span>'}
      </div>
    </div>
    <div class="admin-table-card">
      <h5>Статистика ботів</h5>
      <div class="admin-table-scroll">
        <table>
          <thead>
            <tr>
              <th>Бот</th>
              <th>Середовищ</th>
              <th>Оплачено</th>
              <th>Базова ціна</th>
              <th>Дохід</th>
            </tr>
          </thead>
          <tbody>${botsStatsRows}</tbody>
        </table>
      </div>
    </div>
    <div class="admin-settings-card">
      <div>
        <h5>Оплати WayForPay</h5>
        <p>У вимкненому режимі всі боти поводяться як безкоштовні.</p>
      </div>
      <label class="admin-switch">
        <input type="checkbox" data-setting="payments_enabled" ${
          paymentsEnabled ? "checked" : ""
        } />
        <span>${paymentsEnabled ? "Увімкнено" : "Вимкнено"}</span>
      </label>
    </div>
    <div class="admin-table-card">
      <h5>Боти</h5>
      <div class="admin-table-scroll">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Код</th>
              <th>Назва</th>
              <th>Опис</th>
              <th>Ціна</th>
              <th>Валюта</th>
              <th>Кроків</th>
              <th>Free</th>
              <th>Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${botsCrudRows}</tbody>
        </table>
      </div>
    </div>
    <div class="admin-table-card">
      <h5>Користувачі</h5>
      <div class="admin-table-scroll">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Імʼя</th>
              <th>Телефон</th>
              <th>Email</th>
              <th>Створено</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${usersTable}</tbody>
        </table>
      </div>
    </div>
    <div class="admin-table-card">
      <h5>Звернення підтримки</h5>
      <div class="admin-table-scroll">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Імʼя</th>
              <th>Email</th>
              <th>Телефон</th>
              <th>Контакт</th>
              <th>Проблема</th>
              <th>Статус</th>
              <th>Створено</th>
            </tr>
          </thead>
          <tbody>${supportRows}</tbody>
        </table>
      </div>
    </div>
    <div class="admin-table-card">
      <h5>Логіка кроків (локальний JSON)</h5>
      <div class="admin-logic-controls">
        <label>Бот:
          <select id="logic-bot">
            ${BOT_TYPES.map(
              (b) =>
                `<option value="${b.id}" ${
                  logicKey.botType === b.id ? "selected" : ""
                }>${escapeHtml(b.title)}</option>`
            ).join("")}
          </select>
        </label>
        <label>Режим:
          <select id="logic-mode">
            ${MODE_OPTIONS.map(
              (m) =>
                `<option value="${m.id}" ${
                  logicKey.mode === m.id ? "selected" : ""
                }>${escapeHtml(m.title)}</option>`
            ).join("")}
          </select>
        </label>
        <label>Середовище:
          <select id="logic-env">
            ${ENVIRONMENTS.map(
              (e) =>
                `<option value="${e.id}" ${
                  logicKey.environment === e.id ? "selected" : ""
                }>${escapeHtml(e.title)}</option>`
            ).join("")}
          </select>
        </label>
        <button type="button" class="ghost" id="logic-reset">Скинути зміни</button>
        <div class="admin-chip-row">
          <span class="admin-chip">Поточний ключ: ${escapeHtml(
            logicKeyStr
          )}</span>
          <span class="admin-chip admin-chip--muted">Кастомний порядок: ${
            overrideOrder.length ? "так" : "ні"
          }</span>
        </div>
      </div>
      <div class="admin-table-scroll">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Секція</th>
              <th>Назва кроку (редагується)</th>
              <th>Порядок</th>
            </tr>
          </thead>
          <tbody id="admin-logic-steps">${stepRows}</tbody>
        </table>
      </div>
      <div class="admin-logic-actions">
        <button type="button" class="primary" id="logic-save">Зберегти у JSON (локально)</button>
      </div>
    </div>
    <div class="admin-table-card">
      <h5>Мапа логіки</h5>
      <div class="admin-mindmap">
        <ul>${mindmapNodes}</ul>
      </div>
    </div>
    ${userDetails}
  `;
}

function ensureAdminPanelBindings() {
  const panel = document.getElementById("admin-panel");
  if (!panel || panel.dataset.bound) return;
  panel.dataset.bound = "true";
  panel.addEventListener("click", onAdminPanelClick);
  panel.addEventListener("change", onAdminPanelChange);
  panel.addEventListener("submit", onAdminPanelSubmit);
  panel.addEventListener("click", onAdminLogicClick);
  panel.addEventListener("change", onAdminLogicChange);
}

function onAdminPanelClick(event) {
  const userBtn = event.target.closest(".admin-user-details");
  if (userBtn) {
    const userId = Number(userBtn.dataset.userId);
    if (userId) loadUserAnalytics(userId);
    return;
  }
  const botSave = event.target.closest(".admin-bot-save");
  if (botSave) {
    const botId = Number(botSave.dataset.botId);
    const row = botSave.closest("tr[data-bot-row]");
    if (botId && row) handleAdminBotSave(botId, row);
    return;
  }
  const markPaid = event.target.closest(".admin-purchase-mark");
  if (markPaid) {
    const purchaseId = Number(markPaid.dataset.purchaseId);
    if (purchaseId) handleAdminMarkPaid(purchaseId);
  }
}

function onAdminPanelChange(event) {
  const settingInput = event.target.closest("[data-setting]");
  if (settingInput) {
    const key = settingInput.dataset.setting;
    const value =
      settingInput.type === "checkbox"
        ? settingInput.checked
        : settingInput.value;
    handleAdminSettingUpdate(key, value);
  }
}

function onAdminPanelSubmit(event) {
  if (!event.target.matches("[data-admin-reset]")) return;
  event.preventDefault();
  const form = event.target;
  const userId = Number(form.dataset.userId);
  const botId = Number(form.elements.botId?.value);
  if (userId && botId) {
    handleAdminResetProgress(userId, botId);
  } else {
    showToast("Оберіть бота для скидання.");
  }
}

function onAdminLogicChange(event) {
  const botSelect = document.getElementById("logic-bot");
  const modeSelect = document.getElementById("logic-mode");
  const envSelect = document.getElementById("logic-env");
  if (!botSelect || !modeSelect || !envSelect) return;
  if (
    event.target === botSelect ||
    event.target === modeSelect ||
    event.target === envSelect
  ) {
    state.choices.botType = botSelect.value;
    state.choices.mode = modeSelect.value;
    state.choices.environment = envSelect.value;
    saveState();
    renderAdminPanel();
  }
}

function onAdminLogicClick(event) {
  const saveBtn = event.target.closest("#logic-save");
  const resetBtn = event.target.closest("#logic-reset");
  const stepUp = event.target.closest(".admin-step-up");
  const stepDown = event.target.closest(".admin-step-down");
  const botSelect = document.getElementById("logic-bot");
  const modeSelect = document.getElementById("logic-mode");
  const envSelect = document.getElementById("logic-env");
  const tbody = document.getElementById("admin-logic-steps");
  if (!botSelect || !modeSelect || !envSelect || !tbody) return;

  const key = [
    botSelect.value || "none",
    modeSelect.value || "chatgpt",
    envSelect.value || "local",
  ].join("|");
  const rows = Array.from(tbody.querySelectorAll("tr[data-step-id]"));

  const readState = () => {
    const order = rows.map((r) => r.dataset.stepId);
    const titles = {};
    rows.forEach((r) => {
      const titleEl = r.querySelector("[data-step-title]");
      if (titleEl) titles[r.dataset.stepId] = titleEl.textContent.trim();
    });
    return { order, titles };
  };

  const writeState = (data) => {
    stepOverrides[key] = data;
    saveStepOverrides();
    renderAdminPanel();
  };

  if (saveBtn) {
    const current = readState();
    writeState(current);
    showToast("Збережено локальний JSON для кроків.");
    return;
  }
  if (resetBtn) {
    delete stepOverrides[key];
    saveStepOverrides();
    renderAdminPanel();
    showToast("Скинуто зміни для цього ключа.");
    return;
  }
  if (stepUp || stepDown) {
    const row = (stepUp || stepDown).closest("tr");
    const idx = rows.indexOf(row);
    if (idx === -1) return;
    if (stepUp && idx > 0) {
      tbody.insertBefore(row, rows[idx - 1]);
    } else if (stepDown && idx < rows.length - 1) {
      tbody.insertBefore(rows[idx + 1], row);
    }
  }
}

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
  elements.stepBody.innerHTML = "";
  step.render(elements.stepBody);
  renderStepDetails(elements.stepBody, step.id);

  const progress = ((state.currentStep + 1) / steps.length) * 100;
  if (elements.progressInner) {
    elements.progressInner.style.width = `${progress}%`;
  }
  if (elements.progressLabel) {
    elements.progressLabel.textContent = `${state.currentStep + 1} / ${
      steps.length
    }`;
  }

  elements.prev.disabled = state.currentStep === 0;
  const hideNext = shouldHideNextButton(step);
  if (elements.next) {
    elements.next.textContent =
      state.currentStep === steps.length - 1 ? "Завершити" : "Далі ➡️";
    elements.next.hidden = !!hideNext;
  }
  if (elements.footer) {
    elements.footer.style.display = step.hideNav ? "none" : "";
  }
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
    if (isCustomBot(state)) {
      const customStart = steps.findIndex(
        (step) => step.id === "custom-requirements"
      );
      if (customStart >= 0) {
        state.currentStep = customStart;
        return;
      }
    }
  }
  state.currentStep = Math.min(state.currentStep, steps.length - 1);
}

function shouldHideNextButton(step) {
  if (!step) return false;
  if (step.id === "bot-type" && !isAdmin()) {
    return true;
  }
  return false;
}

function updateJumpControls() {
  if (!elements.jumpSelect || !elements.jumpButton) return;

  const select = elements.jumpSelect;
  const button = elements.jumpButton;
  const previousValue = select.value;

  select.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Повернутися до кроку";
  placeholder.disabled = true;
  placeholder.selected = true;
  select.appendChild(placeholder);

  steps.forEach((step) => {
    const option = document.createElement("option");
    option.value = step.id;
    option.textContent = `Крок ${step.number}. ${step.title}`;
    select.appendChild(option);
  });

  const availableValues = new Set(steps.map((step) => step.id));
  if (availableValues.has(previousValue)) {
    select.value = previousValue;
  } else {
    select.value = "";
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
  const extraModules = ensureExtraModules(currentState);
  ensureExtraModuleData(currentState);

  // I. Старт
  result.push(
    createStep("start", "I. Старт", "Привітання", renderStartStep, {
      hideNav: true,
    })
  );
  result.push(
    createStep("bot-type", "I. Старт", "Вибір типу бота", renderBotTypeStep)
  );
  result.push(
    createStep("mode", "I. Старт", "Вибір режиму ШІ", renderModeStep)
  );
  result.push(
    createStep(
      "environment",
      "I. Старт",
      "Вибір середовища",
      renderEnvironmentStep
    )
  );
  result.push(
    createStep("tools", "I. Старт", "Перевірка інструментів", renderToolsStep)
  );

// II. Підготовка проєкту
  result.push(
  createStep(
    "folder",
    "II. Підготовка проєкту",
    "Створення робочого середовища",
    (container) => {
      const env = state.choices.environment; // 'local' або 'codespaces'

      if (env === "codespaces") {
        // Codespaces варіант без додаткових списків
        renderInfo(container, [
          "Ти у Codespaces — код, git і Python вже готові. Працюй у веб-VS Code.",
        ]);
      } else {
        // LOCAL як було
        renderInfo(
          container,
          [
            "• Створи папку `mybot` у себе на компʼютері.",
            "• Відкрий її у редакторі (VS Code)."
          ],
          "Мета: мати чисте місце для файлів бота."
        );

        renderInfo(container, [
          "Git локально:",
          "• Якщо ще не ініціалізовано: у терміналі в цій папці виконай `git init` та додай remote: `git remote add origin https://github.com/username/repo.git`.",
          "• Перевір зміни `git status`, додай файли `git add .`, коміть `git commit -m \"Init bot\"`, пуш `git push origin main`.",
          "• Робіть коміт після логічних блоків: 1) базова структура + requirements.txt + .env.example, 2) перша версія main.py, 3) додаткові модулі/фічі.",
          "• Якщо гілки ще немає на GitHub, виконай `git push --set-upstream origin main`.",
        ]);
      }
    }
  )
);
  result.push(
    createStep(
      "git-workflow",
      "II. Підготовка проєкту",
      "Git та коміти",
      renderGitWorkflowStep
    )
  );



  if (customBot) {
    result.push(
      createStep(
        "custom-requirements",
        "II. Підготовка проєкту",
        "Опис кастомного бота",
        renderCustomRequirementsStep
      )
    );
    result.push(
      createStep(
        "custom-brief-prompt",
        "II. Підготовка проєкту",
        "Промпт для брифу",
        renderCustomBriefPromptStep
      )
    );
    result.push(
      createStep(
        "custom-brief-import",
        "II. Підготовка проєкту",
        "Збереження брифу",
        renderCustomBriefInputStep
      )
    );
    result.push(
      createStep(
        "custom-files",
        "III. Файли",
        "Файли проєкту",
        renderCustomFilesStep
      )
    );
    result.push(
      createStep(
        "custom-terminal",
        "IV. Запуск",
        "Команди для терміналу",
        renderCustomTerminalStep
      )
    );
    result.push(
      createStep(
        "custom-diagnostics",
        "IV. Запуск",
        "Діагностика помилок",
        renderCustomDiagnosticsStep
      )
    );
  } else {
    result.push(
      createStep(
        "main-file",
        "II. Підготовка проєкту",
        `Створення ${entryFile}`,
        (c) =>
          renderInfo(c, [
            `• Створи файл \`${entryFile}\` у корені.`,
            "• Поки залиш порожнім — код додамо далі.",
          ])
      )
    );
    result.push(
      createStep(
        "file-structure",
        "II. Підготовка проєкту",
        "Структура файлів",
        renderFileStructureStep
      )
    );
    result.push(
      createStep(
        "dev-brief",
        "II. Підготовка проєкту",
        "DEV BRIEF",
        renderDevBriefStep
      )
    );
    result.push(
      createStep(
        "code-prompt",
        "II. Підготовка проєкту",
        "Промпт для коду",
        renderCodePromptStep
      )
    );
    result.push(
      createStep(
        "requirements",
        "II. Підготовка проєкту",
        "Створення requirements.txt",
        renderRequirementsStep
      )
    );
    result.push(
      createStep(
        "env-file",
        "II. Підготовка проєкту",
        "Створення .env",
        renderEnvStep
      )
    );
    result.push(
      createStep(
        "botfather-create",
        "II. Підготовка проєкту",
        "Створення бота у BotFather",
        renderBotfatherCreateStep
      )
    );
  }

  // III. База даних
  result.push(
    createStep(
      "backend-explain",
      "III. База даних",
      "Пояснення від панелі",
      (c) =>
        renderInfo(c, [
          "• Без зберігання бот “забуває” все після перезапуску.",
          "• Обери один варіант і доведи його до тесту.",
        ])
    )
  );
  result.push(
    createStep(
      "backend-choice",
      "III. База даних",
      "Вибір типу зберігання",
      renderBackendChoiceStep
    )
  );
  result.push(
    createStep(
      "backend-confirm",
      "III. База даних",
      "Підтвердження вибору",
      renderBackendConfirmStep
    )
  );

  const backend = BACKEND_OPTIONS.find(
    (option) => option.id === currentState.choices.backend
  );
  if (backend) {
    backend.steps.forEach((step, index) => {
      result.push(
        createStep(
          `backend-${backend.id}-${index}`,
          "III. База даних",
          step.text.split(".")[0],
          (c) => renderBackendStep(c, backend, step, index)
        )
      );
    });
  }

  // IV. Дизайн
  if (customBot) {
    result.push(
      createStep(
        "design-reply",
        "IV. Дизайн",
        "Головне меню (Reply-кнопки)",
        renderCustomReplyStep
      )
    );
    result.push(
      createStep(
        "design-inline",
        "IV. Дизайн",
        "Inline-кнопки",
        renderCustomInlineStep
      )
    );
  } else {
    result.push(
      createStep("design-overview", "IV. Дизайн", DESIGN_STEPS[0].title, (c) =>
        renderInfo(c, DESIGN_STEPS[0].items)
      )
    );
    result.push(
      createStep(
        "design-reply",
        "IV. Дизайн",
        "Головне меню (Reply-кнопки)",
        renderPresetReplyStep
      )
    );
    result.push(
      createStep(
        "design-inline",
        "IV. Дизайн",
        "Inline-кнопки",
        renderPresetInlineStep
      )
    );
    result.push(
      createStep("design-copy", "IV. Дизайн", DESIGN_STEPS[3].title, (c) =>
        renderInfo(c, DESIGN_STEPS[3].items)
      )
    );
  }

  // V. Статистика
  if (customBot) {
    if (customBriefHasCommand("/stats")) {
      result.push(
        createStep(
          "stats-commands",
          "V. Статистика",
          STATS_STEPS[0].title,
          (c) => renderInfo(c, STATS_STEPS[0].items)
        )
      );
      result.push(
        createStep("stats-report", "V. Статистика", STATS_STEPS[1].title, (c) =>
          renderInfo(c, STATS_STEPS[1].items)
        )
      );
    }
    if (customBriefHasReminder()) {
      result.push(
        createStep(
          "stats-reminder",
          "V. Статистика",
          STATS_STEPS[2].title,
          (c) => renderInfo(c, STATS_STEPS[2].items)
        )
      );
    }
  } else {
    STATS_STEPS.forEach((item, index) => {
      result.push(
        createStep(`stats-${index}`, "V. Статистика", item.title, (c) =>
          renderInfo(c, item.items)
        )
      );
    });
  }

  // VI. Оплати
  result.push(
    createStep(
      "payments-choice",
      "VI. Оплати",
      "Вибір системи оплати",
      renderPaymentsChoiceStep
    )
  );
  result.push(
    createStep(
      "payments-prep",
      "VI. Оплати",
      "Підготовка ключів",
      renderPaymentPrepStep
    )
  );
  const payment = PAYMENT_METHODS.find(
    (option) => option.id === currentState.choices.payment
  );
  if (payment && payment.id !== "none") {
    payment.steps.forEach((step, index) => {
      result.push(
        createStep(
          `payment-${payment.id}-${index}`,
          "VI. Оплати",
          step.text.split(".")[0],
          (c) => renderPaymentStep(c, payment.title, step)
        )
      );
    });
  }

  // VII. Запуск
  LAUNCH_STEPS.forEach((item, index) => {
    result.push(
      createStep(`launch-${index}`, "VII. Запуск", item.title, (c) =>
        renderLaunchStep(c, item)
      )
    );
  });

  // VIII. Розвиток
  result.push(
    createStep(
      "extra-modules",
      "VIII. Розвиток",
      "Додаткові модулі",
      renderExtraModulesStep
    )
  );

  EXTRA_MODULE_OPTIONS.forEach((option) => {
    if (!extraModules[option.id]) return;
    const moduleSteps = getExtraModuleStepDefinitions(option.id);
    moduleSteps.forEach((step) => {
      result.push(
        createStep(step.id, "VIII. Розвиток", step.title, step.render)
      );
    });
  });

  result.push(
    createStep(
      "botfather-commands",
      "VII. Запуск",
      "Команди в BotFather",
      renderBotfatherCommandsStep
    )
  );
  LAUNCH_STEPS.forEach((item, index) => {
    result.push(
      createStep(`launch-${index}`, "VII. Запуск", item.title, (c) =>
        renderLaunchStep(c, item)
      )
    );
  });

  result.push(
    createStep("finish", "VIII. Розвиток", FINISH_STEP.title, (c) =>
      renderInfo(c, FINISH_STEP.items)
    )
  );

  const ordered = applyStepOverrides(result, currentState);

  ordered.forEach((step, index) => {
    step.number = index + 1;
  });

  return ordered;
}

function createStep(id, section, title, renderFn, extras = {}) {
  const step = {
    id,
    section,
    title,
    render: renderFn,
    number: 0,
  };
  Object.assign(step, extras);
  return step;
}

function renderStartStep(container) {
  const block = document.createElement("div");
  block.className = "start-screen";

  const title = document.createElement("h3");
  title.textContent = "Запускаємо майстер створення власного Telegram-бота.";
  block.appendChild(title);

  const desc = document.createElement("p");
  desc.textContent =
    "Принцип: одна дія = один крок. Готові? Натисни кнопку — рухаємось.";
  block.appendChild(desc);

  const button = document.createElement("button");
  button.className = "primary";
  button.textContent = "Почати";
  button.addEventListener("click", () => {
    state.currentStep += 1;
    saveState();
    draw(true);
    scheduleProgressSync();
  });
  block.appendChild(button);

  container.appendChild(block);
}

function renderBotTypeStep(container) {
  const bots = mergedBots.length ? mergedBots : mergeBotMetadata();
  const activeEnv = getActiveEnvironmentMeta();
  const envLockedType =
    !isAdmin() && activeEnv?.bot_id
      ? resolveTypeIdByBackendBotId(activeEnv.bot_id)
      : null;
  const wrap = document.createElement("div");
  wrap.className = "bot-type-list";

  wrap.innerHTML = bots
    .map((bot) => {
      const commands = Array.isArray(bot.commands) && bot.commands.length
        ? bot.commands.join(", ")
        : "/start, /help";
      const checked = state.choices.botType === bot.id ? "checked" : "";
      const disabled =
        envLockedType && envLockedType !== bot.id ? "disabled" : "";
      const priceBlock = bot.backendId
        ? bot.isFree
          ? `<div class="bot-price-cell">
              <span class="bot-price-label">FREE</span>
              <button type="button" class="bot-type-btn" data-pay-id="${bot.backendId}">Почати (FREE)</button>
            </div>`
          : `<div class="bot-price-cell">
              <span class="bot-price-label">Ціна: ${Number(bot.price || 0).toFixed(2)} ${bot.currency || ""}</span>
              <button type="button" class="bot-type-btn" data-pay-id="${bot.backendId}">Оплатити</button>
            </div>`
        : `<div class="bot-price-cell">
            <span class="bot-price-empty">Немає даних</span>
          </div>`;

      return `
        <article class="bot-type-card">
          <div class="bot-type-main">
            <label class="bot-type-radio">
              <input type="radio" name="bot-type" value="${bot.id}" ${checked} ${disabled} />
              <span class="bot-type-title">${bot.title}</span>
            </label>
            <p class="bot-type-desc">${bot.description}</p>
            <p class="bot-type-commands">${commands}</p>
          </div>
          <div class="bot-type-pay">
            ${priceBlock}
          </div>
        </article>
      `;
    })
    .join("");

  wrap.addEventListener("change", (event) => {
    if (event.target.name === "bot-type") {
      const previous = state.choices.botType;
      const value = event.target.value;
      if (
        envLockedType &&
        envLockedType !== value &&
        !isAdmin()
      ) {
        event.target.checked = false;
        const prevInput = wrap.querySelector(
          `input[name="bot-type"][value="${previous}"]`
        );
        if (prevInput) prevInput.checked = true;
        showToast("Середовище вже привʼязане до іншого бота.");
        return;
      }
      applyBotTypeSelection(value, { forceCustomReset: true });
      saveState();
      draw(true);
    }
  });

  wrap.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-pay-id]");
    if (!btn) return;
    const backendId = Number(btn.dataset.payId);
    if (backendId) {
      handlePay(backendId);
    }
  });

  container.appendChild(wrap);

  renderInfo(container, [
    "• Обери сценарій, який найближчий до твого проєкту.",
  ]);
  if (envLockedType && !isAdmin()) {
    const notice = document.createElement("p");
    notice.className = "note-block";
    notice.textContent =
      "Це середовище вже привʼязане до конкретного бота. Створи нове середовище, щоб вибрати інший сценарій.";
    container.appendChild(notice);
  }
}

function renderModeStep(container) {
  const cards = document.createElement("div");
  cards.className = "card-grid";
  MODE_OPTIONS.forEach((option) => {
    const card = document.createElement("div");
    card.className = "card";
    if (state.choices.mode === option.id) card.classList.add("active");
    card.innerHTML = `<h3>${option.title}</h3><p>${option.description}</p>`;
    card.addEventListener("click", () => {
      state.choices.mode = option.id;
      saveState();
      draw(false);
    });
    cards.appendChild(card);
  });
  container.appendChild(cards);

  renderInfo(container, [
    "• Режим впливає на кнопки «Скопіювати для ChatGPT / Codex».",
  ]);
}

function renderEnvironmentStep(container) {
  const cards = document.createElement("div");
  cards.className = "card-grid";
  ENVIRONMENTS.forEach((env) => {
    const card = document.createElement("div");
    card.className = "card";
    if (state.choices.environment === env.id) card.classList.add("active");
    card.innerHTML = `<h3>${env.title}</h3><p>${env.description}</p>`;
    card.addEventListener("click", () => {
      state.choices.environment = env.id;
      saveState();
      if (!isCustomBot(state)) {
        showSetupOverlay({
          messages: [
            "Підлаштовуємо середовище під твого бота…",
            "Готуємо шпаргалки для терміналу…",
            "Налаштовуємо кроки під вибране середовище…",
            "Підтягуємо підказки для інсталяцій…",
          ],
        });
      }
      draw(false);
    });
    cards.appendChild(card);
  });
  container.appendChild(cards);

  renderInfo(container, ["• Вибір середовища підлаштує підказки та команди."]);
}

function renderToolsStep(container) {
  const isCodespaces = state.choices.environment === "codespaces";
  const aiTarget = getPromptAiTarget("instructions");

  if (isCodespaces) {
    const infoLines = [
      "• Увійди у свій акаунт GitHub — Codespaces працює через нього.",
      "• У репозиторії натисни «<> Code» → вкладку «Codespaces» → «Create codespace on main».",
      "• Дочекайся запуску середовища: Python, git і редактор уже встановлені, локальні інсталяції не потрібні.",
      "• Відкрий термінал у браузері (Terminal → New Terminal) та запускай команди прямо в Codespaces.",
      "• Використовуй вкладку Ports, щоб відкрити прокинуті веб-порти у новому вікні.",
    ];
    if (state.choices.mode === "codex") {
      infoLines.push(
        "• Для автодоповнення відкрий View → Extensions, встанови Codex і авторизуйся всередині Codespaces."
      );
    }
    renderInfo(container, infoLines);
  } else {
    renderInfo(
      container,
      [
        "• Python 3.10+ — встанови останню версію із офіційного сайту.",
        "• IDE — VS Code з розширеннями Python, Pylance.",
        "• GitHub — авторизуйся або створи акаунт.",
      ].concat(
        state.choices.mode === "codex"
          ? ["• Codex — увімкни Codex у VS Code."]
          : []
      )
    );
  }

  const grid = document.createElement("div");
  grid.className = "card-grid";

  if (isCodespaces) {
    grid.appendChild(
      createToolCard({
        title: "GitHub акаунт",
        description: "Потрібен для доступу до Codespaces і збереження коду.",
        link: "https://github.com/",
        prompt:
          "Поясни, як зареєструватися на GitHub, увімкнути двофакторну автентифікацію та налаштувати профіль.",
        ai: aiTarget,
      })
    );

    grid.appendChild(
      createToolCard({
        title: "Quickstart з Codespaces",
        description: "Створи робоче середовище в браузері за кілька хвилин.",
        link: "https://docs.github.com/en/codespaces/getting-started/quickstart",
        prompt:
          "Розкажи, як у репозиторії відкрити вкладку Codespaces і створити новий codespace на гілці main. Додай кроки запуску терміналу.",
        ai: aiTarget,
      })
    );

    grid.appendChild(
      createToolCard({
        title: "Робота всередині Codespaces",
        description: "Термінал, порти, секрети та зупинка середовища.",
        link: "https://docs.github.com/en/codespaces/troubleshooting/troubleshooting-codespaces",
        prompt:
          "Опиши, як у Codespaces відкривати новий термінал, прокидати порт і зупиняти середовище після роботи.",
        ai: aiTarget,
      })
    );

    if (state.choices.mode === "codex") {
      grid.appendChild(
        createToolCard({
          title: "Codex у Codespaces",
          description:
            "Увімкни розширення Codex прямо в браузерному VS Code.",
          link: "https://marketplace.visualstudio.com/items?itemName=openai.chatgpt",
          prompt:
            "Поясни, як у Codespaces встановити розширення GitHub Codex, увійти та активувати автодоповнення.",
          ai: aiTarget,
        })
      );
    }
  } else {
    grid.appendChild(
      createToolCard({
        title: "Python 3.12",
        description: "Офіційний інсталятор для Windows / macOS / Linux.",
        link: "https://www.python.org/downloads/",
        prompt:
          "Поясни, як встановити Python 3.12 на мою систему. Додай кроки для перевірки python --version.",
        ai: aiTarget,
      })
    );

    grid.appendChild(
      createToolCard({
        title: "VS Code",
        description:
          "Редактор із потрібними плагінами: Python, Pylance, Codex.",
        link: "https://code.visualstudio.com/",
        prompt:
          "Поясни, як встановити VS Code та додати розширення Python, Pylance і Codex.",
        ai: aiTarget,
      })
    );

    grid.appendChild(
      createToolCard({
        title: "GitHub",
        description: "Створи або увійди у свій акаунт.",
        link: "https://github.com/",
        prompt:
          "Поясни, як зареєструватися на GitHub, увімкнути 2FA та налаштувати git config.",
        ai: aiTarget,
      })
    );

    if (state.choices.mode === "codex") {
      grid.appendChild(
        createToolCard({
          title: "Codex",
          description: "Активуй Codex у VS Code, щоб працювати.",
          link: "https://marketplace.visualstudio.com/items?itemName=openai.chatgpt",
          prompt:
            "Поясни, як увімкнути GitHub Codex у VS Code та авторизуватися.",
          ai: aiTarget,
        })
      );
    }
  }

  container.appendChild(grid);

  const checklist = document.createElement("div");
  checklist.className = "checklist";

  const checklistItems = isCodespaces
    ? CODESPACES_TOOL_CHECKLIST
    : TOOL_CHECKLIST;

  if (isCodespaces) {
    state.tools.python = false;
    state.tools.editor = false;
  } else {
    state.tools.codespace = false;
    state.tools.browser = false;
  }

  checklistItems.forEach((tool) => {
    if (tool.optional && state.choices.mode !== "codex") {
      state.tools[tool.id] = false;
      return;
    }
    if (state.tools[tool.id] === undefined) state.tools[tool.id] = false;
    const row = document.createElement("div");
    row.className = "check-item";
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = !!state.tools[tool.id];
    input.addEventListener("change", (event) => {
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

  const selector = document.createElement("div");
  selector.className = "file-structure-selector";

  const selectorLabel = document.createElement("label");
  selectorLabel.textContent = "Основний файл проєкту:";
  selector.appendChild(selectorLabel);

  const select = document.createElement("select");
  select.id = "entry-file-select";
  selectorLabel.setAttribute("for", select.id);
  ENTRY_FILE_OPTIONS.forEach((option) => {
    const opt = document.createElement("option");
    opt.value = option.id;
    opt.textContent = option.label;
    select.appendChild(opt);
  });
  select.value = entryFile;
  select.addEventListener("change", (event) => {
    state.choices.entryFile = event.target.value;
    saveState();
    draw(true);
  });
  selector.appendChild(select);

  container.appendChild(selector);

  // Секція з індивідуальним кодом
  const manualSection = createFileSection("Файли з індивідуальним кодом", "");
  const manualList = document.createElement("div");
  manualList.className = "file-card-stack";
  manualList.appendChild(createManualFileCard(entryFile));
  manualSection.appendChild(manualList);
  container.appendChild(manualSection);

  // Статичні файли
  const staticSection = createFileSection(
    "Готові заготовки",
    "Скопіюй вказаний код та встав у відповідні файли без змін."
  );
  const staticList = document.createElement("div");
  staticList.className = "file-card-stack";
  FILE_STRUCTURE_STATIC_FILES.forEach((item) => {
    staticList.appendChild(createStaticFileCard(item));
  });
  staticSection.appendChild(staticList);
  container.appendChild(staticSection);

  // Бекенд-специфічні файли
  const backend = state.choices.backend;
  const backendEntries = FILE_STRUCTURE_BACKEND_MAP[backend] || [];
  const backendSection = createFileSection(
    "Додатково для обраного бекенду",
    backend
      ? "Створи ці елементи, щоб сховище працювало коректно."
      : "Оберіть бекенд, щоб побачити додаткові файли/папки."
  );

  if (!backend) {
    const info = document.createElement("p");
    info.className = "file-section-hint";
    info.textContent =
      "Бекенд ще не обрано. Перейдіть на крок «Вибір типу зберігання».";
    backendSection.appendChild(info);
  } else if (!backendEntries.length) {
    const info = document.createElement("p");
    info.className = "file-section-hint";
    info.textContent =
      "Для цього бекенду немає додаткових файлів — достатньо основної структури.";
    backendSection.appendChild(info);
  } else {
    const backendList = document.createElement("div");
    backendList.className = "file-card-stack";
    backendEntries.forEach((item) => {
      backendList.appendChild(createBackendCard(item));
    });
    backendSection.appendChild(backendList);
  }

  container.appendChild(backendSection);

  function createFileSection(title, subtitle) {
    const section = document.createElement("section");
    section.className = "file-structure-section";

    const head = document.createElement("header");
    head.className = "file-section-head";

    const h3 = document.createElement("h3");
    h3.textContent = title;
    head.appendChild(h3);

    if (subtitle) {
      const p = document.createElement("p");
      p.textContent = subtitle;
      head.appendChild(p);
    }

    section.appendChild(head);
    return section;
  }

  function createManualFileCard(fileName) {
    const wrapper = document.createElement("article");
    wrapper.className = "file-card manual";

    const title = document.createElement("header");
    title.className = "file-card-path";
    title.textContent = fileName;
    wrapper.appendChild(title);

    const desc = document.createElement("p");
    desc.className = "file-card-description";
    desc.textContent =
      "Цей файл містить бізнес-логіку бота. Запроси у ШІ повний вміст і встав його в редактор.";
    wrapper.appendChild(desc);

    if (isCustomBot()) {
      const prompt = generateManualFilePrompt(fileName);
      const aiTarget = getPromptAiTarget("code");
      wrapper.appendChild(
        createPromptBlock(prompt, {
          copyLabel: "Скопіювати промпт для ШІ",
          ai: aiTarget,
          openLabel: getAiLabel(aiTarget),
        })
      );
    } else {
      const hint = document.createElement("p");
      hint.className = "file-card-note";
      hint.textContent =
        "Отримаєш готовий код на кроці «Промпт для коду». Скопіюй звідти, встав сюди й збережи.";
      wrapper.appendChild(hint);
    }

    const note = document.createElement("p");
    note.className = "file-card-note";
    note.textContent =
      "Після вставки коду збережи файл та переходь до наступних кроків.";
    wrapper.appendChild(note);

    return wrapper;
  }

  function createStaticFileCard(item) {
    const card = document.createElement("article");
    card.className = "file-card static";

    const title = document.createElement("header");
    title.className = "file-card-path";
    title.textContent = item.title;
    card.appendChild(title);

    if (item.description) {
      const desc = document.createElement("p");
      desc.className = "file-card-description";
      desc.textContent = item.description;
      card.appendChild(desc);
    }

    if (item.content) {
      const code = document.createElement("pre");
      code.className = "file-card-code";
      code.textContent = item.content;
      card.appendChild(code);

      const actions = document.createElement("div");
      actions.className = "file-card-actions";
      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "ghost copy-btn";
      copyBtn.textContent = "Скопіювати вміст";
      copyBtn.addEventListener("click", () => copyText(item.content));
      actions.appendChild(copyBtn);
      card.appendChild(actions);
    }

    return card;
  }

  function createBackendCard(item) {
    if (item.type === "note") {
      const note = document.createElement("p");
      note.className = "file-section-hint";
      note.textContent = item.description;
      return note;
    }

    const card = document.createElement("article");
    card.className = `file-card backend ${item.type || "info"}`;

    if (item.path) {
      const title = document.createElement("header");
      title.className = "file-card-path";
      title.textContent = item.path;
      card.appendChild(title);
    }

    if (item.description) {
      const desc = document.createElement("p");
      desc.className = "file-card-description";
      desc.textContent = item.description;
      card.appendChild(desc);
    }

    if (item.type === "static" && item.content) {
      const code = document.createElement("pre");
      code.className = "file-card-code";
      code.textContent = item.content;
      card.appendChild(code);

      const actions = document.createElement("div");
      actions.className = "file-card-actions";
      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "ghost copy-btn";
      copyBtn.textContent = "Скопіювати вміст";
      copyBtn.addEventListener("click", () => copyText(item.content));
      actions.appendChild(copyBtn);
      card.appendChild(actions);
    }

    if (item.type === "dir" || item.type === "info") {
      const actions = document.createElement("div");
      actions.className = "file-card-actions";
      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "ghost copy-btn";
      copyBtn.textContent = "Скопіювати шлях";
      copyBtn.addEventListener("click", () => copyText(item.path));
      actions.appendChild(copyBtn);
      card.appendChild(actions);
    }

    if (item.type === "ai" && item.prompt) {
      const aiTarget = getPromptAiTarget("code");
      card.appendChild(
        createPromptBlock(item.prompt, {
          copyLabel: "Скопіювати промпт",
          ai: aiTarget,
          openLabel: getAiLabel(aiTarget),
        })
      );
    }

    return card;
  }
}

function renderGitWorkflowStep(container) {
  const env = state.choices.environment;

  renderInfo(container, [
    "Навіщо: фіксуємо прогрес і ділимося кодом через GitHub.",
    "Рекомендовані назви комітів: \"Init bot\", \"Add main flow\", \"Add storage (SQLite)\", \"Add inline menu\", \"Fix validation\", \"Docs: update README\".",
  ]);

  if (env === "codespaces") {
    renderInfo(container, [
      "Codespaces:",
      "• Відкрий вкладку Source Control (іконка гілки) у веб-VS Code.",
      "• Натисни «Publish changes» або в терміналі: git status → git add . → git commit -m \"Add main flow\" → git push.",
      "• Авторизація: підтверди вікно GitHub у браузері, якщо попросить.",
      "Коли комітити:",
      "• Одразу після створення базової структури (requirements.txt, .env.example, main.py).",
      "• Після додавання логіки у main.py або інших ключових файлах.",
      "• Після підключення бекенду/зберігання та тесту команд.",
    ]);
  } else {
    renderInfo(container, [
      "Local:",
      "• Якщо треба, ініціалізуй git: `git init`.",
      "• Додай remote: `git remote add origin https://github.com/username/repo.git`.",
      "• Стандартний цикл: git status → git add . → git commit -m \"Init bot\" → git push origin main",
      "• Якщо main ще не існує на GitHub: `git push --set-upstream origin main`.",
      "Коли комітити:",
      "• Після створення структури та файлів конфігів (.env.example, requirements.txt).",
      "• Після стабільних змін у логіці (нові хендлери, зберігання, меню).",
      "• Перед деплоєм або тестом, щоб мати точку відкату.",
    ]);
  }

  renderInfo(container, [
    "Нагадування:",
    "• Не пуш `.env`; тримай секрети локально, а приклад у `.env.example`.",
    "• Перед пушем переконайся, що тести/бот запускаються без помилок.",
    "• Описуй коміти коротко й по суті — це економить час під час ревʼю.",
  ]);
}

function renderDevBriefStep(container) {
  const panel = document.createElement("div");
  panel.className = "review-card";

  const h = document.createElement("h3");
  h.textContent = "Огляд виборів та швидке редагування";
  panel.appendChild(h);

  const typeMeta = BOT_TYPES.find((item) => item.id === state.choices.botType);
  const currentTypeLabel = typeMeta
    ? `${typeMeta.title} — ${typeMeta.description}`
    : "Тип ще не обрано";
  const customState = ensureCustomState();
  const isCustom = isCustomBot();
  const envMeta = getActiveEnvironmentMeta();
  let typeLockReason = null;
  if (!isAdmin()) {
    if (!isCustom) {
      typeLockReason = "Зміна сценарію можлива лише у новому середовищі.";
    } else if (customState.briefLocked || envMeta?.brief_locked) {
      typeLockReason =
        "Бриф збережено для цього середовища. Щоб змінити тип, створи нове середовище.";
    }
  }
  const canEditBotType = !typeLockReason;
  const typeControl = canEditBotType
    ? makeSelect(
        BOT_TYPES.map((t) => [t.id, `${t.title} — ${t.description}`]),
        state.choices.botType,
        (value) => {
          applyBotTypeSelection(value, {
            forceCustomReset: true,
          });
          saveState();
          draw(true);
        }
      )
    : makeReadonlyValue(currentTypeLabel, typeLockReason);

  panel.appendChild(
    makeRow(
      "Тип бота",
      typeControl
    )
  );

  panel.appendChild(
    makeRow(
      "Режим ШІ",
      makeSelect(
        MODE_OPTIONS.map((m) => [m.id, m.title]),
        state.choices.mode,
        (value) => {
          state.choices.mode = value;
          if (value !== "codex") state.tools.сodex = false;
          saveState();
          draw(false);
        }
      )
    )
  );

  panel.appendChild(
    makeRow(
      "Середовище",
      makeSelect(
        ENVIRONMENTS.map((env) => [env.id, env.title]),
        state.choices.environment,
        (value) => {
          state.choices.environment = value;
          saveState();
          draw(false);
        }
      )
    )
  );

  const commandsTextarea = document.createElement("textarea");
  commandsTextarea.value = state.commands.join(", ");
  commandsTextarea.addEventListener("input", (event) => {
    const commands = event.target.value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    state.commands = commands.map((cmd) =>
      cmd.startsWith("/") ? cmd : `/${cmd}`
    );
    saveState();
  });
  panel.appendChild(makeRow("Команди", wrapControl(commandsTextarea)));

  container.appendChild(panel);

  if (!isCustom) {
    const brief = generateDevBrief();
    const block = document.createElement("div");
    block.className = "prompt-area";

    const pre = document.createElement("pre");
    pre.className = "prompt-text";
    pre.textContent = brief;

    block.appendChild(pre);
    container.appendChild(block);
  }
}

function renderCodePromptStep(container) {
  const prompt = generateCodePrompt();
  renderInfo(container, ["Використай промпт нижче, щоб отримати код."]);
  const aiTarget = getPromptAiTarget("code");
  const block = createPromptBlock(prompt, {
    copyLabel: "Скопіювати промпт",
    ai: aiTarget,
    openLabel: getAiLabel(aiTarget),
  });
  container.appendChild(block);
}

function renderRequirementsStep(container) {
  renderFileCreateBlock(
    container,
    "requirementsCreated",
    "requirements.txt",
    "Додай залежності для бота."
  );

  if (!state.tools.requirementsCreated) {
    const carousel = document.createElement("div");
    carousel.className = "carousel";

    carousel.appendChild(
      createCarouselSlide({
        title: "Крок 1. Створи файл",
        body: "У редакторі натисни New File, назви файл requirements.txt та збережи його у корені проєкту.",
      })
    );

    carousel.appendChild(
      createCarouselSlide({
        title: "Крок 2. Додай залежності",
        body: "Встав рядки aiogram==3.* та python-dotenv, збережи (Ctrl/Cmd+S).",
        code: "aiogram==3.*\npython-dotenv",
      })
    );

    carousel.appendChild(
      createCarouselSlide({
        title: "Крок 3. Перевір",
        body: `Переконайся, що файл поруч із ${entryFile}. Команда \`pip install -r requirements.txt\` встановить залежності.`,
      })
    );

    container.appendChild(carousel);
  }
}

function renderCustomRequirementsStep(container) {
  const custom = ensureCustomState();
  renderInfo(container, [
    "• Опиши словами, що робитиме твій бот: сценарії, команди, інтеграції.",
    "• Чим детальніше поясниш — тим точніше буде бриф.",
  ]);

  const warning = document.createElement("div");
  warning.className = "note-block warning";
  warning.innerHTML =
    "<strong>Важливо:</strong> уважно опиши бота саме тут. Після збереження брифу змінити сценарій у цьому середовищі буде неможливо без створення нового середовища.";
  container.appendChild(warning);

  const textarea = document.createElement("textarea");
  textarea.value = custom.requirements;
  textarea.placeholder =
    "Наприклад: “Бот для фітнес-коуча: збір заявок, розклад, нагадування...”";
  textarea.addEventListener("input", (event) => {
    custom.requirements = event.target.value;
    saveState();
  });
  container.appendChild(makeRow("Опис бота", wrapControl(textarea)));
}

function renderCustomBriefPromptStep(container) {
  const custom = ensureCustomState();
  if (!custom.requirements.trim()) {
    renderInfo(container, [
      "• Спочатку заповни опис бота, щоб сформувати промпт.",
    ]);
    return;
  }
  renderInfo(container, [
    "Скопіюй промпт і встав у ChatGPT / Codex, щоб отримати JSON-бриф.",
  ]);
  const prompt = generateCustomBriefPrompt();
  const aiTarget = getPromptAiTarget("instructions");
  container.appendChild(
    createPromptBlock(prompt, {
      copyLabel: "Скопіювати промпт для брифу",
      ai: aiTarget,
      openLabel: getAiLabel(aiTarget),
    })
  );
}

function renderCustomBriefInputStep(container) {
  const custom = ensureCustomState();
  const briefLocked = Boolean(custom.briefLocked);
  const activeEnv = getActiveEnvironmentMeta();
  const envRequiredTip =
    "• Бриф привʼязується до активного середовища. Щоб створити новий бот, створи окреме середовище.";
  const baseInfo =
    "Встав JSON із брифом. Після збереження система побудує план файлів і заблокує повторне редагування для цього середовища.";
  renderInfo(container, [baseInfo, envRequiredTip]);

  const envNotice = document.createElement("div");
  envNotice.className = activeEnv ? "note-block" : "note-block warning";
  envNotice.textContent = activeEnv
    ? `Активне середовище: «${activeEnv.title || "Без назви"}». Бриф буде привʼязаний саме до нього.`
    : "Середовище ще не обрано — натисни «Середовища» у верхньому меню та створи / активуй його перед збереженням брифу.";
  container.appendChild(envNotice);

  if (briefLocked) {
    const notice = document.createElement("p");
    notice.className = "note-block";
    notice.textContent =
      "Бриф для цього середовища вже збережений. Створи нове середовище, щоб зробити ще один кастомний бот.";
    container.appendChild(notice);
  } else {
    const warning = document.createElement("div");
    warning.className = "note-block warning";
    warning.innerHTML =
      "<strong>Після збереження:</strong> змінити бриф або тип бота вже не можна. Переконайся, що специфікація повна і точна.";
    container.appendChild(warning);
  }

  const textarea = document.createElement("textarea");
  textarea.value = custom.briefText;
  textarea.placeholder = '{\n  "commands": [...],\n  "files": [...],\n  ...\n}';
  textarea.rows = 12;
  textarea.readOnly = briefLocked;
  textarea.disabled = briefLocked;
  if (briefLocked) {
    textarea.classList.add("textarea-readonly");
  }
  textarea.addEventListener("input", (event) => {
    custom.briefText = event.target.value;
    saveState();
  });
  container.appendChild(makeRow("JSON-бриф", wrapControl(textarea)));

  const actions = document.createElement("div");
  actions.className = "prompt-actions";
  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "primary";
  saveBtn.textContent = briefLocked ? "Бриф зафіксовано" : "Зберегти бриф";
  saveBtn.disabled = briefLocked;
  const lockUi = () => {
    textarea.readOnly = true;
    textarea.disabled = true;
    textarea.classList.add("textarea-readonly");
    saveBtn.disabled = true;
    saveBtn.textContent = "Бриф зафіксовано";
  };
  saveBtn.addEventListener("click", async () => {
    if (custom.briefLocked) {
      showToast("Цей бриф вже заблоковано.");
      return;
    }
    if (!envState.activeId) {
      showToast("Створи та обери середовище перед збереженням брифу.");
      return;
    }
    const confirmed = confirm(
      "Після збереження бриф буде заблоковано і змінити його вже не можна. Уважно перевірив усі вимоги?"
    );
    if (!confirmed) {
      return;
    }
    try {
      const parsed = parseCustomBrief(custom.briefText);
      custom.brief = parsed;
      updateCustomFilePlan(parsed);
      if (Array.isArray(parsed.commands) && parsed.commands.length) {
        state.commands = parsed.commands
          .map((cmd) => normalizeCommand(cmd))
          .filter(Boolean);
      }
      if (!custom.commandsText?.trim()) {
        custom.commandsText = deriveDefaultCommands(custom, getEntryFile());
      }
      const recommendedBackend = getRecommendedBackendId();
      if (recommendedBackend && !state.choices.backend) {
        state.choices.backend = recommendedBackend;
      }
      custom.diag.prompt = "";
      saveState();
      draw(true);
    } catch (error) {
      console.error("Не вдалося розпарсити бриф", error);
      showToast(
        "Помилка JSON. Перевір синтаксис. Якщо ChatGPT повернув відповідь у ```json``` — скопіюй лише вміст без кодових блоків."
      );
      return;
    }
    try {
      await patchEnvironment(envState.activeId, {
        brief_locked: true,
        brief_step: state.currentStep + 1,
      });
      custom.briefLocked = true;
      saveState();
      lockUi();
      showSetupOverlay({
        messages: [
          "Підлаштовуємо кроки під твій бриф…",
          "Будуємо структуру файлів…",
          "Готуємо промпти для коду…",
          "Налаштовуємо підказки щодо зберігання…",
        ],
      });
      draw(true);
      showToast("Бриф збережено та зафіксовано.");
    } catch (error) {
      console.error("Failed to lock brief", error);
      showToast("Бриф збережено, але не вдалося зафіксувати середовище. Спробуй ще раз.");
    }
  });
  actions.appendChild(saveBtn);
  container.appendChild(actions);
}

function renderCustomFilesStep(container) {
  const custom = ensureCustomState();
  if (!custom.brief) {
    renderInfo(container, [
      "• Спочатку збережи JSON-бриф, щоб побачити перелік файлів.",
    ]);
    return;
  }

  if (!custom.files.length) {
    renderInfo(container, [
      "• Бриф не містить файлів. Додай їх у відповідь ШІ, щоб побудувати план.",
    ]);
    return;
  }

  const isCodexMode = state.choices.mode === "codex";

  if (isCodexMode) {
    renderInfo(container, [
      "1) Скопіюй промпт нижче у Codex, щоб він створив усі файли та папки з брифу (без бізнес-логіки).",
      "2) Після відповіді повернися сюди та використай промпти нижче, щоб додати код у кожен файл.",
      "3) Позначай файли як виконані після вставки коду або заповнення шаблонів.",
    ]);

    const aiTarget = getPromptAiTarget("code");
    const scaffoldPrompt = generateCodexFileCreationPrompt(custom.brief);
    container.appendChild(
      createPromptBlock(scaffoldPrompt, {
        copyLabel: "Скопіювати промпт для Codex",
        ai: aiTarget,
        openLabel: getAiLabel(aiTarget),
        collapsible: true,
        expandLabel: "Розгорнути промпт для створення файлів",
        collapseLabel: "Згорнути промпт для створення файлів",
        variant: "prompt",
      })
    );

    const fileLines = custom.files.map((file, index) => {
      const path = file.path || `file_${index + 1}.txt`;
      const note = file.isSimple ? " (простий/статичний)" : "";
      const purpose = file.purpose || "Призначення ще не вказано.";
      return `• ${path}${note} — ${purpose}`;
    });
    renderInfo(container, ["Файли, які має створити Codex:", ...fileLines]);
  } else {
    renderInfo(container, [
      "Познач файли як виконані після того, як вставиш код або заповниш прості шаблони.",
    ]);
  }

  const stack = document.createElement("div");
  stack.className = "file-card-stack";

  custom.files.forEach((file) => {
    const card = document.createElement("article");
    card.className = `file-card ${file.isSimple ? "static" : "manual"}`;

    const header = document.createElement("header");
    header.className = "file-card-path";
    header.textContent = file.path;
    card.appendChild(header);

    const statusRow = document.createElement("label");
    statusRow.className = "form-label";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = !!file.done;
    const span = document.createElement("span");
    span.textContent = "Файл готовий";
    statusRow.append(checkbox, span);
    card.appendChild(statusRow);

    const body = document.createElement("div");
    body.className = "file-card-body";

    if (file.purpose) {
      const desc = document.createElement("p");
      desc.className = "file-card-description";
      desc.textContent = file.purpose;
      body.appendChild(desc);
    }

    if (file.isSimple) {
      const note = document.createElement("p");
      note.className = "file-card-note";
      note.textContent = file.instructions;
      body.appendChild(note);
    } else if (file.prompt) {
      const aiTarget = getPromptAiTarget("code");
      const promptBlock = createPromptBlock(file.prompt, {
        copyLabel: `Промпт для ${file.path}`,
        ai: aiTarget,
        openLabel: getAiLabel(aiTarget),
        collapsible: true,
      });
      body.appendChild(promptBlock);
      const tip = document.createElement("p");
      tip.className = "file-card-note";
      tip.textContent = "Згенеруй код, встав у файл і познач, що він готовий.";
      body.appendChild(tip);
    }

    card.appendChild(body);

    const applyCollapsedState = (done) => {
      card.classList.toggle("collapsed", done);
      body.hidden = !!done;
    };

    applyCollapsedState(file.done);

    checkbox.addEventListener("change", (event) => {
      file.done = event.target.checked;
      saveState();
      applyCollapsedState(file.done);
    });

    stack.appendChild(card);
  });

  container.appendChild(stack);
}

function renderCustomTerminalStep(container) {
  const custom = ensureCustomState();
  if (!custom.files.length) {
    renderInfo(container, [
      "• Спочатку сформуй і виконай кроки зі створення файлів.",
    ]);
    return;
  }

  renderInfo(container, [
    "Ці команди допоможуть перевірити проєкт. Можеш редагувати список під себе.",
  ]);

  const textarea = document.createElement("textarea");
  textarea.value = custom.commandsText;
  textarea.placeholder = "pip install -r requirements.txt\npython main.py";
  textarea.rows = 6;
  textarea.addEventListener("input", (event) => {
    custom.commandsText = event.target.value;
    saveState();
  });
  textarea.addEventListener("blur", () => {
    draw(false);
  });
  container.appendChild(makeRow("Команди для запуску", wrapControl(textarea)));

  const commands = getCustomCommandsList(custom);
  if (commands.length) {
    const list = document.createElement("div");
    list.className = "file-card-stack";
    commands.forEach((cmd, index) => {
      const card = document.createElement("article");
      card.className = "file-card static";
      const header = document.createElement("header");
      header.className = "file-card-path";
      header.textContent = `Крок ${index + 1}`;
      card.appendChild(header);
      const pre = document.createElement("pre");
      pre.className = "file-card-code";
      pre.textContent = cmd;
      card.appendChild(pre);
      const actions = document.createElement("div");
      actions.className = "file-card-actions";
      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "ghost copy-btn";
      copyBtn.textContent = "Скопіювати команду";
      copyBtn.addEventListener("click", () => copyText(cmd));
      actions.appendChild(copyBtn);
      card.appendChild(actions);
      list.appendChild(card);
    });
    const allActions = document.createElement("div");
    allActions.className = "prompt-actions";
    const copyAll = document.createElement("button");
    copyAll.type = "button";
    copyAll.className = "ghost copy-btn";
    copyAll.textContent = "Скопіювати всі команди";
    copyAll.addEventListener("click", () => copyText(custom.commandsText));
    allActions.appendChild(copyAll);
    container.appendChild(list);
    container.appendChild(allActions);
  }
}

function renderCustomDiagnosticsStep(container) {
  const custom = ensureCustomState();
  renderInfo(container, [
    "Якщо команда впала або бот не працює, зафіксуй помилку й згенеруй діагностичний промпт.",
  ]);

  const descArea = document.createElement("textarea");
  descArea.value = custom.diag.description;
  descArea.placeholder = "Короткий опис: що робили, що очікували, що сталося.";
  descArea.rows = 4;
  descArea.addEventListener("input", (event) => {
    custom.diag.description = event.target.value;
    saveState();
  });

  const logsArea = document.createElement("textarea");
  logsArea.value = custom.diag.logs;
  logsArea.placeholder = "Скопіюй сюди логи з терміналу або текст помилки.";
  logsArea.rows = 6;
  logsArea.addEventListener("input", (event) => {
    custom.diag.logs = event.target.value;
    saveState();
  });

  container.appendChild(makeRow("Опис помилки", wrapControl(descArea)));
  container.appendChild(makeRow("Логи терміналу", wrapControl(logsArea)));

  const actions = document.createElement("div");
  actions.className = "prompt-actions";
  const composeBtn = document.createElement("button");
  composeBtn.type = "button";
  composeBtn.className = "primary";
  composeBtn.textContent = "Зібрати діагностичний промпт";
  composeBtn.addEventListener("click", () => {
    custom.diag.prompt = composeCustomDiagnosticPrompt(custom);
    saveState();
    draw(false);
    showToast("Промпт зібрано.");
  });
  actions.appendChild(composeBtn);
  container.appendChild(actions);

  if (custom.diag.prompt) {
    const aiTarget = getPromptAiTarget("instructions");
    container.appendChild(
      createPromptBlock(custom.diag.prompt, {
        copyLabel: "Скопіювати промпт",
        ai: aiTarget,
        openLabel: getAiLabel(aiTarget),
      })
    );
    renderInfo(container, [
      "Після виправлень повернись до кроку з командами та протестуй знову.",
    ]);
  }
}

function renderPresetReplyStep(container) {
  const spec = getPresetUiSpec("reply");
  const aiTarget = getPromptAiTarget("code");
  if (!spec || !spec.type) {
    renderInfo(container, [
      "• Спочатку обери тип бота, щоб побачити рекомендоване меню.",
    ]);
    return;
  }
  const uiState = ensureUiState();
  if (!spec.needed) {
    const lines = [
      "• Для цього сценарію reply-меню не є обов’язковим. Можеш пропустити крок або запросити варіант через промпт.",
    ];
    if (spec.discoveryHint) lines.push(`• Підказка: ${spec.discoveryHint}`);
    renderInfo(container, lines);
    const prompt = generatePresetUiDiscoveryPrompt("reply", spec.type);
    container.appendChild(
      createPromptBlock(prompt, {
        copyLabel: "Запросити меню",
        ai: aiTarget,
        openLabel: getAiLabel(aiTarget),
        collapsible: true,
      })
    );
    return;
  }

  const variants = spec.variants;
  if (!variants.length) {
    renderInfo(container, [
      "• Для цього бота немає готових кнопок. Використай промпт нижче, щоб згенерувати свої.",
    ]);
    const prompt = generatePresetUiDiscoveryPrompt("reply", spec.type);
    container.appendChild(
      createPromptBlock(prompt, {
        copyLabel: "Запросити меню",
        ai: aiTarget,
        openLabel: getAiLabel(aiTarget),
        collapsible: true,
      })
    );
    return;
  }

  let current = variants.find((variant) => variant.id === uiState.replyVariant);
  if (!current) {
    current = variants[0];
    uiState.replyVariant = current.id;
    saveState();
  }

  if (variants.length > 1) {
    const select = document.createElement("select");
    variants.forEach((variant) => {
      const option = document.createElement("option");
      option.value = variant.id;
      option.textContent = variant.title;
      if (variant.id === current.id) option.selected = true;
      select.appendChild(option);
    });
    select.addEventListener("change", (event) => {
      uiState.replyVariant = event.target.value;
      saveState();
      draw(false);
    });
    container.appendChild(makeRow("Варіант меню", wrapControl(select)));
  }

  const introLines = [`• Обраний варіант: ${current.title}.`];
  if (current.description) introLines.push(`• ${current.description}`);
  if (spec.notes) introLines.push(`• ${spec.notes}`);
  if (spec.discoveryHint)
    introLines.push(`• Якщо хочеш інший набір: ${spec.discoveryHint}`);
  renderInfo(container, introLines);

  const buttonLines = current.buttons.map((button) => {
    const details = [];
    if (button.purpose) details.push(button.purpose);
    if (button.callback) details.push(`callback: ${button.callback}`);
    if (button.url) details.push(`URL: ${button.url}`);
    if (button.note) details.push(button.note);
    return `• ${button.text}${
      details.length ? " — " + details.join("; ") : ""
    }`;
  });
  renderInfo(
    container,
    buttonLines,
    "Додай кнопки у хендлер /start і протестуй меню."
  );

  const prompt = generatePresetUiCodePrompt("reply", current, spec.type);
  container.appendChild(
    createPromptBlock(prompt, {
      copyLabel: "Оновити код для меню",
      ai: aiTarget,
      openLabel: getAiLabel(aiTarget),
      collapsible: true,
    })
  );

  const customNote = [
    "• Опиши власні кнопки (формат: Назва — призначення — callback/URL).",
    "• Для Task Manager зроби цифри 1/2/3/4: 1 — «Додати задачу» (бот сам запитує текст, без /add), 2 — «Список», 3 — «Статус/статистика», 4 — «Налаштування/довідка».",
    "• Скопіюй промпт нижче, щоб ШІ згенерував код саме для твого набору.",
  ];
  renderInfo(container, customNote);

  const textarea = document.createElement("textarea");
  textarea.value = uiState.replyCustomSpec;
  textarea.placeholder =
    "1 — Додати задачу (запитай текст і збережи без /add)\n2 — Список задач (показати активні)\n3 — Статус/статистика\n4 — Налаштування/довідка";
  textarea.rows = 4;
  textarea.addEventListener("input", (event) => {
    uiState.replyCustomSpec = event.target.value;
    saveState();
    draw(false);
  });
  container.appendChild(makeRow("Власний набір кнопок", wrapControl(textarea)));

  const customPrompt = generatePresetUiCustomPrompt(
    "reply",
    uiState.replyCustomSpec,
    spec.type
  );
  if (customPrompt) {
    container.appendChild(
      createPromptBlock(customPrompt, {
        copyLabel: "Оновити код за власним меню",
        ai: aiTarget,
        openLabel: getAiLabel(aiTarget),
        collapsible: true,
      })
    );
  }
}

function renderPresetInlineStep(container) {
  const spec = getPresetUiSpec("inline");
  const aiTarget = getPromptAiTarget("code");
  if (!spec || !spec.type) {
    renderInfo(container, ["• Обери тип бота, щоб налаштувати inline-кнопки."]);
    return;
  }
  const uiState = ensureUiState();
  if (!spec.needed) {
    const lines = [
      "• У брифі для цього сценарію inline-кнопки не обов’язкові. Можеш пропустити крок або додати їх за потреби.",
    ];
    if (spec.discoveryHint) lines.push(`• Підказка: ${spec.discoveryHint}`);
    renderInfo(container, lines);
    const prompt = generatePresetUiDiscoveryPrompt("inline", spec.type);
    container.appendChild(
      createPromptBlock(prompt, {
        copyLabel: "Запросити inline-кнопки",
        ai: aiTarget,
        openLabel: getAiLabel(aiTarget),
        collapsible: true,
      })
    );
    return;
  }

  const variants = spec.variants;
  if (!variants.length) {
    renderInfo(container, [
      "• Готових inline-кнопок немає. Використай промпт нижче, щоб згенерувати свої.",
    ]);
    const prompt = generatePresetUiDiscoveryPrompt("inline", spec.type);
    container.appendChild(
      createPromptBlock(prompt, {
        copyLabel: "Запросити inline-кнопки",
        ai: aiTarget,
        openLabel: getAiLabel(aiTarget),
        collapsible: true,
      })
    );
    return;
  }

  let current = variants.find(
    (variant) => variant.id === uiState.inlineVariant
  );
  if (!current) {
    current = variants[0];
    uiState.inlineVariant = current.id;
    saveState();
  }

  if (variants.length > 1) {
    const select = document.createElement("select");
    variants.forEach((variant) => {
      const option = document.createElement("option");
      option.value = variant.id;
      option.textContent = variant.title;
      if (variant.id === current.id) option.selected = true;
      select.appendChild(option);
    });
    select.addEventListener("change", (event) => {
      uiState.inlineVariant = event.target.value;
      saveState();
      draw(false);
    });
    container.appendChild(makeRow("Варіант кнопок", wrapControl(select)));
  }

  const introLines = [`• Обраний набір: ${current.title}.`];
  if (current.description) introLines.push(`• ${current.description}`);
  if (spec.notes) introLines.push(`• ${spec.notes}`);
  if (spec.discoveryHint)
    introLines.push(`• Якщо потрібно інше рішення: ${spec.discoveryHint}`);
  renderInfo(container, introLines);

  const buttonLines = current.buttons.map((button) => {
    const details = [];
    if (button.purpose) details.push(button.purpose);
    if (button.callback) details.push(`callback: ${button.callback}`);
    if (button.url) details.push(`URL: ${button.url}`);
    if (button.note) details.push(button.note);
    return `• ${button.text}${
      details.length ? " — " + details.join("; ") : ""
    }`;
  });
  renderInfo(
    container,
    buttonLines,
    "Додай кнопки у відповідні повідомлення і протестуй сценарій."
  );

  const prompt = generatePresetUiCodePrompt("inline", current, spec.type);
  container.appendChild(
    createPromptBlock(prompt, {
      copyLabel: "Оновити код для inline-кнопок",
      ai: aiTarget,
      openLabel: getAiLabel(aiTarget),
      collapsible: true,
    })
  );

  const customNote = [
    "• Опиши власні inline-кнопки (формат: Назва — призначення — callback/URL).",
    "• Можна зробити цифри 1/2/3/4: при натисканні бот задає питання і зберігає відповідь без явних команд.",
    "• Додай, який хендлер викликається після натискання.",
  ];
  renderInfo(container, customNote);

  const textarea = document.createElement("textarea");
  textarea.value = uiState.inlineCustomSpec;
  textarea.placeholder =
    "1 — Додати задачу — callback add_task → бот запитує текст і зберігає\n2 — Важливі задачі — callback list_important\n3 — Статистика — callback stats_view\n4 — Назад — callback back_home";
  textarea.rows = 4;
  textarea.addEventListener("input", (event) => {
    uiState.inlineCustomSpec = event.target.value;
    saveState();
    draw(false);
  });
  container.appendChild(makeRow("Власні inline-кнопки", wrapControl(textarea)));

  const customPrompt = generatePresetUiCustomPrompt(
    "inline",
    uiState.inlineCustomSpec,
    spec.type
  );
  if (customPrompt) {
    container.appendChild(
      createPromptBlock(customPrompt, {
        copyLabel: "Оновити код за власними кнопками",
        ai: aiTarget,
        openLabel: getAiLabel(aiTarget),
        collapsible: true,
      })
    );
  }
}

function renderCustomReplyStep(container) {
  const custom = ensureCustomState();
  if (!custom.brief) {
    renderInfo(container, [
      "• Спочатку збережи бриф, щоб побачити рекомендоване меню.",
    ]);
    return;
  }
  const section = getUiSection("reply");
  const aiTarget = getPromptAiTarget("code");

  if (section && section.needed === false) {
    renderInfo(container, [
      "У брифі зазначено, що reply-меню не потрібне. Пропусти цей крок або, за бажанням, згенеруй меню через промпт.",
    ]);
    const prompt = generateUiDiscoveryPrompt("reply");
    container.appendChild(
      createPromptBlock(prompt, {
        copyLabel: "Все ж згенерувати меню",
        ai: aiTarget,
        openLabel: getAiLabel(aiTarget),
        collapsible: true,
      })
    );
    return;
  }

  if (section && section.buttons.length) {
    const items = section.buttons.map((button) => {
      const text = button.text || button.label || button.title || "Кнопка";
      const details = [button.purpose, button.target, button.note]
        .filter(Boolean)
        .join("; ");
      return details ? `• ${text} — ${details}` : `• ${text}`;
    });
    if (section.notes) items.push(`Примітка брифу: ${section.notes}`);
    renderInfo(container, items, "Додай кнопки у бота та протестуй `/start`.");
    const prompt = generateUiCodePrompt("reply", section.buttons);
    container.appendChild(
      createPromptBlock(prompt, {
        copyLabel: "Оновити код для меню",
        ai: aiTarget,
        openLabel: getAiLabel(aiTarget),
        collapsible: true,
      })
    );
    return;
  }

  renderInfo(container, [
    "У брифі немає готового reply-меню. Використай промпт, щоб згенерувати його.",
  ]);
  const prompt = generateUiDiscoveryPrompt("reply");
  container.appendChild(
    createPromptBlock(prompt, {
      copyLabel: "Запросити варіанти меню",
      ai: aiTarget,
      openLabel: getAiLabel(aiTarget),
      collapsible: true,
    })
  );
}

function renderCustomInlineStep(container) {
  const custom = ensureCustomState();
  if (!custom.brief) {
    renderInfo(container, [
      "• Спочатку збережи бриф, щоб побачити inline-кнопки.",
    ]);
    return;
  }
  const section = getUiSection("inline");
  const aiTarget = getPromptAiTarget("code");

  if (section && section.needed === false) {
    renderInfo(container, [
      "У брифі вказано, що inline-кнопки не потрібні. Пропусти цей крок або створи власні за промптом.",
    ]);
    const prompt = generateUiDiscoveryPrompt("inline");
    container.appendChild(
      createPromptBlock(prompt, {
        copyLabel: "Все ж додати inline-кнопки",
        ai: aiTarget,
        openLabel: getAiLabel(aiTarget),
        collapsible: true,
      })
    );
    return;
  }

  if (section && section.buttons.length) {
    const items = section.buttons.map((button) => {
      const text = button.text || button.label || button.title || "Кнопка";
      const parts = [
        button.purpose,
        button.callback,
        button.url,
        button.note,
      ].filter(Boolean);
      return parts.length ? `• ${text} — ${parts.join("; ")}` : `• ${text}`;
    });
    if (section.notes) items.push(`Примітка брифу: ${section.notes}`);
    renderInfo(container, items, "Налаштуй callback-и та протестуй сценарії.");
    const prompt = generateUiCodePrompt("inline", section.buttons);
    container.appendChild(
      createPromptBlock(prompt, {
        copyLabel: "Оновити код для inline-кнопок",
        ai: aiTarget,
        openLabel: getAiLabel(aiTarget),
        collapsible: true,
      })
    );
    return;
  }

  renderInfo(container, [
    "У брифі немає даних про inline-кнопки. Використай промпт, щоб згенерувати їх.",
  ]);
  const prompt = generateUiDiscoveryPrompt("inline");
  container.appendChild(
    createPromptBlock(prompt, {
      copyLabel: "Попросити inline-кнопки",
      ai: aiTarget,
      openLabel: getAiLabel(aiTarget),
      collapsible: true,
    })
  );
}

function renderEnvStep(container) {
  const aiTarget = getPromptAiTarget("instructions");
  const promptBlock = createPromptBlock(
    `Створи файл .env і додай рядок:\n\nBOT_TOKEN=тут_твій_токен`,
    {
      copyLabel: "Скопіювати інструкцію",
      ai: aiTarget,
      openLabel: getAiLabel(aiTarget),
    }
  );
  container.appendChild(promptBlock);

  const checklist = document.createElement("div");
  checklist.className = "info-block";
  const label = document.createElement("label");
  label.className = "info-line";
  const text = document.createElement("span");
  text.textContent = "Познач, що файл .env створено:";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = !!state.tools.env;
  input.addEventListener("change", (event) => {
    state.tools.env = event.target.checked;
    saveState();
    draw(false);
  });
  label.append(text, input);
  checklist.appendChild(label);
  container.appendChild(checklist);

  const actions = document.createElement("div");
  actions.className = "inline-actions";
  const copyName = document.createElement("button");
  copyName.type = "button";
  copyName.className = "ghost copy-btn";
  copyName.textContent = "Скопіювати назву .env";
  copyName.addEventListener("click", () => copyText(".env"));
  const copyToken = document.createElement("button");
  copyToken.type = "button";
  copyToken.className = "ghost copy-btn";
  copyToken.textContent = "Скопіювати BOT_TOKEN=";
  copyToken.addEventListener("click", () => copyText("BOT_TOKEN="));
  actions.append(copyName, copyToken);
  container.appendChild(actions);

  if (!state.tools.env) {
    const carousel = document.createElement("div");
    carousel.className = "carousel";

    carousel.appendChild(
      createCarouselSlide({
        title: "Крок 1. Створи файл",
        body: "У редакторі натисни New File, назви файл .env та збережи його у корені проєкту.",
      })
    );

    carousel.appendChild(
      createCarouselSlide({
        title: "Крок 2. Додай токен",
        body: "Встав рядок BOT_TOKEN=тут_твій_токен, заміни значення на реальний токен.",
        code: "BOT_TOKEN=тут_твій_токен",
      })
    );

    carousel.appendChild(
      createCarouselSlide({
        title: "Крок 3. Захисти токен",
        body: "Переконайся, що .env доданий у .gitignore та не потрапить у репозиторій.",
      })
    );

    container.appendChild(carousel);
  }
}

function renderBackendChoiceStep(container) {
  const infoLines = [
    "• JSON файл — обери для швидких прототипів і соло-проєктів без складних звітів.",
    "• SQLite — коли записів уже сотні, потрібні фільтри й прості запити без сервера.",
    "• Google Sheets — якщо команді треба бачити дані у таблиці через браузер.",
    "• Postgres (Docker) — для продакшн-ботів із кількома розробниками та серйозним навантаженням.",
  ];
  const recommendation = getBotStorageRecommendation();
  const recommendedId = recommendation?.id || null;
  const recommendedOption = BACKEND_OPTIONS.find((item) => item.id === recommendedId);
  if (recommendedOption) {
    infoLines.unshift(
      `• Для цього бота найчастіше підходить ${recommendedOption.title}. Обери його, якщо сумніваєшся.`
    );
    if (recommendation?.reason) {
      infoLines.push(`Причина: ${recommendation.reason}`);
    }
  }
  renderInfo(
    container,
    infoLines,
    "Завжди можна повернутися та змінити вибір до того, як виконаєш кроки."
  );

  const cards = document.createElement("div");
  cards.className = "card-grid";
  BACKEND_OPTIONS.forEach((option) => {
    const card = document.createElement("div");
    card.className = "card";
    if (state.choices.backend === option.id) card.classList.add("active");
    card.innerHTML = `<h3>${option.title}</h3><p>${option.summary}</p>`;
    if (recommendedId && option.id === recommendedId) {
      card.classList.add("recommended");
      const badge = document.createElement("div");
      badge.className = "backend-recommend";
      badge.textContent = "Рекомендуємо для вашого бота";
      card.appendChild(badge);
    }
    card.addEventListener("click", () => {
      state.choices.backend = option.id;
      saveState();
      draw(true);
    });
    cards.appendChild(card);
  });
  container.appendChild(cards);

  renderModuleRecommendationPanel(container, recommendation);
}

function renderBackendConfirmStep(container) {
  const backend = BACKEND_OPTIONS.find(
    (option) => option.id === state.choices.backend
  );
  if (!backend) {
    renderInfo(container, [
      "• Спочатку обери варіант зберігання, щоб побачити кроки.",
    ]);
    return;
  }
  renderInfo(container, [
    `Обрано: ${backend.title}. Нижче — кроки, які потрібно виконати.`,
  ]);
}

function renderBackendStep(container, backend, step, stepIndex = 0) {
  const backendId = backend?.id || "";

  if (stepIndex === 0) {
    const guide = getBackendGuide(backendId);
    if (guide?.lines?.length) {
      renderInfo(container, guide.lines);
    }
    if (guide?.links?.length) {
      renderBackendLinks(container, guide.links);
    }
  }

  renderInfo(container, [`${backend?.title || "Сховище"}: ${step.text}`]);
  if (step.prompt) {
    const aiTarget = getPromptAiTarget("code");
    const block = createPromptBlock(step.prompt, {
      copyLabel: "Скопіювати промпт",
      ai: aiTarget,
      openLabel: getAiLabel(aiTarget),
    });
    container.appendChild(block);
  }

  if (backendId === "sqlite") {
    const entryFile = getEntryFile();
    if (stepIndex === 0) {
      renderFileCreateBlock(
        container,
        "dbFileCreated",
        "db.sqlite3",
        "Порожній файл бази. SQLite створить структуру автоматично."
      );
    }
    const repoCode = `import aiosqlite

class TaskRepository:
    def __init__(self, db_path="tasks.db"):
        self.db_path = db_path

    async def init(self):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                CREATE TABLE IF NOT EXISTS tasks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending'
                )
            """)
            await db.commit()

    async def add(self, user_id: int, name: str):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                "INSERT INTO tasks (user_id, name) VALUES (?, ?)",
                (user_id, name)
            )
            await db.commit()

    async def list(self, user_id: int):
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute(
                "SELECT id, name, status FROM tasks WHERE user_id=? ORDER BY id",
                (user_id,)
            )
            rows = await cursor.fetchall()

        if not rows:
            return "Список порожній."

        out = []
        for i, (tid, name, status) in enumerate(rows, 1):
            mark = "✅" if status == "done" else "❌"
            out.append(f"{i}. {name} {mark}")
        return "\\n".join(out)

    async def mark_done(self, user_id: int, index: int):
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute(
                "SELECT id FROM tasks WHERE user_id=? ORDER BY id",
                (user_id,)
            )
            rows = await cursor.fetchall()

            if 0 <= index < len(rows):
                task_id = rows[index][0]
                await db.execute("UPDATE tasks SET status='done' WHERE id=?", (task_id,))
                await db.commit()
                return True
            return False`;

    if (stepIndex === 2) {
      renderInfo(container, [
        "Створи файл repository.py та підключи його в main.py замість прямої роботи з БД.",
      ]);
      renderFileCreateBlock(
        container,
        "repoFileCreated",
        "repository.py",
        "Тут буде логіка CRUD для задач."
      );

      container.appendChild(
        createPromptBlock(
          [
            "Створи файл repository.py.",
            "Додай клас TaskRepository з методами init, add(user_id, name), list(user_id), mark_done(user_id, index).",
            "Використовуй aiosqlite, база tasks.db.",
            "Поверни повний код repository.py одним блоком.",
          ].join("\n"),
          {
            copyLabel: "Промпт: створити repository.py",
            ai: getPromptAiTarget("code"),
            openLabel: getAiLabel(getPromptAiTarget("code")),
            collapsible: true,
          }
        )
      );

      container.appendChild(
        createPromptBlock(
          [
            `Онови файл ${entryFile}:`,
            "1) from repository import TaskRepository",
            "2) repo = TaskRepository() поруч із bot/dp",
            "3) main(): await repo.init() перед start_polling",
            "4) /add → repo.add(user_id, текст)",
            "5) /list → repo.list(user_id)",
            "6) /done → repo.mark_done(user_id, index)",
            "Поверни повний код файла одним блоком без скорочень.",
          ].join("\n"),
          {
            copyLabel: `Промпт: оновити ${entryFile}`,
            ai: getPromptAiTarget("code"),
            openLabel: getAiLabel(getPromptAiTarget("code")),
            collapsible: true,
          }
        )
      );
    }

    if (stepIndex === 3) {
      renderInfo(container, [
        "Запусти тести команд у терміналі:",
        "1) pip install -r requirements.txt",
        `2) python ${entryFile}`,
        "3) У Telegram: /add, /list, /done",
      ]);
      const cmdActions = document.createElement("div");
      cmdActions.className = "inline-actions";
      ["pip install -r requirements.txt", `python ${entryFile}`].forEach(
        (cmd) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "ghost copy-btn";
          btn.textContent = cmd;
          btn.addEventListener("click", () => copyText(cmd));
          cmdActions.appendChild(btn);
        }
      );
      container.appendChild(cmdActions);

      const fixPrompt = [
        "Знайди і виправ помилки у боті (aiogram v3).",
        `Файл основної логіки: ${entryFile}.`,
        "Файл репозиторію: repository.py.",
        "Логи/помилки та код дивись нижче.",
        "Поверни повний оновлений код обох файлів одним блоком кожен.",
        "Якщо щось відсутнє — додай, але не змінюй токени/секрети.",
      ].join("\n");

      container.appendChild(
        createPromptBlock(fixPrompt, {
          copyLabel: "Промпт для виправлення",
          ai: getPromptAiTarget("code"),
          openLabel: getAiLabel(getPromptAiTarget("code")),
          collapsible: true,
        })
      );
    }
  }
}

function renderBotfatherCreateStep(container) {
  renderInfo(container, [
    "Створи бота в @BotFather перед запуском:",
    "1) Напиши /newbot та задай назву.",
    "2) Скопіюй токен і додай у `.env` як `BOT_TOKEN=...`.",
    "3) Переконайся, що .env не потрапляє у репозиторій.",
  ]);
}

function renderBotfatherCommandsStep(container) {
  const commands = (state.commands || []).filter(Boolean);
  const list = commands.length > 0 ? commands : ["/start", "/help"];
  const descriptions = {
    "/start": "Почати роботу з ботом",
    "/help": "Показати список команд",
    "/add": "Додати нову задачу",
    "/list": "Показати всі задачі",
    "/done": "Позначити задачу виконаною",
    "/skip": "Видалити або пропустити задачу",
    "/stats": "Показати статистику",
  };
  const formatted = list
    .map((cmd) => {
      const clean = cmd.replace(/^\//, "");
      const desc = descriptions[cmd] || "Опис команди";
      return `${clean} - ${desc}`;
    })
    .join("\n");

  renderInfo(container, [
    "Щоб кнопки запрацювали у боті, додай команди в BotFather.",
    "1) Відкрий @BotFather → /setcommands.",
    "2) Вибери свого бота.",
    "3) Встав список команд нижче та надішли.",
  ]);

  const block = createPromptBlock(formatted, {
    copyLabel: "Скопіювати команди для BotFather",
    ai: null,
  });
  container.appendChild(block);
}

function getBackendGuide(backendId) {
  switch (backendId) {
    case "json":
      return {
        lines: [
          "1) У VS Code у списку файлів натисни правою → New Folder → назви `data`.",
          "2) Усередині `data` створити New File → `db.json` (порожній файл).",
          "3) Якщо любиш термінал: `mkdir -p data && echo {} > data/db.json`.",
          "4) Нічого встановлювати не треба. Просто збережи файл.",
          "5) Потім ШІ додасть код, який читає/пише цей файл.",
        ],
      };
    case "sqlite":
      return {
        lines: [
          "1) Створи файл поруч із main.py: `db.sqlite3` (порожній).",
          "2) Команда в терміналі: `touch db.sqlite3` (або створити через New File).",
          "3) Переконайся, що Python 3 встановлений. sqlite3 вже є в Python.",
          "4) Якщо треба оболонка: `python -c \"import sqlite3; sqlite3.connect('db.sqlite3').close()\"` — це створить файл.",
          "5) Далі ШІ додасть таблиці та код через промпт.",
        ],
        links: [
          { label: "Документація SQLite (англ.)", href: "https://www.sqlite.org/docs.html" },
        ],
      };
    case "gsheets":
      return {
        lines: [
          "1) Зайди у Google Sheets і створи нову таблицю: https://sheets.new",
          "2) У адресі знайди ID між `/d/` та `/edit`. Скопіюй у `.env` як `SHEET_ID=...`.",
          "3) Створи сервісний акаунт у Google Cloud, завантаж JSON ключ.",
          "4) Відкрий JSON, скопіюй усе вміст і встав у `.env` як `GOOGLE_CREDENTIALS= {...}` однією строкою.",
          "5) Додай email сервісного акаунта у доступ до таблиці (Share → Editor).",
          "6) Після цього ШІ підʼєднає gspread за промптом.",
        ],
        links: [
          { label: "Google Sheets", href: "https://sheets.new", primary: true },
          { label: "Сервісні акаунти Google", href: "https://console.cloud.google.com/iam-admin/serviceaccounts" },
        ],
      };
    case "postgres":
      return {
        lines: [
          "1) Встанови Docker Desktop і запусти його.",
          "2) У проєкті буде файл `docker-compose.yml` з Postgres.",
          "3) Створи/онови `.env` з прикладом: `POSTGRES_USER=postgres`, `POSTGRES_PASSWORD=postgres`, `POSTGRES_DB=botdb`.",
          "4) Запусти в терміналі: `docker compose up -d` — дочекайся статусу `healthy`.",
          "5) Якщо треба перевірити, виконай: `docker compose logs db` або підʼєднайся клієнтом на `localhost:5432`.",
          "6) ШІ додасть міграції/таблиці згідно з промптом.",
        ],
        links: [
          { label: "Завантажити Docker Desktop", href: "https://www.docker.com/products/docker-desktop/", primary: true },
          { label: "Документація Postgres", href: "https://www.postgresql.org/docs/" },
        ],
      };
    default:
      return null;
  }
}

function renderBackendLinks(container, links) {
  const actions = document.createElement("div");
  actions.className = "prompt-actions";
  links.forEach((link) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = link.primary ? "primary" : "ghost";
    btn.textContent = link.label;
    btn.addEventListener("click", () => {
      window.open(link.href, "_blank", "noopener");
    });
    actions.appendChild(btn);
  });
  container.appendChild(actions);
}

function renderModuleRecommendationPanel(container, recommendation) {
  const modules = ensureExtraModules();
  const recModules = recommendation?.modules || {};
  const hasRecModules = Object.values(recModules).some(Boolean);

  renderInfo(container, [
    "Адмін-панель та додаткові модулі:",
    "• Увімкни потрібні блоки — подальші кроки автоматично підлаштуються.",
    "• Адмінка потрібна, якщо є менеджери/оператори. Автозбереження — якщо трекаєш прогрес або стани користувачів.",
    "• Багатомовність — коли бот має працювати не лише українською.",
  ]);

  const list = document.createElement("div");
  list.className = "checklist";

  const moduleOptions = [
    {
      id: "adminPanel",
      label: "Адмін-панель",
      hint: recModules.adminPanel
        ? "Рекомендуємо для цього бота."
        : "Увімкни, якщо потрібні менеджери/клієнтська підтримка.",
      recommended: !!recModules.adminPanel,
    },
    {
      id: "autosave",
      label: "Автозбереження",
      hint: recModules.autosave
        ? "Рекомендуємо: багато станів, краще не втрачати прогрес."
        : "Вмикай, якщо бот зберігає прогрес або чергу.",
      recommended: !!recModules.autosave,
    },
    {
      id: "i18n",
      label: "Багатомовність",
      hint: "Увімкни, якщо потрібні тексти українською/польською/англійською.",
      recommended: false,
    },
  ];

  moduleOptions.forEach((option) => {
    const row = document.createElement("div");
    row.className = "check-item";
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = !!modules[option.id];
    input.addEventListener("change", (event) => {
      modules[option.id] = event.target.checked;
      saveState();
      draw(true);
    });
    const text = document.createElement("span");
    text.textContent = `${option.label}${
      option.recommended ? " (рекомендовано)" : ""
    }`;
    label.append(input, text);
    row.appendChild(label);
    if (option.hint) {
      const hint = document.createElement("p");
      hint.className = "form-hint";
      hint.textContent = option.hint;
      row.appendChild(hint);
    }
    list.appendChild(row);
  });

  container.appendChild(list);

  if (hasRecModules) {
    const missing = moduleOptions.some(
      (option) => option.recommended && !modules[option.id]
    );
    if (missing) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ghost";
      btn.textContent = "Увімкнути рекомендовані модулі";
      btn.addEventListener("click", () => {
        moduleOptions.forEach((option) => {
          if (option.recommended) modules[option.id] = true;
        });
        saveState();
        draw(true);
      });
      container.appendChild(btn);
    }
  }
}

function renderPaymentsChoiceStep(container) {
  const cards = document.createElement("div");
  cards.className = "card-grid";

  PAYMENT_METHODS.forEach((method) => {
    const card = document.createElement("div");
    card.className = "card";
    if (state.choices.payment === method.id) card.classList.add("active");
    card.innerHTML = `<h3>${method.title}</h3><p>${method.description}</p>`;
    card.addEventListener("click", () => {
      state.choices.payment = method.id;
      saveState();
      draw(true);
    });
    cards.appendChild(card);
  });

  const skip = document.createElement("div");
  skip.className = "card";
  if (state.choices.payment === "none") skip.classList.add("active");
  skip.innerHTML = `<h3>Пропустити</h3><p>Платежі можна додати пізніше.</p>`;
  skip.addEventListener("click", () => {
    state.choices.payment = "none";
    saveState();
    draw(true);
  });
  cards.appendChild(skip);

  container.appendChild(cards);
}

function renderPaymentPrepStep(container) {
  if (state.choices.payment === "none") {
    renderInfo(container, [
      "• Оплати поки що пропущено. Можеш повернутися до цього кроку пізніше.",
    ]);
    return;
  }
  renderInfo(
    container,
    PAYMENT_INTRO.map((item) => `• ${item}`)
  );
}

function renderPaymentStep(container, title, step) {
  renderInfo(container, [`• ${title}: ${step.text}`]);
  if (step.prompt) {
    const aiTarget = getPromptAiTarget("code");
    const block = createPromptBlock(step.prompt, {
      copyLabel: "Скопіювати промпт",
      ai: aiTarget,
      openLabel: getAiLabel(aiTarget),
    });
    container.appendChild(block);
  }
}

function renderLaunchStep(container, step) {
  if (step.type === "commands") {
    const commands = (
      state.commands && state.commands.length
        ? state.commands
        : ["/start", "/help"]
    )
      .map((cmd) => cmd.trim())
      .filter(Boolean);
    if (!commands.length) {
      commands.push("/start", "/help");
    }
    const lines = ["Перевір, що ключові команди працюють у чаті:"].concat(
      commands.map((cmd) => `• ${cmd}`)
    );
    renderInfo(container, lines);
    if (isCustomBot() && ensureCustomState().brief) {
      renderInfo(container, [
        "Якщо якась команда не працює, скористайся промптом нижче для виправлення.",
      ]);
      const aiTarget = getPromptAiTarget("code");
      const prompt = generateCommandFixPrompt(ensureCustomState());
      container.appendChild(
        createPromptBlock(prompt, {
          copyLabel: "Промпт для виправлення команд",
          ai: aiTarget,
          openLabel: getAiLabel(aiTarget),
          collapsible: true,
        })
      );
    }

    const issueCard = document.createElement("div");
    issueCard.className = "prompt-area";
    const issueTitle = document.createElement("div");
    issueTitle.className = "support-title";
    issueTitle.textContent = "Якщо команда не працює — опиши проблему";
    issueCard.appendChild(issueTitle);

    const issueForm = document.createElement("div");
    issueForm.className = "support-form";

    const makeField = (label, el) => {
      const wrap = document.createElement("label");
      const span = document.createElement("span");
      span.textContent = label;
      wrap.append(span, el);
      return wrap;
    };

    const problemInput = document.createElement("textarea");
    problemInput.rows = 2;
    problemInput.placeholder = "Що робив, що не працює, яка команда зламана?";
    issueForm.appendChild(makeField("Проблема", problemInput));

    const logsInput = document.createElement("textarea");
    logsInput.rows = 2;
    logsInput.placeholder = "Встав логи/помилки з терміналу (необовʼязково)";
    issueForm.appendChild(makeField("Логи з терміналу", logsInput));

    const codeInput = document.createElement("textarea");
    codeInput.rows = 4;
    codeInput.placeholder = "Встав поточний код main.py (повністю)";
    issueForm.appendChild(makeField("Поточний код main.py", codeInput));

    const generateBtn = document.createElement("button");
    generateBtn.type = "button";
    generateBtn.className = "primary";
    generateBtn.textContent = "Сформувати промпт для ШІ";
    issueForm.appendChild(generateBtn);

    issueCard.appendChild(issueForm);

    const aiTarget = getPromptAiTarget("code");
    const promptBlock = createPromptBlock("Опиши проблему, щоб отримати промпт.", {
      copyLabel: "Скопіювати промпт",
      ai: aiTarget,
      openLabel: getAiLabel(aiTarget),
      collapsible: true,
    });
    issueCard.appendChild(promptBlock);

  const promptTextEl = promptBlock.querySelector(".prompt-text");

  const buildPrompt = () => {
    const problem = (problemInput.value || "").trim();
    const logs = (logsInput.value || "").trim();
    const code = (codeInput.value || "").trim();
    if (!problem && !logs && !code) {
      promptTextEl.textContent =
        "Опиши проблему, додай логи й код, щоб сформувати промпт для ШІ.";
      return;
    }
      const entryFile = getEntryFile();
      const mode = state.choices.mode === "chatgpt" ? "ChatGPT-only" : "Codex";
      const lines = [
        "Ти — досвідчений Python-розробник (aiogram v3).",
        `Бот: ${getBotMetaByType(state.choices.botType)?.title || "Custom"}.`,
        `Команди: ${commands.join(", ")}.`,
        `Середовище: ${state.choices.environment || "—"}, режим: ${mode}.`,
        `Файл: ${entryFile}.`,
        `Опис проблеми: ${problem || "не вказано"}.`,
      ];
      if (logs) lines.push(`Логи/помилки: ${logs}`);
      if (code) lines.push(`Поточний код ${entryFile}:\n${code}`);
      lines.push(
        "Знайди помилку, виправ та поясни коротко. Покажи повний оновлений код файла одним блоком (без скорочень)."
      );
      promptTextEl.textContent = lines.join("\n");
    };

    generateBtn.addEventListener("click", buildPrompt);

    container.appendChild(issueCard);

    const entryFile = getEntryFile();
    renderInfo(container, [
      "Після заміни коду запусти перевірку у терміналі:",
      "1) pip install -r requirements.txt",
      `2) python ${entryFile}`,
    ]);

    return;
  }
  renderInfo(container, step.items || []);
}

function renderStepDetails(container, stepId) {
  const details = STEP_DETAILS[stepId];
  if (!details || !details.length) return;

  const wrapper = document.createElement("div");
  wrapper.className = "step-details";

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "ghost details-toggle";
  toggle.textContent = "Детальніше";
  toggle.addEventListener("click", () => openDetailsOverlay(stepId));
  wrapper.appendChild(toggle);
  container.appendChild(wrapper);
}

function renderExtraModulesStep(container) {
  const modules = ensureExtraModules();
  ensureExtraModuleData();
  const selected = EXTRA_MODULE_OPTIONS.filter(
    (option) => modules[option.id]
  );

  const infoLines = [
    "• Обери додаткові модулі. Для кожного з них зʼявиться власна серія кроків.",
    "• Якщо модуль не потрібен — достатньо залишити чекбокс вимкненим, і після цього кроку одразу буде «Фініш».",
  ];
  if (selected.length) {
    infoLines.push(
      `• Активовано: ${selected.map((item) => item.title).join(", ")}.`
    );
  } else {
    infoLines.push("• Нині модулі не обрані — після цього кроку буде фінал.");
  }
  renderInfo(container, infoLines);

  const grid = document.createElement("div");
  grid.className = "card-grid";

  EXTRA_MODULE_OPTIONS.forEach((option) => {
    const card = document.createElement("label");
    card.className = "card module-card";
    if (modules[option.id]) card.classList.add("active");
    card.tabIndex = 0;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = !!modules[option.id];
    checkbox.addEventListener("change", (event) => {
      modules[option.id] = event.target.checked;
      saveState();
      draw(true);
    });

    const title = document.createElement("h3");
    title.textContent = `${option.icon || ""} ${option.title}`.trim();

    const desc = document.createElement("p");
    desc.textContent = option.description;

    card.appendChild(checkbox);
    card.appendChild(title);
    card.appendChild(desc);
    grid.appendChild(card);
  });

  container.appendChild(grid);

  const hint = document.createElement("p");
  hint.className = "note-block";
  hint.textContent =
    "Повернутися до цього кроку можна у будь-який момент — вибір миттєво перебудує подальші кроки.";
  container.appendChild(hint);
}

function renderAutosaveStorageStep(container) {
  const data = ensureExtraModuleData().autosave;
  const backendTitle = getBackendTitle();
  renderFileCreateBlock(
    container,
    "storageFileCreated",
    data.storage.file || "storage.py",
    "Файл сховища стану користувачів."
  );
  renderInfo(container, [
    `• Поточний тип зберігання: ${backendTitle}. Працюй поверх нього — змінювати на інший тип не можна.`,
    "• Додай у файл сховища функції save_user_state(user_id, state_dict) та load_user_state(user_id).",
    "• Якщо потрібен окремий запис/таблиця для стану — створи її без ламання існуючої структури.",
  ]);

  renderCodePromptSection(container, {
    title: "Файл зі сховищем користувача",
    dataRef: data.storage,
    fileLabel: "Шлях до файла",
    composePrompt: () =>
      composeAutosaveStoragePrompt(data.storage, backendTitle),
    copyLabel: "Скопіювати промпт для сховища",
  });
}

function renderAutosaveHooksStep(container) {
  const data = ensureExtraModuleData().autosave;
  const storageFile = data.storage.file || "storage.py";
  renderInfo(container, [
    "• Усі місця, де змінюється стан користувача (списки задач, статуси, прогрес), мають викликати функцію save_user_state.",
    "• Використай існуючий механізм user_id / state — нічого не вигадуй заново, просто додай виклики збереження.",
    `• Імпортуй save_user_state з файла ${storageFile}.`,
  ]);

  renderCodePromptSection(container, {
    title: "Хендлери з логікою бота",
    dataRef: data.hooks,
    fileLabel: "Файл з хендлерами",
    composePrompt: () => composeAutosaveHooksPrompt(data, storageFile),
    copyLabel: "Скопіювати промпт для автозбереження",
  });
}

function renderAutosaveRestoreStep(container) {
  const data = ensureExtraModuleData().autosave;
  const storageFile = data.storage.file || "storage.py";
  renderInfo(container, [
    "• При першій взаємодії користувача потрібно підтягнути попередній стан, якщо він є.",
    "• Стартовий сценарій /start має лишитися знайомим: просто додай відновлення перед відправкою повідомлень та кнопок.",
    `• Використай load_user_state з файла ${storageFile}.`,
  ]);

  renderCodePromptSection(container, {
    title: "Відновлення стану у стартовому хендлері",
    dataRef: data.restore,
    fileLabel: "Файл із командою /start",
    composePrompt: () => composeAutosaveRestorePrompt(data, storageFile),
    copyLabel: "Скопіювати промпт для відновлення",
  });
}

function composeAutosaveStoragePrompt(storageData, backendTitle) {
  if (!storageData) return "";
  return buildFullFilePrompt({
    file: storageData.file || "storage.py",
    code: storageData.code,
    instructions: [
      "Додай у файл функції save_user_state(user_id, state_dict) та load_user_state(user_id), які працюють поверх поточного бекенду.",
      `Використовуй існуючий тип зберігання (${backendTitle}) — не переходь на інший формат.`,
      "Не ламаючи наявні таблиці/структури, додай усе необхідне для збереження стану (можна створити нову таблицю чи JSON-розділ).",
    ],
  });
}

function composeAutosaveHooksPrompt(data, storageFile) {
  if (!data?.hooks) return "";
  return buildFullFilePrompt({
    file: data.hooks.file || getEntryFile(),
    code: data.hooks.code,
    instructions: [
      `Імпортуй save_user_state (та load_user_state за потреби) з файла ${storageFile}.`,
      "Знайди всі місця, де оновлюється стан користувача (цілі, задачі, прогрес, статуси) та після кожної зміни викликай save_user_state(user_id, актуальний_стан).",
      "Не змінюй бізнес-логіку та повідомлення — лише додай акуратні виклики збереження.",
    ],
  });
}

function composeAutosaveRestorePrompt(data, storageFile) {
  if (!data?.restore) return "";
  return buildFullFilePrompt({
    file: data.restore.file || getEntryFile(),
    code: data.restore.code,
    instructions: [
      `У стартовому хендлері (/start або еквівалент) виклич load_user_state(user_id) із файла ${storageFile}.`,
      "Якщо стан знайдено — підстав його у використовуваний механізм (FSM, власний state-об’єкт тощо) перед відправкою повідомлень.",
      "Якщо стану немає — залиш існуючу логіку без змін.",
    ],
  });
}

function renderAdminConfigStep(container) {
  const data = ensureExtraModuleData().adminPanel;
  renderInfo(container, [
    "• ADMIN_ID зберігається у `.env`. Достатньо один раз додати рядок і не комітити його у репозиторій.",
    "• У `config.py` (або відповідному файлі) потрібно читати BOT_TOKEN та ADMIN_ID і надавати функцію is_admin(user_id).",
  ]);

  const envRow = createTextareaRow("Фрагмент .env (опційно)", {
    value: data.envSnippet,
    placeholder: "ADMIN_ID=123456789",
    rows: 2,
    onInput: (value) => {
      data.envSnippet = value;
      saveState();
    },
  });
  container.appendChild(envRow);

  renderCodePromptSection(container, {
    title: "config.py",
    dataRef: data.config,
    fileLabel: "Файл конфігурації",
    composePrompt: () => composeAdminConfigPrompt(data),
    copyLabel: "Скопіювати промпт для config.py",
  });
}

function renderAdminMenuStep(container) {
  const data = ensureExtraModuleData().adminPanel;
  renderInfo(container, [
    "• Команда /admin має працювати лише для адміністратора.",
    "• Для адміністратора покажи клавіатуру з опціями: «Заявки», «Статистика», «Налаштування», «Вийти з адмін-режиму».",
    "• Для інших користувачів — коротке повідомлення «Доступ заборонено».",
  ]);

  renderCodePromptSection(container, {
    title: "Хендлери адмін-панелі",
    dataRef: data.handlers,
    fileLabel: "Файл з командами",
    composePrompt: () => composeAdminMenuPrompt(data),
    copyLabel: "Скопіювати промпт для команди /admin",
  });
}

function renderAdminLeadsStep(container) {
  const data = ensureExtraModuleData().adminPanel;
  const backendTitle = getBackendTitle();
  renderInfo(container, [
    "• Кнопка «Заявки» має показувати останні звернення користувачів (або ключову статистику по ним).",
    `• Використай поточне сховище (${backendTitle}) та його функції. Нічого не дублюй.`,
  ]);

  renderCodePromptSection(container, {
    title: "Обробка кнопки «Заявки»",
    dataRef: data.leads,
    fileLabel: "Файл з адмін-хендлерами",
    composePrompt: () => composeAdminLeadsPrompt(data, backendTitle),
    copyLabel: "Скопіювати промпт для розділу «Заявки»",
  });
}

function renderAdminSecurityStep(container) {
  const data = ensureExtraModuleData().adminPanel;
  renderInfo(container, [
    "• Кожен адмін-хендлер перевіряє is_admin перед виконанням.",
    "• Кнопка «Вийти з адмін-режиму» повертає користувача до стандартного меню та очищає адмінський стан.",
    "• Стандартні сценарії для звичайних користувачів не повинні змінитися.",
  ]);

  renderCodePromptSection(container, {
    title: "Перевірки безпеки та вихід",
    dataRef: data.security,
    fileLabel: "Файл із адмін-хендлерами",
    composePrompt: () => composeAdminSecurityPrompt(data),
    copyLabel: "Скопіювати промпт для безпеки",
  });
}

function composeAdminConfigPrompt(data) {
  const snippet = data?.envSnippet?.trim();
  const instructions = [
    snippet
      ? `У файлі .env потрібно мати рядок(и): ${snippet.replace(/\s+/g, " ")}`
      : "Додай у .env змінну ADMIN_ID та не коміть її у репозиторій.",
    "Прочитай BOT_TOKEN і ADMIN_ID з .env тим самим способом, який вже використовується у проєкті (load_dotenv / environs тощо).",
    "Експортуй ADMIN_ID та функцію is_admin(user_id: int) -> bool.",
    "Не змінюй інші налаштування у конфігурації – просто доповни файл потрібними структурами.",
  ];
  return buildFullFilePrompt({
    file: data?.config?.file || "config.py",
    code: data?.config?.code,
    instructions,
  });
}

function composeAdminMenuPrompt(data) {
  if (!data?.handlers) return "";
  return buildFullFilePrompt({
    file: data.handlers.file || getEntryFile(),
    code: data.handlers.code,
    instructions: [
      "Імпортуй is_admin з config.py.",
      "Додай команду /admin (та/або кнопку), яка перевіряє користувача та показує меню адмін-панелі.",
      "Для адміністратора виведи клавіатуру з пунктами: «Заявки», «Статистика», «Налаштування», «Вийти з адмін-режиму».",
      "Для звичайних користувачів поверни повідомлення «Доступ заборонено» (без змін інших сценаріїв).",
    ],
  });
}

function composeAdminLeadsPrompt(data, backendTitle) {
  if (!data?.leads) return "";
  return buildFullFilePrompt({
    file: data.leads.file || data.handlers.file || getEntryFile(),
    code: data.leads.code,
    instructions: [
      "Додай обробку кнопки/команди «Заявки» всередині адмін-панелі.",
      `Отримай дані через поточне сховище (${backendTitle}) — використовуй існуючі репозиторії чи функції.`,
      "Покажи останні 5-10 записів у зрозумілому форматі (коротке резюме кожної заявки).",
    ],
  });
}

function composeAdminSecurityPrompt(data) {
  if (!data?.security) return "";
  return buildFullFilePrompt({
    file: data.security.file || data.handlers.file || getEntryFile(),
    code: data.security.code,
    instructions: [
      "Переконайся, що всі адмін-хендлери перевіряють is_admin(user_id) на початку.",
      "Додай кнопку/команду «Вийти з адмін-режиму», яка прибирає адмінську клавіатуру та повертає стандартне меню.",
      "Не змінюй поведінку для звичайних користувачів.",
    ],
  });
}

function renderI18nDictionariesStep(container) {
  const data = ensureExtraModuleData().i18n;
  renderInfo(container, [
    "• Винеси тексти у словники для мов: українська, польська, англійська.",
    "• У helper-модулі створи функцію t(lang, key) з кешуванням та fallback на 'ua'.",
    "• Структура: `locales/<lang>.json` + модуль `i18n.py` для читання словників.",
  ]);

  renderCodePromptSection(container, {
    title: "i18n.py — функція t(lang, key)",
    dataRef: data.helper,
    fileLabel: "Файл i18n.py",
    composePrompt: () => composeI18nHelperPrompt(data),
    copyLabel: "Скопіювати промпт для i18n.py",
  });

  const localeLabels = {
    ua: "Українська",
    pl: "Polski",
    en: "English",
  };

  ["ua", "pl", "en"].forEach((locale) => {
    renderCodePromptSection(container, {
      title: `Словник ${localeLabels[locale]}`,
      dataRef: data.locales[locale],
      fileLabel: "Файл словника",
      composePrompt: () => composeLocalePrompt(locale, data.locales[locale]),
      copyLabel: `Промпт для ${localeLabels[locale]}`,
      codeRows: 8,
      codePlaceholder:
        '{"start_welcome": "...", "main_menu_title": "...", "admin_locked": "..."}',
    });
  });
}

function renderI18nStorageStep(container) {
  const data = ensureExtraModuleData().i18n;
  const backendTitle = getBackendTitle();
  renderInfo(container, [
    "• Кожен користувач має поле language (ua/pl/en) з дефолтом ua.",
    `• Працюй поверх існуючого сховища (${backendTitle}) — нічого не перезаписуй.`,
    "• Потрібні функції get_user_language(user_id) та set_user_language(user_id, lang).",
  ]);

  renderCodePromptSection(container, {
    title: "Сховище мови користувача",
    dataRef: data.storage,
    fileLabel: "Файл сховища",
    composePrompt: () => composeI18nStoragePrompt(data, backendTitle),
    copyLabel: "Промпт для збереження мови",
  });
}

function renderI18nLanguageStep(container) {
  const data = ensureExtraModuleData().i18n;
  renderInfo(container, [
    "• Додай команду /language (або розшир /start), щоб показати кнопки вибору мови.",
    "• При натисканні викликай set_user_language і відправляй підтвердження користувачу.",
  ]);

  renderCodePromptSection(container, {
    title: "Вибір мови",
    dataRef: data.language,
    fileLabel: "Файл із хендлером /start або /language",
    composePrompt: () => composeI18nLanguagePrompt(data),
    copyLabel: "Промпт для вибору мови",
  });
}

function renderI18nUsageStep(container) {
  const data = ensureExtraModuleData().i18n;
  renderInfo(container, [
    "• Усі повідомлення повинні брати тексти через t(lang, key).",
    "• Визначай user_lang через get_user_language(user_id) з дефолтом 'ua'.",
    "• Не змінюй бізнес-логіку та порядок викликів — лише заміни тексти.",
  ]);

  renderCodePromptSection(container, {
    title: "Використання словників у боті",
    dataRef: data.usage,
    fileLabel: "Основний файл бота",
    composePrompt: () => composeI18nUsagePrompt(data),
    copyLabel: "Промпт для заміни текстів",
  });
}

function composeI18nHelperPrompt(data) {
  return buildFullFilePrompt({
    file: data?.helper?.file || "i18n.py",
    code: data?.helper?.code,
    instructions: [
      "Додай функцію t(lang: str, key: str, **kwargs), яка читає JSON-словники з каталогу locales/ та повертає переклад.",
      "Зроби кешування словників у памʼяті та fallback на мову 'ua', якщо ключ або файл відсутній.",
      "Передбач заміну плейсхолдерів (kwargs) у рядках.",
    ],
  });
}

function composeLocalePrompt(locale, localeData) {
  const labels = { ua: "Українська", pl: "Polski", en: "English" };
  return buildFullFilePrompt({
    file: localeData?.file || `locales/${locale}.json`,
    code: localeData?.code,
    language: "json",
    instructions: [
      `Заповни словник для мови ${labels[locale] || locale} (start_welcome, main_menu_title, admin_locked, language_prompt, language_confirm, інші тексти з бота).`,
      "Використай фактичні тексти, які зараз надсилає бот, переклавши їх відповідною мовою.",
      "JSON має бути валідним та впорядкованим.",
    ],
  });
}

function composeI18nStoragePrompt(data, backendTitle) {
  return buildFullFilePrompt({
    file: data?.storage?.file || "storage.py",
    code: data?.storage?.code,
    instructions: [
      "Додай поле language (str, дефолт 'ua') для сутності користувача.",
      "Додай функції get_user_language(user_id) -> str та set_user_language(user_id, lang).",
      `Працюй поверх існуючого бекенду (${backendTitle}) без зміни типу зберігання.`,
    ],
  });
}

function composeI18nLanguagePrompt(data) {
  return buildFullFilePrompt({
    file: data?.language?.file || getEntryFile(),
    code: data?.language?.code,
    instructions: [
      "Додай команду /language (або розшир /start), яка показує кнопки «Українська», «Polski», «English».",
      "При виборі викликай set_user_language(user_id, lang) і відправляй користувачу підтвердження з актуальним меню.",
      "Після вибору одразу підтягуй t(lang, key), щоб показати фрази у новій мові.",
    ],
  });
}

function composeI18nUsagePrompt(data) {
  return buildFullFilePrompt({
    file: data?.usage?.file || getEntryFile(),
    code: data?.usage?.code,
    instructions: [
      "У кожному хендлері діставай user_lang = get_user_language(user_id) або 'ua' за замовчуванням.",
      "Заміні всі хардкодні тексти на виклики t(user_lang, \"key\") з відповідними ключами.",
      "Не змінюй бізнес-логіку, лише отримання текстів.",
    ],
  });
}

function getExtraModuleStepDefinitions(moduleId) {
  switch (moduleId) {
    case "autosave":
      return [
        {
          id: "autosave-storage",
          title: "Автозбереження: структура сховища",
          render: renderAutosaveStorageStep,
        },
        {
          id: "autosave-hooks",
          title: "Автозбереження: виклики у хендлерах",
          render: renderAutosaveHooksStep,
        },
        {
          id: "autosave-restore",
          title: "Автозбереження: відновлення при старті",
          render: renderAutosaveRestoreStep,
        },
      ];
    case "adminPanel":
      return [
        {
          id: "admin-config",
          title: "Адмін-панель: ADMIN_ID і конфіг",
          render: renderAdminConfigStep,
        },
        {
          id: "admin-menu",
          title: "Адмін-панель: команда /admin",
          render: renderAdminMenuStep,
        },
        {
          id: "admin-leads",
          title: "Адмін-панель: перегляд заявок",
          render: renderAdminLeadsStep,
        },
        {
          id: "admin-security",
          title: "Адмін-панель: безпека і вихід",
          render: renderAdminSecurityStep,
        },
      ];
    case "i18n":
      return [
        {
          id: "i18n-dictionaries",
          title: "Багатомовність: словники",
          render: renderI18nDictionariesStep,
        },
        {
          id: "i18n-storage",
          title: "Багатомовність: зберігання мови",
          render: renderI18nStorageStep,
        },
        {
          id: "i18n-language",
          title: "Багатомовність: вибір мови",
          render: renderI18nLanguageStep,
        },
        {
          id: "i18n-usage",
          title: "Багатомовність: тексти через t(lang, key)",
          render: renderI18nUsageStep,
        },
      ];
    default:
      return [];
  }
}

function renderInfo(container, lines, footer) {
  const entryFile = getEntryFile();
  const isChatgpt = state.choices.mode === "chatgpt";
  const processedLines = lines?.map((line) => {
    let next = replaceEntryFileTokens(line, entryFile);
    if (
      isChatgpt &&
      typeof next === "string" &&
      /Попроси ШІ:/i.test(next)
    ) {
      next = `${next} Для ChatGPT: поверни повний код відповідного файла однією відповіддю без інструкцій чи скорочень.`;
    }
    return next;
  });

  if (processedLines?.length) {
    const block = document.createElement("div");
    block.className = "info-block";

    processedLines.forEach((line) => {
      const parsed = parseAiLine(line);
      if (parsed) {
        const label = document.createElement("div");
        label.className = "info-ai-label";
        label.textContent = "Попроси ШІ:";
        block.appendChild(label);

        const promptText = extractAiPrompt(parsed);
        const target = getPromptAiTarget("code");
        const promptBlock = createPromptBlock(promptText, {
          copyLabel: "Скопіювати завдання",
          ai: target,
          openLabel: target === "codex" ? "Відкрити Codex" : "Відкрити ChatGPT",
        });
        block.appendChild(promptBlock);
      } else {
        appendInfoLine(block, line);
      }
    });

    container.appendChild(block);
  }

  if (footer) {
    const note = document.createElement("div");
    note.className = "note-block";
    note.textContent = replaceEntryFileTokens(footer, entryFile);
    container.appendChild(note);
  }
}

function makeRow(labelText, control) {
  const row = document.createElement("div");
  row.className = "form-row";

  const label = document.createElement("div");
  label.className = "form-label";
  label.textContent = labelText;
  row.appendChild(label);

  row.appendChild(control);
  return row;
}

function makeSelect(options, value, onChange) {
  const wrapper = document.createElement("div");
  wrapper.className = "form-control";
  const select = document.createElement("select");
  options.forEach(([val, title]) => {
    const option = document.createElement("option");
    option.value = val;
    option.textContent = title;
    if (val === value) option.selected = true;
    select.appendChild(option);
  });
  select.addEventListener("change", (event) => onChange(event.target.value));
  wrapper.appendChild(select);
  return wrapper;
}

function makeReadonlyValue(text, hint) {
  const wrapper = document.createElement("div");
  wrapper.className = "form-control form-control--static";
  const value = document.createElement("div");
  value.className = "readonly-value";
  value.textContent = text || "—";
  wrapper.appendChild(value);
  if (hint) {
    const hintEl = document.createElement("p");
    hintEl.className = "form-hint warning";
    hintEl.textContent = hint;
    wrapper.appendChild(hintEl);
  }
  return wrapper;
}

function wrapControl(control) {
  const wrapper = document.createElement("div");
  wrapper.className = "form-control";
  wrapper.appendChild(control);
  return wrapper;
}

function createTextInputRow(labelText, { value, placeholder, onInput }) {
  const input = document.createElement("input");
  input.type = "text";
  input.value = value || "";
  if (placeholder) input.placeholder = placeholder;
  input.addEventListener("input", (event) => {
    onInput(event.target.value);
  });
  return makeRow(labelText, wrapControl(input));
}

function createTextareaRow(labelText, { value, placeholder, rows = 10, onInput }) {
  const textarea = document.createElement("textarea");
  textarea.value = value || "";
  if (placeholder) textarea.placeholder = placeholder;
  textarea.rows = rows;
  textarea.addEventListener("input", (event) => {
    onInput(event.target.value);
  });
  return makeRow(labelText, wrapControl(textarea));
}

function createPromptBlock(text, options = {}) {
  const block = document.createElement("div");
  const variant = options.variant === "terminal" ? "terminal" : "prompt";
  block.className = `prompt-area prompt-area--${variant}`;

  const content = document.createElement("pre");
  content.className = "prompt-text";
  content.textContent = text;

  if (options.collapsible) {
    block.classList.add("prompt-collapsible", "collapsed");
    const toggleWrap = document.createElement("div");
    toggleWrap.className = "prompt-collapse-head";
    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "ghost prompt-toggle";
    const collapsedLabel = options.expandLabel || "Розгорнути весь промт";
    const expandedLabel = options.collapseLabel || "Згорнути промт";
    toggleBtn.textContent = collapsedLabel;
    toggleBtn.addEventListener("click", () => {
      const collapsed = block.classList.toggle("collapsed");
      content.hidden = collapsed;
      toggleBtn.textContent = collapsed ? collapsedLabel : expandedLabel;
    });
    toggleWrap.appendChild(toggleBtn);
    block.appendChild(toggleWrap);
    content.hidden = true;
  }

  block.appendChild(content);

  const actions = document.createElement("div");
  actions.className = "prompt-actions";

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "ghost copy-btn";
  copyBtn.textContent = options.copyLabel || "Скопіювати";
  copyBtn.addEventListener("click", () => copyText(text));
  actions.appendChild(copyBtn);

  if (options.ai) {
    const target = options.ai;
    const aiBtn = document.createElement("button");
    aiBtn.type = "button";
    aiBtn.className = "primary prompt-open";
    aiBtn.textContent = options.openLabel || getAiLabel(target);
    aiBtn.addEventListener("click", () => openAi(target));
    actions.appendChild(aiBtn);
  }

  block.appendChild(actions);
  return block;
}

function createLivePromptBlock(getText, options = {}) {
  const block = document.createElement("div");
  block.className = "prompt-area live-prompt";

  const content = document.createElement("pre");
  content.className = "prompt-text";
  block.appendChild(content);

  const actions = document.createElement("div");
  actions.className = "prompt-actions";

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "ghost copy-btn";
  copyBtn.textContent = options.copyLabel || "Скопіювати промпт";
  copyBtn.addEventListener("click", () => {
    const text = getText();
    if (!text?.trim()) {
      showToast("Спочатку заповни поля для промпту.");
      return;
    }
    copyText(text);
  });
  actions.appendChild(copyBtn);

  if (options.ai) {
    const aiBtn = document.createElement("button");
    aiBtn.type = "button";
    aiBtn.className = "primary prompt-open";
    aiBtn.textContent = options.openLabel || getAiLabel(options.ai);
    aiBtn.addEventListener("click", () => openAi(options.ai));
    actions.appendChild(aiBtn);
  }

  block.appendChild(actions);

  const placeholder =
    options.placeholder || "Додай код вище, щоб сформувати промпт.";

  function update() {
    const text = getText();
    if (text?.trim()) {
      content.textContent = text;
      copyBtn.disabled = false;
    } else {
      content.textContent = placeholder;
      copyBtn.disabled = true;
    }
  }

  block.updatePrompt = update;
  update();

  return block;
}

function renderFileCreateBlock(container, key, filename, description = "") {
  if (state.choices.mode !== "chatgpt") return;
  if (state.tools[key] === undefined) state.tools[key] = false;
  const block = document.createElement("div");
  block.className = "info-block";

  const row = document.createElement("div");
  row.className = "info-line";
  const text = document.createElement("div");
  text.className = "info-line-text";
  text.textContent = description
    ? `Створи файл ${filename}. ${description}`
    : `Створи файл ${filename}.`;
  row.appendChild(text);

  const actions = document.createElement("div");
  actions.className = "inline-actions";
  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "ghost copy-btn";
  copyBtn.textContent = "Скопіювати назву файла";
  copyBtn.addEventListener("click", () => copyText(filename));
  actions.appendChild(copyBtn);
  row.appendChild(actions);

  const checkRow = document.createElement("label");
  checkRow.className = "info-line";
  const span = document.createElement("span");
  span.textContent = "Файл створено:";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = !!state.tools[key];
  checkbox.addEventListener("change", (event) => {
    state.tools[key] = event.target.checked;
    if (key === "requirementsCreated") {
      state.tools.requirements = event.target.checked;
    }
    saveState();
  });
  checkRow.append(span, checkbox);

  block.append(row, checkRow);
  container.appendChild(block);
}

function renderCodePromptSection(container, config) {
  const {
    title,
    description,
    dataRef,
    fileLabel = "Файл",
    filePlaceholder,
    codeLabel = "Поточний код",
    codePlaceholder,
    codeRows = 12,
    composePrompt,
    copyLabel,
    promptPlaceholder,
  } = config;

  const section = document.createElement("section");
  section.className = "module-section";

  if (title) {
    const h4 = document.createElement("h4");
    h4.textContent = title;
    section.appendChild(h4);
  }

  if (description) {
    const p = document.createElement("p");
    p.className = "module-section-desc";
    p.textContent = description;
    section.appendChild(p);
  }

  const aiTarget = getPromptAiTarget();

  const updatePrompt = () => {
    saveState();
    promptBlock.updatePrompt();
  };

  const fileRow = createTextInputRow(fileLabel, {
    value: dataRef.file,
    placeholder: filePlaceholder,
    onInput: (value) => {
      dataRef.file = value;
      updatePrompt();
    },
  });
  section.appendChild(fileRow);

  const codeRow = createTextareaRow(codeLabel, {
    value: dataRef.code,
    placeholder:
      codePlaceholder ||
      "Встав сюди повний код файла перед тим, як просити ШІ про оновлення.",
    rows: codeRows,
    onInput: (value) => {
      dataRef.code = value;
      updatePrompt();
    },
  });
  section.appendChild(codeRow);

  const promptBlock = createLivePromptBlock(
    () => composePrompt(dataRef),
    {
      copyLabel,
      ai: aiTarget,
      openLabel: getAiLabel(aiTarget),
      placeholder: promptPlaceholder,
    }
  );
  section.appendChild(promptBlock);

  container.appendChild(section);
  promptBlock.updatePrompt();
}

function buildFullFilePrompt({
  file,
  code,
  instructions,
  language = "python",
}) {
  const content = typeof code === "string" ? code : "";
  const normalizedInstructions = Array.isArray(instructions)
    ? instructions.filter(Boolean)
    : [];
  if (!content.trim()) return "";
  const lines = [
    `Файл: ${file || "main.py"}.`,
    "",
    "Поточний повний код:",
    `\`\`\`${language}`,
    content,
    "```",
  ];
  if (normalizedInstructions.length) {
    lines.push("", "Що потрібно зробити:");
    normalizedInstructions.forEach((item, index) => {
      lines.push(`${index + 1}. ${item}`);
    });
  }
  lines.push(
    "",
    "Перепиши повністю файл, зберігаючи всю існуючу логіку бота. Додай тільки описані зміни. Відповідай лише повним оновленим кодом файлу без пояснень."
  );
  return lines.join("\n");
}

function createToolCard({ title, description, link, prompt, ai }) {
  const card = document.createElement("div");
  card.className = "card";

  const h = document.createElement("h3");
  h.textContent = title;
  card.appendChild(h);

  if (description) {
    const p = document.createElement("p");
    p.textContent = description;
    card.appendChild(p);
  }

  if (prompt) {
    const aiTarget = ai || "chatgpt";
    card.appendChild(
      createPromptBlock(prompt, {
        copyLabel: "Скопіювати інструкцію",
        ai: aiTarget,
        openLabel: getAiLabel(aiTarget),
      })
    );
  }

  if (link) {
    const actions = document.createElement("div");
    actions.className = "prompt-actions";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "primary prompt-open";
    btn.textContent = "Відкрити сайт";
    btn.addEventListener("click", () => openAi(link));
    actions.appendChild(btn);
    card.appendChild(actions);
  }

  return card;
}

function createCarouselSlide({ title, body, code }) {
  const slide = document.createElement("div");
  slide.className = "carousel-slide";

  const h = document.createElement("h4");
  h.textContent = title;
  slide.appendChild(h);

  const p = document.createElement("p");
  p.textContent = body;
  slide.appendChild(p);

  if (code) {
    const pre = document.createElement("pre");
    pre.className = "carousel-code";
    pre.textContent = code;
    slide.appendChild(pre);

    const actions = document.createElement("div");
    actions.className = "prompt-actions";
    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "ghost copy-btn";
    copyBtn.textContent = "Скопіювати код";
    copyBtn.addEventListener("click", () => copyText(code));
    actions.appendChild(copyBtn);
    slide.appendChild(actions);
  }

  return slide;
}

function getAiLabel(target) {
  switch (target) {
    case "codex":
      return "Відкрити Codex";
    case "chatgpt":
    default:
      return "Відкрити ChatGPT";
  }
}

function getPromptAiTarget(kind = "code") {
  if (state.choices.mode !== "codex") return "chatgpt";
  return kind === "code" ? "codex" : "chatgpt";
}

function openAi(target) {
  const url = AI_LINKS[target] || target;
  window.open(url, "_blank", "noopener");
}

function parseAiLine(line) {
  const trimmed = line.trim();
  const withoutBullet = trimmed.startsWith("•")
    ? trimmed.slice(1).trim()
    : trimmed;
  return withoutBullet.startsWith("Попроси ШІ") ? withoutBullet : null;
}

function extractAiPrompt(line) {
  let prompt = line.replace(/^Попроси ШІ:\s*/, "").trim();
  if (prompt.startsWith("«") && prompt.endsWith("»"))
    prompt = prompt.slice(1, -1);
  prompt = prompt
    .replace(/^[«"]/u, "")
    .replace(/[»"]?\.?$/u, "")
    .trim();
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
  if (typeof text !== "string") return text;
  return text.replace(/main\.py/g, entryFile || "main.py");
}

function appendInfoLine(block, line) {
  const row = document.createElement("div");
  row.className = "info-line";

  const text = document.createElement("div");
  text.className = "info-line-text";
  text.textContent = line;
  row.appendChild(text);

  const actions = document.createElement("div");
  actions.className = "inline-actions";

  const snippets = extractBackticked(line);
  snippets.forEach((snippet) => {
    if (snippet === "@BotFather") return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ghost copy-btn";
    btn.textContent = `Скопіювати ${snippet}`;
    btn.addEventListener("click", () => copyText(snippet));
    actions.appendChild(btn);
  });

  if (/BotFather/i.test(line)) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "primary prompt-open";
    btn.textContent = "Відкрити BotFather";
    btn.addEventListener("click", () => openAi("https://t.me/BotFather"));
    actions.appendChild(btn);
  }

  if (actions.childElementCount) row.appendChild(actions);
  block.appendChild(row);
}

function showSetupOverlay({
  duration = 6500,
  messages = [
    "Готуємо середовище для бота…",
    "Будуємо структуру файлів…",
    "Підтягуємо промпти…",
    "Налаштовуємо підказки…",
  ],
} = {}) {
  hideSetupOverlay();
  const overlay = document.createElement("div");
  overlay.id = "setup-overlay";
  overlay.className = "setup-overlay";

  const inner = document.createElement("div");
  inner.className = "setup-box";

  const pulse = document.createElement("div");
  pulse.className = "setup-pulse";
  inner.appendChild(pulse);

  const label = document.createElement("div");
  label.className = "setup-label";
  label.textContent = messages[0] || "Готуємо…";
  inner.appendChild(label);

  const progress = document.createElement("div");
  progress.className = "setup-progress";
  const bar = document.createElement("span");
  progress.appendChild(bar);
  inner.appendChild(progress);

  overlay.appendChild(inner);
  document.body.appendChild(overlay);
  document.body.classList.add("setup-loading");

  let idx = 0;
  let percent = 0;
  const tickMs = 1200;
  setupOverlayTick = setInterval(() => {
    idx = (idx + 1) % messages.length;
    label.textContent = messages[idx] || "Готуємо…";
  }, tickMs);

  setupOverlayTimer = setInterval(() => {
    percent = Math.min(100, percent + Math.ceil(100 * (tickMs / duration)));
    bar.style.width = `${percent}%`;
    if (percent >= 100) {
      hideSetupOverlay();
    }
  }, tickMs);

  setTimeout(() => {
    hideSetupOverlay();
  }, duration);
}

function hideSetupOverlay() {
  if (setupOverlayTick) {
    clearInterval(setupOverlayTick);
    setupOverlayTick = null;
  }
  if (setupOverlayTimer) {
    clearInterval(setupOverlayTimer);
    setupOverlayTimer = null;
  }
  const overlay = document.getElementById("setup-overlay");
  if (overlay?.parentNode) overlay.parentNode.removeChild(overlay);
  document.body.classList.remove("setup-loading");
}

function setupSupportChat() {
  const root = document.getElementById("support-chat");
  if (!root) return;
  const toggle = root.querySelector(".support-toggle");
  const panel = root.querySelector(".support-panel");
  const closeBtn = root.querySelector(".support-close");
  const form = root.querySelector("#support-form");
  const problemInput = root.querySelector("#support-problem");
  const contactInput = root.querySelector("#support-contact");
  const messages = document.getElementById("support-messages");
  const escalateBtn = document.getElementById("support-escalate");
  const doneBtn = document.getElementById("support-done");
  const followup = document.getElementById("support-followup");
  const escalateForm = document.getElementById("support-escalate-form");
  const sendEscalationBtn = document.getElementById("support-send-escalation");

  if (followup) followup.hidden = true;
  if (escalateForm) escalateForm.hidden = true;
  if (escalateBtn) escalateBtn.disabled = true;

  const addMessage = (text, isPrompt = false) => {
    const msg = document.createElement("div");
    msg.className = `support-msg${isPrompt ? " prompt" : ""}`;
    msg.textContent = text;
    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
  };

  const addPromptMessage = (promptText) => {
    const wrap = document.createElement("div");
    wrap.className = "support-msg prompt";
    const pre = document.createElement("pre");
    pre.className = "prompt-text";
    pre.textContent = promptText;
    wrap.appendChild(pre);

    const actions = document.createElement("div");
    actions.className = "prompt-actions";
    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "ghost copy-btn";
    copyBtn.textContent = "Скопіювати промпт";
    copyBtn.addEventListener("click", () => copyText(promptText));
    actions.appendChild(copyBtn);

    const aiTarget = getPromptAiTarget("code");
    const aiBtn = document.createElement("button");
    aiBtn.type = "button";
    aiBtn.className = "primary prompt-open";
    aiBtn.textContent = getAiLabel(aiTarget);
    aiBtn.addEventListener("click", () => openAi(aiTarget));
    actions.appendChild(aiBtn);

    wrap.appendChild(actions);
    messages.appendChild(wrap);
    messages.scrollTop = messages.scrollHeight;
  };

  const buildSupportPrompt = (problemText) => {
    const step = steps[state.currentStep] || {};
    const botId = state.choices.botType;
    const botMeta =
      BOT_TYPES.find((item) => item.id === botId) || { title: "Custom" };
    const env =
      ENVIRONMENTS.find((item) => item.id === state.choices.environment) ||
      null;
    const mode =
      MODE_OPTIONS.find((item) => item.id === state.choices.mode) || null;
    const stepLabel = step?.number
      ? `Крок ${step.number}. ${step.title || ""}`.trim()
      : step?.title || "Невідомий крок";

    return [
      "Ти — помічник із розробки Telegram-ботів на aiogram v3.",
      `Бот: ${botMeta.title || "бот без типу"}.`,
      `Етап: ${stepLabel}.`,
      `Середовище: ${env?.title || "невказано"}, режим ШІ: ${
        mode?.title || "невказано"
      }.`,
      `Опис проблеми: ${problemText}`,
      "Дай покрокове рішення українською, із прикладами команд/коду.",
      "Після рішення нагадай повернутися до гайда та продовжити кроки.",
    ].join("\n");
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const problemText = (problemInput.value || "").trim();
    if (!problemText) {
      showToast("Опиши проблему, щоб згенерувати промпт.");
      return;
    }
    addMessage(`Моя проблема: ${problemText}`);

    const promptText = buildSupportPrompt(problemText);
    addPromptMessage(promptText);
    addMessage(
      "Скопіюй промпт вище та встав у ChatGPT/Codex. Після вирішення повернись до кроків майстра."
    );

    const ticketId = addSupportTicket({
      problem: problemText,
      contact: "",
      prompt: promptText,
      botType: state.choices.botType,
      step: steps[state.currentStep]?.title || "",
      environment: state.choices.environment,
      mode: state.choices.mode,
      status: "open",
    });
    lastSupportIssue = { ticketId, problem: problemText, prompt: promptText };
    escalateBtn.disabled = false;
    followup.hidden = false;
    problemInput.value = "";
  };

  const handleEscalate = async () => {
    if (!lastSupportIssue) {
      showToast("Спочатку опиши проблему та згенеруй промпт.");
      return;
    }
    escalateForm.hidden = false;
    contactInput?.focus();
  };

  const handleSendEscalation = async () => {
    if (!lastSupportIssue) {
      showToast("Спочатку опиши проблему та згенеруй промпт.");
      return;
    }
    const contact = (contactInput.value || "").trim();
    if (!contact) {
      showToast("Вкажи Telegram контакт або chat ID.");
      return;
    }
    updateSupportTicket(lastSupportIssue.ticketId, {
      status: "escalated",
      contact,
      escalatedAt: new Date().toISOString(),
    });
    addMessage(
      "Нам дуже прикро, що виникла ситуація. Ми отримали деталі й відповімо якнайшвидше."
    );
    escalateBtn.disabled = true;
    escalateForm.hidden = true;
  };

  const handleDone = () => {
    messages.innerHTML = "";
    addMessage("Привіт! Опиши проблему, я зберу промпт для ШІ.");
    lastSupportIssue = null;
    followup.hidden = true;
    escalateBtn.disabled = true;
    escalateForm.hidden = true;
    if (contactInput) contactInput.value = "";
    form.reset();
  };

  toggle.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) {
      problemInput.focus();
    }
  });
  closeBtn.addEventListener("click", () => {
    panel.hidden = true;
  });
  form.addEventListener("submit", handleSubmit);
  escalateBtn.addEventListener("click", handleEscalate);
  sendEscalationBtn.addEventListener("click", handleSendEscalation);
  doneBtn.addEventListener("click", handleDone);

  addMessage("Привіт! Опиши проблему, я зберу промпт для ШІ.");
}

// --- Загальні утиліти ---
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function copyText(text) {
  if (!navigator.clipboard) {
    showToast("Скопіювати не вдалося (обмеження браузера).");
    return;
  }
  navigator.clipboard
    .writeText(text)
    .then(() => showToast("Скопійовано у буфер."));
}

function showToast(message) {
  if (!elements.toast) return;
  const target = elements.toastBody || elements.toast;
  target.textContent = message;
  elements.toast.hidden = false;
  elements.toast.style.display = "inline-flex";
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    elements.toast.style.display = "none";
    elements.toast.hidden = true;
  }, 2200);
}

function validateStep(step) {
  switch (step.id) {
    case "bot-type":
      return state.choices.botType ? ok() : fail("Оберіть тип бота.");
    case "mode":
      return state.choices.mode ? ok() : fail("Оберіть режим ШІ.");
    case "environment":
      return state.choices.environment ? ok() : fail("Оберіть середовище.");
    case "tools": {
      const checklist =
        state.choices.environment === "codespaces"
          ? CODESPACES_TOOL_CHECKLIST
          : TOOL_CHECKLIST;
      const required = checklist.filter(
        (tool) => !tool.optional || state.choices.mode === "codex"
      );
      required.forEach((tool) => {
        if (state.tools[tool.id] === undefined) state.tools[tool.id] = false;
      });
      const ready = required.every((tool) => state.tools[tool.id]);
      return ready ? ok() : fail("Постав галочки у чек-листі.");
    }
    case "requirements":
      return state.tools.requirements
        ? ok()
        : fail("Створи requirements.txt або познач, що зробиш це.");
    case "env-file":
      return state.tools.env
        ? ok()
        : fail("Створи .env або познач, що зробиш це.");
    case "backend-choice":
      return state.choices.backend ? ok() : fail("Оберіть тип зберігання.");
    case "custom-requirements": {
      const custom = ensureCustomState();
      return custom.requirements?.trim()
        ? ok()
        : fail("Опиши, якого бота ти хочеш.");
    }
    case "custom-brief-import": {
      const custom = ensureCustomState();
      return custom.brief
        ? ok()
        : fail("Додай JSON-бриф і натисни «Зберегти бриф».");
    }
    case "custom-files": {
      const custom = ensureCustomState();
      if (!custom.files.length)
        return fail("Спочатку збережи бриф, щоб побудувати список файлів.");
      const allDone = custom.files.every((file) => file.done);
      return allDone ? ok() : fail("Познач усі файли як виконані.");
    }
    case "custom-terminal": {
      const custom = ensureCustomState();
      return custom.commandsText?.trim()
        ? ok()
        : fail("Додай або підтвердь команди для запуску.");
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
  const environment = ENVIRONMENTS.find(
    (item) => item.id === state.choices.environment
  );
  const backend = BACKEND_OPTIONS.find(
    (item) => item.id === state.choices.backend
  );

  return [
    `Тип бота: ${
      type ? `${type.title} (${type.description})` : "ще не обрано"
    }.`,
    `Режим роботи: ${mode ? mode.title : "ще не обрано"}.`,
    `Середовище: ${environment ? environment.title : "ще не обрано"}.`,
    `Команди: ${
      state.commands.length ? state.commands.join(", ") : "/start, /help"
    }.`,
    `Бекенд: ${backend ? backend.title : "JSON (за замовчуванням)"}.`,
    "Мова інтерфейсу: українська.",
    "Канал: приватні чати (dm).",
    "",
    "Ціль: створити робочого Telegram-бота з покроковим налаштуванням.",
    "Скопіюй цей бриф у ChatGPT або Codex, щоб отримати інструкції з коду.",
  ].join("\n");
}

function generateManualFilePrompt(entryFile, currentState = state) {
  const type = BOT_TYPES.find(
    (item) => item.id === currentState.choices.botType
  );
  const backend = BACKEND_OPTIONS.find(
    (item) => item.id === currentState.choices.backend
  );

  return [
    `Мені потрібен файл ${entryFile}.`,
    `Тип бота: ${
      type ? `${type.title} — ${type.description}` : "базовий асистент"
    }.`,
    `Команди: ${
      currentState.commands.length
        ? currentState.commands.join(", ")
        : "/start, /help"
    }.`,
    `Бекенд/зберігання: ${
      backend ? backend.title : "JSON (просте збереження у файлі)"
    }.`,
    `Покажи повний код файла ${entryFile} одним блоком без коментарів та зайвих пояснень.`,
    "Наприкінці коротко нагадай, як запустити бота (python " + entryFile + ").",
  ].join("\n");
}

function getBackendTitle(currentState = state) {
  const backend = BACKEND_OPTIONS.find(
    (item) => item.id === currentState?.choices?.backend
  );
  return backend ? backend.title : "JSON файл (за замовчуванням)";
}

function generateCodePrompt() {
  const entryFile = getEntryFile();
  const manualPrompt = generateManualFilePrompt(entryFile);

  return [
    "Ти — досвідчений Python-розробник. Побудуй Telegram-бота на aiogram v3.",
    manualPrompt,
    "Не додавай інші файли чи розрізнені фрагменти — тільки повний код зазначеного файла.",
    "Після коду дай інструкції з встановлення залежностей (pip install -r requirements.txt) та запуску бота.",
    "Використовуй дружні повідомлення українською.",
  ].join("\n");
}

function getEnvStorageKey(envId) {
  return envId ? `${ENV_STATE_PREFIX}${envId}` : STORAGE_KEY;
}

function loadState(targetEnvId = envState.activeId) {
  try {
    const raw = localStorage.getItem(getEnvStorageKey(targetEnvId));
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    const merged = Object.assign(structuredClone(defaultState), parsed);
  merged.tools = Object.assign({}, defaultState.tools, merged.tools);
  if (merged.tools.requirements === undefined)
    merged.tools.requirements = false;
  if (merged.tools.env === undefined) merged.tools.env = false;
  if (merged.tools.codespace === undefined) merged.tools.codespace = false;
  if (merged.tools.browser === undefined) merged.tools.browser = false;
   if (merged.tools.requirementsCreated === undefined)
      merged.tools.requirementsCreated = false;
    if (merged.tools.dbFileCreated === undefined)
      merged.tools.dbFileCreated = false;
    if (merged.tools.repoFileCreated === undefined)
      merged.tools.repoFileCreated = false;
    if (merged.tools.storageFileCreated === undefined)
      merged.tools.storageFileCreated = false;
    if (merged.tools.requirementsCreated === undefined)
      merged.tools.requirementsCreated = false;
    if (merged.tools.dbFileCreated === undefined)
      merged.tools.dbFileCreated = false;
    if (merged.tools.repoFileCreated === undefined)
      merged.tools.repoFileCreated = false;
    if (merged.tools.storageFileCreated === undefined)
      merged.tools.storageFileCreated = false;
    merged.custom = Object.assign(
      structuredClone(defaultCustomState),
      merged.custom || {}
    );
    if (!Array.isArray(merged.custom.files)) merged.custom.files = [];
    if (!merged.custom.diag)
      merged.custom.diag = { description: "", logs: "", prompt: "" };
    if (!merged.choices.entryFile)
      merged.choices.entryFile = ENTRY_FILE_OPTIONS[0].id;
    merged.ui = Object.assign(structuredClone(defaultUiState), merged.ui || {});
    if (!merged.ui.replyVariant) merged.ui.replyVariant = "default";
    if (!merged.ui.inlineVariant) merged.ui.inlineVariant = "default";
    if (typeof merged.ui.replyCustomSpec !== "string")
      merged.ui.replyCustomSpec = "";
    if (typeof merged.ui.inlineCustomSpec !== "string")
      merged.ui.inlineCustomSpec = "";
    ensureExtraModules(merged);
    ensureExtraModuleData(merged);
    return merged;
  } catch (error) {
    console.error("Не вдалося завантажити стан", error);
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(getEnvStorageKey(envState.activeId), JSON.stringify(state));
}

function structuredClone(value) {
  return JSON.parse(JSON.stringify(value));
}
function setupTopbarControls() {
  const resetBtn = document.getElementById('nav-reset');
  const docsBtn = document.getElementById('nav-docs');
  const envBtn = document.getElementById('nav-env');
  const logoutBtn = document.getElementById('nav-logout');
  const adminBtn = document.getElementById('nav-admin');
  const burger = document.getElementById('nav-burger');
  const popup = document.getElementById('nav-popup');
  const overlay = document.getElementById('nav-overlay');
  const closeBtn = document.getElementById('nav-close');

  if (resetBtn) resetBtn.addEventListener('click', () => handleReset());
  if (docsBtn) docsBtn.addEventListener('click', () => openDocs());
  if (envBtn)
    envBtn.addEventListener('click', async () => {
      await loadEnvironments();
      showEnvScreen();
    });
  if (adminBtn) adminBtn.addEventListener('click', () => toggleAdminPanel());
  if (logoutBtn) logoutBtn.addEventListener('click', () => handleLogout());

  if (burger && popup && overlay) {
    burger.addEventListener('click', () => {
      overlay.hidden = false;
      popup.classList.add('open');
    });
    const close = () => {
      overlay.hidden = true;
      popup.classList.remove('open');
    };
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close();
    });
    if (closeBtn) closeBtn.addEventListener('click', close);
    popup.addEventListener('click', (event) => {
      const btn = event.target.closest('button[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === 'reset') handleReset();
      if (action === 'docs') openDocs();
      if (action === 'env') loadEnvironments().then(showEnvScreen);
      if (action === 'admin') toggleAdminPanel();
      if (action === 'logout') handleLogout();
      close();
    });
  }
}
