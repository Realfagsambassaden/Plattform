# Investorpresentasjon og forretningsplan

Presentasjonen og forretningsplanen for Realfagsambassaden, laget 1. november 2026 og hentet hit 9. november 2026 slik at alle agenter kan bygge videre på dem.

Mappen publiseres **ikke** på nettstedene: Quarto bygger bare `*.qmd`, og realfagsambassaden.no publiserer bare `ambassaden/public/`.

## Innhold

| Fil | Hva |
|---|---|
| `slides/<id>.html` | Én fil per lysbilde, 1920 × 1080 px, alle stiler inline. Kilden – rediger her. |
| `deck.json` | Rekkefølge (`order`), seksjoner og skrifter (Google Fonts). |
| `bilder/` | Bildene lysbildene bruker (kopier fra `assets/img/` og `ambassaden/public/img/`). |
| `presentasjon.html` | Frittstående visning av alle lysbildene. Åpne i nettleser. Lages på nytt med `python3 lag.py`. |
| `forretningsplan.md` | Forretningsplanen med kilder og åpne spørsmål. |

## Slik bygger du videre

1. Rediger lysbildene i `slides/` (og `deck.json` hvis du legger til, fjerner eller flytter lysbilder).
2. Kjør `python3 lag.py` for å lage `presentasjon.html` på nytt, og se på resultatet.
3. Lysbildene følger formatet til Claude Slides: én `<section id="…">` per fil, inline-stiler i px, bilder med relativ sti `../bilder/…`, talenotater i `<aside>` sist i seksjonen. `<x-shape kind="arrow-right">` vises som en pil (→) i `presentasjon.html`.

## Stil

Samme tavle-tema som nettsidene (`assets/tavle.scss`):

| Navn | Farge |
|---|---|
| Tavle (bakgrunn) | `#0d1110`, `#151b19` |
| Linje | `#2a3330` |
| Kritt (tekst) | `#ecefe6` |
| Støv (dempet tekst) | `#9aa49e` |
| Neon (aksent) | `#6ef04a` |
| Gul (håndskrift) | `#eee462` |
| Oransje | `#f19c2c` |
| Cyan | `#56d7b8` |

Skrifter: Comic Neue (tekst), Montserrat 900 (store tall), Architects Daughter (håndskrevne notater).

Budskapet som skal fram: **drevet av fagfolk, gratis i utgangspunktet**.

## Gjenstår

- Beløpet vi søker står som `[kr ___]` på siste lysbilde (`slides/ask.html`).
- «ca. 55 000 realfagsstudenter» er et anslag (18 % av 311 000) og bør byttes med SSBs fagfeltstatistikk.
- E-postadressen drnormann@fysikkhjelp.no på siste lysbilde er ikke satt opp ennå.
- Teamlysbildet viser bare Ben og Andrea. Flere ambassadører (portretter i `ambassaden/public/img/`) kan legges til.
