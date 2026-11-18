// Живий прогрес дошки на будь-якій сторінці.
//
// Рахує актуальний стан задач: базові (data/tasks.js) + спільні зміни (Supabase через sync.js)
// + локальні зміни цього браузера — і оновлює сторінку щоразу, коли дошка змінюється.
//
//  • смуга прогресу гри під шапкою (додається автоматично на всіх сторінках);
//  • [data-task="AG-006"]           — чип задачі отримує колір статусу, ✓ і підказку;
//  • [data-progress="epic:AUD"]     — блок прогресу за епіком (також phase:S, tasks:AG-001,AG-002);
//    data-label="…" — підпис блоку.
(() => {
  "use strict";
  const P = window.PROJECT;
  if (!P) return;
  const SYNC = window.BoardSync;
  const STORE_KEY = "agency6-taskmanager-v1";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const statusName = Object.fromEntries(P.statuses.map((s) => [s.id, s.name]));
  const COLORS = { backlog: "#5a4930", todo: "#9fb6c9", progress: "#e6b84a", review: "#c7a46b", done: "#8fbf6a", cancelled: "#6b604f" };
  const clean = (o) => { if (!o) return {}; const { _at, _by, ...r } = o; return r; };

  function localStore() {
    try { const d = JSON.parse(localStorage.getItem(STORE_KEY) || "{}"); return { overrides: d.overrides || {}, custom: d.custom || [] }; }
    catch (e) { return { overrides: {}, custom: [] }; }
  }

  function tasks() {
    const sh = SYNC?.state || { overrides: {}, custom: [] };
    // Редактор бачить лише спільний стан (як на дошці); локальні зміни — лише в локальному режимі
    const loc = SYNC?.canWrite() ? { overrides: {}, custom: [] } : localStore();
    return P.tasks.map((t) => ({ ...t, ...clean(sh.overrides[t.id]), ...(loc.overrides[t.id] || {}) }))
      .concat(sh.custom.map((t) => ({ ...clean(t), ...(loc.overrides[t.id] || {}) })), loc.custom);
  }

  function select(spec, all) {
    const [kind, value] = spec.split(":");
    if (kind === "epic") return all.filter((t) => value.split(",").includes(t.epic));
    if (kind === "phase") return all.filter((t) => value.split(",").includes(t.phase));
    if (kind === "tasks") { const ids = value.split(",").map((s) => s.trim()); return all.filter((t) => ids.includes(t.id)); }
    return all;
  }

  function stats(list) {
    const active = list.filter((t) => t.status !== "cancelled");
    const done = active.filter((t) => t.status === "done").length;
    return { total: active.length, done, pct: active.length ? Math.round((done / active.length) * 100) : 0,
      by: Object.fromEntries(P.statuses.map((s) => [s.id, list.filter((t) => t.status === s.id).length])) };
  }
  const bar = (list) => {
    const n = list.length || 1;
    return `<div class="bar">${P.statuses.map((s) => {
      const c = list.filter((t) => t.status === s.id).length;
      return c ? `<span style="width:${(c / n) * 100}%;background:${COLORS[s.id]}" title="${esc(s.name)}: ${c}"></span>` : "";
    }).join("")}</div>`;
  };

  // ── Смуга прогресу під шапкою ─────────────────────────
  function strip(all) {
    let el = document.getElementById("liveStrip");
    if (!el) {
      const header = document.querySelector(".topbar");
      if (!header) return;
      el = document.createElement("a");
      el.id = "liveStrip";
      el.className = "live-strip";
      el.href = "index.html#overview";
      header.after(el);
    }
    const st = stats(all.filter((t) => t.phase !== "0"));
    const p0 = all.filter((t) => t.priority === "P0" && t.status !== "done" && t.status !== "cancelled").length;
    const stab = stats(all.filter((t) => t.phase === "S"));
    const mode = !SYNC?.configured ? "локально" : SYNC.status === "ok" || SYNC.status === "readonly" ? "наживо" : SYNC.status === "busy" ? "зберігаю…" : SYNC.status === "err" ? "немає з'єднання" : "підключення…";
    el.className = `live-strip ${SYNC?.status || "offline"}`;
    el.innerHTML = `
      <span class="ls-label">Прогрес гри</span>
      <span class="ls-bar">${bar(all.filter((t) => t.phase !== "0"))}</span>
      <span class="ls-num"><b>${st.pct}%</b> · ${st.done}/${st.total}</span>
      <span class="ls-item">Стабілізація ${stab.done}/${stab.total}</span>
      <span class="ls-item">Відкритих P0: <b>${p0}</b></span>
      ${SYNC?.myMemberId ? `<span class="ls-item ls-mine" data-href="index.html?mine=1#board">Мої задачі: <b>${myOpen(all).length}</b></span>` : ""}
      <span class="ls-mode"><i></i>${esc(mode)}</span>`;
    el.title = "Відкрити дошку";
    const mine = el.querySelector(".ls-mine");
    if (mine) mine.onclick = (e) => { e.preventDefault(); location.href = mine.dataset.href; };
  }

  // ── Сповіщення про призначені задачі ─────────────────
  const myOpen = (all) => all.filter((t) => SYNC?.myMemberId && t.assigneeId === SYNC.myMemberId && t.status !== "done" && t.status !== "cancelled");
  const seenKey = () => `agency6-seen-assign-${SYNC.myMemberId}`;
  function seen() { try { return new Set(JSON.parse(localStorage.getItem(seenKey()) || "[]")); } catch (e) { return new Set(); } }
  function markSeen(ids) {
    const s = seen(); ids.forEach((id) => s.add(id));
    try { localStorage.setItem(seenKey(), JSON.stringify([...s])); } catch (e) { /* ігноруємо */ }
  }
  function notifyBox() {
    let box = document.getElementById("assignNotes");
    if (!box) { box = document.createElement("div"); box.id = "assignNotes"; box.className = "assign-notes"; box.setAttribute("aria-live", "polite"); document.body.appendChild(box); }
    return box;
  }
  function notify(all) {
    if (!SYNC?.myMemberId || !SYNC.canWrite()) return;
    const known = seen();
    const fresh = myOpen(all).filter((t) => !known.has(t.id));
    if (!fresh.length) return;
    // Перший візит після входу: не засипаємо всіма старими задачами — одне зведене сповіщення
    const firstVisit = localStorage.getItem(seenKey()) === null;
    markSeen(fresh.map((t) => t.id));
    const box = notifyBox();
    const card = document.createElement("div");
    card.className = "assign-note";
    const list = fresh.slice(0, 4).map((t) => `<a href="index.html?task=${encodeURIComponent(t.id)}#list"><b>${esc(t.id)}</b> ${esc(t.title)}</a>`).join("");
    card.innerHTML = `
      <div class="an-head"><span class="an-pin">◆</span><b>${firstVisit ? `На вас ${fresh.length} ${fresh.length === 1 ? "задача" : "задач"}` : fresh.length === 1 ? "Вам призначили задачу" : `Вам призначили ${fresh.length} задач`}</b>
        <button type="button" class="an-close" aria-label="Закрити">✕</button></div>
      <div class="an-list">${list}${fresh.length > 4 ? `<a href="index.html?mine=1#board">ще ${fresh.length - 4}…</a>` : ""}</div>
      <a class="an-all" href="index.html?mine=1#board">Усі мої задачі →</a>`;
    card.querySelector(".an-close").onclick = () => card.remove();
    box.appendChild(card);
    setTimeout(() => card.classList.add("fade"), 14000);
    setTimeout(() => card.remove(), 15000);
  }

  // ── Власнику: нові запити на доступ ───────────────────
  const REQ_KEY = "agency6-seen-requests";
  function notifyRequests() {
    if (!SYNC?.isOwner || !SYNC.requests?.length) return;
    let known;
    try { known = new Set(JSON.parse(localStorage.getItem(REQ_KEY) || "[]")); } catch (e) { known = new Set(); }
    const fresh = SYNC.requests.filter((r) => !known.has(r.id + ":" + r.created_at));
    if (!fresh.length) return;
    fresh.forEach((r) => known.add(r.id + ":" + r.created_at));
    try { localStorage.setItem(REQ_KEY, JSON.stringify([...known].slice(-200))); } catch (e) { /* ігноруємо */ }
    const card = document.createElement("div");
    card.className = "assign-note";
    card.innerHTML = `
      <div class="an-head"><span class="an-pin">✉</span><b>${fresh.length === 1 ? "Новий запит на доступ" : `Нових запитів на доступ: ${fresh.length}`}</b>
        <button type="button" class="an-close" aria-label="Закрити">✕</button></div>
      <div class="an-list">${fresh.slice(0, 4).map((r) => `<span><b>${esc(r.name || "—")}</b> ${esc(r.email)}</span>`).join("")}</div>
      <a class="an-all" href="index.html?access=1#board">Розглянути →</a>`;
    card.querySelector(".an-close").onclick = () => card.remove();
    notifyBox().appendChild(card);
    setTimeout(() => card.classList.add("fade"), 29000);
    setTimeout(() => card.remove(), 30000);
  }
  window.addEventListener("board:requests", notifyRequests);

  // ── Чипи задач ────────────────────────────────────────
  function chips(all) {
    const byId = Object.fromEntries(all.map((t) => [t.id, t]));
    document.querySelectorAll("[data-task]").forEach((el) => {
      const t = byId[el.dataset.task];
      if (!t) return;
      [...el.classList].filter((c) => c.startsWith("status-")).forEach((c) => el.classList.remove(c));
      el.classList.add("chip", "status-" + t.status);
      el.title = `${t.id} · ${t.title} — ${statusName[t.status] || t.status}`;
      const label = el.dataset.taskLabel || el.dataset.task;
      el.textContent = (t.status === "done" ? "✓ " : "") + label;
      if (el.tagName === "A" && !el.getAttribute("href")) el.href = `index.html?task=${encodeURIComponent(t.id)}#list`;
      if (el.tagName !== "A") {
        el.style.cursor = "pointer";
        el.onclick = () => (location.href = `index.html?task=${encodeURIComponent(t.id)}#list`);
      }
    });
  }

  // ── Блоки прогресу ────────────────────────────────────
  function blocks(all) {
    document.querySelectorAll("[data-progress]").forEach((el) => {
      const list = select(el.dataset.progress, all);
      const st = stats(list);
      el.classList.add("live-progress");
      el.innerHTML = `
        <div class="lp-head"><span class="lp-label">${esc(el.dataset.label || "Прогрес")}</span><span class="lp-num"><b>${st.pct}%</b> · ${st.done}/${st.total} готово</span></div>
        ${bar(list)}
        <div class="lp-legend">${P.statuses.filter((s) => st.by[s.id]).map((s) => `<span><i style="background:${COLORS[s.id]}"></i>${esc(s.name)} ${st.by[s.id]}</span>`).join("")}</div>`;
    });
  }

  function update() {
    const all = tasks();
    strip(all);
    chips(all);
    blocks(all);
    notify(all);
  }

  window.BoardLive = { tasks, stats, update };
  window.addEventListener("board:change", update);
  window.addEventListener("board:status", update);
  window.addEventListener("storage", (e) => { if (e.key === STORE_KEY) update(); });   // зміни з іншої вкладки
  update();
  // На сторінці дошки синхронізацію запускає app.js; на інших — тут
  if (SYNC && !document.getElementById("btnSync")) SYNC.start();
})();
