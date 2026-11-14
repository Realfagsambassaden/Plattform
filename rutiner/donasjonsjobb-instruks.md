# Instruks: den nattlige donasjonsgjennomgangen

Denne filen er instruksen for den planlagte oppgaven «Nattlig donasjonsgjennomgang». Selve fagrutinen står i `rutiner/donasjoner.md`. Felles regler for alt innhold står i `AGENTS.md` og `NOTASJON.md`. Økta kjøres automatisk om natta, og ingen er til stede for å svare på spørsmål. Skriv på norsk bokmål.

**Viktigste regel:** Donasjoner publiseres aldri uten at fagansvarlig har godkjent dem. Du lager en pull request og stopper der. Bruk alltid grener som heter `donasjon/…`. Bruk **aldri** `natt/…`: Slike grener flettes og publiseres automatisk av GitHub (se `rutiner/nattjobb-instruks.md`, punkt 5).

## 1. Sjekk om det er noe nytt (spar ressurser)

Dette er det eneste du gjør hvis det ikke er noe nytt. Ikke klon andre repoer, ikke last skills og ikke skriv oppsummering før du vet at det finnes nye donasjoner.

1. Hent sakene (bruk REST via `gh api`, ikke `gh issue` – GraphQL er sperret):
   ```
   gh api "repos/Realfagsambassaden/donasjoner/issues?state=open&labels=donasjon&per_page=100&sort=created&direction=asc" --jq '[.[] | select(.pull_request|not) | select(([.labels[].name] | index("behandlet") or index("under-arbeid") or index("trenger-avklaring")) | not) | {number,title}]'
   ```
2. Hent også saker som har stått fast: merket `under-arbeid`, men ikke endret på over 12 timer (en tidligere økt startet og stoppet uten å levere). Disse behandles som nye:
   ```
   gh api "repos/Realfagsambassaden/donasjoner/issues?state=open&labels=donasjon,under-arbeid&per_page=100&sort=created&direction=asc" --jq '[.[] | select(.pull_request|not) | select((now - (.updated_at|fromdateiso8601)) > 43200) | {number,title}]'
   ```
   For hver slik sak: fjern merket `under-arbeid` og skriv en kort kommentar om at saken tas opp igjen.
3. Er begge listene tomme: avslutt med en gang, uten melding.
4. Svarer `gh api` med 403 eller «not enabled for this session», er det en tilgangsfeil og **ikke** en tom kø. Avslutt da med et varsel som siterer feilmeldingen ordrett.

## 2. Oppsett (bare når det finnes nye donasjoner)

- Last inn ferdigheten `fysikkhjelp-innhold` med Skill-verktøyet hvis den finnes, og ferdigheten for å lese PDF-er. `AGENTS.md` og `NOTASJON.md` går foran ferdigheten. Der ferdigheten sier «emne»/«delemne», gjelder «tema»/«undertema».
- Klon `donasjoner` (`git clone --depth 1`, lang timeout).
- Les i Plattform: `rutiner/donasjoner.md` (**rutinen du følger**), `AGENTS.md`, `NOTASJON.md`, `BIDRA.md`, `LESMEG.md`, `fag.yml`, `matematikkhjelp/fag.yml`, `tema.yml` og `matematikkhjelp/tema.yml`.
- Får du 403 eller «not in this session's authorized repository set» for et repo, ikke prøv å omgå det. Skriv feilmeldingen ordrett i en kommentar i saken, fjern merket `under-arbeid`, og nevn det i varselet.

## 3. Behandle donasjonene (maks 2 per natt, eldste først)

For hver sak:

1. Sett merket `under-arbeid` på saken (`gh api repos/Realfagsambassaden/donasjoner/issues/N/labels -f "labels[]=under-arbeid"`; lag merket hvis det mangler).
2. Les mappen saken lenker til, med `INFO.md` og alle filene.
3. **Finn lærebokrepoet** (fagrepoet) ut fra feltet «Fag» i `INFO.md`. Lærebøkene står i `fag.yml` (fysikkhjelp.no) og `matematikkhjelp/fag.yml` (matematikkhjelp.no). I dag: `fysikk-forkurs`, `ingeniorfysikk`, `matte-forkurs` og `flervariabel-kalkulus`. Kall `add_repo` (owner `Realfagsambassaden`, access `push`) for repoet, klon det, og les `README.md`, `BIDRA.md` og kapitlene som finnes, så du følger samme struktur.
   - Finnes det ikke noe lærebokrepo som passer: skriv i saken hvilken lærebok eller hvilket repo som trengs, bytt `under-arbeid` mot `trenger-avklaring`, og gå videre.
4. **Følg `rutiner/donasjoner.md`:** kartlegg innhold og temaer, sammenlign med det som finnes (nytt, overlapp, bedre), og fyll ut det som mangler. Følg reglene i `AGENTS.md` for struktur og stil: `tema:` og `undertema:` som finnes i riktig temakart, kursnøytral tekst, ingen kapittelnummer, boksene etter tabellen «Farger og bokser», `.steg`/`.kort` i stedet for lange punktlister, TikZ-figurer (`figurer/*.tex` → `python3 figurer/lag.py`) som virker i lys og mørk modus, og kjørbar Python der det passer. Nye sider får videoplassholder (`<!-- video: kommer (videoer/<fag>/<NN>-<side>) -->` med `bilder/video-kommer.png` rett under).
5. **Opphav:** Er deler av donasjonen hentet fra lærebøker, andres foiler eller andre kilder (står det i notatene, eller ser det slik ut), skriv det om med egne ord, egne eksempler og nye figurer. Kopier aldri tekst, oppgaver eller figurer fra slike kilder, og skriv i PR-en hva du har skrevet om og hvorfor.
6. **Notasjon** etter `NOTASJON.md`, som går foran giverens vaner: punktum som desimaltegn, naturkonstanter i rett skrift (`\mathrm{g}`, `\mathrm{e}`), g = 9.81 m/s² om ikke oppgaven selv sier noe annet, SI-enheter med dekadiske prefikser, ingen tusenskille og riktige gjeldende siffer. Endres et tall, regn ut alle svar som avhenger av det på nytt i Python.
7. **Merking:** Giverens tekst merkes `<!-- fra notatene -->`, egne tillegg `<!-- tillegg: Claude -->`, og endrede tall eller svar `<!-- tillegg: Claude: notasjon … -->`. Kreditering legges i metadata etter feltet «Kreditering» i `INFO.md` (anonym = ingen navn).
8. **Kontroll** før PR-en: regn ut alle tallsvar på nytt i Python, kjør all kode, sjekk at `:::`-nivåene går opp, at hver oppgave og hvert eksempel har én løsning, at `tema`/`undertema` finnes, og at alle bildelenker peker til filer som finnes. Se på hver figur.
9. **PR:** Lag grenen `donasjon/<mappenavn>` fra oppdatert `main`, og åpne en pull request mot `main` i fagrepoet (`gh api repos/Realfagsambassaden/<repo>/pulls -f title=… -f head=donasjon/<mappenavn> -f base=main -f body=…`). Beskrivelsen har: oppsummering, nytt vs. overlapp, liste over Claude-tillegg, notasjonsendringer (særlig endrede svar), hva som er skrevet om på grunn av opphav, resultatet av kontrollen, åpne spørsmål til giveren og hvor du var usikker. **Flett aldri, push aldri til `main`, og send aldri e-post til giveren.**
10. Kommenter i donasjonssaken med lenke til PR-en, og bytt `under-arbeid` mot `behandlet`. Ikke lukk saken; den lukkes når PR-en er godkjent og publisert.

Feiler noe underveis: skriv hva som feilet i en kommentar i saken, fjern `under-arbeid` så saken prøves igjen neste natt, og fortsett med neste sak.

## 4. Varsel

Send en kort melding med SendUserMessage: hvilke donasjoner som ble behandlet, lenke til hver PR (de venter på godkjenning), saker som trenger avklaring, eventuelle tilgangsfeil (ordrett), og hvor mange som står igjen i køen.
