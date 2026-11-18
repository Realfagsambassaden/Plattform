// KI-tjener for fysikkhjelp.no (Cloudflare Worker).
//   POST /hint     – ETT hint til en oppgave (åpent for alle)
//   POST /vurder   – studieappen: vurderer studentens forklaring (tekst og/eller bilde) til et quizspørsmål. Krever innlogging.
//   POST /rad      – studieappen: personlig råd om eksamensforberedelse ut fra kunnskapsprofilen. Krever innlogging.
//   POST /fagforslag – kursbyggeren: forslag til moduler og uker ut fra emnebeskrivelse og læringsutbytte. Bare for undervisere.
//   POST /kvisslag – kursbyggeren: flervalgsspørsmål til et arbeidskrav, eventuelt ut fra underviserens egne oppgaver
//                    (tekst, bilde eller PDF). Bare for undervisere. Ingenting lagres i tjenesten.
//   POST /materiale – kursbyggeren («Mitt materiale»): plan for dagen og slides til én samling, ut fra undertemaene og
//                    lærestoffet på nettstedet, eventuelt et gammelt opplegg (tekst, bilde eller PDF). Bare for undervisere.
//   POST /dashman  – Dashman, KI-læringspartneren: samtale med en innlogget student, bygd på LRI (instruksen står i
//                    dashman-instruks.md). Får studentens nivå, mål, notat, kunnskapsprofil og kurs (fase og faglærerens
//                    instrukser) fra Supabase. Samtalen lagres ikke; bare et kort faglig notat, som studenten kan slette.
//   POST /dekning  – dekningskart: hvor godt dekker fysikkhjelp.no et emne? Åpent for alle;
//                    innloggede brukere får i tillegg sidene/veikartet.
// API-nøkler ligger som hemmeligheter i Cloudflare og vises aldri på nettsiden.
//
// INNSTILLINGER (variabler/hemmeligheter på workeren i Cloudflare, ingen kodeendring):
//   KI-leverandør:
//     LEVERANDOR = "claude"  (standard)  -> hemmelighet ANTHROPIC_API_KEY
//     LEVERANDOR = "openai"              -> hemmelighet KI_API_KEY, og variabelen KI_URL
//          KI_URL = adressen til en tjeneste med OpenAI-format, f.eks. NTNU sin GPT-server:
//                   "https://gpt.ntnu.no/api/models/chat-completion"  (MODELL = "gpt-oss-120b")
//     MODELL = navnet på modellen (valgfritt). Standard: "claude-haiku-5-5" for Claude.
//   Innlogging (Supabase), for /dekning:
//     SUPABASE_URL      = "https://<prosjekt>.supabase.co"
//     SUPABASE_ANON_KEY = den offentlige nøkkelen (anon / publishable)
//          eller NTNUs felles gateway: KI_URL = "https://llm.hpc.ntnu.no/v1/chat/completions" (personlig nøkkel fra help@hpc.ntnu.no).
//          NB: NTNUs modeller kan bare nås fra NTNU-nettet. Workeren må da gå via en mellomtjener inne i NTNU-nettet.
//   Bilder (studieappen): Claude leser bilder. Med LEVERANDOR = "openai" må en modell som leser bilder velges med
//     MODELL_BILDE (f.eks. en Mistral Large 3-modell hos NTNU), og KI_BILDER = "ja". Ellers svarer /vurder at
//     bildevurdering ikke er tilgjengelig (tekstsvar virker fortsatt).
//   Valgfritt: KV-bindingen HINT_KV for begrensning av antall forespørsler.

import DASHMAN_INSTRUKS from "./dashman-instruks.md";
import DASHMAN_UNDERVISER from "./dashman-underviser.md";
import { pushRunde, sendPush } from "./push.js";

const STANDARD_MODELL = { claude: "claude-haiku-5-5", openai: "gpt-4o-mini" };
const NETTSTED = "https://fysikkhjelp.no";
const MATTE = "https://matematikkhjelp.no";
const nettstedFor = (request) => ((request.headers.get("Origin") || "").includes("matematikkhjelp") ? MATTE : NETTSTED);
const TILLATTE_OPPRINNELSER = [
  "https://fysikkhjelp.no",
  "https://www.fysikkhjelp.no",
  "https://polished-surf-6e11.normann-formidling.workers.dev",
  "https://matematikkhjelp.no",
  "https://www.matematikkhjelp.no",
  "https://matematikkhjelp.normann-formidling.workers.dev",
  "http://localhost:4200",              // quarto preview
  "http://localhost:4201",              // quarto preview, matematikkhjelp.no
];

const SYSTEM_HINT = `Du er en tålmodig FAGLÆRER på NETTSTED, laget av Dr. Normann, for studenter på forkurs for ingeniør- og realfag.
Studenten jobber med en oppgave og ber om et hint.

Regler:
- Gi ETT kort hint (1–3 korte setninger) på norsk bokmål. Aldri hele løsningen, aldri det endelige tallsvaret.
- Bygg videre på tidligere hint: hvert nytt hint skal være litt mer konkret enn det forrige.
- Har studenten skrevet hva hen har prøvd, ta utgangspunkt i det. Pek på den konkrete feilen eller neste steg, og si gjerne hva som var riktig.
- Still gjerne et ledende spørsmål i stedet for å fortelle svaret.
- Løsningsforslaget du får er bare til hjelp for deg. Ikke siter det.
- Formler står på egen linje med \\[ ... \\] rundt, for eksempel\n  \\[ W = F s \\cos\\theta \\]\n  Bruk \\( ... \\) bare for et enkelt symbol i teksten, som \\( v_0 \\). Ikke bruk Markdown, overskrifter eller lister.
- Spør studenten om noe som ikke handler om oppgaven, svar kort at du bare hjelper med oppgaven.
- Gjeldende siffer: Sluttsvar har ALLTID like mange gjeldende siffer som det minst nøyaktige måltallet i oppgaven (konstanter teller med, eksakte tall ikke).
  Slik teller du: alle sifre i mantissen unntatt nuller foran. Tierpotensen teller IKKE. 6·10^10 har 1, 3.0 har 2, 0.250 har 3, 1.602·10^-19 har 4.
  Står det et krav i «Riktig svar» (krav: n gjeldende siffer), er det regnet ut av appen: bruk det, ikke tell selv.
  FEIL ANTALL SIFFER ALENE ER IKKE EN FEIL SOM HINDRER GODKJENNING: er tankegang og verdi riktig, men antall siffer feil, er besvarelsen
  likevel riktig/godkjent. Kommenter kort at sluttsvaret skal ha n gjeldende siffer og hvorfor (det minst nøyaktige måltallet).`;

const SYSTEM_DEKNING = `Du hjelper studenter å finne ut hvor godt nettstedet fysikkhjelp.no dekker pensum i et emne de skal ta eksamen i.
Du får (1) teksten fra en emnebeskrivelse og (2) en liste over sidene på fysikkhjelp.no med id, kapittel, tittel, overskrifter, definisjoner og oppgaver.

Gjør slik:
1. Finn emnekode og emnenavn, og del det faglige innholdet (læringsutbytte, faglig innhold, pensum) inn i 8–20 konkrete temaer slik en student ville tenkt på dem. Ta bare med faglige temaer, ikke praktisk informasjon om eksamen, vurdering, timeplan og lignende.
2. For hvert tema: avgjør hvor godt sidene på fysikkhjelp.no dekker det:
   "god" = temaet forklares grundig, gjerne med eksempler/oppgaver,
   "delvis" = temaet berøres, men ikke på nivået eller i bredden emnet krever,
   "ingen" = ikke dekket.
   Vær ærlig og streng: forkurs-stoff dekker som regel bare grunnlaget for et universitetsemne.
3. Oppgi id-ene til sidene som er relevante (0–4 per tema, de mest relevante først).

Svar KUN med gyldig JSON, uten forklaring rundt, på formen:
{"emnekode":"…","emnenavn":"…","temaer":[{"tema":"…","dekning":"god|delvis|ingen","sider":[1,2],"kommentar":"én kort setning på norsk"}],"oppsummering":"2–3 setninger på norsk om hva siden dekker godt og hva studenten må finne andre steder"}
Er teksten ikke en emnebeskrivelse for et emne, svar {"feil":"kort forklaring på norsk"}.`;

const SYSTEM_VURDER = `Du er en tålmodig fysikklærer på NETTSTED, laget av Dr. Normann. En student har svart på et spørsmål (flervalg, eller et tallsvar hen har skrevet selv) og vist hvordan hen tenkte, som tekst eller som bilde av en håndskrevet besvarelse.
Du får spørsmålet, riktig svar, en kort forklaring, alternativet studenten valgte og studentens forklaring.

Vurder hva besvarelsen viser:
- "riktig": sluttsvaret er riktig (også med feil antall gjeldende siffer), og besvarelsen viser tilstrekkelig forståelse. Fremgangsmåten trenger IKKE være 100 % perfekt
  eller lik fasiten; små skjønnhetsfeil underveis er greit når svaret er riktig og tankegangen holder.
- "regnefeil": riktig tankegang og riktige formler, men feil i utregning, avrunding, enheter eller fortegn.
- "begrep": feil eller manglende forståelse av fysikken (feil formel, feil modell, gjetting), selv om studenten kanskje valgte riktig alternativ.
Er besvarelsen tom, uleselig eller handler om noe annet, bruk "uklar".
OPPGI ALDRI riktig sluttsvar, riktig tall eller fasiten i tilbakemeldingen, heller ikke når studenten bare har en liten feil (fortegn, avrunding). Pek på hvor feilen er og hva studenten bør sjekke, så studenten finner svaret selv.
Tydelighet (bilde): Vær streng. Sluttsvaret skal stå tydelig, med tall og enhet, og ha TO STREKER UNDER. (Feil antall siffer: se under.)
Mangler de to strekene under sluttsvaret, eller er det uklart hva som er sluttsvaret, bruk "uklar" og be studenten sette to streker
under sluttsvaret og ta et nytt bilde. Er det tydelig og riktig, bruk "riktig" – også om studenten skrev inn svaret i feil format i appen.

Tilbakemeldingen skal være kort: 1–3 korte setninger på norsk bokmål, i du-form. Si kort hva som var bra, og pek på den konkrete feilen eller neste steg. Ikke skriv hele løsningen på nytt. Bruk desimalpunktum (9.81).\nFormler står på egen linje med $$ ... $$ rundt, for eksempel\n$$v = v_0 + at$$\nBruk $ ... $ bare for et enkelt symbol i teksten, som $v_0$.

Personvern: Vurder bare det faglige innholdet. Ikke gjengi, beskriv eller kommenter håndskriften, navn, studentnummer eller annet som kan
identifisere studenten, selv om det står på bildet. Tilbakemeldingen skal bare handle om fysikken og regningen.

Håndskrift (bare når det er vedlagt et bilde): Vurder om bildet viser studentens egen håndskrevne løsning, på papir, tavle eller nettbrett med penn.
- "ja": tydelig håndskrift, med utregning slik en student skriver den.
- "nei": skjermdump, maskinskrevet eller trykt tekst, typesatte formler, en løsning fra en KI-chat eller nettside, eller et bilde av en skjerm.
- "usikker": du klarer ikke å avgjøre det (for eksempel svært ryddig skrift, delvis skjerm, uskarpt bilde).
Uten bilde: bruk "ja".

Forståelse (bare med bilde), uavhengig av om sluttsvaret er riktig:
- "forstaelse": "ja" når utregningen viser tilstrekkelig forståelse: riktig fysikk/modell og en fornuftig vei mot svaret, selv om det
  er en regnefeil, fortegnsfeil, avrundingsfeil eller feil antall siffer. "nei" ved feil fysikk, gjetting, eller for lite utregning.
- "streker": "ja" hvis sluttsvaret i bildet har to streker under, ellers "nei".
Studenten kan rette sluttsvaret i appen etterpå; da holder det at bildet viser forståelse.

Svar KUN med gyldig JSON:
{"vurdering":"riktig|regnefeil|begrep|uklar","forstaelse":"ja|nei","streker":"ja|nei","sikkerhet":"hoy|middels|lav","handskrift":"ja|nei|usikker","tilbakemelding":"…"}
- Gjeldende siffer: Sluttsvar har ALLTID like mange gjeldende siffer som det minst nøyaktige måltallet i oppgaven (konstanter teller med, eksakte tall ikke).
  Slik teller du: alle sifre i mantissen unntatt nuller foran. Tierpotensen teller IKKE. 6·10^10 har 1, 3.0 har 2, 0.250 har 3, 1.602·10^-19 har 4.
  Står det et krav i «Riktig svar» (krav: n gjeldende siffer), er det regnet ut av appen: bruk det, ikke tell selv.
  FEIL ANTALL SIFFER ALENE ER IKKE EN FEIL SOM HINDRER GODKJENNING: er tankegang og verdi riktig, men antall siffer feil, er besvarelsen
  likevel riktig/godkjent. Kommenter kort at sluttsvaret skal ha n gjeldende siffer og hvorfor (det minst nøyaktige måltallet).
  Bruk da "riktig" (og "forstaelse": "ja"), med kommentaren om siffer i tilbakemeldingen.`;

