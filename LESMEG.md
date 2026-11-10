# fysikkhjelp.no

> Ny medarbeider? Les [BIDRA.md](BIDRA.md) først.

Dette repoet er selve nettsiden. Innholdet hentes fra fagrepoene i `fag.yml`.

> **November 2026:** Forkurset (tidligere LaTeX-kompendiet `kosmoben/TRES0312`) er flyttet inn i fagrepoet `Realfagsambassaden/fysikk-forkurs` og skrives nå der. Kompendiet hentes ikke lenger inn. Avsnittene under om LaTeX-konvertering (`verktoy/convert.py`, `verktoy/meny.py`, `verktoy/tillegg/`) gjelder bare historikken.

## 1. Vanlig arbeidsflyt

1. Skriv i `TRES0312_Kompendium/` i TRES0312-repoet, som før.
2. Commit og push til `main`. TRES0312 sier da fra til dette repoet.
3. GitHub bygger og publiserer siden (fanen **Actions** på GitHub viser fremdriften; grønn hake = ute på nett, rødt kryss = noe feilet, og du får e-post).

YouTube-lenker legger du inn i kompendiet som før. De blir innebygde videoer på nettsiden.

## 2. Forhåndsvise på egen maskin (valgfritt)

Krever Quarto, Python 3, LaTeX (MacTeX) og `pdftocairo` (`brew install poppler`). Åpne dette repoet i VS Code og kjør i terminalen (pek på din egen TRES-mappe):

```
TRES0312="$HOME/Library/Mobile Documents/com~apple~CloudDocs/Undervisning/TRES/TRES0312 på GitHub" ./bygg.sh preview
```

Siden åpnes på `http://localhost:4200`. Første gang tar det noen minutter (figurene tegnes), deretter går det raskt. Endrer du `.tex`-filene, kjør kommandoen på nytt.

## 3. Mappene

| Fil / mappe | Hva det er |
|---|---|
| `NOTASJON.md` | Notasjonsregler for alt fagstoff (versjonert). Status for hva som er sjekket: `rutiner/notasjon-status.yml` (`verktoy/notasjon_status.py`) |
| `bygg.sh` | Gjør om kompendiet og bygger siden (brukes både lokalt og av GitHub) |
| `_quarto.yml` | Innstillinger: meny, tema, adressen til hint-tjeneren (sidemenyen lages automatisk) |
| `index.qmd` | Forsiden |
| `assets/` | Utseende (`tavle.scss`), kjørbar Python (`js/kode.js`), oppgaver og hint (`js/oppgaver.js`), bilder |
| `verktoy/convert.py` | Konverterer LaTeX til nettsider |
| `verktoy/tillegg/` | Ekstra innhold som ikke står i kompendiet, f.eks. kjørbar Python: `tillegg/<kapittelmappe>/<side>.md` |
| `hint-tjener/` | Tjeneren som henter KI-hint |
| `wrangler.jsonc` | Opplasting til Cloudflare |
| `kommer/` | «Innhold kommer!»-sidene |
| `forkurs/`, `_site/`, `kilder/` | Lages/hentes automatisk – ikke rediger, og de lagres ikke i git |

## 4. Om konverteringen

- Hvert kapittel blir én mappe, og hver `\section` én side.
- `\defn`, `\exm`, `\svar`, `\merk`, `\tips`, `\oppsum`, `\tanke`, `\spm`, `\graabox` blir bokser.
- `\oppgaver{...}` får løsningsforslaget fra `files_losning/` og hint-knapp.
- TikZ-figurer tegnes om og vises som kritt på tavla.
- Slå et kapittel av eller på for nettsiden med en kommentarlinje hvor som helst i kapittelfila (PDF-en påvirkes ikke):
  - `% nettside: av` – vises ikke på nettsiden
  - `% nettside: arbeid` – vises med «Under arbeid»-banner
  - `% nettside: på` – vises som ferdig kapittel
  
  Uten en slik linje gjelder standarden i `CHAPTERS` øverst i `verktoy/convert.py`.

