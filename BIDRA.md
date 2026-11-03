# Bidra til Realfagsambassaden

Velkommen! Denne veiledningen er for deg som skal hjelpe til med nettsidene. Du trenger ikke være programmerer. Mye av arbeidet kan gjøres med Claude eller direkte i GitHub i nettleseren.

## 1. Hva er hva

Realfagsambassaden har tre nettsider, og alle bygges fra dette repoet (**Plattform**):

| Nettside | Hvor den ligger i repoet | Hva den er |
|---|---|---|
| **fysikkhjelp.no** | Hele repoet, utenom `ambassaden/` | Fagnettsiden: emner, løyper, videoer, kjørbar kode og oppgaver med KI-hint. Bygges med Quarto. |
| **matematikkhjelp.no** | `matematikkhjelp/` | Matematikknettsiden. Samme verktøy og utseende som fysikkhjelp.no, men med eget emnekart (`matematikkhjelp/emner.yml`) og egne emnetekster (`matematikkhjelp/emner-tekster/`). |
| **realfagsambassaden.no** | `ambassaden/` | Samlesiden: enkle HTML-sider (`public/`) og en liten tjeneste som tar imot donasjoner (`worker.js`). |

Organisasjonen har også repoer for fag (`fag-mal`, `ingeniorfysikk`) og et privat repo for innsendt materiale (`donasjoner`). Disse og forkurset (TRES0312) tas hånd om av kjerneteamet.

En mer teknisk beskrivelse av mappene og byggingen står i [LESMEG.md](LESMEG.md).

## 2. Hva vi ønsker bidrag til: emner

Alt stoff på fysikkhjelp.no er bygget opp rundt **emner**, for eksempel «Kinematikk», «Arbeid og energi» og «Trykk og oppdrift». Emnene er grunnmuren. **Løypene** (kursene på nettstedet) legges oppå emnene og lages av kjerneteamet. Som bidragsyter jobber du med emnene, ikke med løyper eller fag.

**Slik bidrar du til et emne:**

1. **Finn emnet** i [`emner.yml`](emner.yml) (fysikk) eller [`matematikkhjelp/emner.yml`](matematikkhjelp/emner.yml) (matematikk). Hvert emne har en `id`, for eksempel `arbeid-og-energi`.
2. **Skriv emneteksten** i fila `emner-tekster/<emne-id>.md`, for eksempel `emner-tekster/arbeid-og-energi.md`. For matematikk bruker du `matematikkhjelp/emner-tekster/<emne-id>.md`. Finnes fila, bygger du videre på den. Finnes den ikke, lager du den. Teksten vises øverst på emnesiden.
3. **Send inn endringen** som en pull request (se avsnitt 4).

Emneteksten skrives i Markdown. Matematikk skrives med `$...$`, og en YouTube-video legges inn slik:

```
{{< video https://www.youtube.com/watch?v=... >}}
```

Se [`emner-tekster/arbeid-og-energi.md`](emner-tekster/arbeid-og-energi.md) for et eksempel.

**Mangler et emne?** Foreslå det i en *issue* på GitHub, eller legg det til i `emner.yml` i en pull request. Skriv hvilket område det hører til.

**Har du forelesningsnotater eller annet ferdig materiale?** Send det inn via [realfagsambassaden.no/doner.html](https://realfagsambassaden.no/doner.html), så finner kjerneteamet ut hvor det passer.

## 3. Kom i gang

1. **Lag en GitHub-konto** på github.com hvis du ikke har en.
2. **Godta invitasjonen** til organisasjonen Realfagsambassaden. Den kommer på e-post.
3. **Velg hvordan du vil jobbe:**
   - **Med Claude:** Koble GitHub til Claude-kontoen din under *Innstillinger → Tilkoblinger*. Gi tilgang til repoene i Realfagsambassaden. Se avsnitt 5.
   - **I nettleseren:** Små tekstendringer kan gjøres rett på github.com. Åpne fila, klikk på blyanten og følg avsnitt 4.
   - **På egen maskin:** Bruk VS Code eller GitHub Desktop. Vil du forhåndsvise fysikkhjelp.no lokalt, står oppskriften i LESMEG.md, avsnitt 2.

## 4. Slik sender du inn en endring

Alt som havner på `main`, publiseres automatisk til nettsidene etter noen minutter. Derfor går alle endringer via en **pull request** som blir sett over før den slås sammen.

1. **Lag en egen gren** (branch) med et beskrivende navn, for eksempel `rett-skrivefeil-forside` eller `nytt-emne-bolger`.
2. **Gjør endringene** og lagre dem (commit) med en kort melding om hva du har gjort.
3. **Åpne en pull request** mot `main`. Skriv kort hva som er endret og hvorfor.
4. **Vent på godkjenning.** Noen ser over endringen og slår den sammen (merge).
5. **Følg med under Actions** på GitHub. Grønn hake betyr at endringen er ute på nett. Rødt kryss betyr at noe feilet, og da får du e-post.

Redigerer du i nettleseren, gjør GitHub punkt 1–3 for deg. Velg «Create a new branch» når du lagrer.

## 5. Jobbe med Claude

Når GitHub er koblet til, kan Claude lese repoet, gjøre endringer og åpne pull requests for deg.

- **Si hvilket repo og hvilken nettside** det gjelder, for eksempel: «I Realfagsambassaden/Plattform: skriv et utkast til emneteksten for emnet Kinematikk, og lag en pull request.»
- **Be om en pull request**, ikke at Claude skriver rett til `main`. Da kan endringen ses over før den publiseres.
- **Se over resultatet** før du ber om godkjenning. Les gjennom endringene i pull requesten, og sjekk fagstoff, formler og lenker selv.
- **Fortell Claude om denne fila.** Be Claude lese `BIDRA.md` og `LESMEG.md` først. Da følger den de samme reglene som alle andre.

## 6. Regler

- **Ikke skriv rett til `main`.** Bruk alltid en gren og en pull request.
- **Ikke rediger filer som lages automatisk.** Det gjelder blant annet `_site/`, `forkurs/`, `emner/`, `kilder/` og `innhold.json` (se `.gitignore`). Endringer der blir overskrevet ved neste bygging.
- **Ingen hemmeligheter i repoet.** API-nøkler og passord ligger som «secrets» i GitHub og Cloudflare, aldri i filene. Ser du en nøkkel i en fil, si fra med en gang.
- **Ingen personopplysninger.** Navn, e-postadresser og innsendt materiale fra brukere hører ikke hjemme i dette repoet. Repoet er offentlig.
- **Kildehenvisning og rettigheter.** Bruk bare bilder, tekst og videoer som vi har lov til å bruke, og oppgi kilden.

## 7. Vanlige oppgaver

| Oppgave | Hvor |
|---|---|
| Skrive eller forbedre teksten til et emne | `emner-tekster/<emne-id>.md` |
| Foreslå et nytt emne | `emner.yml`, eller en *issue* på GitHub |
| Rette en skrivefeil på forsiden til fysikkhjelp.no | `index.qmd` |
| Rette en skrivefeil på realfagsambassaden.no | `ambassaden/public/` |
| Dele forelesningsnotater eller annet materiale | [realfagsambassaden.no/doner.html](https://realfagsambassaden.no/doner.html) |

Løyper (`loyper/`), fag (`fag.yml` og fagrepoene), utseende og tekniske deler som hint-tjeneren tas hånd om av kjerneteamet. Ser du noe som bør endres der, opprett en *issue*.

## 8. Spørsmål

Lurer du på noe, spør den som inviterte deg, eller opprett en *issue* på GitHub med spørsmålet.
