// «Dekker vi faget ditt?» – sender emnebeskrivelsen til KI-tjeneren og tegner dekningskartet.
(function vent(n) {
  if (!window.fhKonto && (n || 0) < 100) return setTimeout(function () { vent((n || 0) + 1); }, 50);   // konto.js lastes etter denne
  start();
})();

function start() {
  var rot = document.getElementById('dekning');
  var skjema = rot.querySelector('.dekning-skjema');
  var laas = rot.querySelector('.dekning-laas');
  var ut = rot.querySelector('.dekning-resultat');
  var meta = document.querySelector('meta[name="fysikkhjelp-hint-api"]');
  var API = meta ? meta.content.replace(/\/hint\/?$/, '/dekning') : '';
  var klient = null;

  function melding(t, feil) {
    var m = skjema.querySelector('.dekning-melding');
    m.textContent = t; m.classList.toggle('feil', !!feil);
  }
  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }

  if (!window.fhKonto || !window.fhKonto.sattOpp) {
    laas.hidden = false;
    laas.querySelector('a').outerHTML = '<p class="muted">Registrering åpner snart.</p>';
    return;
  }
  window.fhKonto().then(function (k) {
    klient = k;
    function tegn(sesjon) { skjema.hidden = !sesjon; laas.hidden = !!sesjon; }
    k.auth.getSession().then(function (r) { tegn(r.data.session); });
    k.auth.onAuthStateChange(function (_h, s) { tegn(s); });
  }).catch(function () { laas.hidden = false; });

  skjema.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var url = skjema.url.value.trim(), tekst = skjema.tekst.value.trim();
    if (!url && !tekst) { melding('Lim inn en nettadresse eller teksten fra emnebeskrivelsen.', true); return; }
    var knapp = skjema.querySelector('button[type="submit"]');
    knapp.disabled = true; ut.innerHTML = '';
    melding('Leser emnebeskrivelsen og sammenligner med innholdet på siden … Dette tar gjerne 20–40 sekunder.');
    klient.auth.getSession().then(function (r) {
      var token = r.data.session && r.data.session.access_token;
      if (!token) throw new Error('Du må logge inn på nytt.');
      return fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify(tekst ? { tekst: tekst } : { url: url })
      });
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error(j.feil || 'Tjenesten svarte ikke (' + r.status + ').');
        return j;
      });
    }).then(function (d) {
      melding('');
      tegnKart(d);
    }).catch(function (e) {
      melding(e instanceof TypeError ? 'Fikk ikke kontakt med tjenesten. Prøv igjen om litt.' : e.message, true);
    }).finally(function () { knapp.disabled = false; });
  });

  function tegnKart(d) {
    var n = { god: 0, delvis: 0, ingen: 0 };
    d.temaer.forEach(function (t) { n[t.dekning]++; });
    var tot = d.temaer.length;
    var poeng = Math.round(100 * (n.god + 0.5 * n.delvis) / tot);
    var pst = function (x) { return (100 * x / tot).toFixed(1) + '%'; };
    var h = '';
    h += '<div class="kart-hode"><p class="eyebrow">' + esc(d.emnekode || 'Emne') + '</p><h2>' + esc(d.emnenavn || 'Dekningskart') + '</h2>';
    if (d.kilde) h += '<p class="muted kart-kilde">Kilde: <a href="' + esc(d.kilde) + '" target="_blank" rel="noopener">' + esc(d.kilde) + '</a></p>';
    h += '</div>';
    h += '<div class="kart-sum"><div class="kart-tall"><span class="stort">' + poeng + ' %</span><span>samlet dekning</span></div>';
    h += '<div class="kart-stolpe" role="img" aria-label="' + n.god + ' godt dekket, ' + n.delvis + ' delvis, ' + n.ingen + ' ikke dekket">' +
         '<span class="god" style="width:' + pst(n.god) + '"></span><span class="delvis" style="width:' + pst(n.delvis) + '"></span><span class="ingen" style="width:' + pst(n.ingen) + '"></span></div>';
    h += '<ul class="kart-forklaring"><li><i class="god"></i>Godt dekket (' + n.god + ')</li><li><i class="delvis"></i>Delvis (' + n.delvis + ')</li><li><i class="ingen"></i>Ikke dekket (' + n.ingen + ')</li></ul></div>';
    if (d.oppsummering) h += '<p class="kart-oppsummering">' + esc(d.oppsummering) + '</p>';
    h += '<div class="kart">';
    var rekke = { god: 0, delvis: 1, ingen: 2 };
    d.temaer.slice().sort(function (a, b) { return rekke[a.dekning] - rekke[b.dekning]; }).forEach(function (t) {
      h += '<div class="kart-flis ' + t.dekning + '"><span class="merke">' + ({ god: 'Godt dekket', delvis: 'Delvis', ingen: 'Ikke dekket' })[t.dekning] + '</span>';
      h += '<h3>' + esc(t.tema) + '</h3>';
      if (t.kommentar) h += '<p>' + esc(t.kommentar) + '</p>';
      if (t.sider.length) {
        h += '<ul>';
        t.sider.forEach(function (s) { h += '<li><a href="' + esc(s.url.replace(/^\//, '')) + '">' + esc(s.tittel) + '</a></li>'; });
        h += '</ul>';
      }
      h += '</div>';
    });
    h += '</div><p class="muted kart-merk">Kartet er laget av en KI som har sammenlignet emnebeskrivelsen med innholdet på fysikkhjelp.no. Det er et anslag, ikke en garanti. Sjekk alltid pensumlisten fra faglærer.</p>';
    ut.innerHTML = h;
    ut.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
