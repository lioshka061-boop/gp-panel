const steps = [
  {
    title: "Ласкаво просимо!",
    description:
      "Панель допоможе створити Telegram-бота без коду. Натискайте \"Далі\", щоб почати коротку подорож.",
    checklist: ["Підготуйте ідею бота", "Виділіть 15 хвилин на роботу"],
  },
  {
    title: "Опишіть свого бота",
    description:
      "Занотуйте, яку задачу виконує бот, які команди знадобляться і для кого він створюється.",
    checklist: ["Ціль бота", "Головні команди", "Цільова аудиторія"],
  },
  {
    title: "Далі буде",
    description:
      "Це лише заготівка. Додайте власні кроки та логіку у файлі app.js.",
    checklist: ["Оновіть дані під ваш сценарій"],
  },
];

const state = {
  index: 0,
};

const app = document.querySelector("#app");
const progress = document.querySelector(".progress");
const progressBar = document.querySelector(".progress__bar");
const prevButton = document.querySelector('[data-action="prev"]');
const nextButton = document.querySelector('[data-action="next"]');
const toggleThemeButton = document.querySelector("#toggle-theme");
const bodyElement = document.body;

const THEME_STORAGE_KEY = "ztb_theme_manual";
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
  const nextThemeLabel = nextTheme === "dark" ? "темну" : "світлу";
  toggleThemeButton.textContent = `🌗 ${nextTheme === "dark" ? "Темна тема" : "Світла тема"}`;
  toggleThemeButton.setAttribute("aria-label", `Перемкнути на ${nextThemeLabel} тему`);
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

function render() {
  if (!app) return;

  const step = steps[state.index];
  const total = steps.length;
  const percent = Math.round(((state.index + 1) / total) * 100);

  progress?.setAttribute("aria-valuenow", String(percent));
  if (progressBar) {
    progressBar.style.width = `${percent}%`;
  }

  prevButton.disabled = state.index === 0;
  nextButton.disabled = state.index === total - 1;

  app.innerHTML = `
    <article class="step" aria-live="polite">
      <header>
        <h2 class="step__title">${step.title}</h2>
      </header>
      <p class="step__body">${step.description}</p>
      ${renderChecklist(step.checklist)}
    </article>
  `;
}

function renderChecklist(items = []) {
  if (!items.length) return "";
  const listItems = items.map((item) => `<li>${item}</li>`).join("");
  return `<ul class="step__list">${listItems}</ul>`;
}

function go(stepDelta) {
  state.index = Math.min(Math.max(state.index + stepDelta, 0), steps.length - 1);
  render();
  focusMain();
}

function focusMain() {
  requestAnimationFrame(() => {
    app?.focus();
  });
}

prevButton?.addEventListener("click", () => go(-1));
nextButton?.addEventListener("click", () => go(1));

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowRight") {
    go(1);
  }
  if (event.key === "ArrowLeft") {
    go(-1);
  }
});

render();
