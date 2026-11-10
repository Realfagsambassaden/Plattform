# Rutine: behandling av donerte notater

Donasjoner kommer inn i det private repoet `Realfagsambassaden/donasjoner` (én mappe + én sak per donasjon).
Denne rutinen følges når Claude behandler en donasjon. Fagansvarlig godkjenner alltid før noe publiseres. Den nattlige gjennomgangen følger i tillegg `rutiner/donasjonsjobb-instruks.md`.

## 1. Les og kartlegg
- Les alle filene (PDF, LaTeX, bilder av håndskrift, lysbilder).
- Lag en innholdsliste: hvilke temaer dekkes, og hvilke **temaer** i `tema.yml` hører de til?
- Sammenlign med det som allerede finnes under de samme temaene (se `innhold.json`). Merk: nytt / overlapper / bedre forklart enn det vi har.

## 2. Fyll ut det som mangler
Donerte notater er nesten alltid ufullstendige. De er skrevet for en forelesning, ikke for selvstudium. Claude fyller derfor ut:
- **Hoppede steg** i utledninger og regning, så studenter kan følge linje for linje.
- **Forklaringer** rundt formler: hva betyr symbolene, hvorfor gjør vi dette, når gjelder det.
- **Figurer** som er nevnt eller tydelig trengs, tegnet på nytt som TikZ (ikke kopiert fra lærebøker).
- **Eksempler og oppgaver med fullstendig løsning**, så KI-hintene fungerer.
- **Manglende temakobling og metadata** (tema, undertema, titler, rekkefølge), og en løype hvis notatene følger et bestemt kurs.
- Retting av åpenbare skrivefeil og fortegnsfeil (markeres for fagansvarlig).
- **Notasjon** etter `NOTASJON.md` (punktum som desimaltegn, konstanter i rett skrift, g = 9.81 m/s² osv.). Endrede tall og svar regnes ut på nytt og markeres.

Er deler av notatene lånt fra lærebøker eller andres materiale, skrives de om med egne ord, egne eksempler og nye figurer. Det som er lånt, kopieres ikke over.

## 3. Skill tydelig mellom giver og Claude
- I forslaget (pull request) markeres hvilke deler som er **giverens** og hvilke som er **lagt til av Claude**.
  Tillegg markeres i kildeteksten med en kommentar `<!-- tillegg: Claude -->` slik at fagansvarlig kan sjekke akkurat dem.
- Claude legger ikke til påstander utover etablert lærebokfysikk, og skriver i PR-en hvor den har vært usikker.

## 4. Lag forslaget
- Nye sider og endringer legges som pull request i riktig fagrepo, fra en gren som heter `donasjon/<mappenavn>`. Bruk aldri `natt/…`, for de flettes automatisk.
- PR-beskrivelsen har: oppsummering, hva som er nytt vs. overlapp, liste over Claude-tillegg, åpne spørsmål til giveren.
- Kreditering lagres i metadata (`bidrag:` i toppen av sidene), ikke som navn i selve teksten.

## 5. Avslutt
- Saken i `donasjoner` lukkes med lenke til PR-en når den er godkjent og publisert.
- Fagansvarlig gir giveren beskjed med lenke til sidene. Claude sender ikke e-post.
