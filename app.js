const API_URL = "http://localhost:4000";

async function api(path, options = {}) {
  const res = await fetch(API_URL + path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    console.error("API error", res.status, data);
    throw new Error(data?.message || "API error");
  }
  return data;
}

const ENV_STATE_STORAGE_PREFIX = "gp_env_state_";
const ENV_ID_STORAGE_KEY = "gp_active_env_id";
const CUSTOM_BRIEF_STEP_ID = "custom-brief-import";
const BACKEND_CODE_BY_TYPE_ID = {
  task: "task_manager",
  crm: "crm_bot",
  habit: "fitness_bot",
  faq: "faq_bot",
  shop: "shop_bot",
  booking: "booking_bot",
  custom: "custom_bot",
};

function getBackendCodeForType(typeId) {
  return BACKEND_CODE_BY_TYPE_ID[typeId] || typeId;
}

function getFrontendBotConfigs() {
  return BOT_TYPES.map((bot) => ({
    ...bot,
    code: bot.id,
    frontendCode: bot.id,
    backendCode: getBackendCodeForType(bot.id),
    backendId: null,
    price: bot.price ?? null,
    currency: bot.currency ?? "UAH",
    isFree: bot.isFree ?? false,
    isActive: bot.isActive ?? true,
    totalSteps: bot.totalSteps ?? 30,
  }));
}

function getBotMetaByCode(code) {
  if (!code) return null;
  return (
    BOT_TYPES.find((item) => item.id === code) ||
    (appState.bots || mergedBots || []).find(
      (bot) => (bot.frontendCode || bot.code) === code
    ) ||
    null
  );
}

function applyCommandsForBotType(typeId, targetState = state) {
  if (!targetState || !typeId || typeId === "custom") return;
  const meta = getBotMetaByCode(typeId);
  if (meta && Array.isArray(meta.commands) && meta.commands.length) {
    targetState.commands = [...meta.commands];
  }
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("uk-UA", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatMoney(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "0.00";
  return num.toFixed(2);
}

function getActiveEnvStorageKey() {
  const id =
    (appState && appState.activeEnvironmentId != null
      ? appState.activeEnvironmentId
      : "default");
  return ENV_STATE_STORAGE_PREFIX + String(id);
}

const appState = {
  user: null,
  bots: [],
  environments: [],
  activeEnvironmentId: null,
  admin: {
    bots: [],
    settings: {},
    users: [],
    selectedUserId: null,
    userPurchases: [],
    analyticsOverview: null,
    userAnalytics: {},
  },
};

function getActiveEnvironment() {
  if (!Array.isArray(appState.environments)) return null;
  if (!appState.activeEnvironmentId) return null;
  return (
    appState.environments.find(
      (env) => env.id === appState.activeEnvironmentId
    ) || null
  );
}

function updateEnvironmentInState(envId, patch) {
  if (!envId || !patch || typeof patch !== "object") return;
  if (!Array.isArray(appState.environments)) return;
  const idx = appState.environments.findIndex((env) => env.id === envId);
  if (idx === -1) return;
  appState.environments[idx] = {
    ...appState.environments[idx],
    ...patch,
  };
}

function isActiveEnvironmentBriefLocked() {
  const env = getActiveEnvironment();
  if (!env) return false;
  return Boolean(env.brief_locked ?? env.briefLocked);
}

function scheduleBriefLock(stepNumber) {
  if (!appState.activeEnvironmentId) return;
  const normalized = Number(stepNumber);
  if (!Number.isInteger(normalized) || normalized < 1) return;
  pendingBriefLock = {
    envId: appState.activeEnvironmentId,
    briefStep: normalized,
  };
}

try {
  const rawEnvId = localStorage.getItem(ENV_ID_STORAGE_KEY);
  if (rawEnvId) {
    const parsed = Number(rawEnvId);
    appState.activeEnvironmentId = Number.isNaN(parsed) ? null : parsed;
  }
} catch (error) {
  console.warn("Cannot read activeEnvironmentId from storage", error);
}

let backendBots = [];
let mergedBots = [];

const uiState = {
  loginScreen: document.getElementById("login-screen"),
  appShell: document.getElementById("app"),
  topbar: document.getElementById("topbar"),
};

const topbarOverlay = document.getElementById("nav-overlay");
const topbarMenu = document.getElementById("nav-popup");
const topbarBurger = document.getElementById("nav-burger");
const topbarClose = document.getElementById("nav-close");
const detailsOverlay = document.getElementById("details-overlay");
const detailsBody = document.getElementById("details-body");
const detailsClose = document.getElementById("details-close");

function setAuthMode(mode) {
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const tabs = document.querySelectorAll(".auth-tab");

  tabs.forEach((btn) => {
    btn.classList.toggle("auth-tab--active", (btn.dataset.mode || "login") === mode);
  });

  if (loginForm) loginForm.hidden = mode !== "login";
  if (registerForm) registerForm.hidden = mode !== "register";
}

document.querySelectorAll(".auth-tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    setAuthMode(btn.dataset.mode || "login");
  });
});
setAuthMode("login");

async function initApp() {
  if (!appState.user) return;
  if (uiState.loginScreen) uiState.loginScreen.hidden = true;
  if (uiState.appShell) uiState.appShell.hidden = false;
  if (uiState.topbar) uiState.topbar.hidden = false;
  try {
    await loadEnvironments();
  } catch (error) {
    console.error("Failed to load environments", error);
  }
  showEnvScreen();
  if (appState.user.role === "admin") {
    ensureAdminControls();
  } else {
    const panel = document.getElementById("admin-panel");
    if (panel) panel.hidden = true;
    const btn = document.getElementById("admin-toggle");
    if (btn) btn.remove();
    const mobileAdminBtn = document.querySelector(
      '#nav-popup button[data-action="admin"]'
    );
    if (mobileAdminBtn) mobileAdminBtn.remove();
  }
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const emailInput = document.querySelector("#login-email");
  const passwordInput = document.querySelector("#login-password");
  const email = emailInput?.value.trim();
  const password = passwordInput?.value.trim();

  if (!email || !password) {
    showToast("Введіть email та пароль.", "error");
    return;
  }

  try {
    const result = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    appState.user = result.user;
    await initApp();
    await loadBots();
  } catch (error) {
    console.error("Login failed", error);
    showToast("Помилка входу", "error");
  }
}

const loginForm = document.querySelector("#login-form");
if (loginForm) {
  loginForm.addEventListener("submit", handleLoginSubmit);
} else {
  if (uiState.appShell) uiState.appShell.hidden = false;
}

async function handleRegisterSubmit(event) {
  event.preventDefault();

  const firstName = document.getElementById("reg-first-name")?.value.trim();
  const lastName = document.getElementById("reg-last-name")?.value.trim();
  const patronymic = document.getElementById("reg-patronymic")?.value.trim();
  const phoneCode = document.getElementById("reg-phone-code")?.value || "";
  const phoneNumberRaw = document
    .getElementById("reg-phone-number")
    ?.value || "";
  const phoneDigits = phoneNumberRaw.replace(/\D/g, "");
  const email = document.getElementById("reg-email")?.value.trim();
  const password = document.getElementById("reg-password")?.value.trim();

  if (!firstName || !lastName || !phoneDigits || !email || !password) {
    showToast("Заповни всі обовʼязкові поля.", "error");
    return;
  }

  if (phoneDigits.length < 7 || phoneDigits.length > 12) {
    showToast("Перевір довжину номера телефону (7-12 цифр).", "error");
    return;
  }

  const full_name = [lastName, firstName, patronymic].filter(Boolean).join(" ");
  const phone = `${phoneCode}${phoneDigits}`;

  try {
    const result = await api("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        full_name,
        phone,
        email,
        password,
      }),
    });

    appState.user = result.user;
    await initApp();
    await loadBots();
  } catch (error) {
    console.error("Register failed", error);
    showToast("Помилка реєстрації", "error");
  }
}

