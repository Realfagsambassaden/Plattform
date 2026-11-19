// Eksamenstrening med Dashman (eksamensmodus i studieappen).
//   POST /eksamen/neste  – neste eksamensoppgave til studenten (uten fasit og løsning), fra temaene studenten jobber med.
//   POST /eksamen/svar   – studenten har valgt et svar (og kanskje lagt ved bilde av utregningen): fasit, tilbakemelding og
//                          forklaring fra Dashman. Svaret lagres i studie_svar, så det teller i kunnskapsprofilen.
//   POST /eksamen/anslag – anslått prosent av poengene på eksamen, med usikkerhetsintervall. Regnes ut (ikke KI) fra
//                          svarene på eksamensoppgaver og quizer, vektet etter hvor mye hvert tema teller på eksamenene.
// Oppgavene kommer fra det private repoet Realfagsambassaden/eksamener. verktoy/eksamener.py lager eksamener.json
// (med fasit og løsning, som aldri sendes til nettleseren før studenten har svart) og legger figurene i statisk/eksamen/.
import DATA from "./eksamener.json";

const OPPGAVER = [];   // flat liste: { eid, eksamen, nr, tema, tekst, alternativer, riktig, losning, figur, gruppe, kontekst }
(function bygg() {
  const sett = new Set();   // samme oppgave i flere eksamener (f.eks. felles mekanikkdel) tas med én gang
  for (const e of DATA.eksamener || []) {
    for (const o of e.oppgaver || []) {
      if (!o.tekst || !Array.isArray(o.alternativer) || !o.riktig || sett.has(o.tekst)) continue;
      sett.add(o.tekst);
      OPPGAVER.push({ eid: e.id, eksamen: e.tittel || e.id, nr: o.nr, tema: o.tema || "", tekst: o.tekst, alternativer: o.alternativer,
        riktig: o.riktig, losning: o.losning || "", figur: o.figur || "", gruppe: o.gruppe || "", kontekst: o.kontekst || "" });
    }
  }
})();
export const harEksamener = () => OPPGAVER.length > 0;
const nokkel = (o) => `eks:${o.eid}#${o.nr}`;
const temaRot = (t) => String(t || "").split("/")[0];

// Oppgaver innenfor temaene studenten jobber med (tom liste = alle).
function relevante(temaer) {
  const t = new Set((Array.isArray(temaer) ? temaer : []).map((x) => String(x).split("/").pop()));
  const l = t.size ? OPPGAVER.filter((o) => t.has(temaRot(o.tema))) : OPPGAVER;
  return l.length ? l : OPPGAVER;
}