const SYSTEM_RAD = `Du er en erfaren fysikklærer på NETTSTED, laget av Dr. Normann. Du får kunnskapsprofilen til en student: for hvert tema og undertema andelen (0–1) for
forståelse (riktig tankegang), presisjon (riktig regning når tanken er riktig) og hurtighet (riktig innen forventet tid), og antall svar.

Lag et kort, personlig råd om eksamensforberedelse i tre deler, i denne rekkefølgen etter viktighet:
- forstaelse: undertemaer med svak forståelse. Viktigst.
- presisjon: undertemaer der tanken er riktig, men regningen svikter.
- hurtighet: undertemaer der studenten får det til, men bruker lang tid. Minst viktig.
For hver del:
- "undertemaer": 0–2 undertemaer det gjelder, med navnet NØYAKTIG slik det står i profilen (teksten etter «/»).
- "tiltak": 1–3 konkrete tiltak, hvert høyst 12 ord, i du-form. Ingen hele setninger med forklaringer.
- "formel": én nøkkelformel studenten bør kunne for disse undertemaene, i LaTeX uten $-tegn (for eksempel "p_{\\text{før}} = p_{\\text{etter}}"), eller "" om det ikke passer.
Er en del uten svakheter, gi tomme lister og "". "bra": én kort setning om det som går bra, høyst 15 ord. Vær ærlig når det er få svar.
Norsk bokmål, desimalpunktum.

Svar KUN med gyldig JSON:
{"forstaelse":{"undertemaer":[],"tiltak":[],"formel":""},"presisjon":{"undertemaer":[],"tiltak":[],"formel":""},"hurtighet":{"undertemaer":[],"tiltak":[],"formel":""},"bra":""}`;

const SYSTEM_FAG = `Du er en erfaren fysikklærer og hjelper en underviser å legge opp et kurs på NETTSTED.
Du får emnebeskrivelsen og læringsutbyttet (begge kan mangle), rammen (antall uker og undervisningsform) og en KATALOG over undertemaer som finnes på nettstedet, med id og tittel.

Lag et oppsett:
- Del kurset i 3–8 moduler med korte navn (1–3 ord), i en naturlig faglig rekkefølge (med en plan: én modul per kapittel eller tema i planen, også om det blir flere enn 8).
- Hver modul har én eller flere uker. Hver uke dekker 1–3 undertemaer fra katalogen.
- Bruk høyst så mange uker som rammen sier. La gjerne de siste 1–2 ukene være uten undertemaer (repetisjon), med notatet «Repetisjon».
- Bruk BARE id-er som står i katalogen, skrevet nøyaktig likt. Ta bare med det som passer emnebeskrivelsen og læringsutbyttet. Uten beskrivelse: lag et vanlig oppsett for kurset ut fra navnet.
- Undervisningsformen påvirker ikke innholdet, bare notatene: ved omvendt klasserom kan notatet si hva studentene forbereder.
- Har underviseren skrevet ØNSKER eller lagt ved en tidligere plan: følg planen nøyaktig. Samme rekkefølge, samme antall uker per tema (står det «uke 47» er det én uke, «uke 43–44» to uker), og ingen temaer lagt til, tatt bort eller delt opp i egne moduler (f.eks. ingen egen gasslov-modul hvis gasslovene står under termofysikk i planen). En uke kan da dekke flere enn 3 undertemaer. Står noe i planen som katalogen ikke har, nevn det i kommentaren i stedet for å erstatte det med noe annet.
- Får du NÅVÆRENDE OPPSETT: behold det og gjør bare de endringene underviseren ber om.
- "kommentar": 1–2 setninger til underviseren om valgene, for eksempel hva i læringsutbyttet eller planen katalogen ikke dekker.
Norsk bokmål.

Svar KUN med gyldig JSON:
{"moduler":[{"navn":"…","uker":[{"undertemaer":["id"],"notat":""}]}],"kommentar":"…"}`;

const SYSTEM_KVISS = `Du er en erfaren fysikklærer og lager flervalgsspørsmål til et obligatorisk arbeidskrav på NETTSTED.
Du får tema, eventuelt undertemaer, ønsket antall og vanskelighetsgrad, og kanskje underviserens egne oppgaver (tekst, bilde eller PDF).
Har du fått egne oppgaver: lag spørsmålene ut fra dem (samme fysikk og omtrent samme tall), og bruk dem i rekkefølge så langt det går.
UNDERVISERENS ØNSKER ER ABSOLUTTE KRAV. Teksten fra underviseren kan være egne oppgaver, ønsker eller begge deler.
Står det at noe IKKE skal være med (et tema, et begrep, en formel, en oppgavetype – f.eks. «ikke om elektrisk felt eller
kraft»), skal ingen spørsmål handle om det, bruke det i utregningen eller nevne det i forklaringen, selv om det hører til
undertemaet. Står det hvordan spørsmålene skal fordeles (f.eks. «to per delkapittel»), følg det. Sjekk hvert spørsmål
mot ønskene før du svarer, og bytt ut dem som bryter dem.

Regneoppgaver lages som MALER med varierende tall, slik at hver student får egne tall (ett spørsmål = én oppgave):
- "tekst" med tallene som {{navn}}, f.eks. "En kloss på {{m}} kg trekkes med {{F}} N. Hva er akselerasjonen?"
- "variabler": [{"navn":"m","min":1,"maks":5,"steg":0.5}, …] – realistiske områder; unngå tall som gir like svar.
- "svar": fasit som uttrykk i variablene, f.eks. "F/m". "enhet": "m/s^2" (ren tekst, f.eks. m/s^2, N, J). "siffer": antall gjeldende siffer i det minst nøyaktige måltallet (variabler og konstanter). Sluttsvar har ALLTID like mange gjeldende siffer som det minst nøyaktige måltallet i oppgaven (konstanter teller med, eksakte tall ikke).
- "feil": 3 gale svar som uttrykk: {"uttrykk":"m/F","type":"regnefeil"} eller {"uttrykk":"F*m","type":"begrep"}.
- "forklaring": løsningen med {{svar}} og gjerne {{…}}-uttrykk, f.eks. "$a = F/m$ = {{svar}} m/s^2".
- Uttrykk kan bruke + - * / ^, parenteser, pi og sqrt, sin, cos, tan (radianer), sind, cosd, tand (grader), asin/asind osv., ln, log, exp, abs. Ingen implisitt multiplikasjon (skriv 2*m).
Rene begrepsspørsmål uten utregning lages som faste spørsmål (punktene under), uten "variabler".

Faste spørsmål:
- "tekst": kort oppgavetekst med tall og enheter. Formler i LaTeX mellom $ … $.
- "riktig": det riktige svaret (kort, med enhet), med riktig antall gjeldende siffer. Sluttsvar har ALLTID like mange gjeldende siffer som det minst nøyaktige måltallet i oppgaven (konstanter teller med, eksakte tall ikke). Bruk desimalpunktum og tierpotenser i LaTeX ($1.602\\cdot 10^{-19}\\ \\mathrm{C}$), aldri komma eller ^ i ren tekst.
- "feil": nøyaktig 3 gale svar som avslører typiske feil: {"svar":"…","type":"regnefeil"} for riktig fysikk men feil regning
  (glemt kvadrat, feil enhet, fortegn), og {"svar":"…","type":"begrep"} for feil fysikk. Minst ett av hver type.
- "forklaring": 1–2 setninger med løsningen, formel i $ … $.
- "undertema": id-en til undertemaet spørsmålet hører til (fra listen), ellers "".
- "vanskelighet": "lett", "middels" eller "vanskelig".
Bruk bare enkel LaTeX: \\frac{}{}, ^, _, \\cdot, \\sqrt{}, greske bokstaver, \\mathrm{} for enheter.
Regn ut svarene nøye; et galt fasitsvar er det verste som kan skje. Norsk bokmål.

Alle spørsmål har også "undertema" og "vanskelighet".

Er vanskeligheten "tilpasset": Lag for HVER idé TRE varianter, én "lett", én "middels" og én "vanskelig", om samme fysikk og samme undertema.
Varier vanskeligheten ved antall steg, hvor mye som er gitt direkte, og om studenten må velge formel selv – ikke bare ved tallene.
Gi variantene samme "gruppe" (1, 2, 3, … for idé nr. 1, 2, 3, …). "Antall spørsmål" er da antall idéer, så du lager tre ganger så mange spørsmål.
Svar KUN med gyldig JSON: {"sporsmal":[{"tekst":"…","variabler":[{"navn":"m","min":1,"maks":5,"steg":0.5}],"svar":"…","enhet":"…","siffer":3,"feil":[{"uttrykk":"…","type":"regnefeil"}],"forklaring":"…","undertema":"","vanskelighet":"middels"}, {"tekst":"…","riktig":"…","feil":[{"svar":"…","type":"begrep"}],"forklaring":"…","undertema":"","vanskelighet":"lett"}]}`;

const SYSTEM_MAT = `Du er en erfaren realfagslærer og lager undervisningsmateriale til ÉN samling i et kurs på NETTSTED.
Du får kurset, undervisningsformen og lengden på samlingen, uka og modulen, undertemaene (med lærestoffet fra nettstedet når det finnes),
eventuelt nivå, ukenotat, arbeidskrav og underviserens ønsker eller gamle opplegg (tekst, bilde eller PDF).

Lag:
- "tittel": kort tittel på samlingen (2–6 ord).
- "plan": plan for dagen som en liste med punkter {"min": varighet i minutter, "tekst": hva som skjer}. Summen skal være lik lengden.
  Varier: kort oppstart (hva skal vi lære), gjennomgang i korte bolker, eksempler, konseptspørsmål til salen (stem/diskuter med sidemannen),
  oppgaveregning, og oppsummering. Ved omvendt klasserom: lite gjennomgang, mest aktiviteter, og si hva studentene skulle forberede.
  Nevn arbeidskrav med frist når det passer.
- "slides": 6–16 slides {"tittel": "…", "tekst": "…", "notat": "…", "losning": "…"}. Én idé per slide, få ord.
  "tekst": linjer som begynner med "- " blir punkter. Formler med $…$ i teksten eller $$…$$ på egen linje (enkel LaTeX: \\frac{}{}, ^, _, \\cdot, \\sqrt{}, \\vec{}, greske bokstaver).
  Ta med minst ett regneeksempel, ett konseptspørsmål med svaralternativer A–D, og en oppsummering til slutt.
  "notat": hva underviseren kan si. Studentene ser ikke notatet.
  "losning": løsningsforslag til oppgaver og spørsmål på sliden: full utregning steg for steg med formler og svar med enhet,
  eller riktig alternativ med begrunnelse. Underviseren ser det på sin skjerm og kan vise det på storskjermen. Tom streng når sliden ikke har noen oppgave.
- "kommentar": 1–2 setninger til underviseren (f.eks. hva du har lagt vekt på, eller hva lærestoffet ikke dekker).
Bruk samme notasjon og begreper som lærestoffet på nettstedet. Regn nøye. Tilpass nivået. Norsk bokmål.
Har underviseren lagt ved et opplegg: følg det så tett som mulig. Får du NÅVÆRENDE MATERIALE: behold det og gjør bare endringene underviseren ber om.

Studieappen er en NETTAPP – den finnes IKKE i App Store eller Google Play. Skal studentene komme i gang: skann QR-koden (eller åpne lenken),
lag bruker med e-post, og bli med i kurset med kurskoden. Legg så appen på hjemskjermen: iPhone/iPad (Safari): Del-knappen → «Legg til på Hjem-skjerm»;
Android (Chrome): menyen ⋮ → «Installer app». Skriv {{qr}} alene på en linje der QR-koden skal stå, og {{kode}} der kurskoden skal stå
(appen setter dem inn). Skriv aldri «[sett inn kode]» eller lignende plassholdere.
Svar KUN med gyldig JSON: {"tittel":"…","plan":[{"min":10,"tekst":"…"}],"slides":[{"tittel":"…","tekst":"- …","notat":"…","losning":""}],"kommentar":"…"}`;