const registerForm = document.querySelector("#register-form");
if (registerForm) {
  registerForm.addEventListener("submit", handleRegisterSubmit);
}

async function handleLogout() {
  try {
    await api("/auth/logout", { method: "POST" });
  } catch (error) {
    console.error("Logout error", error);
  }
  if (typeof appState !== "undefined") {
    appState.user = null;
  }
  window.location.reload();
}

function renderEnvScreen() {
  const screen = document.getElementById("env-screen");
  if (!screen) return;
  const list = document.getElementById("env-list");
  if (!list) return;
  list.innerHTML = "";
  const envs = Array.isArray(appState.environments)
    ? appState.environments
    : [];
  if (!envs.length) {
    const empty = document.createElement("div");
    empty.className = "env-card env-empty";
    empty.textContent = "Поки що немає середовищ.";
    list.appendChild(empty);
  } else {
    const getBotMeta = (env) => {
      const botId = env.bot_id || env.botId || null;
      const botCode = env.bot_code || env.botCode || null;
      let botMatch = null;
      if (botId && Array.isArray(mergedBots)) {
        botMatch = mergedBots.find((item) => item.backendId === botId) || null;
      }
      if (!botMatch && botCode && Array.isArray(mergedBots)) {
        botMatch = mergedBots.find((item) => item.code === botCode) || null;
      }
      const type = botCode
        ? BOT_TYPES.find((item) => item.id === botCode)
        : null;
      return {
        title: botMatch?.title || type?.title || null,
        totalSteps:
          botMatch?.totalSteps ||
          type?.totalSteps ||
          env.total_steps ||
          env.totalSteps ||
          null,
      };
    };

    envs.forEach((env) => {
      const card = document.createElement("div");
      card.className = "env-card";
      const currentStep =
        Number(env.current_step ?? env.currentStep ?? 1) || 1;
      const botMeta = getBotMeta(env);
      const totalSteps = Number(botMeta.totalSteps ?? 30) || 30;
      const isBriefLocked = Boolean(env.brief_locked ?? env.briefLocked);
      const progress = Math.min(
        100,
        Math.max(0, (currentStep / totalSteps) * 100)
      );

      const header = document.createElement("div");
      header.className = "env-card-header";
      const titleEl = document.createElement("div");
      titleEl.className = "env-card-title";
      titleEl.textContent = env.title || "Без назви";
      const stepEl = document.createElement("div");
      stepEl.className = "env-card-step";
      stepEl.textContent = `Крок ${currentStep} із ${totalSteps}`;
      header.appendChild(titleEl);
      header.appendChild(stepEl);
      card.appendChild(header);

      const metaItems = [];
      if (botMeta.title) metaItems.push(`Тип: ${botMeta.title}`);
      const updatedValue = env.updated_at || env.updatedAt;
      if (updatedValue) {
        const updatedDate = new Date(updatedValue);
        if (!Number.isNaN(updatedDate.getTime())) {
          metaItems.push(
            `Оновлено: ${updatedDate.toLocaleString("uk-UA", {
              dateStyle: "medium",
              timeStyle: "short",
            })}`
          );
        }
      }
      if (metaItems.length) {
        const meta = document.createElement("div");
        meta.className = "env-card-meta";
        meta.textContent = metaItems.join(" • ");
        card.appendChild(meta);
      }
      if (isBriefLocked) {
        const lockBadge = document.createElement("div");
        lockBadge.className = "env-card-lock";
        lockBadge.textContent = "🔒 Бриф зафіксовано";
        card.appendChild(lockBadge);
      }

      const progressWrap = document.createElement("div");
      progressWrap.className = "env-card-progress";
      const bar = document.createElement("div");
      bar.className = "env-card-progress-bar";
      bar.style.width = `${progress}%`;
      progressWrap.appendChild(bar);
      card.appendChild(progressWrap);

      card.addEventListener("click", () => {
        console.log("Environment selected", env.id);
        selectEnvironment(env);
      });
      list.appendChild(card);
    });
  }
  const createBtn = document.getElementById("env-create-btn");
  if (createBtn && !createBtn.dataset.bound) {
    createBtn.addEventListener("click", () => createEnvironment());
    createBtn.dataset.bound = "1";
  }
  const backBtn = document.getElementById("env-back-btn");
  if (backBtn && !backBtn.dataset.bound) {
    backBtn.addEventListener("click", () => hideEnvScreen());
    backBtn.dataset.bound = "1";
  }
}

function selectEnvironment(env) {
  if (!env || !env.id) return;
  appState.activeEnvironmentId = env.id;
  pendingBriefLock = null;
  try {
    localStorage.setItem(ENV_ID_STORAGE_KEY, String(env.id));
  } catch (error) {
    console.warn("Cannot persist activeEnvironmentId", error);
  }

  const envScreen = document.getElementById("env-screen");
  if (envScreen) envScreen.hidden = true;

  const wizardRoot = document.getElementById("wizard-root");
  if (wizardRoot) wizardRoot.hidden = false;
  if (uiState.appShell) uiState.appShell.hidden = false;

  loadStateForActiveEnvironment();

  if (typeof saveState === "function") {
    saveState();
  }
  if (typeof draw === "function") {
    draw(true);
  }

  console.log("Environment selected", env.id);
}

function showEnvScreen() {
  const screen = document.getElementById("env-screen");
  if (screen) screen.hidden = false;
  const wizard = document.getElementById("wizard-root") || uiState.appShell;
  if (wizard) wizard.hidden = true;
  renderEnvScreen();
}

function hideEnvScreen() {
  const screen = document.getElementById("env-screen");
  if (screen) screen.hidden = true;
  const wizard = document.getElementById("wizard-root") || uiState.appShell;
  if (wizard) wizard.hidden = false;
}

function openTopbarMenu() {
  if (topbarOverlay) topbarOverlay.hidden = false;
  if (topbarMenu) topbarMenu.classList.add("open");
  document.body.classList.add("menu-open");
}

function closeTopbarMenu() {
  if (topbarOverlay) topbarOverlay.hidden = true;
  if (topbarMenu) topbarMenu.classList.remove("open");
  document.body.classList.remove("menu-open");
}

async function openEnvScreen() {
  await loadEnvironments();
  showEnvScreen();
}

function handleReset() {
  if (!confirm("Скинути всі кроки та повернутися до початку?")) return;
  closeDocs();
  closeTopbarMenu();
  resetCurrentEnvironmentState();
  showToast("Майстер скинуто.");
}

async function loadBots() {
  try {
    const data = await api("/bots", { method: "GET" });
    const botsFromApi = Array.isArray(data)
      ? data
      : Array.isArray(data?.bots)
      ? data.bots
      : [];
    backendBots = botsFromApi;
    const frontendBots = getFrontendBotConfigs();

    const frontendByBackendCode = {};
    frontendBots.forEach((f) => {
      frontendByBackendCode[f.backendCode] = f;
    });

    const frontendByCode = {};
    frontendBots.forEach((f) => {
      frontendByCode[f.code] = f;
    });

    mergedBots = backendBots.map((b) => {
      const fb = frontendByBackendCode[b.code] || frontendByCode[b.code] || {};
      return {
        ...fb,
        code: fb.code || b.code,
        frontendCode: fb.code || null,
        backendCode: b.code ?? fb.backendCode ?? null,
        backendId: b.id,
        price: b.price,
        currency: b.currency,
        isFree: b.is_free,
        isActive: b.is_active,
        totalSteps: b.total_steps,
      };
    });
    frontendBots.forEach((fb) => {
      const exists = mergedBots.some(
        (bot) => (bot.frontendCode || bot.code) === fb.code
      );
      if (!exists) {
        mergedBots.push({ ...fb });
      }
    });
    console.log("mergedBots", mergedBots);
    appState.bots = mergedBots;
    if (typeof state !== "undefined" && state.currentStep === 2) {
      draw(true);
    }
  } catch (error) {
    console.error("Failed to load bots", error);
  }
}

