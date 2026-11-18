(() => {
  "use strict";
  // Плавна поява блоків при прокрутці.
  // Безпечно: вміст ховається лише після того, як скрипт додав клас .anim,
  // перевірка йде в одному кадрі на прокрутку (без IntersectionObserver),
  // а через 2 с усе гарантовано показується, навіть якщо щось пішло не так.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const root = document.documentElement;
  const items = [...document.querySelectorAll(
    ".ideas-block .block-head, .q-card, .principles li, .matrix, .feat-card, .dlc-card, .custom, .expand-table tbody tr, .release li")];

  // Індекс для каскадної затримки всередині одного контейнера
  const counters = new Map();
  items.forEach((el) => {
    const parent = el.parentElement;
    const i = counters.get(parent) || 0;
    counters.set(parent, i + 1);
    el.style.setProperty("--d", `${Math.min(i, 8) * 70}ms`);
    el.classList.add("reveal");
  });
  root.classList.add("anim");

  let ticking = false;
  const check = () => {
    ticking = false;
    const limit = window.innerHeight * 0.92;
    for (const el of items) {
      if (!el.classList.contains("in") && el.getBoundingClientRect().top < limit) el.classList.add("in");
    }
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(check); } };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  check();

  // Страховка: показати все через 2 с
  setTimeout(() => items.forEach((el) => el.classList.add("in")), 2000);

  // Підсвітка активного розділу в навігації
  const links = [...document.querySelectorAll(".ideas-nav a")];
  const sections = links.map((a) => document.querySelector(a.getAttribute("href"))).filter(Boolean);
  const spy = () => {
    let current = sections[0];
    for (const s of sections) if (s.getBoundingClientRect().top < window.innerHeight * 0.35) current = s;
    links.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + current?.id));
  };
  window.addEventListener("scroll", () => requestAnimationFrame(spy), { passive: true });
  spy();
})();