// «Fra salen»: KI går gjennom innspillene studentene har sendt i undervisningen (uten navn) og ukas innsikt
// (samletall per spørsmål, vanligste feilsvar), og lager en prioritert liste over hva underviseren bør ta tak i.
const SYSTEM_SALEN = `Du hjelper en underviser på NETTSTED midt i en forelesning. Du får innspill studentene har sendt nå (spørsmål, ønsker og signaler som «gå saktere», «forstår ikke», «vis et eksempel»), og ukas innsikt: hvordan klassen har svart på øvingsspørsmålene i ukas temaer (andel riktige, vanligste feilsvar og KI-tilbakemeldinger på begrepsfeil).

Lag en kort, prioritert liste over hva underviseren bør ta tak i nå:
- Slå sammen innspill som handler om det samme, og tell dem.
- Prioriter etter hvor mange det gjelder, hvor grunnleggende det er for resten av temaet, og om det er en misforståelse (begrepsfeil) heller enn en regnefeil.
- Finn misforståelsene bak feilsvarene: si hva studentene sannsynligvis tenker, ikke bare at de svarer feil.
- Knytt til det viktigste i faget der det passer (f.eks. Newtons 2. lov, bevaringslover, definisjonen av strøm og spenning).
- Gi for hvert punkt et konkret grep for timen (et spørsmål til salen, en demonstrasjon, et eksempel, en tegning), som tar 2–10 minutter.
- Høyst 6 punkter. Ta med tempo-signalene i oppsummeringen. Skriv på norsk (bokmål), kort og konkret, punktum som desimaltegn. Matematikk i LaTeX med $…$.
- Er det lite å gå på, si det, og foreslå ett godt kontrollspørsmål til salen.

Svar KUN med gyldig JSON:
{"oppsummering":"1–2 setninger, med tempo","punkter":[{"tittel":"kort","antall":3,"hvorfor":"hva studentene strever med og sannsynlig misforståelse","grep":"konkret forslag for timen","kilde":"innspill|innsikt|begge"}]}`;
async function salen(request, env, b, h) {
  const bruker = await innloggetBruker(request, env);
  if (!bruker) return json({ feil: "Du må være logget inn." }, 401, h);
  if (!(await erUnderviser(request, env))) return json({ feil: "Bare undervisere kan bruke dette." }, 403, h);
  if (!(await innenforGrense(env, `salen:${bruker.id}:${new Date().toISOString().slice(0, 10)}`, 60, 90000)))
    return json({ feil: "Du har brukt dette mye i dag. Prøv igjen i morgen." }, 429, h);
  const typer = { sporsmal: "Spørsmål", onske: "Ønske", saktere: "Signal: gå saktere", eksempel: "Signal: vis et eksempel", forstar: "Signal: henger med", forstar_ikke: "Signal: forstår ikke" };
  const inn = (Array.isArray(b.innspill) ? b.innspill : []).slice(-150).map((x) => `- ${typer[x && x.type] || "Innspill"}${x && x.tekst ? `: ${kort(x.tekst, 500)}` : ""}${x && x.besvart ? " (allerede tatt opp)" : ""}`);
  const ins = (Array.isArray(b.innsikt) ? b.innsikt : []).slice(0, 25).map((x) => [
    `- «${kort(x.tekst, 300)}» (riktig: ${kort(x.riktig, 120)}) – ${parseInt(x.riktige, 10) || 0} av ${parseInt(x.svar, 10) || 0} svar riktige, ${parseInt(x.studenter, 10) || 0} studenter, ${parseInt(x.begrep, 10) || 0} begrepsfeil`,
    ...(Array.isArray(x.feilsvar) ? x.feilsvar.slice(0, 3).map((f) => `  vanlig feilsvar: «${kort(f && f.svar, 120)}» (${parseInt(f && f.antall, 10) || 0})`) : []),
    ...(Array.isArray(x.tilbakemeldinger) ? x.tilbakemeldinger.slice(0, 3).map((t) => `  KI om en begrepsfeil: ${kort(t, 300)}`) : []),
  ].join("\n"));
  if (!inn.length && !ins.length) return json({ oppsummering: "Ingen innspill eller svar å gå gjennom ennå.", punkter: [] }, 200, h);
  const melding = [`KURS: ${kort(b.kurs, 120)}`, `UKAS TEMAER: ${kort(b.temaer, 600) || "ukjent"}`,
    `INNSPILL FRA SALEN (${inn.length}):\n${inn.join("\n") || "ingen"}`, `UKAS INNSIKT (spørsmål med svar fra minst 3 studenter):\n${ins.join("\n") || "ingen data ennå"}`].join("\n\n");
  const r = lesJson(await spor({ ...env, MODELL: env.MODELL_FAG || env.MODELL }, SYSTEM_SALEN.replace("NETTSTED", NETTSTEDNAVN(request)), melding, 4000));
  if (!r) throw feil("Fikk ikke noe svar fra KI denne gangen. Prøv igjen.", 502);
  return json({
    oppsummering: kort(r.oppsummering, 600),
    punkter: (Array.isArray(r.punkter) ? r.punkter : []).slice(0, 6).map((x) => ({ tittel: kort(x && x.tittel, 120), antall: parseInt(x && x.antall, 10) || 0,
      hvorfor: kort(x && x.hvorfor, 600), grep: kort(x && x.grep, 600), kilde: ["innspill", "innsikt", "begge"].includes(x && x.kilde) ? x.kilde : "" })).filter((x) => x.tittel),
  }, 200, h);
}

async function materiale(request, env, b, h) {
  const bruker = await innloggetBruker(request, env);
  if (!bruker) return json({ feil: "Du må være logget inn." }, 401, h);
  if (!(await erUnderviser(request, env))) return json({ feil: "Bare godkjente undervisere kan lage undervisningsmateriale med KI." }, 403, h);
  if (!(await innenforGrense(env, `mat:${bruker.id}:${new Date().toISOString().slice(0, 10)}`, 40, 90000)))
    return json({ feil: "Du har laget mye materiale i dag. Prøv igjen i morgen." }, 429, h);
  const vi = vedleggInfo(b), vedlegg = vi.vedlegg;
  const ramme = b.ramme || {};
  const lengde = Math.max(10, Math.min(600, parseInt(ramme.lengde, 10) || 90));
  const form = { forelesninger: "forelesning", omvendt: "omvendt klasserom", ingen: "ingen faste samlinger (materiale for uka)" }[ramme.form] || "forelesning";
  const hva = ["plan", "slides"].includes(b.hva) ? b.hva : "begge";
  const ut = (Array.isArray(b.undertemaer) ? b.undertemaer.slice(0, 6) : []).filter((x) => x && typeof x.id === "string")
    .map((x) => ({ tittel: kort(x.tittel, 160), url: /^\/[a-z0-9/._-]+\.html$/.test(x.url || "") ? x.url : "", niva: kort(x.niva, 20) }));
  // Lærestoffet fra nettstedet, så slidene bruker samme notasjon (høyst tre sider, avkortet).
  const side = nettstedFor(request), stoff = [];
  for (const x of ut.slice(0, 3)) {
    if (!x.url) continue;
    try {
      const r = await fetch(side + x.url, { headers: { "Accept": "text/html" }, signal: AbortSignal.timeout(8000), cf: { cacheTtl: 600 } });
      if (r.ok) { const t = htmlTilTekst((await r.text()).replace(/^[\s\S]*?<main\b/i, "<main")).slice(0, 6000); if (t) stoff.push(`--- ${x.tittel}\n${t}`); }
    } catch { /* uten lærestoffet går det også */ }
  }
  const krav = (Array.isArray(b.arbeidskrav) ? b.arbeidskrav.slice(0, 5) : []).map((x) => `${kort(x && x.tittel, 120)}${x && x.frist ? ` (frist ${kort(x.frist, 10)})` : ""}`);
  const melding = `Kurs: ${kort(b.fag, 120)}\nForm: ${form}, ${lengde} min (samling ${parseInt(b.samling, 10) || 1} av ${parseInt(ramme.samlinger, 10) || 1} denne uka)` +
    (b.niva ? `\nNivå: ${kort(b.niva, 20)}` : "") + `\nUke ${parseInt(b.uke, 10) || 1}, modul: ${kort(b.modul, 60)}` +
    `\nUndertemaer:\n${ut.map((x) => `- ${x.tittel}${x.niva ? ` (nivå ${x.niva})` : ""}`).join("\n") || "(ingen – repetisjon eller fritt)"}` +
    (b.notat ? `\nUkenotat: ${kort(b.notat, 300)}` : "") + (krav.length ? `\nArbeidskrav: ${krav.join("; ")}` : "") +
    (b.kurs && b.kurs.kode ? `\nKurskode (studentene bruker den for å bli med i kurset): ${kort(b.kurs.kode, 20)}. Lenke: ${kort(b.kurs.lenke, 200)}` : "") +
    `\nLag: ${hva === "begge" ? "plan og slides" : hva === "plan" ? "bare plan (slides kan være tom liste)" : "bare slides (plan kan være tom liste)"}` +
    (b.onske ? `\n\nØNSKER FRA UNDERVISEREN:\n${kort(b.onske, 8000)}` : "") + (vedlegg ? "\n\nUnderviserens gamle opplegg er vedlagt." : "") +
    (b.navarende ? `\n\nNÅVÆRENDE MATERIALE:\n${kort(JSON.stringify(b.navarende), 20000)}` : "") +
    (stoff.length ? `\n\nLÆRESTOFF FRA NETTSTEDET:\n${stoff.join("\n\n")}` : "") + vi.ber;
  const r = lesJson(await spor({ ...env, MODELL: env.MODELL_FAG || env.MODELL }, SYSTEM_MAT.replace("NETTSTED", NETTSTEDNAVN(request)), melding, 8000, vedlegg));
  if (!r) throw feil("Fikk ikke noe materiale fra KI denne gangen. Prøv igjen.", 502);
  const plan = (Array.isArray(r.plan) ? r.plan : []).slice(0, 25).map((x) => ({ min: Math.max(0, Math.min(300, parseInt(x && x.min, 10) || 0)), tekst: kort(x && x.tekst, 600) })).filter((x) => x.tekst);
  const slides = (Array.isArray(r.slides) ? r.slides : []).slice(0, 40).map((x) => ({ tittel: kort(x && x.tittel, 200), tekst: kort(x && x.tekst, 3000), notat: kort(x && x.notat, 2000), losning: kort(x && x.losning, 3000) })).filter((x) => x.tittel || x.tekst);
  if ((hva !== "slides" && !plan.length) && (hva !== "plan" && !slides.length)) throw feil("Fikk ikke noe brukbart materiale fra KI denne gangen. Prøv igjen.", 502);
  return json({ tittel: kort(r.tittel, 200), plan, slides, kommentar: kort(r.kommentar, 600), vedlegg: vedleggTekst(vi, r) }, 200, h);
}

