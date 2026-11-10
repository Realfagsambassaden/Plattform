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

-- =====================================================================
-- Studieappen (fysikkhjelp.no/studie/). Én konto og én profil for alle nettstedene til Realfagsambassaden:
-- radene hører til kontoen, og «nettsted» sier hvor svaret ble gitt (fysikkhjelp, matematikkhjelp …).
-- =====================================================================

-- Valg og innstillinger. valgt = liste med «nettsted/tema», f.eks. ["fysikkhjelp/kinematikk"].
create table if not exists public.studie_innstillinger (
  eier       uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  valgt      jsonb not null default '[]'::jsonb,
  modus      text not null default 'alle' check (modus in ('alle', 'dag')),
  repetisjon boolean not null default true,
  varsler    boolean not null default true,
  niva       jsonb not null default '{}'::jsonb,
  endret     timestamptz not null default now()
);

-- Ett svar per rad. type = valgt alternativ (riktig / regnefeil / begrep). ki = KI-vurdering av tekst eller bilde.
-- Bilder lagres ikke, bare vurderingen.
create table if not exists public.studie_svar (
  id           bigint generated always as identity primary key,
  eier         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nettsted     text not null default 'fysikkhjelp' check (char_length(nettsted) <= 40),
  sporsmal     text not null check (char_length(sporsmal) <= 80),
  tema         text not null check (char_length(tema) <= 80),
  undertema    text not null check (char_length(undertema) <= 80),
  vanskelighet text not null check (vanskelighet in ('lett', 'middels', 'vanskelig')),
  type         text not null check (type in ('riktig', 'regnefeil', 'begrep')),
  tid_s        real check (tid_s >= 0),
  forventet_s  real check (forventet_s > 0),
  repetisjon   boolean not null default false,
  ki           jsonb check (ki is null or pg_column_size(ki) < 8000),
  opprettet    timestamptz not null default now()
);
create index if not exists studie_svar_eier on public.studie_svar (eier, opprettet);

-- Hvor vanskelig studenten synes et tema var (1–5).
create table if not exists public.studie_ukevurdering (
  eier      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nettsted  text not null default 'fysikkhjelp',
  tema      text not null check (char_length(tema) <= 80),
  vurdering smallint not null check (vurdering between 1 and 5),
  endret    timestamptz not null default now(),
  primary key (eier, nettsted, tema)
);

-- Kurs: laget av en faglærer. krev_innsyn = faglærer ser den enkelte students profil (studenten må godta ved påmelding).
create table if not exists public.kurs (
  id          uuid primary key default gen_random_uuid(),
  eier        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  navn        text not null check (char_length(navn) between 1 and 120),
  kode        text not null unique check (kode ~ '^[A-Z0-9]{6}$'),
  krev_innsyn boolean not null default false,
  opprettet   timestamptz not null default now()
);

create table if not exists public.kurs_deltaker (
  kurs            uuid not null references public.kurs (id) on delete cascade,
  student         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  samtykke_innsyn boolean not null default false,
  pameldt         timestamptz not null default now(),
  primary key (kurs, student)
);

-- Hjelpefunksjoner (security definer, så reglene under ikke går i ring).
create or replace function public.er_kurseier(k uuid) returns boolean
  language sql stable security definer set search_path = public as
  $$ select exists (select 1 from kurs where id = k and eier = auth.uid()) $$;
create or replace function public.er_deltaker(k uuid) returns boolean
  language sql stable security definer set search_path = public as
  $$ select exists (select 1 from kurs_deltaker where kurs = k and student = auth.uid()) $$;
create or replace function public.kurs_krever_innsyn(k uuid) returns boolean
  language sql stable security definer set search_path = public as
  $$ select coalesce((select krev_innsyn from kurs where id = k), true) $$;
-- Faglærer har innsyn i en student bare når kurset krever det OG studenten har godtatt.
create or replace function public.har_innsyn(s uuid) returns boolean
  language sql stable security definer set search_path = public as
  $$ select exists (select 1 from kurs_deltaker d join kurs k on k.id = d.kurs
                    where d.student = s and k.eier = auth.uid() and k.krev_innsyn and d.samtykke_innsyn) $$;

alter table public.studie_innstillinger enable row level security;
alter table public.studie_svar          enable row level security;
alter table public.studie_ukevurdering  enable row level security;
alter table public.kurs                 enable row level security;
alter table public.kurs_deltaker        enable row level security;

drop policy if exists "studie_innstillinger: egne" on public.studie_innstillinger;
create policy "studie_innstillinger: egne" on public.studie_innstillinger for all to authenticated
  using (eier = auth.uid()) with check (eier = auth.uid());

drop policy if exists "studie_svar: lese"  on public.studie_svar;
drop policy if exists "studie_svar: lage"  on public.studie_svar;
drop policy if exists "studie_svar: endre" on public.studie_svar;
drop policy if exists "studie_svar: slette" on public.studie_svar;
create policy "studie_svar: lese"   on public.studie_svar for select to authenticated using (eier = auth.uid() or public.har_innsyn(eier));
create policy "studie_svar: lage"   on public.studie_svar for insert to authenticated with check (eier = auth.uid());
create policy "studie_svar: endre"  on public.studie_svar for update to authenticated using (eier = auth.uid()) with check (eier = auth.uid());
create policy "studie_svar: slette" on public.studie_svar for delete to authenticated using (eier = auth.uid());

drop policy if exists "studie_ukevurdering: egne" on public.studie_ukevurdering;
create policy "studie_ukevurdering: egne" on public.studie_ukevurdering for all to authenticated
  using (eier = auth.uid()) with check (eier = auth.uid());

