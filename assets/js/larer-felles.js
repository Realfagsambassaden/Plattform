// Felles for lærersidene: tilgang og lagrede forelesninger.
//  - Innlogget (Supabase): forelesningene lagres på kontoen (tabellen «forelesninger»), så de følger læreren.
//  - Testmodus (innlogging ikke satt opp): lagres bare i denne nettleseren (localStorage).
// Bruk: fhLarer.klar() → løfte om 'inne' | 'test' | 'ute'. Etterpå kan alle/hent/utkast leses direkte;
// lagre/slett oppdaterer med en gang lokalt og lagrer på kontoen i bakgrunnen.
window.fhLarer = (function () {
  var NOKKEL = 'fh-forelesninger';
  var liste = [], modus = null, klient = null, bruker = null, klarLofte = null, feilVed = null;

  function lesLokal() { try { return JSON.parse(localStorage.getItem(NOKKEL)) || []; } catch (e) { return []; } }
  function skrivLokal(l) { try { localStorage.setItem(NOKKEL, JSON.stringify(l)); } catch (e) {} }
  function fraRad(r) { return { id: r.id, navn: r.navn, sider: r.sider || [], endret: r.endret }; }
  function tilRad(f) { return { id: f.id, eier: bruker.id, navn: f.navn, sider: f.sider, endret: f.endret }; }
  function sorter() { liste.sort(function (a, b) { return (b.endret || '').localeCompare(a.endret || ''); }); }
  function varsle(e) { feilVed = e; console.warn('Lagring av forelesning feilet', e); document.dispatchEvent(new CustomEvent('fh-larer-feil', { detail: e })); }

  function klar() {
    if (klarLofte) return klarLofte;
    klarLofte = new Promise(function (ok) {
      (function vent(i) { if (window.fhKonto || i > 40) ok(); else setTimeout(function () { vent(i + 1); }, 50); })(0);
    }).then(function () {
      if (!window.fhKonto || !window.fhKonto.sattOpp) { modus = 'test'; liste = lesLokal(); return modus; }
      return window.fhKonto().then(function (k) {
        klient = k;
        return k.auth.getSession().then(function (r) {
          var s = r.data && r.data.session;
          if (!s) { modus = 'ute'; return modus; }
          bruker = s.user; modus = 'inne';
          return k.from('forelesninger').select('id,navn,sider,endret').order('endret', { ascending: false }).then(function (svar) {
            if (svar.error) throw svar.error;
            liste = svar.data.map(fraRad);
            return flyttLokale().then(function () { sorter(); return modus; });
          });
        });
      }).catch(function (e) {
        if (modus === 'inne') { varsle(e); return modus; }   // innlogget, men tabellen svarte ikke
        modus = (e && e.message === 'ikke-satt-opp') ? 'test' : 'ute';
        if (modus === 'test') liste = lesLokal();
        return modus;
      });
    });
    return klarLofte;
  }

  // Forelesninger laget i testmodus (i nettleseren) flyttes til kontoen første gang læreren logger inn.
  function flyttLokale() {
    var lokale = lesLokal().filter(function (f) { return !liste.some(function (x) { return x.id === f.id; }); });
    if (!lokale.length) return Promise.resolve();
    return klient.from('forelesninger').upsert(lokale.map(tilRad), { onConflict: 'eier,id' }).then(function (svar) {
      if (svar.error) return varsle(svar.error);
      liste = liste.concat(lokale); skrivLokal([]);
    });
  }

  function lagre(f) {
    f.endret = new Date().toISOString();
    liste = [f].concat(liste.filter(function (x) { return x.id !== f.id; }));
    if (modus !== 'inne') return Promise.resolve(skrivLokal(liste));
    return klient.from('forelesninger').upsert(tilRad(f), { onConflict: 'eier,id' }).then(function (svar) { if (svar.error) varsle(svar.error); });
  }
  function slett(id) {
    liste = liste.filter(function (x) { return x.id !== id; });
    if (modus !== 'inne') return Promise.resolve(skrivLokal(liste));
    return klient.from('forelesninger').delete().eq('eier', bruker.id).eq('id', id).then(function (svar) { if (svar.error) varsle(svar.error); });
  }

  // En side i en forelesning er enten en adresse, eller {url, skjul: [deler foreleseren har fjernet]}
  function oppforing(x) { return typeof x === 'string' ? { url: x, skjul: [] } : { url: x.url, skjul: (x.skjul || []).slice() }; }
  function url(x) { return typeof x === 'string' ? x : x.url; }

  return {
    oppforing: oppforing,
    url: url,
    harSide: function (f, u) { return f.sider.some(function (x) { return url(x) === u; }); },
    klar: klar,
    tilgang: klar,
    modus: function () { return modus; },
    epost: function () { return bruker ? bruker.email : null; },
    alle: function () { return liste.slice(); },
    hent: function (id) { return liste.filter(function (f) { return f.id === id; })[0] || null; },
    utkast: function () { return liste[0] || null; },
    lagre: lagre,
    slett: slett,
    root: function () { var s = document.querySelector('script[src*="site_libs/"]'); return s ? s.getAttribute('src').split('site_libs/')[0] : ''; }
  };
})();
