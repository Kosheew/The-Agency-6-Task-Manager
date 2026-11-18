// Спільна дошка через Supabase.
//
// Читати стан може будь-хто. Писати — лише ті, хто увійшов (email + пароль) і є в таблиці
// board_members (перевіряє сама база через Row Level Security). Автора й журнал змін ставить
// тригер у базі. Зміни інших приходять миттєво через Supabase Realtime.
// Доступ: людина залишає запит → власник підтверджує на сайті → сайт генерує пароль → власник передає його людині.
// Налаштування — у data/config.js, схема — supabase/schema.sql.
//
// Інтерфейс (його використовують app.js і board-live.js):
//   state {overrides, custom, log}, status, error, configured, signedIn(), isMember, isOwner, canWrite(),
//   name, login (email), userId, people, myMemberId, requests,
//   patch(), create(), remove(), signInPassword(), signInLink(), requestAccess(), setPassword(), setName(),
//   disconnect(), start(), owner.{members, grant, reject, remove, refresh},
//   onChange / onStatus / onRemoteEvents + події window "board:change", "board:status", "board:requests".
(() => {
  "use strict";

  const CFG = window.AGENCY_CONFIG || {};
  const SUPABASE_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js";
  const SUPABASE_SRI = "sha384-GFr3yTh5lJznCbZfpTtXnwboFsxqtTQoeTZCRHhE0579KrRmlCzen5AA8ohaB5ug";
  const LOG_LIMIT = 300;
  const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  const S = {
    state: { overrides: {}, custom: [], log: [] },
    status: "idle",        // idle | offline | readonly | ok | busy | err
    error: "",
    configured: !!(CFG.supabaseUrl && CFG.supabaseAnonKey),
    isMember: false,
    isOwner: false,
    user: null,
    client: null,
    people: [],            // учасники проєкту: {member_id, name, is_me, joined} — лише для редакторів
    myMemberId: "",
    requests: [],          // запити на доступ — бачить лише власник
    lastSync: 0,
    onChange: () => {},
    onStatus: () => {},
    onRemoteEvents: () => {},
    get name() { return this.user?.name || "Анонім"; },
    get login() { return this.user?.email || ""; },      // email — бачить лише сам користувач
    get userId() { return this.user?.id || ""; },
    get avatar() { return ""; },
    signedIn() { return !!this.user; },
    canWrite() { return !!this.user && this.isMember; },
    repoLabel: "Supabase",
    historyUrl: null
  };

  // Останній відомий спільний стан зберігається в браузері: сторінка показує його одразу,
  // ще до з'єднання з базою, а свіжі дані підтягуються за долі секунди.
  const CACHE_KEY = "agency6-shared-cache";
  let cacheTimer = null;
  function saveCache() {
    clearTimeout(cacheTimer);
    cacheTimer = setTimeout(() => {
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), state: { ...S.state, log: S.state.log.slice(0, 50) } })); } catch (e) { /* немає місця або приватний режим */ }
    }, 300);
  }
  function loadCache() {
    try {
      const c = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (c?.state) S.state = { overrides: c.state.overrides || {}, custom: c.state.custom || [], log: c.state.log || [] };
    } catch (e) { /* пошкоджений кеш — ігноруємо */ }
  }

  const changed = () => {
    S.onChange();
    window.dispatchEvent(new CustomEvent("board:change"));
    saveCache();
  };
  function setStatus(status, error = "") {
    if (S.status === status && S.error === error) return;
    S.status = status; S.error = error;
    S.onStatus(status, error);
    window.dispatchEvent(new CustomEvent("board:status"));
  }
  const idleStatus = () => (S.canWrite() ? "ok" : "readonly");
  const isNetwork = (msg) => /failed to fetch|networkerror|load failed|network|timeout|fetch/i.test(msg || "");
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ── Рядки бази → стан дошки ───────────────────────────
  function applyRow(row) {
    if (!row || !row.id) return;
    if (row.is_custom) {
      S.state.custom = S.state.custom.filter((t) => t.id !== row.id);
      if (!row.deleted) S.state.custom.push({ ...row.data, id: row.id, _at: row.updated_at, _by: row.updated_by_name });
    } else {
      S.state.overrides[row.id] = { ...row.data, _at: row.updated_at, _by: row.updated_by_name };
    }
  }
  const logEntry = (r) => ({ at: r.at, by: r.by_name || "Хтось", userId: r.by_user, id: r.task_id, title: r.title, action: r.action, from: r.from_status, to: r.to_status });

  // ── Оптимістичне оновлення + надійний запис ───────────
  // Зміни застосовуються на екрані одразу, а в базу йдуть по черзі (порядок збережено).
  // Мережеві збої повторюються; поки запис не підтверджено, перезавантаження його не затирає.
  const pending = [];          // {id, patch, extra}
  let queue = Promise.resolve();

  function applyLocal(id, patch, extra) {
    if (extra.deleted) { S.state.custom = S.state.custom.filter((t) => t.id !== id); return; }
    if (extra.isCustom) {
      const t = S.state.custom.find((x) => x.id === id);
      if (t) Object.assign(t, patch); else S.state.custom.push({ ...patch, id });
    } else {
      S.state.overrides[id] = { ...(S.state.overrides[id] || {}), ...patch };
    }
  }

  function write(id, patch, extra) {
    if (!S.canWrite()) return;
    const job = { id, patch, extra };
    pending.push(job);
    setStatus("busy");
    queue = queue.then(() => send(job)).catch(() => {});
  }

  async function send(job) {
    const args = {
      p_id: job.id, p_patch: job.patch, p_title: job.extra.title ?? null, p_base_status: job.extra.baseStatus ?? null,
      p_is_custom: !!job.extra.isCustom, p_deleted: !!job.extra.deleted
    };
    let error = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      ({ error } = await S.client.rpc("board_patch", args));
      if (!error || !isNetwork(error.message)) break;
      setStatus("busy", "Немає зв'язку — повторюю…");
      await sleep([1000, 2000, 4000, 8000, 15000][attempt]);
    }
    pending.splice(pending.indexOf(job), 1);
    if (error) {
      setStatus("err", /row-level security|permission/i.test(error.message)
        ? "Немає права запису: вашого email немає в списку редакторів"
        : isNetwork(error.message) ? "Не вдалося зберегти — немає зв'язку. Оновіть сторінку, коли з'явиться інтернет." : error.message);
      reload().catch(() => {});   // повертаємо справжній стан
      return;
    }
    S.lastSync = Date.now();
    if (!pending.length) setStatus(idleStatus());
  }

  S.patch = (id, patch, task) => {
    const isCustom = S.state.custom.some((t) => t.id === id);
    const extra = { title: task?.title, baseStatus: task?._base ? baseStatus(id) : null, isCustom };
    applyLocal(id, patch, extra);
    changed();
    write(id, patch, extra);
  };
  S.create = (task) => {
    const extra = { title: task.title, isCustom: true };
    applyLocal(task.id, task, extra);
    changed();
    write(task.id, task, extra);
  };
  S.remove = (id, task) => {
    const extra = { title: task?.title, isCustom: true, deleted: true };
    applyLocal(id, {}, extra);
    changed();
    write(id, {}, extra);
  };
  const baseStatus = (id) => (window.PROJECT?.tasks || []).find((t) => t.id === id)?.status || null;

  // ── Завантаження і Realtime ───────────────────────────
  let reloading = null;
  function reload() {
    if (reloading) return reloading;      // кілька запитів одночасно → один похід у базу
    reloading = (async () => {
      const [tasks, log] = await Promise.all([
        S.client.from("board_tasks").select("*"),
        S.client.from("board_log").select("*").order("at", { ascending: false }).limit(LOG_LIMIT)
      ]);
      if (tasks.error || log.error) throw new Error((tasks.error || log.error).message);
      S.state = { overrides: {}, custom: [], log: log.data.map(logEntry) };
      tasks.data.forEach(applyRow);
      pending.forEach((j) => applyLocal(j.id, j.patch, j.extra));   // ще не збережене — не губимо
      S.lastSync = Date.now();
      changed();
    })().finally(() => { reloading = null; });
    return reloading;
  }

  let channel = null, retry = 0, retryTimer = null, wasDown = false;
  function subscribe() {
    clearTimeout(retryTimer);
    const old = channel;
    const ch = channel = S.client.channel("board-" + Date.now());
    if (old) S.client.removeChannel(old);
    ch
      .on("postgres_changes", { event: "*", schema: "public", table: "board_tasks" }, (p) => {
        applyRow(p.new);
        pending.filter((j) => j.id === p.new?.id).forEach((j) => applyLocal(j.id, j.patch, j.extra));
        S.lastSync = Date.now();
        changed();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "board_log" }, (p) => {
        const e = logEntry(p.new);
        if (S.state.log.some((x) => x.at === e.at && x.id === e.id && x.action === e.action)) return;   // без дублів
        S.state.log = [e, ...S.state.log].slice(0, LOG_LIMIT);
        if (e.userId && e.userId !== S.userId) S.onRemoteEvents([e]);
        changed();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "access_requests" }, () => { if (S.isOwner) loadRequests(); })
      .subscribe((st) => {
        if (ch !== channel) return;          // старий канал, який ми самі закрили
        if (st === "SUBSCRIBED") {
          retry = 0;
          if (!pending.length) setStatus(idleStatus());
          if (wasDown) { wasDown = false; reload().catch(() => {}); }   // підтягуємо пропущене
        }
        if (st === "CHANNEL_ERROR" || st === "TIMED_OUT" || st === "CLOSED") {
          wasDown = true;
          setStatus("err", "З'єднання перервалося — перепідключаюсь…");
          const delay = [1000, 2000, 5000, 10000, 30000][Math.min(retry++, 4)];
          clearTimeout(retryTimer);
          retryTimer = setTimeout(subscribe, delay);
        }
      });
  }

  // Повернення на вкладку, вихід зі сну, поява інтернету — звіряємося з базою
  function resync(force) {
    if (!S.client) return;
    if (force || S.status === "err" || Date.now() - S.lastSync > 30000) {
      reload().then(() => { if (!pending.length && S.status !== "err") setStatus(idleStatus()); }).catch(() => {});
      if (S.status === "err") subscribe();
    }
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") resync(false); });
  window.addEventListener("online", () => resync(true));
  // Підстраховка: раз на 2 хвилини звіряємо стан, навіть якщо Realtime мовчить
  setInterval(() => { if (document.visibilityState === "visible") resync(Date.now() - S.lastSync > 120000); }, 60000);

  // ── Користувач ────────────────────────────────────────
  async function loadUser(session) {
    const u = session?.user;
    if (!u) { S.user = null; S.isMember = false; S.isOwner = false; S.people = []; S.myMemberId = ""; S.requests = []; return; }
    const email = (u.email || "").toLowerCase();
    S.user = { id: u.id, email, name: (u.user_metadata?.name || "").trim() || email.split("@")[0] };
    const [m, o] = await Promise.all([S.client.rpc("is_member"), S.client.rpc("is_owner")]);
    S.isMember = !m.error && m.data === true;
    S.isOwner = !o.error && o.data === true;
    await Promise.all([loadPeople(), loadRequests()]);
  }

  // Учасники проєкту для вибору виконавця і «мій» id для сповіщень
  async function loadPeople() {
    if (!S.isMember) { S.people = []; S.myMemberId = ""; return; }
    const { data, error } = await S.client.rpc("board_people");
    S.people = error ? [] : data || [];
    S.myMemberId = S.people.find((p) => p.is_me)?.member_id || "";
  }

  async function loadRequests() {
    if (!S.isOwner) { S.requests = []; return; }
    const { data, error } = await S.client.from("access_requests").select("*").eq("status", "pending").order("created_at", { ascending: false });
    if (!error) S.requests = data || [];
    window.dispatchEvent(new CustomEvent("board:requests"));
  }

  const authError = (error) => {
    const m = error?.message || "";
    if (/invalid login credentials/i.test(m)) return "Невірний email або пароль";
    if (/email not confirmed/i.test(m)) return "Акаунт ще не підтверджено — попросіть власника видати доступ ще раз";
    if (/rate limit|too many/i.test(m)) return "Забагато спроб — зачекайте кілька хвилин";
    if (/signups not allowed|user not found/i.test(m)) return "Такого акаунта немає — залиште запит на доступ";
    if (isNetwork(m)) return "Немає зв'язку з сервером — перевірте інтернет";
    return m;
  };

  // Вхід email + пароль. Повертає текст помилки або "".
  S.signInPassword = async (email, password) => {
    email = (email || "").trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return "Перевірте email";
    if (!password) return "Введіть пароль";
    const { data, error } = await S.client.auth.signInWithPassword({ email, password });
    if (error) return authError(error);
    await afterAuth(data.session);
    return "";
  };

  // Запасний вхід: посилання на email (лише для існуючих акаунтів, Supabase надсилає кілька листів на годину)
  S.signInLink = async (email) => {
    email = (email || "").trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return "Перевірте email";
    const { error } = await S.client.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: location.origin + location.pathname + location.search }
    });
    return error ? authError(error) : "";
  };

  // Запит на доступ — потрапляє власнику дошки
  S.requestAccess = async (email, name, note) => {
    email = (email || "").trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return "Перевірте email";
    if (!(name || "").trim()) return "Введіть ім'я";
    const { data, error } = await S.client.rpc("request_access", { p_email: email, p_name: name, p_note: note || null });
    if (error) return authError(error);
    return { ok: "", member: "Цей email уже має доступ — увійдіть з паролем", full: "Забагато запитів у черзі — напишіть власнику напряму", bad_email: "Перевірте email" }[data] ?? "";
  };

  S.setPassword = async (password) => {
    if ((password || "").length < 8) return "Пароль має бути щонайменше 8 символів";
    const { error } = await S.client.auth.updateUser({ password });
    return error ? authError(error) : "";
  };

  // Ім'я, яке бачать інші в журналі (зберігається в профілі Supabase)
  S.setName = async (name) => {
    name = (name || "").trim().slice(0, 40);
    if (!name) return "Введіть ім'я";
    const { error } = await S.client.auth.updateUser({ data: { name } });
    if (error) return authError(error);
    await S.client.auth.refreshSession();          // нове ім'я одразу потрапляє в токен для бази
    S.user.name = name;
    await loadPeople();                              // нове ім'я в списку виконавців
    changed();
    return "";
  };

  S.disconnect = async () => {
    await S.client?.auth.signOut();
    await loadUser(null);
    setStatus("readonly"); changed();
  };

  // ── Панель власника ───────────────────────────────────
  // Пароль генерується тут, у браузері власника; у базу йде лише для хешування.
  function generatePassword() {
    const abc = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = crypto.getRandomValues(new Uint8Array(14));
    const raw = [...bytes].map((b) => abc[b % abc.length]).join("");
    return raw.slice(0, 4) + "-" + raw.slice(4, 9) + "-" + raw.slice(9);
  }
  S.owner = {
    async members() {
      const { data, error } = await S.client.rpc("owner_members");
      if (error) throw new Error(authError(error));
      return data || [];
    },
    // Створює акаунт (або новий пароль для існуючого) і додає в редактори. Повертає пароль.
    async grant(email, name) {
      const password = generatePassword();
      const { error } = await S.client.rpc("owner_grant", { p_email: email, p_name: name || null, p_password: password });
      if (error) throw new Error(authError(error));
      await Promise.all([loadRequests(), loadPeople()]);
      changed();
      return password;
    },
    async reject(id) {
      const { error } = await S.client.rpc("owner_reject", { p_id: id });
      if (error) throw new Error(authError(error));
      await loadRequests();
    },
    async remove(email) {
      const { error } = await S.client.rpc("owner_remove", { p_email: email });
      if (error) throw new Error(authError(error));
      await loadPeople(); changed();
    },
    refresh: () => loadRequests()
  };

  // ── Старт ─────────────────────────────────────────────
  function loadLibrary() {
    return new Promise((resolve, reject) => {
      if (window.supabase?.createClient) return resolve();
      const s = document.createElement("script");
      s.src = SUPABASE_JS; s.integrity = SUPABASE_SRI; s.crossOrigin = "anonymous";
      s.onload = resolve; s.onerror = () => reject(new Error("Не вдалося завантажити бібліотеку Supabase"));
      document.head.appendChild(s);
    });
  }

  let authUserId = null;
  async function afterAuth(session) {
    authUserId = session?.user?.id || null;
    await loadUser(session);
    if (!pending.length) setStatus(idleStatus());
    changed();
  }

  S.start = async () => {
    if (!S.configured) { setStatus("offline"); return; }
    loadCache();          // миттєво показати останній відомий стан
    changed();
    try {
      await loadLibrary();
      S.client = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
        // Сесія зберігається в браузері й оновлюється сама — вхід пам'ятається, доки людина не вийде
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" }
      });
      const { data } = await S.client.auth.getSession();
      subscribe();
      // Користувач і дані дошки завантажуються паралельно
      await Promise.all([afterAuth(data.session), reload()]);
      // Важливо: всередині onAuthStateChange не можна чекати інших викликів Supabase — це блокує клієнт.
      // Тому реакцію відкладаємо на наступний тік.
      S.client.auth.onAuthStateChange((event, session) => {
        if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") return;
        setTimeout(() => {
          if (event === "USER_UPDATED" || (session?.user?.id || null) !== authUserId) afterAuth(session);
        }, 0);
      });
    } catch (e) {
      setStatus("err", isNetwork(e.message)
        ? "Немає зв'язку з Supabase — перевірте інтернет"
        : /relation .* does not exist|could not find/i.test(e.message)
          ? "У базі немає таблиць дошки — виконайте supabase/schema.sql"
          : e.message);
      // пробуємо ще раз пізніше
      setTimeout(() => { if (S.client) { subscribe(); resync(true); } else S.start(); }, 10000);
    }
  };

  window.BoardSync = S;
})();
