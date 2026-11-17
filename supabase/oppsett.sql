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

-- Studentlisten (kurs_deltakere) står under «Roller» lenger ned.

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
  public.finn_kurs(text), public.kurs_oversikt(uuid), public.kurs_antall(uuid) from public, anon;
grant execute on function public.er_kurseier(uuid), public.er_deltaker(uuid), public.kurs_krever_innsyn(uuid), public.har_innsyn(uuid),
  public.finn_kurs(text), public.kurs_oversikt(uuid), public.kurs_antall(uuid) to authenticated;

-- =====================================================================
-- Roller: student (standard), underviser (godkjent av administrator) og admin.
-- Undervisere godkjennes med en personlig underviserkode som administratoren lager på Min side.
-- Gjør deg selv til administrator én gang (bytt e-posten, ikke legg den i repoet):
--   insert into public.profiler (id, rolle) select id, 'admin' from auth.users where email = 'din@epost.no'
--   on conflict (id) do update set rolle = 'admin';
-- =====================================================================

create table if not exists public.profiler (
  id        uuid primary key references auth.users (id) on delete cascade,
  rolle     text not null default 'student' check (rolle in ('student', 'underviser', 'admin')),
  opprettet timestamptz not null default now()
);

create table if not exists public.underviserkoder (
  kode      text primary key check (kode ~ '^[A-Z0-9]{10}$'),
  navn      text not null check (char_length(navn) between 1 and 120),   -- hvem koden er til
  opprettet timestamptz not null default now(),
  brukt_av  uuid references auth.users (id) on delete set null,
  brukt     timestamptz
);

create or replace function public.min_rolle() returns text
  language sql stable security definer set search_path = public as
  $$ select coalesce((select rolle from profiler where id = auth.uid()), 'student') $$;
create or replace function public.er_admin() returns boolean
  language sql stable security definer set search_path = public as
  $$ select public.min_rolle() = 'admin' $$;
create or replace function public.er_underviser() returns boolean
  language sql stable security definer set search_path = public as
  $$ select public.min_rolle() in ('underviser', 'admin') $$;

-- Sjekk en kode før registrering (ledig og gyldig). Kodene er tilfeldige med 10 tegn, så de kan ikke gjettes.
create or replace function public.sjekk_underviserkode(k text) returns boolean
  language sql stable security definer set search_path = public as
  $$ select exists (select 1 from underviserkoder where kode = upper(trim(k)) and brukt_av is null) $$;

-- Ta i bruk en kode (innlogget). Gir rollen underviser. Admin beholder admin.
create or replace function public.bli_underviser(k text) returns boolean
  language plpgsql security definer set search_path = public as
$$
begin
  if auth.uid() is null then return false; end if;
  update underviserkoder set brukt_av = auth.uid(), brukt = now()
   where kode = upper(trim(k)) and brukt_av is null;
  if not found then return false; end if;
  insert into profiler (id, rolle) values (auth.uid(), 'underviser')
    on conflict (id) do update set rolle = case when profiler.rolle = 'admin' then 'admin' else 'underviser' end;
  return true;
end $$;

-- Ny bruker: lag profil. Ble en gyldig underviserkode oppgitt ved registrering, blir brukeren underviser.
-- Navn (vises i appen og for faglæreren i stedet for e-post). Settes ved registrering og kan endres på Min side.
alter table public.profiler add column if not exists navn text not null default '' check (char_length(navn) <= 80);
create or replace function public.sett_navn(n text) returns boolean
  language plpgsql security definer set search_path = public as
$$
begin
  if auth.uid() is null then return false; end if;
  insert into profiler (id, navn) values (auth.uid(), left(trim(coalesce(n, '')), 80))
    on conflict (id) do update set navn = left(trim(coalesce(n, '')), 80);
  return true;
end $$;
revoke execute on function public.sett_navn(text) from public, anon;
grant execute on function public.sett_navn(text) to authenticated;

create or replace function public.ny_bruker() returns trigger
  language plpgsql security definer set search_path = public as
$$
declare k text := upper(trim(coalesce(new.raw_user_meta_data ->> 'underviserkode', '')));
begin
  insert into profiler (id, navn) values (new.id, left(trim(coalesce(new.raw_user_meta_data ->> 'navn', '')), 80)) on conflict (id) do nothing;
  if k <> '' then
    update underviserkoder set brukt_av = new.id, brukt = now() where kode = k and brukt_av is null;
    if found then update profiler set rolle = 'underviser' where id = new.id; end if;
  end if;
  return new;
end $$;
drop trigger if exists ny_bruker on auth.users;
create trigger ny_bruker after insert on auth.users for each row execute function public.ny_bruker();
insert into public.profiler (id) select id from auth.users on conflict (id) do nothing;

-- Administrator: oversikt over undervisere og mulighet til å trekke tilbake tilgangen.
create or replace function public.admin_undervisere()
  returns table (id uuid, epost text, rolle text, kode_til text, siden timestamptz)
  language sql stable security definer set search_path = public, auth as
  $$ select p.id, u.email::text, p.rolle, c.navn, coalesce(c.brukt, p.opprettet)
       from profiler p join auth.users u on u.id = p.id left join underviserkoder c on c.brukt_av = p.id
      where public.er_admin() and p.rolle in ('underviser', 'admin') order by u.email $$;
create or replace function public.sett_student(b uuid) returns boolean
  language plpgsql security definer set search_path = public as
$$
begin
  if not public.er_admin() or b = auth.uid() then return false; end if;
  update profiler set rolle = 'student' where id = b and rolle = 'underviser';
  return found;
end $$;

alter table public.profiler        enable row level security;
alter table public.underviserkoder enable row level security;
drop policy if exists "profiler: egen" on public.profiler;
create policy "profiler: egen" on public.profiler for select to authenticated using (id = auth.uid() or public.er_admin());
drop policy if exists "underviserkoder: admin" on public.underviserkoder;
create policy "underviserkoder: admin" on public.underviserkoder for all to authenticated using (public.er_admin()) with check (public.er_admin());
grant select on public.profiler to authenticated;
grant select, insert, delete on public.underviserkoder to authenticated;
revoke all on public.profiler, public.underviserkoder from anon;

-- Bare undervisere kan lage kurs og forelesninger.
drop policy if exists "kurs: lage" on public.kurs;
create policy "kurs: lage" on public.kurs for insert to authenticated with check (eier = auth.uid() and public.er_underviser());
drop policy if exists "egne forelesninger: lage" on public.forelesninger;
create policy "egne forelesninger: lage" on public.forelesninger for insert to authenticated with check (eier = auth.uid() and public.er_underviser());

-- Studentlisten i et kurs med innsyn: e-post, påmeldt, antall svar, sist aktiv og samlet profil.
-- Returtypen er endret siden første versjon, derfor «drop» først.
drop function if exists public.kurs_deltakere(uuid);
create function public.kurs_deltakere(k uuid)
  returns table (student uuid, epost text, navn text, pameldt timestamptz, svar int, sist_aktiv timestamptz,
                 forstaelse numeric, presisjon numeric, hurtighet numeric)
  language sql stable security definer set search_path = public, auth as
$$
  select d.student, u.email::text, coalesce((select p.navn from profiler p where p.id = d.student), ''), d.pameldt, count(x.id)::int, max(x.opprettet),
         round(sum(case when x.eff <> 'begrep' then x.w else 0 end) / nullif(sum(x.w), 0), 3),
         round(count(x.id) filter (where x.eff = 'riktig')::numeric / nullif(count(x.id) filter (where x.eff <> 'begrep'), 0), 3),
         round(count(x.id) filter (where x.eff = 'riktig' and x.tid_s <= x.forventet_s)::numeric / nullif(count(x.id) filter (where x.eff = 'riktig'), 0), 3)
    from kurs_deltaker d join kurs c on c.id = d.kurs join auth.users u on u.id = d.student
    left join (select a.*, case when a.ki ->> 'vurdering' in ('riktig', 'regnefeil', 'begrep') then a.ki ->> 'vurdering' else a.type end eff,
                      case a.vanskelighet when 'lett' then 1 when 'middels' then 1.5 else 2 end w
                 from studie_svar a) x on x.eier = d.student
   where d.kurs = k and c.eier = auth.uid() and c.krev_innsyn and d.samtykke_innsyn
   group by d.student, u.email, d.pameldt
   order by u.email
