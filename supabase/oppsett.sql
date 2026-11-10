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
create or replace function public.ny_bruker() returns trigger
  language plpgsql security definer set search_path = public as
$$
declare k text := upper(trim(coalesce(new.raw_user_meta_data ->> 'underviserkode', '')));
begin
  insert into profiler (id) values (new.id) on conflict (id) do nothing;
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
  returns table (student uuid, epost text, pameldt timestamptz, svar int, sist_aktiv timestamptz,
                 forstaelse numeric, presisjon numeric, hurtighet numeric)
  language sql stable security definer set search_path = public, auth as
$$
  select d.student, u.email::text, d.pameldt, count(x.id)::int, max(x.opprettet),
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
-- Et egendefinert spørsmål kan ha varierende tall: "variabler":[{"navn":"m","min":1,"maks":5,"steg":0.5}], "svar":"m*a" (uttrykk),
-- "enhet":"N", og gale svar som uttrykk ("uttrykk":"m+a"). Hver student får egne tall, og ett spørsmål = én oppgave (aldri to like).
alter table public.ovelser add column if not exists beskrivelse text not null default '' check (char_length(beskrivelse) <= 2000);

-- Godkjenning for alle påmeldte i et fag (bare for faglærer): én rad per student og øving.
create or replace function public.kurs_godkjenning(k uuid)
  returns table (student uuid, epost text, ovelse uuid, godkjent boolean, beste int, forsok int)
  language sql stable security definer set search_path = public, auth as
$$
  select d.student, u.email::text, o.id,
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
  insert into profiler (id) values (new.id) on conflict (id) do nothing;
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
