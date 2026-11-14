# Nattjobben: status og logg

Nattjobben leser og oppdaterer denne filen hver natt. Instruksen står i `rutiner/nattjobb-instruks.md`, skriverekkefølgen i `rutiner/forkurs-kart.md`. Logg fra før 9. nov. 2026 ligger i prosjektdokumentet `claude/fysikkhjelp-oversikt.md`.

## Status (14. november 2026)

Nivå og dekning per tema vises på `dekning.qmd`.

**Plassholdersider i fysikk-forkurs** (`plassholder: true`): 11-elektrisitet/08-elektromotorisk-spenning; 12-atom-og-kjernefysikk/01–04; 13-programmering/01–03. Elektrisitet: hele kapitlet er bygd om 13. nov. etter TRES0312-kompendiet (11/01–07 og 11/09; bare 11/08 EMS er plassholder, og den er ikke med i TRES0312). Bølger og stråling (10/01–04) er ferdig 14. nov. `figurer/_mal.tex` laster nå også `decorations.pathmorphing` (bølgete piler, `coil` for fjærer). Løypa `loyper/tres0312.yml` plukker sidene emnet bruker. `figurer/_mal.tex` i fysikk-forkurs laster `circuitikz` (europeiske symboler); bruk `battery1,invert` når kretsen tegnes nedenfra og opp, så den lange streken (pluss) havner øverst.

**Flervariabel kalkulus:** Kapittel 1 ferdig. 02/01–03 ferdig (sylinder- og kulekoordinater 14. nov.; kulekoordinatsiden bruker $\rho$ for avstand og $\delta$ for tetthet). Neste: 02/04 treghetsmoment, 02/06 oppgaver, så kapittel 3.