async function loadEnvironments() {
  try {
    const res = await api("/envs", { method: "GET" });
    const envs = Array.isArray(res?.envs)
      ? res.envs
      : Array.isArray(res)
      ? res
      : [];
    appState.environments = envs;
    renderEnvScreen();
  } catch (error) {
    console.error("Failed to load environments", error);
  }
}

async function createEnvironment() {
  const title = prompt("Назва середовища:", "Мій бот");
  if (!title) return;
  try {
    const res = await api("/envs", {
      method: "POST",
      body: JSON.stringify({ title, notes: "" }),
    });
    if (res?.env) {
      if (!Array.isArray(appState.environments)) {
        appState.environments = [];
      }
      appState.environments.push(res.env);
      renderEnvScreen();
    }
  } catch (error) {
    console.error("Failed to create environment", error);
    showToast("Не вдалося створити середовище", "error");
  }
}

async function syncEnvironmentStep() {
  if (!appState.activeEnvironmentId) return;
  if (typeof state?.currentStep !== "number") return;
  const step = Math.max(1, Number(state.currentStep) + 1);
  if (lastSyncedStep === step) return;

  const shouldLockBrief =
    pendingBriefLock &&
    pendingBriefLock.envId === appState.activeEnvironmentId &&
    Number.isInteger(pendingBriefLock.briefStep) &&
    pendingBriefLock.briefStep > 0;

  try {
    const payload = { currentStep: step };
    if (shouldLockBrief) {
      payload.lockBrief = true;
      payload.briefStep = pendingBriefLock.briefStep;
    }

    const response = await api(`/envs/${appState.activeEnvironmentId}/step`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    lastSyncedStep = step;
    if (shouldLockBrief) {
      pendingBriefLock = null;
    }
    if (Array.isArray(appState.environments)) {
      const patch = {
        current_step: response?.current_step ?? step,
      };
      if (response?.brief_locked !== undefined) {
        patch.brief_locked = response.brief_locked;
      }
      if (response?.brief_step !== undefined) {
        patch.brief_step = response.brief_step;
      }
      updateEnvironmentInState(appState.activeEnvironmentId, patch);
    }
    const envScreen = document.getElementById("env-screen");
    if (envScreen && !envScreen.hidden) {
      renderEnvScreen();
    }
  } catch (error) {
    console.warn("Failed to sync environment step", error);
  }
}

function toggleAdminPanel() {
  const panel = document.getElementById("admin-panel");
  if (!panel) return;
  closeTopbarMenu();
  if (panel.hidden) {
    panel.hidden = false;
    loadAdminData();
  } else {
    panel.hidden = true;
  }
}

function ensureAdminControls() {
  const navContainer = document.querySelector(".topbar-nav");
  if (navContainer && !document.getElementById("admin-toggle")) {
    const button = document.createElement("button");
    button.id = "admin-toggle";
    button.type = "button";
    button.textContent = "Адмінка";
    button.addEventListener("click", () => toggleAdminPanel());
    const logoutBtn = document.getElementById("nav-logout");
    if (logoutBtn && logoutBtn.parentElement === navContainer) {
      navContainer.insertBefore(button, logoutBtn);
    } else {
      navContainer.appendChild(button);
    }
  }

  const popup = document.getElementById("nav-popup");
  if (popup && !popup.querySelector('button[data-action="admin"]')) {
    const mobileButton = document.createElement("button");
    mobileButton.type = "button";
    mobileButton.dataset.action = "admin";
    mobileButton.textContent = "Адмінка";
    const logoutAction = popup.querySelector('button[data-action="logout"]');
    if (logoutAction) {
      popup.insertBefore(mobileButton, logoutAction);
    } else {
      popup.appendChild(mobileButton);
    }
  }
}

async function ensureAccessForStep(targetStep) {
  if (!appState.user || appState.user.role === "admin") return true;
  if (targetStep <= 2) return true;

  const code = state.choices.botType;
  if (!code) {
    showToast("Спочатку обери тип бота", "error");
    return false;
  }

  const bot = Array.isArray(mergedBots)
    ? mergedBots.find((b) => b.code === code)
    : null;
  if (!bot || !bot.backendId) {
    console.warn("No backend bot for code", code, bot);
    showToast("Цей тип бота ще не підʼєднаний до бекенду.", "error");
    return false;
  }

  try {
    const access = await api(`/bots/${bot.backendId}/access`, { method: "GET" });
    if (!access?.hasAccess) {
      showToast("Спочатку оплати цього бота, щоб рухатися далі.", "error");
      return false;
    }
    return true;
  } catch (error) {
    console.error("Failed to check bot access", error);
    showToast("Не вдалось перевірити доступ до бота. Спробуй ще раз.", "error");
    return false;
  }
}

async function handleNextClick() {
  if (!steps.length) return;
  const step = steps[state.currentStep];
  const validation = validateStep(step);
  if (!validation.allow) {
    showToast(validation.message, "error");
    return;
  }
  if (state.currentStep >= steps.length - 1) {
    showToast("Готово! Можеш переглядати попередні кроки.");
    return;
  }
  const targetStep = state.currentStep + 1;
  const ok = await ensureAccessForStep(targetStep);
  if (!ok) return;
  const shouldLockBrief =
    isCustomBot() &&
    step?.id === CUSTOM_BRIEF_STEP_ID &&
    !isActiveEnvironmentBriefLocked();
  const briefStepNumber = step?.number || state.currentStep + 1;
  state.currentStep = targetStep;
  if (shouldLockBrief) {
    scheduleBriefLock(briefStepNumber);
  }
  saveState();
  draw(true);
}

async function loadAdminData() {
  if (!appState.user || appState.user.role !== "admin") return;
  try {
    const [
      botsResponse,
      settingsResponse,
      usersResponse,
      overviewResponse,
    ] = await Promise.all([
      api("/admin/bots", { method: "GET" }),
      api("/admin/settings", { method: "GET" }),
      api("/admin/users", { method: "GET" }),
      api("/admin/analytics/overview", { method: "GET" }),
    ]);
    appState.admin.bots = Array.isArray(botsResponse?.bots)
      ? botsResponse.bots
      : Array.isArray(botsResponse)
      ? botsResponse
      : [];
    appState.admin.settings =
      settingsResponse?.settings || settingsResponse || {};
    appState.admin.users = Array.isArray(usersResponse?.users)
      ? usersResponse.users
      : Array.isArray(usersResponse)
      ? usersResponse
      : [];
    appState.admin.analyticsOverview = overviewResponse || null;
    if (!appState.admin.userAnalytics) {
      appState.admin.userAnalytics = {};
    }
    if (
      !appState.admin.selectedUserId &&
      appState.admin.users &&
      appState.admin.users.length
    ) {
      appState.admin.selectedUserId = appState.admin.users[0].id;
      await loadAdminUserPurchases(appState.admin.selectedUserId);
      return;
    }
    renderAdminPanel();
  } catch (error) {
    console.error("Failed to load admin data", error);
    showToast("Не вдалося завантажити адмін-дані", "error");
  }
}

async function loadAdminUserPurchases(userId) {
  if (!userId) return;
  try {
    const [purchasesResponse, analyticsResponse] = await Promise.all([
      api(`/admin/users/${userId}/purchases`, {
        method: "GET",
      }),
      api(`/admin/users/${userId}/analytics`, {
        method: "GET",
      }),
    ]);
    appState.admin.selectedUserId = userId;
    appState.admin.userPurchases = Array.isArray(
      purchasesResponse?.purchases
    )
      ? purchasesResponse.purchases
      : Array.isArray(purchasesResponse)
      ? purchasesResponse
      : [];
    if (!appState.admin.userAnalytics) appState.admin.userAnalytics = {};
    appState.admin.userAnalytics[userId] = analyticsResponse || null;
    renderAdminPanel();
  } catch (error) {
    console.error("Failed to load user purchases", error);
    showToast("Не вдалося завантажити покупки користувача", "error");
  }
}

function renderAdminPanel() {
  const panel = document.getElementById("admin-panel");
  if (!panel) return;
  if (!appState.user || appState.user.role !== "admin") {
    panel.hidden = true;
    panel.innerHTML = "";
    return;
  }

  panel.hidden = false;

  const bots = Array.isArray(appState.admin.bots) ? appState.admin.bots : [];
  const users = Array.isArray(appState.admin.users) ? appState.admin.users : [];
  const purchases = Array.isArray(appState.admin.userPurchases)
    ? appState.admin.userPurchases
    : [];
  const paymentsEnabled =
    appState.admin.settings?.payments_enabled === "true" ||
    appState.admin.settings?.payments_enabled === true;
  const overview = appState.admin.analyticsOverview || {};
  const overviewRevenue = Array.isArray(overview.totalRevenueByCurrency)
    ? overview.totalRevenueByCurrency
    : [];
  const overviewRevenueHtml = overviewRevenue.length
    ? overviewRevenue
        .map(
          (item) =>
            `<span class="admin-chip">${item.currency}: ${formatMoney(
              item.total
            )}</span>`
        )
        .join("")
    : '<span class="admin-chip admin-chip--muted">Немає даних</span>';
  const overviewBotsCount = Array.isArray(overview.botsStats)
    ? overview.botsStats.length
    : 0;
  const userAnalytics =
    (appState.admin.selectedUserId &&
      appState.admin.userAnalytics &&
      appState.admin.userAnalytics[appState.admin.selectedUserId]) ||
    null;

  const userRevenueChips = userAnalytics
    ? userAnalytics.revenueByCurrency &&
      userAnalytics.revenueByCurrency.length
      ? userAnalytics.revenueByCurrency
          .map(
            (item) =>
              `<span class="admin-chip">${item.currency}: ${formatMoney(
                item.total
              )}</span>`
          )
          .join("")
      : '<span class="admin-chip admin-chip--muted">Немає оплат</span>'
    : "";

  const userEnvRows =
    userAnalytics &&
    Array.isArray(userAnalytics.envs) &&
    userAnalytics.envs.length
      ? userAnalytics.envs
          .map(
            (env) => `
          <tr>
            <td>${env.title || "Без назви"}</td>
            <td>${env.botName || env.botCode || "—"}</td>
            <td>${env.currentStep || 0}</td>
            <td>${formatDateTime(env.createdAt)}</td>
            <td>${formatDateTime(env.updatedAt)}</td>
          </tr>
        `
          )
          .join("")
      : `<tr><td colspan="5">Немає середовищ.</td></tr>`;

  const userBotsRows =
    userAnalytics &&
    Array.isArray(userAnalytics.botsBreakdown) &&
    userAnalytics.botsBreakdown.length
      ? userAnalytics.botsBreakdown
          .map(
            (bot) => `
        <tr>
          <td>${bot.botName || bot.botCode || `Bot #${bot.botId}`}</td>
          <td>${bot.paidPurchases}</td>
          <td>${formatMoney(bot.totalAmount)}</td>
        </tr>
      `
          )
          .join("")
      : `<tr><td colspan="3">Немає оплат.</td></tr>`;

  const userSummaryBlock = userAnalytics
    ? `
      <section class="admin-user-analytics">
        <header>
          <div class="admin-user-meta">
            <h4>${userAnalytics.user?.full_name || "Користувач"} (ID ${
        userAnalytics.user?.id
      })</h4>
            <p>
              ${userAnalytics.user?.email || "—"} • ${
        userAnalytics.user?.phone || "—"
      } • Зареєстровано: ${formatDateTime(userAnalytics.user?.created_at)}
            </p>
          </div>
          <div class="admin-chip-row">
            <span class="admin-chip">Середовищ: ${userAnalytics.totalEnvs}</span>
            <span class="admin-chip">Оплат: ${
              userAnalytics.totalPaidPurchases
            }</span>
            ${userRevenueChips}
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
                    <th>Створено</th>
                    <th>Оновлено</th>
                  </tr>
                </thead>
                <tbody>
                  ${userEnvRows}
                </tbody>
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
                    <th>Оплат</th>
                    <th>Сума</th>
                  </tr>
                </thead>
                <tbody>
                  ${userBotsRows}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    `
    : "";

  panel.innerHTML = `
    <h2>Адмін-панель</h2>
    <div class="admin-analytics">
      <div class="admin-analytics-card">
        <span class="admin-analytics-label">Користувачів</span>
        <strong>${overview.totalUsers ?? 0}</strong>
      </div>
      <div class="admin-analytics-card">
        <span class="admin-analytics-label">Оплачених покупок</span>
        <strong>${overview.totalPaidPurchases ?? 0}</strong>
      </div>
      <div class="admin-analytics-card">
        <span class="admin-analytics-label">Активних ботів</span>
        <strong>${overviewBotsCount}</strong>
      </div>
    </div>
    <div class="admin-analytics-revenue">
      <span>Дохід за валютами:</span>
      <div class="admin-chip-row">
        ${overviewRevenueHtml}
      </div>
    </div>
    <div class="admin-settings">
      <label>
        <input type="checkbox" id="payments-enabled-toggle" ${
          paymentsEnabled ? "checked" : ""
        } />
        Payments enabled
      </label>
    </div>
    <h3>Боти</h3>
    <table class="admin-bots-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Code</th>
          <th>Name</th>
          <th>Price</th>
          <th>Currency</th>
          <th>Free</th>
          <th>Active</th>
          <th>Total steps</th>
          <th>Зберегти</th>
        </tr>
      </thead>
      <tbody>
        ${bots
          .map(
            (bot) => `
          <tr data-bot-id="${bot.id}">
            <td>${bot.id}</td>
            <td>${bot.code}</td>
            <td>${bot.name}</td>
            <td><input type="number" step="0.01" class="bot-price" value="${bot.price}" /></td>
            <td><input type="text" class="bot-currency" value="${bot.currency}" /></td>
            <td><input type="checkbox" class="bot-free" ${
              bot.is_free ? "checked" : ""
            } /></td>
            <td><input type="checkbox" class="bot-active" ${
              bot.is_active ? "checked" : ""
            } /></td>
            <td><input type="number" class="bot-steps" value="${
              bot.total_steps || 0
            }" /></td>
            <td><button type="button" class="bot-save">Зберегти</button></td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
    <h3>Користувачі</h3>
    <table class="admin-users-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>ПІБ</th>
          <th>Email</th>
          <th>Телефон</th>
          <th>Роль</th>
          <th>Створено</th>
          <th>Дії</th>
        </tr>
      </thead>
      <tbody>
        ${users
          .map(
            (user) => `
          <tr>
            <td>${user.id}</td>
            <td>${user.full_name || ""}</td>
            <td>${user.email || ""}</td>
            <td>${user.phone || ""}</td>
            <td>${user.role}</td>
            <td>${user.created_at || ""}</td>
            <td>
              <button type="button" class="user-view-purchases" data-user-id="${
                user.id
              }">
                Детальніше
              </button>
            </td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
    <h3>Покупки користувача</h3>
    ${
      appState.admin.selectedUserId
        ? `
      <div class="admin-purchases-wrap">
        <table class="admin-purchases-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Bot ID</th>
              <th>Amount</th>
              <th>Currency</th>
              <th>Status</th>
              <th>Created</th>
              <th>Paid</th>
              <th>Дії</th>
            </tr>
          </thead>
          <tbody>
            ${purchases
              .map(
                (purchase) => `
              <tr>
                <td>${purchase.id}</td>
                <td>${purchase.bot_id}</td>
                <td>${purchase.amount}</td>
                <td>${purchase.currency}</td>
                <td>${purchase.status}</td>
                <td>${purchase.created_at || ""}</td>
                <td>${purchase.paid_at || ""}</td>
                <td>
                  ${
                    purchase.status !== "paid"
                      ? `<button type="button" class="purchase-mark-paid" data-purchase-id="${purchase.id}">Mark paid</button>`
                      : ""
                  }
                </td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
      <div class="admin-reset-progress">
        <label>
          Bot ID:
          <input type="number" id="reset-bot-id" />
        </label>
        <button type="button" id="reset-progress-btn">Скинути прогрес</button>
      </div>
    `
        : "<p>Оберіть користувача, щоб побачити покупки.</p>"
    }
    ${userSummaryBlock}
  `;

  const toggle = panel.querySelector("#payments-enabled-toggle");
  if (toggle) {
    toggle.addEventListener("change", async (event) => {
      const value = event.target.checked ? "true" : "false";
      try {
        await api("/admin/settings", {
          method: "POST",
          body: JSON.stringify({ key: "payments_enabled", value }),
        });
        appState.admin.settings.payments_enabled = value;
      } catch (error) {
        console.error("Failed to update payments_enabled", error);
        showToast("Помилка збереження налаштувань", "error");
        event.target.checked = !event.target.checked;
      }
    });
  }

  panel.querySelectorAll(".bot-save").forEach((btn) => {
    btn.addEventListener("click", async (event) => {
      const row = event.target.closest("tr");
      const botId = Number(row.dataset.botId);
      const price = parseFloat(row.querySelector(".bot-price").value || "0");
      const currency =
        row.querySelector(".bot-currency").value.trim() || "USD";
      const is_free = row.querySelector(".bot-free").checked;
      const is_active = row.querySelector(".bot-active").checked;
      const total_steps = parseInt(
        row.querySelector(".bot-steps").value || "0",
        10
      );

      try {
        await api(`/admin/bots/${botId}`, {
          method: "PUT",
          body: JSON.stringify({
            price,
            currency,
            is_free,
            is_active,
            total_steps,
          }),
        });
        await loadBots();
        await loadAdminData();
      } catch (error) {
        console.error("Failed to update bot", error);
        showToast("Помилка збереження бота", "error");
      }
    });
  });

  panel.querySelectorAll(".user-view-purchases").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      const userId = Number(event.target.dataset.userId);
      loadAdminUserPurchases(userId);
    });
  });

  panel.querySelectorAll(".purchase-mark-paid").forEach((btn) => {
    btn.addEventListener("click", async (event) => {
      const purchaseId = Number(event.target.dataset.purchaseId);
      try {
        await api(`/admin/purchases/${purchaseId}/mark-paid`, {
          method: "POST",
        });
        if (appState.admin.selectedUserId) {
          await loadAdminUserPurchases(appState.admin.selectedUserId);
        }
      } catch (error) {
        console.error("Failed to mark purchase paid", error);
        showToast("Помилка при mark-paid", "error");
      }
    });
  });

  const resetBtn = panel.querySelector("#reset-progress-btn");
  if (resetBtn) {
    resetBtn.addEventListener("click", async () => {
      const botIdValue = panel.querySelector("#reset-bot-id")?.value.trim();
      const botId = Number(botIdValue || "0");
      const userId = appState.admin.selectedUserId;
      if (!userId || !botId) {
        showToast("Вкажіть Bot ID та оберіть користувача", "error");
        return;
      }
      try {
        await api(`/admin/users/${userId}/reset-progress`, {
          method: "POST",
          body: JSON.stringify({ botId }),
        });
        showToast("Прогрес скинуто", "success");
      } catch (error) {
        console.error("Failed to reset progress", error);
        showToast("Помилка при скиданні прогресу", "error");
      }
    });
  }
}
window.handlePay = async function handlePay(backendId) {
  console.log("handlePay click", backendId, mergedBots);
  try {
    const res = await api("/payments/create", {
      method: "POST",
      body: JSON.stringify({ botId: backendId }),
    });

    console.log("payments/create response", res);

    // 1. Якщо WayForPay дає redirect — йдемо туди і нічого більше не робимо.
    if (res.status === "pending" && res.redirectUrl) {
      window.location.href = res.redirectUrl;
      return;
    }

    // 2. Дев / free / test_mode без redirect: вважаємо доступ виданим.
    if (
      res.status === "free" ||
      res.status === "test_mode" ||
      res.status === "pending"
    ) {
      const bot = (appState.bots || mergedBots || []).find(
        (b) =>
          String(b.backendId) === String(backendId) ||
          String(b.id) === String(backendId)
      );

      if (!bot) {
        console.warn("Paid bot not found", backendId, mergedBots);
        alert("Помилка: не вдалося знайти бота після оплати");
        return;
      }

      const botTypeCode = bot.frontendCode || bot.code;

      // фіксуємо тип бота в майстрі
      state.choices.botType = botTypeCode;
      state.lockedBotType = botTypeCode;
      console.log("botType after payment", state.choices.botType);
      applyCommandsForBotType(botTypeCode);

      // оновлюємо активне середовище
      if (appState.activeEnvironmentId) {
        try {
          await api(`/envs/${appState.activeEnvironmentId}`, {
            method: "PUT",
            body: JSON.stringify({
              bot_id: bot.backendId ?? bot.id,
              current_step: Math.max(state.currentStep || 1, 3),
            }),
          });
        } catch (e) {
          console.error("Failed to update env with bot", e);
        }
      }

      state.currentStep = 2;

      saveState();
      await loadEnvironments().catch(console.error);
      draw(true);

      alert("Оплата створена. Можна починати.");
      return;
    }

    console.warn("Unexpected payment response", res);
  } catch (error) {
    console.error("Payment error", error);
    alert("Помилка при створенні платежу");
  }
};

