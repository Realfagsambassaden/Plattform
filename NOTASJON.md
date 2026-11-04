# Notasjon – regler for alt fagstoff

**Versjon: 1** (4. november 2026)

Disse reglene gjelder alt fagstoff på fysikkhjelp.no og matematikkhjelp.no: sider i fagrepoene, emnetekster, oppgaver og løsninger, figurer og videomanus. De gjelder også donert stoff, som tilpasses når det legges inn. Er du i tvil, følg reglene her foran vanen i et enkelt dokument.

Når reglene endres, økes versjonsnummeret. Da regnes alt innhold som usjekket og gås gjennom på nytt (se nederst).

## 1. Naturkonstanter står i rett (oppreist) skrift

Alle naturkonstanter og faste fysiske størrelser skrives oppreist med `\mathrm{…}`, slik at de skilles fra variabler, som står i kursiv.

| Størrelse | Skrives | LaTeX |
|---|---|---|
| Tyngdeakselerasjonen | g | `\mathrm{g}` |
| Gravitasjonskonstanten | G | `\mathrm{G}` |
| Lysfarten i vakuum | c | `\mathrm{c}` |
| Elementærladningen | e | `\mathrm{e}` |
| Plancks konstant | h, ħ | `\mathrm{h}`, `\hbar` |
| Boltzmanns konstant | k_B | `\mathrm{k_B}` |
| Avogadros tall | N_A | `\mathrm{N_A}` |
| Den molare gasskonstanten | R | `\mathrm{R}` |
| Coulombs konstant | k_e | `\mathrm{k_e}` |
| Permittiviteten og permeabiliteten i vakuum | ε₀, μ₀ | `\varepsilon_0`, `\mu_0` (greske bokstaver står som de er) |
| Elektronmassen, protonmassen | m_e, m_p | `\mathrm{m_e}`, `\mathrm{m_p}` |

Andre faste størrelser følger samme regel. Matematiske konstanter står også oppreist: Eulers tall `\mathrm{e}`, imaginær enhet `\mathrm{i}`. π skrives `\pi`.

Variabler som tilfeldigvis har samme bokstav, står i kursiv som vanlig. For eksempel er *m* en masse og *e* en eksentrisitet, mens *G* er tyngde (tyngdekraft) i mekanikken. Skill dem med skrifttypen: $G = m\mathrm{g}$.

## 2. Tallverdier vi bruker

- **g = 9,81 m/s²**, med mindre oppgaven oppgir noe annet. Skriv `9{,}81\ \mathrm{m/s^2}`.
- Andre konstanter tas fra tabellen i læreverket eller fra CODATA, med 3–4 gjeldende siffer, med mindre oppgaven oppgir noe annet.

## 3. Gjeldende siffer

Gjelder svar i oppgaver, løsninger og eksempler, og tall i teksten ellers.

1. **Ganging og deling:** Svaret får like mange gjeldende siffer som den minst nøyaktige oppgitte verdien.
2. **Addisjon og subtraksjon:** Svaret får like mange desimaler som verdien med færrest desimaler.
3. **Mellomregning:** Behold minst ett–to ekstra siffer, og rund av bare i sluttsvaret. Skriv ikke avrundede mellomsvar videre som om de var eksakte.
4. **Eksakte tall** begrenser ikke antall siffer. Det gjelder telling, definisjoner og rene tall i formler, som ½ eller 2π.
5. **Konstanter** som g = 9,81 m/s² (3 siffer) teller med som oppgitte verdier.
6. **Tvetydige tall:** Bruk standardform når antall siffer ellers blir uklart, for eksempel $1{,}20\cdot10^3\ \mathrm{m}$ og ikke «1200 m».
7. Avrund ikke unødig hardt. Har dataene 3 gjeldende siffer, skal svaret ha 3.

## 4. Tall, enheter og formler

- **Desimalkomma:** `2{,}5` (krøllparentesene hindrer ekstra mellomrom). Ikke desimalpunktum i fagstoff. I kjørbar Python brukes punktum, som språket krever.
- **Tusenskille** brukes ikke i formler. Bruk standardform: `1{,}2\cdot10^3`.
- **Enheter** står oppreist med mellomrom fra tallet: `9{,}81\ \mathrm{m/s^2}`, `3{,}0\ \mathrm{kWh}`.
- **Differensialer** står oppreist: `\mathrm{d}t`, `\frac{\mathrm{d}v}{\mathrm{d}t}`.
- **Gangetegn:** `\cdot`. Bruk `\times` bare for kryssprodukt.
- **Vektorer** med pil: `\vec F`. Komponenter: `[x, y]`.
- **Sluttsvar** dobbelt understreket: `\underline{\underline{…}}`.

## 5. Faste symboler

| Størrelse | Symbol |
|---|---|
| Tyngde (kraft) | *G* |
| Normalkraft | *N* |
| Friksjonskraft | *f* (*R* for friksjon/motstand bare der læreverket gjør det) |
| Friksjonstall | μ_k (kinetisk), μ_s (statisk) |
| Startfart | *v*_0 |
| Strekning, posisjon | *s*, *x* |

Bruk samme symbol for samme størrelse på tvers av sider og fag.

## 6. Sjekk av innhold

- `rutiner/notasjon-status.yml` viser hvilke filer som er sjekket, mot hvilken versjon av reglene, og innholdet (git-blob) som ble sjekket.
- En fil er **usjekket** når den mangler i statusfila, er sjekket mot en eldre versjon, eller har endret seg siden sjekken.
- Nattjobben går gjennom usjekkede filer hver natt og retter dem etter reglene. Når et tall endres (f.eks. g = 9,8 → 9,81), regnes alle svar som avhenger av det ut på nytt.
- **Nye regler:** Øk versjonsnummeret øverst og skriv en linje i endringsloggen under. Da er alt usjekket, og nattjobben går gjennom alt innholdet på nytt.

## Endringslogg

- **Versjon 1** (4. november 2026): Naturkonstanter oppreist, g = 9,81 m/s², regler for gjeldende siffer, og samling av eksisterende regler for tall, enheter og symboler.
