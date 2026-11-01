# Rutine: behandling av donerte notater

Donasjoner kommer inn i det private repoet `Realfagsambassaden/donasjoner` (én mappe + én sak per donasjon).
Denne rutinen følges når Claude behandler en donasjon. Fagansvarlig godkjenner alltid før noe publiseres.

## 1. Les og kartlegg
- Les alle filene (PDF, LaTeX, bilder av håndskrift, lysbilder).
- Lag en innholdsliste: hvilke temaer dekkes, og hvilke **emner** i `emner.yml` hører de til?
- Sammenlign med det som allerede finnes under de samme emnene (se `innhold.json`). Merk: nytt / overlapper / bedre forklart enn det vi har.

## 2. Fyll ut det som mangler
Donerte notater er nesten alltid ufullstendige. De er skrevet for en forelesning, ikke for selvstudium. Claude fyller derfor ut:
- **Hoppede steg** i utledninger og regning, så studenter kan følge linje for linje.
- **Forklaringer** rundt formler: hva betyr symbolene, hvorfor gjør vi dette, når gjelder det.
- **Figurer** som er nevnt eller tydelig trengs, tegnet i krittstil/Dashman (ikke kopiert fra lærebøker).
- **Eksempler og oppgaver med fullstendig løsning**, så KI-hintene fungerer.
- **Manglende emnekobling og metadata** (emne, titler, rekkefølge), og en løype hvis notatene følger et bestemt kurs.
- Retting av åpenbare skrivefeil og fortegnsfeil (markeres for fagansvarlig).

## 3. Skill tydelig mellom giver og Claude
- I forslaget (pull request) markeres hvilke deler som er **giverens** og hvilke som er **lagt til av Claude**.
  Tillegg markeres i kildeteksten med en kommentar `<!-- tillegg: Claude -->` slik at fagansvarlig kan sjekke akkurat dem.
- Claude legger ikke til påstander utover etablert lærebokfysikk, og skriver i PR-en hvor den har vært usikker.

## 4. Lag forslaget
- Nye sider og endringer legges som pull request i riktig fag-/emnerepo, med forhåndsvisning.
- PR-beskrivelsen har: oppsummering, hva som er nytt vs. overlapp, liste over Claude-tillegg, åpne spørsmål til giveren.
- Kreditering lagres i metadata (`bidrag:` i toppen av sidene), ikke som navn i selve teksten.

## 5. Avslutt
- Saken i `donasjoner` lukkes med lenke til PR-en når den er godkjent og publisert.
- Giveren får beskjed (e-post) med lenke til sidene.
