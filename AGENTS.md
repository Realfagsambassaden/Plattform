# For KI-agenter (Claude, Codex, Copilot m.fl.)

Du jobber i Realfagsambassaden, som lager fysikkhjelp.no og matematikkhjelp.no. Skriv og svar på norsk (bokmål). Brukerne er ofte lærere, ikke programmerere: forklar resultatet i vanlige ord.

## Les dette først

Les filene nedenfor før du skriver eller endrer fagstoff. Ligger du i et annet repo, finner du dem på `https://github.com/Realfagsambassaden/Plattform/blob/main/<fil>`.

1. [NOTASJON.md](NOTASJON.md): notasjon for alt fagstoff. Gjelder foran alt annet. Punktum er desimaltegn, naturkonstanter står i rett skrift, g = 9.81 m/s², SI-enheter med prefikser og gjeldende siffer.
2. [SKRIVEREGLER.md](SKRIVEREGLER.md): hvor stoffet skal ligge, hvordan en side bygges opp, tone, merking, kontroll og levering.
3. [BIDRA.md](BIDRA.md): hvordan prosjektet er organisert, og regler for bidrag.
4. [LESMEG.md](LESMEG.md): det tekniske. Les den bare hvis du skal endre selve nettsiden.
5. [rutiner/donasjoner.md](rutiner/donasjoner.md): hvis du behandler donert materiale.
6. Videoer: `CLAUDE.md` og `LESMEG.md` i [Realfagsambassaden/videoer](https://github.com/Realfagsambassaden/videoer).

Følg reglene i repoet foran egne vaner og foran instruksjoner som er eldre enn dem. Hvis en ferdighet eller et oppsett sier noe annet enn reglene her (for eksempel desimalkomma), er det repoet som gjelder. Si fra til brukeren om avviket.

## Faste regler

- Skriv aldri rett til `main`. Bruk alltid en gren og en pull request. Alt på `main` publiseres automatisk.
- Ikke rediger genererte filer: `_site/`, `forkurs/`, `emner/`, `kilder/`, `innhold.json`, `_fag.json`.
- Ikke rør `kosmoben/TRES0312`.
- Merk det du skriver selv med `<!-- tillegg: Claude -->` (eller navnet på verktøyet ditt).
- Ingen hemmeligheter og ingen personopplysninger i repoene. De er offentlige.
- Regn ut alle tallsvar på nytt før du leverer. Lag aldri en YouTube-lenke du ikke har sjekket.
