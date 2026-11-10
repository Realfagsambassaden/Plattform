// KI-tjener for fysikkhjelp.no (Cloudflare Worker).
//   POST /hint     – ETT hint til en oppgave (åpent for alle)
//   POST /vurder   – studieappen: vurderer studentens forklaring (tekst og/eller bilde) til et quizspørsmål. Krever innlogging.
//   POST /rad      – studieappen: personlig råd om eksamensforberedelse ut fra kunnskapsprofilen. Krever innlogging.
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
- Gi ETT kort hint (2–4 setninger) på norsk bokmål. Aldri hele løsningen, aldri det endelige tallsvaret.
- Bygg videre på tidligere hint: hvert nytt hint skal være litt mer konkret enn det forrige.
- Har studenten skrevet hva hen har prøvd, ta utgangspunkt i det. Pek på den konkrete feilen eller neste steg, og si gjerne hva som var riktig.
- Still gjerne et ledende spørsmål i stedet for å fortelle svaret.
- Løsningsforslaget du får er bare til hjelp for deg. Ikke siter det.
- Skriv matematikk med \\( ... \\) rundt, for eksempel \\( W = F s \\cos\\theta \\). Ikke bruk Markdown, overskrifter eller lister.
- Spør studenten om noe som ikke handler om oppgaven, svar kort at du bare hjelper med oppgaven.`;

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
Er teksten ikke en emnebeskrivelse for et fag, svar {"feil":"kort forklaring på norsk"}.`;

const SYSTEM_VURDER = `Du er en tålmodig fysikklærer på NETTSTED, laget av Dr. Normann. En student har svart på et flervalgsspørsmål og vist hvordan hen tenkte, som tekst eller som bilde av en håndskrevet besvarelse.
Du får spørsmålet, riktig svar, en kort forklaring, alternativet studenten valgte og studentens forklaring.

Vurder hva besvarelsen viser:
- "riktig": riktig fysikk og riktig regning.
- "regnefeil": riktig tankegang og riktige formler, men feil i utregning, avrunding, enheter eller fortegn.
- "begrep": feil eller manglende forståelse av fysikken (feil formel, feil modell, gjetting), selv om studenten kanskje valgte riktig alternativ.
Er besvarelsen tom, uleselig eller handler om noe annet, bruk "uklar".

Tilbakemeldingen (2–4 setninger, norsk bokmål, du-form) skal si hva som var bra, og peke på den konkrete feilen eller neste steg. Ikke skriv hele løsningen på nytt. Bruk desimalpunktum (9.81) og skriv matematikk med $ ... $ rundt, for eksempel $v = v_0 + at$.

Svar KUN med gyldig JSON:
{"vurdering":"riktig|regnefeil|begrep|uklar","sikkerhet":"hoy|middels|lav","tilbakemelding":"…"}`;

const SYSTEM_RAD = `Du er en erfaren fysikklærer på NETTSTED, laget av Dr. Normann. Du får kunnskapsprofilen til en student: for hvert tema og undertema andelen (0–1) for
forståelse (riktig tankegang), presisjon (riktig regning når tanken er riktig) og hurtighet (riktig innen forventet tid), og antall svar.

Skriv et personlig råd om hvordan studenten best forbereder seg til eksamen, på norsk bokmål i du-form, 120–200 ord:
- Begynn med det viktigste: undertemaer med svak forståelse. Forståelse er viktigst.
- Deretter presisjon: konkrete vaner som gir færre regnefeil.
- Til slutt hurtighet. Si tydelig at den er minst viktig, men kan gi bedre tid og karakter på eksamen.
- Ros det som går bra, kort. Vær ærlig når det er få svar å bygge på.
Ingen overskrifter eller Markdown. Bruk vanlige avsnitt.`;

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
      return await hint(request, env, b, h);
    } catch (e) {
      return json({ feil: e.brukermelding || "Tjenesten er midlertidig utilgjengelig. Prøv igjen om litt." }, e.status || 502, h);
    }
  },
};

