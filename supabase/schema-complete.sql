-- ════════════════════════════════════════════════════════════════════
-- Schema COMPLET — Planning Menétrey (base de TEST refonte)
-- ════════════════════════════════════════════════════════════════════
--
-- Destiné à provisionner une base Supabase de TEST (cf. blocker B2,
-- compte test-refonte@menetrey.local). NE PAS exécuter sur la prod.
--
-- Différences avec `supabase-schema.sql` (prod, laissé intact) :
--   • Ajout des tables SAV `personnes_sav` et `etiquettes_sav`
--     (reconstruites depuis `planning-sav.html` legacy — voir
--     `supabase/README-test-db.md` § Reconstruction).
--   • Colonne `__e2e_test__ boolean default false` sur les 6 tables
--     métier — support du pattern self-cleanup E2E (cf. `TESTING.md`).
--   • Script IDEMPOTENT : ré-exécutable sans erreur (`if not exists`,
--     `create or replace`, `drop ... if exists` avant `create`).
--
-- Stratégie des données de test : voir `TESTING.md`. La base démarre
-- VIDE — les tests E2E peuplent et nettoient eux-mêmes.
-- ════════════════════════════════════════════════════════════════════

-- 1) Table des rôles applicatifs ─────────────────────────────────────
create table if not exists public.app_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'viewer' check (role in ('viewer','editor','admin')),
  created_at timestamptz default now()
);

-- 2) Helper : rôle de l'utilisateur courant ──────────────────────────
create or replace function public.current_user_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.app_users where user_id = auth.uid()
$$;

-- 3) Tables de données métier (JSONB) ────────────────────────────────
--    Montage : personnes, etiquettes, ponts, reunions
--    SAV     : personnes_sav, etiquettes_sav (mêmes colonnes)
create table if not exists public.personnes      (id text primary key, body jsonb not null, updated_at timestamptz default now());
create table if not exists public.etiquettes     (id text primary key, body jsonb not null, updated_at timestamptz default now());
create table if not exists public.ponts          (id text primary key, body jsonb not null, updated_at timestamptz default now());
create table if not exists public.reunions       (id text primary key, body jsonb not null, updated_at timestamptz default now());
create table if not exists public.personnes_sav  (id text primary key, body jsonb not null, updated_at timestamptz default now());
create table if not exists public.etiquettes_sav (id text primary key, body jsonb not null, updated_at timestamptz default now());

-- 3bis) Marqueur E2E sur les 6 tables métier ─────────────────────────
--   Les données créées par les tests E2E portent __e2e_test__ = true.
--   Reset : `delete from <table> where __e2e_test__ = true`.
--   `add column if not exists` => idempotent, fonctionne aussi sur une
--   table préexistante.
alter table public.personnes      add column if not exists __e2e_test__ boolean not null default false;
alter table public.etiquettes     add column if not exists __e2e_test__ boolean not null default false;
alter table public.ponts          add column if not exists __e2e_test__ boolean not null default false;
alter table public.reunions       add column if not exists __e2e_test__ boolean not null default false;
alter table public.personnes_sav  add column if not exists __e2e_test__ boolean not null default false;
alter table public.etiquettes_sav add column if not exists __e2e_test__ boolean not null default false;

-- 4) Trigger updated_at ──────────────────────────────────────────────
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

drop trigger if exists personnes_touch       on public.personnes;
drop trigger if exists etiquettes_touch      on public.etiquettes;
drop trigger if exists ponts_touch           on public.ponts;
drop trigger if exists reunions_touch        on public.reunions;
drop trigger if exists personnes_sav_touch   on public.personnes_sav;
drop trigger if exists etiquettes_sav_touch  on public.etiquettes_sav;

create trigger personnes_touch      before update on public.personnes      for each row execute function public.touch_updated_at();
create trigger etiquettes_touch     before update on public.etiquettes     for each row execute function public.touch_updated_at();
create trigger ponts_touch          before update on public.ponts          for each row execute function public.touch_updated_at();
create trigger reunions_touch       before update on public.reunions       for each row execute function public.touch_updated_at();
create trigger personnes_sav_touch  before update on public.personnes_sav  for each row execute function public.touch_updated_at();
create trigger etiquettes_sav_touch before update on public.etiquettes_sav for each row execute function public.touch_updated_at();

