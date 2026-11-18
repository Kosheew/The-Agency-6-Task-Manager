// Спільна дошка через Supabase.
//
// Читати стан може будь-хто. Писати — лише ті, хто увійшов за посиланням з email і є в таблиці
// board_members (перевіряє сама база через Row Level Security). Автора й журнал змін ставить
// тригер у базі. Зміни інших приходять миттєво через Supabase Realtime.
// Налаштування — у data/config.js, схема — supabase/schema.sql.
//
// Інтерфейс (його використовують app.js і board-live.js):
//   state {overrides, custom, log}, status, error, configured, signedIn(), isMember, canWrite(),
//   name, login (email), userId, patch(), create(), remove(), signIn(email), setName(), disconnect(), start(),
//   onChange / onStatus / onRemoteEvents + подія window "board:change".
(() => {
  "use strict";

  const CFG = window.AGENCY_CONFIG || {};
  const SUPABASE_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js";
  const SUPABASE_SRI = "sha384-GFr3yTh5lJznCbZfpTtXnwboFsxqtTQoeTZCRHhE0579KrRmlCzen5AA8ohaB5ug";
  const LOG_LIMIT = 300;

  const S = {
    state: { overrides: {}, custom: [], log: [] },
    status: "idle",        // idle | offline | readonly | ok | busy | err
    error: "",
    configured: !!(CFG.supabaseUrl && CFG.supabaseAnonKey),
    isMember: false,
    user: null,
    client: null,
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

  const changed = () => {
    S.onChange();
    window.dispatchEvent(new CustomEvent("board:change"));
  };
  function setStatus(status, error = "") {
    S.status = status; S.error = error;
    S.onStatus(status, error);
    window.dispatchEvent(new CustomEvent("board:status"));
  }

  // ── Рядки бази → стан дошки ───────────────────────────
  function applyRow(row) {
    if (!row) return;
    if (row.is_custom) {
      S.state.custom = S.state.custom.filter((t) => t.id !== row.id);
      if (!row.deleted) S.state.custom.push({ ...row.data, id: row.id, _at: row.updated_at, _by: row.updated_by_name });
    } else {
      S.state.overrides[row.id] = { ...row.data, _at: row.updated_at, _by: row.updated_by_name };
    }
  }
  const logEntry = (r) => ({ at: r.at, by: r.by_name || "Хтось", userId: r.by_user, id: r.task_id, title: r.title, action: r.action, from: r.from_status, to: r.to_status });

  // ── Оптимістичне оновлення + запис ────────────────────
  async function write(id, patch, extra = {}) {
    if (!S.canWrite()) return;
    setStatus("busy");
    const { error } = await S.client.rpc("board_patch", {
      p_id: id, p_patch: patch, p_title: extra.title ?? null, p_base_status: extra.baseStatus ?? null,
      p_is_custom: !!extra.isCustom, p_deleted: !!extra.deleted
    });
    if (error) {
      setStatus("err", /row-level security|permission/i.test(error.message)
        ? "Немає права запису: вашого email немає в списку редакторів"
        : error.message);
      await reload();   // повертаємо справжній стан
      return;
    }
    setStatus("ok");
  }

  S.patch = (id, patch, task) => {
    const isCustom = S.state.custom.some((t) => t.id === id);
    if (isCustom) Object.assign(S.state.custom.find((t) => t.id === id), patch);
    else S.state.overrides[id] = { ...(S.state.overrides[id] || {}), ...patch };
    changed();
    write(id, patch, { title: task?.title, baseStatus: task?._base ? baseStatus(id) : null, isCustom });
  };
  S.create = (task) => {
    S.state.custom.push({ ...task });
    changed();
    write(task.id, task, { title: task.title, isCustom: true });
  };
  S.remove = (id, task) => {
    S.state.custom = S.state.custom.filter((t) => t.id !== id);
    changed();
    write(id, {}, { title: task?.title, isCustom: true, deleted: true });
  };
  const baseStatus = (id) => (window.PROJECT?.tasks || []).find((t) => t.id === id)?.status || null;

  // ── Завантаження і Realtime ───────────────────────────
  async function reload() {
    const [tasks, log] = await Promise.all([
      S.client.from("board_tasks").select("*"),
      S.client.from("board_log").select("*").order("at", { ascending: false }).limit(LOG_LIMIT)
    ]);
    if (tasks.error || log.error) throw new Error((tasks.error || log.error).message);
    S.state = { overrides: {}, custom: [], log: log.data.map(logEntry) };
    tasks.data.forEach(applyRow);
    changed();
  }

  function subscribe() {
    S.client.channel("board")
      .on("postgres_changes", { event: "*", schema: "public", table: "board_tasks" }, (p) => { applyRow(p.new); changed(); })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "board_log" }, (p) => {
        const e = logEntry(p.new);
        S.state.log = [e, ...S.state.log].slice(0, LOG_LIMIT);
        if (e.userId && e.userId !== S.userId) S.onRemoteEvents([e]);
        changed();
      })
      .subscribe((st) => {
        if (st === "SUBSCRIBED") setStatus(S.canWrite() ? "ok" : "readonly");
        if (st === "CHANNEL_ERROR" || st === "TIMED_OUT") setStatus("err", "Немає з'єднання в реальному часі — оновлюю кожну хвилину");
      });
    // Запасний варіант, якщо Realtime недоступний
    setInterval(() => { if (document.visibilityState === "visible" && S.status === "err") reload().catch(() => {}); }, 60000);
  }

  // ── Вхід за посиланням з email ────────────────────────
  async function loadUser(session) {
    const u = session?.user;
    if (!u) { S.user = null; S.isMember = false; return; }
    const email = (u.email || "").toLowerCase();
    S.user = { id: u.id, email, name: (u.user_metadata?.name || "").trim() || email.split("@")[0] };
    const { data, error } = await S.client.rpc("is_member");
    S.isMember = !error && data === true;
  }

  // Надсилає лист з посиланням для входу. Повертає текст помилки або "".
  S.signIn = async (email) => {
    email = (email || "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return "Перевірте email";
    const { error } = await S.client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: location.origin + location.pathname + location.search }
    });
    if (!error) return "";
    return /rate limit|too many/i.test(error.message)
      ? "Забагато листів за короткий час — спробуйте через кілька хвилин"
      : error.message;
  };

  // Ім'я, яке бачать інші в журналі (зберігається в профілі Supabase)
  S.setName = async (name) => {
    name = (name || "").trim().slice(0, 40);
    if (!name) return "Введіть ім'я";
    const { error } = await S.client.auth.updateUser({ data: { name } });
    if (error) return error.message;
    await S.client.auth.refreshSession();          // нове ім'я одразу потрапляє в токен для бази
    S.user.name = name;
    changed();
    return "";
  };
  S.disconnect = async () => {
    await S.client?.auth.signOut();
    S.user = null; S.isMember = false;
    setStatus("readonly"); changed();
  };

  function loadLibrary() {
    return new Promise((resolve, reject) => {
      if (window.supabase?.createClient) return resolve();
      const s = document.createElement("script");
      s.src = SUPABASE_JS; s.integrity = SUPABASE_SRI; s.crossOrigin = "anonymous";
      s.onload = resolve; s.onerror = () => reject(new Error("Не вдалося завантажити бібліотеку Supabase"));
      document.head.appendChild(s);
    });
  }

  S.start = async () => {
    if (!S.configured) { setStatus("offline"); return; }
    try {
      await loadLibrary();
      S.client = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
        // implicit: посилання з листа працює навіть якщо відкрити його в іншому браузері / на телефоні
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" }
      });
      const { data } = await S.client.auth.getSession();
      await loadUser(data.session);
      S.client.auth.onAuthStateChange(async (_e, session) => { await loadUser(session); setStatus(S.canWrite() ? "ok" : "readonly"); changed(); });
      await reload();
      setStatus(S.canWrite() ? "ok" : "readonly");
      subscribe();
    } catch (e) {
      setStatus("err", /failed to fetch|networkerror|load failed/i.test(e.message)
        ? "Немає зв'язку з Supabase — перевірте інтернет і адресу в data/config.js"
        : /relation .* does not exist|could not find/i.test(e.message)
          ? "У базі немає таблиць дошки — виконайте supabase/schema.sql"
          : e.message);
    }
  };

  window.BoardSync = S;
})();