// --- Довідкові дані ---
const BOT_TYPES = [
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
  folder: [
    {
      title: "Створення Codespace",
      description:
        "Натисни Code → Codespaces → Create codespace on main, зачекай запуск редактора й відкрий термінал через Terminal → New Terminal.",
      gif: "assets/details/codespaces-folder.gif",
      onlyEnv: "codespaces",
    },
  ],
};

const LAUNCH_STEPS = [
  {
    title: "Створення бота у BotFather",
    items: [
      "Перейди у `@BotFather` → команда `/newbot`.",
      "Скопіюй токен та додай у `.env` як `BOT_TOKEN=тут_твій_токен`.",
    ],
  },
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
    "Кнопки: 🔄 «Створити нового бота», 🚀 «Покращити поточного».",
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
  lockedBotType: null,
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

function getRecommendedBackendId(currentState = state) {
  if (!isCustomBot(currentState)) return null;
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
    if (text.includes(item.key)) return item.value;
  }
  return null;
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
  reset: document.getElementById("nav-reset"),
  docsBtn: document.getElementById("nav-docs"),
  envBtn: document.getElementById("nav-env"),
  logoutBtn: document.getElementById("nav-logout"),
  docsBackdrop: document.getElementById("docs-backdrop"),
  docsClose: document.getElementById("docs-close"),
  jumpSelect: document.getElementById("jump-select"),
  jumpButton: document.getElementById("jump-btn"),
  footer: document.querySelector(".step-actions"),
  toast: document.getElementById("toast"),
};

