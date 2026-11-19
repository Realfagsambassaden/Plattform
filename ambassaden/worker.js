// Realfagsambassaden – Worker foran de statiske sidene.
//   POST /api/book – bookingforespørsel fra book.html. Sendes som e-post til Ben (samme innboks
//                    som admin@realfagsambassaden.no). Svar-til er den som spurte.
// Alt annet serveres fra public/ (env.ASSETS).
//
// Krever at Email Routing er slått på for realfagsambassaden.no, og at mottakeradressen i wrangler.toml
// (send_email) er bekreftet der.
import { EmailMessage } from "cloudflare:email";

const FRA = "booking@realfagsambassaden.no";
const TIL = "normann.formidling@gmail.com";   // bekreftet mottaker i Email Routing (samme som i wrangler.toml)
const KONTAKT = "admin@realfagsambassaden.no";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/book") {
      if (request.method !== "POST") return json({ feil: "Bruk POST." }, 405);
      try { return await book(request, env); }
      catch (e) { console.log("book", e && e.message); return json({ feil: e.brukermelding || `Fikk ikke sendt forespørselen. Prøv igjen, eller send en e-post til ${KONTAKT}.` }, e.status || 500); }
    }
    return env.ASSETS.fetch(request);
  },
};

function feil(m, s) { const e = new Error(m); e.brukermelding = m; e.status = s; return e; }
const kort = (s, n) => String(s || "").replace(/[\r\n]+/g, " ").trim().slice(0, n);
const b64 = (s) => { const b = new TextEncoder().encode(s); let t = ""; for (const x of b) t += String.fromCharCode(x); return btoa(t); };
const linjer = (s) => s.replace(/.{1,76}/g, "$&\r\n");

async function book(request, env) {
  if (!env.EPOST) throw feil(`Skjemaet er ikke åpnet ennå. Send en e-post til ${KONTAKT}.`, 503);
  if (Number(request.headers.get("content-length") || 0) > 64 * 1024) throw feil("Meldingen er for lang.", 413);
  const f = await request.formData();
  if (f.get("nettadresse")) return json({ ok: true });            // honningkrukke: roboter fyller ut skjulte felt
  const d = {
    navn: kort(f.get("navn"), 100), epost: kort(f.get("epost"), 120), organisasjon: kort(f.get("organisasjon"), 160),
    telefon: kort(f.get("telefon"), 40), publikum: kort(f.get("publikum"), 60), ambassador: kort(f.get("ambassador"), 60),
    tid: kort(f.get("tid"), 120), antall: kort(f.get("antall"), 30), melding: String(f.get("melding") || "").trim().slice(0, 4000),
  };
  if (!d.navn || !/^[^@\s<>"]+@[^@\s<>"]+\.[^@\s<>"]+$/.test(d.epost) || !d.organisasjon || !d.melding)
    throw feil("Fyll inn navn, e-post, skole/organisasjon og hva dere ønsker.", 400);

  const tekst = [
    `Ny bookingforespørsel fra realfagsambassaden.no`, "",
    `Navn: ${d.navn}`, `E-post: ${d.epost}`, `Telefon: ${d.telefon || "–"}`,
    `Skole/organisasjon: ${d.organisasjon}`, `Publikum: ${d.publikum || "–"}`, `Ønsket ambassadør: ${d.ambassador || "–"}`,
    `Når: ${d.tid || "–"}`, `Antall deltakere: ${d.antall || "–"}`, "",
    "Hva de ønsker:", d.melding, "",
    "Svar på denne e-posten for å svare dem direkte.",
  ].join("\r\n");
  const emne = `Booking: ${d.organisasjon} – ${d.publikum || "publikum ukjent"}`;
  const id = `<${crypto.randomUUID()}@realfagsambassaden.no>`;
  const mime = [
    `From: Realfagsambassaden <${FRA}>`, `To: ${TIL}`, `Reply-To: ${d.epost}`,
    `Subject: =?UTF-8?B?${b64(emne)}?=`, `Message-ID: ${id}`, `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0", "Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: base64", "",
    linjer(b64(tekst)),
  ].join("\r\n");
  try { await env.EPOST.send(new EmailMessage(FRA, TIL, mime)); }
  catch (e) { console.log("send_email", e && e.message); throw feil(`Fikk ikke sendt forespørselen akkurat nå. Prøv igjen, eller send en e-post til ${KONTAKT}.`, 502); }
  return json({ ok: true });
}
