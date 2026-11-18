(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const A = window.AUDIO || { packs: [], needed: [], channels: [] };
  const sum = (k) => A.packs.reduce((s, p) => s + (p[k] || 0), 0);
  const found = A.needed.filter((n) => n.status === "found").length;

  $("#sdMeta").textContent = `Згенеровано з Assets ${A.generated || ""}. Аудіофайли на сайт не викладаються — лише перелік.`;
  $("#sdKpis").innerHTML = `
    <div class="kpi accent"><div class="v">${sum("count")}</div><div class="l">Аудіофайлів у ${A.packs.length} паках</div></div>
    <div class="kpi cyan"><div class="v">${Math.round(sum("minutes"))} хв</div><div class="l">Тривалість WAV</div></div>
    <div class="kpi warn"><div class="v">${Math.round(sum("sizeMB"))} МБ</div><div class="l">Розмір</div></div>
    <div class="kpi bad"><div class="v">${found}/${A.needed.length}</div><div class="l">Покриття потреб гри</div></div>`;
  $("#sdChannels").innerHTML = A.channels.map((c) => `<code>${esc(c)}</code>`).join(", ") || "—";

  // Покриття
  const groups = new Map();
  A.needed.forEach((n) => { if (!groups.has(n.group)) groups.set(n.group, []); groups.get(n.group).push(n); });
  $("#sdCoverage").innerHTML = [...groups].map(([g, items]) => {
    const ok = items.filter((n) => n.status === "found").length;
    return `<article class="cov-card"><h4>${esc(g)} <span class="muted">${ok}/${items.length}</span></h4><ul>${
      [...items].sort((a, b) => (a.status === b.status ? 0 : a.status === "missing" ? -1 : 1)).map((n) => {
        const where = n.found.map((f) => `${esc(f.pack.split("/").pop())}: ${f.names.slice(0, 2).map(esc).join(", ")}${f.count > 2 ? ` +${f.count - 2}` : ""}`).join(" · ");
        return `<li class="st-row"><span class="st ${n.status}"></span><div><b>${esc(n.item)}</b><small>${n.status === "missing" ? "немає звуку" : where}</small></div></li>`;
      }).join("")}</ul></article>`;
  }).join("");

  // Каталог
  const cats = [...new Set(A.packs.map((p) => p.category))];
  $("#aCat").innerHTML = `<option value="">Усі категорії</option>` + cats.map((c) => `<option>${esc(c)}</option>`).join("");
  const maxSize = Math.max(...A.packs.map((p) => p.sizeMB), 1);
  const card = (p, i) => `<details class="mcard pack" style="--i:${Math.min(i, 20)}">
    <summary>
      <div class="mtitle"><span class="layer ${p.own ? "core" : "feat"}">${p.own ? "Власний" : "Сторонній пак"}</span><b>${esc(p.name)}</b><span class="muted mgroup">${esc(p.category)}</span></div>
      <p class="mdesc mono">${esc(p.pack)}</p>
      <div class="mstats"><span title="Файлів">♪ ${p.count}</span><span title="Тривалість WAV">◷ ${p.minutes} хв</span><span>${Object.entries(p.formats).map(([k, v]) => `${k}:${v}`).join(" ")}</span>
        <span class="usage"><i style="width:${Math.max(3, Math.round((p.sizeMB / maxSize) * 100))}%"></i></span><span>${p.sizeMB} МБ</span></div>
    </summary>
    <div class="mbody"><div class="mrow"><h5>Файли (${p.count})</h5><div class="mvals">${p.files.map((f) => `<code>${esc(f)}</code>`).join(" ")}${p.count > p.files.length ? ` <span class="muted">+${p.count - p.files.length}</span>` : ""}</div></div></div>
  </details>`;
  function renderPacks() {
    const q = $("#aSearch").value.trim().toLowerCase(), cat = $("#aCat").value, sort = $("#aSort").value;
    let rows = A.packs.filter((p) => (!cat || p.category === cat) && (!q || (p.pack + " " + p.files.join(" ")).toLowerCase().includes(q)));
    const out = $("#aPacks");
    if (!rows.length) { out.innerHTML = `<div class="empty">Нічого не знайдено</div>`; return; }
    if (sort === "cat") {
      const g = new Map();
      rows.forEach((p) => { if (!g.has(p.category)) g.set(p.category, []); g.get(p.category).push(p); });
      out.innerHTML = [...g].map(([c, ps]) => `<section class="mgroup-block"><h3>${esc(c)} <span class="muted">· ${ps.length}</span></h3><div class="mgrid">${ps.map(card).join("")}</div></section>`).join("");
    } else {
      rows = [...rows].sort((a, b) => (sort === "size" ? b.sizeMB - a.sizeMB : b.count - a.count));
      out.innerHTML = `<div class="mgrid">${rows.map(card).join("")}</div>`;
    }
  }
  $$("#tab-catalog input, #tab-catalog select").forEach((el) => el.addEventListener("input", renderPacks));
  renderPacks();

  // Ризики
  const missing = (g) => A.needed.filter((n) => n.group === g && n.status === "missing").map((n) => n.item);
  const third = A.packs.filter((p) => !p.own);
  const footsteps = A.packs.find((p) => /footstep/i.test(p.pack));
  const risk = (sev, title, text) => `<article class="gap ${sev}"><div class="top"><span class="sev">${sev === "high" ? "Критично" : sev === "medium" ? "Середньо" : "Низько"}</span></div><h4>${title}</h4><p>${text}</p></article>`;
  $("#sdRisks").innerHTML = [
    risk("high", "Немає звуку станів персонажа", `Бракує: ${missing("Персонаж").join(", ")}. Без них «невидима механіка» GDD не працює — гравець не відчуває стрес і виснаження.`),
    risk("high", "Немає озвучки й звуку діалогів", `Бракує: ${[...missing("Голос"), ...missing("Інтерфейс")].join(", ")}. Діалоги — головна система гри, а зараз вони беззвучні.`),
    risk("medium", "Немає амбієнту локацій", `Бракує: ${missing("Амбієнт").join(", ")}. У мікшері немає каналу Ambience — тиша між подіями руйнує атмосферу нуару.`),
    risk("medium", "Неповний бойовий звук", `Бракує: ${missing("Бій").join(", ")}. Пак «Guns Audios» має нечитабельні назви (bn 1, pa pew, drum gun) — схоже на музичні семпли, їх варто перевірити і перейменувати.`),
    risk("medium", "Ліцензії сторонніх паків", `${third.length} з ${A.packs.length} паків сторонні: ${third.map((p) => p.name).join(", ")}. Запишіть ліцензію кожного; «FREE»-паки часто вимагають згадки автора в титрах.`),
    risk("low", "Великий пак кроків", footsteps ? `${footsteps.name}: ${footsteps.count} файлів, ${footsteps.sizeMB} МБ. Залиште 3–5 варіантів на поверхню, що є в грі, решту приберіть з білда.` : "Перевірте розмір паку кроків."),
    risk("low", "Музика: немає шару напруги", `Є меню, спокій і бій, але немає «Tension» для стелсу й допитів. Без нього перехід зі спокою в бій різкий.`),
  ].join("");

  // Вкладки
  $$(".mods-tabs [data-tab]").forEach((b) => b.addEventListener("click", () => {
    $$(".mods-tabs [data-tab]").forEach((x) => x.classList.toggle("active", x === b));
    ["coverage", "states", "catalog", "guide", "risks"].forEach((t) => ($("#tab-" + t).hidden = b.dataset.tab !== t));
  }));
})();