Kjørbar Python i en tilleggsfil:

````
```{.python .kjor}
print("Hei")
```
````

## 5. KI-hint

Hintene går via en liten tjener på Cloudflare, slik at API-nøkkelen aldri ligger på nettsiden. Instruksen til KI-en står øverst i `hint-tjener/worker.js`. Leverandør velges med innstillinger på tjeneren i Cloudflare:

- Claude: `ANTHROPIC_API_KEY` (hemmelighet)
- NTNU GPT eller annen tjeneste i OpenAI-format: `LEVERANDOR=openai`, `KI_URL=https://gpt.ntnu.no/api/models/chat-completion`, `MODELL=gpt-oss-120b`, og hemmeligheten `KI_API_KEY`

## 6. Oppsett av automatikken (gjøres én gang)

Dette repoet trenger to hemmeligheter (Settings → Secrets and variables → Actions):

- `CLOUDFLARE_ACCOUNT_ID` – står på forsiden av Workers & Pages i Cloudflare
- `CLOUDFLARE_API_TOKEN` – lages i Cloudflare under *My Profile → API Tokens → Create Token → «Edit Cloudflare Workers»*

TRES0312 trenger hemmeligheten `FYSIKKHJELP_TOKEN` – en GitHub-nøkkel (fine-grained) med tilgang til dette repoet og tillatelsen *Contents: Read and write*. Den brukes bare til å «ringe på» når kompendiet endres (se `.github/workflows/oppdater-fysikkhjelp.yml` i TRES0312).

Nytt fag: legg til en «Hent …»-blokk i `.github/workflows/bygg.yml`, et kall i `bygg.sh`, og den samme ringeklokka i fagrepoet.

## 7. Brukerkontoer og dekningskart

- Innlogging går via Supabase (brukerdata lagres i EU). Adressen og den offentlige nøkkelen står i `_quarto.yml` (`supabase-url`, `supabase-key`). Er de tomme, står det «Innlogging er ikke satt opp ennå».
- `konto/index.qmd` + `assets/js/konto-side.js`: logg inn, registrer deg, glemt passord, Min side.
- `assets/js/konto.js`: lastes på alle sider og bytter «Logg inn» til «Min side» i menyen.
- `dekning.qmd` + `assets/js/dekning.js`: «Dekker vi faget ditt?». Krever innlogging. Sender emnebeskrivelsen til KI-tjeneren (`/dekning` i `hint-tjener/worker.js`), som sammenligner den med `innhold.json` (lages av `verktoy/innhold.py` ved hver bygging).
- KI-tjeneren trenger `SUPABASE_URL` og `SUPABASE_ANON_KEY` for å sjekke at brukeren er logget inn.

### Studieappen («Test deg selv», `/studie/`)

- `studie/index.qmd` + `assets/js/studie.js`: temavalg, løype (én uke per tema), ukens quiz med tilpasset nivå, egenvurdering, kunnskapsprofil (forståelse, presisjon, hurtighet), eksamensråd og kurs. Krever innlogging.
- **Én konto for alle nettstedene.** Dataene hører til kontoen. Svarene merkes med `nettsted`, og temavalget lagres som `nettsted/tema`.
- Spørsmålene: `studie/sporsmal.json`, laget av `python3 verktoy/sporsmal/lag_bank.py tema.yml studie/sporsmal.json`. Skriptet regner ut fasiten og stopper ved feil. Hvert galt alternativ er merket `regnefeil` eller `begrep`.
- Tilpasset nivå per tema: to riktige på rad gir ett nivå opp, begrepsfeil ett ned, regnefeil beholder nivået.
- Kurs: faglærer lager et kurs og kan kreve innsyn i studentenes profil. Studenten må da godta ved påmelding, og trekker samtykket ved å melde seg av. Uten krav, eller med under 5 studenter, ser faglærer bare samletall. Reglene håndheves i databasen (`supabase/oppsett.sql`), ikke bare på siden.
- KI (`/vurder` og `/rad` i `hint-tjener/worker.js`): vurderer studentens forklaring (tekst, tale eller bilde) og skriver eksamensråd. Navn, e-post og bruker-id sendes aldri til KI-en. Bilder lagres ikke.

