# Skriveregler – slik skriver vi fagstoff

Disse reglene gjelder alle som skriver lærestoff-sider og emnetekster for fysikkhjelp.no og matematikkhjelp.no: lærere, studenter og KI-agenter. Notasjonen (tall, enheter, konstanter, gjeldende siffer) står i [NOTASJON.md](NOTASJON.md), og den går foran alt annet. Her står resten: hvor stoffet skal ligge, hvordan en side bygges opp, tone og pedagogikk, kontroll og levering.

Videoer har egne regler i repoet [Realfagsambassaden/videoer](https://github.com/Realfagsambassaden/videoer) (`CLAUDE.md` og `LESMEG.md`).

## 1. Hvor stoffet skal ligge

| Hva | Hvor |
|---|---|
| Emnekartet (områder → emner → delemner) | `Plattform/emner.yml` (matematikk: `Plattform/matematikkhjelp/emner.yml`) |
| Emnetekst: kort introduksjon øverst på emnesiden (2–6 setninger, gjerne en video) | `Plattform/emner-tekster/<emne-id>.md` (matematikk: `matematikkhjelp/emner-tekster/`) |
| Lærestoff-sider: teori, eksempler, oppgaver med løsning | Fagrepoene, `kapitler/NN-<navn>/NN-<side>.qmd`. Fagene står i `Plattform/fag.yml`. |
| Nye fag | Lages fra malen `Realfagsambassaden/fag-mal` og legges inn i `Plattform/fag.yml` |
| Manus og animasjon til videoer | `Realfagsambassaden/videoer` |

- Ny side i et eksisterende fag: legg den i kapittelet der den hører hjemme, med neste ledige nummer (`04-ny-side.qmd`). Nytt kapittel er en ny mappe `NN-navn/` med `index.qmd` (front matter: `title`, valgfritt `del` og `tegning`).
- Ikke press et emne inn i et fag der det ikke hører hjemme. Mangler det et fag, foreslå et nytt fagrepo fra malen.
- Mangler emnet eller delemnet i emnekartet, foreslå id, tittel og område, og legg det til i `emner.yml` i en egen pull request.
- **Ikke rediger genererte filer:** `_site/`, `forkurs/`, `emner/`, `kilder/`, `innhold.json`, `_fag.json`.
- **Ikke rør** `kosmoben/TRES0312` (forkurset i LaTeX). Det kobles til emnene i `Plattform/loyper/forkurs-tres0312.yml`.

## 2. Front matter

```yaml
---
title: "Bevegelseslikningene for konstant akselerasjon"
emne: kinematikk                 # må finnes i emner.yml
delemne: konstant-akselerasjon   # må finnes under emnet i emner.yml
---
```

`niva` (forkurs, ingenior, fordypning) settes vanligvis av faget og trengs bare når en side avviker fra resten av faget.

## 3. Oppbygging av en lærestoff-side

1. **Video øverst**, hvis den finnes: `{{< video https://www.youtube.com/watch?v=… >}}`. Venter siden på video, står plassholderen fra videoverkstedet der i stedet (se `videoer/LESMEG.md`). Den skal ikke fjernes for hånd.
2. **Innledning** med et konkret fenomen fra hverdagen: hvorfor er dette interessant?
3. **Teori** i korte avsnitt med `##`-overskrifter. Én idé om gangen.
4. **Minst ett gjennomregnet eksempel** (`{.eksempel}` med `{.losning}`).
5. Gjerne **figur** og **kjørbar Python** der det hjelper.
6. **3–6 oppgaver med fullstendig løsning** nederst, med stigende vanskegrad.

### Byggeklosser

```markdown
::: {.callout-note title="Definisjon: Fart"}
…
:::

::: {.graa}
$$
v = \frac{s}{t}
$$
:::

::: {.eksempel}
**Eksempel: Kort tittel.** Oppgaveteksten.

::: {.losning}
Fullstendig løsning.
:::
:::

:::: {.oppgaver}

::: {.oppgave tittel="Kort, konkret tittel"}
Oppgavetekst. a) … b) …

::: {.losning}
Fullstendig løsning med mellomregning og svar.
:::
:::

::: {.oppgave tittel="…" niva="Middels"}
…
:::

::::
```

- **Bokser:** `{.callout-note title="Definisjon: …"}`, `{.callout-tip title="Tips"}`, `{.callout-warning}`, `{.callout-important}`, `{.graa}` (grå boks for sentrale formler og tabeller) og `{.eksempel}` med `{.losning}` inni.
- **Oppgaver** samles i én `:::: {.oppgaver}` (fire kolon) nederst. Hver `::: {.oppgave tittel="…"}` har nøyaktig én `::: {.losning}`. Vanskegrad: `niva="Middels"` eller `niva="Utfordrende"`. Lette oppgaver har ingen `niva`.
- **Kolon-nivåene må gå opp:** hver åpning har en lukking med like mange kolon.
- **Kjørbar Python:** en kodeblokk som starter med ` ```{.python .kjor}`. Korte programmer med numpy/matplotlib og variabler studenten kan endre, og en oppfordring i teksten («Endre vinkelen og trykk **Kjør**»).
- **Figurer:** I fagrepoer med `figurer/` skrives bare innholdet i `tikzpicture` i `figurer/<navn>.tex` (se `figurer/_mal.tex`), og `python3 figurer/lag.py` lager `bilder/<navn>.svg`. Sett inn med `![](../../bilder/navn.svg){.tikz-fig style="width:420px"}`. Tegn svart på hvitt; nettsiden gjør det om til kritt på tavla. Se på figuren før du bruker den.
- **Tabeller** i vanlig Markdown, gjerne inni `{.graa}`.

### Emnetekster

Kort (2–6 setninger) og innbydende: hva emnet handler om, hvorfor det er nyttig, og en oppfordring til å starte med sidene under. Se `emner-tekster/arbeid-og-energi.md`.

## 4. Tone og pedagogikk

- **Nivå:** tilpass faget. Forkurs: ingen kalkulus der det kan unngås, og mange regneeksempler. Ingeniørnivå: derivasjon og integrasjon brukes der det hjelper, men forklares. Les en eksisterende side i samme fag før du skriver, og treff samme tone.
- Begynn med et konkret fenomen. Én idé om gangen, korte avsnitt. Forklar *hvorfor*, ikke bare *hvordan*.
- Gi en fast framgangsmåte der det passer («Fire steg som alltid virker»).
- Skriv til noen som ikke kan faget fra før. Ingen hopp i resonnementet.
- **Språk:** klart bokmål og aktive setninger. Bruk norske fagord: fart, akselerasjon, bevegelsesmengde, kraftmoment, dreieimpuls, likevekt, friksjonstall.
- **Løsninger skal være fullstendige**, med mellomregning og forklaring. KI-hintene på nettsiden bygger på løsningen, så en tynn løsning gir dårlige hint.
- Sluttsvar er dobbelt understreket, og antall gjeldende siffer følger NOTASJON.md.

## 5. Merking, rettigheter og personvern

- **Merk stoff skrevet av KI** med `<!-- tillegg: Claude -->` (eller navnet på verktøyet) foran det som er skrevet. Fagrepoene lover leserne at dette er merket.
- **Donert stoff** er merket `<!-- fra notatene -->`. Behold merkingen. Retter du en feil i donert stoff, skriv en kort kommentar: `<!-- tillegg: Claude: rettet fortegn, notatene hadde … -->`. Rutinen for donasjoner står i [rutiner/donasjoner.md](rutiner/donasjoner.md).
- **Skriv eget stoff.** Ikke kopier tekst, figurer eller oppgaver fra lærebøker eller nettsider. Henvisninger som «Tilsvarer kapittel 13 i OpenStax *University Physics*» er fint.
- **Videoer:** bruk bare YouTube-lenker du har sjekket at virker og handler om riktig emne. Finn aldri på en lenke.
- **Ingen personopplysninger.** Repoene er offentlige.

## 6. Kontroll før innsending

1. **Regn ut alle tallsvar på nytt** (gjerne i Python): i eksempler, løsninger og tekst.
2. **Sjekk strukturen:** `title`, `emne` og `delemne` finnes og stemmer med `emner.yml`, og `:::`-nivåene går opp.
3. **Sjekk notasjonen** mot NOTASJON.md: punktum som desimaltegn, enheter og konstanter oppreist, gjeldende siffer.
4. **Sjekk bildelenkene:** alle `bilder/…` det lenkes til, finnes.
5. **Les gjennom siden som en student:** henger forklaringen sammen?

## 7. Levering

- Alt som havner på `main`, publiseres automatisk etter noen minutter. **Skriv aldri rett til `main`.** Bruk en gren og en pull request (unntak: repoet `videoer`, der ingenting vises på nettsiden).
- Gren med beskrivende navn (`ny-side-gravitasjon`, `emnetekst-kinematikk`). Nattjobben bruker `natt/<emne-id>-<kort-navn>`.
- Én pull request per side (emnetekster og endringer i `emner.yml` i egne PR-er til Plattform).
- PR-beskrivelse på norsk: hva som er lagt til, hvilket emne og delemne, valg du har tatt, og en sjekkliste for den som ser over (fagstoff, formler, oppgaver, video).
- **Fra en KI-agent:** bruk REST (`gh api repos/Realfagsambassaden/<repo>/pulls -f title=… -f head=<gren> -f base=main -f body=…`). GraphQL og `gh pr` virker ikke i alle miljøer.

## Endringslogg

- **4. november 2026:** Første versjon. Samler reglene fra innholdsassistenten (Claude-ferdigheten `fysikkhjelp-innhold`) slik at alle bidragsytere og agenter følger samme mal.
