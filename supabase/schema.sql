-- =====================================================================
--  Synferrous — Supabase (PostgreSQL) schema
--  Full application data model + logging / audit / analytics tables.
--
--  HOW TO RUN:  Supabase Dashboard -> SQL Editor -> New query ->
--               paste this whole file -> Run. It is idempotent (safe to
--               re-run); it creates types, tables, indexes, RLS policies,
--               triggers, reporting views, and a little sample data.
--
--  IMPORTANT:   Your app currently stores data in MongoDB. These tables
--               will NOT fill up on their own — the backend has to write
--               to Supabase. When you wire that up:
--                 * the BACKEND should use the SERVICE_ROLE key  -> bypasses RLS
--                 * the BROWSER should use the ANON key          -> governed by RLS below
-- =====================================================================

-- ---------- Extensions ----------
create extension if not exists pgcrypto;        -- gen_random_uuid()

-- ---------- Enumerated types ----------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('admin', 'user');
  end if;
  if not exists (select 1 from pg_type where typname = 'post_status') then
    create type post_status as enum ('draft', 'published');
  end if;
  if not exists (select 1 from pg_type where typname = 'lead_status') then
    create type lead_status as enum ('new', 'contacted', 'qualified', 'closed');
  end if;
  if not exists (select 1 from pg_type where typname = 'chat_role') then
    create type chat_role as enum ('user', 'assistant', 'system');
  end if;
end $$;

-- ---------- Shared helpers ----------
-- Auto-maintain updated_at on row updates.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Is the current logged-in user an admin? Used throughout RLS below.
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- =====================================================================
--  APPLICATION TABLES
-- =====================================================================

-- ---------- profiles (app users; linked to Supabase Auth) ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text unique not null,
  name        text,
  role        user_role not null default 'user',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Auto-create a profile row whenever someone signs up via Supabase Auth.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- categories ----------
