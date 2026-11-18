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

  // Шари стану: базові задачі (data/tasks.js) → спільний стан з GitHub (sync.js) → локальні зміни браузера.
  // Якщо підключено GitHub-токен, нові зміни йдуть у спільний стан, інакше — лише локально.
  const SYNC = window.BoardSync;
  const shared = () => SYNC?.state || { overrides: {}, custom: [] };
  const clean = (o) => { if (!o) return {}; const { _at, _by, ...rest } = o; return rest; };
  const sharedMode = () => !!SYNC?.canWrite();

  function allTasks() {
    const sh = shared();
    const base = P.tasks.map((t) => ({ ...t, ...clean(sh.overrides[t.id]), ...(store.overrides[t.id] || {}), _base: true }));
    const custom = sh.custom.map((t) => ({ ...clean(t), ...(store.overrides[t.id] || {}), _base: false, _shared: true }))
      .concat(store.custom.map((t) => ({ ...t, _base: false })));
    return base.concat(custom);
  }
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
    return allTasks().filter((t) =>
      (!q || `${t.id} ${t.title} ${t.desc}`.toLowerCase().includes(q)) &&
      (!ph || t.phase === ph) && (!ep || t.epic === ep) && (!pr || t.priority === pr) && (!ty || t.type === ty) &&
      (!hideDone || !isClosed(t.status)));
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
    const who = e.login ? `<a href="https://github.com/${esc(e.login)}" target="_blank" rel="noopener"><b>${esc(e.by)}</b></a>` : `<b>${esc(e.by)}</b>`, task = `<span class="mono">${esc(e.id)}</span> ${esc(e.title || "")}`;
    if (e.action === "move") return `${who} перемістив(ла) ${task}: ${esc(statusName[e.from] || e.from || "—")} → <b>${esc(statusName[e.to] || e.to)}</b>`;
    if (e.action === "create") return `${who} створив(ла) ${task}`;
    if (e.action === "delete") return `${who} видалив(ла) ${task}`;
    return `${who} оновив(ла) ${task}`;
  }
  let freshKeys = new Set();
  function activityHtml() {
    if (!SYNC) return `<p class="empty">Синхронізація недоступна</p>`;
    const log = (shared().log || []).slice(0, 25);
    const help = SYNC.canWrite() ? "" : `<p class="help">Тут видно, хто і що перемістив. Щоб ваші зміни теж бачили інші, натисніть кнопку синхронізації вгорі.</p>`;
    if (!log.length) return help + `<p class="empty">Поки що ніхто нічого не переміщував</p>`;
    return help + `<ul class="activity">${log.map((e) => `<li data-open="${esc(e.id)}" class="${freshKeys.has(e.at + e.id) ? "new" : ""}"><time datetime="${esc(e.at)}">${timeAgo(e.at)}</time><span>${describe(e)}</span></li>`).join("")}</ul>
      <p class="help" style="margin-top:8px"><a href="${esc(SYNC.historyUrl)}" target="_blank" rel="noopener">Повна історія змін у git ↗</a></p>`;
  }

  const SYNC_LABEL = { idle: "Підключення…", readonly: "Лише перегляд", ok: "Синхронізовано", busy: "Зберігаю…", err: "Помилка синхронізації" };
  function renderSyncButton() {
    const b = $("#btnSync");
    if (!b || !SYNC) return;
    b.className = `sync ${SYNC.status}`;
    b.innerHTML = `<span class="led"></span>${SYNC_LABEL[SYNC.status] || ""}`;
    b.title = SYNC.error || (SYNC.canWrite() ? `Зміни зберігаються в ${SYNC.repoLabel}` : "Підключіть GitHub, щоб ваші зміни бачили інші");
  }

  // ── Вхід через GitHub (верифікація токеном) ──────────
  const GH_ICON = `<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>`;
  const avatarImg = (url, size = 22) => url ? `<img class="avatar" src="${esc(url)}&s=${size * 2}" width="${size}" height="${size}" alt="">` : "";

  function renderLoginButton() {
    const b = $("#btnLogin");
    if (!b || !SYNC) return;
    if (SYNC.canWrite()) {
      b.className = "btn login on";
      b.innerHTML = `${avatarImg(SYNC.avatar)}<span>${esc(SYNC.name)}</span>`;
      b.title = `Увійшли як @${SYNC.login}. Клік — профіль і вихід`;
    } else {
      b.className = "btn login";
      b.innerHTML = `${GH_ICON}<span>Увійти через GitHub</span>`;
      b.title = "Верифікуватися, щоб ваші зміни бачила вся команда";
    }
  }

  function openSyncDialog() {
    if (SYNC.canWrite()) return openProfileDialog();
    const localCount = Object.keys(store.overrides).length + store.custom.length;
    form.innerHTML = `
      <div class="dlg-head"><div class="id">${esc(SYNC.repoLabel)}</div><h3>Вхід через GitHub</h3></div>
      <div class="dlg-body">
        <p>Після входу ваші переміщення, нотатки й нові задачі бачить уся команда, а в історії стоїть ваше ім'я з GitHub. Ім'я не вводиться вручну — його підтверджує сам GitHub.</p>
        <div class="login-tabs" role="tablist">
          <button type="button" class="btn active" data-who="owner">Я власник репозиторію</button>
          <button type="button" class="btn" data-who="member">Я учасник команди</button>
        </div>
        <ol class="login-steps" data-for="owner">
          <li>Відкрийте <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">Fine-grained token ↗</a>.</li>
          <li><b>Repository access:</b> Only select repositories → ${esc(SYNC.repoLabel)}.</li>
          <li><b>Permissions → Contents:</b> Read and write. Більше нічого.</li>
          <li>Generate token → скопіюйте і вставте нижче.</li>
        </ol>
        <ol class="login-steps" data-for="member" hidden>
          <li>Попросіть власника додати вас: Settings → Collaborators → Add people, і прийміть запрошення.</li>
          <li>Відкрийте <a href="https://github.com/settings/tokens/new?scopes=public_repo&description=Agency%20Task%20Board" target="_blank" rel="noopener">Classic token ↗</a> — потрібна галочка <code>public_repo</code> вже стоятиме.</li>
          <li>Generate token → скопіюйте і вставте нижче.</li>
        </ol>
        <div class="verify-row">
          <input id="sToken" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_… або ghp_…" aria-label="GitHub-токен">
          <button class="btn primary" type="button" id="sVerify">${GH_ICON}<span>Верифікувати</span></button>
        </div>
        <div id="sWho" class="who-card" hidden></div>
        ${localCount ? `<label class="check"><input id="sMigrate" type="checkbox" checked> Перенести мої локальні зміни (${localCount}) у спільну дошку</label>` : ""}
        <p class="help" id="sError" style="color:var(--bad)"></p>
        <p class="help">Токен зберігається лише в цьому браузері й надсилається тільки на api.github.com. Його можна відкликати в налаштуваннях GitHub будь-коли.</p>
      </div>
      <div class="dlg-foot"><div class="right"><button class="btn" type="button" data-close>Закрити</button></div></div>`;

    $$(".login-tabs [data-who]", form).forEach((t) => t.addEventListener("click", () => {
      $$(".login-tabs [data-who]", form).forEach((x) => x.classList.toggle("active", x === t));
      $$(".login-steps", form).forEach((ol) => (ol.hidden = ol.dataset.for !== t.dataset.who));
    }));

    const verify = async () => {
      const btn = $("#sVerify", form), label = $("#sVerify span", form), err = $("#sError", form), who = $("#sWho", form);
      btn.disabled = true; label.textContent = "Перевіряю…"; err.textContent = ""; who.hidden = true;
      try {
        const me = await SYNC.connect($("#sToken").value);
        who.hidden = false;
        who.innerHTML = `${avatarImg(me.avatar, 44)}<div><b>${esc(me.name)}</b><span class="muted">@${esc(me.login)} · право запису підтверджено</span></div><span class="ok-mark">✓</span>`;
        if ($("#sMigrate", form)?.checked) {
          Object.entries(store.overrides).forEach(([id, patch]) => SYNC.patch(id, patch, getTask(id)));
          store.custom.forEach((t) => SYNC.create(t));
          store = { overrides: {}, custom: [] }; save();
        }
        renderLoginButton(); renderSyncButton(); render();
        toast(`Ви увійшли як ${me.name}`);
        setTimeout(() => dlg.open && dlg.close(), 1400);
      } catch (e) {
        err.textContent = e.message;
        btn.disabled = false; label.textContent = "Верифікувати";
      }
    };
    $("#sVerify", form).addEventListener("click", verify);
    $("#sToken", form).addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); verify(); } });
    if (!dlg.open) dlg.showModal();
    $("#sToken", form).focus();
  }

  function openProfileDialog() {
    const mine = (shared().log || []).filter((e) => e.login === SYNC.login).length;
    form.innerHTML = `
      <div class="dlg-head"><div class="id">${esc(SYNC.repoLabel)}</div><h3>Ваш профіль</h3></div>
      <div class="dlg-body">
        <div class="who-card">${avatarImg(SYNC.avatar, 44)}<div><b>${esc(SYNC.name)}</b><span class="muted">@${esc(SYNC.login)} · ${mine} змін на дошці</span></div><span class="ok-mark">✓</span></div>
        <p>Синхронізація: <b>${esc(SYNC_LABEL[SYNC.status])}</b>${SYNC.error ? ` — ${esc(SYNC.error)}` : ""}.</p>
      </div>
      <div class="dlg-foot">
        <button class="btn ghost danger" type="button" id="sOff">Вийти</button>
        <div class="right"><a class="btn" href="https://github.com/${esc(SYNC.login)}" target="_blank" rel="noopener">GitHub ↗</a><a class="btn" href="${esc(SYNC.historyUrl)}" target="_blank" rel="noopener">Історія ↗</a><button class="btn" type="button" data-close>Закрити</button></div>
      </div>`;
    $("#sOff", form).addEventListener("click", () => {
      SYNC.disconnect(); dlg.close(); renderLoginButton(); render();
      toast("Ви вийшли: зміни знову лише локальні");
    });
    if (!dlg.open) dlg.showModal();
  }

  function initSync() {
    if (!SYNC) return;
    SYNC.onStatus = renderSyncButton;
    SYNC.onChange = () => { if (!dlg.open || !form.querySelector("#dSave")) render(); else renderSyncButton(); };
    SYNC.onRemoteEvents = (events) => {
      events.forEach((e) => freshKeys.add(e.at + e.id));
      const e = events[0];
      toast(`${e.by}: ${e.id} → ${statusName[e.to] || (e.action === "create" ? "нова задача" : "оновлено")}${events.length > 1 ? ` (+${events.length - 1})` : ""}`);
      lastMovedId = e.id;
      render();
    };
    $("#btnSync").addEventListener("click", openSyncDialog);
    $("#btnLogin")?.addEventListener("click", openSyncDialog);
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
          <label class="field">Виконавець<input id="dAssignee" value="${esc(t.assignee || "")}" placeholder="ім'я"></label>
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
    $("#dSave", form).addEventListener("click", () => {
      patchTask(id, { status: $("#dStatus").value, notes: $("#dNotes").value, assignee: $("#dAssignee").value.trim() });
      dlg.close();
      toast(`${id} збережено`);
      render();
    });
    const setStatus = (status, msg) => {
      patchTask(id, { status, notes: $("#dNotes").value, assignee: $("#dAssignee").value.trim() });
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
