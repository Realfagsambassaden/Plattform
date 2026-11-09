# Forkurs i fysikk: kart over temaer og skriverekkefølge (9. nov. 2026)

Kilde: innholdsfortegnelsen fra læreren. Vi skriver eget stoff som dekker samme temaer. Bare temaene hentes fra boka, aldri tekst, figurer eller oppgaver. Sidene skal være kursnøytrale og ikke nevne boka.

**Lærerens ønske om rekkefølge:** Vektorer tidlig som verktøy. Boka sine kapitler 12–13 (Bevegelse II, Kraft og bevegelse II) bakes inn i kapitlene om bevegelse og kraft (1–2), i stedet for å komme tilbake senere. Matematikken dekkes også i forkurs matematikk (`matte-forkurs`, se punkt 2b i nattjobben), med vektorer og trigonometri først.

**Status for rekkefølgen:** Faget er allerede bygd slik: `02-matematikk` har vektorer før `03-kinematikk`, og kinematikk og krefter har to dimensjoner og sirkelbevegelse i samme kapittel. Det trengs derfor ingen stor omstrukturering, bare de nye sidene under.

Tegn: ✓ = dekket, ⚠ = finnes, men tynn eller «under arbeid», P = plassholder, **NY** = side som mangler helt.

| Bokas del | Side i fysikk-forkurs | Status |
|---|---|---|
| 1.1 Enheter og konstanter | 01/03–06 | ✓ |
| 1.2–1.5 Posisjon, fart, akselerasjon, konstant a | 03/01–04 | ✓ |
| 12.1–12.3 Vektorene fart og a, 2D | 02/04–05, 03/06 | ✓ |
| 12.4 Sirkelakselerasjon | 03/05 | ✓ |
| 2.1–2.4 Krefter, Newtons lover, tyngde | 04/02–03 | ✓ |
| 2.5–2.6 Fjærkraft, friksjon | 04/03 | ✓ |
| 13.1 Newtons lover i planet | 04/04 | ✓ |
| 13.2 Krefter i sirkelbevegelse | 04/05 | ✓ |
| 13.3 Elastisk pendel, svingninger | 07/01–02 | ✓ |
| **13.4 Sammensatte mekanikkoppgaver** | 04 (ny side) | **NY** |
| 3.1 Arbeidsmetoder, hypoteser, naturlover | 01/01 + 01/10 | P |
| 3.2 Måleusikkerhet | 01/08 | P |
| **3.3 Usikkerhet i sammensatte størrelser** | Samme bolk som signifikante siffer (se punkt 1 under) | **NY** |
| 3.4 Grafisk utjevning | 01/09 | P |
| 4.1–4.6 Energi | 05/01–05 | ✓ |
| 5.1–5.3 Bevegelsesmengde, støt, impuls | 04/01, 04/06, 05/06 | ✓ (04/01 kort) |
| 6.1–6.3 Massetetthet, trykk, oppdrift | 08/01–04 | ✓ |
| 6.4 Temperatur | 09/01 | ✓ ⚠ |
| 6.5 Tilstandslikningen | 09/05 | ✓ ⚠ |
| 7.1–7.3 Indre energi, 1. lov, kalorimetri | 09/01–04 | ✓ ⚠ |
| 7.4–7.5 2. lov, kjøleskap, varmepumper | 09/07 | ✓ |
| **8.1 Stoffmengde** | 09 (ny side, nå bare en merknad i 09/05) | **NY** |
| 8.2–8.3 Prosesser, arbeid ved ekspansjon | 09/06 | ⚠ (717 ord) |
| 8.4 Varmetransport | 09/08 | ✓ |
| 9.1–9.2 Bølger, lysbølger | 10/01 | P |
| 9.3 Atomet | 12/01 | P |
| **9.4 Kvanter og fotoner** | 12 (ny side) | **NY** |
| 9.5 Bohrs atommodell | 12/02 | P |
| **9.6 Atomkjernen** | 12 (ny side) | **NY** |
| 9.7–9.8 Radioaktivitet, omdanning | 12/03–04 | P |
| 10.1–10.2 Termisk stråling, drivhuseffekt | 10/02–04 | P |
| 11.1–11.5, 11.7 Elektrisitet | 11/01–05 | ⚠ (237–616 ord, «under arbeid») |
| 11.6 EMS, indre resistans | 11/06 | P |
| 14.1–14.3 Statikk | 06/01–04 | ✓ |
| 15.1 Bevegelsesgrafer | 13/02 | P |
| 15.2–15.3 Fall og skrått kast med luftmotstand | 13/03 (bør bli to sider) | P + **NY** |
| **15.4 Svingninger numerisk** | 13 (ny side) | **NY** |
| **15.5 Arbeid og numerisk integrasjon** | 13 (ny side) | **NY** |

**Tas bort fra forkurset (lærerens beslutning 9. nov.):** Plassholderne `04-krefter/07-luftmotstand`, `08-gravitasjonsloven` og `09-satellitter-og-planetbaner` skal ikke skrives i fysikk-forkurs. Luftmotstand finnes allerede i `ingeniorfysikk` (`03-dynamikk/05-luftmotstand`). Læreren mener temaene kanskje hører hjemme på ingeniørnivå, i alle fall luftmotstand; gravitasjon er ikke besluttet der og skrives ikke uten beskjed. Numerisk fall med luftmotstand (15.2–15.3) blir værende i programmeringskapitlet.

**Rekkefølge for skriving:**

0. **Rydding først, i én egen PR (gren `natt/krefter-rydd-plassholdere`):** Slett de tre plassholderfilene over, og gi `10-ekstraoppgaver.qmd` nytt nummer `07` med den gamle adressen i `aliases:`. Ingen andre sider eller løyper lenker til dem (sjekket 9. nov.). Sammensatte mekanikkoppgaver settes så inn før ekstraoppgavene.
1. Arbeidsmetoder, utvidet etter lærerens ønske: Usikkerhet skal stå i samme bolk som signifikante siffer, standardform og regning med enheter, i temaet `maling-og-usikkerhet` i kapitlet `01-hva-er-fysikk`. Flytt plassholderen for måleusikkerhet (`08`) rett etter `05-signifikante-siffer`, skriv den, og legg ny side om usikkerhet i sammensatte størrelser rett etter den. Gi de påfølgende filene nye nummer med gamle adresser i `aliases:`. Utvid `05-signifikante-siffer` med en kobling mellom gjeldende siffer og usikkerhet (behold lærerens tekst). Skriv deretter 09 (grafisk utjevning) og 10 (forsøk og rapport).
2. Sammensatte mekanikkoppgaver (1 ny).
3. Termofysikk: stoffmengde (ny), utvide 09/06, rydde «under arbeid».
4. Elektrisitet: utvide 11/01–05, skrive 11/06. Lærerens tekst beholdes og bygges ut.
5. Bølger og stråling: 10/01–04.
6. Atom og kjerne: 12/01–04 + to nye.
7. Programmering: 13/01–03 + to til tre nye.

Omtrent 20 sider å skrive og 6–8 sider å bygge ut. Temaer og undertemaer som mangler i `tema.yml` må vurderes for sidene merket NY.