let state = structuredClone(defaultState);
let lastSyncedStep = null;
let pendingBriefLock = null;
loadStateForActiveEnvironment();
let steps = [];

elements.prev.addEventListener("click", () => {
  if (state.currentStep === 0) return;
  state.currentStep -= 1;
  saveState();
  draw(false);
});

if (elements.next) {
  elements.next.addEventListener("click", () => {
    handleNextClick();
  });
}

if (elements.reset) {
  elements.reset.addEventListener("click", () => {
    handleReset();
  });
}

if (elements.jumpButton) {
  elements.jumpButton.addEventListener("click", () => {
    jumpToSelectedStep();
  });
}

if (elements.jumpSelect) {
  elements.jumpSelect.addEventListener("keydown", async (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      await jumpToSelectedStep();
    }
  });
}

if (elements.docsBtn && elements.docsBackdrop) {
  elements.docsBtn.addEventListener("click", openDocs);
}

if (elements.docsClose) {
  elements.docsClose.addEventListener("click", closeDocs);
}

if (elements.envBtn) {
  elements.envBtn.addEventListener("click", () => {
    openEnvScreen();
  });
}

if (elements.logoutBtn) {
  elements.logoutBtn.addEventListener("click", () => {
    handleLogout();
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeDocs();
    closeTopbarMenu();
  }
});

