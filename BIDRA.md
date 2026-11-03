# Bidra til Realfagsambassaden

Velkommen! Denne veiledningen er for deg som skal hjelpe til med nettsidene. Du trenger ikke være programmerer. Mye av arbeidet kan gjøres med Claude eller direkte i GitHub i nettleseren.

## 1. Hva er hva

Realfagsambassaden har to nettsider, og begge bygges fra dette repoet (**Plattform**):

| Nettside | Hvor den ligger i repoet | Hva den er |
|---|---|---|
| **fysikkhjelp.no** | Hele repoet, utenom `ambassaden/` | Fagnettsiden: emner, løyper, videoer, kjørbar kode og oppgaver med KI-hint. Bygges med Quarto. |
| **realfagsambassaden.no** | `ambassaden/` | Samlesiden: enkle HTML-sider (`public/`) og en liten tjeneste som tar imot donasjoner (`worker.js`). |

Andre repoer i organisasjonen:

- **fag-mal**: malen for nye fag. Nye fag lages med «Use this template».
- **ingeniorfysikk**: et fag laget fra malen. Hentes inn på nettsiden via `fag.yml`.
- **donasjoner**: privat. Her havner innsendt materiale. Bare de som trenger det, har tilgang.

Forkurset (TRES0312) skrives i LaTeX i et eget repo og hentes inn automatisk. Rettinger i forkurset gjøres der, ikke her.

En mer teknisk beskrivelse av mappene og byggingen står i [LESMEG.md](LESMEG.md).

## 2. Kom i gang

1. **Lag en GitHub-konto** på github.com hvis du ikke har en.
2. **Godta invitasjonen** til organisasjonen Realfagsambassaden. Den kommer på e-post.
3. **Velg hvordan du vil jobbe:**
   - **Med Claude:** Koble GitHub til Claude-kontoen din under *Innstillinger → Tilkoblinger*. Gi tilgang til repoene i Realfagsambassaden. Se avsnitt 4.
   - **I nettleseren:** Små tekstendringer kan gjøres rett på github.com. Åpne fila, klikk på blyanten og følg avsnitt 3.
   - **På egen maskin:** Bruk VS Code eller GitHub Desktop. Vil du forhåndsvise fysikkhjelp.no lokalt, står oppskriften i LESMEG.md, avsnitt 2.

## 3. Slik sender du inn en endring

Alt som havner på `main`, publiseres automatisk til nettsidene etter noen minutter. Derfor går alle endringer via en **pull request** som blir sett over før den slås sammen.

1. **Lag en egen gren** (branch) med et beskrivende navn, for eksempel `rett-skrivefeil-forside` eller `nytt-emne-bolger`.
2. **Gjør endringene** og lagre dem (commit) med en kort melding om hva du har gjort.
3. **Åpne en pull request** mot `main`. Skriv kort hva som er endret og hvorfor.
4. **Vent på godkjenning.** Noen ser over endringen og slår den sammen (merge).
5. **Følg med under Actions** på GitHub. Grønn hake betyr at endringen er ute på nett. Rødt kryss betyr at noe feilet, og da får du e-post.

Redigerer du i nettleseren, gjør GitHub punkt 1–3 for deg. Velg «Create a new branch» når du lagrer.

## 4. Jobbe med Claude

Når GitHub er koblet til, kan Claude lese repoet, gjøre endringer og åpne pull requests for deg.

- **Si hvilket repo og hvilken nettside** det gjelder, for eksempel: «I Realfagsambassaden/Plattform, på realfagsambassaden.no: legg til en side om hvem vi er.»
- **Be om en pull request**, ikke at Claude skriver rett til `main`. Da kan endringen ses over før den publiseres.
- **Se over resultatet** før du ber om godkjenning. Les gjennom endringene i pull requesten, og sjekk fagstoff, formler og lenker selv.
- **Fortell Claude om denne fila.** Be Claude lese `BIDRA.md` og `LESMEG.md` først. Da følger den de samme reglene som alle andre.

## 5. Regler

- **Ikke skriv rett til `main`.** Bruk alltid en gren og en pull request.
- **Ikke rediger filer som lages automatisk.** Det gjelder blant annet `_site/`, `forkurs/`, `emner/`, `kilder/` og `innhold.json` (se `.gitignore`). Endringer der blir overskrevet ved neste bygging.
- **Ingen hemmeligheter i repoet.** API-nøkler og passord ligger som «secrets» i GitHub og Cloudflare, aldri i filene. Ser du en nøkkel i en fil, si fra med en gang.
- **Ingen personopplysninger.** Navn, e-postadresser og innsendt materiale fra brukere hører ikke hjemme i dette repoet. Repoet er offentlig.
- **Kildehenvisning og rettigheter.** Bruk bare bilder, tekst og videoer som vi har lov til å bruke, og oppgi kilden.

## 6. Vanlige oppgaver

| Oppgave | Hvor |
|---|---|
| Endre teksten på forsiden til fysikkhjelp.no | `index.qmd` |
| Endre realfagsambassaden.no | `ambassaden/public/` (`index.html`, `stil.css`) |
| Skrive innledning til et emne | `emner-tekster/<emne-id>.md` |
| Legge til eller endre emner | `emner.yml` |
| Lage eller endre en løype (kurs) | `loyper/` |
| Legge til et nytt fag | Lag et repo fra `fag-mal`, og legg det inn med én linje i `fag.yml` |
| Legge til kjørbar Python i forkurset | `verktoy/tillegg/<kapittelmappe>/<side>.md` |
| Endre utseendet | `assets/tavle.scss` |

## 7. Spørsmål

Lurer du på noe, spør den som inviterte deg, eller opprett en *issue* på GitHub med spørsmålet.
