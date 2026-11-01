// Realfagsambassaden – Worker foran de statiske sidene.
//   POST /api/doner  – tar imot donerte forelesningsnotater og legger dem i det private repoet
//                      Realfagsambassaden/donasjoner (én mappe per donasjon + en sak/issue i køen).
// Alt annet serveres fra public/ (env.ASSETS).
//
// Hemmeligheter (settes av GitHub-automatikken):
//   GH_DONASJON – fine-grained nøkkel med Contents + Issues: Read and write på Realfagsambassaden/donasjoner

const REPO = "Realfagsambassaden/donasjoner";
const MAKS_FIL = 25 * 1024 * 1024;     // 25 MB per fil
const MAKS_TOTALT = 90 * 1024 * 1024;  // 90 MB per donasjon
const MAKS_ANTALL = 20;
const TILLATT = /\.(pdf|tex|bib|sty|cls|zip|md|qmd|txt|png|jpe?g|heic|webp|svg|pptx?|key|docx?|odt|odp|ipynb|py)$/i;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/doner") {
      if (request.method !== "POST") return json({ feil: "Bruk POST." }, 405);
      try { return await doner(request, env); }
      catch (e) { return json({ feil: e.brukermelding || "Noe gikk galt under opplastingen. Prøv igjen, eller send notatene på e-post." }, e.status || 500); }
    }
    return env.ASSETS.fetch(request);
  },
};

function feil(m, s) { const e = new Error(m); e.brukermelding = m; e.status = s; return e; }
const kort = (s, n) => String(s || "").trim().slice(0, n);
const slug = (s) => kort(s, 40).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
  .replace(/æ/g, "ae").replace(/ø/g, "o").replace(/å/g, "a").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "ukjent";

async function doner(request, env) {
  if (!env.GH_DONASJON) throw feil("Donasjoner er ikke åpnet ennå. Kom gjerne tilbake snart!", 503);
  const len = Number(request.headers.get("content-length") || 0);
  if (len > MAKS_TOTALT + 1024 * 1024) throw feil("Filene er for store til sammen (maks 90 MB). Del dem opp i flere donasjoner.", 413);

  const f = await request.formData();
  if (f.get("nettadresse")) return json({ ok: true });            // honningkrukke: roboter fyller ut skjulte felt
  const d = {
    navn: kort(f.get("navn"), 100), epost: kort(f.get("epost"), 120), institusjon: kort(f.get("institusjon"), 120),
    nettsted: kort(f.get("nettsted"), 40), fag: kort(f.get("fag"), 120), emnekode: kort(f.get("emnekode"), 30),
    kreditering: kort(f.get("kreditering"), 30), kommentar: kort(f.get("kommentar"), 3000),
    rettigheter: f.get("rettigheter") === "ja",
  };
  if (!d.navn || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.epost) || !d.fag) throw feil("Fyll inn navn, e-post og fag.", 400);
  if (!d.rettigheter) throw feil("Du må bekrefte at du har rett til å dele notatene.", 400);

  const filer = f.getAll("filer").filter((x) => x && typeof x === "object" && x.size > 0);
  if (!filer.length) throw feil("Legg ved minst én fil.", 400);
  if (filer.length > MAKS_ANTALL) throw feil(`Maks ${MAKS_ANTALL} filer per donasjon.`, 400);
  let tot = 0;
  for (const x of filer) {
    if (!TILLATT.test(x.name)) throw feil(`Filtypen til «${x.name}» støttes ikke. Bruk PDF, LaTeX, bilder, lysbilder eller zip.`, 400);
    if (x.size > MAKS_FIL) throw feil(`«${x.name}» er for stor (maks 25 MB per fil).`, 413);
    tot += x.size;
  }
  if (tot > MAKS_TOTALT) throw feil("Filene er for store til sammen (maks 90 MB).", 413);

  const dato = new Date().toISOString().slice(0, 10);
  const id = crypto.randomUUID().slice(0, 6);
  const mappe = `${dato}-${slug(d.navn)}-${id}`;
  const navnBrukt = new Set();

  for (const x of filer) {
    let n = x.name.replace(/[\/\\]/g, "_").replace(/[^\w.\-æøåÆØÅ ]/g, "_").slice(-120);
    while (navnBrukt.has(n)) n = "1-" + n;
    navnBrukt.add(n);
    await leggTil(env, `${mappe}/${n}`, await x.arrayBuffer(), `Donasjon ${mappe}: ${n}`);
  }
  const info = [
    `# Donasjon ${mappe}`, "",
    `- **Navn:** ${d.navn}`, `- **E-post:** ${d.epost}`, `- **Institusjon:** ${d.institusjon || "–"}`,
    `- **Nettsted:** ${d.nettsted || "–"}`, `- **Fag:** ${d.fag}`, `- **Emnekode:** ${d.emnekode || "–"}`,
    `- **Kreditering:** ${d.kreditering || "fullt navn"}`, `- **Rettigheter bekreftet:** ja (${new Date().toISOString()})`, "",
    "## Kommentar", "", d.kommentar || "–", "",
    "## Filer", "", ...[...navnBrukt].map((n) => `- [${n}](${encodeURIComponent(n)})`), "",
  ].join("\n");
  await leggTil(env, `${mappe}/INFO.md`, new TextEncoder().encode(info), `Donasjon ${mappe}: info`);

  await gh(env, `repos/${REPO}/issues`, "POST", {
    title: `Ny donasjon: ${d.fag} – ${d.navn}`,
    body: `${info}\n\n---\nMappe: [\`${mappe}\`](https://github.com/${REPO}/tree/main/${encodeURIComponent(mappe)})\n\n**Neste steg:** Claude går gjennom notatene, sammenligner med det som finnes, og lager et forslag (pull request) i fagets repo.`,
    labels: ["donasjon"],
  });
  return json({ ok: true, id: mappe });
}

function base64(buf) {
  const b = new Uint8Array(buf); let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
}
async function leggTil(env, sti, buf, melding) {
  await gh(env, `repos/${REPO}/contents/${sti.split("/").map(encodeURIComponent).join("/")}`, "PUT",
    { message: melding, content: base64(buf) });
}
async function gh(env, sti, metode, body) {
  const r = await fetch(`https://api.github.com/${sti}`, {
    method: metode,
    headers: { Authorization: `Bearer ${env.GH_DONASJON}`, Accept: "application/vnd.github+json", "User-Agent": "realfagsambassaden-donasjon", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) { console.log("GitHub", r.status, (await r.text()).slice(0, 300)); throw feil("Fikk ikke lagret donasjonen akkurat nå. Prøv igjen litt senere.", 502); }
  return r.json();
}