$$;

revoke execute on function public.min_rolle(), public.er_admin(), public.er_underviser(), public.bli_underviser(text),
  public.admin_undervisere(), public.sett_student(uuid), public.kurs_deltakere(uuid), public.ny_bruker() from public, anon;
grant execute on function public.min_rolle(), public.er_admin(), public.er_underviser(), public.bli_underviser(text),
  public.admin_undervisere(), public.sett_student(uuid), public.kurs_deltakere(uuid) to authenticated;
grant execute on function public.sjekk_underviserkode(text) to anon, authenticated;

-- Fag (tabellen kurs): underviseren velger temaene i rekkefølge. De blir studentenes løype når de melder seg på.
alter table public.kurs add column if not exists temaer jsonb not null default '[]'::jsonb;
alter table public.kurs add column if not exists beskrivelse text not null default '' check (char_length(beskrivelse) <= 2000);

-- Statistikk per tema og undertema for et fag: hva studentene har forstått. Bare med minst 5 studenter per rad.
create or replace function public.kurs_statistikk(k uuid)
  returns table (nettsted text, tema text, undertema text, studenter int, svar int, forstaelse numeric, presisjon numeric, hurtighet numeric)
  language sql stable security definer set search_path = public as
$$
  with deltakere as (select d.student from kurs_deltaker d join kurs c on c.id = d.kurs where d.kurs = k and c.eier = auth.uid()),
  x as (select a.*, case when a.ki ->> 'vurdering' in ('riktig', 'regnefeil', 'begrep') then a.ki ->> 'vurdering' else a.type end eff,
               case a.vanskelighet when 'lett' then 1 when 'middels' then 1.5 else 2 end w
          from studie_svar a join deltakere d on d.student = a.eier)
  select x.nettsted, x.tema, x.undertema, count(distinct x.eier)::int, count(*)::int,
         case when count(distinct x.eier) >= 5 then round(sum(case when eff <> 'begrep' then w else 0 end) / sum(w), 3) end,
         case when count(distinct x.eier) >= 5 then round(count(*) filter (where eff = 'riktig')::numeric / nullif(count(*) filter (where eff <> 'begrep'), 0), 3) end,
         case when count(distinct x.eier) >= 5 then round(count(*) filter (where eff = 'riktig' and tid_s <= forventet_s)::numeric / nullif(count(*) filter (where eff = 'riktig'), 0), 3) end
    from x group by 1, 2, 3
$$;
revoke execute on function public.kurs_statistikk(uuid) from public, anon;
grant execute on function public.kurs_statistikk(uuid) to authenticated;

-- =====================================================================
-- Obligatoriske øvinger i et fag: «ta quiz i tema X og få minst «krav» av «antall» riktige», eventuelt innen en frist.
-- Hver fullførte quiz lagres i studie_quiz. En øving er godkjent når studenten har en quiz for øvingen som oppfyller kravet
-- innen fristen. Faglærer ser godkjenningen for alle påmeldte (det står i påmeldingen), uavhengig av innsyn i profilen.
-- =====================================================================
create table if not exists public.ovelser (
  id        uuid primary key default gen_random_uuid(),
  kurs      uuid not null references public.kurs (id) on delete cascade,
  tittel    text not null check (char_length(tittel) between 1 and 120),
  tema      text not null check (char_length(tema) <= 120),          -- «nettsted/tema»
  antall    smallint not null default 6 check (antall between 1 and 20),
  krav      smallint not null check (krav >= 1),
  frist     timestamptz,
  opprettet timestamptz not null default now(),
  check (krav <= antall)
);
create table if not exists public.studie_quiz (
  id       bigint generated always as identity primary key,
  eier     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nettsted text not null default 'fysikkhjelp',
  tema     text not null check (char_length(tema) <= 80),
  ovelse   uuid references public.ovelser (id) on delete set null,
  antall   smallint not null check (antall between 1 and 30),
  riktige  smallint not null check (riktige between 0 and antall),
  fullfort timestamptz not null default now()
);
create index if not exists studie_quiz_eier on public.studie_quiz (eier, ovelse);

alter table public.ovelser     enable row level security;
alter table public.studie_quiz enable row level security;
drop policy if exists "ovelser: lese"  on public.ovelser;
drop policy if exists "ovelser: eier" on public.ovelser;
create policy "ovelser: lese" on public.ovelser for select to authenticated using (public.er_kurseier(kurs) or public.er_deltaker(kurs));
create policy "ovelser: eier" on public.ovelser for all to authenticated using (public.er_kurseier(kurs)) with check (public.er_kurseier(kurs));
-- Quizresultater: studenten lager og leser sine egne. De kan ikke endres i ettertid. Tidspunktet settes av databasen.
drop policy if exists "studie_quiz: lese" on public.studie_quiz;
drop policy if exists "studie_quiz: lage" on public.studie_quiz;
create policy "studie_quiz: lese" on public.studie_quiz for select to authenticated using (eier = auth.uid() or public.har_innsyn(eier));
create policy "studie_quiz: lage" on public.studie_quiz for insert to authenticated with check (eier = auth.uid());
create or replace function public.studie_quiz_tid() returns trigger language plpgsql as $$ begin new.fullfort := now(); return new; end $$;
drop trigger if exists studie_quiz_tid on public.studie_quiz;
create trigger studie_quiz_tid before insert on public.studie_quiz for each row execute function public.studie_quiz_tid();
grant select, insert, update, delete on public.ovelser to authenticated;
grant select, insert on public.studie_quiz to authenticated;
revoke all on public.ovelser, public.studie_quiz from anon;

-- Arbeidskrav (fagbyggeren steg 2): et arbeidskrav kan avgrenses til enkelte undertemaer, bruke spørsmålsbanken
-- eller fagets egne spørsmål (laget av underviseren eller KI), og kreve at studenten forklarer svaret skriftlig/muntlig.
-- sporsmal: [{"tekst":"…","riktig":"…","feil":[{"svar":"…","type":"regnefeil|begrep"}],"forklaring":"…","undertema":"…","vanskelighet":"middels"}]
-- NB: Svarene sjekkes i nettleseren (som for spørsmålsbanken), så fasiten er ikke hemmelig for en teknisk flink student.
alter table public.ovelser add column if not exists undertemaer text[] not null default '{}' check (cardinality(undertemaer) <= 20);
alter table public.ovelser add column if not exists kilde text not null default 'bank' check (kilde in ('bank', 'egne'));
alter table public.ovelser add column if not exists sporsmal jsonb not null default '[]'::jsonb check (jsonb_typeof(sporsmal) = 'array' and pg_column_size(sporsmal) < 60000);
alter table public.ovelser add column if not exists svarform text not null default 'valgfri' check (svarform in ('valgfri', 'skriftlig', 'muntlig', 'begge'));
-- svarform 'bilde' = studenten må laste opp bilde av utregningen (standard for nye arbeidskrav).
alter table public.ovelser drop constraint if exists ovelser_svarform_check;
alter table public.ovelser add constraint ovelser_svarform_check check (svarform in ('valgfri', 'skriftlig', 'muntlig', 'begge', 'bilde'));
alter table public.ovelser alter column svarform set default 'bilde';
-- Et arbeidskrav kan dekke undertemaer fra flere temaer og moduler («nettsted/tema/undertema»). tema = det første temaet.
alter table public.ovelser drop constraint if exists ovelser_undertemaer_check;
alter table public.ovelser add constraint ovelser_undertemaer_check check (cardinality(undertemaer) <= 100);