### Roller, fag og øvinger

- **Roller:** student (standard), underviser og administrator (tabellen `profiler`). Undervisere godkjennes med en personlig **underviserkode** (10 tegn, kan brukes én gang). Administratoren lager kodene på Min side. Koden oppgis ved registrering eller senere på Min side.
- **Min side** er todelt: studentdel for alle, underviserdel (fag, forelesninger, eksempelmodus) for undervisere, og administrasjon (koder og undervisere) for administratoren.
- **Fag** (tabellen `kurs`): underviseren velger temaer i rekkefølge. Det blir studentenes løype når de melder seg på med fagkoden. Fagområdet har fanene Utforming, Øvinger, Studenter (liste med nøkkeltall, klikk for hele profilen, bare med samtykke) og Statistikk (undertemaer med svakest forståelse først, minst 5 studenter).
- **Obligatoriske øvinger** (tabellen `ovelser`): «ta quiz i tema X og få minst N av 6 riktige», eventuelt innen en frist. Hver fullførte quiz lagres i `studie_quiz`. Studenten ser hva som er godkjent, underviseren ser en tabell og kan laste den ned som Excel-ark (`assets/js/xlsx-lite.js`, uten eksterne biblioteker). Svarene sjekkes i nettleseren, og fasiten ligger i `studie/sporsmal.json`. Øvingene viser at arbeidet er gjort, men de er ikke juksesikre.
- **Eksempelmodus** (`/studie/#eksempel`, bare undervisere): appen med en fiktiv student. Alt ligger i minnet, og ingenting lagres.
- **Forelesningsverktøyet** og oppretting av fag er sperret for studenter, både på siden og i databasen.

### Personvern og sikkerhet

- Studentdata ligger i Supabase (EU). Tilgangen styres med radsikkerhet (RLS) i databasen, ikke bare på siden. Alle reglene er testet mot en lokal Postgres.
- En student ser bare sine egne data. Underviseren ser enkeltprofiler bare når faget krever innsyn **og** studenten har godtatt det ved påmelding. Samtykket trekkes ved å melde seg av. Godkjenning av øvinger ser underviseren for alle påmeldte, og det står i påmeldingen.
- Samletall vises bare når minst 5 studenter har svart. Egenvurderingene (1–5) vises aldri enkeltvis.
- Resultater av quizer kan ikke endres i ettertid, og tidspunktet settes av databasen.
- Til KI sendes bare spørsmålet og studentens forklaring, aldri navn, e-post eller bruker-id. Bilder lagres ikke.
- Slettes en konto (Supabase → Authentication → Users), slettes alle dataene til brukeren automatisk.
- Ingen personopplysninger i repoet. Administrator settes med en SQL-linje som kjøres for seg (se `supabase/oppsett.sql`).
- **Bør gjøres før bruk i et emne:** personvernerklæring på nettstedet, databehandleravtaler med Supabase og Anthropic, og avklaring med institusjonen.

**Oppsett (én gang):**

1. Supabase → SQL Editor: lim inn hele `supabase/oppsett.sql` og trykk «Run» (trygt å kjøre flere ganger).
   Gjør deg selv til administrator med SQL-linjen øverst i rolle-delen av `oppsett.sql` (med din e-post, kjøres for seg og legges ikke i repoet).
