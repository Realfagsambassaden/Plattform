// Linja øverst på innholdssider: tema › undertema, nivåknappen (bytt nivå) og «Forrige / Neste».
// Forrige/neste følger enten løypa du går i, eller temastrukturen (område → tema → undertema) på samme nivå.
// Hva som gjelder, huskes fra der du kom fra: en temaside (/tema/…) gir tema, en løypeside gir løype.
// Data: /loyper.json (lages av verktoy/tema.py ved hver bygging).
(function () {
  var main = document.querySelector('main#quarto-document-content') || document.querySelector('main');
  if (!main) return;
  var sti = location.pathname.replace(/\/index\.html$/, '/').replace(/\/$/, '/index.html');
  if (!/\.html$/.test(sti)) sti += '.html';
  var lagre = function (k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} };
  var hent = function (k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
  if (/\/(tema|emner)\//.test(sti)) lagre('bla', 'tema');
  if (/\/loyper\//.test(sti)) lagre('bla', 'loype');
  var root = (function () { var s = document.querySelector('script[src*="site_libs/"]'); return s ? s.getAttribute('src').split('site_libs/')[0] : ''; })();
  fetch(root + 'loyper.json').then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
    if (!d) return;
    // Står vi på en løypes oversiktsside? Husk den som aktiv løype.
    d.loyper.forEach(function (L) { if (L.url === sti) { lagre('loype', L.id); lagre('bla', 'loype'); } });
    var info = d.sider[sti];
    var treff = d.loyper.filter(function (L) { return L.sider.some(function (s) { return s.url === sti; }); });
    var L = treff.filter(function (x) { return x.id === hent('loype'); })[0] || (treff.length === 1 ? treff[0] : null);
    if (!info && !L) return;

    // Temarekka på samme nivå som siden
    var rekke = d.temarekke || [], her = null, E = null;
    rekke.forEach(function (x) { if (x.url === sti) her = x; });
    if (her) {
      var samme = rekke.filter(function (x) { return x.niva === her.niva; });
      var j = samme.findIndex(function (x) { return x.url === sti; });
      E = { f: samme[j - 1], n: samme[j + 1], niva: (d.nivanavn || {})[her.niva] || '' };
    }
    var modus = hent('bla') === 'emne' ? 'tema' : (hent('bla') || (L ? 'loype' : 'tema'));
    if (modus === 'loype' && !L) modus = 'tema';
    if (modus === 'tema' && !E) modus = 'loype';

    var f = null, n = null, merkeF = '', merkeN = '';
    if (modus === 'loype' && L) {
      var i = L.sider.findIndex(function (s) { return s.url === sti; });
      f = L.sider[i - 1]; n = L.sider[i + 1];
      merkeF = '← Forrige i ' + L.tittel; merkeN = 'Neste i ' + L.tittel + ' →';
    } else if (E) {
      f = E.f; n = E.n;
      var omr = function (x) { return x.omrade + (E.niva ? ' (' + E.niva + ')' : ''); };
      merkeF = '← Forrige i ' + (f ? (f.omrade === her.omrade ? omr(her) : f.omrade) : '');
      merkeN = n ? (n.omrade === her.omrade ? 'Neste i ' + omr(her) + ' →' : 'Videre til ' + n.omrade + ' →') : '';
    }

    var bar = document.createElement('nav'); bar.className = 'loype-linje'; bar.setAttribute('aria-label', 'Tema, nivå og navigasjon');
    var h = '';
    // Nivåknappen: viser nivået, og lar deg bytte til samme undertema på et annet nivå
    if (info && info.niva) {
      var tv = info.tvillinger || [];
      if (tv.length) {
        h += '<details class="niva-knapp"><summary><span>Nivå: ' + esc(info.niva) + ' ▾</span></summary><div class="niva-meny">' +
             '<span class="nm-tittel">Samme tema på et annet nivå</span>' +
             '<span class="nm-her"><b>' + esc(info.niva) + '</b> · denne siden</span>' +
             tv.map(function (t) { return '<a href="' + t.url + '" title="' + esc(t.tittel) + '"><b>' + esc(t.niva || 'Annet') + '</b> · ' + esc(t.kilde) + '</a>'; }).join('') +
             '</div></details>';
      } else {
        h += '<span class="niva-knapp alene"><span>Nivå: ' + esc(info.niva) + '</span></span>';
      }
    }
    if (info) h += '<span class="ll-tema"><span class="ll-merke">Tema</span><a href="' + info.temaUrl + '">' + esc(info.omrade) + ' › ' + esc(info.tema) + '</a>' +
                   (info.undertema ? ' › <a href="' + info.undertemaUrl + '">' + esc(info.undertema) + '</a>' : '') + '</span>';
    if (L) {
      var k = L.sider.findIndex(function (s) { return s.url === sti; });
      h += '<span class="ll-loype"><a href="' + L.url + '"><span class="ll-merke">Løype</span>' + esc(L.tittel) + '</a> <span class="ll-pos">' + (k + 1) + ' av ' + L.sider.length + '</span>' +
           // Fokusvisning finnes i studieappen på fysikkhjelp.no
           (/fysikkhjelp|localhost/.test(location.hostname) ? ' <a class="ll-fokus" href="/studie/fokus.html#loype-' + encodeURIComponent(L.id) + '@' + encodeURIComponent(sti) + '" title="Les løypa i fokusvisning">Fokusvisning</a>' : '') + '</span>';
    }
    if (f || n) h += '<span class="ll-knapper">' + (f ? '<a href="' + f.url + '" title="' + esc(f.tittel) + '">← Forrige</a>' : '') + (n ? '<a href="' + n.url + '" title="' + esc(n.tittel) + '">Neste →</a>' : '') + '</span>';
    // Bla etter løype eller tema (bare når begge finnes)
    if (L && E) {
      h += '<span class="ll-modus"><span class="ll-merke">Bla etter</span>' +
           '<button type="button" data-bla="loype"' + (modus === 'loype' ? ' class="paa"' : '') + '>Løype</button>' +
           '<button type="button" data-bla="tema"' + (modus === 'tema' ? ' class="paa"' : '') + '>Tema</button></span>';
    }
    bar.innerHTML = h;
    bar.querySelectorAll('[data-bla]').forEach(function (b) { b.addEventListener('click', function () { lagre('bla', b.getAttribute('data-bla')); location.reload(); }); });
    var hode = main.querySelector('#title-block-header');
    if (hode) hode.parentNode.insertBefore(bar, hode); else main.insertBefore(bar, main.firstChild);

    // Forrige / neste nederst på siden
    if (f || n) {
      var bunn = document.createElement('nav'); bunn.className = 'loype-bunn'; bunn.setAttribute('aria-label', 'Forrige og neste');
      var ferdig = modus === 'tema' && n && her && n.omrade !== her.omrade;
      bunn.innerHTML = (f ? '<a class="lb-forrige" href="' + f.url + '"><span class="lb-merke">' + esc(merkeF) + '</span>' + esc(f.tittel) + '</a>' : '<span></span>') +
                       (n ? '<a class="lb-neste' + (ferdig ? ' lb-videre' : '') + '" href="' + n.url + '"><span class="lb-merke">' +
                            (ferdig ? 'Ferdig med ' + esc(her.omrade) + '? ' : '') + esc(merkeN) + '</span>' + esc(n.tittel) + '</a>' : '<span></span>');
      main.appendChild(bunn);
    }
  }).catch(function () {});
  function esc(s) { var x = document.createElement('div'); x.textContent = s || ''; return x.innerHTML; }
})();