-- Notater i fagbyggeren som bare underviseren (fageieren) ser, per modul: {"<modul-id>": "tekst"}.
-- Ligger i egen tabell fordi studentene kan lese selve fagraden (moduler og beskjeder).
create table if not exists public.kurs_notat (
  kurs     uuid primary key references public.kurs (id) on delete cascade,
  notater  jsonb not null default '{}'::jsonb check (jsonb_typeof(notater) = 'object' and pg_column_size(notater) < 100000),
  endret   timestamptz not null default now()
);
alter table public.kurs_notat enable row level security;
drop policy if exists "kurs_notat: eier" on public.kurs_notat;
create policy "kurs_notat: eier" on public.kurs_notat for all to authenticated using (public.er_kurseier(kurs)) with check (public.er_kurseier(kurs));
grant select, insert, update, delete on public.kurs_notat to authenticated;
revoke all on public.kurs_notat from anon;
-- Et egendefinert spørsmål kan ha varierende tall: "variabler":[{"navn":"m","min":1,"maks":5,"steg":0.5}], "svar":"m*a" (uttrykk),
-- "enhet":"N", og gale svar som uttrykk ("uttrykk":"m+a"). Hver student får egne tall, og ett spørsmål = én oppgave (aldri to like).
alter table public.ovelser add column if not exists beskrivelse text not null default '' check (char_length(beskrivelse) <= 2000);

-- Godkjenning for alle påmeldte i et fag (bare for faglærer): én rad per student og øving.
-- Returtypen har fått navn, derfor «drop» først.
drop function if exists public.kurs_godkjenning(uuid);
create function public.kurs_godkjenning(k uuid)
  returns table (student uuid, epost text, navn text, ovelse uuid, godkjent boolean, beste int, forsok int)
  language sql stable security definer set search_path = public, auth as
$$
  select d.student, u.email::text, coalesce((select p.navn from profiler p where p.id = d.student), ''), o.id,
         coalesce(bool_or(q.riktige >= o.krav and (o.frist is null or q.fullfort <= o.frist)), false),
         max(q.riktige)::int, count(q.id)::int
    from kurs c join kurs_deltaker d on d.kurs = c.id join auth.users u on u.id = d.student
    join ovelser o on o.kurs = c.id
    left join studie_quiz q on q.eier = d.student and q.ovelse = o.id
   where c.id = k and c.eier = auth.uid()
   group by d.student, u.email, o.id
   order by u.email
$$;
revoke execute on function public.kurs_godkjenning(uuid) from public, anon;
grant execute on function public.kurs_godkjenning(uuid) to authenticated;

-- =====================================================================
-- Fagbyggeren: et fag kan lagres som utkast («påbegynt») og publiseres. Studenter finner bare publiserte fag.
-- ramme:     {"uker":14,"form":"forelesninger|omvendt|ingen","samlinger":2,"lengde":90,"startuke":34}
-- elementer: {"moduler":true,"arbeidskrav":true,"samlinger":true,"tidslinje":true}
-- moduler:   [{"navn":"Bevegelse","uker":[{"undertemaer":["fysikkhjelp/kinematikk/konstant-akselerasjon"],"notat":""}]}]
-- =====================================================================
alter table public.kurs add column if not exists status text not null default 'publisert' check (status in ('pabegynt', 'publisert'));
alter table public.kurs add column if not exists emnebeskrivelse text not null default '' check (char_length(emnebeskrivelse) <= 20000);
alter table public.kurs add column if not exists laringsutbytte text not null default '' check (char_length(laringsutbytte) <= 5000);
alter table public.kurs add column if not exists ramme jsonb not null default '{}'::jsonb check (pg_column_size(ramme) < 4000);
alter table public.kurs add column if not exists elementer jsonb not null default '{}'::jsonb check (pg_column_size(elementer) < 2000);
alter table public.kurs add column if not exists moduler jsonb not null default '[]'::jsonb check (pg_column_size(moduler) < 200000);
alter table public.kurs add column if not exists endret timestamptz not null default now();

create or replace function public.finn_kurs(k text)
  returns table (id uuid, navn text, krev_innsyn boolean)
  language sql stable security definer set search_path = public as
  $$ select id, navn, krev_innsyn from kurs where kode = upper(trim(k)) and status = 'publisert' $$;

-- Påmeldte studenter ser ikke utkastet: kurs: lese gjelder deltakere bare for publiserte fag.
drop policy if exists "kurs: lese" on public.kurs;
create policy "kurs: lese" on public.kurs for select to authenticated
  using (eier = auth.uid() or (status = 'publisert' and public.er_deltaker(id)));

-- =====================================================================
-- Forespørsel om underviser-tilgang uten kode. Brukeren er student til administratoren godkjenner.
-- foresporsel: null (ingen), 'venter' eller 'avslatt'. Settes ved registrering (metadata «be_om_underviser») eller på Min side.
-- =====================================================================
alter table public.profiler add column if not exists foresporsel text check (foresporsel in ('venter', 'avslatt'));
alter table public.profiler add column if not exists foresporsel_tekst text not null default '' check (char_length(foresporsel_tekst) <= 500);
alter table public.profiler add column if not exists foresporsel_tid timestamptz;

create or replace function public.ny_bruker() returns trigger
  language plpgsql security definer set search_path = public as
$$
declare k text := upper(trim(coalesce(new.raw_user_meta_data ->> 'underviserkode', '')));
begin
  insert into profiler (id, navn) values (new.id, left(trim(coalesce(new.raw_user_meta_data ->> 'navn', '')), 80)) on conflict (id) do nothing;
  if k <> '' then
    update underviserkoder set brukt_av = new.id, brukt = now() where kode = k and brukt_av is null;
    if found then update profiler set rolle = 'underviser' where id = new.id; return new; end if;
  end if;
  if coalesce(new.raw_user_meta_data ->> 'be_om_underviser', '') = 'true' then
    update profiler set foresporsel = 'venter', foresporsel_tid = now(),
      foresporsel_tekst = left(coalesce(new.raw_user_meta_data ->> 'underviser_info', ''), 500) where id = new.id;
  end if;
  return new;
end $$;

-- Be om tilgang senere (fra Min side).
create or replace function public.be_om_underviser(tekst text) returns boolean
  language plpgsql security definer set search_path = public as
$$
begin
  if auth.uid() is null then return false; end if;
  insert into profiler (id) values (auth.uid()) on conflict (id) do nothing;
  update profiler set foresporsel = 'venter', foresporsel_tid = now(), foresporsel_tekst = left(coalesce(tekst, ''), 500)
   where id = auth.uid() and rolle = 'student';
  return found;
end $$;

-- Administrator: ventende forespørsler, godkjenn eller avslå.
create or replace function public.admin_foresporsler()
  returns table (id uuid, epost text, tekst text, tid timestamptz)
  language sql stable security definer set search_path = public, auth as
  $$ select p.id, u.email::text, p.foresporsel_tekst, p.foresporsel_tid from profiler p join auth.users u on u.id = p.id
      where public.er_admin() and p.foresporsel = 'venter' order by p.foresporsel_tid $$;
create or replace function public.svar_foresporsel(b uuid, godkjenn boolean) returns boolean
  language plpgsql security definer set search_path = public as
$$
begin
  if not public.er_admin() then return false; end if;
  update profiler set rolle = case when godkjenn and rolle = 'student' then 'underviser' else rolle end,
                      foresporsel = case when godkjenn then null else 'avslatt' end
   where id = b and foresporsel = 'venter';
  return found;
end $$;

revoke execute on function public.be_om_underviser(text), public.admin_foresporsler(), public.svar_foresporsel(uuid, boolean) from public, anon;
grant execute on function public.be_om_underviser(text), public.admin_foresporsler(), public.svar_foresporsel(uuid, boolean) to authenticated;

-- ============================================================================================================
-- Brukernavn (valgfritt) og innlogging med brukernavn
-- Supabase logger bare inn med e-post. Har brukeren valgt et brukernavn, slår epost_for_innlogging opp e-posten
-- bak brukernavnet, men BARE når passordet er riktig (sjekkes mot passordhashen), så ingen kan finne andres e-post.
-- Klienten logger deretter inn som vanlig med e-post og passord. Gjentatte feil sperres (10 forsøk per 15 min).
-- ============================================================================================================
alter table public.profiler add column if not exists brukernavn text check (brukernavn ~ '^[a-z0-9._-]{3,30}$');
create unique index if not exists profiler_brukernavn on public.profiler (brukernavn);