**Notasjon:** 306 av 414 filer usjekket 14. nov. (29 merket i natt, Plattform#109; ingeniorfysikk har fått mange nye sider). Lista fortsetter med fysikk-forkurs 01/06 og utover. Spørsmål til læreren: 01/02 og 01/05 bruker mellomrom som tusenskille i store tall med vilje (størrelsesorden, gjeldende siffer); står til det er avgjort. I fysikk-forkurs står `k_\text{B}` i kursiv ca. 11 steder (bl.a. 09/06 tilstandslikningen) og `9.8` uten 1 ca. 4 steder. `notasjon_status.py liste` gir gjeldende tall.

**Kjente svakheter:** Termofysikk 09/01–03 og 09/06 har fortsatt en `:::: {.oppgaver}`-blokk rundt hele teorien og «Under arbeid»-boks, og eksempler med `.callout-note .svar` i stedet for `.eksempel`/`.losning`. Elektrisitet 11/04–05 er tynne og har samme struktur, og flere henvisninger som «Formel .» og «Figuren» uten nummer. Mange figur- og tabellhenvisninger mangler nummer.

**Venter på video:** `videoer/fysikk-forkurs/10-01-bolger`, `10-02-straling-og-drivhuseffekten`, `10-03-varmestraling`, `10-04-drivhuseffekten`, `videoer/flervariabel-kalkulus/02-02-sylinderkoordinater`, `02-03-kulekoordinater`, `videoer/flervariabel-kalkulus/02-01-trippelintegraler`, `videoer/fysikk-forkurs/09-04-termodynamikkens-1-lov`, `09-07-prosesstyper-og-pv-diagram`, `11-01-begreper`, `videoer/flervariabel-kalkulus/01-04-variabelbytte`, `01-05-anvendelser`, `videoer/fysikk-forkurs/01-10-grafer-og-regresjon`, `01-11-forsok-og-rapport`, `04-07-sammensatte-mekanikkoppgaver`, `09-05-stoffmengde`, `videoer/flervariabel-kalkulus/01-02-generelle-omrader`, `01-03-polarkoordinater`, `videoer/fysikk-forkurs/01-06-maleusikkerhet`, `01-07-usikkerhet-i-sammensatte-storrelser`, `videoer/flervariabel-kalkulus/01-01-dobbeltintegraler-over-rektangler`, `videoer/fysikk-forkurs/03-06-bevegelse-i-to-dimensjoner`, `07-01-harmoniske-svingninger`, `07-02-fjaer-og-pendel`, `09-07-termodynamikkens-2-lov`, `09-08-varmetransport`, og 13 plassholdere i mekanikken i ingeniorfysikk. På vent etter lærerens avgjørelse: `videoer/fysikk-forkurs/01-hva-er-fysikk` og `01-02-overslag`. (Merk: Plassholderen `09-07-termodynamikkens-2-lov` står på siden som nå heter 08, og `09-07-prosesstyper-og-pv-diagram` på siden 07.)

**Åpne spørsmål fra lærerens gjennomlesing:** v_maks via sirkelbevegelse og ω på forkursnivå? Carnot/COP uten syklusen? U-verdi på forkursnivå? Figurene med svak fargefyll i lys og mørk modus. Nytt: ln-formelen for isotermt arbeid og pV^γ på forkursnivå (09/07)?

## Praktisk

- GitHub: `gh pr list` og GraphQL virker ikke, bruk REST via `gh api`. GitHub svarer av og til 500/502: vent litt og prøv igjen.
- Grener kan ikke slettes og repoer kan ikke opprettes fra øktene.
- Økta får ikke flette til `main`. PR-er fra `natt/…`-grener flettes automatisk av GitHub (`flett-nattjobben.yml`), se instruksen punkt 5.
- Feiler bygget med 504 ved nedlasting av Quarto, er det GitHub-nedetid: kjør det på nytt.
- `fysikk-forkurs/figurer/_mal.tex` laster ikke `decorations.pathmorphing` (spiralfjær tegnes som sikksakk for hånd).

## Logg

Nyeste øverst. Én kort linje eller to per natt.

- **14. nov. 2026:** Seks sider publisert via automatisk fletting: fysikk-forkurs#36 Bølger, #37 Elektromagnetisk stråling, #38 Varmestråling, #39 Drivhuseffekten (hele kapittel 10); flervariabel-kalkulus#12 Sylinderkoordinater, #13 Kulekoordinater. Fire strømningsvideoer (E6–E9) satt inn på de nye plassholdersidene i ingeniorfysikk 08/04, 05, 07 (ingeniorfysikk#18, Plattform#110). Notasjon: 20 filer gått gjennom, én rettelse (SI-tabellen i 01/03, fysikk-forkurs#40), 29 merket (Plattform#109). Ingen bestillinger.
- **13. nov. 2026:** Fire sider publisert via automatisk fletting: fysikk-forkurs#33 Elektrisk kraft og ladning (11/02 utbygd), #34 Kirchhoffs lover (11/03 utbygd, ny eksempelfigur, batterisymbolet snudd i tre eldre kretsfigurer); flervariabel-kalkulus#10 Blandede oppgaver: dobbeltintegraler, #11 Trippelintegraler i kartesiske koordinater. Notasjon: 8 filer gått gjennom uten funn, 12 merket (Plattform#96). Ingen videoer å bytte inn, ingen nye YouTube-videoer, ingen bestillinger.
- **12. nov. 2026:** Fem sider publisert via automatisk fletting: fysikk-forkurs#29 Prosesstyper og pV-diagram (utbygd), #30 Termodynamikkens 1. lov (ryddet og utbygd), #31 Strøm, spenning og kretser (11/01 utbygd, circuitikz i figurmalen); flervariabel-kalkulus#7 Variabelbytte og jacobideterminanten, #8 Masse, tyngdepunkt og middelverdi. Notasjon: 12 filer gått gjennom, én rettelse (gasskonstanten R i 00/03, flervariabel-kalkulus#9), 17 merket (Plattform#84). Ingen videoer å bytte inn, ingen bestillinger.
- **11. nov. 2026:** Seks sider publisert via automatisk fletting: fysikk-forkurs#24 Grafer og regresjon, #25 Forsøk og rapport, #26 Sammensatte mekanikkoppgaver (ekstraoppgaver → 08), #27 Stoffmengde (termofysikk 05–09 → 06–10 med aliaser); flervariabel-kalkulus#4 Generelle områder, #5 Polarkoordinater. Notasjon: 14 filer gått gjennom uten funn, 20 merket (Plattform#74). Ingen videoer å bytte inn, ingen bestillinger.
- **10. nov. 2026, morgen (manuell økt):** PR-ene fra natta flettet manuelt etter gjennomsyn. Ny ordning: GitHub fletter `natt/`-PR-er automatisk (Plattform#48 og tilsvarende i fagrepoene). Denne PR-en er testen av ordningen.
- **10. nov. 2026:** Fletting av PR-er ble avvist av sikkerhetsfilteret i økta («Merge Without Review»), så alt står som åpne PR-er: fysikk-forkurs#21 (Måleusikkerhet, nye nummer i kapittel 1, flettes først), #22 (Usikkerhet i sammensatte størrelser), flervariabel-kalkulus#2 (Dobbeltintegraler over rektangler; matte-forkurs har ingen plassholdere igjen), Plattform#46 (notasjonsstatus, 15 filer). Ingen videoer å bytte inn, ingen bestillinger.
- **9. nov. 2026:** Nattjobben flyttet ut av Claude-prosjektet, slik at den får valgt repoene sine. Kart, status og instruks flyttet hit.
