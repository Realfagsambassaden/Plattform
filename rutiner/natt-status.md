# Nattjobben: status og logg

Nattjobben leser og oppdaterer denne filen hver natt. Instruksen står i `rutiner/nattjobb-instruks.md`, skriverekkefølgen i `rutiner/forkurs-kart.md`. Logg fra før 9. nov. 2026 ligger i prosjektdokumentet `claude/fysikkhjelp-oversikt.md`.

## Status (9. november 2026)

Nivå og dekning per tema vises på `dekning.qmd`.

**Plassholdersider i fysikk-forkurs** (`plassholder: true`): 01-hva-er-fysikk/08-maleusikkerhet, 09-grafer-og-regresjon, 10-forsok-og-rapport; 04-krefter/07-luftmotstand, 08-gravitasjonsloven, 09-satellitter-og-planetbaner (de tre siste skal slettes, se kartet); 10-bolger-og-straling/01–04; 11-elektrisitet/06-elektromotorisk-spenning; 12-atom-og-kjernefysikk/01–04; 13-programmering/01–03.

**Notasjon:** 103 filer igjen 9. nov. (93 i fysikk-forkurs, 10 videomanus). I fysikk-forkurs står `k_\text{B}` i kursiv ca. 11 steder og `9.8` uten 1 ca. 4 steder. `notasjon_status.py liste` gir gjeldende tall.

**Kjente svakheter:** Termofysikk (kapittel 9) og elektrisitet (kapittel 11) i fysikk-forkurs har svak struktur. Sidene 04 og 06 i termofysikk har en `:::: {.oppgaver}`-blokk rundt hele teorien og «Under arbeid»-boks. Mange figur- og tabellhenvisninger mangler nummer.

**Venter på video:** `videoer/fysikk-forkurs/03-06-bevegelse-i-to-dimensjoner`, `07-01-harmoniske-svingninger`, `07-02-fjaer-og-pendel`, `09-07-termodynamikkens-2-lov`, `09-08-varmetransport`, og 13 plassholdere i mekanikken i ingeniorfysikk. På vent etter lærerens avgjørelse: `videoer/fysikk-forkurs/01-hva-er-fysikk` og `01-02-overslag`.

**Åpne spørsmål fra lærerens gjennomlesing:** v_maks via sirkelbevegelse og ω på forkursnivå? Carnot/COP uten syklusen? U-verdi på forkursnivå? Figurene med svak fargefyll i lys og mørk modus.

## Praktisk

- GitHub: `gh pr list` og GraphQL virker ikke, bruk REST via `gh api`. GitHub svarer av og til 500/502: vent litt og prøv igjen.
- Grener kan ikke slettes og repoer kan ikke opprettes fra øktene.
- Feiler bygget med 504 ved nedlasting av Quarto, er det GitHub-nedetid: kjør det på nytt.
- `fysikk-forkurs/figurer/_mal.tex` laster ikke `decorations.pathmorphing` (spiralfjær tegnes som sikksakk for hånd).

## Logg

Nyeste øverst. Én kort linje eller to per natt.

- **9. nov. 2026:** Nattjobben flyttet ut av Claude-prosjektet, slik at den får valgt repoene sine. Kart, status og instruks flyttet hit.
