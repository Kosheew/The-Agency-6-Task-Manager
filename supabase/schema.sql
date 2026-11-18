-- Спільна дошка The Agency 6 у Supabase.
-- Запустіть цей файл один раз: Supabase → SQL Editor → New query → вставити → Run.
-- Повторний запуск безпечний (create ... if not exists / or replace).

-- ── Таблиці ──────────────────────────────────────────────────────────────

-- Хто може редагувати дошку (логіни GitHub, у нижньому регістрі не обов'язково)
create table if not exists public.board_members (
  github_login text primary key,
  added_at     timestamptz not null default now()
);

-- Стан задач: для базових задач (data/tasks.js) — лише змінені поля,
-- для нових задач з інтерфейсу (is_custom) — уся задача.
create table if not exists public.board_tasks (
  id               text primary key,
  data             jsonb       not null default '{}'::jsonb,
  title            text,
  base_status      text,
  is_custom        boolean     not null default false,
  deleted          boolean     not null default false,
  updated_at       timestamptz not null default now(),
  updated_by_login text,
  updated_by_name  text
);

-- Журнал змін (пише лише тригер — клієнт не може підробити автора)
create table if not exists public.board_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  task_id     text not null,
  title       text,
  action      text not null,          -- move | edit | create | delete
  from_status text,
  to_status   text,
  by_login    text,
  by_name     text
);
create index if not exists board_log_at_idx on public.board_log (at desc);

-- ── Хто зараз увійшов (з профілю GitHub у JWT) ───────────────────────────

create or replace function public.gh_login() returns text
language sql stable as $$
  select lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'user_name',
                        auth.jwt() -> 'user_metadata' ->> 'preferred_username'))
$$;

create or replace function public.gh_name() returns text
language sql stable as $$
  select coalesce(auth.jwt() -> 'user_metadata' ->> 'full_name',
                  auth.jwt() -> 'user_metadata' ->> 'name',
                  public.gh_login())
$$;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.board_members where lower(github_login) = public.gh_login())
$$;

-- ── Автор і журнал ставить база ──────────────────────────────────────────

create or replace function public.board_tasks_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  old_status text := case when tg_op = 'UPDATE' then coalesce(old.data ->> 'status', old.base_status) else new.base_status end;
  new_status text := coalesce(new.data ->> 'status', old_status);
  act        text;
begin
  new.updated_at       := now();
  new.updated_by_login := public.gh_login();
  new.updated_by_name  := public.gh_name();

  if tg_op = 'INSERT' and new.is_custom then
    act := 'create';
  elsif new.deleted and (tg_op = 'INSERT' or not old.deleted) then
    act := 'delete';
  elsif new_status is distinct from old_status then
    act := 'move';
  else
    act := 'edit';
  end if;

  insert into public.board_log (task_id, title, action, from_status, to_status, by_login, by_name)
  values (new.id, coalesce(new.title, new.data ->> 'title'), act,
          case when act = 'move' then old_status end,
          case when act = 'move' then new_status end,
          new.updated_by_login, new.updated_by_name);
  return new;
end $$;

drop trigger if exists board_tasks_stamp on public.board_tasks;
create trigger board_tasks_stamp
  before insert or update on public.board_tasks
  for each row execute function public.board_tasks_stamp();

-- ── Атомарне злиття змін (двоє людей не перетирають поля одне одного) ────

create or replace function public.board_patch(
  p_id text, p_patch jsonb, p_title text default null, p_base_status text default null,
  p_is_custom boolean default false, p_deleted boolean default false
) returns void
language sql security invoker set search_path = public as $$
  insert into public.board_tasks (id, data, title, base_status, is_custom, deleted)
  values (p_id, p_patch, p_title, p_base_status, p_is_custom, p_deleted)
  on conflict (id) do update
    set data    = public.board_tasks.data || excluded.data,
        title   = coalesce(excluded.title, public.board_tasks.title),
        deleted = excluded.deleted;
$$;
grant execute on function public.board_patch(text, jsonb, text, text, boolean, boolean) to authenticated;
grant execute on function public.is_member() to anon, authenticated;

-- ── Права доступу (Row Level Security) ───────────────────────────────────

alter table public.board_members enable row level security;
alter table public.board_tasks   enable row level security;
alter table public.board_log     enable row level security;

drop policy if exists "board tasks are public" on public.board_tasks;
create policy "board tasks are public" on public.board_tasks for select using (true);

drop policy if exists "members insert tasks" on public.board_tasks;
create policy "members insert tasks" on public.board_tasks for insert to authenticated with check (public.is_member());

drop policy if exists "members update tasks" on public.board_tasks;
create policy "members update tasks" on public.board_tasks for update to authenticated
  using (public.is_member()) with check (public.is_member());

drop policy if exists "board log is public" on public.board_log;
create policy "board log is public" on public.board_log for select using (true);
-- вставки в журнал — лише через тригер (security definer), політики insert немає

drop policy if exists "members list for signed in" on public.board_members;
create policy "members list for signed in" on public.board_members for select to authenticated using (true);

-- ── Оновлення в реальному часі ───────────────────────────────────────────

do $$
begin
  begin alter publication supabase_realtime add table public.board_tasks; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.board_log;   exception when duplicate_object then null; end;
end $$;

-- ── Редактори дошки ──────────────────────────────────────────────────────
-- Додайте логіни GitHub усіх, хто має змінювати дошку:
insert into public.board_members (github_login) values
  ('kosheew')
  -- , ('your-github-login')
on conflict do nothing;
