(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const D = window.MODELS || { packs: [], needed: [] };
  const packs = D.packs;
  const models = packs.filter((p) => p.category !== "Анімації");
  const anims = packs.filter((p) => p.category === "Анімації");
  const sum = (arr, k) => arr.reduce((s, p) => s + (p[k] || 0), 0);
  const fmtMB = (mb) => (mb >= 1024 ? `${(mb / 1024).toFixed(1)} ГБ` : `${Math.round(mb)} МБ`);

  // ── KPI ─────────────────────────────────────────────
  const found = D.needed.filter((n) => n.status === "found").length;
  const placeholder = D.needed.filter((n) => n.status === "placeholder").length;
  const missing = D.needed.length - found - placeholder;
  $("#mdMeta").textContent = `Згенеровано з Assets/Content/Global/GameResources ${D.generated || ""}. Бінарні файли на сайт не викладаються — лише перелік.`;
  $("#mdKpis").innerHTML = `
    <div class="kpi accent"><div class="v">${sum(models, "meshCount")}</div><div class="l">Моделей у ${models.length} паках</div></div>
    <div class="kpi cyan"><div class="v">${sum(packs, "anims")}</div><div class="l">Анімацій</div></div>
    <div class="kpi warn"><div class="v">${fmtMB(sum(packs, "sizeMB"))}</div><div class="l">Розмір ассетів</div></div>
    <div class="kpi bad"><div class="v">${found}/${D.needed.length}</div><div class="l">Покриття GDD · ${placeholder} заглушки · ${missing} немає</div></div>`;

  // ── Покриття GDD ────────────────────────────────────
  const groups = new Map();
  D.needed.forEach((n) => { if (!groups.has(n.group)) groups.set(n.group, []); groups.get(n.group).push(n); });
  const order = { missing: 0, placeholder: 1, found: 2 };
  $("#coverage").innerHTML = [...groups].map(([g, items]) => `
    <article class="cov-card">
      <h4>${esc(g)}</h4>
      <ul>${[...items].sort((a, b) => order[a.status] - order[b.status]).map((n) => {
        const where = n.found.map((f) => `${esc(f.pack.split("/").pop())}${f.names.length ? ": " + f.names.slice(0, 3).map(esc).join(", ") : ""}`).join(" · ");
        const note = n.status === "missing" ? "немає моделі" : n.status === "placeholder" ? "лише манекен — потрібна своя модель" : where;
        return `<li class="st-row"><span class="st ${n.status}" aria-hidden="true"></span><div><b>${esc(n.item)}</b><small>${note}</small></div></li>`;
      }).join("")}</ul>
    </article>`).join("");

  // ── Каталог ─────────────────────────────────────────
  const cats = [...new Set(packs.map((p) => p.category))];
  $("#pCat").innerHTML = `<option value="">Усі категорії</option>` + cats.map((c) => `<option>${esc(c)}</option>`).join("");
  const maxSize = Math.max(...packs.map((p) => p.sizeMB), 1);

  function packCard(p, i) {
    const heavy = p.sizeMB > 150;
    return `<details class="mcard pack" style="--i:${Math.min(i, 20)}">
      <summary>
        <div class="mtitle"><span class="layer ${p.own ? "core" : "feat"}">${p.own ? "Власна" : "Сторонній пак"}</span><b>${esc(p.name)}</b><span class="muted mgroup">${esc(p.category)}</span></div>
        <p class="mdesc mono">${esc(p.pack)}</p>
        <div class="mstats">
          <span title="Моделей">▲ ${p.meshCount}</span><span title="Префабів">◫ ${p.prefabs}</span><span title="Матеріалів">◐ ${p.materials}</span><span title="Текстур">▦ ${p.textures}</span>${p.anims ? `<span title="Анімацій">↻ ${p.anims}</span>` : ""}
          <span class="usage" title="${p.sizeMB} МБ"><i style="width:${Math.max(3, Math.round((p.sizeMB / maxSize) * 100))}%"></i></span><span class="${heavy ? "heavy" : ""}">${fmtMB(p.sizeMB)}</span>
        </div>
      </summary>
      <div class="mbody">
        ${p.meshes.length ? `<div class="mrow"><h5>Моделі (${p.meshCount})</h5><div class="mvals">${p.meshes.map((m) => `<code>${esc(m)}</code>`).join(" ")}${p.meshCount > p.meshes.length ? ` <span class="muted">+${p.meshCount - p.meshes.length}</span>` : ""}</div></div>` : `<p class="muted">Окремих мешів немає — ${p.anims ? "анімації" : "префаби й ефекти"}.</p>`}
      </div>
    </details>`;
  }
  function renderPacks() {
    const q = $("#pSearch").value.trim().toLowerCase(), cat = $("#pCat").value, sort = $("#pSort").value, own = $("#pOwn").checked;
    let rows = packs.filter((p) => (!cat || p.category === cat) && (!own || p.own) &&
      (!q || (p.pack + " " + p.meshes.join(" ")).toLowerCase().includes(q)));
    const out = $("#packs");
    if (!rows.length) { out.innerHTML = `<div class="empty">Нічого не знайдено</div>`; return; }
    if (sort === "cat") {
      const g = new Map();
      rows.forEach((p) => { if (!g.has(p.category)) g.set(p.category, []); g.get(p.category).push(p); });
      out.innerHTML = [...g].map(([c, ps]) => `<section class="mgroup-block"><h3>${esc(c)} <span class="muted">· ${ps.length}</span></h3><div class="mgrid">${ps.map(packCard).join("")}</div></section>`).join("");
    } else {
      rows = [...rows].sort((a, b) => (sort === "size" ? b.sizeMB - a.sizeMB : b.meshCount - a.meshCount));
      out.innerHTML = `<div class="mgrid">${rows.map(packCard).join("")}</div>`;
    }
  }
  $$("#tab-catalog input, #tab-catalog select").forEach((el) => el.addEventListener("input", renderPacks));
  renderPacks();

  // ── Ризики (обчислюються з даних) ───────────────────
  const third = packs.filter((p) => !p.own);
  const heavy = [...packs].sort((a, b) => b.sizeMB - a.sizeMB).slice(0, 5);
  const offStyle = packs.filter((p) => /sci-?fi|samurai|justice|tomahawk|arcade|select character|slash/i.test(p.pack));
  const charPh = D.needed.filter((n) => n.status === "placeholder").map((n) => n.item);
  const miss = D.needed.filter((n) => n.status === "missing").map((n) => n.item);
  const risk = (sev, title, text, extra = "") => `<article class="gap ${sev}"><div class="top"><span class="sev">${sev === "high" ? "Критично" : sev === "medium" ? "Середньо" : "Низько"}</span></div><h4>${title}</h4><p>${text}</p>${extra}</article>`;
  $("#risks").innerHTML = [
    risk("high", "Немає власних персонажів", `Агент, вороги й цивільні — лише манекени HumanCharacterDummy (${charPh.join(", ")}). Для ізометричного детективу персонажі — головне, що бачить гравець; потрібна модель агента в стилі нуар (костюм, плащ) і 3–4 типи NPC.`),
    risk("high", "Ліцензії сторонніх паків", `${third.length} з ${packs.length} паків — сторонні (схоже на Asset Store). Їх можна використовувати в грі, але не можна викладати у відкритий репозиторій чи на сайт. Перевірте, що ігровий репозиторій приватний, і записуйте ліцензію для кожного паку.`),
    risk("medium", `Бракує ${miss.length} предметів з GDD`, `Немає моделей: ${miss.join(", ")}. Більшість — дрібні предмети розслідування й сюжету, які гравець бачить у руці та в діалогах.`),
    risk("medium", "Важкі паки роздувають репозиторій", `Найбільші: ${heavy.map((p) => `${p.name} (${fmtMB(p.sizeMB)})`).join(", ")}. Перевірте розмір текстур (4K для дрібних предметів не потрібні), зберігайте бінарні файли через Git LFS.`),
    risk("medium", "Ассети не в стилі гри", `Нуар 80–90-х не поєднується з: ${offStyle.map((p) => p.name).join(", ")}. Кандидати на видалення з проєкту, щоб не потрапили в білд і не плутали команду.`),
    risk("low", "Анімації з чужих жанрів", `Серед ${sum(anims, "anims")} анімацій є набори Dance, OrcHammer, Spellbook — для детективу вони не потрібні. Залиште базовий рух, пістолет, гвинтівку, взаємодію і допит.`),
  ].join("");

  // ── Вкладки ─────────────────────────────────────────
  $$(".mods-tabs [data-tab]").forEach((b) => b.addEventListener("click", () => {
    $$(".mods-tabs [data-tab]").forEach((x) => x.classList.toggle("active", x === b));
    ["coverage", "catalog", "guide", "risks"].forEach((t) => ($("#tab-" + t).hidden = b.dataset.tab !== t));
  }));
})();