-- 5) Auto-création du rôle "viewer" à l'inscription ──────────────────
create or replace function public.on_auth_user_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.app_users (user_id, email, role)
  values (new.id, new.email, 'viewer')
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.on_auth_user_created();

-- 6) RLS ─────────────────────────────────────────────────────────────
alter table public.app_users      enable row level security;
alter table public.personnes      enable row level security;
alter table public.etiquettes     enable row level security;
alter table public.ponts          enable row level security;
alter table public.reunions       enable row level security;
alter table public.personnes_sav  enable row level security;
alter table public.etiquettes_sav enable row level security;

-- 7) Policies app_users (utilisateur lit son rôle, admin lit/écrit tout)
drop policy if exists "self read"   on public.app_users;
drop policy if exists "admin read"  on public.app_users;
drop policy if exists "admin write" on public.app_users;
create policy "self read"   on public.app_users for select to authenticated using (auth.uid() = user_id);
create policy "admin read"  on public.app_users for select to authenticated using (current_user_role() = 'admin');
create policy "admin write" on public.app_users for all    to authenticated using (current_user_role() = 'admin') with check (current_user_role() = 'admin');

-- 8) Personnes (montage) : tous lisent, seul admin écrit
drop policy if exists "all read personnes"    on public.personnes;
drop policy if exists "admin write personnes" on public.personnes;
create policy "all read personnes"    on public.personnes for select to authenticated using (true);
create policy "admin write personnes" on public.personnes for all    to authenticated using (current_user_role() = 'admin') with check (current_user_role() = 'admin');

-- 9) Étiquettes / Ponts / Réunions : tous lisent, editor+admin écrivent
drop policy if exists "all read etiquettes"     on public.etiquettes;
drop policy if exists "editor write etiquettes" on public.etiquettes;
create policy "all read etiquettes"     on public.etiquettes for select to authenticated using (true);
create policy "editor write etiquettes" on public.etiquettes for all    to authenticated using (current_user_role() in ('editor','admin')) with check (current_user_role() in ('editor','admin'));

drop policy if exists "all read ponts"     on public.ponts;
drop policy if exists "editor write ponts" on public.ponts;
create policy "all read ponts"     on public.ponts for select to authenticated using (true);
create policy "editor write ponts" on public.ponts for all    to authenticated using (current_user_role() in ('editor','admin')) with check (current_user_role() in ('editor','admin'));

drop policy if exists "all read reunions"     on public.reunions;
drop policy if exists "editor write reunions" on public.reunions;
create policy "all read reunions"     on public.reunions for select to authenticated using (true);
create policy "editor write reunions" on public.reunions for all    to authenticated using (current_user_role() in ('editor','admin')) with check (current_user_role() in ('editor','admin'));

-- 10) Tables SAV : tous lisent, editor+admin écrivent
--     (le planning SAV synchronise personnes_sav + etiquettes_sav sous
--      la garde canEdit() = ['editor','admin'] — cf. planning-sav.html)
drop policy if exists "all read personnes_sav"     on public.personnes_sav;
drop policy if exists "editor write personnes_sav" on public.personnes_sav;
create policy "all read personnes_sav"     on public.personnes_sav for select to authenticated using (true);
create policy "editor write personnes_sav" on public.personnes_sav for all    to authenticated using (current_user_role() in ('editor','admin')) with check (current_user_role() in ('editor','admin'));

drop policy if exists "all read etiquettes_sav"     on public.etiquettes_sav;
drop policy if exists "editor write etiquettes_sav" on public.etiquettes_sav;
create policy "all read etiquettes_sav"     on public.etiquettes_sav for select to authenticated using (true);
create policy "editor write etiquettes_sav" on public.etiquettes_sav for all    to authenticated using (current_user_role() in ('editor','admin')) with check (current_user_role() in ('editor','admin'));

-- 11) Realtime — ajout idempotent des 6 tables métier à la publication
do $$
declare t text;
begin
  foreach t in array array[
    'personnes','etiquettes','ponts','reunions','personnes_sav','etiquettes_sav'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ════════════════════════════════════════════════════════════════════
-- Fin. Base prête, VIDE. Création des comptes : voir README-test-db.md.
-- ════════════════════════════════════════════════════════════════════