create table if not exists public.innlogging_forsok (
  brukernavn text not null,
  tid        timestamptz not null default now()
);
create index if not exists innlogging_forsok_idx on public.innlogging_forsok (brukernavn, tid);
alter table public.innlogging_forsok enable row level security;   -- ingen regler: bare funksjonene under kommer til
revoke all on public.innlogging_forsok from anon, authenticated;

create or replace function public.sett_brukernavn(b text) returns text
  language plpgsql security definer set search_path = public as
$$
declare n text := nullif(lower(trim(coalesce(b, ''))), '');
begin
  if auth.uid() is null then return 'Du må være logget inn.'; end if;
  if n is not null and n !~ '^[a-z0-9._-]{3,30}$' then return 'Brukernavnet må ha 3–30 tegn: små bokstaver a–z, tall, punktum, bindestrek eller understrek.'; end if;
  if n is not null and exists (select 1 from profiler where brukernavn = n and id <> auth.uid()) then return 'Brukernavnet er opptatt.'; end if;
  insert into profiler (id, brukernavn) values (auth.uid(), n) on conflict (id) do update set brukernavn = n;
  return 'ok';
end $$;
revoke execute on function public.sett_brukernavn(text) from public, anon;
grant execute on function public.sett_brukernavn(text) to authenticated;

create or replace function public.epost_for_innlogging(b text, p text) returns text
  language plpgsql security definer set search_path = public, auth, extensions as
$$
declare n text := lower(trim(coalesce(b, ''))); e text; h text;
begin
  if n = '' or coalesce(p, '') = '' then return null; end if;
  delete from innlogging_forsok where tid < now() - interval '1 day';
  if (select count(*) from innlogging_forsok where brukernavn = n and tid > now() - interval '15 minutes') >= 10 then
    raise exception 'For mange forsøk. Vent et kvarter og prøv igjen.';
  end if;
  select u.email, u.encrypted_password into e, h from profiler pr join auth.users u on u.id = pr.id where pr.brukernavn = n;
  if h is not null and h = crypt(p, h) then return e; end if;
  insert into innlogging_forsok (brukernavn) values (n);
  return null;
end $$;
revoke execute on function public.epost_for_innlogging(text, text) from public;
grant execute on function public.epost_for_innlogging(text, text) to anon, authenticated;

-- ============================================================================================================
-- Tilbakemeldinger fra chatten nederst til høyre på alle sider (feil og forslag)
-- Alle kan sende (også uten å være logget inn). Bare administratorer kan lese og endre status.
-- ============================================================================================================
create table if not exists public.tilbakemeldinger (
  id        bigserial primary key,
  tid       timestamptz not null default now(),
  nettsted  text not null default '' check (char_length(nettsted) <= 40),
  side      text not null default '' check (char_length(side) <= 300),
  tekst     text not null check (char_length(tekst) between 2 and 2000),
  epost     text check (epost is null or char_length(epost) <= 200),
  bruker    uuid default auth.uid(),
  status    text not null default 'ny' check (status in ('ny', 'lest', 'fikset'))
);
alter table public.tilbakemeldinger enable row level security;
drop policy if exists "tilbakemeldinger: alle kan sende" on public.tilbakemeldinger;
create policy "tilbakemeldinger: alle kan sende" on public.tilbakemeldinger for insert to anon, authenticated
  with check (status = 'ny' and (bruker is null or bruker = auth.uid()));
drop policy if exists "tilbakemeldinger: admin leser" on public.tilbakemeldinger;
create policy "tilbakemeldinger: admin leser" on public.tilbakemeldinger for select to authenticated using (public.er_admin());
drop policy if exists "tilbakemeldinger: admin endrer" on public.tilbakemeldinger;
create policy "tilbakemeldinger: admin endrer" on public.tilbakemeldinger for update to authenticated using (public.er_admin()) with check (public.er_admin());
grant insert on public.tilbakemeldinger to anon, authenticated;
grant select, update on public.tilbakemeldinger to authenticated;
grant usage on sequence public.tilbakemeldinger_id_seq to anon, authenticated;
-- Skjermbilde (valgfritt): lagres bare når den som sender, har godkjent det for akkurat denne meldingen. En melding med
-- bilde sendes uten bruker (knyttes ikke til profilen). Bildet slettes når meldingen settes til «fikset».
alter table public.tilbakemeldinger add column if not exists bilde text check (bilde is null or char_length(bilde) <= 1500000);
create or replace function public.tilbakemelding_rydd_bilde() returns trigger language plpgsql as $$
begin
  if new.status = 'fikset' then new.bilde := null; end if;
  return new;
end $$;
drop trigger if exists tilbakemelding_rydd_bilde on public.tilbakemeldinger;
create trigger tilbakemelding_rydd_bilde before update on public.tilbakemeldinger for each row execute function public.tilbakemelding_rydd_bilde();
drop policy if exists "tilbakemeldinger: alle kan sende" on public.tilbakemeldinger;
create policy "tilbakemeldinger: alle kan sende" on public.tilbakemeldinger for insert to anon, authenticated
  with check (status = 'ny' and (bruker is null or bruker = auth.uid()) and (bilde is null or (bruker is null and bilde like 'data:image/%')));

-- ============================================================================================================
-- Mitt materiale: plan for dagen og slides per samling i et fag (fagbyggeren og undervisningsmodus)
-- Én rad per samling, med nøkkel «modul-id/uke-id/samling». Bare fageieren kan lese og skrive.
-- ============================================================================================================
create table if not exists public.kurs_materiale (
  kurs    uuid not null references public.kurs (id) on delete cascade,
  nokkel  text not null check (char_length(nokkel) between 1 and 60),
  tittel  text not null default '' check (char_length(tittel) <= 200),
  plan    jsonb not null default '[]'::jsonb check (jsonb_typeof(plan) = 'array' and pg_column_size(plan) < 50000),
  slides  jsonb not null default '[]'::jsonb check (jsonb_typeof(slides) = 'array' and pg_column_size(slides) < 400000),
  endret  timestamptz not null default now(),
  primary key (kurs, nokkel)
);
alter table public.kurs_materiale enable row level security;
drop policy if exists "kurs_materiale: eier" on public.kurs_materiale;
create policy "kurs_materiale: eier" on public.kurs_materiale for all to authenticated using (public.er_kurseier(kurs)) with check (public.er_kurseier(kurs));
grant select, insert, update, delete on public.kurs_materiale to authenticated;
revoke all on public.kurs_materiale from anon;

-- ============================================================================================================
-- Dashman – KI-læringspartneren (hint-tjener/worker.js, /dashman; instruksen står i hint-tjener/dashman-instruks.md)
-- Studentens nivå og mål ligger i profilen. Dashman kan holde et kort, faglig notat om studentens utvikling, som
-- studenten selv kan se og slette. Samtalene lagres ikke.
-- Faglæreren bestemmer Dashman-fasen i faget sitt (0 = av, 1 oppstart, 2 øving, 3 formativ vurdering, 4 selvstendighet)
-- og kan gi egne instrukser.
-- ============================================================================================================
alter table public.profiler add column if not exists niva text check (niva is null or niva in ('forkurs', 'ingenior', 'fordypning'));
alter table public.profiler add column if not exists mal text not null default '' check (char_length(mal) <= 300);
alter table public.profiler add column if not exists dashman_notat text not null default '' check (char_length(dashman_notat) <= 800);
alter table public.kurs add column if not exists dashman_fase smallint not null default 2 check (dashman_fase between 0 and 4);
alter table public.kurs add column if not exists dashman_instruks text not null default '' check (char_length(dashman_instruks) <= 2000);

-- Studenten setter nivå og mål selv (null = ikke endre).
create or replace function public.sett_studentprofil(n text, m text) returns boolean
  language plpgsql security definer set search_path = public as
$$
begin
  if auth.uid() is null then return false; end if;
  if n is not null and n not in ('forkurs', 'ingenior', 'fordypning', '') then return false; end if;
  insert into profiler (id) values (auth.uid()) on conflict (id) do nothing;
  update profiler set niva = case when n is null then niva when n = '' then null else n end,
                      mal  = case when m is null then mal else left(trim(m), 300) end
   where id = auth.uid();
  return true;
