(() => {
  "use strict";

  const P = window.PROJECT;
  const STORE_KEY = "agency6-taskmanager-v1";
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const phaseById = Object.fromEntries(P.phases.map((p) => [p.id, p]));
  const epicById = Object.fromEntries(P.epics.map((e) => [e.id, e]));
  const statusName = Object.fromEntries(P.statuses.map((s) => [s.id, s.name]));
  const PRIORITY_ORDER = { P0: 0, P1: 1, P2: 2, P3: 3 };
  const STATUS_COLORS = { backlog: "#5a4930", todo: "#9fb6c9", progress: "#e6b84a", review: "#c7a46b", done: "#8fbf6a", cancelled: "#6b604f" };
  // Задача «закрита», якщо виконана або скасована: вона не блокує залежні задачі
  const isClosed = (s) => s === "done" || s === "cancelled";
  const activeTasks = () => allTasks().filter((t) => t.status !== "cancelled");

  // ── Сховище ──────────────────────────────────────────
  // overrides: { [id]: { status, notes, crit: [bool] , ...полів для власних задач } }
  // custom: [task] — задачі, створені в інтерфейсі
  let store = load();

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        return { overrides: data.overrides || {}, custom: data.custom || [] };
      }
    } catch (e) { /* приватний режим або пошкоджені дані */ }
    return { overrides: {}, custom: [] };
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); }
    catch (e) { toast("Не вдалося зберегти в браузері"); }
  }

  // Шари стану: базові задачі (data/tasks.js) → спільний стан із Supabase (sync.js) → локальні зміни браузера.
  // Якщо людина увійшла і вона редактор, нові зміни йдуть у спільний стан, інакше — лише локально.
  const SYNC = window.BoardSync;
  const shared = () => SYNC?.state || { overrides: {}, custom: [] };
  const clean = (o) => { if (!o) return {}; const { _at, _by, ...rest } = o; return rest; };
  const sharedMode = () => !!SYNC?.canWrite();

  function allTasks() {
    const sh = shared();
    // Редактор бачить лише спільний стан: старі локальні зміни (зроблені до входу) більше не
    // перекривають дошку — інакше людина бачить одне, а команда інше. Їх можна перенести в профілі.
    const loc = sharedMode() ? { overrides: {}, custom: [] } : store;
    const base = P.tasks.map((t) => ({ ...t, ...clean(sh.overrides[t.id]), ...(loc.overrides[t.id] || {}), _base: true }));
    const custom = sh.custom.map((t) => ({ ...clean(t), ...(loc.overrides[t.id] || {}), _base: false, _shared: true }))
      .concat(loc.custom.map((t) => ({ ...t, _base: false })));
    return base.concat(custom);
  }
  const isMine = (t) => !!SYNC?.myMemberId && t.assigneeId === SYNC.myMemberId;
  function getTask(id) { return allTasks().find((t) => t.id === id); }
  function patchTask(id, patch) {
    if (sharedMode()) { SYNC.patch(id, patch, getTask(id)); return; }
    const custom = store.custom.find((t) => t.id === id);
    if (custom) Object.assign(custom, patch);
    else store.overrides[id] = { ...(store.overrides[id] || {}), ...patch };
    save();
  }
  function createTask(task) {
    if (sharedMode()) SYNC.create(task);
    else { store.custom.push(task); save(); }
  }
  function deleteTask(id) {
    if (sharedMode() && shared().custom.some((t) => t.id === id)) { SYNC.remove(id, getTask(id)); return; }
    store.custom = store.custom.filter((x) => x.id !== id);
    save();
  }

  // ── Утиліти рендеру ──────────────────────────────────
  const prChip = (p) => `<span class="chip ${esc(p).toLowerCase()}">${esc(p)}</span>`;
  const epicChip = (e) => `<span class="chip epic" title="${esc(epicById[e]?.name || e)}">${esc(e)}</span>`;
  const typeChip = (t) => `<span class="chip ${t === "bug" ? "bug" : ""}">${esc(P.types[t] || t)}</span>`;
  const statusChip = (s) => `<span class="chip status-${esc(s)}">${esc(statusName[s] || s)}</span>`;
  const critProgress = (t) => {
    const total = (t.criteria || []).length;
    if (!total) return "";
    const done = (t.crit || []).filter(Boolean).length;
    return `<span class="crit">☑ ${done}/${total}</span>`;
  };
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 2200);
  }

  // ── Фільтри ──────────────────────────────────────────
  function initFilters() {
    $("#fPhase").innerHTML = `<option value="">Усі фази</option>` + P.phases.map((p) => `<option value="${p.id}">${p.id === "0" ? "" : "Фаза " + p.id + " · "}${esc(p.name)}</option>`).join("");
    $("#fEpic").innerHTML = `<option value="">Усі епіки</option>` + P.epics.map((e) => `<option value="${e.id}">${e.id} · ${esc(e.name)}</option>`).join("");
    $("#fType").innerHTML = `<option value="">Усі типи</option>` + Object.entries(P.types).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("");
    $$("#filters input, #filters select").forEach((el) => el.addEventListener("input", render));
  }
  function filtered() {
    const q = $("#fSearch").value.trim().toLowerCase();
    const ph = $("#fPhase").value, ep = $("#fEpic").value, pr = $("#fPriority").value, ty = $("#fType").value;
    const hideDone = $("#fHideDone").checked;
    const onlyMine = $("#fMine")?.checked;
    return allTasks().filter((t) =>
      (!q || `${t.id} ${t.title} ${t.desc} ${t.assignee || ""}`.toLowerCase().includes(q)) &&
      (!ph || t.phase === ph) && (!ep || t.epic === ep) && (!pr || t.priority === pr) && (!ty || t.type === ty) &&
      (!hideDone || !isClosed(t.status)) && (!onlyMine || isMine(t)));
  }
  // Пріоритет → порядок фази (стабілізація раніше за фічі) → ID
  const PHASE_ORDER = Object.fromEntries(P.phases.map((p, i) => [p.id, i]));
  const byPriority = (a, b) =>
    (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9) ||
    (PHASE_ORDER[a.phase] ?? 99) - (PHASE_ORDER[b.phase] ?? 99) ||
    a.id.localeCompare(b.id, undefined, { numeric: true });

  // ── Огляд ────────────────────────────────────────────
  function renderOverview() {
    const tasks = activeTasks();
    const cancelled = allTasks().length - tasks.length;
    const open = tasks.filter((t) => t.status !== "done");
    const done = tasks.length - open.length;
    const p0 = open.filter((t) => t.priority === "P0").length;
    const gapsHigh = P.gaps.filter((g) => g.severity === "high").length;
    const pct = Math.round((done / tasks.length) * 100);

    const stackBar = (list) => {
      const n = list.length || 1;
      return `<div class="bar">${P.statuses.map((s) => {
        const c = list.filter((t) => t.status === s.id).length;
        return c ? `<span style="width:${(c / n) * 100}%;background:${STATUS_COLORS[s.id]}" title="${esc(s.name)}: ${c}"></span>` : "";
      }).join("")}</div>`;
    };
    const phaseRows = P.phases.map((p) => {
      const list = tasks.filter((t) => t.phase === p.id);
      const d = list.filter((t) => t.status === "done").length;
      return `<div class="bar-row"><span>${p.id === "0" ? "" : "<b>" + p.id + "</b> · "}${esc(p.name)}</span>${stackBar(list)}<span class="n">${d}/${list.length}</span></div>`;
    }).join("");
    const epicRows = P.epics.map((e) => {
      const list = tasks.filter((t) => t.epic === e.id);
      if (!list.length) return "";
      const d = list.filter((t) => t.status === "done").length;
      return `<div class="bar-row"><span>${esc(e.name)}</span>${stackBar(list)}<span class="n">${d}/${list.length}</span></div>`;
    }).join("");

    // Наступні кроки: відкриті P0 без незакритих залежностей
    const isDone = (id) => isClosed(getTask(id)?.status);
    const ready = open.filter((t) => (t.deps || []).every(isDone)).sort(byPriority).slice(0, 8);
    const legend = P.statuses.map((s) => `<span><i style="background:${STATUS_COLORS[s.id]}"></i>${esc(s.name)}</span>`).join("");

    $("#view-overview").innerHTML = `
      <div class="view-head">
        <h2>Огляд проєкту</h2>
        <p class="muted">Оновлено ${esc(P.updated)} · <a href="${esc(P.links.gdd)}" target="_blank" rel="noopener">GDD</a> · <a href="${esc(P.links.doc)}" target="_blank" rel="noopener">Дока</a></p>
      </div>
      <div class="kpis">
        <div class="kpi accent"><div class="v" data-count="${pct}" data-suffix="%">${pct}%</div><div class="l">Готово (${done} з ${tasks.length})${cancelled ? ` · скасовано ${cancelled}` : ""}</div></div>
        <div class="kpi cyan"><div class="v" data-count="${open.length}">${open.length}</div><div class="l">Відкритих задач</div></div>
        <div class="kpi warn"><div class="v" data-count="${p0}">${p0}</div><div class="l">Відкритих P0</div></div>
        <div class="kpi bad"><div class="v" data-count="${gapsHigh}">${gapsHigh}</div><div class="l">Критичних прогалин</div></div>
      </div>
      <div class="cols">
        <div class="card"><h3>Прогрес за фазами</h3><div class="bars">${phaseRows}</div><div class="legend">${legend}</div></div>
        <div class="card"><h3>Можна брати зараз</h3>
          <p class="muted" style="margin:-6px 0 10px;font-size:13px">Відкриті задачі, усі залежності яких закриті; спершу P0.</p>
          <ul class="next-list">${ready.map((t) => `<li data-open="${esc(t.id)}"><span class="mono muted">${esc(t.id)}</span>${prChip(t.priority)}<span>${esc(t.title)}</span></li>`).join("") || `<li class="empty">Немає</li>`}</ul>
        </div>
      </div>
      <div class="cols" style="margin-top:16px">
        <div class="card"><h3>Прогрес за епіками</h3><div class="bars">${epicRows}</div></div>
        <div class="card"><h3>Остання активність команди</h3>${activityHtml()}</div>
      </div>`;
  }

  // ── Активність і синхронізація ───────────────────────
  const timeAgo = (iso) => {
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return "щойно";
    if (s < 3600) return `${Math.floor(s / 60)} хв тому`;
    if (s < 86400) return `${Math.floor(s / 3600)} год тому`;
    return new Date(iso).toLocaleDateString("uk-UA", { day: "numeric", month: "short" });
  };
  function describe(e) {
    const who = `<b>${esc(e.by)}</b>`, task = `<span class="mono">${esc(e.id)}</span> ${esc(e.title || "")}`;
    if (e.action === "move") return `${who} перемістив(ла) ${task}: ${esc(statusName[e.from] || e.from || "—")} → <b>${esc(statusName[e.to] || e.to)}</b>`;
    if (e.action === "create") return `${who} створив(ла) ${task}`;
    if (e.action === "delete") return `${who} видалив(ла) ${task}`;
    return `${who} оновив(ла) ${task}`;
  }
  let freshKeys = new Set();
  function activityHtml() {
    if (!SYNC) return `<p class="empty">Синхронізація недоступна</p>`;
    const log = (shared().log || []).slice(0, 25);
    const help = SYNC.canWrite() ? "" : `<p class="help">${SYNC.configured ? "Тут видно, хто і що перемістив. Щоб ваші зміни теж бачили інші, увійдіть за email." : "Спільну дошку ще не налаштовано — журнал з'явиться після підключення Supabase."}</p>`;
    if (!log.length) return help + `<p class="empty">Поки що ніхто нічого не переміщував</p>`;
    return help + `<ul class="activity">${log.map((e) => `<li data-open="${esc(e.id)}" class="${freshKeys.has(e.at + e.id) ? "new" : ""}"><time datetime="${esc(e.at)}">${timeAgo(e.at)}</time><span>${describe(e)}</span></li>`).join("")}</ul>
`;
  }

  const SYNC_LABEL = { idle: "Підключення…", offline: "Локальний режим", readonly: "Лише перегляд", ok: "Наживо", busy: "Зберігаю…", err: "Помилка синхронізації" };
  function renderSyncButton() {
    const b = $("#btnSync");
    if (!b || !SYNC) return;
    b.className = `sync ${SYNC.status}`;
    b.innerHTML = `<span class="led"></span>${SYNC_LABEL[SYNC.status] || ""}`;
    b.title = SYNC.error || (SYNC.canWrite() ? "Зміни одразу бачить уся команда" : SYNC.configured ? "Увійдіть за email, щоб ваші зміни бачили інші" : "Спільну дошку ще не налаштовано — зміни лише локальні");
  }

  // ── Вхід за посиланням з email (Supabase) ────────────
  const MAIL_ICON = `<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.5" d="M2 3.5h12v9H2zM2.5 4l5.5 4.5L13.5 4"/></svg>`;
  // Аватар з ініціалами: колір стабільний для імені
  function avatarImg(name, size = 22) {
    const initials = (name || "?").trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    let h = 0; for (const ch of name || "") h = (h * 31 + ch.charCodeAt(0)) % 360;
    return `<span class="avatar initials" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.42)}px;--h:${h}">${esc(initials)}</span>`;
  }

  function renderLoginButton() {
    const b = $("#btnLogin");
    if (!b || !SYNC) return;
    if (SYNC.signedIn()) {
      const reqs = SYNC.isOwner ? (SYNC.requests || []).length : 0;
      b.className = `btn login on${SYNC.isMember ? "" : " guest"}`;
      b.innerHTML = `${avatarImg(SYNC.name)}<span>${esc(SYNC.name)}${SYNC.isMember ? "" : " · гість"}</span>${reqs ? `<span class="badge" title="Запити на доступ">${reqs}</span>` : ""}`;
      b.title = SYNC.isMember ? `Увійшли як ${SYNC.login}` : `${SYNC.login} немає в списку редакторів — зміни лише локальні`;
    } else {
      b.className = "btn login";
      b.innerHTML = `${MAIL_ICON}<span>Увійти</span>`;
      b.title = SYNC.configured ? "Увійти за email, щоб ваші зміни бачила вся команда" : "Спільну дошку ще не налаштовано";
    }
  }

  function localChangesCount() { return Object.keys(store.overrides).length + store.custom.length; }
  function migrateLocal() {
    Object.entries(store.overrides).forEach(([id, patch]) => SYNC.patch(id, patch, getTask(id)));
    store.custom.forEach((t) => SYNC.create(t));
    store = { overrides: {}, custom: [] }; save();
  }

  // Кнопка, що на час дії показує «…» і не дає натиснути двічі
  async function busy(btn, text, fn) {
    const old = btn.innerHTML; btn.disabled = true; btn.textContent = text;
    try { return await fn(); } finally { btn.disabled = false; btn.innerHTML = old; }
  }
  const enterSubmits = (inputs, fn) => inputs.forEach((i) => i?.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); fn(); } }));

  function openSyncDialog(tab = "login") {
    if (!SYNC.configured) return openSetupDialog();
    if (SYNC.signedIn()) return openProfileDialog();
    if (!SYNC.client) { toast("Ще підключаюсь до сервера — спробуйте за секунду"); return; }
    form.innerHTML = `
      <div class="dlg-head"><div class="id">Спільна дошка</div><h3>${tab === "request" ? "Запросити доступ" : "Вхід"}</h3></div>
      <div class="dlg-body">
        <div class="seg" role="tablist">
          <button type="button" class="${tab === "login" ? "on" : ""}" data-tab="login">Увійти</button>
          <button type="button" class="${tab === "request" ? "on" : ""}" data-tab="request">Запросити доступ</button>
        </div>
        ${tab === "login" ? `
          <label class="field">Email<input id="sEmail" type="email" autocomplete="username" placeholder="you@example.com"></label>
          <label class="field">Пароль<input id="sPass" type="password" autocomplete="current-password" placeholder="пароль від власника дошки"></label>
          <p class="help" id="sError" style="color:var(--bad)"></p>
          <button class="btn primary wide" type="button" id="sGo">Увійти</button>
          <p class="help">Браузер запам'ятає вхід — наступного разу дошка відкриється вже з вашим ім'ям. Немає пароля? Перейдіть у «Запросити доступ».</p>
          <details class="help-more"><summary>Не пам'ятаю пароль</summary>
            <p class="help">Попросіть власника дошки видати новий пароль (профіль → «Доступ» → «Новий пароль»). Або отримайте посилання для входу на email, а потім задайте пароль у профілі:</p>
            <button class="btn" type="button" id="sLink">${MAIL_ICON}<span>Надіслати посилання на email</span></button>
            <p class="help" id="sLinkMsg"></p>
          </details>` : `
          <p>Залиште заявку — власник дошки отримає сповіщення, підтвердить її і передасть вам пароль.</p>
          <label class="field">Ваше ім'я<input id="rName" maxlength="40" autocomplete="name" placeholder="Як вас показувати в журналі"></label>
          <label class="field">Email<input id="rEmail" type="email" autocomplete="email" placeholder="you@example.com"></label>
          <label class="field">Коментар (необов'язково)<input id="rNote" maxlength="300" placeholder="Напр.: 3D-артист, працюю над рівнями"></label>
          <p class="help" id="sError" style="color:var(--bad)"></p>
          <button class="btn primary wide" type="button" id="rGo">Надіслати запит</button>
          <div id="rDone" class="who-card" hidden>${MAIL_ICON.replace('width="15" height="15"', 'width="28" height="28"')}<div><b>Запит надіслано</b><span class="muted">Коли власник підтвердить, він передасть вам пароль. Тоді увійдіть на вкладці «Увійти».</span></div></div>`}
      </div>
      <div class="dlg-foot"><div class="right"><button class="btn" type="button" data-close>Закрити</button></div></div>`;
    form.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => openSyncDialog(b.dataset.tab)));
    const err = $("#sError", form);
    if (tab === "login") {
      const go = () => busy($("#sGo", form), "Входжу…", async () => {
        err.textContent = "";
        const problem = await SYNC.signInPassword($("#sEmail", form).value, $("#sPass", form).value);
        if (problem) { err.textContent = problem; return; }
        dlg.close(); renderLoginButton(); render();
        toast(SYNC.isMember ? `Вітаю, ${SYNC.name}! Зміни бачить уся команда` : "Ви увійшли, але ще не маєте права редагувати");
      });
      $("#sGo", form).addEventListener("click", go);
      enterSubmits([$("#sEmail", form), $("#sPass", form)], go);
      $("#sLink", form).addEventListener("click", (e) => busy(e.currentTarget, "Надсилаю…", async () => {
        const problem = await SYNC.signInLink($("#sEmail", form).value);
        $("#sLinkMsg", form).textContent = problem || "Лист надіслано — відкрийте посилання з нього (перевірте «Спам»).";
      }));
      $("#sEmail", form).focus();
    } else {
      const go = () => busy($("#rGo", form), "Надсилаю…", async () => {
        err.textContent = "";
        const problem = await SYNC.requestAccess($("#rEmail", form).value, $("#rName", form).value, $("#rNote", form).value);
        if (problem) { err.textContent = problem; return; }
        $("#rDone", form).hidden = false; $("#rGo", form).hidden = true;
      });
      $("#rGo", form).addEventListener("click", go);
      enterSubmits([$("#rName", form), $("#rEmail", form), $("#rNote", form)], go);
      $("#rName", form).focus();
    }
    if (!dlg.open) dlg.showModal();
  }

  // ── Панель власника: запити, учасники, паролі ────────
  function credentialsText(email, password) {
    const url = location.origin + location.pathname;
    return `Доступ до дошки The Agency 6\n${url}\nНатисніть «Увійти»\nEmail: ${email}\nПароль: ${password}`;
  }
  function showCredentials(box, email, password) {
    const text = credentialsText(email, password);
    box.hidden = false;
    box.innerHTML = `<b>Доступ видано — передайте людині:</b><pre>${esc(text)}</pre>
      <div class="row-btns"><button class="btn primary" type="button" data-copy>Копіювати</button></div>
      <p class="help">Пароль показується лише зараз. Якщо загубиться — натисніть «Новий пароль».</p>`;
    $("[data-copy]", box).addEventListener("click", async (e) => {
      try { await navigator.clipboard.writeText(text); e.currentTarget.textContent = "Скопійовано ✓"; }
      catch (x) { e.currentTarget.textContent = "Виділіть текст і скопіюйте"; }
    });
  }

  async function renderAccessPanel(root) {
    if (!root) return;
    const reqs = SYNC.requests || [];
    root.innerHTML = `
      <h4>Запити на доступ ${reqs.length ? `<span class="badge">${reqs.length}</span>` : ""}</h4>
      ${reqs.length ? `<ul class="req-list">${reqs.map((r) => `
        <li data-req="${r.id}"><div><b>${esc(r.name || "—")}</b> <span class="muted">${esc(r.email)}</span>${r.note ? `<small>${esc(r.note)}</small>` : ""}<small class="muted">${timeAgo(r.created_at)}</small></div>
          <span class="row-btns"><button class="btn primary" type="button" data-approve>Підтвердити</button><button class="btn ghost" type="button" data-reject>Відхилити</button></span></li>`).join("")}</ul>`
        : `<p class="muted">Нових запитів немає. Коли хтось натисне «Запросити доступ», ви побачите сповіщення тут і на будь-якій сторінці сайту.</p>`}
      <div class="cred" id="aCred" hidden></div>
      <h4>Видати доступ вручну</h4>
      <div class="verify-row"><input id="aEmail" type="email" placeholder="email"><input id="aName" maxlength="40" placeholder="ім'я"><button class="btn" type="button" id="aAdd">Видати</button></div>
      <h4>Учасники</h4>
      <ul class="req-list" id="aMembers"><li class="muted">Завантажую…</li></ul>
      <p class="help" id="aError" style="color:var(--bad)"></p>`;
    const cred = $("#aCred", root), aErr = $("#aError", root);
    const fail = (e) => { aErr.textContent = e.message || String(e); };
    root.querySelectorAll("[data-req]").forEach((li) => {
      const r = reqs.find((x) => String(x.id) === li.dataset.req);
      $("[data-approve]", li).addEventListener("click", (e) => busy(e.currentTarget, "…", async () => {
        try { const pw = await SYNC.owner.grant(r.email, r.name); await renderAccessPanel(root); showCredentials($("#aCred", root), r.email, pw); } catch (x) { fail(x); }
      }));
      $("[data-reject]", li).addEventListener("click", (e) => busy(e.currentTarget, "…", async () => {
        try { await SYNC.owner.reject(r.id); await renderAccessPanel(root); } catch (x) { fail(x); }
      }));
    });
    $("#aAdd", root).addEventListener("click", (e) => busy(e.currentTarget, "…", async () => {
      const email = $("#aEmail", root).value.trim().toLowerCase();
      try { const pw = await SYNC.owner.grant(email, $("#aName", root).value); await renderAccessPanel(root); showCredentials($("#aCred", root), email, pw); } catch (x) { fail(x); }
    }));
    try {
      const members = await SYNC.owner.members();
      const ul = $("#aMembers", root);
      if (!ul) return;
      ul.innerHTML = members.map((m) => `
        <li><div>${avatarImg(m.name, 22)} <b>${esc(m.name)}</b> <span class="muted">${esc(m.email)}</span>
          <small class="muted">${m.is_owner ? "власник · " : ""}${m.last_sign_in ? `входив ${timeAgo(m.last_sign_in)}` : m.joined ? "акаунт є" : "ще не входив"}</small></div>
          <span class="row-btns"><button class="btn" type="button" data-pass="${esc(m.email)}">Новий пароль</button>${m.is_owner ? "" : `<button class="btn ghost danger" type="button" data-remove="${esc(m.email)}">Прибрати</button>`}</span></li>`).join("");
      ul.querySelectorAll("[data-pass]").forEach((b) => b.addEventListener("click", (e) => busy(e.currentTarget, "…", async () => {
        const email = b.dataset.pass;
        if (email === SYNC.login && !confirm("Задати новий пароль собі? Старий перестане працювати.")) return;
        try { const pw = await SYNC.owner.grant(email, ""); showCredentials($("#aCred", root), email, pw); $("#aCred", root).scrollIntoView({ block: "nearest" }); } catch (x) { fail(x); }
      })));
      ul.querySelectorAll("[data-remove]").forEach((b) => b.addEventListener("click", (e) => {
        if (!confirm(`Прибрати ${b.dataset.remove} з редакторів? Людина зможе лише переглядати дошку.`)) return;
        busy(e.currentTarget, "…", async () => { try { await SYNC.owner.remove(b.dataset.remove); await renderAccessPanel(root); } catch (x) { fail(x); } });
      }));
    } catch (x) { fail(x); }
  }

  function openProfileDialog(section) {
    const mine = (shared().log || []).filter((e) => e.userId && e.userId === SYNC.userId).length;
    const local = localChangesCount();
    form.innerHTML = `
      <div class="dlg-head"><div class="id">Спільна дошка</div><h3>${SYNC.isMember ? "Ваш профіль" : "Ви увійшли як гість"}</h3></div>
      <div class="dlg-body">
        <div class="who-card ${SYNC.isMember ? "" : "guest"}">${avatarImg(SYNC.name, 44)}<div><b>${esc(SYNC.name)}</b><span class="muted">${esc(SYNC.login)} · ${SYNC.isMember ? `редактор · ${mine} змін` : "немає права редагувати"}</span></div><span class="ok-mark">${SYNC.isMember ? "✓" : "!"}</span></div>
        <label class="field">Ім'я, яке бачать інші в журналі
          <span class="verify-row"><input id="sName" value="${esc(SYNC.name)}" maxlength="40"><button class="btn" type="button" id="sSaveName">Зберегти</button></span>
        </label>
        <label class="field">Новий пароль
          <span class="verify-row"><input id="sNewPass" type="password" autocomplete="new-password" minlength="8" placeholder="щонайменше 8 символів"><button class="btn" type="button" id="sSavePass">Змінити</button></span>
        </label>
        ${SYNC.isMember
          ? `<p>Синхронізація: <b>${esc(SYNC_LABEL[SYNC.status] || SYNC.status)}</b>${SYNC.error ? ` — ${esc(SYNC.error)}` : ""}.</p>
             ${local ? `<button class="btn" type="button" id="sMigrate">Перенести мої локальні зміни (${local}) у спільну дошку</button>` : ""}`
          : `<p>У вас ще немає права редагувати. Натисніть «Вийти» → «Запросити доступ», і власник дошки підтвердить запит.</p>`}
        <p class="help" id="sError" style="color:var(--bad)"></p>
        ${SYNC.isOwner ? `<details class="access" id="sAccess" ${section === "access" || (SYNC.requests || []).length ? "open" : ""}><summary>Доступ (ви власник)${(SYNC.requests || []).length ? ` <span class="badge">${SYNC.requests.length}</span>` : ""}</summary><div id="sAccessBody"></div></details>` : ""}
      </div>
      <div class="dlg-foot">
        <button class="btn ghost danger" type="button" id="sOff">Вийти</button>
        <div class="right"><button class="btn" type="button" data-close>Закрити</button></div>
      </div>`;
    $("#sSaveName", form).addEventListener("click", async () => {
      const problem = await SYNC.setName($("#sName", form).value);
      if (problem) { $("#sError", form).textContent = problem; return; }
      renderLoginButton(); toast("Ім'я збережено"); dlg.close();
    });
    $("#sOff", form).addEventListener("click", async () => {
      await SYNC.disconnect(); dlg.close(); renderLoginButton(); render();
      toast("Ви вийшли");
    });
    $("#sMigrate", form)?.addEventListener("click", () => { migrateLocal(); dlg.close(); render(); toast("Локальні зміни перенесено"); });
    $("#sSavePass", form).addEventListener("click", (e) => busy(e.currentTarget, "…", async () => {
      const problem = await SYNC.setPassword($("#sNewPass", form).value);
      if (problem) { $("#sError", form).textContent = problem; return; }
      $("#sNewPass", form).value = ""; toast("Пароль змінено");
    }));
    if (SYNC.isOwner) renderAccessPanel($("#sAccessBody", form));
    if (!dlg.open) dlg.showModal();
  }

  function openSetupDialog() {
    form.innerHTML = `
      <div class="dlg-head"><div class="id">Supabase</div><h3>Спільну дошку ще не налаштовано</h3></div>
      <div class="dlg-body">
        <p>Зараз дошка працює локально: зміни бачите лише ви. Щоб уся команда бачила одну дошку, власнику треба один раз (≈5 хвилин, безкоштовно):</p>
        <ol class="login-steps">
          <li>Створити проєкт на <a href="https://supabase.com/dashboard" target="_blank" rel="noopener">supabase.com ↗</a>.</li>
          <li>SQL Editor → вставити <code>supabase/schema.sql</code>, у кінці вписати email редакторів → Run.</li>
          <li>Authentication → URL Configuration → вписати адресу сайту.</li>
          <li>Project Settings → API → скопіювати Project URL і anon key у <code>data/config.js</code>.</li>
        </ol>
        <p class="help">Детально — у README, розділ «Спільна дошка».</p>
      </div>
      <div class="dlg-foot"><div class="right"><button class="btn" type="button" data-close>Зрозуміло</button></div></div>`;
    if (!dlg.open) dlg.showModal();
  }

  function initSync() {
    if (!SYNC) return;
    SYNC.onStatus = renderSyncButton;
    SYNC.onChange = () => { if (!dlg.open || !form.querySelector("#dSave")) render(); else renderSyncButton(); };
    SYNC.onRemoteEvents = (events) => {
      events.forEach((e) => freshKeys.add(e.at + e.id));
      const e = events[0];
      if (e.action === "move") toast(`${e.by}: ${e.id} → ${statusName[e.to] || e.to}`);
      else if (e.action === "create") toast(`${e.by}: нова задача ${e.id}`);
      lastMovedId = e.id;
      render();
    };
    // «Лише мої» — видно, коли людина увійшла як редактор; ?mine=1 вмикає фільтр одразу
    const mine = $("#fMine");
    if (mine && new URLSearchParams(location.search).get("mine") === "1") mine.checked = true;
    window.addEventListener("board:change", () => { const w = $("#fMineWrap"); if (w) w.hidden = !SYNC.myMemberId; });
    $("#btnSync").addEventListener("click", () => openSyncDialog());
    $("#btnLogin")?.addEventListener("click", () => openSyncDialog());
    // Нові запити на доступ (для власника): значок на кнопці й живе оновлення відкритої панелі
    const wantAccess = new URLSearchParams(location.search).get("access") === "1";
    let accessOpened = false;
    window.addEventListener("board:requests", () => {
      renderLoginButton();
      const body = form.querySelector("#sAccessBody");
      if (dlg.open && body && !form.querySelector("#aCred:not([hidden])")) renderAccessPanel(body);
      if (wantAccess && SYNC.isOwner && !accessOpened && !dlg.open) { accessOpened = true; openProfileDialog("access"); }
    });
    window.addEventListener("board:change", renderLoginButton);
    renderSyncButton();
    renderLoginButton();
    SYNC.start();
  }

  // ── Дошка ────────────────────────────────────────────
  function cardHtml(t) {
    const ph = phaseById[t.phase];
    return `<article class="tcard" draggable="true" data-id="${esc(t.id)}" style="--phase:${ph ? ph.color : "#5a4930"}">
      <div class="row"><span class="id">${esc(t.id)}</span>${prChip(t.priority)}</div>
      <div class="title">${esc(t.title)}</div>
      <div class="meta">${epicChip(t.epic)}${t.type === "bug" ? typeChip(t.type) : ""}<span class="chip">${esc(t.estimate || "—")}</span>${t.phase !== "0" ? `<span class="chip">Ф-${esc(t.phase)}</span>` : ""}${critProgress(t)}</div>
      ${t.assignee ? `<div class="assignee ${isMine(t) ? "mine" : ""}" title="Виконавець: ${esc(t.assignee)}">${avatarImg(t.assignee, 20)}<span>${isMine(t) ? "Ви" : esc(t.assignee)}</span></div>` : ""}
    </article>`;
  }
  function renderBoard() {
    const tasks = filtered();
    $("#view-board").innerHTML = `<div class="board">${P.statuses.map((s) => {
      const list = tasks.filter((t) => t.status === s.id).sort(byPriority);
      return `<section class="column" data-status="${s.id}">
        <header><h3>${esc(s.name)}</h3><span class="count">${list.length}</span></header>
        <div class="cards">${list.map(cardHtml).join("") || `<div class="empty">Порожньо</div>`}</div>
      </section>`;
    }).join("")}</div>`;
    bindDrag();
  }
  function bindDrag() {
    $$(".tcard").forEach((c) => {
      c.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/plain", c.dataset.id); c.classList.add("dragging"); });
      c.addEventListener("dragend", () => c.classList.remove("dragging"));
    });
    $$(".column").forEach((col) => {
      col.addEventListener("dragover", (e) => { e.preventDefault(); col.classList.add("drop"); });
      col.addEventListener("dragleave", () => col.classList.remove("drop"));
      col.addEventListener("drop", (e) => {
        e.preventDefault();
        col.classList.remove("drop");
        const id = e.dataTransfer.getData("text/plain");
        const t = getTask(id);
        if (t && t.status !== col.dataset.status) {
          patchTask(id, { status: col.dataset.status });
          lastMovedId = id;
          toast(`${id} → ${statusName[col.dataset.status]}`);
          render();
        }
      });
    });
  }

  // ── Список ───────────────────────────────────────────
  function renderList() {
    const tasks = filtered();
    $("#view-list").innerHTML = P.phases.map((p) => {
      const list = tasks.filter((t) => t.phase === p.id).sort(byPriority);
      if (!list.length) return "";
      return `<section class="phase-group">
        <header><span class="phase-dot" style="background:${p.color}"></span><h3>${p.id === "0" ? "" : "Фаза " + p.id + " · "}${esc(p.name)}</h3><span class="muted">${esc(p.goal)}</span></header>
        <div class="table-wrap"><table>
          <thead><tr><th>ID</th><th>Задача</th><th>Епік</th><th>Тип</th><th>Пріор.</th><th>Оцінка</th><th>Статус</th><th>Залежить від</th></tr></thead>
          <tbody>${list.map((t) => `<tr data-open="${esc(t.id)}" class="${isClosed(t.status) ? "is-done" : ""} ${t.status === "cancelled" ? "is-cancelled" : ""}">
            <td class="idc">${esc(t.id)}</td><td class="ttl">${esc(t.title)}</td><td>${epicChip(t.epic)}</td><td>${typeChip(t.type)}</td>
            <td>${prChip(t.priority)}</td><td class="mono">${esc(t.estimate || "")}</td><td>${statusChip(t.status)}</td>
            <td class="mono muted">${esc((t.deps || []).join(", "))}</td></tr>`).join("")}</tbody>
        </table></div>
      </section>`;
    }).join("") || `<div class="empty">Нічого не знайдено за фільтрами</div>`;
  }

  // ── Роадмап ──────────────────────────────────────────
  function renderRoadmap() {
    const tasks = activeTasks();
    const weeks = Math.max(...P.phases.map((p) => p.weeks[1]));
    const scale = Array.from({ length: weeks }, (_, i) => `<span>Т${i + 1}</span>`).join("");
    const rows = P.phases.filter((p) => p.id !== "0").map((p) => {
      const list = tasks.filter((t) => t.phase === p.id);
      const d = list.filter((t) => t.status === "done").length;
      const prog = list.length ? (d / list.length) * 100 : 0;
      const [a, b] = p.weeks;
      const left = ((a - 1) / weeks) * 100, width = ((b - a + 1) / weeks) * 100;
      return `<div class="gantt-row">
        <div class="gantt-label"><h4>${p.id} · ${esc(p.name)}</h4><p>Тижні ${a}–${b} · ${d}/${list.length} готово</p></div>
        <div class="gantt-track"><div class="gantt-bar" style="left:${left}%;width:${width}%;background:${p.color}"><span class="prog" style="width:${prog}%"></span><b>${Math.round(prog)}%</b></div></div>
      </div>`;
    }).join("");
    const cards = P.phases.filter((p) => p.id !== "0").map((p) => {
      const list = tasks.filter((t) => t.phase === p.id).sort(byPriority);
      return `<div class="phase-card" style="--c:${p.color}"><h4>${p.id} · ${esc(p.name)}</h4><p class="muted" style="margin:0;font-size:13px">${esc(p.goal)}</p>
        <ul>${list.map((t) => `<li data-open="${esc(t.id)}">${t.status === "done" ? "✓ " : ""}<span class="mono">${esc(t.id)}</span> ${esc(t.title)}</li>`).join("")}</ul></div>`;
    }).join("");
    $("#view-roadmap").innerHTML = `
      <div class="view-head"><h2>Роадмап</h2><p class="muted">Орієнтовно ${weeks} тижнів для однієї людини. Спершу стабілізація, далі фази B і C частково паралельно; вертикальний зріз — фаза E.</p></div>
      <div class="card"><div class="gantt" style="--weeks:${weeks}">
        <div class="gantt-scale"><div></div><div class="gantt-weeks">${scale}</div></div>${rows}
      </div></div>
      <div class="phase-cards">${cards}</div>`;
  }

  // ── Прогалини ────────────────────────────────────────
  function renderGaps() {
    const order = { high: 0, medium: 1, low: 2 };
    const sevName = { high: "Критично", medium: "Середньо", low: "Низько" };
    const gaps = [...P.gaps].sort((a, b) => order[a.severity] - order[b.severity]);
    $("#view-gaps").innerHTML = `
      <div class="view-head"><h2>Прогалини проєкту</h2><p class="muted">Розбіжності між GDD і кодом гілки Development. Клік на задачу відкриває її.</p></div>
      <div class="gap-grid">${gaps.map((g) => {
        const linked = g.tasks.map((id) => getTask(id)).filter(Boolean);
        const closed = linked.filter((t) => t.status === "done").length;
        return `<article class="gap ${g.severity}">
          <div class="top"><span class="sev">${sevName[g.severity]}</span><span class="chip">${esc(g.id)} · ${esc(g.area)}</span></div>
          <h4>${esc(g.title)}</h4><p>${esc(g.text)}</p>
          <div class="links">${linked.map((t) => `<span class="chip ${t.status === "done" ? "status-done" : ""}" data-open="${esc(t.id)}" title="${esc(t.title)}">${esc(t.id)}</span>`).join("")}<span class="chip">закрито ${closed}/${linked.length}</span></div>
        </article>`;
      }).join("")}</div>`;
  }

  // ── Картка задачі ────────────────────────────────────
  const dlg = $("#taskDialog");
  const form = $("#taskForm");

  function openTask(id) {
    const t = getTask(id);
    if (!t) return;
    const ph = phaseById[t.phase];
    const crit = t.criteria || [];
    const critState = t.crit || [];
    form.innerHTML = `
      <div class="dlg-head">
        <div class="id">${esc(t.id)} · ${esc(epicById[t.epic]?.name || t.epic)}${ph ? " · " + (ph.id === "0" ? "" : "Фаза " + ph.id + " ") + esc(ph.name) : ""}</div>
        <h3>${esc(t.title)}</h3>
        <div class="meta">${prChip(t.priority)}${typeChip(t.type)}<span class="chip">Оцінка ${esc(t.estimate || "—")}</span>${statusChip(t.status)}</div>
      </div>
      <div class="dlg-body">
        <section><h4>Опис</h4><p>${esc(t.desc || "Без опису")}</p></section>
        ${crit.length ? `<section><h4>Критерії готовності</h4><ul class="crit-list">${crit.map((c, i) => `
          <li class="${critState[i] ? "done" : ""}"><label><input type="checkbox" data-crit="${i}" ${critState[i] ? "checked" : ""}><span>${esc(c)}</span></label></li>`).join("")}</ul></section>` : ""}
        ${(t.deps || []).length ? `<section><h4>Залежить від</h4><div class="deps">${t.deps.map((d) => {
          const dt = getTask(d);
          return `<span class="chip ${dt?.status === "done" ? "status-done" : ""}" data-open="${esc(d)}" title="${esc(dt?.title || "")}">${dt?.status === "done" ? "✓ " : ""}${esc(d)}</span>`;
        }).join("")}</div></section>` : ""}
        ${blockers(t.id)}
        ${(t.code || []).length ? `<section><h4>Код</h4><p class="mono muted">${t.code.map(esc).join("<br>")}</p></section>` : ""}
        ${t.gdd ? `<section><h4>GDD</h4><p><a href="${esc(P.links.gdd)}" target="_blank" rel="noopener">${esc(t.gdd)}</a></p></section>` : ""}
        <section class="field-grid">
          <label class="field">Статус<select id="dStatus">${P.statuses.map((s) => `<option value="${s.id}" ${s.id === t.status ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label>
          ${assigneeField(t)}
        </section>
        <label class="field">Нотатки<textarea id="dNotes" placeholder="Рішення, посилання, питання…">${esc(t.notes || "")}</textarea></label>
      </div>
      <div class="dlg-foot">
        ${t._base ? "" : `<button class="btn danger" type="button" id="dDelete">Видалити</button>`}
        ${t.status === "cancelled"
          ? `<button class="btn" type="button" id="dRestore" title="Повернути в Backlog">↺ Відновити задачу</button>`
          : `<button class="btn ghost danger" type="button" id="dCancelTask" title="Задача більше не потрібна: зникає з активних, але лишається в історії">✕ Скасувати задачу</button>`}
        <div class="right"><button class="btn" type="button" data-close>Закрити</button><button class="btn primary" type="button" id="dSave">Зберегти</button></div>
      </div>`;

    $$("[data-crit]", form).forEach((cb) => cb.addEventListener("change", () => {
      const arr = [...(getTask(id).crit || [])];
      arr[+cb.dataset.crit] = cb.checked;
      patchTask(id, { crit: arr });
      cb.closest("li").classList.toggle("done", cb.checked);
      render();
    }));
    // Записуємо лише те, що справді змінилось — менше запитів і «порожніх» записів у журналі
    const changes = (status) => {
      const next = { status, notes: $("#dNotes").value, ...readAssignee() };
      return Object.fromEntries(Object.entries(next).filter(([k, v]) => (t[k] ?? "") !== (v ?? "")));
    };
    $("#dSave", form).addEventListener("click", () => {
      const patch = changes($("#dStatus").value);
      // Призначили самі собі — сповіщення «вам призначили» не потрібне
      if (patch.assigneeId && patch.assigneeId === SYNC?.myMemberId) {
        try {
          const key = `agency6-seen-assign-${SYNC.myMemberId}`;
          const s = new Set(JSON.parse(localStorage.getItem(key) || "[]")); s.add(id);
          localStorage.setItem(key, JSON.stringify([...s]));
        } catch (e) { /* ігноруємо */ }
      }
      if (Object.keys(patch).length) patchTask(id, patch);
      dlg.close();
      toast(Object.keys(patch).length ? `${id} збережено` : "Змін немає");
      render();
    });
    const setStatus = (status, msg) => {
      patchTask(id, changes(status));
      dlg.close(); toast(msg); render();
    };
    $("#dCancelTask", form)?.addEventListener("click", () => {
      if (confirm(`Скасувати ${id}? Задача зникне з активних, але її можна відновити.`)) setStatus("cancelled", `${id} скасовано`);
    });
    $("#dRestore", form)?.addEventListener("click", () => setStatus("backlog", `${id} відновлено в Backlog`));
    const del = $("#dDelete", form);
    if (del) del.addEventListener("click", () => {
      if (!confirm(`Видалити ${id}?`)) return;
      deleteTask(id);
      dlg.close(); render(); toast(`${id} видалено`);
    });
    if (!dlg.open) dlg.showModal();
  }
  // Виконавець: у спільній дошці — лише учасники проєкту (зі списку редакторів), без email;
  // у локальному режимі — довільне ім'я.
  function assigneeField(t) {
    const people = SYNC?.people || [];
    if (sharedMode() && people.length) {
      const known = people.some((p) => p.member_id === t.assigneeId);
      return `<label class="field">Виконавець<select id="dAssignee">
        <option value="">— не призначено —</option>
        ${people.map((p) => `<option value="${esc(p.member_id)}" ${p.member_id === t.assigneeId ? "selected" : ""}>${esc(p.name)}${p.is_me ? " (ви)" : ""}${p.joined ? "" : " · ще не входив"}</option>`).join("")}
        ${t.assigneeId && !known ? `<option value="${esc(t.assigneeId)}" selected>${esc(t.assignee || "Колишній учасник")}</option>` : ""}
      </select></label>`;
    }
    if (SYNC?.configured && !sharedMode()) {
      return `<label class="field">Виконавець<input value="${esc(t.assignee || "—")}" disabled title="Призначати можуть редактори після входу"></label>`;
    }
    return `<label class="field">Виконавець<input id="dAssignee" value="${esc(t.assignee || "")}" placeholder="ім'я"></label>`;
  }
  function readAssignee() {
    const el = $("#dAssignee", form);
    if (!el) return {};
    if (el.tagName === "SELECT") {
      const p = (SYNC.people || []).find((x) => x.member_id === el.value);
      return el.value ? { assigneeId: el.value, assignee: p ? p.name : el.selectedOptions[0]?.textContent } : { assigneeId: "", assignee: "" };
    }
    return { assignee: el.value.trim() };
  }

  function blockers(id) {
    const list = allTasks().filter((t) => (t.deps || []).includes(id));
    if (!list.length) return "";
    return `<section><h4>Блокує</h4><div class="deps">${list.map((t) => `<span class="chip" data-open="${esc(t.id)}" title="${esc(t.title)}">${esc(t.id)}</span>`).join("")}</div></section>`;
  }

  function newTask() {
    const nums = allTasks().map((t) => +(/^AG-(\d+)$/.exec(t.id)?.[1] || 0));
    const nextId = "AG-" + String(Math.max(0, ...nums) + 1).padStart(3, "0");
    const opts = (arr, sel) => arr.map(([v, n]) => `<option value="${v}" ${v === sel ? "selected" : ""}>${esc(n)}</option>`).join("");
    form.innerHTML = `
      <div class="dlg-head"><div class="id">${nextId}</div><h3>Нова задача</h3></div>
      <div class="dlg-body">
        <label class="field">Назва<input id="nTitle" required placeholder="Що потрібно зробити"></label>
        <label class="field">Опис<textarea id="nDesc" placeholder="Контекст, що саме зробити, де в коді"></textarea></label>
        <label class="field">Критерії готовності (кожен з нового рядка)<textarea id="nCrit" style="min-height:70px"></textarea></label>
        <div class="field-grid">
          <label class="field">Фаза<select id="nPhase">${opts(P.phases.map((p) => [p.id, (p.id === "0" ? "" : p.id + " · ") + p.name]), "B")}</select></label>
          <label class="field">Епік<select id="nEpic">${opts(P.epics.map((e) => [e.id, e.id + " · " + e.name]), "DLG")}</select></label>
          <label class="field">Тип<select id="nType">${opts(Object.entries(P.types), "feature")}</select></label>
          <label class="field">Пріоритет<select id="nPriority">${opts([["P0", "P0"], ["P1", "P1"], ["P2", "P2"], ["P3", "P3"]], "P1")}</select></label>
          <label class="field">Оцінка<select id="nEstimate">${opts([["S", "S · 1–2 дні"], ["M", "M · 3–5 днів"], ["L", "L · 1–2 тижні"]], "M")}</select></label>
          <label class="field">Залежить від (ID через кому)<input id="nDeps" placeholder="AG-005, AG-013"></label>
        </div>
      </div>
      <div class="dlg-foot"><div class="right"><button class="btn" type="button" data-close>Скасувати</button><button class="btn primary" type="button" id="nCreate">Створити</button></div></div>`;
    $("#nCreate", form).addEventListener("click", () => {
      const title = $("#nTitle").value.trim();
      if (!title) { $("#nTitle").focus(); return; }
      createTask({
        id: nextId, title,
        desc: $("#nDesc").value.trim(),
        criteria: $("#nCrit").value.split("\n").map((s) => s.trim()).filter(Boolean),
        phase: $("#nPhase").value, epic: $("#nEpic").value, type: $("#nType").value,
        priority: $("#nPriority").value, estimate: $("#nEstimate").value,
        deps: $("#nDeps").value.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean),
        status: "backlog"
      });
      dlg.close(); render(); toast(`${nextId} створено`);
    });
    dlg.showModal();
    $("#nTitle").focus();
  }

  // ── Експорт / імпорт ─────────────────────────────────
  function exportJson() {
    const data = { project: P.name, exported: new Date().toISOString(), tasks: allTasks().map(({ _base, ...t }) => t), store };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `agency6-tasks-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function importJson(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data.store || typeof data.store !== "object") throw new Error("no store");
        store = { overrides: data.store.overrides || {}, custom: data.store.custom || [] };
        save(); render(); toast("Імпортовано");
      } catch (e) { toast("Файл не схожий на експорт менеджера задач"); }
    };
    reader.readAsText(file);
  }

  // ── Навігація ────────────────────────────────────────
  const VIEWS = { overview: renderOverview, board: renderBoard, list: renderList, roadmap: renderRoadmap, gaps: renderGaps, visual: () => {} };
  function currentView() {
    const v = location.hash.slice(1);
    return VIEWS[v] ? v : "overview";
  }
  // ── Анімації ─────────────────────────────────────────
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let lastView = null;
  let lastMovedId = null;

  // Послідовна поява елементів: кожному задається індекс для затримки в CSS
  const STAGGER = ".kpi, .card, .column, .tcard, .phase-group, tbody tr, .gantt-row, .phase-card, .gap, .mock, .bar-row, .next-list li";
  function stagger(root) {
    $$(STAGGER, root).forEach((el, i) => el.style.setProperty("--i", Math.min(i, 24)));
  }
  function countUp(root) {
    if (reduceMotion) return;
    $$("[data-count]", root).forEach((el) => {
      const target = +el.dataset.count, suffix = el.dataset.suffix || "", t0 = performance.now(), dur = 900;
      const step = (now) => {
        const k = Math.min(1, (now - t0) / dur), eased = 1 - Math.pow(1 - k, 3);
        el.textContent = Math.round(target * eased) + suffix;
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  function render() {
    const v = currentView();
    const viewEl = $("#view-" + v);
    const entering = v !== lastView;
    lastView = v;
    $$(".view").forEach((el) => el.classList.toggle("active", el === viewEl));
    $$(".tabs a").forEach((a) => a.classList.toggle("active", a.dataset.view === v));
    $("#filters").hidden = !(v === "board" || v === "list");
    VIEWS[v]();

    // Анімація входу лише при зміні розділу, а не на кожен ввід у фільтрі
    if (entering && !reduceMotion) {
      viewEl.classList.remove("enter");
      void viewEl.offsetWidth; // перезапуск CSS-анімації
      stagger(viewEl);
      viewEl.classList.add("enter");
      clearTimeout(render._t);
      render._t = setTimeout(() => viewEl.classList.remove("enter"), 1400);
      if (v === "overview") countUp(viewEl);
    }
    if (lastMovedId) {
      $(`.tcard[data-id="${CSS.escape(lastMovedId)}"]`)?.classList.add("flash");
      lastMovedId = null;
    }
  }

  function init() {
    $("#projectName").textContent = P.name;
    $("#projectSubtitle").textContent = P.subtitle;
    initFilters();
    window.addEventListener("hashchange", render);
    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-close]")) { dlg.close(); return; }
      const el = e.target.closest("[data-open]");
      if (el) openTask(el.dataset.open);
    });
    // Клік по затемненому фону закриває вікно
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
    // клік на картку дошки (без перетягування)
    document.addEventListener("click", (e) => {
      const card = e.target.closest(".tcard");
      if (card) openTask(card.dataset.id);
    });
    $("#btnNew").addEventListener("click", newTask);
    $("#btnExport").addEventListener("click", exportJson);
    $("#fileImport").addEventListener("change", (e) => { if (e.target.files[0]) importJson(e.target.files[0]); e.target.value = ""; });
    $("#btnReset").addEventListener("click", () => {
      if (!confirm("Скинути всі локальні зміни (статуси, нотатки, нові задачі)? Перед цим варто зробити експорт.")) return;
      store = { overrides: {}, custom: [] };
      save(); render(); toast("Локальні зміни скинуто");
    });
    render();
    initSync();

    // Посилання виду index.html?task=AG-006 (наприклад, зі сторінки GDD) відкривають картку задачі
    const linked = new URLSearchParams(location.search).get("task");
    if (linked && getTask(linked)) openTask(linked);
  }

  init();
})();