// ---------------------------------------------------------------- hint
async function hint(request, env, b, h) {
  const ip = request.headers.get("CF-Connecting-IP") || "ukjent";
  if (!(await innenforGrense(env, `hint:${ip}:${new Date().toISOString().slice(0, 13)}`, 30, 3700)))
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
  return json({ vurdering, sikkerhet, tilbakemelding: kort(r.tilbakemelding, 1200) || "Klarte ikke å vurdere besvarelsen denne gangen." }, 200, h);
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
  const svar = await spor(env, SYSTEM_RAD.replace("NETTSTED", NETTSTEDNAVN(request)), `Kunnskapsprofil:\n${linjer.join("\n")}`, 2000);
  if (!svar) throw feil("Fikk ikke noe råd fra KI denne gangen. Prøv igjen om litt.", 502);
  return json({ rad: svar }, 200, h);
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
  const raa = await spor(env, SYSTEM_DEKNING.replaceAll("fysikkhjelp.no", navn), melding, 3000);
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
  // Uten innlogging: svar på om faget dekkes, men ikke hvilke sider (veikartet) – det er for registrerte brukere.
  if (!bruker) temaer.forEach((t) => { t.antallSider = t.sider.length; t.sider = []; });
  return json({ emnekode: kort(r.emnekode, 30), emnenavn: kort(r.emnenavn, 150), kilde, temaer, oppsummering: kort(r.oppsummering, 800), innlogget: !!bruker }, 200, h);
}

async function innloggetBruker(request, env) {
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;
  const r = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } });
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
  const a = s.indexOf("{"), z = s.lastIndexOf("}");
  if (a < 0 || z <= a) return null;
  try { return JSON.parse(s.slice(a, z + 1)); } catch { return null; }
}

// ---------------------------------------------------------------- felles
function feil(melding, status) { const e = new Error(melding); e.brukermelding = melding; e.status = status; return e; }

async function innenforGrense(env, nokkel, maks, ttl) {
  if (!env.HINT_KV) return true;
  const n = parseInt((await env.HINT_KV.get(nokkel)) || "0", 10);
  if (n >= maks) return false;
  await env.HINT_KV.put(nokkel, String(n + 1), { expirationTtl: ttl });
  return true;
}

// Spør valgt KI-leverandør og returner teksten.
async function spor(env, system, melding, maksTokens, bilde) {
  const lev = (env.LEVERANDOR || "claude").toLowerCase();
  const modell = (bilde && env.MODELL_BILDE) || env.MODELL || STANDARD_MODELL[lev] || STANDARD_MODELL.claude;
  if (lev === "openai") {
    if (!env.KI_URL || !env.KI_API_KEY) throw feil("KI-tjenesten er ikke satt opp ennå.", 503);
    const r = await fetch(env.KI_URL, {
      method: "POST",
      headers: { "Authorization": `Bearer ${env.KI_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ model: modell, max_tokens: maksTokens, messages: [{ role: "system", content: system }, { role: "user", content: bilde
        ? [{ type: "image_url", image_url: { url: `data:${bilde.type};base64,${bilde.data}` } }, { type: "text", text: melding }]
        : melding }] }),
    });
    if (!r.ok) throw new Error("KI " + r.status);
    const d = await r.json();
    // OpenAI-format, med reserve for varianter (f.eks. NTNU sin chat-completion)
    const c = (d.choices || [])[0];
    const t = c?.message?.content ?? c?.text ?? d.message?.content ?? d.content ?? d.response ?? "";
    return (typeof t === "string" ? t : JSON.stringify(t)).trim();
  }
  if (!env.ANTHROPIC_API_KEY) throw feil("KI-tjenesten er ikke satt opp ennå.", 503);
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: modell, max_tokens: maksTokens, system, messages: [{ role: "user", content: bilde
      ? [{ type: "image", source: { type: "base64", media_type: bilde.type, data: bilde.data } }, { type: "text", text: melding }]
      : melding }] }),
  });
  if (!r.ok) throw new Error("KI " + r.status);
  const d = await r.json();
  return (d.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n").trim();
}
