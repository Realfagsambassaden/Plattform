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
        k.auth.onAuthStateChange(function (hendelse, sesjon) { oppdaterMeny(!!sesjon); if (hendelse !== 'TOKEN_REFRESHED') hentRolle(sesjon); });
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
      '#fh-chat .fc-knapp{border:2px solid #7ee35b;background:#0d1110;color:#7ee35b;border-radius:999px;padding:.55rem 1rem;font:inherit;font-weight:700;cursor:pointer;box-shadow:0 4px 18px rgba(0,0,0,.45)}' +
      '#fh-chat .fc-knapp:hover{background:#7ee35b;color:#0d1110}' +
      '#fh-chat .fc-panel{position:absolute;right:0;bottom:3.4rem;width:min(360px,calc(100vw - 36px));background:#141a18;color:#ecefe6;border:1px solid #3a4440;border-radius:14px;box-shadow:0 10px 40px rgba(0,0,0,.55);display:flex;flex-direction:column;max-height:min(520px,70vh)}' +
      '#fh-chat .fc-hode{display:flex;justify-content:space-between;align-items:center;padding:.6rem .9rem;border-bottom:1px solid #3a4440;font-weight:700}' +
      '#fh-chat .fc-lukk{background:none;border:0;color:#ecefe6;font-size:1.2rem;cursor:pointer}' +
      '#fh-chat .fc-logg{padding:.7rem .9rem;overflow-y:auto;overscroll-behavior:contain;display:flex;flex-direction:column;gap:.5rem;flex:1}' +
      '#fh-chat .fc-boble{padding:.45rem .7rem;border-radius:12px;max-width:85%;font-size:.93rem;line-height:1.35;white-space:pre-wrap}' +
      '#fh-chat .fc-oss{background:#232b28;align-self:flex-start}' +
      '#fh-chat .fc-deg{background:#2f5a24;align-self:flex-end}' +
      '#fh-chat form{display:flex;flex-direction:column;gap:.4rem;padding:.6rem .9rem .8rem;border-top:1px solid #3a4440}' +
      '#fh-chat textarea,#fh-chat input{width:100%;background:#0d1110;color:#ecefe6;border:1px solid #3a4440;border-radius:8px;padding:.45rem .6rem;font:inherit;font-size:.93rem}' +
      '#fh-chat .fc-send{align-self:flex-end;border:0;background:#7ee35b;color:#0d1110;border-radius:999px;padding:.35rem 1rem;font:inherit;font-weight:700;cursor:pointer}' +
      '#fh-chat .fc-send:disabled{opacity:.5}' +
      'html.fk-aktiv #fh-chat{bottom:64px}html.fk-aktiv #fh-chat .fc-knapp{padding:.4rem .8rem;font-size:.9rem}' +   /* over Forrige/Neste i fokusvisningen */
      '@media print{#fh-chat{display:none}}';
    document.head.appendChild(st);
    var rot = document.createElement('div'); rot.id = 'fh-chat';
    rot.innerHTML = '<div class="fc-panel" hidden role="dialog" aria-label="Tilbakemelding">' +
      '<div class="fc-hode"><span>Fant du en feil? Har du et forslag?</span><button type="button" class="fc-lukk" aria-label="Lukk">×</button></div>' +
      '<div class="fc-logg" aria-live="polite"><div class="fc-boble fc-oss">Hei! Skriv hva som er feil eller hva vi kan gjøre bedre. Vi ser hvilken side du er på, så du trenger ikke forklare det.</div></div>' +
      '<form><textarea name="tekst" rows="3" maxlength="2000" placeholder="Skriv her …" required></textarea>' +
      '<input name="epost" type="email" maxlength="200" placeholder="E-post (valgfritt, hvis du vil ha svar)">' +
      '<button type="submit" class="fc-send">Send</button></form></div>' +
      '<button type="button" class="fc-knapp" aria-expanded="false">💬 Tilbakemelding</button>';
    document.body.appendChild(rot);
    var panel = rot.querySelector('.fc-panel'), knapp = rot.querySelector('.fc-knapp'), logg = rot.querySelector('.fc-logg'), skj = rot.querySelector('form');
    function apne(v) { panel.hidden = !v; knapp.setAttribute('aria-expanded', String(v)); if (v) skj.tekst.focus(); }
    knapp.onclick = function () { apne(panel.hidden); };
    rot.querySelector('.fc-lukk').onclick = function () { apne(false); };
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) apne(false); });
    function boble(t, deg) { var b = document.createElement('div'); b.className = 'fc-boble ' + (deg ? 'fc-deg' : 'fc-oss'); b.textContent = t; logg.appendChild(b); logg.scrollTop = logg.scrollHeight; }
    var innlogget = false;
    if (window.fhKonto && window.fhKonto.sattOpp) window.fhKonto().then(function (k) { return k.auth.getSession(); }).then(function (r) {
      innlogget = !!(r && r.data && r.data.session);
      if (innlogget) skj.epost.hidden = true;   // vi ser hvem du er
    }).catch(function () {});
    skj.onsubmit = function (ev) {
      ev.preventDefault();
      var tekst = skj.tekst.value.trim(); if (tekst.length < 2) return;
      var send = skj.querySelector('.fc-send'); send.disabled = true;
      boble(tekst, true);
      var rad = { tekst: tekst, side: (location.pathname + location.hash).slice(0, 300), nettsted: location.hostname.slice(0, 40), epost: innlogget ? null : (skj.epost.value.trim() || null) };
      (window.fhKonto && window.fhKonto.sattOpp ? window.fhKonto() : Promise.reject(new Error('ikke satt opp')))
        .then(function (k) { return k.from('tilbakemeldinger').insert(rad); })
        .then(function (r) {
          if (r && r.error) throw r.error;
          skj.tekst.value = '';
          boble('Takk! Meldingen er sendt. Skriv gjerne mer om du vil.' + (rad.epost || innlogget ? ' Trenger vi mer informasjon, tar vi kontakt.' : ''));
        })
        .catch(function () { boble('Beklager, meldingen ble ikke sendt. Prøv igjen om litt.'); })
        .then(function () { send.disabled = false; });
    };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