end $$;
revoke execute on function public.sett_studentprofil(text, text) from public, anon;
grant execute on function public.sett_studentprofil(text, text) to authenticated;

-- Dashman skriver notatet (via KI-tjeneren, med studentens egen innlogging). Tom tekst sletter det.
create or replace function public.sett_dashman_notat(t text) returns boolean
  language plpgsql security definer set search_path = public as
$$
begin
  if auth.uid() is null then return false; end if;
  insert into profiler (id) values (auth.uid()) on conflict (id) do nothing;
  update profiler set dashman_notat = left(trim(coalesce(t, '')), 800) where id = auth.uid();
  return true;
end $$;
revoke execute on function public.sett_dashman_notat(text) from public, anon;
grant execute on function public.sett_dashman_notat(text) to authenticated;

-- Alt Dashman får vite om studenten: nivå, mål, notat, kunnskapsprofil (egne svar) og fagene hen er påmeldt.
-- Ingen navn, e-post eller id. Kalles av KI-tjeneren med studentens innlogging, så den ser bare studentens egne data.
create or replace function public.dashman_kontekst() returns jsonb
  language sql stable security definer set search_path = public as
$$
  select case when auth.uid() is null then null else jsonb_build_object(
    'niva',  (select niva from profiler where id = auth.uid()),
    'mal',   coalesce((select mal from profiler where id = auth.uid()), ''),
    'notat', coalesce((select dashman_notat from profiler where id = auth.uid()), ''),
    'kunnskap', coalesce((
      select jsonb_agg(r order by r ->> 'sist' desc) from (
        select jsonb_build_object('tema', tema, 'undertema', undertema, 'svar', count(*),
                 'forstaelse', round(sum(case when eff <> 'begrep' then w else 0 end) / sum(w), 2),
                 'presisjon', round(count(*) filter (where eff = 'riktig')::numeric / nullif(count(*) filter (where eff <> 'begrep'), 0), 2),
                 'sist', max(opprettet)::date) r
          from (select a.*, case when a.ki ->> 'vurdering' in ('riktig', 'regnefeil', 'begrep') then a.ki ->> 'vurdering' else a.type end eff,
                       case a.vanskelighet when 'lett' then 1 when 'middels' then 1.5 else 2 end w
                  from studie_svar a where a.eier = auth.uid()) x
         group by tema, undertema
         order by max(opprettet) desc limit 40) y), '[]'::jsonb),
    'fag', coalesce((
      select jsonb_agg(jsonb_build_object('navn', c.navn, 'fase', c.dashman_fase, 'instruks', c.dashman_instruks,
                                         'beskrivelse', left(c.beskrivelse, 600), 'pameldt', d.pameldt::date) order by d.pameldt desc)
        from kurs_deltaker d join kurs c on c.id = d.kurs where d.student = auth.uid()), '[]'::jsonb)
  ) end
$$;
revoke execute on function public.dashman_kontekst() from public, anon;
grant execute on function public.dashman_kontekst() to authenticated;

-- ============================================================================================================
-- Delta på undervisning: mens underviseren har åpnet for innspill (kurs.undervises_til), ser påmeldte studenter
-- knappen «Delta på undervisning» og kan sende spørsmål, ønsker og tempo-signaler. Underviseren ser dem uten navn.
-- Ukas innsikt: samletall per spørsmål for ukas undertemaer (bare spørsmål med minst 3 studenter), med det vanligste
-- feilsvaret, så underviseren ser hva klassen strever med.
-- ============================================================================================================
alter table public.kurs add column if not exists undervises_til timestamptz;
alter table public.studie_svar add column if not exists valgt text check (valgt is null or char_length(valgt) <= 300);

create table if not exists public.kurs_innspill (
  id       bigint generated always as identity primary key,
  kurs     uuid not null references public.kurs (id) on delete cascade,
  student  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type     text not null default 'sporsmal' check (type in ('sporsmal', 'onske', 'saktere', 'eksempel', 'forstar', 'forstar_ikke')),
  tekst    text not null default '' check (char_length(tekst) <= 500),
  besvart  boolean not null default false,
  laget    timestamptz not null default now()
);
create index if not exists kurs_innspill_kurs on public.kurs_innspill (kurs, laget);

-- Studenten kan sende innspill bare når hen er påmeldt, undervisningen er åpen, og høyst 30 i timen.
create or replace function public.kan_sende_innspill(k uuid) returns boolean
  language sql stable security definer set search_path = public as
$$
  select public.er_deltaker(k)
     and exists (select 1 from kurs where id = k and undervises_til > now())
     and (select count(*) from kurs_innspill where kurs = k and student = auth.uid() and laget > now() - interval '1 hour') < 30
$$;
alter table public.kurs_innspill enable row level security;
drop policy if exists "kurs_innspill: lese egne"  on public.kurs_innspill;
drop policy if exists "kurs_innspill: sende"      on public.kurs_innspill;
drop policy if exists "kurs_innspill: slette egne" on public.kurs_innspill;
create policy "kurs_innspill: lese egne"   on public.kurs_innspill for select to authenticated using (student = auth.uid());
create policy "kurs_innspill: sende"       on public.kurs_innspill for insert to authenticated with check (student = auth.uid() and public.kan_sende_innspill(kurs));
create policy "kurs_innspill: slette egne" on public.kurs_innspill for delete to authenticated using (student = auth.uid());
grant select, insert, delete on public.kurs_innspill to authenticated;
revoke all on public.kurs_innspill from anon;
create or replace function public.kurs_innspill_tid() returns trigger language plpgsql as $$ begin new.laget := now(); new.besvart := false; return new; end $$;
drop trigger if exists kurs_innspill_tid on public.kurs_innspill;
create trigger kurs_innspill_tid before insert on public.kurs_innspill for each row execute function public.kurs_innspill_tid();

-- Underviseren leser innspillene i kurset sitt uten navn, og kan merke dem som besvart.
create or replace function public.kurs_innspill_liste(k uuid, siden timestamptz)
  returns table (id bigint, type text, tekst text, besvart boolean, laget timestamptz)
  language sql stable security definer set search_path = public as
$$ select i.id, i.type, i.tekst, i.besvart, i.laget from kurs_innspill i
    where i.kurs = k and public.er_kurseier(k) and i.laget >= siden order by i.laget $$;
create or replace function public.kurs_innspill_besvart(i bigint, b boolean) returns boolean
  language sql security definer set search_path = public as
$$ update kurs_innspill set besvart = b where id = i and public.er_kurseier(kurs) returning true $$;
revoke execute on function public.kan_sende_innspill(uuid), public.kurs_innspill_liste(uuid, timestamptz), public.kurs_innspill_besvart(bigint, boolean) from public, anon;
grant execute on function public.kan_sende_innspill(uuid), public.kurs_innspill_liste(uuid, timestamptz), public.kurs_innspill_besvart(bigint, boolean) to authenticated;

-- Ukas innsikt: deler = undertemaer som «nettsted/tema/undertema». Bare samletall, og bare for spørsmål der minst
-- 3 studenter har svart. KI-tilbakemeldingene på begrepsfeil tas med (uten navn) så KI kan finne misforståelser.
create or replace function public.kurs_innsikt(k uuid, deler text[], siden timestamptz)
  returns table (sporsmal text, nettsted text, tema text, undertema text, studenter int, svar int, riktige int, regnefeil int, begrep int,
                 feilsvar jsonb, tilbakemeldinger jsonb)
  language sql stable security definer set search_path = public as
