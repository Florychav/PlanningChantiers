-- ════════════════════════════════════════════════════
-- Schema Planning Menétrey
-- À exécuter une fois dans le SQL Editor de Supabase
-- ════════════════════════════════════════════════════

-- 1) Table des rôles applicatifs
create table public.app_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'viewer' check (role in ('viewer','editor','admin')),
  created_at timestamptz default now()
);

-- 2) Helper : rôle de l'utilisateur courant
create or replace function public.current_user_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.app_users where user_id = auth.uid()
$$;

-- 3) Tables de données (JSONB pour simplicité)
create table public.personnes  (id text primary key, body jsonb not null, updated_at timestamptz default now());
create table public.etiquettes (id text primary key, body jsonb not null, updated_at timestamptz default now());
create table public.ponts      (id text primary key, body jsonb not null, updated_at timestamptz default now());
create table public.reunions   (id text primary key, body jsonb not null, updated_at timestamptz default now());

-- 4) Trigger updated_at
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

create trigger personnes_touch  before update on public.personnes  for each row execute function public.touch_updated_at();
create trigger etiquettes_touch before update on public.etiquettes for each row execute function public.touch_updated_at();
create trigger ponts_touch      before update on public.ponts      for each row execute function public.touch_updated_at();
create trigger reunions_touch   before update on public.reunions   for each row execute function public.touch_updated_at();

-- 5) Auto-création du rôle "viewer" à l'inscription
create or replace function public.on_auth_user_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.app_users (user_id, email, role)
  values (new.id, new.email, 'viewer')
  on conflict (user_id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.on_auth_user_created();

-- 6) RLS
alter table public.app_users  enable row level security;
alter table public.personnes  enable row level security;
alter table public.etiquettes enable row level security;
alter table public.ponts      enable row level security;
alter table public.reunions   enable row level security;

-- 7) Policies app_users (utilisateur lit son rôle, admin lit/écrit tout)
create policy "self read"   on public.app_users for select to authenticated using (auth.uid() = user_id);
create policy "admin read"  on public.app_users for select to authenticated using (current_user_role() = 'admin');
create policy "admin write" on public.app_users for all    to authenticated using (current_user_role() = 'admin') with check (current_user_role() = 'admin');

-- 8) Personnes : tous lisent, seul admin écrit
create policy "all read personnes"    on public.personnes for select to authenticated using (true);
create policy "admin write personnes" on public.personnes for all    to authenticated using (current_user_role() = 'admin') with check (current_user_role() = 'admin');

-- 9) Étiquettes / Ponts / Réunions : tous lisent, editor+admin écrivent
create policy "all read etiquettes"     on public.etiquettes for select to authenticated using (true);
create policy "editor write etiquettes" on public.etiquettes for all    to authenticated using (current_user_role() in ('editor','admin')) with check (current_user_role() in ('editor','admin'));

create policy "all read ponts"     on public.ponts for select to authenticated using (true);
create policy "editor write ponts" on public.ponts for all    to authenticated using (current_user_role() in ('editor','admin')) with check (current_user_role() in ('editor','admin'));

create policy "all read reunions"     on public.reunions for select to authenticated using (true);
create policy "editor write reunions" on public.reunions for all    to authenticated using (current_user_role() in ('editor','admin')) with check (current_user_role() in ('editor','admin'));

-- 10) Realtime
alter publication supabase_realtime add table public.personnes;
alter publication supabase_realtime add table public.etiquettes;
alter publication supabase_realtime add table public.ponts;
alter publication supabase_realtime add table public.reunions;