2. KI-tjeneren bruker Claude (besluttet 10. nov. 2026) og publiseres automatisk til `hint.fysikkhjelp.no` (jobben `hint-tjener` i `.github/workflows/bygg.yml`). Nøkkelen lages på platform.claude.com (organisasjonen Realfagsambassaden, tjenestekontoen `realfagsambassaden`) og legges inn som GitHub-hemmelighet `ANTHROPIC_API_KEY` i dette repoet (Settings → Secrets and variables → Actions). Supabase-verdiene står i `hint-tjener/wrangler.toml`. Standardmodellen er `claude-haiku-5-5`. Vil du ha grundigere vurdering av håndskrift, sett `MODELL_BILDE` under `[vars]`.
3. Sjekk at `fysikkhjelp-hint-api` i `_quarto.yml` peker på tjeneren. Studieappen bruker samme adresse, med `/vurder` og `/rad` i stedet for `/hint`.

## 8. Nye fag (fra malen)

Nye fag lages fra malen **Realfagsambassaden/fag-mal** (Use this template). Faget legges inn med én linje i `fag.yml` her i plattformen:

```yaml
fag:
  - repo: Realfagsambassaden/fysikk-mekanikk
```

Faget bestemmer selv nettsted, navn, kortnavn og status (`skjult`/`arbeid`/`klar`) i sin egen `fag.yml`. `verktoy/fag.py` henter det inn ved hver bygging, lager oversiktsside, sidemeny og menypunkt. Hvert fag-repo «ringer på» plattformen når det endres (organisasjons-hemmeligheten `PLATTFORM_TOKEN`).

## 9. Temaer og løyper

- **Temaer er grunnmuren.** `tema.yml` lister områder (Mekanikk, Fluidmekanikk …), temaer (Kinematikk, Arbeid og energi …) og undertemaer. Alt stoff hører til et tema. (Vi sier ikke «emne», fordi det også betyr et kurs.)
- **Løyper** er kurs lagt oppå temaene, f.eks. «Forkurs i fysikk». En løype følger et fag (`loyper/*.yml`).
- Fag fra malen merker hver side med `tema:` og `undertema:` øverst i fila (de gamle navnene `emne:`/`delemne:` godtas fortsatt).
- `verktoy/tema.py` lager tema- og områdesidene (`tema/`, med videresending fra de gamle adressene under `/emner/`), løypeoversikten (`loyper/index.qmd`), sidemenyen (etter temaer) og toppmenyen (Temaer ▾ / Løyper ▾), og `loyper.json`.
- `assets/js/loype.js` viser temaet og «Forrige / Neste» i løypa øverst på hver innholdsside.
- Egen innledningstekst til et tema: legg en fil i `tema-tekster/<tema-id>.md`.

## 10. matematikkhjelp.no

matematikkhjelp.no ligger i mappen `matematikkhjelp/` og bygges med de samme verktøyene (`verktoy/`) og det samme utseendet (`assets/`) som fysikkhjelp.no. Byggingen kopierer `assets/` inn i mappen, så det er bare ett sted å endre utseendet.

| Fil / mappe | Hva det er |
|---|---|
| `matematikkhjelp/bygg.sh` | Bygger siden (`./matematikkhjelp/bygg.sh preview` gir forhåndsvisning på `http://localhost:4201`) |
| `matematikkhjelp/_quarto.yml` | Innstillinger og meny (menyene lages automatisk) |
| `matematikkhjelp/index.qmd` | Forsiden |
| `matematikkhjelp/tema.yml` | Temakartet for matematikk |
| `matematikkhjelp/tema-tekster/` | Innledningstekster til temaene |
| `matematikkhjelp/fag.yml` | Fagene som vises her (fagrepo med `nettsted: matematikkhjelp` i sin egen `fag.yml`) |
| `matematikkhjelp/loyper/` | Løyper (kurs) |
| `matematikkhjelp/wrangler.toml` | Opplasting til Cloudflare (Worker-navn `matematikkhjelp`) |

GitHub-automatikken bygger og publiserer matematikkhjelp.no i samme kjøring som fysikkhjelp.no. Domenet kobles til i Cloudflare under *Workers & Pages → matematikkhjelp → Settings → Domains & Routes*.

KI-hintene bruker den samme hint-tjeneren. Den svarer som matematikklærer når forespørselen kommer fra matematikkhjelp.no.