$$
  with deltakere as (select d.student from kurs_deltaker d join kurs c on c.id = d.kurs where d.kurs = k and c.eier = auth.uid()),
  x as (select a.* from studie_svar a join deltakere d on d.student = a.eier
         where a.opprettet >= siden and (a.nettsted || '/' || a.tema || '/' || a.undertema) = any (deler))
  select x.sporsmal, min(x.nettsted), min(x.tema), min(x.undertema), count(distinct x.eier)::int, count(*)::int,
         count(*) filter (where x.type = 'riktig')::int, count(*) filter (where x.type = 'regnefeil')::int, count(*) filter (where x.type = 'begrep')::int,
         coalesce((select jsonb_agg(jsonb_build_object('svar', f.valgt, 'antall', f.n) order by f.n desc)
                     from (select y.valgt, count(*) n from x y where y.sporsmal = x.sporsmal and y.type <> 'riktig' and y.valgt is not null
                            group by y.valgt order by count(*) desc limit 3) f), '[]'::jsonb),
         coalesce((select jsonb_agg(t.tb) from (select y.ki ->> 'tilbakemelding' tb from x y
                     where y.sporsmal = x.sporsmal and y.ki ->> 'vurdering' = 'begrep' and y.ki ->> 'tilbakemelding' is not null limit 6) t), '[]'::jsonb)
    from x group by x.sporsmal having count(distinct x.eier) >= 3
$$;
revoke execute on function public.kurs_innsikt(uuid, text[], timestamptz) from public, anon;
grant execute on function public.kurs_innsikt(uuid, text[], timestamptz) to authenticated;

-- ============================================================================================================
-- Gjennomsyn: bilder av løsninger som KI ikke er sikker på er håndskrevet
-- KI vurderer om bildet er en håndskrevet løsning (ikke skjermdump, utskrift eller tekst fra en KI-chat).
-- Er KI usikker, spør appen studenten om bildet kan lagres for gjennomsyn av en lærer (og for å gjøre Dashman bedre).
-- Sier studenten nei, godkjennes ikke svaret. Bildet slettes når administratoren har tatt stilling til det.
-- Avviser administratoren, slettes quizforsøket (studie_quiz med samme «forsok»), så arbeidskravet ikke lenger er godkjent.
-- ============================================================================================================
alter table public.studie_quiz add column if not exists forsok uuid;
create table if not exists public.gjennomsyn (
  id        bigserial primary key,
  tid       timestamptz not null default now(),
  bruker    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nettsted  text not null default '' check (char_length(nettsted) <= 40),
  kilde     text not null default '' check (char_length(kilde) <= 200),    -- f.eks. «Arbeidskrav: Kollisjoner» eller «Skann»
  ovelse    uuid references public.ovelser (id) on delete set null,
  forsok    uuid,                                                          -- quizforsøket bildet hører til
  oppgave   text not null default '' check (char_length(oppgave) <= 3000),
  bilde     text check (bilde is null or char_length(bilde) <= 6000000),   -- JPEG som data-URL; slettes ved behandling
  ki        jsonb,
  status    text not null default 'venter' check (status in ('venter', 'godkjent', 'avvist')),
  kommentar text check (kommentar is null or char_length(kommentar) <= 1000),
  behandlet timestamptz
);
create index if not exists gjennomsyn_status on public.gjennomsyn (status, tid);
alter table public.gjennomsyn enable row level security;
drop policy if exists "gjennomsyn: student sender" on public.gjennomsyn;
create policy "gjennomsyn: student sender" on public.gjennomsyn for insert to authenticated
  with check (bruker = auth.uid() and status = 'venter' and behandlet is null and kommentar is null);
drop policy if exists "gjennomsyn: lese" on public.gjennomsyn;
create policy "gjennomsyn: lese" on public.gjennomsyn for select to authenticated using (bruker = auth.uid() or public.er_admin());
grant select, insert on public.gjennomsyn to authenticated;
grant usage on sequence public.gjennomsyn_id_seq to authenticated;

create or replace function public.behandle_gjennomsyn(g bigint, s text, kom text) returns boolean
  language plpgsql security definer set search_path = public as
$$
declare r gjennomsyn;
begin
  if not public.er_admin() or s not in ('godkjent', 'avvist') then return false; end if;
  update gjennomsyn set status = s, kommentar = nullif(left(coalesce(kom, ''), 1000), ''), behandlet = now(), bilde = null
    where id = g returning * into r;
  if r.id is null then return false; end if;
  if s = 'avvist' and r.forsok is not null then delete from studie_quiz where forsok = r.forsok and eier = r.bruker; end if;
  return true;
end
$$;
revoke execute on function public.behandle_gjennomsyn(bigint, text, text) from public, anon;
grant execute on function public.behandle_gjennomsyn(bigint, text, text) to authenticated;

-- =====================================================================
-- Åpne kurs (16. nov. 2026): underviseren kan gjøre et publisert kurs åpent. Åpne kurs vises i studieappen under
-- Kurs, og alle innloggede kan melde seg på uten kode (påmeldingen krever ikke kode fra før).
-- =====================================================================
alter table public.kurs add column if not exists apen boolean not null default false;
create or replace function public.apne_kurs()
  returns table (id uuid, navn text, beskrivelse text, krev_innsyn boolean, underviser text, temaer int)
  language sql stable security definer set search_path = public as
  $$ select k.id, k.navn, k.beskrivelse, k.krev_innsyn, coalesce(nullif(trim(p.navn), ''), ''), jsonb_array_length(k.temaer)
     from kurs k left join profiler p on p.id = k.eier
     where k.apen and k.status = 'publisert' order by k.navn $$;
revoke all on function public.apne_kurs() from public, anon;
grant execute on function public.apne_kurs() to authenticated;

-- =====================================================================
-- Push-varsler (16. nov. 2026). Studieappen lagrer telefonens push-abonnement her når studenten slår på varsler.
-- KI-tjeneren (hint-tjener/push.js) kaller push_jobb hvert kvarter med en hemmelighet (GitHub/Cloudflare:
-- PUSH_HEMMELIG; her står bare SHA-256 av den). push_jobb finner nye varsler, merker dem som sendt og gir
-- tilbake hvem de skal til. Varsler: nytt arbeidskrav, frist innen et døgn (bare til dem som ikke er godkjent),
-- ny beskjed fra faglæreren, og bilde som er sett gjennom av en lærer.
-- =====================================================================
create table if not exists public.push_abonnement (
  endpoint  text primary key check (char_length(endpoint) <= 1000),
  bruker    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  p256dh    text not null check (char_length(p256dh) <= 200),
  auth      text not null check (char_length(auth) <= 100),
  opprettet timestamptz not null default now()
);
alter table public.push_abonnement enable row level security;
drop policy if exists "push_abonnement: egne" on public.push_abonnement;
create policy "push_abonnement: egne" on public.push_abonnement for all to authenticated
  using (bruker = auth.uid()) with check (bruker = auth.uid());
grant select, insert, update, delete on public.push_abonnement to authenticated;

create table if not exists public.push_sendt (nokkel text primary key, tid timestamptz not null default now());
alter table public.push_sendt enable row level security;   -- ingen regler: bare funksjonene under kommer til

create or replace function public.push_jobb(h text) returns jsonb
  language plpgsql security definer set search_path = public as