async function kvisslag(request, env, b, h) {
  const bruker = await innloggetBruker(request, env);
  if (!bruker) return json({ feil: "Du må være logget inn." }, 401, h);
  if (!(await erUnderviser(request, env))) return json({ feil: "Bare godkjente undervisere kan lage spørsmål med KI." }, 403, h);
  if (!(await innenforGrense(env, `kviss:${bruker.id}:${new Date().toISOString().slice(0, 10)}`, 40, 90000)))
    return json({ feil: "Du har laget mange spørsmål i dag. Prøv igjen i morgen." }, 429, h);
  const antall = Math.max(1, Math.min(b.vanskelighet === "tilpasset" ? 7 : 10, parseInt(b.antall, 10) || 6));
  const niva = ["lett", "middels", "vanskelig", "blandet", "tilpasset"].includes(b.vanskelighet) ? b.vanskelighet : "blandet";
  const tilpasset = niva === "tilpasset";
  const ut = (Array.isArray(b.undertemaer) ? b.undertemaer.slice(0, 20) : []).filter((x) => x && typeof x.id === "string")
    .map((x) => ({ id: kort(x.id, 80), tittel: kort(x.tittel, 120) }));
  const vi = vedleggInfo(b), vedlegg = vi.vedlegg;
  const melding = `Tema: ${kort(b.tema, 120)}\nUndertemaer (id | tittel):\n${ut.map((x) => `${x.id} | ${x.tittel}`).join("\n") || "(hele temaet)"}\n` +
    `Antall spørsmål: ${antall}\nVanskelighet: ${niva}\n\nFra underviseren (ønsker og/eller egne oppgaver – ønskene er krav):\n${kort(b.grunnlag, 8000) || (vedlegg ? "(se vedlegget)" : "(ingen – lag egne)")}` + vi.ber +
    (kort(b.grunnlag, 8000).trim() ? `\n\nHusk: følg underviserens ønsker over nøyaktig. Ingen spørsmål om det underviseren har sagt at ikke skal være med.` : "");
  const kenv = { ...env, MODELL: env.MODELL_FAG || env.MODELL }, ksys = SYSTEM_KVISS.replace("NETTSTED", NETTSTEDNAVN(request));
  let r = lesJson(await spor(kenv, ksys, melding, tilpasset ? 32000 : 8000, vedlegg));
  // Uleselig svar (avkuttet eller ugyldig JSON): prøv én gang til med tydeligere beskjed.
  if (!r || !Array.isArray(r.sporsmal) || !r.sporsmal.length)
    r = lesJson(await spor(kenv, ksys, melding + "\n\nVIKTIG: Svar KUN med ett gyldig JSON-objekt {\"sporsmal\":[…]} uten tekst rundt. Doble alle backslash i LaTeX (\\\\frac). Hold forklaringene korte.", tilpasset ? 32000 : 8000, vedlegg));
  // Noen ganger kommer variantene samlet under én idé: {"gruppe":1,"varianter":[…]}. Flat ut.
  if (r && Array.isArray(r.sporsmal)) r.sporsmal = r.sporsmal.flatMap((x, i) => x && Array.isArray(x.varianter) ? x.varianter.map((v) => ({ undertema: x.undertema, ...v, gruppe: x.gruppe ?? i + 1 })) : [x]);
  const gyldigeUt = new Set(ut.map((x) => x.id));
  const tall = (v) => (Number.isFinite(+v) ? +v : null);
  const sp = (r && Array.isArray(r.sporsmal) ? r.sporsmal : []).slice(0, tilpasset ? antall * 3 : antall).map((x) => {
    x = x || {};
    const vars = (Array.isArray(x.variabler) ? x.variabler : []).slice(0, 8).map((a) => ({ navn: kort(a && a.navn, 20), min: tall(a && a.min), maks: tall(a && a.maks), steg: tall(a && a.steg) || 1 }))
      .filter((a) => /^[a-zA-Z_]\w*$/.test(a.navn) && a.min !== null && a.maks !== null && a.maks >= a.min);
    const mal = vars.length && typeof x.svar === "string" && x.svar.trim();
    const feil = (Array.isArray(x.feil) ? x.feil : []).slice(0, 3).map((f) => mal
      ? { uttrykk: kort(f && f.uttrykk, 200), svar: "", type: f && f.type === "regnefeil" ? "regnefeil" : "begrep" }
      : { svar: kort(f && f.svar, 200), type: f && f.type === "regnefeil" ? "regnefeil" : "begrep" }).filter((f) => f.uttrykk || f.svar);
    const felles = { tekst: kort(x.tekst, 1500), feil, forklaring: kort(x.forklaring, 1500),
      undertema: gyldigeUt.has(x.undertema) ? x.undertema : "", vanskelighet: ["lett", "middels", "vanskelig"].includes(x.vanskelighet) ? x.vanskelighet : "middels",
      ...(tilpasset && Number.isFinite(+x.gruppe) ? { gruppe: +x.gruppe } : {}) };
    return mal ? { ...felles, riktig: "", variabler: vars, svar: kort(x.svar, 200), enhet: kort(x.enhet, 30), siffer: Math.max(2, Math.min(5, parseInt(x.siffer, 10) || 3)) }
      : { ...felles, riktig: kort(x.riktig, 200) };
  }).filter((x) => x.tekst && (x.variabler || x.riktig) && x.feil.length >= 2);
  if (!sp.length) throw feil("Fikk ingen brukbare spørsmål fra KI denne gangen. Prøv igjen.", 502);
  // Selvkontroll (AGENTS.md): en uavhengig KI løser hvert spørsmål bare fra teksten, og svaret sammenlignes med fasiten.
  await kontrollerSporsmal(kenv, sp).catch((e) => console.log("kontroll feilet:", e && e.message));
  return json({ sporsmal: sp, vedlegg: vedleggTekst(vi, r) }, 200, h);
}

// ---- Selvkontroll av spørsmål -------------------------------------------------------------------------------------
// Liten, trygg regnemaskin for fasituttrykk i malspørsmål (eval er ikke tillatt i Workers): + - * / ^, parenteser,
// variabler, pi, e og funksjonene under.
const RF = { sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
  abs: Math.abs, ln: Math.log, log: Math.log10, log10: Math.log10, exp: Math.exp };
function regnUttrykk(u, v) {
  const t = String(u).replace(/·|×/g, "*").replace(/−/g, "-").replace(/\s+/g, "").replace(/(\d),(\d)/g, "$1.$2");
  let i = 0;
  const tall = () => { const m = /^(\d+\.?\d*(?:[eE][-+]?\d+)?|\.\d+)/.exec(t.slice(i)); if (!m) return null; i += m[0].length; return +m[0]; };
  const atom = () => {
    if (t[i] === "(") { i++; const x = sum(); if (t[i++] !== ")") throw new Error("parentes"); return x; }
    if (t[i] === "-") { i++; return -pot(); }
    if (t[i] === "+") { i++; return pot(); }
    const n = tall(); if (n !== null) return n;
    const m = /^[a-zA-Z_]\w*/.exec(t.slice(i)); if (!m) throw new Error("uttrykk");
    i += m[0].length;
    if (t[i] === "(" && RF[m[0]]) { i++; const x = sum(); if (t[i++] !== ")") throw new Error("parentes"); return RF[m[0]](x); }
    if (m[0] in v) return +v[m[0]];
    if (m[0] === "pi") return Math.PI;
    if (m[0] === "e") return Math.E;
    throw new Error("ukjent " + m[0]);
  };
  const pot = () => { const a = atom(); if (t[i] === "^" || t.slice(i, i + 2) === "**") { i += t[i] === "^" ? 1 : 2; return Math.pow(a, pot()); } return a; };
  const prod = () => { let a = pot(); while (t[i] === "*" || t[i] === "/") { const o = t[i++]; const b = pot(); a = o === "*" ? a * b : a / b; } return a; };
  const sum = () => { let a = prod(); while (t[i] === "+" || t[i] === "-") { const o = t[i++]; const b = prod(); a = o === "+" ? a + b : a - b; } return a; };
  const x = sum(); if (i < t.length) throw new Error("rest"); return x;
}
// Tall og enhet fra et svar som «−0.80 µC», «2.0·10¹⁰», «6.0e-3 A».
const SUP = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-", "⁺": "+" };
function lesSvarTall(s) {
  let t = String(s || "").replace(/\$/g, "").replace(/\\cdot|\\times|·|×/g, "*").replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]+/g, (m) => "^" + [...m].map((c) => SUP[c]).join(""))
    .replace(/−/g, "-").replace(/\\,|~|\{|\}/g, " ").replace(/\\mathrm|\\text/g, "").trim();
  const m = /^([-+]?\d+(?:[.,]\d+)?)\s*(?:(?:[eE]\s*([-+]?\d+))|(?:\*\s*10\s*\^\s*\(?\s*([-+]?\d+)\s*\)?))?\s*(.*)$/.exec(t);
  if (!m) return null;
  const v = parseFloat(m[1].replace(",", ".")) * Math.pow(10, +(m[2] || m[3] || 0));
  return Number.isFinite(v) ? { v, enhet: m[4].trim() } : null;
}
// Ett eksempel på et malspørsmål: variablene midt i intervallet (på steg-rutenettet).
function eksempel(x) {
  const v = {};
  for (const a of x.variabler || []) { const n = Math.round((a.maks - a.min) / (a.steg || 1) / 2); v[a.navn] = +(a.min + n * (a.steg || 1)).toPrecision(10); }
  const sett = (s) => String(s || "").replace(/\{\{([^{}]+)\}\}/g, (_, u) => { u = u.trim(); if (u in v) return String(v[u]); try { return String(+regnUttrykk(u, v).toPrecision(4)); } catch (e) { return "?"; } });
  return { tekst: sett(x.tekst), fasit: regnUttrykk(x.svar, v), enhet: x.enhet || "" };
}
// Løser alle spørsmålene i ett kall og markerer x.kontroll = { ok, ki, merknad }. Tallsvar godtas innen 3 % (avrunding),
// flervalg ved at KI velger samme alternativ som fasiten.
async function kontrollerSporsmal(env, sp) {
  const oppg = sp.map((x, i) => {
    if (x.variabler && x.variabler.length) {
      try { const e = eksempel(x); return { i, type: "tall", tekst: e.tekst, enhet: e.enhet, _fasit: e.fasit }; }
      catch (err) { x.kontroll = { ok: false, merknad: "Fasituttrykket kan ikke regnes ut: " + err.message }; return null; }
    }
    const f = lesSvarTall(x.riktig);
    if (f && /\d/.test(String(x.riktig)) && !/[a-zæøå]{4,}/i.test(f.enhet)) return { i, type: "tall", tekst: x.tekst, enhet: f.enhet, _fasit: f.v };
    const alt = [x.riktig, ...(x.feil || []).map((y) => y.svar)].filter(Boolean);
    const stokket = alt.map((a, k) => ({ a, k })).sort((p, q) => (p.a.length * 7 + p.k * 13) % 5 - (q.a.length * 7 + q.k * 13) % 5);
    return { i, type: "valg", tekst: x.tekst, alternativer: stokket.map((y) => y.a), _riktig: stokket.findIndex((y) => y.k === 0) };
  }).filter(Boolean);
  if (!oppg.length) return;
  const system = `Du er en nøye fysikklærer som kontrollerer oppgaver før studentene får dem. Løs HVER oppgave selvstendig, bare ut fra teksten.
Bruk g = 9.81 m/s², k_e = 8.99·10^9 N·m²/C², e = 1.602·10^-19 C, m_e = 9.11·10^-31 kg, m_p = 1.673·10^-27 kg når de trengs.
For type "tall": gi svaret som et tall i den oppgitte enheten (bare tallet, med punktum som desimaltegn).
For type "valg": gi nummeret (fra 0) på det riktige alternativet.
Si også fra hvis oppgaven er tvetydig, mangler opplysninger, har feil fysikk eller avslører svaret.
Svar KUN med JSON: {"svar":[{"i":0,"tall":1.23,"valg":null,"problem":"" }, …]} – "problem" er tom når oppgaven er i orden.`;
  const melding = JSON.stringify(oppg.map(({ _fasit, _riktig, ...o }) => o));
  const r = lesJson(await spor(env, system, melding, 4000)) || {};
  const svar = new Map((Array.isArray(r.svar) ? r.svar : []).map((s) => [s && s.i, s]));
  for (const o of oppg) {
    const s = svar.get(o.i), x = sp[o.i];
    if (!s) { x.kontroll = { ok: null, merknad: "KI-kontrollen ga ikke svar på dette spørsmålet." }; continue; }
    const problem = kort(s.problem, 300);
    if (o.type === "tall") {
      const t = +s.tall, ok = Number.isFinite(t) && Math.abs(t - o._fasit) <= 0.03 * Math.abs(o._fasit) + 1e-12;
      x.kontroll = { ok: ok && !problem, ki: Number.isFinite(t) ? `${+t.toPrecision(4)} ${o.enhet}`.trim() : "", fasit: `${+o._fasit.toPrecision(4)} ${o.enhet}`.trim(),
        merknad: [ok ? "" : "KI fikk et annet svar enn fasiten.", problem].filter(Boolean).join(" ") };
    } else {
      const ok = +s.valg === o._riktig;
      x.kontroll = { ok: ok && !problem, ki: Number.isFinite(+s.valg) ? o.alternativer[+s.valg] || "" : "",
        merknad: [ok ? "" : "KI valgte et annet alternativ enn fasiten.", problem].filter(Boolean).join(" ") };
    }
  }
}

