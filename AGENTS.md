# Instrukser for KI-agenter – Realfagsambassaden

Dette er den felles instruksen for **alle** KI-agenter som jobber med nettstedene (Claude-økter i claude.ai, nattjobben, videochatten, Claude Code lokalt og andre agenter). Les denne fila før du gjør noe. Detaljregler står i filene det lenkes til. Står noe et annet sted i strid med denne fila, gjelder denne – si fra til læreren om motsetningen.

Instruksene skal ligge her i repoet, ikke bare i en chat eller et prosjektdokument, slik at alle agenter ser de samme reglene. Endrer læreren en regel i en samtale, skal den skrives inn her (eller i fila det lenkes til) i samme økt.

## 1. Nettsteder og repoer

| Hva | Hvor |
|---|---|
| fysikkhjelp.no og realfagsambassaden.no | `Realfagsambassaden/Plattform` (dette repoet). realfagsambassaden.no ligger i `ambassaden/`. |
| matematikkhjelp.no | `Plattform/matematikkhjelp/` (eget `tema.yml`, `fag.yml`, forside) |
| Temakartet | `tema.yml` (fysikk) og `matematikkhjelp/tema.yml`: område → tema → undertema |
| Tematekster | `tema-tekster/<tema-id>.md` (og `matematikkhjelp/tema-tekster/`) |
| Fag (lærestoff) | Egne repoer, listet i `fag.yml`: `fysikk-forkurs` (Forkurs i fysikk, forkursnivå), `ingeniorfysikk` (ingeniørnivå). Nye fag lages fra `Realfagsambassaden/fag-mal`. |
| Løyper (kurs) | `loyper/*.yml` |
| Forsiden: «Velg nivå!» | `nivaer.yml`: hvilke temaområder og løyper som vises på hvert nivå (forkurs, ingeniør, fordypning) |
| Notasjon | [`NOTASJON.md`](NOTASJON.md) – fasit for all notasjon |
| Donasjoner | Privat repo `donasjoner`, rutine i [`rutiner/donasjoner.md`](rutiner/donasjoner.md) |
| Videoer | Repo `Realfagsambassaden/videoer`, instruks i `videoer/CLAUDE.md` og `videoer/LESMEG.md` |
| Teknisk oversikt | [`LESMEG.md`](LESMEG.md), for mennesker: [`BIDRA.md`](BIDRA.md) |

Forkurset ble tidligere skrevet i LaTeX (`kosmoben/TRES0312`). Fra november 2026 ligger alt forkursstoff i `fysikk-forkurs`, og LaTeX-kompendiet hentes ikke lenger inn.

## 2. Arbeidsflyt

- **Alt som havner på `main`, publiseres automatisk** (3–25 minutter). Derfor går alle endringer via en gren og en pull request mot `main`, også når agenten fletter selv.
- **`main` er beskyttet i GitHub** (regelsett «Beskytt main», besluttet 12. nov. 2026) i `Plattform` og alle fagrepoene: direkte push til `main`, tvungen push (force push) og sletting av `main` blir avvist. Alt går via en PR, også små rettelser. PR-en krever ikke godkjenning, slik at nattjobben (`natt/…`) fortsatt flettes automatisk. Unntak: `videoer` er ikke beskyttet, fordi ingenting der publiseres direkte (se `videoer/CLAUDE.md`). Nye fagrepoer fra `fag-mal` får ikke regelsettet automatisk: si fra til læreren, så det legges inn.
- Flett selv bare når læreren har bedt om det. Ellers: lag PR-en og la læreren se over.
- **Grener som heter `natt/…` flettes automatisk av GitHub** så snart PR-en åpnes (arbeidsflyten `flett-nattjobben.yml` i hvert repo). De er forbeholdt nattjobben, se `rutiner/nattjobb-instruks.md`. Bruk aldri `natt/` for noe som skal ses over av et menneske først.
- Hent repoer med `add_repo` (eier `Realfagsambassaden`, tilgang `push`). Bruk `gh api repos/...` (REST); GraphQL (`gh pr list/create`) virker ikke fra øktene. Grener kan ikke slettes, og repoer kan ikke opprettes fra øktene.
- **Ikke rediger genererte filer:** `_site/`, `tema/`, `kilder/`, `innhold.json`, `loyper.json`, `_fag.json`, menyene i `_quarto.yml` nivåkortene mellom `<!-- >>> nivakort -->`-merkene i `index.qmd` (lages fra `nivaer.yml`) og løypekortene mellom `<!-- >>> lopekort -->`-merkene i `matematikkhjelp/index.qmd`.
- Bygg og sjekk lokalt når det er mulig (`./bygg.sh`, `./matematikkhjelp/bygg.sh`), og se på resultatet før du leverer.

## 3. Innholdsmodell: tema → undertema → nivå

