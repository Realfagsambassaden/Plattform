// Brukerkontoer (Supabase). Lastes på alle sider.
// - Oppdaterer «Logg inn» i menyen til «Min side» når du er innlogget (uten å laste Supabase-biblioteket).
// - window.fhKonto() gir et løfte om Supabase-klienten, for sidene som trenger den (konto, dekning).
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