// Kontroll av spørsmål fra banken eller et arbeidskrav (bare undervisere): {sporsmal:[…]} → samme liste med «kontroll».
async function kontroller(request, env, b, h) {
  if (!(await innloggetBruker(request, env))) return json({ feil: "Du må være logget inn." }, 401, h);
  if (!(await erUnderviser(request, env))) return json({ feil: "Bare undervisere kan kontrollere spørsmål." }, 403, h);
  const sp = (Array.isArray(b.sporsmal) ? b.sporsmal : []).slice(0, 30).map((x) => ({
    tekst: kort(x && x.tekst, 1500), riktig: kort(x && x.riktig, 200), svar: kort(x && x.svar, 200), enhet: kort(x && x.enhet, 30),
    feil: (Array.isArray(x && x.feil) ? x.feil : []).slice(0, 3).map((f) => ({ svar: kort(f && f.svar, 200) })),
    variabler: (Array.isArray(x && x.variabler) ? x.variabler : []).slice(0, 8).map((a) => ({ navn: kort(a && a.navn, 20), min: +a.min, maks: +a.maks, steg: +a.steg || 1 })),
  }));
  if (!sp.length) return json({ feil: "Ingen spørsmål å kontrollere." }, 400, h);
  await kontrollerSporsmal(env, sp);
  return json({ kontroll: sp.map((x) => x.kontroll || { ok: null }) }, 200, h);
}

// Vedlegg fra underviseren: bilde eller PDF (som data-URL). Lagres ikke.
// Vedlegg til KI: leses det ikke (feil type, for stort), lager vi likevel et forslag, men sier tydelig fra om det.
// Returnerer { vedlegg, merknad, ber }: ber = tekst som legges til meldingen, så KI selv sier hva den fant i vedlegget.
function vedleggInfo(b) {
  const navn = kort(b.filnavn, 120) || "vedlegget";
  const ulest = (Array.isArray(b.ulest) ? b.ulest : []).slice(0, 5).map((x) => kort(x, 200)).filter(Boolean);
  const vedlegg = lesVedlegg(b.vedlegg);
  if (b.vedlegg && !vedlegg) ulest.push(`«${navn}» (må være en PDF eller et bilde på under 4 MB)`);
  const merknad = ulest.length ? `Ikke lest: ${ulest.join("; ")}. Forslaget er laget uten ${ulest.length > 1 ? "disse filene" : "denne filen"}.` : "";
  const ber = vedlegg ? `\n\nVEDLEGG: «${navn}». Ta med feltet "vedlegg" i JSON-svaret: én eller to korte setninger om hva du fant i vedlegget og brukte, eller at du ikke klarte å lese det (helt eller delvis).` : "";
  return { vedlegg, merknad, ber };
}
function vedleggTekst(v, r) {
  const sagt = r && typeof r.vedlegg === "string" ? kort(r.vedlegg, 400) : "";
  return [v.vedlegg ? (sagt ? `Vedlegget: ${sagt}` : "Vedlegget ble sendt med, men KI sa ikke hva den brukte fra det.") : "", v.merknad].filter(Boolean).join(" ");
}

function lesVedlegg(d) {
  const m = /^data:(image\/(?:jpeg|png|webp)|application\/pdf);base64,([A-Za-z0-9+/=]+)$/.exec(String(d || ""));
  if (!m || m[2].length > 5.5e6) return null;
  return { type: m[1], data: m[2] };
}

async function erUnderviser(request, env) {
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return false;
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/min_rolle`, {
    method: "POST", headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: "{}" });
  if (!r.ok) return false;
  const rolle = await r.json().catch(() => "");
  return rolle === "underviser" || rolle === "admin";
}

// «Design din løype»: studenten limer inn en emnebeskrivelse (eller skriver hva hen vil lære), og får forslag til
// hvilke temaer i læreboka som dekker det. Bare tema-id-er fra katalogen godtas.
async function loypeforslag(request, env, b, h) {
  const bruker = await innloggetBruker(request, env);
  if (!bruker) return json({ feil: "Du må være logget inn." }, 401, h);
  if (!(await innenforGrense(env, `loype:${bruker.id}:${new Date().toISOString().slice(0, 10)}`, 15, 90000)))
    return json({ feil: "Du har bedt om mange forslag i dag. Prøv igjen i morgen." }, 429, h);
  const tekst = kort(b.tekst, 6000).trim();
  if (tekst.length < 15) return json({ feil: "Lim inn emnebeskrivelsen, eller skriv litt om hva du skal lære." }, 400, h);
  const katalog = (Array.isArray(b.katalog) ? b.katalog.slice(0, 200) : [])
    .filter((x) => x && typeof x.id === "string" && /^[a-z0-9-]+$/.test(x.id))
    .map((x) => ({ id: x.id, tittel: kort(x.tittel, 120), omrade: kort(x.omrade, 80), undertemaer: (Array.isArray(x.undertemaer) ? x.undertemaer : []).slice(0, 30).map((u) => kort(u, 80)) }));
  if (!katalog.length) return json({ feil: "Fant ingen temaer å velge fra." }, 400, h);
  const system = `Du hjelper en student å sette sammen en studieløype i en norsk lærebok i realfag.
Du får en emnebeskrivelse (eller studentens egne ord) og en katalog med temaer (id, tittel, område og undertemaer).
Velg temaene som trengs for å dekke det beskrivelsen ber om, også grunnleggende temaer som de andre bygger på når det er tydelig nødvendig.
Ta ikke med temaer som ikke trengs. Bruk BARE id-er fra katalogen.
Svar KUN med gyldig JSON: {"temaer":["id", …],"kommentar":"én–to setninger på norsk om valget, og hva i beskrivelsen som ikke dekkes av læreboka"}`;
  const melding = `Emnebeskrivelse / ønske:\n${tekst}\n\nKatalog:\n${JSON.stringify(katalog)}`;
  const r = lesJson(await spor(env, system, melding, 1500)) || {};
  const lovlige = new Set(katalog.map((x) => x.id));
  const temaer = (Array.isArray(r.temaer) ? r.temaer : []).filter((x) => lovlige.has(x));
  if (!temaer.length) return json({ feil: "Fant ingen temaer som passer. Prøv å lime inn mer av emnebeskrivelsen." }, 422, h);
  return json({ temaer, kommentar: kort(r.kommentar, 600) }, 200, h);
}

async function fagforslag(request, env, b, h) {
  const bruker = await innloggetBruker(request, env);
  if (!bruker) return json({ feil: "Du må være logget inn." }, 401, h);
  if (!(await erUnderviser(request, env))) return json({ feil: "Bare godkjente undervisere kan få forslag til fagoppsett." }, 403, h);
  if (!(await innenforGrense(env, `fag:${bruker.id}:${new Date().toISOString().slice(0, 10)}`, 20, 90000)))
    return json({ feil: "Du har bedt om mange forslag i dag. Prøv igjen i morgen." }, 429, h);
  const katalog = (Array.isArray(b.katalog) ? b.katalog.slice(0, 400) : [])
    .filter((x) => x && typeof x.id === "string" && /^[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+$/.test(x.id))
    .map((x) => ({ id: x.id, tittel: kort(x.tittel, 120) }));
  if (!katalog.length) return json({ feil: "Fant ingen temaer å bygge kurset av." }, 400, h);
  const vi = vedleggInfo(b), vedlegg = vi.vedlegg;
  const ramme = b.ramme || {};
  const uker = Math.max(1, Math.min(40, parseInt(ramme.uker, 10) || 14));
  const form = { forelesninger: "forelesninger", omvendt: "omvendt klasserom", ingen: "ingen faste samlinger" }[ramme.form] || "forelesninger";
  const melding = `Kursets navn: ${kort(b.navn, 120)}\nRamme: ${uker} uker, ${form}` + (ramme.samlinger ? `, ${parseInt(ramme.samlinger, 10) || 0} samlinger à ${parseInt(ramme.lengde, 10) || 90} min per uke` : "") +
    ({ forkurs: "\nNivå: forkurs", ingenior: "\nNivå: ingeniør", fordypning: "\nNivå: fordypning" }[ramme.niva] || "") +
    `\n\nEmnebeskrivelse:\n${kort(b.emnebeskrivelse, 8000) || "(ingen)"}\n\nLæringsutbytte:\n${kort(b.laringsutbytte, 3000) || "(ingen)"}\n\nKATALOG (id | tittel):\n` +
    katalog.map((x) => `${x.id} | ${x.tittel}`).join("\n") +
    (Array.isArray(b.loyper) && b.loyper.length ? `\n\nLØYPER (ferdige ukeplaner på nettstedet). Viser underviseren til en løype (f.eks. «bare temaene i TRES0312»), skal du bruke NØYAKTIG undertemaene fra løypa, og ingen andre:\n` +
      b.loyper.slice(0, 20).map((L) => `${kort(L.id, 40)} (${kort(L.tittel, 80)}):\n` + (Array.isArray(L.uker) ? L.uker.slice(0, 40) : []).map((k) => `  uke ${kort(String(k.uke), 10)} ${kort(k.tittel, 80)}: ${(Array.isArray(k.undertemaer) ? k.undertemaer.slice(0, 30) : []).map((x) => kort(x, 80)).join(", ")}`).join("\n")).join("\n") : "") +
    (b.onske ? `\n\nØNSKER FRA UNDERVISEREN:\n${kort(b.onske, 8000)}` : "") + (vedlegg ? "\n\nUnderviserens tidligere plan er vedlagt." : "") +
    (Array.isArray(b.navarende) && b.navarende.length ? `\n\nNÅVÆRENDE OPPSETT:\n${kort(JSON.stringify(b.navarende), 12000)}` : "") + vi.ber;
  // Svaret skal være JSON. Kommer det noe annet (prosa, avkuttet JSON), prøver vi én gang til med en tydeligere beskjed.
  const sys = SYSTEM_FAG.replace("NETTSTED", NETTSTEDNAVN(request));
  const fenv = { ...env, MODELL: env.MODELL_FAG || env.MODELL };
  let raa = await spor(fenv, sys, melding, 16000, vedlegg);
  let r = lesJson(raa);
  if (!r || !Array.isArray(r.moduler)) {
    console.log("fagforslag: uleselig svar, prøver igjen:", (raa || "").slice(0, 500));
    raa = await spor(fenv, sys, melding + "\n\nVIKTIG: Svar KUN med ett gyldig JSON-objekt etter formatet over, uten tekst før eller etter. Hold notatene korte.", 16000, vedlegg);
    r = lesJson(raa);
  }
  if (!r || !Array.isArray(r.moduler)) {
    console.log("fagforslag: uleselig svar igjen:", (raa || "").slice(0, 500));
    throw feil("Fikk ikke noe forslag fra KI denne gangen. Prøv igjen, eller lim inn planen som tekst under «Ønsker» i stedet for å laste opp en fil.", 502);
  }
  // Rydd: bare kjente id-er, høyst så mange uker som rammen sier.
  const gyldig = new Set(katalog.map((x) => x.id));
  let igjen = uker;
  const moduler = r.moduler.slice(0, 16).map((m) => {
    const u = (Array.isArray(m && m.uker) ? m.uker : []).slice(0, Math.max(0, igjen)).map((x) => ({
      undertemaer: (Array.isArray(x && x.undertemaer) ? x.undertemaer : []).filter((id) => gyldig.has(id)).slice(0, 8),
      notat: kort(x && x.notat, 200),
    }));
    igjen -= u.length;
    return { navn: kort(m && m.navn, 60) || "Modul", uker: u };
  }).filter((m) => m.uker.length);
  if (!moduler.length) throw feil("Forslaget fra KI kunne ikke brukes. Prøv igjen, eller bygg selv.", 502);
  return json({ moduler, kommentar: kort(r.kommentar, 600), vedlegg: vedleggTekst(vi, r) }, 200, h);
}

function cors(origin) {
  const ok = TILLATTE_OPPRINNELSER.includes(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin : TILLATTE_OPPRINNELSER[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Vary": "Origin",
  };
}
const json = (data, status, headers) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...headers } });
const kort = (s, n) => String(s || "").slice(0, n);

export default {
  // Push-varsler: cron (wrangler.toml) hvert kvarter
  async scheduled(event, env, ctx) { ctx.waitUntil(pushRunde(env, event.scheduledTime).catch(() => {})); },
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const h = cors(origin);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
    if (request.method !== "POST") return json({ feil: "Bruk POST." }, 405, h);
    if (!TILLATTE_OPPRINNELSER.includes(origin)) return json({ feil: "Ikke tillatt." }, 403, h);

    let b;
    try { b = await request.json(); } catch { return json({ feil: "Ugyldig forespørsel." }, 400, h); }

    const sti = new URL(request.url).pathname.replace(/\/+$/, "");
    try {
      if (sti.endsWith("/dekning")) return await dekning(request, env, b, h);
      if (sti.endsWith("/vurder")) return await vurder(request, env, b, h);
      if (sti.endsWith("/rad")) return await rad(request, env, b, h);
      if (sti.endsWith("/fagforslag")) return await fagforslag(request, env, b, h);
      if (sti.endsWith("/loypeforslag")) return await loypeforslag(request, env, b, h);
      if (sti.endsWith("/kontroller")) return await kontroller(request, env, b, h);
      if (sti.endsWith("/kvisslag")) return await kvisslag(request, env, b, h);
      if (sti.endsWith("/materiale")) return await materiale(request, env, b, h);
      if (sti.endsWith("/salen")) return await salen(request, env, b, h);
      if (sti.endsWith("/dashman")) return await dashman(request, env, b, h);
      if (sti.endsWith("/gjennomsyn")) return await gjennomsynVarsel(request, env, b, h);
      if (sti.endsWith("/push-test")) return await pushTest(request, env, b, h);
      return await hint(request, env, b, h);
    } catch (e) {
      return json({ feil: e.brukermelding || "Tjenesten er midlertidig utilgjengelig. Prøv igjen om litt." }, e.status || 502, h);
    }
  },
};

// ---------------------------------------------------------------- push-varsler
// Når studenten slår på varsler, sender appen /push-test: et bekreftelsesvarsel til den innloggedes egne abonnementer.
async function pushTest(request, env, b, h) {
  const bruker = await innloggetBruker(request, env);
  if (!bruker) return json({ feil: "Du må være logget inn." }, 401, h);
  if (!env.VAPID_PRIVATE_KEY) return json({ feil: "Varsler er ikke satt opp på tjeneren ennå." }, 503, h);
  const token = request.headers.get("Authorization").replace(/^Bearer\s+/i, "");
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/push_abonnement?select=endpoint,p256dh,auth`, { headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } });
  const l = r.ok ? await r.json() : [];
  let ok = 0;
  for (const a of l) { try { if ((await sendPush(env, a, { tittel: "Varsler er slått på 🔔", tekst: "Du får beskjed om nye arbeidskrav, frister og beskjeder fra faglæreren.", url: "/studie/index.html" })) < 300) ok++; } catch { /* neste */ } }
  return json({ sendt: ok }, 200, h);
}