- Alt stoff er ordnet etter **tema** og **undertema** (i `tema.yml`), ikke etter kurs. Undertemaet `oppgaver` (blandede oppgaver) finnes i alle temaer.
- **Si «tema», ikke «emne».** «Emne» betyr også et kurs (emnekode, emnebeskrivelse), så ordet brukes bare om kurs. De gamle feltnavnene `emne:` og `delemne:` godtas fortsatt av byggeverktøyet, men nye sider skal bruke `tema:` og `undertema:`.
- Hver side har nivå **Forkurs**, **Ingeniør** eller **Fordypning** (`forkurs`, `ingenior`, `fordypning`). Nivået arves fra faget (`niva:` i `fag.yml` her i Plattform) og kan overstyres med `niva:` øverst på siden.
- Hver side starter slik:

  ```yaml
  ---
  title: "Konstant akselerasjon"
  tema: kinematikk
  undertema: konstant-akselerasjon
  ---
  ```

- **Løyper** (kurs, f.eks. et NTNU-emne) plukker sider i en bestemt rekkefølge. Kursinformasjon hører hjemme i løypa, ikke i sidene.
- **Plassholdersider** for stoff som skal skrives, har `plassholder: true` øverst og en boks «Kommer snart» med punkter om hva siden skal inneholde. Fyll dem ut i stedet for å lage nye sider om samme tema.
- Gamle adresser beholdes med `aliases:` i front matter når en side flyttes.

## 4. Stil

### Kursnøytral tekst (viktig)

Samme side kan brukes i flere fag og løyper. Derfor skal teksten på en innholdsside **aldri** vise til et bestemt fag, kurs eller kompendium.

- **Ikke skriv:** «I dette faget ser vi kun på …», «i dette kurset», «i pensum», «i kompendiet», «TRES0312», «NTNU», «på eksamen», «i forrige kapittel», «som i eksempel 3.2», «se kapittel 4».
- **Skriv heller med nivå:** «På forkursnivå ser vi kun på …», «På ingeniørnivå bruker vi …». Nivåene er en struktur som finnes på nettsiden.
- Vis til andre temaer med navn («Vi har sett under *vektorer* at …»), eventuelt med lenke til undertemasiden (`/tema/<område>/<tema>/<undertema>.html`), ikke med kapittel- eller eksempelnummer.
- Kapittelforsider (`index.qmd` i et fag) og løypefiler kan nevne faget eller kurset.

### Pedagogikk og språk

- **Det pedagogiske er viktigst.** En side er god når en student som ikke kan faget fra før, forstår *og* husker stoffet etterpå. Bygg opp fra det konkrete til det generelle, vis hvorfor resultatet er rimelig (en tolkning, et grensetilfelle, en enhetssjekk), og la eksemplene øke i vanskelighet.
- **Vis, ikke bare fortell.** Grafisk innhold gjør seg nesten alltid: en TikZ-figur av situasjonen, en graf, en skisse av rutenettet, et plott fra Python som studenten kan endre selv. Lag figurer der det går an, og helst minst én per side. Figuren skal forklare noe (krefter, geometri, sammenhenger, hva som skjer når en parameter endres), ikke bare pynte. Se på hver figur før du bruker den.
- Klart bokmål, aktive setninger, én idé om gangen, korte avsnitt. Forklar *hvorfor*, ikke bare *hvordan*. Begynn gjerne med et konkret fenomen.
- Skriv til noen som ikke kan faget fra før. Treff samme tone som eksisterende sider på samme nivå.
- Norske fagord framfor engelske lånord.
- Løsninger skal være fullstendige med mellomregning: KI-hintene bygger på løsningen.
- **Notasjon:** følg [`NOTASJON.md`](NOTASJON.md) (desimalpunktum, naturkonstanter i rett skrift, gjeldende siffer, SI og prefikser).

### Byggeklosser

