(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const P = window.PROJECT || { tasks: [], statuses: [], links: {} };

  // Які епіки дошки відповідають розділам GDD (номер розділу → епіки)
  const SECTION_EPICS = {
    2: ["FND"], 3: ["RES", "UI"], 4: ["PSY"], 5: ["DLG"], 6: ["WPN", "ITM"],
    7: ["ACC", "WLD"], 8: ["STL"], 9: ["QST", "REP", "ECO"], 10: ["CNT"]
  };
  const STATUS_NAME = Object.fromEntries((P.statuses || []).map((s) => [s.id, s.name]));
  const STORE_KEY = "agency6-taskmanager-v1";

  // Статуси з localStorage менеджера задач, щоб чипи показували актуальний стан
  function taskStatus(t) {
    try {
      const store = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
      return store.overrides?.[t.id]?.status || t.status;
    } catch (e) { return t.status; }
  }

  const slug = (text, used) => {
    let s = text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "section";
    let out = s, i = 2;
    while (used.has(out)) out = `${s}-${i++}`;
    used.add(out);
    return out;
  };

  function render() {
    const src = $("#gddSource").textContent.trim();
    const article = $("#gddContent");
    if (window.marked) {
      article.innerHTML = window.marked.parse(src, { gfm: true });
    } else {
      article.innerHTML = `<p class="muted">Не вдалося завантажити рендерер Markdown (немає інтернету?). Показую текст як є.</p><pre class="gdd-raw">${esc(src)}</pre>`;
      return;
    }

    // Посилання на оригінал
    const link = $("#gddSourceLink");
    if (P.links?.gdd) link.href = P.links.gdd; else link.hidden = true;

    // Таблиці з горизонтальною прокруткою на вузьких екранах
    $$("table", article).forEach((t) => {
      const wrap = document.createElement("div");
      wrap.className = "table-wrap";
      t.replaceWith(wrap);
      wrap.appendChild(t);
    });

    // Якорі для заголовків + обгортання розділів
    const used = new Set();
    $$("h2, h3", article).forEach((h) => { h.id = slug(h.textContent, used); });

    const h1 = $("h1", article);
    if (h1) {
      const meta = document.createElement("p");
      meta.className = "gdd-meta muted";
      meta.innerHTML = `Копія документа від ${esc(P.updated || "")} · ${$$("h2", article).length} розділів · ~${Math.max(1, Math.round(src.split(/\s+/).length / 200))} хв читання`;
      h1.after(meta);
    }

    wrapSections(article);
    addSectionTasks(article);
    buildToc(article);
    observe(article);
  }

  // Кожен h2 разом із його вмістом загортається в <section> для анімації та підсвітки
  function wrapSections(article) {
    $$("h2", article).forEach((h2) => {
      const section = document.createElement("section");
      section.className = "gdd-section";
      h2.before(section);
      let node = h2;
      while (node && !(node !== h2 && node.tagName === "H2")) {
        const next = node.nextSibling;
        section.appendChild(node);
        node = next;
      }
    });
  }

  function addSectionTasks(article) {
    $$(".gdd-section", article).forEach((section) => {
      const h2 = $("h2", section);
      const num = parseInt(h2.textContent, 10);
      const epics = SECTION_EPICS[num];
      if (!epics) return;
      const tasks = P.tasks.filter((t) => epics.includes(t.epic) && t.phase !== "0");
      if (!tasks.length) return;
      const done = tasks.filter((t) => taskStatus(t) === "done").length;
      const box = document.createElement("aside");
      box.className = "gdd-tasks";
      box.innerHTML = `
        <div class="gdd-tasks-head"><b>Задачі розділу</b><span class="muted">${done} / ${tasks.length} готово</span></div>
        <div class="gdd-tasks-list">${tasks.map((t) => {
          const st = taskStatus(t);
          return `<a class="chip status-${esc(st)}" href="index.html?task=${encodeURIComponent(t.id)}#list" title="${esc(t.title)} — ${esc(STATUS_NAME[st] || st)}">${st === "done" ? "✓ " : ""}${esc(t.id)}</a>`;
        }).join("")}</div>`;
      section.appendChild(box);
    });
  }

  function buildToc(article) {
    const items = $$("h2, h3", article).map((h) =>
      `<a href="#${h.id}" class="toc-${h.tagName.toLowerCase()}" data-target="${h.id}">${esc(h.textContent)}</a>`);
    $("#gddToc").innerHTML = items.join("");
  }

  // Підсвітка поточного розділу в змісті, поява розділів при прокрутці, прогрес читання
  function observe(article) {
    const links = Object.fromEntries($$("#gddToc a").map((a) => [a.dataset.target, a]));
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        $$("#gddToc a.active").forEach((a) => a.classList.remove("active"));
        const a = links[e.target.id];
        if (a) {
          a.classList.add("active");
          a.scrollIntoView({ block: "nearest" });
        }
      });
    }, { rootMargin: "-80px 0px -70% 0px" });
    $$("h2, h3", article).forEach((h) => spy.observe(h));

    const reveal = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); reveal.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -10% 0px" });
    $$(".gdd-section", article).forEach((s) => reveal.observe(s));

    const bar = $("#readProgress");
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  // Пошук: підсвічує збіги, Enter — до наступного
  let hits = [], hitIndex = -1;
  function clearMarks(article) {
    $$("mark.gdd-hit", article).forEach((m) => m.replaceWith(document.createTextNode(m.textContent)));
    article.normalize();
  }
  function search(q) {
    const article = $("#gddContent");
    clearMarks(article);
    hits = []; hitIndex = -1;
    const info = $("#gddSearchInfo");
    if (q.length < 2) { info.textContent = ""; return; }
    const pattern = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(pattern, "gi");
    const reTest = new RegExp(pattern, "i"); // без прапорця g, щоб test() не зсував lastIndex
    const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement.closest("script, .gdd-tasks") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT)
    });
    const nodes = [];
    while (walker.nextNode()) if (reTest.test(walker.currentNode.nodeValue)) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const frag = document.createDocumentFragment();
      let last = 0;
      node.nodeValue.replace(re, (m, i) => {
        frag.append(node.nodeValue.slice(last, i));
        const mark = document.createElement("mark");
        mark.className = "gdd-hit";
        mark.textContent = m;
        frag.append(mark);
        hits.push(mark);
        last = i + m.length;
      });
      frag.append(node.nodeValue.slice(last));
      node.replaceWith(frag);
    });
    $$(".gdd-section", article).forEach((s) => s.classList.add("in"));
    info.textContent = hits.length ? `Знайдено: ${hits.length} · Enter — далі` : "Нічого не знайдено";
    next();
  }
  function next() {
    if (!hits.length) return;
    hits[hitIndex]?.classList.remove("current");
    hitIndex = (hitIndex + 1) % hits.length;
    hits[hitIndex].classList.add("current");
    hits[hitIndex].scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function init() {
    render();
    let t;
    const input = $("#gddSearch");
    input.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => search(input.value.trim()), 200); });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); next(); } });
    $("#btnPrint").addEventListener("click", () => {
      $$(".gdd-section").forEach((s) => s.classList.add("in"));
      window.print();
    });
    if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
  }

  init();
})();