$$
declare ut jsonb;
begin
  if encode(sha256(convert_to(coalesce(h, ''), 'UTF8')), 'hex') <> 'cc6df8546e2d5ec8b359c4675e6fa1c132ddd29066c3c65a0392e2ef1c0216ba' then raise exception 'ikke tillatt'; end if;
  delete from push_sendt where tid < now() - interval '30 days';
  with m as (
    -- nytt arbeidskrav i et publisert kurs
    select 'ny:' || o.id as nokkel, d.student as mottaker, 'Nytt arbeidskrav i ' || k.navn as tittel,
           o.tittel || coalesce(' · frist ' || to_char(o.frist at time zone 'Europe/Oslo', 'DD.MM. "kl." HH24:MI'), '') as tekst
      from ovelser o join kurs k on k.id = o.kurs and k.status = 'publisert' join kurs_deltaker d on d.kurs = o.kurs
     where o.opprettet > now() - interval '3 days'
    union all
    -- frist innen et døgn, bare til dem som ikke har klart kravet ennå
    select 'frist:' || o.id, d.student, 'Frist snart: ' || o.tittel,
           k.navn || ' · frist ' || to_char(o.frist at time zone 'Europe/Oslo', 'DD.MM. "kl." HH24:MI')
      from ovelser o join kurs k on k.id = o.kurs and k.status = 'publisert' join kurs_deltaker d on d.kurs = o.kurs
     where o.frist between now() and now() + interval '24 hours'
       and not exists (select 1 from studie_quiz q where q.ovelse = o.id and q.eier = d.student and q.riktige >= o.krav)
    union all
    -- ny beskjed fra faglæreren (ligger i modulene i kurset)
    select 'besk:' || k.id || ':' || (b ->> 'tid'), d.student, 'Beskjed i ' || k.navn, left(b ->> 'tekst', 160)
      from kurs k join kurs_deltaker d on d.kurs = k.id
           cross join lateral jsonb_array_elements(k.moduler) mod
           cross join lateral jsonb_array_elements(coalesce(mod -> 'beskjeder', '[]'::jsonb)) b
     where k.status = 'publisert' and k.endret > now() - interval '3 days'
       and coalesce(b ->> 'tid', '') <> '' and (b ->> 'tid')::timestamptz > now() - interval '3 days'
    union all
    -- bilde sett gjennom av en lærer
    select 'gjs:' || g.id, g.bruker, 'Bildet ditt er sett gjennom',
           'Bildet (' || g.kilde || ') er ' || case when g.status = 'godkjent' then 'godkjent.' else 'ikke godkjent.' end
      from gjennomsyn g where g.status in ('godkjent', 'avvist') and g.behandlet > now() - interval '3 days'
  ), nye as (
    insert into push_sendt (nokkel) select distinct nokkel from m on conflict do nothing returning nokkel
  )
  select coalesce(jsonb_agg(jsonb_build_object('endpoint', a.endpoint, 'p256dh', a.p256dh, 'auth', a.auth,
                                               'tittel', m.tittel, 'tekst', m.tekst, 'url', '/studie/index.html')), '[]'::jsonb)
    into ut
    from m join nye using (nokkel) join push_abonnement a on a.bruker = m.mottaker;
  return ut;
end $$;

create or replace function public.push_fjern(h text, e text) returns void
  language plpgsql security definer set search_path = public as
$$
begin
  if encode(sha256(convert_to(coalesce(h, ''), 'UTF8')), 'hex') <> 'cc6df8546e2d5ec8b359c4675e6fa1c132ddd29066c3c65a0392e2ef1c0216ba' then raise exception 'ikke tillatt'; end if;
  delete from push_abonnement where endpoint = e;
end $$;
revoke all on function public.push_jobb(text), public.push_fjern(text, text) from public;
grant execute on function public.push_jobb(text), public.push_fjern(text, text) to anon, authenticated;

-- Arbeidskrav (17. nov. 2026): rekkefølge på egne spørsmål. Standard er delkapitlenes rekkefølge (som i undervisningen);
-- tilfeldig = stokkes for hver student.
alter table public.ovelser add column if not exists tilfeldig boolean not null default false;

-- =====================================================================
-- Oppmøte med stikkprøver (17. nov. 2026). Underviseren starter oppmøte i undervisningsmodus. Tiden deles i perioder
-- (standard 10 min). I hver periode plukkes hver påmeldte student ut med sannsynlighet «andel» (standard 0.5), og må
-- skrive inn koden som står på tavla før perioden er slutt. Koden skifter hver periode. Oppmøtet = beståtte sjekker /
-- alle sjekker, summert over hele semesteret (det er totalen som teller). Utvalg og koder regnes ut av en hemmelighet
-- per økt, så verken utvalget eller koden kan leses fra databasen av studentene. Underviseren kan overstyre per økt.
-- =====================================================================
create table if not exists public.oppmote_okt (
  id          bigint generated always as identity primary key,
  kurs        uuid not null references public.kurs (id) on delete cascade,
  start       timestamptz not null default now(),
  slutt       timestamptz,
  periode_min int not null default 10 check (periode_min between 3 and 30),
  andel       real not null default 0.5 check (andel > 0 and andel <= 1),
  hemmelig    uuid not null default gen_random_uuid()
);
create index if not exists oppmote_okt_kurs on public.oppmote_okt (kurs, start);
create table if not exists public.oppmote_svar (
  okt     bigint not null references public.oppmote_okt (id) on delete cascade,
  student uuid not null references auth.users (id) on delete cascade,
  periode int not null,                         -- -1 = hele økta (overstyrt av underviseren)
  ok      boolean not null default false,
  forsok  int not null default 0,
  manuelt boolean not null default false,
  tid     timestamptz not null default now(),
  primary key (okt, student, periode)
);
alter table public.oppmote_okt enable row level security;    -- ingen regler: bare funksjonene under kommer til
alter table public.oppmote_svar enable row level security;
revoke all on public.oppmote_okt, public.oppmote_svar from anon, authenticated;

-- Slutten på en økt: satt slutt, ellers høyst 4 timer etter start.
create or replace function public.oppmote_slutt(o public.oppmote_okt) returns timestamptz
  language sql immutable as $$ select coalesce(o.slutt, o.start + interval '4 hours') $$;
create or replace function public.oppmote_tall(s text) returns double precision
  language sql immutable as $$ select (('x' || substr(md5(s), 1, 8))::bit(32)::bigint)::double precision / 4294967296.0 $$;
create or replace function public.oppmote_kode_for(o public.oppmote_okt, p int) returns int
  language sql immutable as $$ select 100 + floor(public.oppmote_tall(o.hemmelig::text || ':kode:' || p) * 900)::int $$;
create or replace function public.oppmote_plukket(o public.oppmote_okt, s uuid, p int) returns boolean
  language sql immutable as $$ select public.oppmote_tall(o.hemmelig::text || ':' || s::text || ':' || p) < o.andel $$;
-- Perioder som teller: ferdige perioder mens økta pågår; når den er slutt, også den siste hvis den varte minst 2 minutter.
create or replace function public.oppmote_perioder(o public.oppmote_okt) returns int
  language sql stable as $$
  select greatest(0, case when now() < public.oppmote_slutt(o)
    then floor(extract(epoch from (now() - o.start)) / (o.periode_min * 60))
    else ceil(extract(epoch from (public.oppmote_slutt(o) - interval '2 minutes' - o.start)) / (o.periode_min * 60)) end)::int $$;

-- Underviseren starter og stopper oppmøte.
create or replace function public.oppmote_start(k uuid, minutter int default 10) returns bigint
  language plpgsql security definer set search_path = public as
$$
declare ny bigint;
begin
  if not public.er_kurseier(k) then raise exception 'ikke tillatt'; end if;
  update oppmote_okt set slutt = now() where kurs = k and slutt is null;
  insert into oppmote_okt (kurs, periode_min) values (k, greatest(3, least(30, coalesce(minutter, 10)))) returning id into ny;
  return ny;
end $$;
create or replace function public.oppmote_stopp(k uuid) returns void
  language sql security definer set search_path = public as
$$ update oppmote_okt set slutt = now() where kurs = k and slutt is null and public.er_kurseier(k) $$;

-- Koden som vises på tavla (bare for underviseren).
create or replace function public.oppmote_kode(k uuid) returns jsonb
  language sql stable security definer set search_path = public as
$$
  select jsonb_build_object('okt', o.id, 'kode', public.oppmote_kode_for(o, p), 'periode', p,
           'slutter', o.start + make_interval(mins => (p + 1) * o.periode_min), 'start', o.start, 'periode_min', o.periode_min)
    from oppmote_okt o, lateral (select floor(extract(epoch from (now() - o.start)) / (o.periode_min * 60))::int as p) x
   where o.kurs = k and public.er_kurseier(k) and o.slutt is null and now() < public.oppmote_slutt(o)
   order by o.start desc limit 1
$$;

-- Studenten: er jeg plukket ut akkurat nå (i noen av kursene mine)?
create or replace function public.oppmote_mine() returns jsonb
  language sql stable security definer set search_path = public as
$$
  select coalesce(jsonb_agg(jsonb_build_object('kurs', o.kurs, 'navn', c.navn, 'okt', o.id, 'periode', x.p,
           'frist', o.start + make_interval(mins => (x.p + 1) * o.periode_min),
           'registrert', coalesce((select s.ok from oppmote_svar s where s.okt = o.id and s.student = auth.uid() and s.periode in (x.p, -1) and s.ok limit 1), false))), '[]'::jsonb)
    from oppmote_okt o join kurs c on c.id = o.kurs join kurs_deltaker d on d.kurs = o.kurs and d.student = auth.uid(),
         lateral (select floor(extract(epoch from (now() - o.start)) / (o.periode_min * 60))::int as p) x
   where o.slutt is null and now() < public.oppmote_slutt(o) and public.oppmote_plukket(o, auth.uid(), x.p)
