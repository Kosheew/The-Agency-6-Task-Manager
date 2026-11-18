(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const DATA = window.MODULES || { modules: [] };
  const P = window.PROJECT || { tasks: [] };
  const mods = DATA.modules;
  const byName = Object.fromEntries(mods.map((m) => [m.name, m]));
  const taskById = Object.fromEntries((P.tasks || []).map((t) => [t.id, t]));
  const HUB = 8;

  // Проблеми модуля, виведені з даних генератора
  mods.forEach((m) => {
    m.issues = [];
    const featDeps = m.layer === "Core" ? m.deps.filter((d) => byName[d]?.layer === "Features") : [];
    if (featDeps.length) m.issues.push({ cls: "bug", text: `Core → Features (${featDeps.length})`, title: "Залежить від: " + featDeps.join(", ") });
    if (!m.desc) m.issues.push({ cls: "p1", text: "Без опису" });
    if (!m.interfaces.length && m.files - m.editorFiles > 2) m.issues.push({ cls: "p2", text: "Без інтерфейсів" });
    if (m.usedBy.length >= HUB) m.issues.push({ cls: "", text: `Хаб · ${m.usedBy.length}` , title: "Ним користуються " + m.usedBy.length + " модулів" });
    m.key = (m.group ? m.group + "/" : "") + m.name;
  });

  // ── KPI ─────────────────────────────────────────────
  const core = mods.filter((m) => m.layer === "Core").length;
  const violations = mods.filter((m) => m.issues.some((i) => i.cls === "bug")).length;
  const files = mods.reduce((s, m) => s + m.files, 0);
  $("#modsMeta").textContent = `Згенеровано з коду гри ${DATA.generated || ""} · Core / Features · клік на модуль — деталі`;
  $("#modsKpis").innerHTML = `
    <div class="kpi accent"><div class="v">${mods.length}</div><div class="l">Модулів</div></div>
    <div class="kpi cyan"><div class="v">${core} / ${mods.length - core}</div><div class="l">Core / Features</div></div>
    <div class="kpi warn"><div class="v">${files}</div><div class="l">C#-файлів</div></div>
    <div class="kpi bad"><div class="v">${violations}</div><div class="l">Порушень шарів</div></div>`;

  // ── Каталог ─────────────────────────────────────────
  const chipLink = (name) => byName[name]
    ? `<a class="chip dep" href="#m-${esc(name)}" data-jump="${esc(name)}">${esc(name)}</a>` : `<span class="chip">${esc(name)}</span>`;
  const taskChip = (id) => {
    const t = taskById[id];
    return `<a class="chip ${t?.type === "bug" ? "bug" : ""}" data-task="${esc(id)}" href="index.html?task=${encodeURIComponent(id)}#list" title="${esc(t?.title || "")}">${esc(id)}</a>`;
  };
  const list = (title, items, fn = (x) => `<code>${esc(x)}</code>`) =>
    items.length ? `<div class="mrow"><h5>${title}</h5><div class="mvals">${items.map(fn).join(" ")}</div></div>` : "";

  function card(m) {
    const rank = Math.min(1, m.usedBy.length / 16);
    return `<details class="mcard ${m.issues.some((i) => i.cls === "bug") ? "has-bug" : ""}" id="m-${esc(m.name)}">
      <summary>
        <div class="mtitle"><span class="layer ${m.layer === "Core" ? "core" : "feat"}">${m.layer}</span><b>${esc(m.name)}</b>${m.group ? `<span class="muted mgroup">${esc(m.group)}</span>` : ""}</div>
        <p class="mdesc">${esc(m.desc || "Опис відсутній — додайте в tools/gen_modules.py")}</p>
        <div class="mstats">
          <span title="Файлів">▤ ${m.files}</span><span title="Залежить від">→ ${m.deps.length}</span><span title="Використовують">← ${m.usedBy.length}</span>
          <span class="usage" title="Наскільки модуль центральний"><i style="width:${Math.round(rank * 100)}%"></i></span>
        </div>
        <div class="missues">${m.issues.map((i) => `<span class="chip ${i.cls}" title="${esc(i.title || "")}">${esc(i.text)}</span>`).join("")}</div>
      </summary>
      <div class="mbody">
        <p class="mono muted mpath">Assets/${esc(m.path)}</p>
        ${list("Неймспейси", m.namespaces)}
        ${list("Інтерфейси", m.interfaces)}
        ${list("Інсталери", m.installers)}
        ${list("Конфіги (SO)", m.configs)}
        ${list("Залежить від", m.deps, chipLink)}
        ${list("Використовують", m.usedBy, chipLink)}
        ${m.tasks.length ? `<div data-progress="tasks:${m.tasks.map(esc).join(",")}" data-label="Задачі модуля"></div>` : ""}
        ${list("Задачі на дошці", m.tasks, taskChip)}
      </div>
    </details>`;
  }

  function render() {
    const q = $("#mSearch").value.trim().toLowerCase();
    const layer = $("#mLayer").value, sort = $("#mSort").value, onlyIssues = $("#mIssues").checked;
    let rows = mods.filter((m) =>
      (!layer || m.layer === layer) &&
      (!onlyIssues || m.issues.some((i) => i.cls === "bug" || i.cls === "p1" || i.cls === "p2")) &&
      (!q || [m.name, m.desc, m.group, ...m.namespaces, ...m.interfaces].join(" ").toLowerCase().includes(q)));

    const out = $("#modsList");
    if (!rows.length) { out.innerHTML = `<div class="empty">Нічого не знайдено</div>`; return; }
    if (sort === "group") {
      const groups = new Map();
      rows.forEach((m) => {
        const g = m.layer === "Core" ? "Core" : (m.group || "Features");
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g).push(m);
      });
      out.innerHTML = [...groups].map(([g, ms]) => `
        <section class="mgroup-block"><h3>${esc(g)} <span class="muted">· ${ms.length}</span></h3>
        <div class="mgrid">${ms.map(card).join("")}</div></section>`).join("");
    } else {
      rows = [...rows].sort((a, b) => (sort === "usedBy" ? b.usedBy.length - a.usedBy.length : sort === "deps" ? b.deps.length - a.deps.length : b.files - a.files));
      out.innerHTML = `<div class="mgrid">${rows.map(card).join("")}</div>`;
    }
    $$(".mgrid .mcard", out).forEach((el, i) => el.style.setProperty("--i", Math.min(i, 20)));
    window.BoardLive?.update();   // живі статуси задач у щойно намальованих картках
  }

  $$(".mods-filters input, .mods-filters select").forEach((el) => el.addEventListener("input", render));
  document.addEventListener("click", (e) => {
    const j = e.target.closest("[data-jump]");
    if (!j) return;
    e.preventDefault();
    $("#mSearch").value = ""; $("#mLayer").value = ""; $("#mIssues").checked = false;
    render();
    const el = document.getElementById("m-" + j.dataset.jump);
    if (el) { el.open = true; el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); }
  });

  // Вкладки «Каталог» / «Правила і шаблон»
  $$(".mods-tabs [data-tab]").forEach((b) => b.addEventListener("click", () => {
    $$(".mods-tabs [data-tab]").forEach((x) => x.classList.toggle("active", x === b));
    $("#tab-catalog").hidden = b.dataset.tab !== "catalog";
    $("#tab-rules").hidden = b.dataset.tab !== "rules";
  }));
  $("#copyTpl").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText($("#tpl").textContent); $("#copyTpl").textContent = "Скопійовано ✓"; }
    catch (e) { $("#copyTpl").textContent = "Виділіть текст вручну"; }
    setTimeout(() => ($("#copyTpl").textContent = "Скопіювати"), 1800);
  });

  render();
})();