drop policy if exists "kurs: lese"   on public.kurs;
drop policy if exists "kurs: lage"   on public.kurs;
drop policy if exists "kurs: endre"  on public.kurs;
drop policy if exists "kurs: slette" on public.kurs;
create policy "kurs: lese"   on public.kurs for select to authenticated using (eier = auth.uid() or public.er_deltaker(id));
create policy "kurs: lage"   on public.kurs for insert to authenticated with check (eier = auth.uid());
create policy "kurs: endre"  on public.kurs for update to authenticated using (eier = auth.uid()) with check (eier = auth.uid());
create policy "kurs: slette" on public.kurs for delete to authenticated using (eier = auth.uid());

-- Påmelding: krever kurset innsyn, må samtykket være gitt. Samtykket kan ikke endres i ettertid; trekk det ved å melde deg av.
drop policy if exists "kurs_deltaker: lese"    on public.kurs_deltaker;
drop policy if exists "kurs_deltaker: melde på" on public.kurs_deltaker;
drop policy if exists "kurs_deltaker: melde av" on public.kurs_deltaker;
create policy "kurs_deltaker: lese"     on public.kurs_deltaker for select to authenticated using (student = auth.uid() or public.er_kurseier(kurs));
create policy "kurs_deltaker: melde på" on public.kurs_deltaker for insert to authenticated
  with check (student = auth.uid() and (samtykke_innsyn or not public.kurs_krever_innsyn(kurs)));
create policy "kurs_deltaker: melde av" on public.kurs_deltaker for delete to authenticated using (student = auth.uid() or public.er_kurseier(kurs));

-- Finn et kurs fra koden (uten å kunne liste alle kurs).
create or replace function public.finn_kurs(k text)
  returns table (id uuid, navn text, krev_innsyn boolean)
  language sql stable security definer set search_path = public as
  $$ select id, navn, krev_innsyn from kurs where kode = upper(trim(k)) $$;

-- Deltakere med e-post, bare for kurs som krever innsyn, og bare dem som har godtatt.
create or replace function public.kurs_deltakere(k uuid)
  returns table (student uuid, epost text, pameldt timestamptz)
  language sql stable security definer set search_path = public, auth as
  $$ select d.student, u.email::text, d.pameldt
       from kurs_deltaker d join kurs c on c.id = d.kurs join auth.users u on u.id = d.student
      where d.kurs = k and c.eier = auth.uid() and c.krev_innsyn and d.samtykke_innsyn
      order by u.email $$;

-- Anonym oversikt for faglærer: per tema. Tall vises bare når minst 5 studenter har svart.
create or replace function public.kurs_oversikt(k uuid)
  returns table (nettsted text, tema text, studenter_vurdering int, vurdering numeric,
                 studenter_svar int, forstaelse numeric, presisjon numeric, hurtighet numeric)
  language sql stable security definer set search_path = public as
$$
  with ok as (select 1 from kurs where id = k and eier = auth.uid()),
  deltakere as (select student from kurs_deltaker where kurs = k and exists (select 1 from ok)),
  v as (select u.nettsted, u.tema, count(*)::int n, avg(u.vurdering) snitt
          from studie_ukevurdering u join deltakere d on d.student = u.eier group by 1, 2),
  s as (select x.nettsted, x.tema, count(distinct x.eier)::int n,
               sum(case when x.eff <> 'begrep' then x.w else 0 end) / sum(x.w) f,
               count(*) filter (where x.eff = 'riktig')::numeric / nullif(count(*) filter (where x.eff <> 'begrep'), 0) p,
               count(*) filter (where x.eff = 'riktig' and x.tid_s <= x.forventet_s)::numeric
                 / nullif(count(*) filter (where x.eff = 'riktig'), 0) h
          from (select a.*, case when a.ki ->> 'vurdering' in ('riktig', 'regnefeil', 'begrep') then a.ki ->> 'vurdering' else a.type end eff,
                       case a.vanskelighet when 'lett' then 1 when 'middels' then 1.5 else 2 end w
                  from studie_svar a join deltakere d on d.student = a.eier) x
         group by 1, 2)
  select coalesce(v.nettsted, s.nettsted), coalesce(v.tema, s.tema),
         coalesce(v.n, 0), case when v.n >= 5 then round(v.snitt, 2) end,
         coalesce(s.n, 0),
         case when s.n >= 5 then round(s.f, 3) end, case when s.n >= 5 then round(s.p, 3) end, case when s.n >= 5 then round(s.h, 3) end
    from v full join s on s.nettsted = v.nettsted and s.tema = v.tema
$$;

create or replace function public.kurs_antall(k uuid) returns int
  language sql stable security definer set search_path = public as
  $$ select case when public.er_kurseier(k) then (select count(*)::int from kurs_deltaker where kurs = k) end $$;

grant select, insert, update, delete on public.studie_innstillinger, public.studie_svar, public.studie_ukevurdering,
                                         public.kurs, public.kurs_deltaker to authenticated;
revoke all on public.studie_innstillinger, public.studie_svar, public.studie_ukevurdering, public.kurs, public.kurs_deltaker from anon;
revoke execute on function public.er_kurseier(uuid), public.er_deltaker(uuid), public.kurs_krever_innsyn(uuid), public.har_innsyn(uuid),
  public.finn_kurs(text), public.kurs_deltakere(uuid), public.kurs_oversikt(uuid), public.kurs_antall(uuid) from public, anon;
grant execute on function public.er_kurseier(uuid), public.er_deltaker(uuid), public.kurs_krever_innsyn(uuid), public.har_innsyn(uuid),
  public.finn_kurs(text), public.kurs_deltakere(uuid), public.kurs_oversikt(uuid), public.kurs_antall(uuid) to authenticated;
