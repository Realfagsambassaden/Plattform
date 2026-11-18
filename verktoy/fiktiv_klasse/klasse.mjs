// Fiktiv klasse: ti robot-elever (Arnt, svakest … Julie, sterkest) bruker studieappen som ekte studenter og leter etter feil.
//
// Kjøres av GitHub-jobben «Fiktiv klasse» (.github/workflows/fiktiv-klasse.yml), startet fra knappen i kursbyggeren
// (bare admin) eller for hånd under Actions. Hver kjøring:
//   1. Lager (eller oppdaterer) en KOPI av kurset: «<navn> – fiktiv klasse». De ekte studentene ser den aldri.
//   2. Lager de ti kontoene hvis de mangler (e-post på @fiktiv.fysikkhjelp.no, merket fiktiv: true) og melder dem på kopien.
//   3. Hver elev åpner arbeidskravene i en ekte nettleser (Playwright), svarer etter nivået sitt (Claude Haiku løser
//      oppgaven; svakere elever gjør oftere feil og glemmer strekene under svaret), laster opp en «håndskrevet» utregning,
//      laster siden på nytt, hopper over og går tilbake – og snakker med Dashman.
//   4. Alt som ser galt ut, logges som FUNN med skjermbilde: feilmeldinger i nettleseren, forespørsler som feiler, appen
//      som henger, godkjente spørsmål som blir røde etter omlasting, svar Haiku mener er riktige men appen avviser, osv.
//   5. Rapporten legges som sammendrag i jobben, som vedlegg (med skjermbilder) og som et issue i Plattform.
//
// Miljø: SUPABASE_SERVICE_ROLE_KEY (GitHub-hemmelighet), ANTHROPIC_API_KEY, KURS (kurs-id), RUNDER, ELEVER, NULLSTILL.
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const NETTSTED = process.env.NETTSTED || 'https://fysikkhjelp.no';
const SUPA_URL = 'https://fwyoldmtjnfxtkdwldzx.supabase.co';
const ANON = 'sb_publishable_mapCEnSSxrSSwTbBKao6hw_qMOClLSS';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const KI_NOKKEL = process.env.ANTHROPIC_API_KEY;
const MODELL = process.env.MODELL || 'claude-haiku-5-5';
const KILDE = process.env.KURS;
const RUNDER = Math.max(1, Math.min(10, +process.env.RUNDER || 1));
const NULLSTILL = process.env.NULLSTILL === 'true';
const UT = process.env.UT || 'fiktiv-rapport';
const LAGRING = 'sb-fwyoldmtjnfxtkdwldzx-auth-token';

const ALLE = ['Arnt', 'Bernt', 'Celine', 'David', 'Ernst', 'Felicia', 'Gunn', 'Hårek', 'Iselin', 'Julie'];
const VALGT = (process.env.ELEVER || '').trim() ? process.env.ELEVER.split(',').map((s) => s.trim()).filter((n) => ALLE.includes(n)) : ALLE;

