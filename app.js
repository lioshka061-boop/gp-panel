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
