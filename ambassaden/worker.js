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

  const filerUt = [];
  for (const x of filer) {
    let n = x.name.replace(/[\/\\]/g, "_").replace(/[^\w.\-æøåÆØÅ ]/g, "_").slice(-120);
    while (navnBrukt.has(n)) n = "1-" + n;
    navnBrukt.add(n);
    filerUt.push({ sti: `${mappe}/${n}`, fil: x });
  }
  const info = [
    `# Donasjon ${mappe}`, "",
    `- **Navn:** ${d.navn}`, `- **E-post:** ${d.epost}`, `- **Institusjon:** ${d.institusjon || "–"}`,
    `- **Nettsted:** ${d.nettsted || "–"}`, `- **Fag:** ${d.fag}`, `- **Emnekode:** ${d.emnekode || "–"}`,
    `- **Kreditering:** ${d.kreditering || "fullt navn"}`, `- **Rettigheter bekreftet:** ja (${new Date().toISOString()})`, "",
    "## Kommentar", "", d.kommentar || "–", "",
    "## Filer", "", ...[...navnBrukt].map((n) => `- [${n}](${encodeURIComponent(n)})`), "",
  ].join("\n");
  filerUt.push({ sti: `${mappe}/INFO.md`, tekst: info });
  await lagreAlt(env, filerUt, `Donasjon ${mappe}: ${d.fag} (${filerUt.length - 1} filer)`);

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
// Alle filene lagres i én commit (Git Data API): blobs lastes opp parallelt, så ett tre og én commit.
// Mye raskere enn én commit per fil. Begrenser hvor mye som er i luften samtidig, så minnet holder.
async function lagreAlt(env, filer, melding) {
  const BUDSJETT = 30 * 1024 * 1024;
  const tre = new Array(filer.length);
  let i = 0, iLufta = 0; const aktive = new Set();
  while (i < filer.length || aktive.size) {
    while (i < filer.length) {
      const f = filer[i], str = f.fil ? f.fil.size : f.tekst.length;
      if (aktive.size && iLufta + str > BUDSJETT) break;
      const nr = i++; iLufta += str;
      const p = (async () => {
        const body = f.fil ? { content: base64(await f.fil.arrayBuffer()), encoding: "base64" } : { content: f.tekst, encoding: "utf-8" };
        const b = await gh(env, `repos/${REPO}/git/blobs`, "POST", body);
        tre[nr] = { path: f.sti, mode: "100644", type: "blob", sha: b.sha };
      })().finally(() => { iLufta -= str; aktive.delete(p); });
      aktive.add(p);
    }
    if (aktive.size) await Promise.race(aktive);
  }
  for (let forsok = 0; ; forsok++) {
    const ref = await gh(env, `repos/${REPO}/git/ref/heads/main`, "GET");
    const forelder = await gh(env, `repos/${REPO}/git/commits/${ref.object.sha}`, "GET");
    const t = await gh(env, `repos/${REPO}/git/trees`, "POST", { base_tree: forelder.tree.sha, tree: tre });
    const c = await gh(env, `repos/${REPO}/git/commits`, "POST", { message: melding, tree: t.sha, parents: [ref.object.sha] });
    try { await gh(env, `repos/${REPO}/git/refs/heads/main`, "PATCH", { sha: c.sha }); return; }
    catch (e) { if (forsok >= 3) throw e; }   // noen andre lagret samtidig – prøv igjen
  }
}
async function gh(env, sti, metode, body) {
  const r = await fetch(`https://api.github.com/${sti}`, {
    method: metode,
    headers: { Authorization: `Bearer ${env.GH_DONASJON}`, Accept: "application/vnd.github+json", "User-Agent": "realfagsambassaden-donasjon", "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) { console.log("GitHub", r.status, (await r.text()).slice(0, 300)); throw feil("Fikk ikke lagret donasjonen akkurat nå. Prøv igjen litt senere.", 502); }
  return r.json();
}