// ---------------------------------------------------------------- hint
async function hint(request, env, b, h) {
  const ip = request.headers.get("CF-Connecting-IP") || "ukjent";
  // Innlogget student i et fag der faglæreren har satt Dashman i fase 4 (selvstendighet) eller av: ingen hint.
  if (request.headers.get("Authorization") && env.SUPABASE_URL) {
    try {
      const bruker = await innloggetBruker(request, env);
      if (bruker) {
        const token = request.headers.get("Authorization").replace(/^Bearer\s+/i, "");
        const k = (await supabaseRpc(env, token, "dashman_kontekst")) || {};
        const f = (Array.isArray(k.fag) ? k.fag : [])[0];
        if (f && (f.fase === 4 || f.fase === 0))
          return json({ sperret: true, feil: f.fase === 4
            ? `I «${kort(f.navn, 80)}» er dere nå i fasen der du skal jobbe selvstendig, så hint er slått av. Prøv selv – skriv ned hva du vet, og hva du skal finne.`
            : `Faglæreren har slått av hint i «${kort(f.navn, 80)}» akkurat nå.` }, 403, h);
      }
    } catch { /* hint fungerer som før hvis sjekken feiler */ }
  }
  // Grense per time: per innlogget student, ellers per IP. En hel klasse på skolens nett deler ofte én IP, så IP-grensen er høy.
  const hintBruker = request.headers.get("Authorization") ? await innloggetBruker(request, env).catch(() => null) : null;
  if (!(await innenforGrense(env, hintBruker ? `hint-u:${hintBruker.id}:${new Date().toISOString().slice(0, 13)}` : `hint:${ip}:${new Date().toISOString().slice(0, 13)}`, hintBruker ? 40 : 400, 3700)))
    return json({ feil: "Du har bedt om mange hint den siste timen. Prøv igjen litt senere." }, 429, h);

  const tidligere = Array.isArray(b.tidligereHint) ? b.tidligereHint.slice(-3).map((x) => kort(x, 600)) : [];
  const melding =
    `Emne: ${kort(b.emne, 120)}\n\n` +
    `Oppgave:\n${kort(b.oppgave, 2000)}\n\n` +
    `Løsningsforslag (bare for deg, ikke vis det):\n${kort(b.losning, 2500)}\n\n` +
    (tidligere.length ? `Hint studenten allerede har fått:\n${tidligere.map((t, i) => `${i + 1}. ${t}`).join("\n")}\n\n` : "") +
    `Dette har studenten prøvd:\n${kort(b.forsok, 1500) || "(ingenting skrevet)"}\n\n` +
    `Gi neste hint.`;
  // Samme tjener brukes av fysikkhjelp.no og matematikkhjelp.no: velg rolle ut fra hvilken side forespørselen kommer fra.
  const matte = (request.headers.get("Origin") || "").includes("matematikkhjelp");
  const system = SYSTEM_HINT.replace("FAGLÆRER", matte ? "matematikklærer" : "fysikklærer")
                            .replace("NETTSTED", matte ? "matematikkhjelp.no" : "fysikkhjelp.no");
  const svar = await spor(env, system, melding, 350);
  return json({ hint: svar || "Prøv å tegne opp kreftene og forflytningen først. Hvilken del av kraften peker langs bevegelsen?" }, 200, h);
}

// ---------------------------------------------------------------- studieappen
const NETTSTEDNAVN = (request) => ((request.headers.get("Origin") || "").includes("matematikkhjelp") ? "matematikkhjelp.no" : "fysikkhjelp.no");

async function vurder(request, env, b, h) {
  const bruker = await innloggetBruker(request, env);
  if (!bruker) return json({ feil: "Du må være logget inn for å få tilbakemelding." }, 401, h);
  if (!(await innenforGrense(env, `vurder:${bruker.id}:${new Date().toISOString().slice(0, 10)}`, 80, 90000)))
    return json({ feil: "Du har fått mange tilbakemeldinger i dag. Prøv igjen i morgen." }, 429, h);

  const tekst = kort(b.forklaring, 3000).trim();
  const bilde = lesBilde(b.bilde);
  if (b.bilde && !bilde) return json({ feil: "Bildet må være JPEG, PNG eller WebP og mindre enn 4 MB." }, 400, h);
  if (!tekst && !bilde) return json({ feil: "Skriv en forklaring eller last opp et bilde." }, 400, h);
  if (bilde && (env.LEVERANDOR || "claude").toLowerCase() === "openai" && env.KI_BILDER !== "ja")
    return json({ feil: "Bildevurdering er ikke tilgjengelig ennå. Skriv forklaringen som tekst i stedet." }, 501, h);

  const s = b.sporsmal || {};
  const melding =
    `Spørsmål:\n${kort(s.tekst, 1500)}\n\nRiktig svar: ${kort(s.riktig, 200)}\nForklaring (fasit): ${kort(s.forklaring, 1500)}\n\n` +
    `Studenten valgte: ${kort(b.valgt, 200)}\n\n` +
    `Studentens forklaring: ${tekst || "(se bildet)"}${bilde ? "\n\nStudentens håndskrevne besvarelse er vedlagt som bilde." : ""}`;
  const raa = await spor(env, SYSTEM_VURDER.replace("NETTSTED", NETTSTEDNAVN(request)), melding, 1500, bilde);
  const r = lesJson(raa) || {};
  const vurdering = ["riktig", "regnefeil", "begrep", "uklar"].includes(r.vurdering) ? r.vurdering : "uklar";
  const sikkerhet = ["hoy", "middels", "lav"].includes(r.sikkerhet) ? r.sikkerhet : "lav";
  // Uten bilde er det ingenting å sjekke. Med bilde: alt annet enn et tydelig ja/nei regnes som usikkert.
  const handskrift = !bilde ? "ja" : (["ja", "nei", "usikker"].includes(r.handskrift) ? r.handskrift : "usikker");
  const forstaelse = bilde && (r.forstaelse === "ja" || vurdering === "riktig") ? "ja" : "nei";
  const streker = bilde && r.streker === "ja" ? "ja" : "nei";
  return json({ vurdering, forstaelse, streker, sikkerhet, handskrift, tilbakemelding: kort(r.tilbakemelding, 1200) || "Klarte ikke å vurdere besvarelsen denne gangen." }, 200, h);
}

async function rad(request, env, b, h) {
  const bruker = await innloggetBruker(request, env);
  if (!bruker) return json({ feil: "Du må være logget inn for å få råd." }, 401, h);
  if (!(await innenforGrense(env, `rad:${bruker.id}:${new Date().toISOString().slice(0, 10)}`, 10, 90000)))
    return json({ feil: "Du har fått mange råd i dag. Prøv igjen i morgen." }, 429, h);
  const linjer = (Array.isArray(b.profil) ? b.profil.slice(0, 120) : []).map((x) => {
    const p = (v) => (typeof v === "number" && isFinite(v) ? v.toFixed(2) : "–");
    return `${kort(x.tema, 80)} / ${kort(x.undertema, 80)}: forståelse ${p(x.f)}, presisjon ${p(x.p)}, hurtighet ${p(x.h)}, ${parseInt(x.n, 10) || 0} svar`;
  });
  if (!linjer.length) return json({ feil: "Ta en quiz først, så har vi noe å bygge rådene på." }, 400, h);
  const raa = await spor(env, SYSTEM_RAD.replace("NETTSTED", NETTSTEDNAVN(request)), `Kunnskapsprofil:\n${linjer.join("\n")}`, 2500);
  const r = lesJson(raa);
  if (!r) throw feil("Fikk ikke noe råd fra KI denne gangen. Prøv igjen om litt.", 502);
  const liste = (v, n, m) => (Array.isArray(v) ? v : []).filter((x) => typeof x === "string" && x.trim()).slice(0, n).map((x) => kort(x.trim(), m));
  const del = (d) => ({ undertemaer: liste(d && d.undertemaer, 2, 80), tiltak: liste(d && d.tiltak, 3, 160), formel: kort(d && typeof d.formel === "string" ? d.formel.trim() : "", 200) });
  return json({ rad: { forstaelse: del(r.forstaelse), presisjon: del(r.presisjon), hurtighet: del(r.hurtighet), bra: kort(r.bra, 200) } }, 200, h);
}

// ---------------------------------------------------------------- varsel om bilder til gjennomsyn
// Studieappen kaller denne når et bilde er lagret til gjennomsyn. Administratoren får en e-post (uten innhold om studenten)
// hvis RESEND_API_KEY og VARSEL_EPOST er satt som hemmeligheter på workeren. Ellers vises varselet bare på Min side.
async function gjennomsynVarsel(request, env, b, h) {
  const bruker = await innloggetBruker(request, env);
  if (!bruker) return json({ feil: "Du må være logget inn." }, 401, h);
  if (!env.RESEND_API_KEY || !env.VARSEL_EPOST) return json({ sendt: false }, 200, h);
  // Høyst én e-post per time, uansett hvor mange bilder som kommer inn.
  if (!(await innenforGrense(env, `gjennomsyn-epost:${new Date().toISOString().slice(0, 13)}`, 1, 3700))) return json({ sendt: false }, 200, h);
  const nettsted = NETTSTEDNAVN(request);
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.RESEND_API_KEY}` },
    body: JSON.stringify({
      from: env.VARSEL_FRA || `${nettsted} <varsel@${nettsted}>`,
      to: [env.VARSEL_EPOST],
      subject: `Bilde til gjennomsyn på ${nettsted}`,
      text: `Et bilde av en løsning venter på gjennomsyn (KI var usikker på om det er håndskrevet).\n\nSe og behandle det på Min side: https://${nettsted}/konto/\n`
    })
  });
  return json({ sendt: r.ok }, 200, h);
}

// ---------------------------------------------------------------- Dashman
const HUMOR = ["noytral", "glad", "ler", "irritert", "trist", "tenker"];
const NIVATEKST = { forkurs: "Forkurs", ingenior: "Ingeniør", fordypning: "Fordypning" };
const FASETEKST = ["0 – av (faglæreren har slått Dashman av i kurset)", "1 – forkunnskaper og oppstart", "2 – øving og mengdetrening",
  "3 – formativ vurdering (arbeidskrav og mappe)", "4 – sluttfase og selvstendighet"];

