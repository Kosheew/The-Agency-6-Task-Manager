// Спільний стан дошки через GitHub.
//
// Стан (статуси, нотатки, виконавці, нові задачі, журнал дій) лежить у state/board.json
// у цьому ж репозиторії. Читати може будь-хто (репозиторій публічний). Писати — той, хто
// підключив свій GitHub-токен (fine-grained, доступ лише до цього репозиторію,
// Contents: Read and write). Кожна зміна — окремий коміт, тож історія переміщень лишається в git.
//
// Токен зберігається лише в localStorage цього браузера і надсилається тільки на api.github.com.
(() => {
  "use strict";

  const P = window.PROJECT;
  const m = /github\.com\/([^/]+)\/([^/#?]+)/.exec(P.links?.repo || "");
  if (!m) return;
  const OWNER = m[1], REPO = m[2].replace(/\.git$/, "");
  const PATH = "state/board.json", BRANCH = "main";
  const API = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`;
  const K_TOKEN = "agency6-gh-token", K_NAME = "agency6-gh-name", K_PENDING = "agency6-sync-pending";
  const K_LOGIN = "agency6-gh-login", K_AVATAR = "agency6-gh-avatar";
  const LOG_LIMIT = 300;

  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* ігноруємо */ } }
  };

  const empty = () => ({ version: 1, overrides: {}, custom: [], log: [] });
  const S = {
    state: empty(),
    sha: null,
    etag: null,
    status: "idle",       // idle | readonly | ok | busy | err
    error: "",
    pending: [],          // операції, ще не записані в репозиторій
    onChange: () => {},
    onStatus: () => {},
    onRemoteEvents: () => {},
    get token() { return ls.get(K_TOKEN); },
    get name() { return ls.get(K_NAME) || "Анонім"; },
    get login() { return ls.get(K_LOGIN) || ""; },
    get avatar() { return ls.get(K_AVATAR) || ""; },
    canWrite() { return !!this.token; }
  };
  try { S.pending = JSON.parse(ls.get(K_PENDING) || "[]"); } catch (e) { S.pending = []; }

  // ── base64 <-> UTF-8 ──────────────────────────────────
  const b64decode = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\n/g, "")), (c) => c.charCodeAt(0)));
  const b64encode = (str) => {
    const bytes = new TextEncoder().encode(str);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  };

  function setStatus(status, error = "") {
    S.status = status; S.error = error;
    S.onStatus(status, error);
  }

  // ── Операції над станом ───────────────────────────────
  function apply(state, op) {
    const stamp = { _at: op.at, _by: op.by };
    const logIt = (e) => state.log.unshift({ ...e, login: op.login });   // логін GitHub автора
    if (op.type === "patch") {
      const isCustom = state.custom.find((t) => t.id === op.id);
      const prev = isCustom || state.overrides[op.id] || {};
      if (op.patch.status && op.patch.status !== (prev.status || op.fromStatus)) {
        logIt({ at: op.at, by: op.by, id: op.id, title: op.title, action: "move", from: prev.status || op.fromStatus, to: op.patch.status });
      } else if (op.patch.notes !== undefined || op.patch.assignee !== undefined || op.patch.crit) {
        logIt({ at: op.at, by: op.by, id: op.id, title: op.title, action: "edit" });
      }
      if (isCustom) Object.assign(isCustom, op.patch, stamp);
      else state.overrides[op.id] = { ...prev, ...op.patch, ...stamp };
    } else if (op.type === "create") {
      if (!state.custom.find((t) => t.id === op.task.id)) {
        state.custom.push({ ...op.task, ...stamp });
        logIt({ at: op.at, by: op.by, id: op.task.id, title: op.task.title, action: "create" });
      }
    } else if (op.type === "delete") {
      state.custom = state.custom.filter((t) => t.id !== op.id);
      logIt({ at: op.at, by: op.by, id: op.id, title: op.title, action: "delete" });
    }
    state.log = state.log.slice(0, LOG_LIMIT);
    return state;
  }

  function enqueue(op) {
    op.at = new Date().toISOString();
    op.by = S.name;
    op.login = S.login;
    S.pending.push(op);
    ls.set(K_PENDING, JSON.stringify(S.pending));
    apply(S.state, structuredClone(op));   // оптимістично показуємо одразу
    S.onChange();
    schedulePush();
  }

  S.patch = (id, patch, task) => enqueue({ type: "patch", id, patch, title: task?.title, fromStatus: task?.status });
  S.create = (task) => enqueue({ type: "create", task });
  S.remove = (id, task) => enqueue({ type: "delete", id, title: task?.title });

  // ── Читання ───────────────────────────────────────────
  async function fetchRemote({ conditional = false } = {}) {
    const headers = { Accept: "application/vnd.github+json" };
    if (S.token) headers.Authorization = `Bearer ${S.token}`;
    if (conditional && S.etag) headers["If-None-Match"] = S.etag;   // 304 не витрачає ліміт запитів
    const res = await fetch(`${API}?ref=${BRANCH}&t=${conditional ? "" : Date.now()}`, { headers, cache: "no-store" });
    if (res.status === 304) return null;
    if (res.status === 404) return { state: empty(), sha: null, etag: null };
    if (!res.ok) throw new Error(`GitHub ${res.status}: ${(await res.json().catch(() => ({}))).message || res.statusText}`);
    const body = await res.json();
    let state = empty();
    try { state = { ...empty(), ...JSON.parse(b64decode(body.content)) }; } catch (e) { /* пошкоджений файл — починаємо з порожнього */ }
    return { state, sha: body.sha, etag: res.headers.get("ETag") };
  }

  // Повідомлення про зміни інших людей
  function announceNew(prevLog, nextLog) {
    const seen = new Set(prevLog.map((e) => e.at + e.id + e.action));
    const fresh = nextLog.filter((e) => !seen.has(e.at + e.id + e.action) && e.by !== S.name);
    if (fresh.length) S.onRemoteEvents(fresh);
  }

  S.pull = async function pull({ quiet = false } = {}) {
    if (pushing) return;
    try {
      const r = await fetchRemote({ conditional: quiet });
      if (!r) { setStatus(S.canWrite() ? "ok" : "readonly"); return; }
      const prevLog = S.state.log || [];
      const next = r.state;
      S.pending.forEach((op) => apply(next, structuredClone(op)));    // зберігаємо ще не записане
      S.state = next; S.sha = r.sha; S.etag = r.etag;
      if (quiet) announceNew(prevLog, next.log || []);
      S.onChange();
      setStatus(S.pending.length ? "busy" : S.canWrite() ? "ok" : "readonly");
      if (S.pending.length && S.canWrite()) schedulePush();
    } catch (e) {
      setStatus("err", e.message);
    }
  };

  // ── Запис ─────────────────────────────────────────────
  let pushTimer = null, pushing = false;
  function schedulePush() {
    if (!S.canWrite()) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(push, 800);
  }

  function commitMessage(ops) {
    const names = Object.fromEntries(P.statuses.map((s) => [s.id, s.name]));
    const first = ops[0];
    const what = first.type === "patch" && first.patch.status
      ? `${first.id} → ${names[first.patch.status] || first.patch.status}`
      : first.type === "create" ? `нова задача ${first.task.id}` : first.type === "delete" ? `видалено ${first.id}` : `оновлено ${first.id}`;
    return `board: ${what}${ops.length > 1 ? ` (+${ops.length - 1})` : ""} — ${S.name}`;
  }

  async function push(attempt = 0) {
    if (!S.canWrite() || !S.pending.length || pushing) return;
    pushing = true;
    setStatus("busy");
    const ops = S.pending.slice();
    try {
      const r = await fetchRemote();          // свіжий стан + sha
      const next = r.state;
      ops.forEach((op) => apply(next, structuredClone(op)));
      const res = await fetch(API, {
        method: "PUT",
        headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${S.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message: commitMessage(ops), content: b64encode(JSON.stringify(next, null, 1)), branch: BRANCH, ...(r.sha ? { sha: r.sha } : {}) })
      });
      if (res.status === 409 || res.status === 422) {          // хтось записав раніше — пробуємо ще раз
        pushing = false;
        if (attempt < 3) return push(attempt + 1);
        throw new Error("Конфлікт запису, спробуйте ще раз");
      }
      if (!res.ok) throw new Error(`GitHub ${res.status}: ${(await res.json().catch(() => ({}))).message || res.statusText}`);
      const body = await res.json();
      S.pending = S.pending.slice(ops.length);
      ls.set(K_PENDING, JSON.stringify(S.pending));
      const prevLog = S.state.log || [];
      S.state = next; S.sha = body.content?.sha || null; S.etag = null;
      S.pending.forEach((op) => apply(S.state, structuredClone(op)));
      announceNew(prevLog, next.log || []);
      S.onChange();
      setStatus(S.pending.length ? "busy" : "ok");
    } catch (e) {
      setStatus("err", e.message);
    } finally {
      pushing = false;
      if (S.pending.length && S.status !== "err") schedulePush();
    }
  }

  // ── Підключення ───────────────────────────────────────
  // Верифікація: GitHub сам каже, кому належить токен, і чи має він право запису.
  // Ім'я в історії береться з профілю GitHub — підписатися чужим ім'ям не вийде.
  S.verify = async (token) => {
    token = (token || "").trim();
    if (!token) throw new Error("Вставте токен");
    const headers = { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}` };
    const [userRes, repoRes] = await Promise.all([
      fetch("https://api.github.com/user", { headers }),
      fetch(`https://api.github.com/repos/${OWNER}/${REPO}`, { headers })
    ]);
    const user = await userRes.json().catch(() => ({}));
    const repo = await repoRes.json().catch(() => ({}));
    if (!userRes.ok) throw new Error(userRes.status === 401 ? "Недійсний або прострочений токен" : `GitHub ${userRes.status}: ${user.message || ""}`);
    if (!repoRes.ok || !repo.permissions?.push) {
      throw new Error(`@${user.login} не має права запису в ${OWNER}/${REPO}. Попросіть власника додати вас як collaborator, а токену дайте доступ Contents: Read and write (класичний — public_repo).`);
    }
    return { login: user.login, name: user.name || user.login, avatar: user.avatar_url };
  };
  S.connect = async (token) => {
    const who = await S.verify(token);
    ls.set(K_TOKEN, token.trim());
    ls.set(K_LOGIN, who.login);
    ls.set(K_NAME, who.name);
    ls.set(K_AVATAR, who.avatar);
    await S.pull();
    schedulePush();
    return who;
  };
  S.disconnect = () => {
    [K_TOKEN, K_LOGIN, K_NAME, K_AVATAR].forEach((k) => ls.set(k, null));
    setStatus("readonly"); S.onChange();
  };
  S.repoLabel = `${OWNER}/${REPO}`;
  S.historyUrl = `https://github.com/${OWNER}/${REPO}/commits/${BRANCH}/${PATH}`;

  // Опитування: частіше з токеном (ліміт 5000/год), рідше без (60/год; 304 не рахується)
  S.start = () => {
    S.pull();
    setInterval(() => { if (document.visibilityState === "visible") S.pull({ quiet: true }); }, S.canWrite() ? 30000 : 90000);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") S.pull({ quiet: true }); });
  };

  window.BoardSync = S;
})();
