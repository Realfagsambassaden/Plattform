// Felles for lærersidene: tilgang (innlogget, eller testmodus mens innlogging ikke er satt opp) og lagrede forelesninger.
// Forelesningene lagres foreløpig i nettleseren (localStorage). Når Supabase er satt opp, flyttes de til brukerkontoen.
window.fhLarer = (function () {
  var NOKKEL = 'fh-forelesninger';
  function les() { try { return JSON.parse(localStorage.getItem(NOKKEL)) || []; } catch (e) { return []; } }
  function skriv(l) { try { localStorage.setItem(NOKKEL, JSON.stringify(l)); } catch (e) {} }
  function tilgang() {
    // Svar: 'inne' (innlogget), 'test' (innlogging ikke satt opp ennå), 'ute' (må logge inn)
    if (!window.fhKonto) return Promise.resolve('test');
    return window.fhKonto().then(function (k) {
      return k.auth.getSession().then(function (r) { return r.data && r.data.session ? 'inne' : 'ute'; });
    }, function (e) { return e && e.message === 'ikke-satt-opp' ? 'test' : 'ute'; });
  }
  return {
    alle: les,
    hent: function (id) { return les().filter(function (f) { return f.id === id; })[0] || null; },
    lagre: function (f) { var l = les().filter(function (x) { return x.id !== f.id; }); f.endret = new Date().toISOString(); l.unshift(f); skriv(l); },
    slett: function (id) { skriv(les().filter(function (x) { return x.id !== id; })); },
    utkast: function () { var l = les(); return l[0] || null; },
    tilgang: tilgang,
    root: function () { var s = document.querySelector('script[src*="site_libs/"]'); return s ? s.getAttribute('src').split('site_libs/')[0] : ''; }
  };
})();
