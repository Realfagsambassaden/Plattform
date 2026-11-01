-- Oppsett av databasen for fysikkhjelp.no (Supabase).
-- Lim inn alt i Supabase → SQL Editor → «Run». Trygt å kjøre flere ganger.

-- Forelesninger laget i «Design din forelesning». Hver lærer eier sine egne.
create table if not exists public.forelesninger (
  id        text not null check (char_length(id) <= 40),
  eier      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  navn      text not null default 'Min forelesning' check (char_length(navn) <= 200),
  sider     jsonb not null default '[]'::jsonb,
  opprettet timestamptz not null default now(),
  endret    timestamptz not null default now(),
  primary key (eier, id)
);

-- Radsikkerhet (RLS): du kan bare se, lage, endre og slette dine egne forelesninger.
alter table public.forelesninger enable row level security;

drop policy if exists "egne forelesninger: lese"  on public.forelesninger;
drop policy if exists "egne forelesninger: lage"  on public.forelesninger;
drop policy if exists "egne forelesninger: endre" on public.forelesninger;
drop policy if exists "egne forelesninger: slette" on public.forelesninger;

create policy "egne forelesninger: lese"   on public.forelesninger for select to authenticated using (eier = auth.uid());
create policy "egne forelesninger: lage"   on public.forelesninger for insert to authenticated with check (eier = auth.uid());
create policy "egne forelesninger: endre"  on public.forelesninger for update to authenticated using (eier = auth.uid()) with check (eier = auth.uid());
create policy "egne forelesninger: slette" on public.forelesninger for delete to authenticated using (eier = auth.uid());

grant select, insert, update, delete on public.forelesninger to authenticated;
revoke all on public.forelesninger from anon;