function isoUke(d) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())), dag = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dag);
  return Math.ceil(((t - new Date(Date.UTC(t.getUTCFullYear(), 0, 1))) / 864e5 + 1) / 7);
}
// Uka i kursets plan som gjelder nå (startuke i rammen + løpende uker gjennom modulene). Etter siste uke: siste uke.
function denneUka(ki) {
  const start = parseInt(ki.ramme && ki.ramme.startuke, 10);
  if (!start) return null;
  const naa = isoUke(new Date()), nr = ((naa - start + 52) % 52) + 1;
  const alle = [];
  for (const m of ki.moduler) for (const w of (m && Array.isArray(m.uker) ? m.uker : [])) alle.push({ m, w });
  if (!alle.length) return null;
  const etter = nr > alle.length;
  const x = alle[Math.min(nr, alle.length) - 1];
  const fase = x.w.fase === 0 || (x.w.fase >= 1 && x.w.fase <= 4) ? x.w.fase : undefined;
  return { nr: Math.min(nr, alle.length) + (etter ? " (planen er ferdig; repetisjon og eksamen)" : ""), kal: naa, modul: x.m.navn || "",
    tema: (x.w.undertemaer || []).map((id) => String(id).split("/").slice(1).join("/")).join(", "), notat: x.w.notat || "", fase: etter ? undefined : fase };
}

async function supabaseRpc(env, token, fn, args) {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(args || {}),
  });
  if (!r.ok) throw new Error("supabase " + r.status);
  return r.json();
}

async function dashman(request, env, b, h) {
  const bruker = await innloggetBruker(request, env);
  if (!bruker) return json({ feil: "Logg inn for å snakke med Dashman." }, 401, h);
  if (!(await innenforGrense(env, `dashman:${bruker.id}:${new Date().toISOString().slice(0, 10)}`, 120, 90000)))
    return json({ feil: "Dashman trenger en pause. Du har sendt mange meldinger i dag. Prøv igjen i morgen." }, 429, h);
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");

  // Samtalen kommer fra nettleseren (lagres ikke her). Bare de siste 20 meldingene, og må veksle student/Dashman.
  const meldinger = [];
  for (const m of (Array.isArray(b.meldinger) ? b.meldinger : []).slice(-20)) {
    const role = m && m.rolle === "dashman" ? "assistant" : "user";
    const tekst = kort(m && m.tekst, 2000).trim();
    if (!tekst) continue;
    if (meldinger.length && meldinger[meldinger.length - 1].role === role) meldinger[meldinger.length - 1].content += "\n\n" + tekst;
    else meldinger.push({ role, content: tekst });
  }
  while (meldinger.length && meldinger[0].role !== "user") meldinger.shift();
  if (!meldinger.length || meldinger[meldinger.length - 1].role !== "user") return json({ feil: "Skriv noe til Dashman først." }, 400, h);
  // Bilde fra kameraknappen i boblen (studentens egen løsning): legges ved siste melding. Lagres ikke.
  const bilde = lesBilde(b.bilde);
  if (b.bilde && !bilde) return json({ feil: "Bildet må være JPEG, PNG eller WebP og mindre enn 4 MB." }, 400, h);
  if (bilde) {
    const lev = (env.LEVERANDOR || "claude").toLowerCase(), sist = meldinger[meldinger.length - 1];
    if (lev === "openai" && env.KI_BILDER !== "ja") return json({ feil: "Dashman kan ikke se på bilder ennå. Skriv hva du har gjort i stedet." }, 501, h);
    sist.content = lev === "openai"
      ? [{ type: "image_url", image_url: { url: `data:${bilde.type};base64,${bilde.data}` } }, { type: "text", text: sist.content }]
      : [{ type: "image", source: { type: "base64", media_type: bilde.type, data: bilde.data } }, { type: "text", text: sist.content }];
  }

  if (await erUnderviser(request, env)) return await dashmanUnderviser(request, env, b, h, meldinger);
  let k = {};
  try { k = (await supabaseRpc(env, token, "dashman_kontekst")) || {}; } catch { k = {}; }
  const fag = Array.isArray(k.fag) ? k.fag : [];
  const aktivt = fag[0];   // nyeste påmelding
  // Ukeplanen i kurset: hvilken uke det er nå, hva den dekker, og om faglæreren har satt en egen Dashman-fase for uka.
  let uka = null;
  if (aktivt) {
    try {
      const r = await fetch(`${env.SUPABASE_URL}/rest/v1/kurs_deltaker?select=pameldt,kursinfo:kurs(navn,moduler,ramme)&order=pameldt.desc&limit=1`,
        { headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } });
      const ki = r.ok ? ((await r.json())[0] || {}).kursinfo : null;
      if (ki && Array.isArray(ki.moduler)) uka = denneUka(ki);
    } catch {}
    if (uka && uka.fase !== undefined) aktivt.fase = uka.fase;
  }
  if (aktivt && aktivt.fase === 0) {
    return json({ svar: `Jeg har pause i kurset «${kort(aktivt.navn, 80)}» nå, etter avtale med faglæreren din. Spør gjerne faglæreren, eller les lærestoffet på siden.`, humor: "trist" }, 200, h);
  }
  const side = b.side || {};
  const linjer = [
    `Nivå: ${NIVATEKST[k.niva] || "ikke oppgitt (spør studenten)"}`,
    `Studentens mål: ${kort(k.mal, 300) || "ikke oppgitt"}`,
    `Ditt notat fra tidligere samtaler: ${kort(k.notat, 800) || "(tomt – første samtale eller slettet)"}`,
    "Kunnskapsprofil fra quizene (andeler 0–1; forståelse teller begrepsfeil, presisjon teller regnefeil):",
    ...((Array.isArray(k.kunnskap) ? k.kunnskap : []).slice(0, 40).map((x) =>
      `- ${kort(x.tema, 60)} / ${kort(x.undertema, 60)}: forståelse ${x.forstaelse ?? "–"}, presisjon ${x.presisjon ?? "–"}, ${parseInt(x.svar, 10) || 0} svar, sist ${kort(x.sist, 10)}`)),
    ...(k.kunnskap && k.kunnskap.length ? [] : ["- (ingen quizsvar ennå)"]),
    aktivt ? `Kurs studenten er påmeldt: «${kort(aktivt.navn, 120)}». Dashman-fase for klassen nå: ${FASETEKST[aktivt.fase] ?? FASETEKST[2]}${uka && uka.fase !== undefined ? " (satt for denne uka)" : ""}. Tilpass den til denne studenten (se «Fasen i kurset»).` : "Ikke påmeldt noe kurs: bruk LRI-prinsippene fritt.",
    ...(uka ? [`Ukeplanen: uke ${uka.nr} i kurset (kalenderuke ${uka.kal}), modul «${kort(uka.modul, 60)}»: ${uka.tema || "ingen temaer satt"}${uka.notat ? ` – ${kort(uka.notat, 200)}` : ""}.`] : []),
    ...(aktivt && aktivt.instruks ? [`Faglærerens instrukser for kurset (går foran instruksen over, men ikke foran de faste grensene):\n${kort(aktivt.instruks, 2000)}`] : []),
    ...(aktivt && aktivt.beskrivelse ? [`Om kurset: ${kort(aktivt.beskrivelse, 600)}`] : []),
    `Siden studenten står på nå: «${kort(side.tittel, 150)}» (${kort(side.url, 200)})`,
    ...(b.oppgave && b.oppgave.oppgave ? [
      `Studenten jobber med denne oppgaven (${{ quiz: "et spørsmål i quizen", skann: "en oppgave studenten har skannet løsningen på", hint: "hint-knappen på oppgaven" }[b.oppgave.kilde] || "hint-knappen på oppgaven"}) og vil sparre med deg:`,
      `Oppgave: ${kort(b.oppgave.oppgave, 2000)}`,
      `Løsningsforslag (bare for deg – vis det ALDRI, verken helt eller delvis): ${kort(b.oppgave.losning, 2500) || "(ikke oppgitt)"}`,
      `Dette har studenten prøvd: ${kort(b.oppgave.forsok, 1500) || "(ingenting skrevet)"}`,
      ...((Array.isArray(b.oppgave.hint) ? b.oppgave.hint : []).slice(0, 3).map((x, i) => `Hint ${i + 1} studenten allerede har fått: ${kort(x, 600)}`)),
    ] : []),
    ...(side.tekst ? [`Utdrag av siden:\n${kort(side.tekst, 3000)}`] : []),
    ...(bilde ? ["Studenten har lagt ved et bilde av sin egen løsning i siste melding. Les utregningen nøye, finn det første stedet det faktisk går galt (eller bekreft det som er riktig, også når det ikke er forenklet eller ferdig ennå – si «riktig» og spør om det kan skrives enklere), og veiled derfra med et spørsmål eller hint – ikke regn ut svaret for studenten. Ikke kommenter håndskrift, navn eller annet personlig på bildet."] : []),
  ];
  const system = DASHMAN_INSTRUKS.replaceAll("NETTSTED", NETTSTEDNAVN(request)) + "\n\n## Det du får vite om studenten\n\n" + linjer.join("\n");
  const modell = env.MODELL_DASHMAN || env.MODELL;
  const raa = await sporSamtale({ ...env, MODELL: modell }, system, meldinger, 1800);
  const r = lesJson(raa);
  const svar = kort(r && typeof r.svar === "string" ? r.svar : raa, 6000).trim();
  if (!svar) throw feil("Dashman fikk ikke sagt noe denne gangen. Prøv igjen.", 502);
  const humor = HUMOR.includes(r && r.humor) ? r.humor : "noytral";
  const notat = r && typeof r.notat === "string" ? r.notat.trim() : "";
  if (notat && notat !== k.notat) { try { await supabaseRpc(env, token, "sett_dashman_notat", { t: kort(notat, 800) }); } catch {} }
  return json({ svar, humor }, 200, h);
}

// Dashman for undervisere (dashman-underviser.md): hjelpsom kollega som gir hele svar. Står underviseren i kursbyggeren,
// får Dashman kurset og katalogen, og kan sende tilbake et nytt oppsett ("moduler", "ramme") som kursbyggeren tar i bruk.
async function dashmanUnderviser(request, env, b, h, meldinger) {
  const side = b.side || {}, fag = b.fag && typeof b.fag === "object" ? b.fag : null;
  const katalog = fag && Array.isArray(fag.katalog) ? fag.katalog.slice(0, 400).filter((x) => x && typeof x.id === "string").map((x) => ({ id: x.id, tittel: kort(x.tittel, 120) })) : [];
  const linjer = [
    `Siden underviseren står på nå: «${kort(side.tittel, 150)}» (${kort(side.url, 200)})`,
    ...(side.tekst && !fag ? [`Utdrag av siden:\n${kort(side.tekst, 3000)}`] : []),
    ...(fag ? [`KURSET i kursbyggeren:\n${kort(JSON.stringify({ navn: fag.navn, ramme: fag.ramme, moduler: fag.moduler }), 20000)}`,
      `KATALOG (id | tittel):\n${katalog.map((x) => `${x.id} | ${x.tittel}`).join("\n")}`] : ["Underviseren står ikke i kursbyggeren nå, så du kan ikke endre et kurs. Vil underviseren endre et kurs: be hen åpne kurset i kursbyggeren og spørre derfra."]),
  ];
  const system = DASHMAN_UNDERVISER.replaceAll("NETTSTED", NETTSTEDNAVN(request)) + "\n\n## Det du vet nå\n\n" + linjer.join("\n");
  const modell = (fag && env.MODELL_FAG) || env.MODELL_DASHMAN || env.MODELL;
  const raa = await sporSamtale({ ...env, MODELL: modell }, system, meldinger, fag ? 12000 : 2500);
  const r = lesJson(raa);
  const svar = kort(r && typeof r.svar === "string" ? r.svar : raa, 6000).trim();
  if (!svar) throw feil("Dashman fikk ikke sagt noe denne gangen. Prøv igjen.", 502);
  const ut = { svar, humor: HUMOR.includes(r && r.humor) ? r.humor : "noytral" };
  if (fag && r && Array.isArray(r.moduler) && r.moduler.length) {
    const gyldig = new Set(katalog.map((x) => x.id));
    ut.moduler = r.moduler.slice(0, 20).map((m) => ({
      ...(m && typeof m.id === "string" ? { id: kort(m.id, 40) } : {}),
      navn: kort(m && m.navn, 60) || "Modul",
      uker: (Array.isArray(m && m.uker) ? m.uker : []).slice(0, 40).map((w) => ({
        ...(w && typeof w.id === "string" ? { id: kort(w.id, 40) } : {}),
        undertemaer: (Array.isArray(w && w.undertemaer) ? w.undertemaer : []).filter((id) => gyldig.has(id)).slice(0, 10),
        notat: kort(w && w.notat, 200),
      })),
    }));
    if (r.ramme && typeof r.ramme === "object") {
      const rm = {};
      if (parseInt(r.ramme.uker, 10) > 0) rm.uker = Math.min(52, parseInt(r.ramme.uker, 10));
      if (parseInt(r.ramme.startuke, 10) > 0) rm.startuke = Math.min(53, parseInt(r.ramme.startuke, 10));
      if (Object.keys(rm).length) ut.ramme = rm;
    }
  }
  return json(ut, 200, h);
}