create table if not exists public.categories (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text unique not null,
  description  text default '',
  sort_order   int  default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------- services ----------
create table if not exists public.services (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  slug               text unique not null,
  category_id        uuid references public.categories(id) on delete set null,
  short_description  text default '',
  long_description   text default '',
  image_url          text default '',
  price_label        text default 'Custom Quote',
  features           text[] not null default '{}',
  deliverables       text[] not null default '{}',
  duration           text default '',
  featured           boolean not null default false,
  active             boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ---------- banners (homepage hero slides) ----------
create table if not exists public.banners (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  subtitle    text default '',
  image_url   text default '',
  cta_label   text default '',
  cta_link    text default '',
  sort_order  int  default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- pages (CMS: about / privacy / terms) ----------
create table if not exists public.pages (
  id                uuid primary key default gen_random_uuid(),
  slug              text unique not null,
  title             text not null,
  meta_description  text default '',
  content           text default '',          -- markdown
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ---------- posts (Insights / blog) ----------
create table if not exists public.posts (
  id                uuid primary key default gen_random_uuid(),
  slug              text unique not null,
  title             text not null,
  excerpt           text default '',
  body              text default '',           -- markdown
  cover_image       text default '',
  author            text default 'Rohan Kapoor',
  tags              text[] not null default '{}',
  meta_description  text default '',
  status            post_status not null default 'draft',
  published_at      timestamptz,
  read_time_min     int default 5,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ---------- leads (contact-form submissions) ----------
create table if not exists public.leads (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  email             text not null,
  phone             text default '',
  company           text default '',
  message           text default '',
  service_interest  text default '',
  source            text default 'contact_form',
  status            lead_status not null default 'new',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ---------- chat (Aria assistant) ----------
create table if not exists public.chat_sessions (
  id               uuid primary key default gen_random_uuid(),
  visitor_label    text default '',
  message_count    int  not null default 0,
  started_at       timestamptz not null default now(),
  last_message_at  timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid references public.chat_sessions(id) on delete cascade,
  role        chat_role not null,
  content     text not null,
  created_at  timestamptz not null default now()
);

-- =====================================================================
--  LOGGING / AUDIT / ANALYTICS TABLES
-- =====================================================================

-- ---------- audit_log (who changed what, when) ----------
create table if not exists public.audit_log (
  id           bigint generated always as identity primary key,
  actor_id     uuid references public.profiles(id) on delete set null,
  actor_email  text,
  action       text not null,          -- create | update | delete | login | publish ...
  entity_type  text not null,          -- post | service | lead | page | banner | category ...
  entity_id    text,
  metadata     jsonb not null default '{}',
  created_at   timestamptz not null default now()
);

-- ---------- analytics_events (page views / custom events) ----------
create table if not exists public.analytics_events (
  id          bigint generated always as identity primary key,
  event_type  text not null default 'page_view',
  path        text,
  referrer    text,
  session_id  text,
  user_agent  text,
  country     text,
  metadata    jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

-- ---------- lead_activity (status-change history for each lead) ----------
create table if not exists public.lead_activity (
  id           bigint generated always as identity primary key,
  lead_id      uuid references public.leads(id) on delete cascade,
  from_status  lead_status,
  to_status    lead_status,
  note         text default '',
  actor_id     uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- ---------- email_log (outbound notifications) ----------
create table if not exists public.email_log (
  id                   bigint generated always as identity primary key,
  to_email             text not null,
  subject              text,
  template             text,                  -- e.g. lead_notification
  provider             text default 'resend',
  provider_message_id  text,
  status               text default 'sent',   -- sent | failed
  error                text,
  related_lead_id      uuid references public.leads(id) on delete set null,
  created_at           timestamptz not null default now()
);

-- =====================================================================
--  TRIGGERS
-- =====================================================================

-- updated_at on all mutable domain tables
do $$
declare t text;
begin
  foreach t in array array['profiles','categories','services','banners','pages','posts','leads']
  loop
    execute format('drop trigger if exists set_updated_at on public.%I;', t);
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function public.set_updated_at();', t);
  end loop;
end $$;

-- Auto-record every lead status change into lead_activity
create or replace function public.log_lead_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'UPDATE' and new.status is distinct from old.status) then
    insert into public.lead_activity (lead_id, from_status, to_status, actor_id)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end $$;

drop trigger if exists trg_lead_status on public.leads;
create trigger trg_lead_status
  after update on public.leads
  for each row execute function public.log_lead_status_change();

-- =====================================================================
--  INDEXES
-- =====================================================================
create index if not exists idx_services_category     on public.services(category_id);
create index if not exists idx_services_active        on public.services(active);
create index if not exists idx_posts_status           on public.posts(status);
create index if not exists idx_posts_published_at     on public.posts(published_at desc);
create index if not exists idx_posts_tags             on public.posts using gin(tags);
create index if not exists idx_leads_status           on public.leads(status);
create index if not exists idx_leads_created          on public.leads(created_at desc);
create index if not exists idx_chat_messages_session  on public.chat_messages(session_id, created_at);
create index if not exists idx_audit_created          on public.audit_log(created_at desc);
create index if not exists idx_audit_entity           on public.audit_log(entity_type, entity_id);
create index if not exists idx_events_created         on public.analytics_events(created_at desc);
create index if not exists idx_events_path            on public.analytics_events(path);
create index if not exists idx_lead_activity_lead     on public.lead_activity(lead_id, created_at);
create index if not exists idx_email_log_created      on public.email_log(created_at desc);

-- =====================================================================
--  ROW-LEVEL SECURITY
--  (the service_role key bypasses all of this; these rules apply to the
--   anon/authenticated keys used by the browser)
-- =====================================================================
alter table public.profiles         enable row level security;
alter table public.categories       enable row level security;
alter table public.services         enable row level security;
alter table public.banners          enable row level security;
alter table public.pages            enable row level security;
alter table public.posts            enable row level security;
alter table public.leads            enable row level security;
alter table public.chat_sessions    enable row level security;
alter table public.chat_messages    enable row level security;
alter table public.audit_log        enable row level security;
alter table public.analytics_events enable row level security;
alter table public.lead_activity    enable row level security;
alter table public.email_log        enable row level security;

-- profiles: you can see/update your own; admins can see/manage all
drop policy if exists "profiles self read"   on public.profiles;
drop policy if exists "profiles self update" on public.profiles;
drop policy if exists "profiles admin all"   on public.profiles;
create policy "profiles self read"   on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profiles self update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles admin all"   on public.profiles for all    using (public.is_admin()) with check (public.is_admin());

-- categories / services / banners: public sees active rows; admins manage all
do $$
declare t text;
begin
  foreach t in array array['categories','services','banners']
  loop
    execute format('drop policy if exists "%1$s public read"  on public.%1$I;', t);
    execute format('drop policy if exists "%1$s admin write"  on public.%1$I;', t);
    execute format('create policy "%1$s public read" on public.%1$I for select using (active or public.is_admin());', t);
    execute format('create policy "%1$s admin write" on public.%1$I for all using (public.is_admin()) with check (public.is_admin());', t);
  end loop;
end $$;

-- pages: fully public to read (about/privacy/terms); admins manage
drop policy if exists "pages public read" on public.pages;
drop policy if exists "pages admin write" on public.pages;
create policy "pages public read" on public.pages for select using (true);
create policy "pages admin write" on public.pages for all using (public.is_admin()) with check (public.is_admin());

-- posts: public sees published; admins manage all
drop policy if exists "posts public read" on public.posts;
drop policy if exists "posts admin write" on public.posts;
create policy "posts public read" on public.posts for select using (status = 'published' or public.is_admin());
create policy "posts admin write" on public.posts for all using (public.is_admin()) with check (public.is_admin());

-- leads: anyone may submit; only admins may read/update/delete
drop policy if exists "leads public insert" on public.leads;
drop policy if exists "leads admin read"    on public.leads;
drop policy if exists "leads admin update"  on public.leads;
drop policy if exists "leads admin delete"  on public.leads;
create policy "leads public insert" on public.leads for insert with check (true);
create policy "leads admin read"    on public.leads for select using (public.is_admin());
create policy "leads admin update"  on public.leads for update using (public.is_admin()) with check (public.is_admin());
create policy "leads admin delete"  on public.leads for delete using (public.is_admin());

-- chat: anyone may write (public assistant); only admins may read transcripts
drop policy if exists "chat_sessions insert"     on public.chat_sessions;
drop policy if exists "chat_sessions admin read" on public.chat_sessions;
drop policy if exists "chat_messages insert"     on public.chat_messages;
drop policy if exists "chat_messages admin read" on public.chat_messages;
create policy "chat_sessions insert"     on public.chat_sessions for insert with check (true);
create policy "chat_sessions admin read" on public.chat_sessions for select using (public.is_admin());
create policy "chat_messages insert"     on public.chat_messages for insert with check (true);
create policy "chat_messages admin read" on public.chat_messages for select using (public.is_admin());

-- analytics_events: anyone may log a page view; only admins may read
drop policy if exists "events public insert" on public.analytics_events;
drop policy if exists "events admin read"    on public.analytics_events;
create policy "events public insert" on public.analytics_events for insert with check (true);
create policy "events admin read"    on public.analytics_events for select using (public.is_admin());

-- audit_log / lead_activity / email_log: admin-read only.
-- (No insert policy => only the service_role key, which bypasses RLS, can write.)
drop policy if exists "audit admin read"        on public.audit_log;
drop policy if exists "lead_activity admin read" on public.lead_activity;
drop policy if exists "email_log admin read"    on public.email_log;
create policy "audit admin read"         on public.audit_log     for select using (public.is_admin());
create policy "lead_activity admin read" on public.lead_activity for select using (public.is_admin());
create policy "email_log admin read"     on public.email_log     for select using (public.is_admin());

-- =====================================================================
--  REPORTING VIEWS (for you, the owner)
--  security_invoker = true => the view respects the caller's RLS, so
--  these are admin-only via the policies above.
-- =====================================================================
create or replace view public.v_lead_funnel
  with (security_invoker = true) as
  select status, count(*) as count
  from public.leads group by status;

create or replace view public.v_daily_leads
  with (security_invoker = true) as
  select date_trunc('day', created_at)::date as day, count(*) as leads
  from public.leads group by 1 order by 1 desc;

create or replace view public.v_daily_traffic
  with (security_invoker = true) as
  select date_trunc('day', created_at)::date as day, count(*) as views
  from public.analytics_events
  where event_type = 'page_view' group by 1 order by 1 desc;

create or replace view public.v_published_posts
  with (security_invoker = true) as
  select id, slug, title, published_at
  from public.posts where status = 'published' order by published_at desc nulls last;

-- =====================================================================
--  SAMPLE DATA (optional — delete this block any time)
-- =====================================================================
insert into public.categories (name, slug, description, sort_order) values
  ('Business Analysis & Advisory', 'business-analysis-advisory', 'Requirements, process mapping & BA-as-a-service.', 1),
  ('AI Product Engineering', 'ai-product-engineering', 'Design and build AI products & LLM features.', 2)
on conflict (slug) do nothing;

insert into public.pages (slug, title, meta_description, content) values
  ('about', 'About Synferrous', 'About Synferrous.', '## Who we are\n\n_(placeholder)_')
on conflict (slug) do nothing;

insert into public.posts (slug, title, excerpt, status, published_at, tags) values
  ('hello-world', 'Hello, world', 'First sample post.', 'published', now(), array['sample'])
on conflict (slug) do nothing;

insert into public.leads (name, email, message, source) values
  ('Sample Lead', 'sample@example.com', 'This is a demo lead — safe to delete.', 'seed')
on conflict do nothing;

insert into public.analytics_events (event_type, path, referrer) values
  ('page_view', '/', 'https://www.google.com/')
on conflict do nothing;

-- =====================================================================
--  Done.
-- =====================================================================