if (topbarBurger) {
  topbarBurger.addEventListener("click", () => {
    if (topbarOverlay && !topbarOverlay.hidden) {
      closeTopbarMenu();
    } else {
      openTopbarMenu();
    }
  });
}

if (topbarClose) {
  topbarClose.addEventListener("click", () => {
    closeTopbarMenu();
  });
}

if (topbarOverlay) {
  topbarOverlay.addEventListener("click", (event) => {
    if (event.target === topbarOverlay) {
      closeTopbarMenu();
    }
  });
}

if (topbarMenu) {
  topbarMenu.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === "reset") handleReset();
    if (action === "docs") openDocs();
    if (action === "env") openEnvScreen();
    if (action === "logout") handleLogout();
    if (action === "admin") toggleAdminPanel();
    closeTopbarMenu();
  });
}

if (detailsClose) {
  detailsClose.addEventListener("click", () => {
    closeStepDetailsModal();
  });
}

if (detailsOverlay) {
  detailsOverlay.addEventListener("click", (event) => {
    if (event.target === detailsOverlay) {
      closeStepDetailsModal();
    }
  });
}

async function jumpToSelectedStep() {
  if (!elements.jumpSelect) return;
  const value = elements.jumpSelect.value;
  if (!value) return;
  const index = steps.findIndex((step) => step.id === value);
  if (index === -1) return;
  const targetStepNumber = steps[index]?.number || index + 1;
  if (!(await ensureAccessForStep(targetStepNumber))) return;
  const movingForward = index > state.currentStep;
  const currentStep = steps[state.currentStep];
  const shouldLockBrief =
    movingForward &&
    isCustomBot() &&
    currentStep?.id === CUSTOM_BRIEF_STEP_ID &&
    !isActiveEnvironmentBriefLocked();
  if (shouldLockBrief) {
    const briefStepNumber = currentStep?.number || state.currentStep + 1;
    scheduleBriefLock(briefStepNumber);
  }
  state.currentStep = index;
  saveState();
  draw(true);
}

function openDocs() {
  elements.docsBackdrop.hidden = false;
  document.body.classList.add("docs-open");
}

function closeDocs() {
  elements.docsBackdrop.hidden = true;
  document.body.classList.remove("docs-open");
}

function openStepDetailsModal(detailItems) {
  if (!detailsOverlay || !detailsBody || !Array.isArray(detailItems)) return;
  detailsBody.innerHTML = "";
  detailItems.forEach((item, index) => {
    const card = document.createElement("article");
    card.className = "step-details-card";

    const header = document.createElement("header");
    header.textContent = item.title || `Крок ${index + 1}`;
    card.appendChild(header);

    if (item.gif) {
      const img = document.createElement("img");
      img.src = item.gif;
      img.alt = item.title || "Детальний приклад";
      img.loading = "lazy";
      card.appendChild(img);
    }

    if (item.description) {
      const p = document.createElement("p");
      p.textContent = item.description;
      card.appendChild(p);
    }

    detailsBody.appendChild(card);
  });
  detailsOverlay.hidden = false;
  document.body.classList.add("details-open");
}

function closeStepDetailsModal() {
  if (!detailsOverlay) return;
  detailsOverlay.hidden = true;
  document.body.classList.remove("details-open");
  if (detailsBody) {
    detailsBody.innerHTML = "";
  }
}

function updateNavSummary() {
  const navSummary = document.getElementById("nav-summary");
  if (!navSummary) return;
  const botTypeId = state.choices.botType;
  const botMeta = getBotMetaByCode(botTypeId);
  const type = botMeta?.title || "не обрано";
  const environment =
    ENVIRONMENTS.find((item) => item.id === state.choices.environment)?.title ||
    "не обрано";
  const mode =
    MODE_OPTIONS.find((item) => item.id === state.choices.mode)?.title ||
    "не обрано";
  navSummary.innerHTML = `Тип: <span>${type}</span> | Середовище: <span>${environment}</span> | ШІ: <span>${mode}</span>`;
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
  elements.stepBody.innerHTML = "";
  step.render(elements.stepBody);
  renderStepDetails(elements.stepBody, step.id);

  const progress = ((state.currentStep + 1) / steps.length) * 100;
  elements.progressInner.style.width = `${progress}%`;
  elements.progressLabel.textContent = `${state.currentStep + 1} / ${
    steps.length
  }`;

  elements.prev.disabled = state.currentStep === 0;
  if (elements.next) {
    const isAdmin = appState.user?.role === "admin";
    const hideNextOnThisStep = state.currentStep === 1 && !isAdmin;
    elements.next.hidden = hideNextOnThisStep;
    if (!hideNextOnThisStep) {
      elements.next.textContent =
        state.currentStep === steps.length - 1 ? "Завершити" : "Далі ➡️";
    }
  }
  elements.footer.style.display = step.hideNav ? "none" : "";
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

  const isAdmin = appState.user?.role === "admin";
  const hideEarlyOptions = !isAdmin && state.currentStep >= 3;

  steps.forEach((step) => {
    if (hideEarlyOptions && step.number <= 2) return;
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
        // ТІЛЬКИ текст, без копі-кнопок
        renderInfo(
          container,
          [
            "1. Зайди на свій репозиторій на GitHub.",
            "2. Натисни кнопку Code.",
            "3. Перейди на вкладку Codespaces.",
            "4. Обери Create codespace on main.",
            "5. Дочекайся, поки відкриється веб-версія VS Code — це і є твій Codespace.",
          ],
          "Мета: відкрити репозиторій у Codespaces і працювати там з файлами бота (main.py, requirements.txt, .env тощо)."
        );
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
      }
    }
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
          (c) => renderBackendStep(c, backend.title, step)
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
    createStep("finish", "VIII. Розвиток", FINISH_STEP.title, (c) =>
      renderInfo(c, FINISH_STEP.items)
    )
  );

  result.forEach((step, index) => {
    step.number = index + 1;
  });

  return result;
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

  const img = document.createElement("img");
  img.src = "assets/intro.gif";
  img.alt = "Onboarding";
  img.className = "start-gif";
  img.loading = "lazy";
  block.appendChild(img);

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
  });
  block.appendChild(button);

  container.appendChild(block);
}

