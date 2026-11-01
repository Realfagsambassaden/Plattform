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
  function oppdaterMeny(inne) {
    document.querySelectorAll('.navbar a.nav-link[href*="konto/"]').forEach(function (a) {
      var t = a.querySelector('.menu-text') || a;
      t.textContent = inne ? 'Min side' : 'Logg inn';
      a.classList.toggle('innlogget', !!inne);
    });
  }
  oppdaterMeny(harSesjon());

  var klientLofte = null;
  window.fhKonto = function () {
    if (!sattOpp) return Promise.reject(new Error('ikke-satt-opp'));
    if (klientLofte) return klientLofte;
    klientLofte = new Promise(function (ok, nei) {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
      s.onload = function () {
        var k = window.supabase.createClient(URL_, NOKKEL, { auth: { persistSession: true, detectSessionInUrl: true, flowType: 'implicit' } });
        k.auth.onAuthStateChange(function (_hendelse, sesjon) { oppdaterMeny(!!sesjon); });
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