async function mineSvar(env, token) {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/studie_svar?select=sporsmal,tema,type,opprettet&order=opprettet.desc&limit=2000`,
    { headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }).catch(() => null);
  return r && r.ok ? await r.json() : [];
}

function utenFasit(o, origin) {
  return { eid: o.eid, nr: o.nr, eksamen: o.eksamen, tema: o.tema, tekst: o.tekst, alternativer: o.alternativer, gruppe: o.gruppe || null,
    kontekst: o.kontekst || null, figur: o.figur ? `${origin}/eksamen/${o.eid}/${o.figur}` : null };
}

export async function eksamenNeste(request, env, b, h, d) {
  const bruker = await d.innloggetBruker(request, env);
  if (!bruker) return d.json({ feil: "Logg inn for å trene på eksamensoppgaver." }, 401, h);
  if (!harEksamener()) return d.json({ feil: "Eksamensoppgavene er ikke lagt inn ennå." }, 503, h);
  const token = request.headers.get("Authorization").replace(/^Bearer\s+/i, "");
  const svar = await mineSvar(env, token);
  const sett = new Map();   // nøkkel -> siste type
  for (const s of svar) if (String(s.sporsmal).startsWith("eks:") && !sett.has(s.sporsmal)) sett.set(s.sporsmal, s.type);
  const hoppOver = new Set((Array.isArray(b.hoppOver) ? b.hoppOver : []).map(String).slice(0, 200));
  const l = relevante(b.temaer).filter((o) => !hoppOver.has(nokkel(o)));
  // Først oppgaver studenten ikke har gjort, så dem studenten bommet på, så resten. Innenfor hver gruppe: tilfeldig,
  // men oppgaver som henger sammen (gruppe) tas i rekkefølge.
  const ikkeGjort = l.filter((o) => !sett.has(nokkel(o))), feil = l.filter((o) => sett.has(nokkel(o)) && sett.get(nokkel(o)) !== "riktig");
  const pool = ikkeGjort.length ? ikkeGjort : feil.length ? feil : l;
  if (!pool.length) return d.json({ ferdig: true }, 200, h);
  let o = null;
  // Oppgaver som henger sammen (f.eks. «Oppgave 25 og 26 henger sammen»): har studenten nettopp svart på en oppgave i
  // en gruppe, kommer neste oppgave i samme gruppe – uansett tema og om den er gjort før – til hele gruppa er gjort.
  const siste = svar.find((s) => String(s.sporsmal).startsWith("eks:"));
  if (siste) {
    const [eid, nr] = String(siste.sporsmal).slice(4).split("#");
    const forrige = OPPGAVER.find((x) => x.eid === eid && x.nr === Number(nr));
    if (forrige && forrige.gruppe) o = OPPGAVER.filter((x) => x.eid === eid && x.gruppe === forrige.gruppe && x.nr > forrige.nr && !hoppOver.has(nokkel(x))).sort((a, c) => a.nr - c.nr)[0] || null;
  }
  if (!o) {
    o = pool[Math.floor(Math.random() * pool.length)];
    if (o.gruppe) {   // start på første oppgave i gruppa, så studenten får hele sammenhengen
      const g = OPPGAVER.filter((x) => x.eid === o.eid && x.gruppe === o.gruppe && !hoppOver.has(nokkel(x))).sort((a, c) => a.nr - c.nr);
      if (g.length) o = g[0];
    }
  }
  // Oppgaver som henger sammen: ta med teksten fra den første oppgaven i gruppa som bakgrunn.
  let kontekst = null;
  if (o.gruppe) {
    const forste = OPPGAVER.filter((x) => x.eid === o.eid && x.gruppe === o.gruppe).sort((a, c) => a.nr - c.nr)[0];
    if (forste && forste.nr !== o.nr) kontekst = forste.tekst;
  }
  const origin = new URL(request.url).origin;
  return d.json({ oppgave: { ...utenFasit(o, origin), kontekst }, igjen: Math.max(0, ikkeGjort.length - 1), totalt: l.length }, 200, h);
}

const BOKSTAV = ["A", "B", "C", "D", "E", "F"];

export async function eksamenSvar(request, env, b, h, d) {
  const bruker = await d.innloggetBruker(request, env);
  if (!bruker) return d.json({ feil: "Logg inn for å trene på eksamensoppgaver." }, 401, h);
  const o = OPPGAVER.find((x) => x.eid === String(b.eid) && x.nr === Number(b.nr));
  if (!o) return d.json({ feil: "Fant ikke oppgaven." }, 404, h);
  const valgt = Number(b.valgt);
  if (!(valgt >= 1 && valgt <= o.alternativer.length)) return d.json({ feil: "Velg et av alternativene." }, 400, h);
  const riktig = valgt === o.riktig;
  const token = request.headers.get("Authorization").replace(/^Bearer\s+/i, "");
  const bilde = d.lesBilde(b.bilde);
  if (b.bilde && !bilde) return d.json({ feil: "Bildet må være JPEG, PNG eller WebP og mindre enn 4 MB." }, 400, h);
  if (!(await d.innenforGrense(env, `eksamen:${bruker.id}:${new Date().toISOString().slice(0, 10)}`, 150, 90000)))
    return d.json({ feil: "Du har levert veldig mange eksamensoppgaver i dag. Ta en pause, og fortsett i morgen." }, 429, h);

  // Dashman gir tilbakemelding og forklaring (nå er det lov å vise løsningen, studenten har svart).
  const alt = o.alternativer.map((a, i) => `${BOKSTAV[i]}. ${a}`).join("\n");
  const system = `Du er Dashman, en vennlig og presis KI-læringspartner i fysikk og matematikk på ${d.nettstedsnavn}. Studenten trener i EKSAMENSMODUS: hen har løst en tidligere eksamensoppgave helt selv og levert et svar. Nå skal du gi tilbakemelding og forklare. Skriv på norsk bokmål, kort og konkret (høyst 180 ord), med formler i LaTeX ($…$). Desimaltegn er punktum.
- Si først tydelig om svaret er riktig.
- Er svaret feil: forklar hvorfor det valgte alternativet er feil og hvordan man kommer fram til det riktige, steg for steg (bruk løsningsforslaget). Pek på den typiske feilen (f.eks. glemt treghetsmoment, feil fortegn, enhetsfeil).
- Er svaret riktig: bekreft kort, og nevn hva som var nøkkelen eller en vanlig felle.
- Har studenten lagt ved et bilde av utregningen: kommenter den kort (første sted det går galt, eller at den er god).
- Avslutt med én setning om hva studenten bør øve mer på hvis det var feil.
Svar BARE med JSON: {"svar": "...", "humor": "glad|noytral|tenker|trist", "type": "riktig|regnefeil|begrep"}. «type»: riktig = riktig svar; regnefeil = riktig tankegang men regne- eller avlesningsfeil; begrep = feil fysikk/metode eller gjetning.`;
  const melding = `Eksamen: ${o.eksamen}, oppgave ${o.nr} (tema ${o.tema}).
${o.kontekst ? "Bakgrunn fra oppgaven(e) før: " + o.kontekst + "\n" : ""}Oppgave: ${o.tekst}
Alternativer:
${alt}
Riktig svar: ${BOKSTAV[o.riktig - 1]}
Studentens svar: ${BOKSTAV[valgt - 1]} (${riktig ? "riktig" : "feil"})
Løsningsforslag: ${o.losning}`;
  let svar = "", humor = riktig ? "glad" : "tenker", type = riktig ? "riktig" : "begrep";
  try {
    const raa = await d.spor(env, system, melding, 900, bilde);
    const r = d.lesJson(raa);
    svar = String((r && r.svar) || raa || "").slice(0, 4000).trim();
    if (r && ["glad", "noytral", "tenker", "trist"].includes(r.humor)) humor = r.humor;
    if (!riktig && r && (r.type === "regnefeil" || r.type === "begrep")) type = r.type;
  } catch (e) {
    svar = (riktig ? "Riktig! " : `Det riktige svaret er ${BOKSTAV[o.riktig - 1]}. `) + "Her er løsningsforslaget:\n\n" + o.losning;
  }
  // Lagres som et vanlig svar, så det teller i kunnskapsprofilen (tema/undertema fra eksamensoppgaven).
  const [tema, undertema] = String(o.tema || "eksamen/eksamen").split("/");
  try {
    await fetch(`${env.SUPABASE_URL}/rest/v1/studie_svar`, { method: "POST",
      headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ nettsted: "fysikkhjelp", sporsmal: nokkel(o).slice(0, 80), tema: (tema || "eksamen").slice(0, 80), undertema: (undertema || tema || "eksamen").slice(0, 80),
        vanskelighet: "middels", type, tid_s: Number(b.tid_s) > 0 ? Math.min(36000, Number(b.tid_s)) : null, ki: { kilde: "eksamen", valgt, riktig: o.riktig } }) });
  } catch {}
  return d.json({ riktig, fasit: o.riktig, svar, humor, type }, 200, h);
}

// Anslag: for hvert tema regnes en sannsynlighet for riktig svar ut fra eksamenssvar (full vekt) og quizsvar (halv vekt),
// med et svakt forhåndsanslag på 50 %. Temaene vektes etter hvor stor del av eksamensoppgavene de utgjør. Usikkerheten
// tar med både hvor få svar det er og en fast modellusikkerhet, og intervallet er ca. 90 %.
export async function eksamenAnslag(request, env, b, h, d) {
  const bruker = await d.innloggetBruker(request, env);
  if (!bruker) return d.json({ feil: "Logg inn først." }, 401, h);
  if (!harEksamener()) return d.json({ feil: "Eksamensoppgavene er ikke lagt inn ennå." }, 503, h);
  const token = request.headers.get("Authorization").replace(/^Bearer\s+/i, "");
  const l = relevante(b.temaer);
  const vekt = {};
  for (const o of l) { const t = temaRot(o.tema); vekt[t] = (vekt[t] || 0) + 1; }
  const sum = Object.values(vekt).reduce((a, c) => a + c, 0) || 1;
  const svar = await mineSvar(env, token);
  const st = {};
  for (const s of svar) {
    const t = String(s.tema || ""); if (!vekt[t]) continue;
    const x = st[t] || (st[t] = { ek: 0, en: 0, qk: 0, qn: 0 });
    if (String(s.sporsmal).startsWith("eks:")) { x.en++; if (s.type === "riktig") x.ek++; }
    else { x.qn++; if (s.type === "riktig") x.qk++; }
  }
  let E = 0, V = 0, grunnlag = 0, eks = 0;
  const temaer = [];
  for (const t of Object.keys(vekt)) {
    const w = vekt[t] / sum, x = st[t] || { ek: 0, en: 0, qk: 0, qn: 0 };
    const n = x.en + 0.5 * x.qn, k = x.ek + 0.5 * x.qk;
    const p = (k + 1) / (n + 2);
    E += w * p; V += w * w * p * (1 - p) / (n + 3);
    grunnlag += x.en + x.qn; eks += x.en;
    temaer.push({ tema: t, vekt: Math.round(w * 100), andel: Math.round(p * 100), svar: x.en + x.qn, eksamenssvar: x.en });
  }
  const modell = eks >= 20 ? 0.07 : eks >= 8 ? 0.09 : 0.12;   // hvor godt quiz og eksamenstrening treffer eksamen
  const sd = Math.sqrt(V + modell * modell);
  const rund = (v) => Math.max(0, Math.min(100, Math.round(v * 100 / 5) * 5));
  temaer.sort((a, c) => c.vekt - a.vekt);
  return d.json({ prosent: rund(E), lav: rund(E - 1.645 * sd), hoy: rund(E + 1.645 * sd), grunnlag, eksamenssvar: eks,
    nok: grunnlag >= 15, temaer: temaer.slice(0, 12), eksamener: [...new Set(l.map((o) => o.eksamen))] }, 200, h);
}

// Til /dashman: eksamensoppgaven studenten nettopp har svart på (for å diskutere den etterpå, med løsningen).
export function eksamenKontekst(eid, nr) {
  const o = OPPGAVER.find((x) => x.eid === String(eid) && x.nr === Number(nr));
  if (!o) return null;
  return { oppgave: `${o.eksamen}, oppgave ${o.nr}: ${o.tekst}\nAlternativer: ${o.alternativer.map((a, i) => `${BOKSTAV[i]}. ${a}`).join("; ")}\nRiktig svar: ${BOKSTAV[o.riktig - 1]}`, losning: o.losning };
}