fs.mkdirSync(path.join(UT, 'bilder'), { recursive: true });
// Stopper roboten før den kommer i gang, skrives grunnen i rapporten (så den havner i sammendraget og issuet).
function stopp(grunn) {
  fs.writeFileSync(path.join(UT, 'rapport.md'), `# Fiktiv klasse: stoppet før start\n\n**1 feil, 0 til sjekk**\n\n\`\`\`\n${grunn}\n\`\`\`\n`);
  console.error(grunn); process.exit(1);
}
process.on('unhandledRejection', (e) => stopp('Roboten krasjet: ' + (e && e.stack || e)));
process.on('uncaughtException', (e) => stopp('Roboten krasjet: ' + (e && e.stack || e)));
if (!SERVICE) stopp('Mangler SUPABASE_SERVICE_ROLE_KEY (GitHub-hemmelighet).');
if (!KILDE) stopp('Mangler KURS (kurs-id).');
const admin = createClient(SUPA_URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

// ---------------------------------------------------------------- funn
const funn = [];
let bildeNr = 0;
async function nyttFunn(elev, alvor, tittel, detaljer, side) {
  let bilde = null;
  if (side) { try { bilde = `bilder/${String(++bildeNr).padStart(3, '0')}-${elev.navn}.png`; await side.screenshot({ path: path.join(UT, bilde), fullPage: false }); } catch { bilde = null; } }
  funn.push({ elev: elev.navn, alvor, tittel, detaljer: String(detaljer || '').slice(0, 1500), bilde, tid: new Date().toISOString() });
  console.log(`[${elev.navn}] ${alvor.toUpperCase()}: ${tittel}`);
}
const logg = [];
function notat(elev, t) { logg.push(`${new Date().toISOString().slice(11, 19)} ${elev.navn}: ${t}`); console.log(`[${elev.navn}] ${t}`); }

// ---------------------------------------------------------------- tilfeldighet (fast frø per kjøring og elev, så funn kan gjentas)
function rng(fro) { let a = crypto.createHash('sha256').update(String(fro)).digest().readUInt32LE(0); return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const FRO = process.env.FRO || new Date().toISOString().slice(0, 16);

// ---------------------------------------------------------------- KI (Haiku)
async function ki(system, tekst, maks = 700) {
  if (!KI_NOKKEL) return '';
  for (let forsok = 0; forsok < 3; forsok++) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'x-api-key': KI_NOKKEL, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODELL, max_tokens: maks, system, messages: [{ role: 'user', content: tekst }] }),
    }).catch(() => null);
    if (r && r.ok) { const d = await r.json(); return (d.content || []).map((c) => c.text || '').join(''); }
    await new Promise((ok) => setTimeout(ok, 2000 * (forsok + 1)));
  }
  return '';
}
function json(t) { const m = /\{[\s\S]*\}/.exec(t || ''); try { return m ? JSON.parse(m[0]) : null; } catch { return null; } }

// ---------------------------------------------------------------- oppsett: kopi av kurset, kontoer, påmelding
async function lagKopi() {
  const { data: k, error } = await admin.from('kurs').select('*').eq('id', KILDE).single();
  if (error || !k) throw new Error('Fant ikke kurset ' + KILDE + ': ' + (error && error.message));
  const { data: fins } = await admin.from('kurs').select('*').eq('eier', k.eier).filter('ramme->>fiktivFra', 'eq', KILDE);
  let kopi = fins && fins[0];
  const felt = { ...k }; delete felt.id; delete felt.kode; delete felt.opprettet; delete felt.endret;
  felt.navn = (k.navn.slice(0, 100) + ' – fiktiv klasse').slice(0, 120);
  felt.ramme = { ...(k.ramme || {}), fiktivFra: KILDE };
  felt.status = 'publisert';
  if (!kopi) {
    const kode = Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[crypto.randomInt(32)]).join('');
    const r = await admin.from('kurs').insert({ ...felt, kode }).select('*').single();
    if (r.error) throw new Error('Kunne ikke lage kopien: ' + r.error.message);
    kopi = r.data;
  } else {
    const r = await admin.from('kurs').update(felt).eq('id', kopi.id);
    if (r.error) throw new Error('Kunne ikke oppdatere kopien: ' + r.error.message);
  }
  // Arbeidskravene: samme innhold som i kurset, men faste id-er i kopien (så robotenes svar henger sammen mellom kjøringer).
  const { data: kilder } = await admin.from('ovelser').select('*').eq('kurs', KILDE);
  const { data: egne } = await admin.from('ovelser').select('*').eq('kurs', kopi.id);
  const ovelser = [];
  for (const o of kilder || []) {
    const f = { ...o }; delete f.id; delete f.opprettet; f.kurs = kopi.id;
    const fra = (egne || []).find((x) => x.tittel === o.tittel);
    const r = fra ? await admin.from('ovelser').update(f).eq('id', fra.id).select('*').single() : await admin.from('ovelser').insert(f).select('*').single();
    if (r.error) throw new Error('Arbeidskrav «' + o.tittel + '»: ' + r.error.message);
    ovelser.push(r.data);
  }
  return { kurs: k, kopi, ovelser };
}