function renderBotTypeStep(container) {
  const frontendBots = getFrontendBotConfigs();
  const baseBots =
    appState.bots && appState.bots.length
      ? appState.bots
      : mergedBots && mergedBots.length
      ? mergedBots
      : frontendBots;
  const lockedBotType = state.lockedBotType || null;
  const isBotTypeLocked = Boolean(lockedBotType);
  const bots = Array.isArray(baseBots) ? [...baseBots] : [];
  if (
    isBotTypeLocked &&
    !bots.some(
      (bot) => (bot?.frontendCode || bot?.code || bot?.id) === lockedBotType
    )
  ) {
    const fallback =
      frontendBots.find((bot) => bot.code === lockedBotType) || null;
    if (fallback) {
      bots.push(fallback);
    }
  }

  const renderPriceAndAction = (bot) => {
    if (!bot?.backendId) {
      return `
        <div class="bot-price-cell">
          <span class="bot-price-empty">Немає даних</span>
        </div>
      `;
    }

    if (bot.isFree) {
      return `
        <div class="bot-price-cell">
          <span class="bot-price-label">FREE</span>
          <button
            class="btn btn-primary bot-pay-btn"
            type="button"
            onclick="window.handlePay(${bot.backendId})"
          >
            Почати (FREE)
          </button>
        </div>
      `;
    }

    const priceValue = Number(bot.price);
    const price = Number.isFinite(priceValue)
      ? priceValue.toFixed(2)
      : "";
    const currency = bot.currency || "";

    return `
      <div class="bot-price-cell">
        <span class="bot-price-label">Ціна: ${price} ${currency}</span>
        <button
          class="btn btn-primary bot-pay-btn"
          type="button"
          onclick="window.handlePay(${bot.backendId})"
        >
          Оплатити
        </button>
      </div>
    `;
  };

  const wrap = document.createElement("div");
  wrap.className = "bot-type-list";
  wrap.innerHTML = bots
    .map((bot) => {
      const commands = Array.isArray(bot.commands) ? bot.commands : [];
      const commandsText = commands.length
        ? commands.join(", ")
        : "/start, /help";
      const botCode = bot.frontendCode || bot.code;
      const checked = state.choices.botType === botCode ? "checked" : "";
      const disabledAttr =
        isBotTypeLocked && botCode !== lockedBotType ? "disabled" : "";
      const priceColHtml = renderPriceAndAction(bot);

      return `
        <article class="bot-type-card">
          <div class="bot-type-main">
            <label class="bot-type-radio">
              <input type="radio" name="bot-type" value="${botCode}" ${checked} ${disabledAttr} />
              <span class="bot-type-title">${bot.title || botCode}</span>
            </label>
            <p class="bot-type-desc">${bot.description || ""}</p>
            <p class="bot-type-commands">${commandsText}</p>
          </div>
          <div class="bot-type-pay">
            ${priceColHtml}
          </div>
        </article>
      `;
    })
    .join("");

  wrap.addEventListener("change", (event) => {
    if (event.target.name === "bot-type") {
      const previous = state.choices.botType;
      const value = event.target.value;
      if (isBotTypeLocked && value !== lockedBotType) {
        event.target.checked = false;
        const lockedInput = wrap.querySelector(
          `input[name="bot-type"][value="${lockedBotType}"]`
        );
        if (lockedInput) lockedInput.checked = true;
        showToast(
          "Тип бота вже зафіксований після оплати. Створи нове середовище, щоб обрати інший.",
          "error"
        );
        return;
      }
      state.choices.botType = value;
      state.ui = structuredClone(defaultUiState);
      applyCommandsForBotType(value);

      if (value === "custom" && previous !== "custom") {
        state.custom = structuredClone(defaultCustomState);
        state.choices.entryFile = ENTRY_FILE_OPTIONS[0].id;
      }
      if (previous === "custom" && value !== "custom") {
        state.custom = structuredClone(defaultCustomState);
        state.choices.entryFile = ENTRY_FILE_OPTIONS[0].id;
      }

      saveState();
      draw(true);
    }
  });

  container.appendChild(wrap);

  const infoLines = [
    "• Обери сценарій, який найближчий до твого проєкту.",
  ];
  if (isBotTypeLocked) {
    infoLines.push(
      "• Тип бота зафіксовано після оплати. Для нового типу створи окреме середовище."
    );
  }
  renderInfo(container, infoLines);
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
  const manualSection = createFileSection(
    "Файли з індивідуальним кодом",
    "Попроси ШІ згенерувати ці файли та встав їх вручну."
  );
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

    const prompt = generateManualFilePrompt(fileName);
    const aiTarget = getPromptAiTarget("code");
    wrapper.appendChild(
      createPromptBlock(prompt, {
        copyLabel: "Скопіювати промпт для ШІ",
        ai: aiTarget,
        openLabel: getAiLabel(aiTarget),
      })
    );

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

function renderDevBriefStep(container) {
  const panel = document.createElement("div");
  panel.className = "review-card";

  const h = document.createElement("h3");
  h.textContent = "Огляд виборів та швидке редагування";
  panel.appendChild(h);

  const lockedBotType = state.lockedBotType;
  const typeControl = lockedBotType
    ? (() => {
        const wrapper = document.createElement("div");
        wrapper.className = "form-control form-control--static";
        const lockedMeta = getBotMetaByCode(lockedBotType);
        const valueText = lockedMeta
          ? `${lockedMeta.title} — ${lockedMeta.description}`
          : lockedBotType;
        const valueEl = document.createElement("div");
        valueEl.className = "readonly-value";
        valueEl.textContent = valueText;
        wrapper.appendChild(valueEl);

        const hint = document.createElement("p");
        hint.className = "form-hint warning";
        hint.textContent =
          "Тип бота зафіксовано після оплати. Створи нове середовище, щоб обрати інший.";
        wrapper.appendChild(hint);
        return wrapper;
      })()
    : makeSelect(
        BOT_TYPES.map((t) => [t.id, `${t.title} — ${t.description}`]),
        state.choices.botType,
        (value) => {
          const previous = state.choices.botType;
          state.choices.botType = value;
          state.ui = structuredClone(defaultUiState);
          const type = BOT_TYPES.find((item) => item.id === value);
          if (type) state.commands = [...type.commands];
          if (value === "custom" && previous !== "custom") {
            state.custom = structuredClone(defaultCustomState);
            state.choices.entryFile = ENTRY_FILE_OPTIONS[0].id;
          }
          if (previous === "custom" && value !== "custom") {
            state.custom = structuredClone(defaultCustomState);
            state.choices.entryFile = ENTRY_FILE_OPTIONS[0].id;
          }
          saveState();
          draw(true);
        }
      );

  panel.appendChild(makeRow("Тип бота", typeControl));

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

  const brief = generateDevBrief();

  // просто показуємо текст без жодних кнопок
  const block = document.createElement("div");
  block.className = "prompt-area";

  const pre = document.createElement("pre");
  pre.className = "prompt-text";
  pre.textContent = brief;

  block.appendChild(pre);
  container.appendChild(block);
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
  const entryFile = getEntryFile();
  const aiTarget = getPromptAiTarget("instructions");
  const promptBlock = createPromptBlock(
    `Створи файл requirements.txt і додай рядки:\n\naiogram==3.*\npython-dotenv`,
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
  text.textContent = "Познач, що файл requirements.txt створено:";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = !!state.tools.requirements;
  input.addEventListener("change", (event) => {
    state.tools.requirements = event.target.checked;
    saveState();
    draw(false);
  });
  label.append(text, input);
  checklist.appendChild(label);
  container.appendChild(checklist);

  if (!state.tools.requirements) {
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
  const env = getActiveEnvironment();
  const envBriefLocked = Boolean(env?.brief_locked ?? env?.briefLocked);
  const customBriefLocked = Boolean(custom.briefLocked);
  const briefLocked = envBriefLocked || customBriefLocked;
  const baseInfo = [
    "Встав JSON із брифом. Після збереження система побудує план файлів.",
  ];
  if (briefLocked) {
    baseInfo.push(
      "Бриф для цього середовища вже зафіксовано. Щоб описати нового бота, створи нове середовище в розділі «Середовища»."
    );
  }
  renderInfo(container, baseInfo);

  if (briefLocked) {
    const note = document.createElement("div");
    note.className = "brief-lock-note";
    note.textContent = envBriefLocked
      ? "Редагування вимкнено, бо бриф підтверджено. Створи нове середовище для нового кастомного бота."
      : "Бриф уже збережено для цього середовища. Створи нове середовище, щоб описати іншого кастомного бота.";
    container.appendChild(note);
  }

  const textarea = document.createElement("textarea");
  textarea.value = custom.briefText;
  textarea.placeholder = '{\n  "commands": [...],\n  "files": [...],\n  ...\n}';
  textarea.rows = 12;
  textarea.readOnly = briefLocked;
  textarea.classList.toggle("textarea-readonly", briefLocked);
  if (!briefLocked) {
    textarea.addEventListener("input", (event) => {
      custom.briefText = event.target.value;
      saveState();
    });
  }
  container.appendChild(makeRow("JSON-бриф", wrapControl(textarea)));

  const actions = document.createElement("div");
  actions.className = "prompt-actions";
  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "primary";
  if (briefLocked) {
    saveBtn.disabled = true;
    saveBtn.textContent = "Бриф зафіксований";
  } else {
    saveBtn.textContent = "Зберегти бриф";
    saveBtn.addEventListener("click", () => {
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
        custom.briefLocked = true;
        saveState();
        draw(true);
        showToast("Бриф збережено.");
      } catch (error) {
        console.error("Не вдалося розпарсити бриф", error);
        showToast(
          "Помилка JSON. Перевір синтаксис. Якщо ChatGPT повернув відповідь у ```json``` — скопіюй лише вміст без кодових блоків.",
          "error"
        );
      }
    });
  }
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

  renderInfo(container, [
    "Познач файли як виконані після того, як вставиш код або заповниш прості шаблони.",
  ]);

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

  const discoveryPrompt = generatePresetUiDiscoveryPrompt("reply", spec.type);
  container.appendChild(
    createPromptBlock(discoveryPrompt, {
      copyLabel: "Запросити інший варіант",
      ai: aiTarget,
      openLabel: getAiLabel(aiTarget),
      collapsible: true,
    })
  );

  const customNote = [
    "• Можеш перелічити власні кнопки (формат: Назва — призначення — callback/URL).",
    "• Скопіюй промпт нижче, щоб ШІ згенерував код саме для твого набору.",
  ];
  renderInfo(container, customNote);

  const textarea = document.createElement("textarea");
  textarea.value = uiState.replyCustomSpec;
  textarea.placeholder =
    "📋 Клієнти — показати список активних клієнтів\n➕ Новий клієнт — відкрити форму додавання\n...";
  textarea.rows = 4;
  textarea.addEventListener("input", (event) => {
    uiState.replyCustomSpec = event.target.value;
    saveState();
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

  const discoveryPrompt = generatePresetUiDiscoveryPrompt("inline", spec.type);
  container.appendChild(
    createPromptBlock(discoveryPrompt, {
      copyLabel: "Запросити інший варіант",
      ai: aiTarget,
      openLabel: getAiLabel(aiTarget),
      collapsible: true,
    })
  );

  const customNote = [
    "• Перерахуйте власні inline-кнопки (формат: Назва — призначення — callback/URL).",
    "• За потреби додайте, який хендлер викликати.",
  ];
  renderInfo(container, customNote);

  const textarea = document.createElement("textarea");
  textarea.value = uiState.inlineCustomSpec;
  textarea.placeholder =
    "✅ Готово — закрити завдання — callback task_done\n❌ Пропустити — пропустити завдання — callback task_skip\n...";
  textarea.rows = 4;
  textarea.addEventListener("input", (event) => {
    uiState.inlineCustomSpec = event.target.value;
    saveState();
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
  const recommendedId = isCustomBot() ? getRecommendedBackendId() : null;
  const recommendedOption = BACKEND_OPTIONS.find(
    (item) => item.id === recommendedId
  );
  if (recommendedOption) {
    infoLines.unshift(
      `• Для твого сценарію найчастіше підходить ${recommendedOption.title}. Обери його, якщо сумніваєшся.`
    );
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

function renderBackendStep(container, backendTitle, step) {
  renderInfo(container, [`${backendTitle}: ${step.text}`]);
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
    return;
  }
  renderInfo(container, step.items || []);
}

function renderStepDetails(container, stepId) {
  const mount = document.getElementById("step-details-mount");
  if (mount) mount.innerHTML = "";
  const allDetails = STEP_DETAILS[stepId];
  if (!allDetails || !allDetails.length || !mount) return;

  const currentEnv = state?.choices?.environment || null;
  const details = allDetails.filter((item) => {
    if (item.onlyEnv && item.onlyEnv !== currentEnv) return false;
    return true;
  });
  if (!details.length) return;

  const wrapper = document.createElement("div");
  wrapper.className = "step-details";

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "ghost details-toggle";
  toggle.textContent = "Детальніше";
  toggle.addEventListener("click", () => openStepDetailsModal(details));
  wrapper.appendChild(toggle);
  mount.appendChild(wrapper);
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
  const processedLines = lines?.map((line) =>
    replaceEntryFileTokens(line, entryFile)
  );

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
  block.className = "prompt-area";

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
      showToast("Спочатку заповни поля для промпту.", "error");
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

// --- Загальні утиліти ---
function copyText(text) {
  if (!navigator.clipboard) {
    showToast("Скопіювати не вдалося (обмеження браузера).", "error");
    return;
  }
  navigator.clipboard
    .writeText(text)
    .then(() => showToast("Скопійовано у буфер."));
}

function showToast(message, type = "success") {
  const root = document.getElementById("toast");
  if (!root) return;
  const body = root.querySelector(".toast-body");
  if (!body) return;
  root.hidden = false;
  body.textContent = message;
  body.classList.remove("toast-success", "toast-error");
  body.classList.add(type === "error" ? "toast-error" : "toast-success");
  clearTimeout(root._hideTimer);
  root._hideTimer = setTimeout(() => {
    root.hidden = true;
  }, 4000);
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
      if (isActiveEnvironmentBriefLocked()) {
        return ok();
      }
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

function normalizeState(nextState) {
  const merged = Object.assign(
    structuredClone(defaultState),
    nextState || {}
  );
  merged.tools = Object.assign({}, defaultState.tools, merged.tools);
  if (merged.tools.requirements === undefined) merged.tools.requirements = false;
  if (merged.tools.env === undefined) merged.tools.env = false;
  if (merged.tools.codespace === undefined) merged.tools.codespace = false;
  if (merged.tools.browser === undefined) merged.tools.browser = false;
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
  if (merged.lockedBotType === undefined) merged.lockedBotType = null;
  if (
    merged.lockedBotType &&
    merged.choices &&
    merged.choices.botType !== merged.lockedBotType
  ) {
    merged.choices.botType = merged.lockedBotType;
  }
  ensureCustomState(merged);
  if (
    merged.choices?.botType &&
    merged.choices.botType !== "custom" &&
    (!Array.isArray(merged.commands) || !merged.commands.length)
  ) {
    applyCommandsForBotType(merged.choices.botType, merged);
  }
  return merged;
}

function loadState() {
  loadStateForActiveEnvironment();
}

function loadStateForEnv(envId) {
  const key =
    ENV_STATE_STORAGE_PREFIX + String(envId != null ? envId : "default");
  const raw = localStorage.getItem(key);
  if (!raw) {
    return normalizeState();
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.state) {
      return normalizeState(parsed.state);
    }
    return normalizeState(parsed);
  } catch (e) {
    console.warn("Failed to parse state for env", envId, e);
    return normalizeState();
  }
}

function loadStateForActiveEnvironment() {
  let payload = null;
  try {
    const key = getActiveEnvStorageKey();
    const raw = localStorage.getItem(key);
    if (raw) {
      payload = JSON.parse(raw);
    }
  } catch (error) {
    console.warn("Failed to parse env state", error);
  }

  if (payload && typeof payload === "object" && payload.state) {
    state = normalizeState(payload.state);
  } else if (payload) {
    state = normalizeState(payload);
  } else {
    state = normalizeState();
  }

  if (typeof state.currentStep !== "number" || state.currentStep < 1) {
    state.currentStep = 1;
  }
  lastSyncedStep = Math.max(1, Number(state.currentStep) + 1 || 1);
}

async function saveState() {
  try {
    const key = getActiveEnvStorageKey();
    const payload = {
      state,
      currentStep: state.currentStep,
    };
    localStorage.setItem(key, JSON.stringify(payload));
    await syncEnvironmentStep();
  } catch (error) {
    console.error("Failed to save env state", error);
  }
}

function resetCurrentEnvironmentState() {
  state = normalizeState();
  state.currentStep = 1;
  lastSyncedStep = null;
  pendingBriefLock = null;
  saveState();
  if (typeof draw === "function") {
    draw(true);
  }
}

function structuredClone(value) {
  return JSON.parse(JSON.stringify(value));
}