Boksene (`callout-note` for definisjoner, `.graa`, `.eksempel` med `.losning`, `:::: {.oppgaver}` med `.oppgave`), video (`{{< video URL >}}`), kjørbar Python (` ```{.python .kjor}`) og figurer er vist i `fag-mal/kapitler/01-forste-kapittel/01-eksempelside.qmd`. Figurer tegnes med TikZ i fagrepoets `figurer/` og lages med `python3 figurer/lag.py`.

### Punktlister, nummerering og figurer

- **Unngå lange, vanlige punktlister.** Bruk en TikZ-figur når innholdet er en sammenheng (en syklus, en kjede, før/etter), eller en av disse boksene:
  - `::: {.steg}` rundt en nummerert liste: stegene vises som kort med piler imellom (for oppskrifter og strategier).
  - `::: {.kort}` rundt en punktliste: punktene vises som kort i et rutenett. Start hvert punkt med et **uthevet** stikkord, som blir overskrift. Gjør stikkordet til en lenke (`- **[Tittel](side.qmd)** tekst`), så blir hele kortet klikkbart. Kort som viser til sider (f.eks. på kapittelforsider) skal alltid være lenker. Lenkekort får automatisk en pil (→), så de skilles fra kort som bare er informasjon.
  Begge blir vanlige lister i PDF-en.
- **Ingen kapittelnummer på nettsidene.** Samme side kan ligge i løyper der andre kapitler mangler, så nettsidene viser aldri «kapittel 3» eller «3.2». Ikke skriv nummer i titler eller tekst. PDF-kompendiet for et fag eller en løype nummereres automatisk.
- **Lys og mørk modus.** Nettsidene har en bryter for lys og mørk modus, så figurer må fungere i begge:
  - TikZ-figurer tegnes svart på gjennomsiktig bakgrunn og settes inn med `{.tikz-fig}`. De snus automatisk i mørk modus. Bruk farger fra `_mal.tex`, ikke hvit fyll som bakgrunn.
  - Skannede figurer (`{.kompendium-bilde}`) skal **aldri ha hvit bakgrunn**. Strektegninger gjøres gjennomsiktige med `python3 verktoy/hvit_til_alfa.py bilde.png` og snus i mørk modus. Fargerike figurer (f.eks. SI-enhetene) gjøres gjennomsiktige med `verktoy/fjern_bakgrunn.py` og merkes `{.kompendium-bilde .farge}`, slik at de ikke snus. Fotografier merkes `{.kompendium-bilde .foto}`.
  - Ikke henvis til farger i teksten («den røde pila»), fordi fargene endres litt mellom modusene. Bruk navn eller symboler.

### Farger og bokser (samme fargespråk som tavla i videoene)

Fargene settes av stilarket (`assets/tavle.scss`, lys modus i `assets/lys.scss`). Skriv aldri farger inn i sidene selv; velg riktig boks, så kommer fargen av seg selv.

| Hva | Farge | Slik skriver du det |
|---|---|---|
| Overskrifter (sidetittel, `##`, `###`) | oransje | vanlige overskrifter |
| Eksempler | gul | `::: {.eksempel}` med `**Eksempel: Navn.**` først |
| Spørsmål, «Til ettertanke», «Tenk selv» | gul | `::: {.callout-tip title="Til ettertanke"}` – tittel med *ettertanke*, *tenk selv*, *spørsmål* eller som slutter med «?» blir gul automatisk (klassen `.sporsmal`). Kapitlenes `::: {.spm}` er også gul. |
| Definisjoner | grønn | `::: {.callout-note title="Definisjon: …"}` – tittel som starter med «Definisjon» blir grønn automatisk (klassen `.definisjon`) |
| Viktige resultater og regler | grønn | `::: {.callout-important title="…"}` |
| Tips og merknader | turkis | `::: {.callout-tip}` / `::: {.callout-note}` |
| Advarsler, «Under arbeid» | oransje | `::: {.callout-warning}` |
| Prikker og tall i lister | grønn (gul i spørsmålsbokser) | vanlige lister |

Klassene `.sporsmal` og `.definisjon` settes av `verktoy/fag.py` ut fra tittelen. De kan også skrives direkte, f.eks. `::: {.callout-note .sporsmal title="Hva tror du?"}`.

### Merking, rettigheter og personvern

- Stoff skrevet av en KI merkes `<!-- tillegg: Claude -->` foran. Donert stoff merkes `<!-- fra notatene -->`; behold den merkingen. Retter du feil i donert stoff, skriv en kort kommentar om hva som er endret.
- Skriv eget stoff. Ikke kopier tekst, figurer eller oppgaver fra lærebøker. Åpent lisensiert stoff (f.eks. OpenStax, CC BY) kan bearbeides med kildehenvisning.
- Ingen personopplysninger i de offentlige repoene.

## 5. Video

- Bruk **bare lærerens egne videoer** (YouTube-kanalen DrNormann). Finn aldri på en video-ID. Mangler det en video, sett inn plassholderen `<!-- video: kommer (videoer/<side-id>) -->` med bildet `bilder/video-kommer.png`.
- Videoer lages i videoarbeidsflyten (`videoer/CLAUDE.md`). Ferdige lenker står i `videoer/ferdige.yml`.

## 6. Kontroll før levering

1. Regn ut alle tallsvar på nytt.
2. Sjekk at front matter har `title`, `tema` og `undertema`, at de finnes i `tema.yml`, og at `:::`-åpninger og -lukkinger går opp.
3. Sjekk at alle bilder det lenkes til, finnes.
4. Sjekk teksten mot reglene for kursnøytral tekst og notasjon.
5. Les siden én gang som en student.