async function lagElev(navn, niva, kursId) {
  const epost = 'fiktiv.' + navn.toLowerCase().replace('å', 'aa') + '@fiktiv.fysikkhjelp.no';
  const passord = crypto.randomBytes(18).toString('base64url');   // nytt for hver kjøring, lagres ingen steder
  const meta = { fiktiv: true, navn, niva };
  let id = null;
  for (let side = 1; side < 20 && !id; side++) {
    const { data } = await admin.auth.admin.listUsers({ page: side, perPage: 1000 });
    const u = (data && data.users || []).find((x) => x.email === epost); if (u) id = u.id;
    if (!data || !data.users || data.users.length < 1000) break;
  }
  if (id) await admin.auth.admin.updateUserById(id, { password: passord, user_metadata: meta });
  else {
    const r = await admin.auth.admin.createUser({ email: epost, password: passord, email_confirm: true, user_metadata: meta });
    if (r.error) throw new Error('Konto for ' + navn + ': ' + r.error.message);
    id = r.data.user.id;
  }
  await admin.from('kurs_deltaker').upsert({ kurs: kursId, student: id, samtykke_innsyn: true }, { onConflict: 'kurs,student' });
  const klient = createClient(SUPA_URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const inn = await klient.auth.signInWithPassword({ email: epost, password: passord });
  if (inn.error) throw new Error('Innlogging for ' + navn + ': ' + inn.error.message);
  return { navn, niva, id, epost, sesjon: inn.data.session };
}

async function nullstill(elev, ovelser) {
  for (const o of ovelser) {
    await admin.from('studie_svar').delete().eq('eier', elev.id).like('sporsmal', 'ov-' + o.id.slice(0, 8) + '-%');
    await admin.from('studie_quiz').delete().eq('eier', elev.id).eq('ovelse', o.id);
  }
}

// ---------------------------------------------------------------- «håndskrevet» utregning som bilde
async function lagUtregning(nettleser, linjer, streker, fil) {
  const s = await nettleser.newPage({ viewport: { width: 900, height: 200 + 64 * linjer.length } });
  const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  await s.setContent(`<!DOCTYPE html><html><head><link href="https://fonts.googleapis.com/css2?family=Caveat:wght@500&display=swap" rel="stylesheet">
    <style>body{margin:0;background:#fbfaf4}#ark{padding:40px 60px;font:38px/64px Caveat,cursive;color:#1b2a6b;transform:rotate(-1.2deg);
    background:repeating-linear-gradient(#fbfaf4 0 63px,#c9d6ea 63px 64px)}.svar{display:inline-block;${streker ? 'border-bottom:6px double #1b2a6b;' : ''}padding-bottom:2px}</style></head>
    <body><div id="ark">${linjer.map((l, i) => i === linjer.length - 1 ? `<div><span class="svar">${esc(l)}</span></div>` : `<div>${esc(l)}</div>`).join('')}</div></body></html>`);
  await s.waitForTimeout(800);
  await s.locator('#ark').screenshot({ path: fil });
  await s.close();
}

// ---------------------------------------------------------------- én elev i appen
const STOY = /favicon|ResizeObserver loop|third-party cookie|Download the React DevTools|googletagmanager|plausible/i;

async function brukApp(nettleser, elev, ovelser, runde) {
  const r = rng(FRO + elev.navn + runde);
  const p = { riktig: 0.25 + 0.07 * elev.niva, streker: 0.3 + 0.07 * elev.niva, bilde: 0.55 + 0.045 * elev.niva, kaos: 0.18 };
  const mobil = r() < 0.35;
  const kontekst = await nettleser.newContext(mobil ? { viewport: { width: 390, height: 664 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: 'nb-NO' } : { viewport: { width: 1280, height: 860 }, locale: 'nb-NO' });
  const okt = JSON.stringify(elev.sesjon);
  await kontekst.addInitScript(([n, v]) => { try { if (!localStorage.getItem(n)) localStorage.setItem(n, v); localStorage.setItem('fh-app-skjul', '1'); } catch (e) {} }, [LAGRING, okt]);
  const side = await kontekst.newPage();
  side.setDefaultTimeout(20000);
  side.on('pageerror', (e) => nyttFunn(elev, 'feil', 'JavaScript-feil i appen', e.message + '\n' + (e.stack || '').slice(0, 600), null));
  side.on('console', (m) => { if (m.type() === 'error' && !STOY.test(m.text())) nyttFunn(elev, 'feil', 'Feilmelding i konsollen', m.text(), null); });
  side.on('response', (s) => {
    const u = s.url(); if (s.status() < 400 || STOY.test(u)) return;
    if (/fysikkhjelp|supabase\.co/.test(u)) nyttFunn(elev, s.status() >= 500 ? 'feil' : 'advarsel', `HTTP ${s.status()} fra ${new URL(u).host}${new URL(u).pathname}`, `${s.request().method()} ${u.slice(0, 300)}`, null);
  });
  notat(elev, `runde ${runde}, ${mobil ? 'mobil' : 'PC'}`);

  for (const o of ovelser) await arbeidskrav(side, elev, o, r, p);
  await snakkMedDashman(side, elev, r);
  if (r() < 0.4) await tilbakemelding(side, elev);
  await kontekst.close();
}

async function prikker(side) {
  return side.$$eval('.st-ovprikker .st-ovprikk', (l) => l.map((e) => (e.className.match(/\b(ok|kanskje|nei|ingen)\b/) || [])[1] || '?')).catch(() => []);
}
async function visning(side) { return side.evaluate(() => (document.querySelector('.studie') || document.body).innerText.slice(0, 1200)).catch(() => ''); }

async function arbeidskrav(side, elev, o, r, p) {
  const url = `${NETTSTED}/studie/index.html#ovelse-${o.id}`;
  await side.goto(url, { waitUntil: 'domcontentloaded' });
  try { await side.waitForSelector('.st-sporsmal, [data-h=lukkQuiz]', { timeout: 30000 }); }
  catch { return nyttFunn(elev, 'feil', `Arbeidskravet «${o.tittel}» åpnet seg ikke`, await visning(side), side); }
  notat(elev, `åpnet «${o.tittel}»: ${(await prikker(side)).join(' ')}`);
  let forrigeTekst = '', fast = 0, steg = 0;
  const maks = ((o.sporsmal || []).length || o.antall || 12) + 8;
  while (steg++ < maks) {
    if (await side.$('[data-h=videre]') === null && await side.$('.st-sporsmal') === null) break;   // resultatskjerm
    const tekst = await side.$eval('.st-sporsmal', (e) => e.innerText).catch(() => '');
    if (!tekst) break;
    if (tekst === forrigeTekst) { if (++fast >= 3) { await nyttFunn(elev, 'feil', 'Appen står fast på samme spørsmål', tekst, side); break; } } else fast = 0;
    forrigeTekst = tekst;

    // Kaos: det ekte studenter gjør. Last siden på nytt, gå til et annet nummer, hopp over.
    if (r() < p.kaos) { if (await omlasting(side, elev, o)) continue; }
    if (r() < p.kaos / 2 && await side.$('[data-h=ovGa]')) {
      const knapper = await side.$$('[data-h=ovGa]'); const k = knapper[Math.floor(r() * knapper.length)];
      notat(elev, 'trykker på et annet spørsmålsnummer'); await k.click(); await side.waitForTimeout(600); continue;
    }
    if (r() < p.kaos / 3 && await side.$('[data-h=hoppOver]')) { notat(elev, 'hopper over'); await side.click('[data-h=hoppOver]'); await side.waitForTimeout(500); continue; }

    await svarPa(side, elev, o, tekst, r, p);
    const videre = await side.$('[data-h=videre]:not([disabled])');
    if (videre) { await videre.click(); await side.waitForTimeout(700); }
    else if (await side.$('[data-h=hoppOver]')) { await side.click('[data-h=hoppOver]'); await side.waitForTimeout(500); }
    else { await nyttFunn(elev, 'advarsel', 'Verken «Neste» eller «Hopp over» kan trykkes etter svar', await visning(side), side); break; }
  }
  notat(elev, `ferdig med «${o.tittel}»: ${(await prikker(side)).join(' ')}`);
}

async function omlasting(side, elev, o) {
  const for_ = await prikker(side);
  if (!for_.length) return false;
  notat(elev, 'laster siden på nytt midt i arbeidskravet');
  await side.reload({ waitUntil: 'domcontentloaded' });
  await side.waitForSelector('.st-sporsmal, [data-h=lukkQuiz]', { timeout: 30000 }).catch(() => {});
  await side.waitForTimeout(800);
  const etter = await prikker(side);
  const tapt = for_.map((s, i) => (s === 'ok' || s === 'kanskje') && etter[i] && etter[i] !== s && etter[i] !== 'ok' ? i + 1 : null).filter(Boolean);
  if (tapt.length) await nyttFunn(elev, 'feil', `Godkjenning forsvant etter omlasting (spørsmål ${tapt.join(', ')})`, `Før: ${for_.join(' ')}\nEtter: ${etter.join(' ')}`, side);
  return true;
}

async function svarPa(side, elev, o, tekst, r, p) {
  const tall = !!(await side.$('#st-tallsvar'));
  const alt = tall ? [] : await side.$$eval('button.st-alt', (l) => l.map((b) => b.innerText.trim()));
  const skalRett = r() < p.riktig;
  const losning = json(await ki(
    `Du er ${elev.navn}, en elev på forkurs i fysikk (nivå ${elev.niva} av 10). Løs oppgaven på norsk. ` +
    (skalRett ? 'Løs den riktig. ' : 'Gjør en typisk elevfeil (glem et prefiks, bruk feil formel eller regn feil). ') +
    'Bruk punktum som desimaltegn. Svar KUN med JSON: {"svar": "<tall med enhet>", "alternativ": <nummer fra 1 eller null>, "utregning": ["linje", …], "sikker": true/false}. ' +
    'Utregningen skal være 3–6 korte linjer slik en elev skriver for hånd, siste linje er svaret.',
    `Oppgave:\n${tekst}${alt.length ? '\n\nAlternativer:\n' + alt.map((a, i) => `${i + 1}. ${a}`).join('\n') : ''}`)) || {};
  const svar = String(losning.svar || '1');
  if (tall) {
    await side.fill('#st-tallsvar', svar); await side.press('#st-tallsvar', 'Enter');
  } else if (alt.length) {
    const i = Math.max(0, Math.min(alt.length - 1, (+losning.alternativ || 1) - 1));
    await side.locator('button.st-alt').nth(i).click();
  }
  await side.waitForTimeout(900);
  const fb = await side.$eval('.st-fb, .st-alt.nei, .st-alt.ok', (e) => e.innerText).catch(() => '');
  const avvist = /ikke riktig|feil|prøv igjen/i.test(fb) && !/godkjent/i.test(fb);
  if (skalRett && losning.sikker && avvist) await nyttFunn(elev, 'til sjekk', 'Svar KI-en mener er riktig ble avvist (feil fasit, tolkning av svaret eller KI-feil?)', `Spørsmål: ${tekst}\nSvar: ${svar}\nAppen: ${fb}`, side);
  notat(elev, `svarte «${svar}» (${skalRett ? 'prøvde riktig' : 'med vilje feil'})${fb ? ' → ' + fb.replace(/\s+/g, ' ').slice(0, 90) : ''}`);

  // Bilde av utregningen, når arbeidskravet vil ha det (og eleven gidder).
  const fil = await side.$('#st-bilde, #st-lever');
  if (fil && (o.svarform === 'bilde' || r() < 0.3) && r() < p.bilde) {
    const streker = r() < p.streker;
    const png = path.join(UT, `utregning-${elev.navn}.png`);
    await lagUtregning(side.context().browser(), (losning.utregning && losning.utregning.length ? losning.utregning : [svar]).slice(0, 7), streker, png);
    const vent = side.waitForResponse((s) => /\/vurder$/.test(new URL(s.url()).pathname), { timeout: 120000 }).catch(() => null);
    const t0 = Date.now();
    await fil.setInputFiles(png);
    const s = await vent;
    if (!s) await nyttFunn(elev, 'feil', 'Ingen KI-vurdering av bildet etter 2 minutter', await visning(side), side);
    else {
      const d = await s.json().catch(() => ({}));
      await side.waitForTimeout(800);
      if ((Date.now() - t0) > 45000) await nyttFunn(elev, 'advarsel', `KI-vurderingen tok ${Math.round((Date.now() - t0) / 1000)} s`, '', null);
      if (/Klarte ikke å vurdere/.test(d.tilbakemelding || '')) await nyttFunn(elev, 'feil', 'KI-en klarte ikke å vurdere bildet', JSON.stringify(d).slice(0, 600), side);
      notat(elev, `lastet opp utregning (${streker ? 'med' : 'uten'} streker) → ${d.vurdering || '?'} / håndskrift ${d.handskrift || '?'} / streker ${d.streker || '?'}`);
      if (streker && d.streker === 'nei') await nyttFunn(elev, 'til sjekk', 'KI-en så ikke de to strekene under svaret', d.tilbakemelding, side);
      // «Er dette håndskrevet?» (robotens skrift er en font, så KI-en er ofte usikker): eleven sier ja til gjennomsyn.
      const ja = await side.$('[data-h=lagreSvar][data-v=ja]');
      if (ja) { notat(elev, 'KI-en lurte på om det var håndskrevet → ja, lagre for gjennomsyn'); await ja.click(); await side.waitForTimeout(2500); }
    }
  }
}

async function snakkMedDashman(side, elev, r) {
  try {
    await side.goto(`${NETTSTED}/studie/index.html`, { waitUntil: 'domcontentloaded' });
    await side.waitForSelector('.dm-knapp', { timeout: 20000 });
    if (await side.$('.dm-panel[hidden]')) await side.click('.dm-knapp');
    await side.waitForSelector('.dm-panel:not([hidden]) textarea', { timeout: 20000 });
    const sporsmal = (await ki(`Du er ${elev.navn}, elev på forkurs i fysikk (nivå ${elev.niva} av 10). Skriv ETT kort, naturlig spørsmål til KI-læringsassistenten Dashman om elektrisitet eller noe du lurer på i fysikken. Bare spørsmålet, på norsk, som en ekte elev ville skrevet det (gjerne med skrivefeil hvis nivået er lavt).`, 'Spørsmål:', 120)).trim() || 'Hva er forskjellen på strøm og spenning?';
    const SVAR = '.dm-m.dm-fra:not(.dm-tenker):not(.dm-niva):not(.dm-husker)';
    const for_ = await side.$$eval(SVAR, (l) => l.length);
    await side.fill('.dm-panel textarea', sporsmal); await side.press('.dm-panel textarea', 'Enter');
    const t0 = Date.now();
    await side.waitForFunction(([n, sel]) => !document.querySelector('.dm-tenker') && document.querySelectorAll(sel).length > n, [for_, SVAR], { timeout: 90000 });
    await side.waitForTimeout(1500);   // svaret kan skrives fram litt etter litt
    const svar = await side.$$eval(SVAR, (l) => l[l.length - 1].innerText);
    const feil = await side.$('.dm-feil');
    if (feil) await nyttFunn(elev, 'feil', 'Dashman svarte med en feilmelding', svar, side);
    else if (svar.trim().length < 15) await nyttFunn(elev, 'advarsel', 'Dashman ga et tomt eller svært kort svar', svar, side);
    notat(elev, `spurte Dashman «${sporsmal.slice(0, 70)}» → ${Math.round((Date.now() - t0) / 1000)} s, ${svar.length} tegn`);
    // × skal alltid kunne nås (iPhone-feilen 18. nov.)
    const lukk = side.locator('.dm-panel [data-h=lukk]');
    const boks = await lukk.boundingBox();
    const vp = side.viewportSize();
    if (!boks || boks.y < 0 || boks.y + boks.height > vp.height) await nyttFunn(elev, 'feil', 'Dashman kan ikke lukkes: × er utenfor skjermen', JSON.stringify({ boks, vp }), side);
    else await lukk.click();
  } catch (e) {
    await nyttFunn(elev, 'feil', 'Samtalen med Dashman feilet', e.message, side);
  }
}

// Tilbakemeldingspanelet (feilen 18. nov.: panelet forsvant når man trykket i skrivefeltet). Meldingene merkes
// «[Fiktiv elev …]» og settes til «fikset» etter kjøringen, så de ikke blander seg med de ekte.
async function tilbakemelding(side, elev) {
  try {
    await side.goto(`${NETTSTED}/studie/index.html`, { waitUntil: 'domcontentloaded' });
    await side.click('#fh-chat .fc-knapp');
    await side.click('#fh-chat textarea');
    await side.waitForTimeout(400);
    if (!(await side.isVisible('#fh-chat textarea')) || +(await side.$eval('#fh-chat', (e) => getComputedStyle(e).opacity)) < 0.5)
      return nyttFunn(elev, 'feil', 'Tilbakemeldingspanelet forsvant da eleven trykket i skrivefeltet', '', side);
    const t = (await ki(`Du er ${elev.navn}, elev på forkurs i fysikk. Skriv én kort, realistisk tilbakemelding (1–2 setninger) om studieappen eller arbeidskravene.`, 'Tilbakemelding:', 120)).trim() || 'Fin app!';
    await side.fill('#fh-chat textarea', `[Fiktiv elev ${elev.navn}] ${t}`.slice(0, 1900));
    await side.click('#fh-chat .fc-send');
    await side.waitForFunction(() => /Takk!|ble ikke sendt/.test(document.querySelector('#fh-chat .fc-logg').innerText), null, { timeout: 15000 });
    if (/ble ikke sendt/.test(await side.$eval('#fh-chat .fc-logg', (e) => e.innerText))) await nyttFunn(elev, 'feil', 'Tilbakemeldingen ble ikke sendt', '', side);
    else notat(elev, 'sendte tilbakemelding');
  } catch (e) { await nyttFunn(elev, 'feil', 'Tilbakemeldingen feilet', e.message, side); }
}

// ---------------------------------------------------------------- rapport
function rapport(info) {
  const rang = { feil: 0, 'til sjekk': 1, advarsel: 2 };
  // Like funn slås sammen (samme tittel), med hvilke elever og hvor mange ganger.
  const grupper = new Map();
  for (const f of funn) { const n = f.alvor + '|' + f.tittel; if (!grupper.has(n)) grupper.set(n, { ...f, elever: new Set(), antall: 0, eksempler: [] }); const g = grupper.get(n); g.elever.add(f.elev); g.antall++; if (g.eksempler.length < 3) g.eksempler.push(f); }
  const l = [...grupper.values()].sort((a, b) => rang[a.alvor] - rang[b.alvor] || b.antall - a.antall);
  let md = `# Fiktiv klasse: ${info.kopi.navn}\n\n${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · ${RUNDER} runde(r) · elever: ${VALGT.join(', ')} · arbeidskrav: ${info.ovelser.map((o) => o.tittel).join(', ')}\n\n`;
  md += `**${l.filter((g) => g.alvor === 'feil').length} feil, ${l.filter((g) => g.alvor === 'til sjekk').length} til sjekk, ${l.filter((g) => g.alvor === 'advarsel').length} advarsler** (${funn.length} hendelser).\n\n`;
  for (const g of l) {
    md += `## ${g.alvor === 'feil' ? '🔴' : g.alvor === 'til sjekk' ? '🟠' : '🟡'} ${g.tittel}\n\n${g.antall} gang(er), elever: ${[...g.elever].join(', ')}\n\n`;
    for (const e of g.eksempler) md += '```\n' + e.detaljer.slice(0, 700) + '\n```\n' + (e.bilde ? `Skjermbilde: \`${e.bilde}\` (i vedlegget)\n\n` : '\n');
  }
  md += `\n<details><summary>Logg (${logg.length} linjer)</summary>\n\n\`\`\`\n${logg.slice(-400).join('\n')}\n\`\`\`\n</details>\n`;
  return md;
}

// ---------------------------------------------------------------- hovedløp
let info;
try { info = await lagKopi(); } catch (e) { stopp('Kopien av kurset: ' + e.message); }
console.log(`Kopi: ${info.kopi.navn} (${info.kopi.id}), ${info.ovelser.length} arbeidskrav`);
const elever = [];
for (const navn of VALGT) { try { elever.push(await lagElev(navn, ALLE.indexOf(navn) + 1, info.kopi.id)); } catch (e) { stopp('Kontoen til ' + navn + ': ' + e.message); } }
if (NULLSTILL) for (const e of elever) await nullstill(e, info.ovelser);
const nettleser = await chromium.launch();
for (let runde = 1; runde <= RUNDER; runde++) {
  // Tre elever om gangen.
  const ko = [...elever];
  await Promise.all([0, 1, 2].map(async () => { while (ko.length) { const e = ko.shift(); try { await brukApp(nettleser, e, info.ovelser, runde); } catch (x) { await nyttFunn(e, 'feil', 'Roboten krasjet', x.stack || x.message); } } }));
}
await nettleser.close();
await admin.from('tilbakemeldinger').update({ status: 'fikset' }).like('tekst', '[Fiktiv elev %');
const md = rapport(info);
fs.writeFileSync(path.join(UT, 'rapport.md'), md);
fs.writeFileSync(path.join(UT, 'funn.json'), JSON.stringify({ kopi: info.kopi.id, funn, logg }, null, 1));
console.log(`\n${funn.length} hendelser. Rapport: ${UT}/rapport.md`);