$$;

-- Studenten skriver inn koden. Høyst 5 forsøk per periode.
create or replace function public.oppmote_registrer(o_id bigint, kode int) returns text
  language plpgsql security definer set search_path = public as
$$
declare o oppmote_okt; p int; f int;
begin
  select * into o from oppmote_okt where id = o_id;
  if o.id is null or o.slutt is not null or now() >= public.oppmote_slutt(o) then return 'Oppmøtet er avsluttet.'; end if;
  if not public.er_deltaker(o.kurs) then return 'Du er ikke med i kurset.'; end if;
  p := floor(extract(epoch from (now() - o.start)) / (o.periode_min * 60))::int;
  if not public.oppmote_plukket(o, auth.uid(), p) then return 'Du er ikke plukket ut akkurat nå.'; end if;
  insert into oppmote_svar (okt, student, periode) values (o.id, auth.uid(), p) on conflict do nothing;
  select forsok into f from oppmote_svar where okt = o.id and student = auth.uid() and periode = p;
  if exists (select 1 from oppmote_svar where okt = o.id and student = auth.uid() and periode = p and ok) then return 'ok'; end if;
  if f >= 5 then return 'For mange forsøk. Snakk med faglæreren.'; end if;
  if kode = public.oppmote_kode_for(o, p) then
    update oppmote_svar set ok = true, tid = now() where okt = o.id and student = auth.uid() and periode = p; return 'ok';
  end if;
  update oppmote_svar set forsok = forsok + 1 where okt = o.id and student = auth.uid() and periode = p;
  return 'Feil kode. Sjekk tallet på tavla.';
end $$;

-- Sjekkene i alle øktene i et kurs: én rad per (student, økt) med antall sjekker og beståtte.
create or replace function public.oppmote_rader(k uuid) returns table (student uuid, okt bigint, start timestamptz, sjekker int, bestatt int, overstyrt boolean)
  language sql stable security definer set search_path = public as
$$
  select d.student, o.id, o.start,
         -- Overstyrt økt teller som like mange sjekker som en student får i snitt (perioder × andel), alle bestått eller ikke.
         (case when ov.ok is not null then greatest(1, round(n.np * o.andel)) else coalesce(c.sj, 0) end)::int,
         (case when ov.ok then greatest(1, round(n.np * o.andel)) when ov.ok is not null then 0 else coalesce(c.be, 0) end)::int,
         ov.ok
    from oppmote_okt o
         join kurs_deltaker d on d.kurs = o.kurs
         cross join lateral (select public.oppmote_perioder(o) as np) n
         left join lateral (
           select count(*) filter (where q.pl) as sj, count(*) filter (where q.pl and s.ok) as be
             from generate_series(0, n.np - 1) p(p)
                  cross join lateral (select public.oppmote_plukket(o, d.student, p.p) as pl) q
                  left join oppmote_svar s on s.okt = o.id and s.student = d.student and s.periode = p.p) c on true
         left join oppmote_svar ov on ov.okt = o.id and ov.student = d.student and ov.periode = -1
   where o.kurs = k and (public.er_kurseier(k) or d.student = auth.uid())
$$;

-- Oversikt for underviseren: navn, e-post, sjekker og beståtte totalt, og økter overstyrt.
create or replace function public.oppmote_oversikt(k uuid)
  returns table (student uuid, navn text, epost text, sjekker int, bestatt int, okter jsonb)
  language sql stable security definer set search_path = public, auth as
$$
  select r.student, coalesce((select p.navn from profiler p where p.id = r.student), ''), (select u.email::text from auth.users u where u.id = r.student),
         sum(r.sjekker)::int, sum(r.bestatt)::int,
         jsonb_agg(jsonb_build_object('okt', r.okt, 'start', r.start, 'sjekker', r.sjekker, 'bestatt', r.bestatt, 'overstyrt', r.overstyrt) order by r.start)
    from public.oppmote_rader(k) r where public.er_kurseier(k)
   group by r.student
$$;
-- Studentens eget oppmøte i et kurs.
create or replace function public.oppmote_mitt(k uuid) returns jsonb
  language sql stable security definer set search_path = public as
$$ select jsonb_build_object('sjekker', coalesce(sum(sjekker), 0), 'bestatt', coalesce(sum(bestatt), 0), 'okter', count(*))
     from public.oppmote_rader(k) where student = auth.uid() $$;

-- Underviseren overstyrer en hel økt for en student: true = møtt, false = ikke møtt, null = fjern overstyringen.
create or replace function public.oppmote_overstyr(o_id bigint, s uuid, godkjent boolean) returns void
  language plpgsql security definer set search_path = public as
$$
begin
  if not exists (select 1 from oppmote_okt where id = o_id and public.er_kurseier(kurs)) then raise exception 'ikke tillatt'; end if;
  delete from oppmote_svar where okt = o_id and student = s and periode = -1;
  if godkjent is not null then insert into oppmote_svar (okt, student, periode, ok, manuelt) values (o_id, s, -1, godkjent, true); end if;
end $$;

-- Push-varsel når en student blir plukket ut (kalles hvert minutt av KI-tjeneren, samme hemmelighet som push_jobb).
create or replace function public.oppmote_push(h text) returns jsonb
  language plpgsql security definer set search_path = public as
$$
declare ut jsonb;
begin
  if encode(sha256(convert_to(coalesce(h, ''), 'UTF8')), 'hex') <> 'cc6df8546e2d5ec8b359c4675e6fa1c132ddd29066c3c65a0392e2ef1c0216ba' then raise exception 'ikke tillatt'; end if;
  with m as (
    select 'opm:' || o.id || ':' || x.p || ':' || d.student as nokkel, d.student as mottaker, 'Oppmøtesjekk i ' || c.navn as tittel,
           'Skriv inn koden fra tavla innen kl. ' || to_char((o.start + make_interval(mins => (x.p + 1) * o.periode_min)) at time zone 'Europe/Oslo', 'HH24:MI') || '.' as tekst
      from oppmote_okt o join kurs c on c.id = o.kurs join kurs_deltaker d on d.kurs = o.kurs,
           lateral (select floor(extract(epoch from (now() - o.start)) / (o.periode_min * 60))::int as p) x
     where o.slutt is null and now() < public.oppmote_slutt(o) and public.oppmote_plukket(o, d.student, x.p)
  ), nye as (
    insert into push_sendt (nokkel) select nokkel from m on conflict do nothing returning nokkel
  )
  select coalesce(jsonb_agg(jsonb_build_object('endpoint', a.endpoint, 'p256dh', a.p256dh, 'auth', a.auth,
                                               'tittel', m.tittel, 'tekst', m.tekst, 'url', '/studie/index.html')), '[]'::jsonb)
    into ut from m join nye using (nokkel) join push_abonnement a on a.bruker = m.mottaker;
  return ut;
end $$;

revoke execute on function public.oppmote_start(uuid, int), public.oppmote_stopp(uuid), public.oppmote_kode(uuid), public.oppmote_mine(),
  public.oppmote_registrer(bigint, int), public.oppmote_rader(uuid), public.oppmote_oversikt(uuid), public.oppmote_mitt(uuid),
  public.oppmote_overstyr(bigint, uuid, boolean) from public, anon;
grant execute on function public.oppmote_start(uuid, int), public.oppmote_stopp(uuid), public.oppmote_kode(uuid), public.oppmote_mine(),
  public.oppmote_registrer(bigint, int), public.oppmote_rader(uuid), public.oppmote_oversikt(uuid), public.oppmote_mitt(uuid),
  public.oppmote_overstyr(bigint, uuid, boolean) to authenticated;
revoke all on function public.oppmote_push(text) from public;
grant execute on function public.oppmote_push(text) to anon, authenticated;
