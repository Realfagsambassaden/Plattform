// Brukerkontoer (Supabase). Lastes på alle sider.
// - Oppdaterer «Logg inn» i menyen til «Min side» når du er innlogget (uten å laste Supabase-biblioteket).
// - window.fhKonto() gir et løfte om Supabase-klienten, for sidene som trenger den (konto, dekning).
// Appen: registrer tjenestearbeideren (bare der nettstedet har et app-manifest), og ta vare på installasjonstilbudet
// fra nettleseren, så studieappen kan vise en «Installer appen»-knapp.
(function () {
  window.fhApp = { kanInstallere: false, installert: false, hendelse: null };
  try { window.fhApp.installert = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e) {}
  try { if (window.self !== window.top) return; } catch (e) { return; }   // ikke inne i fokusvisningen
  if ('serviceWorker' in navigator && document.querySelector('link[rel="manifest"]') && (location.protocol === 'https:' || location.hostname === 'localhost'))
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function () {});
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); window.fhApp.hendelse = e; window.fhApp.kanInstallere = true;
    document.dispatchEvent(new CustomEvent('fh-app'));
  });
  window.addEventListener('appinstalled', function () { window.fhApp.installert = true; window.fhApp.kanInstallere = false; document.dispatchEvent(new CustomEvent('fh-app')); });
})();
// Sider som vises inne i fokusvisningen (en iframe på samme nettsted) vises uten meny, sidemeny og bunntekst.
(function () {
  var innebygd = false; try { innebygd = window.self !== window.top && window.top.location.origin === location.origin; } catch (e) {}
  if (!innebygd) return;
  document.documentElement.classList.add('fh-innebygd');
  var st = document.createElement('style');
  st.textContent = 'html.fh-innebygd #quarto-header, html.fh-innebygd header.headroom, html.fh-innebygd .nav-footer, html.fh-innebygd footer.footer,' +
    'html.fh-innebygd #quarto-sidebar, html.fh-innebygd .quarto-sidebar-toggle, html.fh-innebygd .loype-linje, html.fh-innebygd .loype-bunn { display: none !important; }' +
    'html.fh-innebygd body { padding-top: 0 !important; } html.fh-innebygd #quarto-content { margin-top: .5rem !important; }';
  document.head.appendChild(st);
})();
(function () {
  var URL_ = (document.querySelector('meta[name="supabase-url"]') || {}).content || '';
  var NOKKEL = (document.querySelector('meta[name="supabase-key"]') || {}).content || '';
  var sattOpp = /^https:\/\/.+\.supabase\.co/.test(URL_) && NOKKEL.length > 20;
  var lagringsnavn = sattOpp ? 'sb-' + URL_.split('//')[1].split('.')[0] + '-auth-token' : '';

  function harSesjon() {
    try { return !!(lagringsnavn && localStorage.getItem(lagringsnavn)); } catch (e) { return false; }
  }
  // Finn menylenker til en bestemt side. Nedtrekksmenyene («Temaer», «Løyper») skal aldri treffes.
  function menylenker(monster) {
    return Array.prototype.filter.call(document.querySelectorAll('.navbar a.nav-link:not(.dropdown-toggle)'), function (a) {
      try { return monster.test(new URL(a.getAttribute('href') || '', location.href).pathname); } catch (e) { return false; }
    });
  }
  function oppdaterMeny(inne) {
    menylenker(/\/konto\/(index\.html)?$/).forEach(function (a) {
      var t = a.querySelector('.menu-text') || a;
      t.textContent = inne ? 'Min side' : 'Logg inn';
      a.classList.toggle('innlogget', !!inne);
    });
  }
  oppdaterMeny(harSesjon());

  // Undervisere ser ikke «Dekker vi faget ditt?» øverst i menyen (den er for studenter).
  // Rollen hentes rett fra databasen med brukerens nøkkel, uten å laste Supabase-biblioteket, og huskes per bruker.
  function visRolle(rolle) {
    var u = rolle === 'underviser' || rolle === 'admin';
    menylenker(/\/dekning(\.html)?$/).forEach(function (a) { (a.closest('li') || a).style.display = u ? 'none' : ''; });
  }
  function hentRolle(sesjon) {
    if (!sesjon || !sesjon.user || !sesjon.access_token) { try { localStorage.removeItem('fh-rolle'); } catch (e) {} return visRolle(null); }
    try { var lagret = JSON.parse(localStorage.getItem('fh-rolle') || 'null'); if (lagret && lagret.id === sesjon.user.id) visRolle(lagret.rolle); } catch (e) {}
    if (sesjon.expires_at && sesjon.expires_at * 1000 < Date.now()) return;
    fetch(URL_ + '/rest/v1/rpc/min_rolle', { method: 'POST', headers: { apikey: NOKKEL, Authorization: 'Bearer ' + sesjon.access_token, 'Content-Type': 'application/json' }, body: '{}' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (rolle) { if (typeof rolle !== 'string') return; visRolle(rolle); try { localStorage.setItem('fh-rolle', JSON.stringify({ id: sesjon.user.id, rolle: rolle })); } catch (e) {} })
      .catch(function () {});
  }
  if (sattOpp) { var sesjon0 = null; try { sesjon0 = JSON.parse(localStorage.getItem(lagringsnavn) || 'null'); } catch (e) {} hentRolle(sesjon0); }

  var klientLofte = null;
  window.fhKonto = function () {
    if (!sattOpp) return Promise.reject(new Error('ikke-satt-opp'));
    if (klientLofte) return klientLofte;
    klientLofte = new Promise(function (ok, nei) {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
      s.onload = function () {
        var k = window.supabase.createClient(URL_, NOKKEL, { auth: { persistSession: true, detectSessionInUrl: true, flowType: 'implicit' } });
        k.auth.onAuthStateChange(function (hendelse, sesjon) { oppdaterMeny(!!sesjon); if (hendelse !== 'TOKEN_REFRESHED') hentRolle(sesjon); document.dispatchEvent(new CustomEvent('fh-innlogget', { detail: !!sesjon })); });   // Dashman lytter
        ok(k);
      };
      s.onerror = function () { nei(new Error('lasting')); };
      document.head.appendChild(s);
    });
    return klientLofte;
  };
  window.fhKonto.sattOpp = sattOpp;

  // Kom brukeren tilbake fra en e-post (bekreftelse / nytt passord)? Da må biblioteket lastes for å lese lenken.
  if (sattOpp && /access_token=|type=recovery|error_description=/.test(location.hash)) window.fhKonto();
})();

// ---------------------------------------------------------------- tilbakemeldingschat
// En boble nederst til høyre på alle sider: meld fra om feil eller kom med forslag. Meldingen lagres i Supabase
// (tabellen tilbakemeldinger) sammen med adressen til siden, og administratoren leser dem på Min side.
(function () {
  try { if (window.self !== window.top) return; } catch (e) { return; }   // ikke inne i fokusvisningen
  function start() {
    if (document.getElementById('fh-chat')) return;
    var st = document.createElement('style');
    st.textContent =
      '#fh-chat [hidden]{display:none!important}' +
      '#fh-chat{position:fixed;right:18px;bottom:18px;z-index:1060;font-family:inherit}' +
      '#fh-chat .fc-knapp{border:2px solid #8fcf86;background:#24272a;color:#8fcf86;border-radius:999px;padding:.55rem 1rem;font:inherit;font-weight:700;cursor:pointer;box-shadow:0 4px 18px rgba(0,0,0,.45)}' +
      '#fh-chat .fc-knapp:hover{background:#8fcf86;color:#24272a}' +
      '#fh-chat .fc-panel{position:absolute;right:0;bottom:3.4rem;width:min(360px,calc(100vw - 36px));background:#141a18;color:#eceeea;border:1px solid #3a4440;border-radius:14px;box-shadow:0 10px 40px rgba(0,0,0,.55);display:flex;flex-direction:column;max-height:min(520px,70vh)}' +
      '#fh-chat .fc-hode{display:flex;justify-content:space-between;align-items:center;padding:.6rem .9rem;border-bottom:1px solid #3a4440;font-weight:700}' +
      '#fh-chat .fc-lukk{background:none;border:0;color:#eceeea;font-size:1.2rem;cursor:pointer}' +
      '#fh-chat .fc-logg{padding:.7rem .9rem;overflow-y:auto;overscroll-behavior:contain;display:flex;flex-direction:column;gap:.5rem;flex:1}' +
      '#fh-chat .fc-boble{padding:.45rem .7rem;border-radius:12px;max-width:85%;font-size:.93rem;line-height:1.35;white-space:pre-wrap}' +
      '#fh-chat .fc-oss{background:#232b28;align-self:flex-start}' +
      '#fh-chat .fc-deg{background:#2f5a24;align-self:flex-end}' +
      '#fh-chat form{display:flex;flex-direction:column;gap:.4rem;padding:.6rem .9rem .8rem;border-top:1px solid #3a4440}' +
      '#fh-chat textarea,#fh-chat input{width:100%;background:#24272a;color:#eceeea;border:1px solid #3a4440;border-radius:8px;padding:.45rem .6rem;font:inherit;font-size:.93rem}' +
      '#fh-chat .fc-send{align-self:flex-end;border:0;background:#8fcf86;color:#24272a;border-radius:999px;padding:.35rem 1rem;font:inherit;font-weight:700;cursor:pointer}' +
      '#fh-chat .fc-send:disabled{opacity:.5}' +
      '#fh-chat .fc-vedlegg{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap}' +
      '#fh-chat .fc-fil{border:1px dashed #3a4440;border-radius:8px;padding:.3rem .6rem;font-size:.85rem;color:#a3a9ad;cursor:pointer}' +
      '#fh-chat .fc-fil:hover{border-color:#8fcf86;color:#8fcf86}' +
      '#fh-chat .fc-fil input{position:absolute;width:1px;height:1px;opacity:0}' +
      '#fh-chat .fc-bilde{position:relative}#fh-chat .fc-bilde img{display:block;max-height:80px;max-width:140px;border-radius:6px;border:1px solid #3a4440}' +
      '#fh-chat .fc-bilde button{position:absolute;top:-8px;right:-8px;width:22px;height:22px;border-radius:50%;border:0;background:#3a4440;color:#eceeea;cursor:pointer;line-height:1}' +
      '#fh-chat .fc-samtykke{display:flex;gap:.45rem;align-items:flex-start;font-size:.82rem;line-height:1.35;color:#d7dad4;background:#1d2422;border:1px solid #e6d98a;border-radius:8px;padding:.45rem .55rem}' +
      '#fh-chat .fc-samtykke input{width:auto;margin-top:.15rem;flex:0 0 auto}' +
      'html.fk-aktiv #fh-chat{bottom:64px}html.fk-aktiv #fh-chat .fc-knapp{padding:.4rem .8rem;font-size:.9rem}' +
      '@media (max-width:600px){html.fk-aktiv #fh-chat .fc-knapp .fc-tekst{display:none}html.fk-aktiv #fh-chat .fc-knapp{padding:.45rem .55rem}}' +   /* på mobil i fokusmodus: bare ikonet */   /* over Forrige/Neste i fokusvisningen */
      '@media print{#fh-chat{display:none}}';
    document.head.appendChild(st);
    var rot = document.createElement('div'); rot.id = 'fh-chat';
    rot.innerHTML = '<div class="fc-panel" hidden role="dialog" aria-label="Tilbakemelding">' +
      '<div class="fc-hode"><span>Fant du en feil? Har du et forslag?</span><button type="button" class="fc-lukk" aria-label="Lukk">×</button></div>' +
      '<div class="fc-logg" aria-live="polite"><div class="fc-boble fc-oss">Hei! Skriv hva som er feil eller hva vi kan gjøre bedre. Vi ser hvilken side du er på, så du trenger ikke forklare det.</div></div>' +
      '<form><textarea name="tekst" rows="3" maxlength="2000" placeholder="Skriv her …" required></textarea>' +
      '<input name="epost" type="email" maxlength="200" placeholder="E-post (valgfritt, hvis du vil ha svar)">' +
      '<div class="fc-vedlegg"><label class="fc-fil">📎 Legg ved skjermbilde<input type="file" accept="image/*" name="bilde"></label><span class="fc-bilde" hidden></span></div>' +
      '<label class="fc-samtykke" hidden><input type="checkbox" name="samtykke"><span>Jeg godtar at skjermbildet lagres, så dere kan finne og rette feilen. Meldingen med bildet sendes <b>uten</b> å knyttes til profilen min, og bildet slettes når feilen er rettet.</span></label>' +
      '<button type="submit" class="fc-send">Send</button></form></div>' +
      '<button type="button" class="fc-knapp" aria-expanded="false">💬<span class="fc-tekst"> Tilbakemelding</span></button>';
    document.body.appendChild(rot);
    var panel = rot.querySelector('.fc-panel'), knapp = rot.querySelector('.fc-knapp'), logg = rot.querySelector('.fc-logg'), skj = rot.querySelector('form');
    // Mobil: tastaturet dekker nederste del av skjermen uten at 70vh krymper, så tekstfeltet havnet bak tastaturet.
    // visualViewport gir det synlige området; panelet løftes over tastaturet og krymper til det som er synlig.
    function tilpass() {
      var vv = window.visualViewport; if (!vv || panel.hidden) return;
      var under = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      rot.style.bottom = under > 40 ? (under + 8) + 'px' : '';
      panel.style.maxHeight = under > 40 ? Math.max(200, vv.height - 70) + 'px' : '';
    }
    if (window.visualViewport) { visualViewport.addEventListener('resize', tilpass); visualViewport.addEventListener('scroll', tilpass); }
    function apne(v) {
      panel.hidden = !v; knapp.setAttribute('aria-expanded', String(v));
      if (v) { skj.tekst.focus(); tilpass(); setTimeout(function () { tilpass(); skj.tekst.scrollIntoView({ block: 'nearest' }); }, 350); }
      else { rot.style.bottom = ''; panel.style.maxHeight = ''; }
    }
    window.fhTilbakemelding = function () { apne(true); };   // studieappen åpner tilbakemeldingen fra menyen
    knapp.onclick = function () { apne(panel.hidden); };
    rot.querySelector('.fc-lukk').onclick = function () { apne(false); };
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) apne(false); });
    function boble(t, deg) { var b = document.createElement('div'); b.className = 'fc-boble ' + (deg ? 'fc-deg' : 'fc-oss'); b.textContent = t; logg.appendChild(b); logg.scrollTop = logg.scrollHeight; }
    // Skjermbilde: skaleres ned (høyst 1600 px) og gjøres om til JPEG i nettleseren, så metadata (EXIF) forsvinner.
    // Det må godkjennes for hver melding, og en melding med bilde sendes uten bruker.
    var bildeUrl = null, bildeBoks = rot.querySelector('.fc-bilde'), samtykke = rot.querySelector('.fc-samtykke');
    function settBilde(url) {
      bildeUrl = url; skj.samtykke.checked = false;
      samtykke.hidden = !url; bildeBoks.hidden = !url;
      bildeBoks.innerHTML = url ? '<img alt="Skjermbildet ditt" src="' + url + '"><button type="button" aria-label="Fjern bildet">×</button>' : '';
      if (url) bildeBoks.querySelector('button').onclick = function () { settBilde(null); };
      skj.bilde.value = '';
    }
    skj.bilde.onchange = function () {
      var fil = skj.bilde.files[0]; if (!fil || !/^image\//.test(fil.type)) return;
      var r = new FileReader();
      r.onload = function () {
        var img = new Image();
        img.onload = function () {
          var m = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas');
          c.width = Math.round(img.width * m); c.height = Math.round(img.height * m);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          var url = c.toDataURL('image/jpeg', 0.8);
          if (url.length > 1400000) url = c.toDataURL('image/jpeg', 0.55);
          settBilde(url);
        };
        img.onerror = function () { boble('Klarte ikke å lese bildet. Prøv et skjermbilde i PNG eller JPEG.'); };
        img.src = r.result;
      };
      r.readAsDataURL(fil);
    };
    var innlogget = false;
    if (window.fhKonto && window.fhKonto.sattOpp) window.fhKonto().then(function (k) { return k.auth.getSession(); }).then(function (r) {
      innlogget = !!(r && r.data && r.data.session);
      if (innlogget) skj.epost.hidden = true;   // vi ser hvem du er
    }).catch(function () {});
    skj.onsubmit = function (ev) {
      ev.preventDefault();
      var tekst = skj.tekst.value.trim();
      if (tekst.length < 2 && bildeUrl) { tekst = '(skjermbilde)'; }
      if (tekst.length < 2) return;
      if (bildeUrl && !skj.samtykke.checked) { boble('Kryss av for at bildet kan lagres, eller fjern bildet, før du sender.'); return; }
      var send = skj.querySelector('.fc-send'); send.disabled = true;
      boble(tekst, true);
      var rad = { tekst: tekst, side: (location.pathname + location.hash).slice(0, 300), nettsted: location.hostname.slice(0, 40), epost: innlogget ? null : (skj.epost.value.trim() || null) };
      var medBilde = !!bildeUrl;
      if (medBilde) { rad.bilde = bildeUrl; rad.bruker = null; }   // knyttes ikke til profilen
      (window.fhKonto && window.fhKonto.sattOpp ? window.fhKonto() : Promise.reject(new Error('ikke satt opp')))
        .then(function (k) { return k.from('tilbakemeldinger').insert(rad); })
        .then(function (r) {
          if (r && r.error) throw r.error;
          skj.tekst.value = ''; if (medBilde) settBilde(null);
          boble('Takk! Meldingen er sendt' + (medBilde ? ' med skjermbildet, uten navnet ditt' : '') + '. Skriv gjerne mer om du vil.' + (!medBilde && (rad.epost || innlogget) ? ' Trenger vi mer informasjon, tar vi kontakt.' : ''));
        })
        .catch(function () { boble('Beklager, meldingen ble ikke sendt. Prøv igjen om litt.'); })
        .then(function () { send.disabled = false; });
    };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

// ---------------------------------------------------------------- oppmøtesjekk
// Underviseren har startet oppmøte (undervisningsmodus). Er studenten plukket ut i denne perioden, vises en tydelig
// boks øverst på alle sider (også i appen og fokusvisningen): skriv inn koden fra tavla før fristen.
// Sjekkes hvert 30. sekund når siden er synlig (supabase/oppsett.sql: oppmote_mine, oppmote_registrer).
(function () {
  try { if (window.self !== window.top) return; } catch (e) { return; }
  var URL_ = (document.querySelector('meta[name="supabase-url"]') || {}).content || '';
  var NOKKEL = (document.querySelector('meta[name="supabase-key"]') || {}).content || '';
  if (!/^https:\/\/.+\.supabase\.co/.test(URL_) || NOKKEL.length < 20) return;
  var lagringsnavn = 'sb-' + URL_.split('//')[1].split('.')[0] + '-auth-token', boks = null, aktiv = null, ok = {}, tikk = null;
  function token() {
    var s = null; try { s = JSON.parse(localStorage.getItem(lagringsnavn) || 'null'); } catch (e) {}
    if (!s || !s.access_token) return Promise.resolve(null);
    if (s.expires_at && s.expires_at * 1000 < Date.now() + 30000 && window.fhKonto)
      return window.fhKonto().then(function (k) { return k.auth.getSession(); }).then(function (r) { return r.data.session && r.data.session.access_token; }, function () { return null; });
    return Promise.resolve(s.access_token);
  }
  function rpc(navn, body) {
    return token().then(function (t) {
      if (!t) return null;
      return fetch(URL_ + '/rest/v1/rpc/' + navn, { method: 'POST', headers: { apikey: NOKKEL, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
        .then(function (r) { return r.ok ? r.json() : null; });
    }).catch(function () { return null; });
  }
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function stil() {
    if (document.getElementById('fh-opm-stil')) return;
    var st = document.createElement('style'); st.id = 'fh-opm-stil';
    st.textContent = '#fh-opm{position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:3000;width:min(560px,calc(100vw - 20px));background:#2a2a14;color:#f6f4e8;border:2px solid #eee462;border-radius:14px;padding:.9rem 1rem;box-shadow:0 10px 30px rgba(0,0,0,.5);font:500 1rem system-ui,sans-serif}' +
      '#fh-opm b{color:#eee462}#fh-opm .rad{display:flex;gap:.5rem;margin-top:.6rem}#fh-opm input{flex:1;min-width:0;font:700 1.6rem ui-monospace,monospace;letter-spacing:.3em;text-align:center;padding:.35rem;border-radius:10px;border:1px solid #888;background:#111;color:#fff}' +
      '#fh-opm button{font:700 1rem system-ui;padding:.5rem 1rem;border-radius:10px;border:0;background:#eee462;color:#111;cursor:pointer}#fh-opm .liten{font-size:.85rem;opacity:.85;margin-top:.45rem}#fh-opm.ok{border-color:#6ef04a}#fh-opm.ok b{color:#6ef04a}';
    document.head.appendChild(st);
  }
  function fjern() { if (boks) boks.remove(); boks = null; clearInterval(tikk); tikk = null; }
  function igjen() { var s = Math.max(0, Math.round((Date.parse(aktiv.frist) - Date.now()) / 1000)); return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }
  function vis(a) {
    var nokkel = a.okt + ':' + a.periode;
    if (aktiv && aktiv.okt + ':' + aktiv.periode === nokkel && boks) return;
    aktiv = a; stil(); fjern();
    boks = document.createElement('div'); boks.id = 'fh-opm'; boks.setAttribute('role', 'alertdialog');
    boks.innerHTML = '<div><b>Oppmøtesjekk</b> i ' + esc(a.navn) + '. Skriv inn koden som står på tavla. Tid igjen: <b class="igjen">' + igjen() + '</b></div>' +
      '<form class="rad"><input inputmode="numeric" pattern="[0-9]*" maxlength="3" autocomplete="off" aria-label="Koden fra tavla" placeholder="···"><button type="submit">Registrer</button></form>' +
      '<div class="liten melding">Du er plukket ut tilfeldig. Oppmøtet regnes ut fra alle sjekkene i semesteret.</div>';
    document.body.appendChild(boks);
    try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) {}
    tikk = setInterval(function () { var el = boks && boks.querySelector('.igjen'); if (el) el.textContent = igjen(); if (Date.parse(a.frist) < Date.now()) fjern(); }, 1000);
    boks.querySelector('form').onsubmit = function (ev) {
      ev.preventDefault();
      var inn = boks.querySelector('input'), m = boks.querySelector('.melding'), kode = parseInt(inn.value, 10);
      if (!(kode >= 100 && kode <= 999)) { m.textContent = 'Koden har tre sifre.'; return; }
      rpc('oppmote_registrer', { o_id: a.okt, kode: kode }).then(function (svar) {
        if (svar === 'ok') { ok[nokkel] = true; boks.classList.add('ok'); boks.innerHTML = '<b>Registrert ✓</b> Takk! Du er med på oppmøtet i ' + esc(a.navn) + '.'; setTimeout(fjern, 4000); }
        else { m.textContent = svar || 'Fikk ikke registrert. Sjekk nettet og prøv igjen.'; inn.select(); }
      });
    };
  }
  function sjekk() {
    if (document.hidden) return;
    var s = null; try { s = JSON.parse(localStorage.getItem(lagringsnavn) || 'null'); } catch (e) {}
    if (!s || !s.access_token) return;
    rpc('oppmote_mine').then(function (l) {
      var a = (l || []).filter(function (x) { return !x.registrert && !ok[x.okt + ':' + x.periode] && Date.parse(x.frist) > Date.now(); })[0];
      if (a) vis(a); else if (boks && !boks.classList.contains('ok')) fjern();
    });
  }
  setInterval(sjekk, 30000);
  document.addEventListener('visibilitychange', sjekk);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sjekk); else sjekk();
})();

// Forstørret figur (lightbox): teksten under bildet hentes fra figurteksten på siden, der formlene allerede er satt
// (lightboxen viser ellers rå LaTeX, f.eks. «\Delta E_p»).
(function () {
  function fiks() {
    document.querySelectorAll('.glightbox-container .gslide').forEach(function (sl) {
      var im = sl.querySelector('.gslide-image img'), t = sl.querySelector('.gslide-title');
      if (!im || !t || t.dataset.fiks) return;
      var p = Array.prototype.find.call(document.querySelectorAll('main img'), function (x) { return x.src === im.src; });
      var fc = p && p.closest('figure') && p.closest('figure').querySelector('figcaption');
      if (fc) { t.innerHTML = fc.innerHTML; t.dataset.fiks = '1'; }
    });
  }
  if (window.MutationObserver) new MutationObserver(function (m) {
    if (document.querySelector('.glightbox-container')) fiks();
  }).observe(document.body || document.documentElement, { childList: true, subtree: true });
})();
