# Nattjobben: status og logg

Nattjobben leser og oppdaterer denne filen hver natt. Instruksen står i `rutiner/nattjobb-instruks.md`, skriverekkefølgen i `rutiner/forkurs-kart.md`. Logg fra før 9. nov. 2026 ligger i prosjektdokumentet `claude/fysikkhjelp-oversikt.md`.

## Status (12. november 2026)

Nivå og dekning per tema vises på `dekning.qmd`.

**Plassholdersider i fysikk-forkurs** (`plassholder: true`): 10-bolger-og-straling/01–04; 11-elektrisitet/06-elektromotorisk-spenning; 12-atom-og-kjernefysikk/01–04; 13-programmering/01–03. Termofysikk-punktet i kartet er ferdig (09/07 prosesser utvidet, 09/04 ryddet). Elektrisitet er påbegynt: 11/01 (nå «Strøm, spenning og kretser») er bygd ut. Neste: 11/02 elektrisk kraft og ladning, 11/03 Kirchhoffs lover, 11/04 motstand, 11/05 effekt, så 11/06. `figurer/_mal.tex` i fysikk-forkurs laster nå `circuitikz` (europeiske symboler) for kretsfigurer.

**Flervariabel kalkulus:** 01/01–05 ferdige. Neste: 01/07 blandede oppgaver, så kapittel 2 (trippelintegraler).

**Notasjon:** 272 av 357 filer usjekket 12. nov. (17 merket i natt, Plattform#84). Lista fortsetter med flervariabel-kalkulus 05-integralsetninger/index og kapittel 6–8, så fysikk-forkurs. I fysikk-forkurs står `k_\text{B}` i kursiv ca. 11 steder (bl.a. 09/06 tilstandslikningen) og `9.8` uten 1 ca. 4 steder. `notasjon_status.py liste` gir gjeldende tall.

**Kjente svakheter:** Termofysikk 09/01–03 og 09/06 har fortsatt en `:::: {.oppgaver}`-blokk rundt hele teorien og «Under arbeid»-boks, og eksempler med `.callout-note .svar` i stedet for `.eksempel`/`.losning`. Elektrisitet 11/02–05 er tynne og har samme struktur, og flere henvisninger som «Formel .» og «Figuren» uten nummer. Mange figur- og tabellhenvisninger mangler nummer.

**Venter på video:** `videoer/fysikk-forkurs/09-04-termodynamikkens-1-lov`, `09-07-prosesstyper-og-pv-diagram`, `11-01-begreper`, `videoer/flervariabel-kalkulus/01-04-variabelbytte`, `01-05-anvendelser`, `videoer/fysikk-forkurs/01-10-grafer-og-regresjon`, `01-11-forsok-og-rapport`, `04-07-sammensatte-mekanikkoppgaver`, `09-05-stoffmengde`, `videoer/flervariabel-kalkulus/01-02-generelle-omrader`, `01-03-polarkoordinater`, `videoer/fysikk-forkurs/01-06-maleusikkerhet`, `01-07-usikkerhet-i-sammensatte-storrelser`, `videoer/flervariabel-kalkulus/01-01-dobbeltintegraler-over-rektangler`, `videoer/fysikk-forkurs/03-06-bevegelse-i-to-dimensjoner`, `07-01-harmoniske-svingninger`, `07-02-fjaer-og-pendel`, `09-07-termodynamikkens-2-lov`, `09-08-varmetransport`, og 13 plassholdere i mekanikken i ingeniorfysikk. På vent etter lærerens avgjørelse: `videoer/fysikk-forkurs/01-hva-er-fysikk` og `01-02-overslag`. (Merk: Plassholderen `09-07-termodynamikkens-2-lov` står på siden som nå heter 08, og `09-07-prosesstyper-og-pv-diagram` på siden 07.)

**Åpne spørsmål fra lærerens gjennomlesing:** v_maks via sirkelbevegelse og ω på forkursnivå? Carnot/COP uten syklusen? U-verdi på forkursnivå? Figurene med svak fargefyll i lys og mørk modus. Nytt: ln-formelen for isotermt arbeid og pV^γ på forkursnivå (09/07)?

## Praktisk

- GitHub: `gh pr list` og GraphQL virker ikke, bruk REST via `gh api`. GitHub svarer av og til 500/502: vent litt og prøv igjen.
- Grener kan ikke slettes og repoer kan ikke opprettes fra øktene.
- Økta får ikke flette til `main`. PR-er fra `natt/…`-grener flettes automatisk av GitHub (`flett-nattjobben.yml`), se instruksen punkt 5.
- Feiler bygget med 504 ved nedlasting av Quarto, er det GitHub-nedetid: kjør det på nytt.
- `fysikk-forkurs/figurer/_mal.tex` laster ikke `decorations.pathmorphing` (spiralfjær tegnes som sikksakk for hånd).

## Logg

Nyeste øverst. Én kort linje eller to per natt.

- **12. nov. 2026:** Fem sider publisert via automatisk fletting: fysikk-forkurs#29 Prosesstyper og pV-diagram (utbygd), #30 Termodynamikkens 1. lov (ryddet og utbygd), #31 Strøm, spenning og kretser (11/01 utbygd, circuitikz i figurmalen); flervariabel-kalkulus#7 Variabelbytte og jacobideterminanten, #8 Masse, tyngdepunkt og middelverdi. Notasjon: 12 filer gått gjennom, én rettelse (gasskonstanten R i 00/03, flervariabel-kalkulus#9), 17 merket (Plattform#84). Ingen videoer å bytte inn, ingen bestillinger.
- **11. nov. 2026:** Seks sider publisert via automatisk fletting: fysikk-forkurs#24 Grafer og regresjon, #25 Forsøk og rapport, #26 Sammensatte mekanikkoppgaver (ekstraoppgaver → 08), #27 Stoffmengde (termofysikk 05–09 → 06–10 med aliaser); flervariabel-kalkulus#4 Generelle områder, #5 Polarkoordinater. Notasjon: 14 filer gått gjennom uten funn, 20 merket (Plattform#74). Ingen videoer å bytte inn, ingen bestillinger.
- **10. nov. 2026, morgen (manuell økt):** PR-ene fra natta flettet manuelt etter gjennomsyn. Ny ordning: GitHub fletter `natt/`-PR-er automatisk (Plattform#48 og tilsvarende i fagrepoene). Denne PR-en er testen av ordningen.
- **10. nov. 2026:** Fletting av PR-er ble avvist av sikkerhetsfilteret i økta («Merge Without Review»), så alt står som åpne PR-er: fysikk-forkurs#21 (Måleusikkerhet, nye nummer i kapittel 1, flettes først), #22 (Usikkerhet i sammensatte størrelser), flervariabel-kalkulus#2 (Dobbeltintegraler over rektangler; matte-forkurs har ingen plassholdere igjen), Plattform#46 (notasjonsstatus, 15 filer). Ingen videoer å bytte inn, ingen bestillinger.
- **9. nov. 2026:** Nattjobben flyttet ut av Claude-prosjektet, slik at den får valgt repoene sine. Kart, status og instruks flyttet hit.
