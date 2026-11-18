-- Спільна дошка The Agency 6 у Supabase. Вхід — посилання на email (magic link).
-- Запустіть цей файл один раз: Supabase → SQL Editor → New query → вставити → Run.
-- Повторний запуск безпечний. Перед запуском впишіть email редакторів у самому кінці файлу.

-- ── Таблиці ──────────────────────────────────────────────────────────────

-- Хто може редагувати дошку
create table if not exists public.board_members (
  email    text primary key,
  added_at timestamptz not null default now()
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
  updated_by       uuid,
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
  by_user     uuid,
  by_name     text
);
create index if not exists board_log_at_idx on public.board_log (at desc);

-- ── Хто зараз увійшов ────────────────────────────────────────────────────

create or replace function public.me_email() returns text
language sql stable as $$
  select lower(auth.jwt() ->> 'email')
$$;

-- Ім'я з профілю (людина вводить його на сайті), інакше — частина email до «@»
create or replace function public.me_name() returns text
language sql stable as $$
  select coalesce(nullif(auth.jwt() -> 'user_metadata' ->> 'name', ''), split_part(public.me_email(), '@', 1))
$$;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.board_members where lower(email) = public.me_email())
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
  new.updated_by       := auth.uid();
  new.updated_by_name  := public.me_name();

  if tg_op = 'INSERT' and new.is_custom then
    act := 'create';
  elsif new.deleted and (tg_op = 'INSERT' or not old.deleted) then
    act := 'delete';
  elsif new_status is distinct from old_status then
    act := 'move';
  else
    act := 'edit';
  end if;

  insert into public.board_log (task_id, title, action, from_status, to_status, by_user, by_name)
  values (new.id, coalesce(new.title, new.data ->> 'title'), act,
          case when act = 'move' then old_status end,
          case when act = 'move' then new_status end,
          new.updated_by, new.updated_by_name);
  return new;
end $$;

drop trigger if exists board_tasks_stamp on public.board_tasks;
create trigger board_tasks_stamp
  before insert or update on public.board_tasks
  for each row execute function public.board_tasks_stamp();

-- ── Атомарне злиття змін (двоє людей не перетирають поля одне одного) ────

-- Спершу UPDATE, і лише якщо рядка ще немає — INSERT.
-- (insert ... on conflict запускає тригер двічі — як вставку і як оновлення — і журнал дублюється.)
create or replace function public.board_patch(
  p_id text, p_patch jsonb, p_title text default null, p_base_status text default null,
  p_is_custom boolean default false, p_deleted boolean default false
) returns void
language plpgsql security invoker set search_path = public as $$
begin
  update public.board_tasks
     set data    = data || p_patch,
         title   = coalesce(p_title, title),
         deleted = p_deleted
   where id = p_id;
  if not found then
    insert into public.board_tasks (id, data, title, base_status, is_custom, deleted)
    values (p_id, p_patch, p_title, p_base_status, p_is_custom, p_deleted);
  end if;
end $$;
grant execute on function public.board_patch(text, jsonb, text, text, boolean, boolean) to authenticated;
grant execute on function public.is_member() to anon, authenticated;

-- ── Учасники для вибору виконавця ────────────────────────────────────────
-- Кожен редактор має постійний id; у задачі зберігається цей id та ім'я — без email.
alter table public.board_members add column if not exists id uuid not null default gen_random_uuid();
create unique index if not exists board_members_id_idx on public.board_members (id);

-- Список людей проєкту (лише для редакторів): id, ім'я, чи це я, чи людина вже входила
create or replace function public.board_people()
returns table (member_id uuid, name text, is_me boolean, joined boolean)
language sql stable security definer set search_path = public, auth as $$
  select m.id,
         coalesce(nullif(u.raw_user_meta_data ->> 'name', ''), split_part(m.email, '@', 1)),
         lower(m.email) = public.me_email(),
         u.id is not null
    from public.board_members m
    left join auth.users u on lower(u.email) = lower(m.email)
   where public.is_member()
   order by 2;
$$;
revoke all on function public.board_people() from public, anon;
grant execute on function public.board_people() to authenticated;

-- ── Доступ до таблиць через API ──────────────────────────────────────────
-- Нові проєкти Supabase не відкривають таблиці автоматично. Ці дозволи лише відкривають
-- таблиці для API; хто саме може читати й писати, далі вирішує Row Level Security нижче.
grant usage on schema public to anon, authenticated;
grant select on public.board_tasks, public.board_log to anon, authenticated;
grant insert, update on public.board_tasks to authenticated;
grant select on public.board_members to authenticated;

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
-- вставки в журнал — лише через тригер (security definer), політики insert немає.
-- Журнал і задачі публічні, тому email у них не зберігається — лише ім'я та внутрішній id.

-- Список редакторів бачать лише редактори
drop policy if exists "members see members" on public.board_members;
create policy "members see members" on public.board_members for select to authenticated using (public.is_member());

-- ── Оновлення в реальному часі ───────────────────────────────────────────

do $$
begin
  begin alter publication supabase_realtime add table public.board_tasks; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.board_log;   exception when duplicate_object then null; end;
end $$;

-- ── Редактори дошки ──────────────────────────────────────────────────────
-- Впишіть email усіх, хто має змінювати дошку (той самий, яким вони входитимуть):
insert into public.board_members (email) values
  ('owner@example.com')
  -- , ('teammate@example.com')
on conflict do nothing;
