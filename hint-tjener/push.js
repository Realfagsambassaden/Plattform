// Push-varsler (Web Push) fra KI-tjeneren til studieappen.
// - Krypterer meldingen etter RFC 8291 (aes128gcm) og signerer med VAPID (RFC 8292, ES256), bare med WebCrypto.
// - VAPID_PUBLIC (under) er offentlig og står også i assets/js/studie.js. Den hemmelige delen ligger som
//   Cloudflare-hemmeligheten VAPID_PRIVATE_KEY (GitHub-hemmelighet med samme navn, settes ved publisering).
// - Hvem som skal ha hvilke varsler, regnes ut i databasen (supabase/oppsett.sql: push_jobb). Tjeneren henter jobben
//   hvert kvarter (cron i wrangler.toml) med PUSH_HEMMELIG og sender varslene.

export const VAPID_PUBLIC = "BF6VR9S7RsTBPzjxObu_ILs8B1ZYFnGeIWlYFu-fHeqGMm_xYFC-IZG1o3SBtihF3xDY8AnDlaAmFcvDRJV6xXY";
const KONTAKT = "https://realfagsambassaden.no";

const enc = new TextEncoder();
export const b64u = {
  til(buf) { let s = ""; new Uint8Array(buf).forEach((b) => (s += String.fromCharCode(b))); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); },
  fra(s) { s = String(s).replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; },
};
const slaSammen = (...d) => { const n = d.reduce((a, x) => a + x.length, 0), u = new Uint8Array(n); let i = 0; for (const x of d) { u.set(x, i); i += x.length; } return u; };

async function hkdf(salt, ikm, info, lengde) {
  const k = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, k, lengde * 8));
}

// Krypter payload for ett abonnement (p256dh og auth fra nettleseren). Gir hele kroppen for aes128gcm.
export async function krypter(tekst, p256dh, auth) {
  const uaPub = b64u.fra(p256dh), authSecret = b64u.fra(auth);
  const eph = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", eph.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const delt = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, eph.privateKey, 256));
  const ikm = await hkdf(authSecret, delt, slaSammen(enc.encode("WebPush: info\0"), uaPub, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const nokkel = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const klar = slaSammen(enc.encode(tekst), new Uint8Array([2]));   // 0x02: siste (og eneste) blokk
  const chiffer = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, nokkel, klar));
  const hode = new Uint8Array(21); hode.set(salt, 0); new DataView(hode.buffer).setUint32(16, 4096); hode[20] = 65;
  return slaSammen(hode, asPub, chiffer);
}

async function vapidHode(endpoint, privatD) {
  const pub = b64u.fra(VAPID_PUBLIC);
  const jwk = { kty: "EC", crv: "P-256", d: privatD, x: b64u.til(pub.slice(1, 33)), y: b64u.til(pub.slice(33, 65)), ext: true };
  const nokkel = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const del = (o) => b64u.til(enc.encode(JSON.stringify(o)));
  const usignert = del({ typ: "JWT", alg: "ES256" }) + "." + del({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: KONTAKT });
  const sign = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, nokkel, enc.encode(usignert));
  return `vapid t=${usignert}.${b64u.til(sign)}, k=${VAPID_PUBLIC}`;
}

// Send ett varsel. Gir HTTP-status fra push-tjenesten (201 = sendt, 404/410 = abonnementet finnes ikke lenger).
export async function sendPush(env, ab, melding) {
  const kropp = await krypter(JSON.stringify(melding), ab.p256dh, ab.auth);
  const r = await fetch(ab.endpoint, {
    method: "POST",
    headers: { Authorization: await vapidHode(ab.endpoint, env.VAPID_PRIVATE_KEY), "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", TTL: "86400", Urgency: "normal" },
    body: kropp,
  });
  return r.status;
}

async function rpc(env, navn, args) {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${navn}`, {
    method: "POST", headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error(`${navn}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

// Kjøres av cron: hent nye varsler fra databasen og send dem. Døde abonnementer fjernes.
// Kjøres hvert minutt: oppmøtesjekker hvert minutt, de vanlige varslene hvert kvarter.
export async function pushRunde(env, tid) {
  if (!env.PUSH_HEMMELIG || !env.VAPID_PRIVATE_KEY) return { hoppet: "ikke satt opp" };
  const kvarter = new Date(tid || Date.now()).getUTCMinutes() % 15 === 0;
  const jobb = [
    ...((await rpc(env, "oppmote_push", { h: env.PUSH_HEMMELIG }).catch(() => [])) || []),
    ...(kvarter ? (await rpc(env, "push_jobb", { h: env.PUSH_HEMMELIG })) || [] : []),
  ];
  let sendt = 0, fjernet = 0;
  for (const j of jobb) {
    try {
      const s = await sendPush(env, j, { tittel: j.tittel, tekst: j.tekst, url: j.url || "/studie/index.html" });
      if (s === 404 || s === 410) { await rpc(env, "push_fjern", { h: env.PUSH_HEMMELIG, e: j.endpoint }); fjernet++; }
      else if (s < 300) sendt++;
    } catch { /* ett feilet varsel stopper ikke resten */ }
  }
  return { sendt, fjernet, totalt: jobb.length };
}
