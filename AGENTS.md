# Instrukser for KI-agenter – Realfagsambassaden

Dette er den felles instruksen for **alle** KI-agenter som jobber med nettstedene (Claude-økter i claude.ai, nattjobben, videochatten, Claude Code lokalt og andre agenter). Les denne fila før du gjør noe. Detaljregler står i filene det lenkes til. Står noe et annet sted i strid med denne fila, gjelder denne – si fra til læreren om motsetningen.

Instruksene skal ligge her i repoet, ikke bare i en chat eller et prosjektdokument, slik at alle agenter ser de samme reglene. Endrer læreren en regel i en samtale, skal den skrives inn her (eller i fila det lenkes til) i samme økt.

## Når Ben må gjøre noe selv: fast oppskrift med lenker

Besluttet 19. nov. 2026. Hver gang Ben må gjøre noe selv, avslutt svaret med en kort, nummerert oppskrift med **direkte lenker**, i samme form hver gang. Ikke skriv bare «merge PR-en» eller «kjør SQL-en»:

- **Merge:** én lenke per PR, f.eks. `[Merge #123 her](https://github.com/Realfagsambassaden/Plattform/pull/123)`. Ta med alle PR-er som venter, i alle repoene.
- **SQL:** lenke til SQL-editoren, [supabase.com/dashboard/project/fwyoldmtjnfxtkdwldzx/sql/new](https://supabase.com/dashboard/project/fwyoldmtjnfxtkdwldzx/sql/new), og SQL-en i én kodeblokk han kan kopiere.
- **Secrets i GitHub:** [github.com/Realfagsambassaden/Plattform/settings/secrets/actions/new](https://github.com/Realfagsambassaden/Plattform/settings/secrets/actions/new), med navnet som skal stå i «Name».
- **Nøkler (tokens):** [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new), med hvert felt og hver tilgang som skal velges.
- **API-nøkler i Supabase:** [supabase.com/dashboard/project/fwyoldmtjnfxtkdwldzx/settings/api-keys](https://supabase.com/dashboard/project/fwyoldmtjnfxtkdwldzx/settings/api-keys).
- **Kjøringer i Actions:** lenke direkte til kjøringen eller arbeidsflyten.

Kan du gjøre det selv (f.eks. starte en jobb eller kjøre noe gjennom et verktøy du har tilgang til), gjør det i stedet for å be Ben om det.

## 0. Begreper: lærebok, løype, kurs og emne

Fire ord som lett blandes sammen (besluttet av læreren 14. nov. 2026). Bruk dem slik i all tekst, i instruksene og på nettstedet:

| Ord | Hva det er | I koden |
|---|---|---|
| **Lærebok** | En samling innholdssider i eget repo, f.eks. «Forkurs i fysikk» (`fysikk-forkurs`) og «Ingeniørfysikk» (`ingeniorfysikk`). Generell, ikke knyttet til et emne eller semester. Lages fra malen `fag-mal`. | Heter fortsatt `fag`: `fag.yml`, `verktoy/fag.py`, `_fag.json`, `kortnavn`, «fagrepo» |
| **Løype** | En lesevei gjennom sidene for ett emne: hvilke sider, i hvilken rekkefølge, gjerne uke for uke. Offentlig og lik for alle. | `loyper/<id>.yml` |
| **Kurs** | Undervisernes eget opplegg for ett semester i studieappen: studenter, moduler og uker, forelesninger med slides, arbeidskrav, Dashman-fase. Kan bygges etter en løype. Verktøyet heter **kursbyggeren**. | Tabellen `kurs`; i `assets/js/studie.js` fortsatt `T.fag` og adresser som `#fag-<id>` |
| **Emne** | Undervisningsinstitusjonens emne, f.eks. IFYA1000 ved NTNU. Det en løype og et kurs er laget for. | `emnekode` i løypefila |

Ordet **fag** brukes bare i vanlig betydning («fagstoff», «faglig», «faglærer», «en student som ikke kan faget fra før»), ikke som navn på noe av det over. Kode, filnavn og adresser som heter `fag` beholdes, så ingenting går i stykker.

## 1. Nettsteder og repoer

| Hva | Hvor |
|---|---|
| fysikkhjelp.no og realfagsambassaden.no | `Realfagsambassaden/Plattform` (dette repoet). realfagsambassaden.no ligger i `ambassaden/`. |
| matematikkhjelp.no | `Plattform/matematikkhjelp/` (eget `tema.yml`, `fag.yml`, forside) |
| Temakartet | `tema.yml` (fysikk) og `matematikkhjelp/tema.yml`: område → tema → undertema |
| Tematekster | `tema-tekster/<tema-id>.md` (og `matematikkhjelp/tema-tekster/`) |
| Lærebøker (lærestoff) | Egne repoer («fagrepoer»), listet i `fag.yml`: `fysikk-forkurs` (Forkurs i fysikk, forkursnivå), `ingeniorfysikk` (ingeniørnivå). Nye lærebøker lages fra `Realfagsambassaden/fag-mal`. |
| Løyper (en lesevei per emne) | `loyper/*.yml` |
| Forsiden: «Velg nivå!» | `nivaer.yml`: hvilke temaområder og løyper som vises på hvert nivå (forkurs, ingeniør, fordypning) |
| Notasjon | [`NOTASJON.md`](NOTASJON.md) – fasit for all notasjon |
| Donasjoner | Avviklet 19. nov. 2026 (siden og skjemaet er fjernet). Det private repoet `donasjoner` har de gamle donasjonene. |
| Videoer | Repo `Realfagsambassaden/videoer`, instruks i `videoer/CLAUDE.md` og `videoer/LESMEG.md`. YouTube-spillelister: `youtube.yml` |
| Teknisk oversikt | [`LESMEG.md`](LESMEG.md), for mennesker: [`BIDRA.md`](BIDRA.md) |

Forkurset ble tidligere skrevet i LaTeX (`kosmoben/TRES0312`). Fra november 2026 ligger alt forkursstoff i `fysikk-forkurs`, og LaTeX-kompendiet hentes ikke lenger inn.

## 2. Arbeidsflyt

- **Alt som havner på `main`, publiseres automatisk** (3–25 minutter). Derfor går alle endringer via en gren og en pull request mot `main`, også når agenten fletter selv.
- **`main` er beskyttet i GitHub** (regelsett «Beskytt main», besluttet 12. nov. 2026) i `Plattform` og alle lærebokrepoene: direkte push til `main`, tvungen push (force push) og sletting av `main` blir avvist. Alt går via en PR, også små rettelser. PR-en krever ikke godkjenning, slik at nattjobben (`natt/…`) fortsatt flettes automatisk. Unntak: `videoer` er ikke beskyttet, fordi ingenting der publiseres direkte (se `videoer/CLAUDE.md`). Nye fagrepoer fra `fag-mal` får ikke regelsettet automatisk: si fra til læreren, så det legges inn.
- Flett selv bare når læreren har bedt om det. Ellers: lag PR-en og la læreren se over.
- **Grener som heter `natt/…` flettes automatisk av GitHub** så snart PR-en åpnes (arbeidsflyten `flett-nattjobben.yml` i hvert repo). De er forbeholdt nattjobben, se `rutiner/nattjobb-instruks.md`. Bruk aldri `natt/` for noe som skal ses over av et menneske først.
- Hent repoer med `add_repo` (eier `Realfagsambassaden`, tilgang `push`). Bruk `gh api repos/...` (REST); GraphQL (`gh pr list/create`) virker ikke fra øktene. Grener kan ikke slettes, og repoer kan ikke opprettes fra øktene.
- **Ikke rediger genererte filer:** `_site/`, `tema/`, `kilder/`, `innhold.json`, `loyper.json`, `_fag.json`, menyene i `_quarto.yml`, nivåkortene mellom `<!-- >>> nivakort -->`-merkene i `index.qmd` (lages fra `nivaer.yml`) og løypekortene mellom `<!-- >>> lopekort -->`-merkene i `matematikkhjelp/index.qmd`.
- Bygg og sjekk lokalt når det er mulig (`./bygg.sh`, `./matematikkhjelp/bygg.sh`), og se på resultatet før du leverer.

## 3. Innholdsmodell: tema → undertema → nivå

- Alt stoff er ordnet etter **tema** og **undertema** (i `tema.yml`), ikke etter kurs. Undertemaet `oppgaver` (**sammensatte oppgaver**) finnes i alle temaer og står sist i temaet.
- **Sammensatte oppgaver** (besluttet 17. nov. 2026; erstatter «ekstraoppgaver» og «blandede oppgaver»): oppgaver som bygger på en helhetlig forståelse og gjerne knytter sammen flere delkapitler, også på tvers av temaer. Regler:
  - Siden er undertemaet `oppgaver` i et tema og følger temastrukturen: oppgavene bruker bare stoff fra det temaet og temaer som kommer **før** i strukturen (`tema.yml`), aldri stoff som kommer senere.
  - Hver oppgave sier hva den bygger på: `::: {.oppgave tittel="…" krever="kretser/motstand, kretser/effekt"}` (tema-id/undertema-id fra `tema.yml`, kommaseparert). Ta med alle undertemaer oppgaven trenger, også fra andre temaer.
  - **Oppgavene følger løypa:** i en løype skjuler `assets/js/loype.js` oppgaver som bygger på stoff som ikke er gjennomgått tidligere i løypa (med knappen «Vis likevel»). `verktoy/tema.py` advarer om ukjente `krever` og lister hvilke oppgaver som skjules i hver løype. Sjekk lista når en løype lages eller endres.
  - Tittelen på siden er «Sammensatte oppgaver: <tema>».
- **Si «tema», ikke «emne».** «Emne» betyr også et kurs (emnekode, emnebeskrivelse), så ordet brukes bare om kurs. De gamle feltnavnene `emne:` og `delemne:` godtas fortsatt av byggeverktøyet, men nye sider skal bruke `tema:` og `undertema:`.
- Hver side har nivå **Forkurs**, **Ingeniør** eller **Fordypning** (`forkurs`, `ingenior`, `fordypning`). Nivået arves fra læreboka (`niva:` i `fag.yml` her i Plattform) og kan overstyres med `niva:` øverst på siden.
- Hver side starter slik:

  ```yaml
  ---
  title: "Konstant akselerasjon"
  tema: kinematikk
  undertema: konstant-akselerasjon
  ---
  ```

- **Løyper** (kurs, f.eks. et NTNU-emne) plukker sider i en bestemt rekkefølge. Kursinformasjon hører hjemme i løypa, ikke i sidene.
- **Temaene bygges generelt, emnene blir løyper.** Temaer og undertemaer følger en vanlig universitetslærebok i rekkefølge og omfang, ikke et bestemt emne. Et emne (f.eks. IFYA1000 eller IFYA1002) skal aldri bestemme temastrukturen. Det blir en løype som plukker ut sidene emnet trenger, i emnets rekkefølge. Forelesningsnotater og eksamener fra et emne viser hvilke sider løypa trenger og hvilket nivå som kreves.
- **Undervisningsopplegget hører til løypa, ikke sidene.** En innholdsside består av teori og oppgaver. Om et emne kjøres som flipped classroom eller på vanlig måte, bestemmes i løypa, og det kan påvirke hvordan løypa er satt opp. Temasidene skal ikke tilpasses et bestemt undervisningsopplegg.
- **Plassholdersider** for stoff som skal skrives, har `plassholder: true` øverst og en boks «Kommer snart» med punkter om hva siden skal inneholde. Fyll dem ut i stedet for å lage nye sider om samme tema.
- Gamle adresser beholdes med `aliases:` i front matter når en side flyttes.

## 4. Stil

### Kursnøytral tekst (viktig)

Samme side kan brukes i flere lærebøker, løyper og kurs. Derfor skal teksten på en innholdsside **aldri** vise til en bestemt lærebok, løype, kurs, emne eller kompendium.

- **Ikke skriv:** «I dette faget ser vi kun på …», «i dette kurset», «i pensum», «i kompendiet», «TRES0312», «NTNU», «på eksamen», «i forrige kapittel», «som i eksempel 3.2», «se kapittel 4».
- **Skriv heller med nivå:** «På forkursnivå ser vi kun på …», «På ingeniørnivå bruker vi …». Nivåene er en struktur som finnes på nettsiden.
- Vis til andre temaer med navn («Vi har sett under *vektorer* at …»), eventuelt med lenke til undertemasiden (`/tema/<område>/<tema>/<undertema>.html`), ikke med kapittel- eller eksempelnummer.
- Kapittelforsider (`index.qmd` i en lærebok) og løypefiler kan nevne læreboka eller emnet.

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
- **Ingen kapittelnummer på nettsidene.** Samme side kan ligge i løyper der andre kapitler mangler, så nettsidene viser aldri «kapittel 3» eller «3.2». Ikke skriv nummer i titler eller tekst. PDF-kompendiet for en lærebok eller en løype nummereres automatisk.
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
- **Bilder av studentløsninger** sendes bare til KI og lagres ikke. Eneste unntak (besluttet 16. nov. 2026): Er KI usikker på om bildet er studentens egen håndskrevne løsning, spør appen om bildet kan lagres for gjennomsyn av en lærer og for å gjøre Dashman bedre. Sier studenten nei, godkjennes ikke svaret. Ser KI at bildet ikke er håndskrevet (skjermdump, utskrift, tekst fra en KI-chat), godkjennes det ikke. Lagrede bilder slettes når administratoren har behandlet dem (tabellen `gjennomsyn`).
- **Oppgavebanken først, og kontroll før studentene ser noe** (besluttet 17. nov. 2026): Vi prioriterer å utvide oppgavebanken (studie/sporsmal.json og malspørsmål med variabler) med spørsmål i tre vanskelighetsgrader (lett, middels, vanskelig) per undertema, fremfor å utvikle arbeidskrav videre. Ingen oppgave, verken i banken eller laget av KI til et arbeidskrav, skal vises for studenter før den er kontrollert: (1) automatisk sjekk (fasit kan regnes ut for alle variabelverdier, alle {{variabler}} finnes, notasjon etter NOTASJON.md, balanserte formler, ingen kladdetekst som «…» eller «Enklere:», ikke formelen i spørsmålsteksten), (2) KI-kontroll der en uavhengig KI løser oppgaven bare fra teksten og sammenlignes med fasiten, og (3) godkjenning av faglærer. Trinn 2 er laget: KI-tjenesten kontrollerer automatisk spørsmål som KI lager til arbeidskrav (merket ⚠ i redigeringen når KI er uenig med fasiten), og endepunktet `/kontroller` (bare undervisere) kontrollerer opptil 30 spørsmål om gangen. KI-agenter som legger spørsmål i banken skal regne ut alle tall med kode, kjøre `verktoy/sjekk_oppgaver.py` og kjøre spørsmålene gjennom `/kontroller` før de foreslår dem. Oppgaver studentene melder feil på, eller som har uvanlig lav andel riktige, går tilbake til kontroll.
- **Oppmøte med stikkprøver** (besluttet 17. nov. 2026): Underviseren starter oppmøte i undervisningsmodus. En tresifret kode på sliden skifter hvert 10. minutt. I hver periode plukkes hver påmeldte student ut tilfeldig med 50 % sannsynlighet og får en tydelig boks (alle sider, også Min side og appen) og et push-varsel om å skrive inn koden før perioden er slutt. Oppmøtet = beståtte sjekker / alle sjekker, summert over semesteret (det er totalen som teller, så man kan være borte deler av en undervisning). Kravet er 50 %. Faglæreren kan overstyre en hel økt per student. Utvalg og koder regnes ut på serveren (supabase/oppsett.sql: oppmote_*).
- **Plan: «Klar til eksamen» i stedet for arbeidskrav** (ingeniørfysikken, bygges over jul 2026; besluttet 17. nov. 2026, ikke laget ennå): Ingen faste arbeidskrav. Studentene jobber fritt med de oppgavene de vil (quiz, oppgaver, opplastede håndregninger, Dashman), og alt teller som bevis i kunnskapsprofilen. Dashman vurderer hvert tema i kurset ut fra **bevis fra fritt arbeid alene** (ingen egen eksamenssjekk). Når alle temaene er klare, foreslår Dashman studenten som **«klar til eksamen»**. Det er et **formelt krav**, og faglæreren bekrefter i en liste (kan overstyre). Navnet er «klar til eksamen». Planlagt i tillegg: én eller to midtveisprøver (ikke bestemt hvordan ennå). TRES0312 fortsetter med arbeidskrav som før.
- **Forsiden og studentens vei** (besluttet 17. nov. 2026): Forsiden viser ikke en liste med løyper. Til høyre står «Din vei» med to valg: **Design din løype** (studenten velger temaer selv i studieappen, eller limer inn en emnebeskrivelse og får forslag fra Dashman) og **Kurstilbud** (kurs som undervisere tilbyr). Bruk disse navnene også i appen. Forsiden har overskriften «Lærebok i …» per nivå, og valgene heter f.eks. «Design din løype gjennom forkurstema» og «Kurstilbud på forkursnivå» (nivaer.yml). Lesevisningen heter **fokusmodus** overalt (ikke «fokusvisning»), og den skal være ett trykk unna: øverst i «I dag» i appen og på Min side. I appen går all navigasjon til lærestoff gjennom fokusmodus (bare relevante temaer, ✕ tilbake til appen). Nettsidene åpnes bare ved et bevisst valg («Gå til fysikkhjelp.no» i menyen; ingen lenker fra «I dag» rett til nettsidene, f.eks. ikke «Les om ukens tema»). Det skal alltid være lett å komme tilbake til appens hjemskjerm. Studenter i et kurs skal ikke trenge ordene «løype» eller «lærebok». **Oppdatert 18. nov. 2026:** Menyen «Løyper» i toppmenyen er fjernet, og ferdige løyper og «åpne kurs» vises ikke lenger som valg. En løype er enten en **kursløype** (et kurs en underviser lager; studenten melder seg på med koden fra faglæreren) eller en løype studenten designer selv (gjerne med Dashman og en opplastet emnebeskrivelse). Valget «Kurstilbud» heter **«Kursløype»** på forsiden og i appen.
- **Formelark** (besluttet 18. nov. 2026): Et fag kan ha et formelark, det samme studentene har med på eksamen. Det ligger som egen side i `assets/formelhefter/<id>.html` og åpnes med «📐 Formelark» i fokusmodus (høyre skuff, som arbeidskravet). Kurset velger det i kursbyggeren (`elementer.formelhefte`); kurs med fagkoden i navnet og løypa med samme id får det automatisk. Innhold: bare de viktige formlene, ikke varianter (forståelse er det viktige), med symboler, enheter, dekadiske prefikser og naturkonstantene faget trenger, piler på vektorstørrelser, og bare formler fra undertemaene kurset bygger på. TRES0312 bruker $\mathrm{k_B}$, ikke R, og har ikke formel for isoterm prosess (prosesstypene forklares med ord).
- **Fiktiv klasse** (besluttet 18. nov. 2026): Ti robot-elever, rangert fra svakest til sterkest: Arnt, Bernt, Celine, David, Ernst, Felicia, Gunn, Hårek, Iselin, Julie. Admin starter dem med «Kjør fiktiv klasse» i kursbyggeren (hint-tjeneren `/fiktiv/start` → GitHub-jobben `fiktiv-klasse.yml` → `verktoy/fiktiv_klasse/klasse.mjs`). De bruker en **kopi** av kurset («… – fiktiv klasse», `ramme.fiktivFra`), aldri det ekte kurset, og kontoene har e-post på `@fiktiv.fysikkhjelp.no` og `user_metadata.fiktiv = true`. Hovedformålet er å **finne feil**: robotene svarer etter nivå (Claude Haiku løser oppgavene), laster opp «håndskrevne» utregninger, laster siden på nytt, hopper over og går tilbake, snakker med Dashman og skriver tilbakemeldinger (merket «[Fiktiv elev …]», settes til fikset etterpå). Alt som går galt, havner i en rapport (issue med etiketten fiktiv-klasse, skjermbilder som vedlegg). Billig og treg er greit. Når appen endres, legg til en sjekk i roboten for feilen som ble rettet.
- **Håndskriftsjekken lærer** (besluttet 19. nov. 2026): `/vurder` sender med (1) et fast eksempel på «utregning» skrevet med en håndskriftfont (`hint-tjener/handskrift-eksempel.js`, slik robot-elevene lager dem) som eksempel på det som IKKE er håndskrift, og (2) de siste 20 avgjørelsene læreren har tatt på bilder til gjennomsyn, som korte beskrivelser (`ki.bildebeskrivelse`, Supabase-funksjonen `handskrift_laering()`). Bilder lagres aldri for læring; de slettes ved behandling som før.
- **realfagsambassaden.no tar bare imot pengestøtte og bookinger** (besluttet 19. nov. 2026). Ikke donasjon av notater. Pengestøtte (Støtt oss) og bookinger holdes adskilt: bookingskjemaet på `book.html` sendes på e-post fra workeren (`/api/book`, Cloudflare `send_email`), ikke til et repo. Kontaktadressen på sidene er admin@realfagsambassaden.no.
- **Dashman og eksamen** (besluttet 24. nov. 2026): Dashman røper aldri, under noen omstendigheter, hva som kommer på en kommende eksamen (regel 9 i `hint-tjener/dashman-instruks.md`). Spør en TRES0312-student, sier han at han ikke kan uttale seg, og at det ligger litt informasjon på Canvas. Spør studenten hva hen bør øve på, svarer han ut fra profilen og pensum i kurset («du er sterk på …, men ikke så sterk på …, som også er pensum»). Formelarket for TRES0312 lages fra Bens LaTeX-kilde (`Formelark_kilde/Formelark-TRES0312.tex` i TRES-mappa) til `assets/formelhefter/tres0312.html` + `.pdf`.
- **Oppgaver uten løsningsforslag** (besluttet 19. nov. 2026): Oppgavene i lærebøkene kan brukes i øvingsopplegg, så studentene skal ikke få løsningsforslag. På nettsidene har oppgavene **hint** (KI) og **fasit** (bare sluttsvaret, `::: {.fasit}` bak «Vis svar»). Løsningsforslagene ligger i det private repoet `Realfagsambassaden/eksamener`, mappa `losninger/<lærebokrepo>/<sti>.yml` (id = sidens adresse + `#` + oppgavenummer på siden). Hint-KI-en og Dashman bruker dem uten å vise dem, og undervisere/admin ser dem med «Løsningsforslag (lærer)» på oppgaven. **Skriv aldri løsningsforslag til oppgaver i lærebokrepoene** (de er offentlige): legg dem i det private repoet, og skriv bare fasit i læreboka. `verktoy/flytt_losninger.py` flytter løsningsforslag som har havnet i en lærebok. **Eksempler** har fortsatt hele løsningen (skjult bak «Vis løsning»), og det skal være flere eksempler.
- **Profilene** (besluttet 18. nov. 2026): Profilene til ambassadørene vises som samlekort («fotballkort», vippes ved hover). Alle kortene og profilsidene (om meg, meritter, tilbud, sosiale lenker) ligger samlet på Realfagsambassaden (`ambassaden/public/index.html#ambassadorer` og `ambassaden/public/profil/<id>.html`). Kortene på fysikkhjelp.no lenker dit; `profiler/*.qmd` sender videre. Kortene er like store og viser bare bilde, rolle og «skårer» som på et fotballkort: **Utdanning** (søyle), **Erfaring** (år, søyle), **Kvalitet** (ett ord), **Fun fact** og **Koffein** (kopper om dagen). All tekst om personen («Om meg» osv.) står på profilsiden. Alt redigeres i `ambassaden/ambassadorer.yml`; `verktoy/samlekort.py` lager kortene og profilsidene (kjøres ved bygging).
- **Eksamenstrening** (besluttet 18. nov. 2026): Tidligere eksamener ligger i det private repoet `Realfagsambassaden/eksamener` (én mappe per eksamen med `eksamen.yml`: tekst, alternativer, riktig svar, tema, løsningsforslag; utkast til kommende eksamener skal aldri dit). `verktoy/eksamener.py` bygger dem inn i KI-tjeneren ved publisering (`hint-tjener/eksamen.js`; fasit og løsning sendes aldri til nettleseren før studenten har svart). Studenten slår selv på **eksamensmodus** med en skyveknapp i Dashman-boblen: Dashman gir bare eksamensoppgaver fra temaene studenten jobber med, studenten svarer (og kan legge ved bilde av utregningen), og først da kommer tilbakemelding og forklaring. Eksamensmodus kan slås av når som helst for å diskutere. Alle svar lagres i `studie_svar` og teller i kunnskapsprofilen. Kunnskapsprofilen viser **anslått prosent på eksamen** med et tydelig usikkerhetsintervall og forbeholdet «KI-vurdering, ikke fasit» (regnes ut, ikke av KI). I kursbyggeren legger «+ Eksamenstrening (nivå 4)» til en modul med fase 4 (selvstendig); i de ukene får studentene et eget kort i «I dag».
- **Arbeidskrav og quiz** (besluttet 18. nov. 2026): Faglæreren lager bare **arbeidskrav** (oransje), og bestemmer selv hvor obligatoriske de er: frist, hvor mange som må være godkjent, eller **ingen krav** (frivillig øving, krav = 0). **Quizen** er studentens egen hjelp gjennom semesteret, ikke noe faglæreren lager: «Min quiz» med 1, 3 eller 5 spørsmål om dagen fra denne ukas tema og repetisjon fra tidligere uker (studenten velger hvor langt tilbake), eller «La Dashman velge» ut fra kunnskapsprofilen (svake temaer og det som er lenge siden). Studenten blir spurt én gang i «I dag» og kan endre under «Design din løype».
- **Godkjenning av oppgaver i arbeidskrav** (besluttet 17. nov. 2026): Ubegrenset antall forsøk, med mindre øvingen sier noe annet. Fasiten vises aldri så lenge studenten kan prøve igjen, og Dashman gir aldri sluttsvaret. En oppgave er godkjent når svaret er riktig og et opplastet bilde av håndregningen viser *tilstrekkelig forståelse*, med to streker under svaret. Rekkefølgen er fri: svaret kan stå i bildet eller skrives inn før eller etter opplastingen, og fremgangsmåten trenger ikke være perfekt. Det trengs ingen tekst i tillegg til bildet. Grønt = godkjent, oransje = kanskje (KI i tvil), rødt = ikke godkjent. Antall gjeldende siffer i fasiten regnes fra det minst nøyaktige måltallet i oppgaveteksten (NOTASJON.md §3). Riktig tankegang og verdi med feil antall siffer er godkjent, med en kommentar om siffer (besluttet 17. nov. 2026).
- **Skjermbilder i tilbakemeldinger** (besluttet 16. nov. 2026): Tilbakemeldingsknappen kan ta med et skjermbilde. Brukeren må godkjenne lagringen for *hver* melding med bilde, og får vite at meldingen da ikke knyttes til profilen. En melding med bilde lagres uten bruker (`tilbakemeldinger.bruker = null`), bildet skaleres om i nettleseren (metadata fjernes), og det slettes når meldingen settes til «fikset».

## 5. Video

- Bruk **bare lærerens egne videoer** (YouTube-kanalen DrNormann). Finn aldri på en video-ID. Mangler det en video, sett inn plassholderen `<!-- video: kommer (videoer/<side-id>) -->` med bildet `bilder/video-kommer.png`.
- Videoer lages i videoarbeidsflyten (`videoer/CLAUDE.md`). Ferdige lenker står i `videoer/ferdige.yml`.
- **Videoer fra YouTube-spillelistene** (besluttet 12. nov. 2026): Spillelistene i `youtube.yml` hentes hver kveld av GitHub til `youtube-videoer.json` på grenen `data/youtube` (KI-øktene når ikke YouTube selv). Nattjobben setter nye videoer inn på sidene der de passer (`rutiner/nattjobb-instruks.md`, punkt 0d) og fører det i `rutiner/youtube-status.yml`. Ny spilleliste: én linje i `youtube.yml`. Miniatyrbildet er det samme som på YouTube, fordi videoene bygges inn med YouTube-spilleren.

## 6. Kontroll før levering

1. Regn ut alle tallsvar på nytt.
2. Sjekk at front matter har `title`, `tema` og `undertema`, at de finnes i `tema.yml`, og at `:::`-åpninger og -lukkinger går opp.
3. Sjekk at alle bilder det lenkes til, finnes.
4. Sjekk teksten mot reglene for kursnøytral tekst og notasjon.
5. Les siden én gang som en student.

## 7. Dashman (KI-læringspartneren)

Instruksen til Dashman står i `hint-tjener/dashman-instruks.md` (bygd på Load Reduction Instruction). Endrer læreren hvordan Dashman skal veilede eller oppføre seg, skrives det inn der. Oversikt og oppsett: `LESMEG.md`, avsnitt 11.

## 8. Dashman-tegningene (figuren)

Alle tegningene av Dashman (lærerens strekfigur) ligger i repoet [Realfagsambassaden/dashman](https://github.com/Realfagsambassaden/dashman): ferdige tegninger i `tegninger/` (med `OVERSIKT.md`) og en animerbar rigg (poser, øyne, munner, ekstra) i `rigg/`. Læreren vil ha **mye Dashman rundt på nettsidene**: forsider, temasider, oppgaver («Dashman skal …»), hint, tomme tilstander og feilsider. Bruk lærerens tegninger som de er, lyse streker på mørk bakgrunn og svarte på lys. Nye tegninger i samme stil kan lages, men merkes som KI-tegnet i `OVERSIKT.md`. Les README-en i Dashman-repoet før du bruker tegningene.