function lesBilde(d) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(d || ""));
  if (!m || m[2].length > 5.5e6) return null;
  return { type: m[1], data: m[2] };
}

// ---------------------------------------------------------------- dekning
async function dekning(request, env, b, h) {
  const bruker = await innloggetBruker(request, env);
  const dag = new Date().toISOString().slice(0, 10);
  const ip = request.headers.get("CF-Connecting-IP") || "ukjent";
  const ok = bruker
    ? await innenforGrense(env, `dekning:${bruker.id}:${dag}`, 15, 90000)
    : await innenforGrense(env, `dekning-ip:${ip}:${dag}`, 5, 90000);
  if (!ok) return json({ feil: bruker ? "Du har laget mange dekningskart i dag. Prøv igjen i morgen."
                                       : "Du har laget mange dekningskart i dag. Registrer deg gratis for å lage flere." }, 429, h);

  // 1. emnebeskrivelsen
  let tekst = kort(b.tekst, 30000).trim();
  let kilde = null;
  if (!tekst) {
    kilde = String(b.url || "").trim();
    tekst = await hentSide(kilde);
  }
  if (tekst.length < 200) throw feil("Fant for lite tekst i emnebeskrivelsen. Prøv å lime inn teksten direkte.", 422);

  // 2. innholdet på nettstedet forespørselen kommer fra (fysikkhjelp.no eller matematikkhjelp.no)
  const side = nettstedFor(request), navn = side.replace("https://", "");
  const sider = await hentInnhold(side);
  const liste = sider.map((s, i) =>
    `${i + 1}|${s.del} – ${s.kapittel}|${s.tittel}|${[...s.emner, ...s.definisjoner].join("; ")}` +
    (s.oppgaver.length ? `|oppgaver: ${s.oppgaver.slice(0, 8).join("; ")}` : "")
  ).join("\n");

  // 3. spør KI-en
  const melding = `EMNEBESKRIVELSE${kilde ? ` (fra ${kilde})` : ""}:\n${tekst.slice(0, 24000)}\n\nSIDER PÅ ${navn.toUpperCase()} (id|del – kapittel|tittel|innhold):\n${liste}`;
  const raa = await spor(env, SYSTEM_DEKNING.replaceAll("fysikkhjelp.no", navn), melding, 8000);
  const r = lesJson(raa);
  if (!r) throw feil("Klarte ikke å lage kartet denne gangen. Prøv igjen.", 502);
  if (r.feil) throw feil(r.feil, 422);

  const temaer = (Array.isArray(r.temaer) ? r.temaer : []).slice(0, 25).map((t) => ({
    tema: kort(t.tema, 120),
    dekning: ["god", "delvis", "ingen"].includes(t.dekning) ? t.dekning : "ingen",
    kommentar: kort(t.kommentar, 300),
    sider: (Array.isArray(t.sider) ? t.sider : []).map((id) => sider[Number(id) - 1]).filter(Boolean).slice(0, 4)
      .map((s) => ({ url: s.url, tittel: s.tittel, kapittel: s.kapittel })),
  }));
  if (!temaer.length) throw feil("Fant ingen faglige temaer i emnebeskrivelsen.", 422);
  // Uten innlogging: svar på om emnet dekkes, men ikke hvilke sider (veikartet) – det er for registrerte brukere.
  if (!bruker) temaer.forEach((t) => { t.antallSider = t.sider.length; t.sider = []; });
  return json({ emnekode: kort(r.emnekode, 30), emnenavn: kort(r.emnenavn, 150), kilde, temaer, oppsummering: kort(r.oppsummering, 800), innlogget: !!bruker }, 200, h);
}

// Mange studenter samtidig: innloggingen sjekkes hos Supabase én gang per token og huskes i 5 minutter i workeren.
const BRUKERE = new Map();
async function innloggetBruker(request, env) {
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;
  const husket = BRUKERE.get(token);
  if (husket && husket.til > Date.now()) return husket.u;
  const u = await sjekkBruker(token, env);
  if (u) { if (BRUKERE.size > 2000) BRUKERE.clear(); BRUKERE.set(token, { u, til: Date.now() + 5 * 60000 }); }
  return u;
}
async function sjekkBruker(token, env) {
  // Ugyldig/utgått token gir 401/403 → ikke innlogget. Andre feil (429, 5xx, nettverk) prøves én gang til og gir ellers en
  // tydelig feilmelding i stedet for «du må være logget inn».
  let r;
  for (let i = 0; i < 2; i++) {
    r = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }).catch(() => null);
    if (r && (r.ok || r.status === 401 || r.status === 403)) break;
  }
  if (!r || (!r.ok && r.status !== 401 && r.status !== 403)) {
    console.log("innloggetBruker:", r ? r.status : "nettverk");
    throw feil("Klarte ikke å sjekke innloggingen akkurat nå. Prøv igjen om litt.", 503);
  }
  if (!r.ok) return null;
  const u = await r.json();
  return u && u.id ? u : null;
}

async function hentSide(url) {
  let u;
  try { u = new URL(url); } catch { throw feil("Det ser ikke ut som en gyldig nettadresse.", 400); }
  if (!/^https?:$/.test(u.protocol)) throw feil("Nettadressen må begynne med http:// eller https://", 400);
  let r;
  try {
    r = await fetch(u.toString(), { headers: { "User-Agent": "fysikkhjelp.no dekningssjekk", "Accept": "text/html,text/plain" }, redirect: "follow", signal: AbortSignal.timeout(12000) });
  } catch { throw feil("Fikk ikke hentet siden. Sjekk adressen, eller lim inn teksten direkte.", 422); }
  if (!r.ok) throw feil(`Siden svarte med feil (${r.status}). Sjekk adressen, eller lim inn teksten direkte.`, 422);
  const type = r.headers.get("content-type") || "";
  if (!/html|text/.test(type)) throw feil("Siden er ikke en vanlig nettside (f.eks. PDF). Lim inn teksten direkte i stedet.", 422);
  const html = (await r.text()).slice(0, 1500000);
  return htmlTilTekst(html);
}

function htmlTilTekst(html) {
  return html
    .replace(/<(script|style|noscript|svg|nav|footer|header|form)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr|\/section)\b[^>]*>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n• ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/[ \t\r\f\v]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}

const innholdCache = {};
async function hentInnhold(side) {
  const c = innholdCache[side];
  if (c && Date.now() - c.t < 10 * 60 * 1000) return c.sider;
  const r = await fetch(`${side}/innhold.json`, { cf: { cacheTtl: 600 } });
  if (!r.ok) throw feil("Fant ikke innholdsoversikten til nettsiden.", 502);
  const sider = (await r.json()).sider || [];
  innholdCache[side] = { t: Date.now(), sider };
  return sider;
}

function lesJson(s) {
  if (!s) return null;
  s = s.replace(/```(?:json)?/gi, "");
  const a = s.indexOf("{"), z = s.lastIndexOf("}");
  if (a < 0 || z <= a) return null;
  const t = s.slice(a, z + 1);
  try { return JSON.parse(t); } catch {}
  try { return JSON.parse(t.replace(/,\s*([}\]])/g, "$1")); } catch {}   // komma før } eller ]
  // LaTeX med enkel backslash (\cdot, \sqrt …) er ugyldig JSON. Dobler backslash som ikke starter en gyldig JSON-escape.
  try { return JSON.parse(t.replace(/\\(?!["\\/bfnrtu])/g, "\\\\").replace(/,\s*([}\]])/g, "$1")); } catch { return null; }
}

// ---------------------------------------------------------------- felles
function feil(melding, status) { const e = new Error(melding); e.brukermelding = melding; e.status = status; return e; }

async function innenforGrense(env, nokkel, maks, ttl) {
  if (!env.HINT_KV) return true;
  // Feiler telleren (f.eks. KV-kvoten er brukt opp), slipper vi forespørselen gjennom i stedet for å stoppe studentene.
  try {
    const n = parseInt((await env.HINT_KV.get(nokkel)) || "0", 10);
    if (n >= maks) return false;
    await env.HINT_KV.put(nokkel, String(n + 1), { expirationTtl: ttl });
  } catch (e) { console.log("innenforGrense:", nokkel, String(e).slice(0, 200)); }
  return true;
}

// Som spor(), men med en hel samtale (meldinger = [{role: "user"|"assistant", content}]).
async function sporSamtale(env, system, meldinger, maksTokens) {
  const lev = (env.LEVERANDOR || "claude").toLowerCase();
  const modell = env.MODELL || STANDARD_MODELL[lev] || STANDARD_MODELL.claude;
  if (lev === "openai") {
    if (!env.KI_URL || !env.KI_API_KEY) throw feil("KI-tjenesten er ikke satt opp ennå.", 503);
    const r = await kiFetch(env.KI_URL, {
      method: "POST",
      headers: { "Authorization": `Bearer ${env.KI_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ model: modell, max_tokens: maksTokens, messages: [{ role: "system", content: system }, ...meldinger] }),
    });
    if (!r.ok) throw kiFeil(r.status);
    const d = await r.json();
    const c = (d.choices || [])[0];
    const t = c?.message?.content ?? c?.text ?? "";
    return (typeof t === "string" ? t : JSON.stringify(t)).trim();
  }
  if (!env.ANTHROPIC_API_KEY) throw feil("KI-tjenesten er ikke satt opp ennå.", 503);
  const r = await kiFetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: modell, max_tokens: maksTokens, system, messages: meldinger }),
  });
  if (!r.ok) throw kiFeil(r.status);
  const d = await r.json();
  return (d.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n").trim();
}

// KI-kall tåler kø: ved 429 (for mange forespørsler) og 5xx/529 (overbelastet) ventes det litt og prøves igjen, inntil tre ganger.
async function kiFetch(url, init) {
  let r;
  for (let i = 0; i < 4; i++) {
    r = await fetch(url, init).catch(() => null);
    if (r && r.ok) return r;
    const st = r ? r.status : 0;
    if (r && st !== 429 && st < 500) return r;
    if (i === 3) break;
    const ra = r ? parseFloat(r.headers.get("retry-after") || "") : NaN;
    await new Promise((ok) => setTimeout(ok, Math.min(isFinite(ra) ? ra * 1000 : (1500 * (i + 1)), 8000) + Math.random() * 1000));
  }
  return r || new Response("", { status: 503 });
}
function kiFeil(status) {
  console.log("KI-feil:", status);
  if (status === 429 || status === 529 || status >= 500) return feil("Mange spør Dashman akkurat nå. Vent et halvt minutt og prøv igjen.", 503);
  return new Error("KI " + status);
}

// Spør valgt KI-leverandør og returner teksten.
async function spor(env, system, melding, maksTokens, bilde) {
  const lev = (env.LEVERANDOR || "claude").toLowerCase();
  const modell = (bilde && env.MODELL_BILDE) || env.MODELL || STANDARD_MODELL[lev] || STANDARD_MODELL.claude;
  if (lev === "openai") {
    if (!env.KI_URL || !env.KI_API_KEY) throw feil("KI-tjenesten er ikke satt opp ennå.", 503);
    const r = await kiFetch(env.KI_URL, {
      method: "POST",
      headers: { "Authorization": `Bearer ${env.KI_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ model: modell, max_tokens: maksTokens, messages: [{ role: "system", content: system }, { role: "user", content: bilde
        ? [{ type: "image_url", image_url: { url: `data:${bilde.type};base64,${bilde.data}` } }, { type: "text", text: melding }]
        : melding }] }),
    });
    if (!r.ok) throw kiFeil(r.status);
    const d = await r.json();
    // OpenAI-format, med reserve for varianter (f.eks. NTNU sin chat-completion)
    const c = (d.choices || [])[0];
    const t = c?.message?.content ?? c?.text ?? d.message?.content ?? d.content ?? d.response ?? "";
    return (typeof t === "string" ? t : JSON.stringify(t)).trim();
  }
  if (!env.ANTHROPIC_API_KEY) throw feil("KI-tjenesten er ikke satt opp ennå.", 503);
  const r = await kiFetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: modell, max_tokens: maksTokens, system, messages: [{ role: "user", content: bilde
      ? [{ type: bilde.type === "application/pdf" ? "document" : "image", source: { type: "base64", media_type: bilde.type, data: bilde.data } }, { type: "text", text: melding }]
      : melding }] }),
  });
  if (!r.ok) throw kiFeil(r.status);
  const d = await r.json();
  return (d.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n").trim();
}
