# fysikkhjelp.no

Dette repoet er selve nettsiden. Innholdet hentes fra fagrepoene (foreløpig `kosmoben/TRES0312`). Du skriver i LaTeX i fagrepoet som før, pusher, og et par minutter senere er fysikkhjelp.no oppdatert.

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
