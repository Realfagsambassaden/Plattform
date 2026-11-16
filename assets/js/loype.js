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
    // Nivåbryteren: en liten skrubryter som viser nivået. Hold musa over (eller trykk) for å se de tre nivåene,
    // Forkurs til venstre, Ingeniør opp og Fordypning til høyre. Bare nivåer der dette temaet finnes, kan velges.
    if (info && info.niva) {
      var nvId = function (n) { return { 'Forkurs': 'forkurs', 'Ingeniør': 'ingenior', 'Fordypning': 'fordypning' }[n] || ''; };
      var hn = nvId(info.niva), tv = info.tvillinger || [], NIVA = [['forkurs', 'Forkurs'], ['ingenior', 'Ingeniør'], ['fordypning', 'Fordypning']];
      var knott = function (kl) {
        return '<svg class="' + kl + '" viewBox="-70 -70 140 140" aria-hidden="true">' +
          '<path class="nb-merke" data-nv="forkurs" d="M-62 0h-12"/><path class="nb-merke" data-nv="ingenior" d="M0 -62v-12"/><path class="nb-merke" data-nv="fordypning" d="M62 0h12"/>' +
          '<circle r="54" class="nb-ring"/><path class="nb-riller" d="M0 -54v8M27 -46.8l-4 6.9M46.8 -27l-6.9 4M54 0h-8M46.8 27l-6.9 -4M27 46.8l-4 -6.9M0 54v-8M-27 46.8l4 -6.9M-46.8 27l6.9 -4M-54 0h8M-46.8 -27l6.9 4M-27 -46.8l4 6.9"/>' +
          '<circle r="38" class="nb-topp"/>' +
          '<g class="nb-viser"><path d="M0 -6V-36"/><circle cy="-36" r="5"/></g></svg>';
      };
      var valg = NIVA.map(function (n) {
        if (n[0] === hn) return '<span class="nb-valg her" data-niva="' + n[0] + '" data-nv="' + n[0] + '" aria-current="page" title="Du er her">' + n[1] + '</span>';
        var t = tv.filter(function (x) { return nvId(x.niva) === n[0]; })[0];
        return t ? '<a class="nb-valg" href="' + t.url + '" data-niva="' + n[0] + '" data-nv="' + n[0] + '" title="' + esc(t.tittel + ' (' + t.kilde + ')') + '">' + n[1] + '</a>'
                 : '<span class="nb-valg mangler" data-niva="' + n[0] + '" data-nv="' + n[0] + '" title="Dette temaet finnes ikke på nivået ' + n[1] + ' ennå">' + n[1] + '</span>';
      }).join('');
      h += '<span class="niva-bryter" data-pos="' + hn + '" data-nv="' + hn + '">' +
           '<button type="button" class="nb-knapp" aria-expanded="false" aria-label="Nivå: ' + esc(info.niva) + '. Bytt nivå">' + knott('nb-liten') + '<span class="nb-navn">' + esc(info.niva) + '</span></button>' +
           '<span class="nb-panel" role="group" aria-label="Velg nivå">' + valg + knott('nb-stor') + '<span class="nb-tittel">NIVÅ</span></span></span>';
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
    var nb = bar.querySelector('.niva-bryter');
    if (nb) {
      // Krittfilteret (samme som på forsiden) legges inn én gang hvis siden ikke har det
      if (!document.getElementById('kritt')) {
        var f = document.createElement('div'); f.setAttribute('aria-hidden', 'true'); f.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
        f.innerHTML = '<svg width="0" height="0"><filter id="kritt" x="-5%" y="-15%" width="110%" height="130%">' +
          '<feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="4" result="ujevn"/>' +
          '<feDisplacementMap in="SourceGraphic" in2="ujevn" scale="2.6" xChannelSelector="R" yChannelSelector="G" result="kant"/>' +
          '<feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="1" seed="9" result="korn"/>' +
          '<feColorMatrix in="korn" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.6 1.55" result="hull"/>' +
          '<feComposite in="kant" in2="hull" operator="in"/></filter></svg>';
        document.body.appendChild(f);
      }
      var nk = nb.querySelector('.nb-knapp');
      nk.addEventListener('click', function () { var a = !nb.classList.contains('apen'); nb.classList.toggle('apen', a); nk.setAttribute('aria-expanded', String(a)); });
      document.addEventListener('click', function (e) { if (!nb.contains(e.target)) { nb.classList.remove('apen'); nk.setAttribute('aria-expanded', 'false'); } });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') nb.classList.remove('apen'); });
      // Skru viseren til det nye nivået før siden byttes
      nb.querySelectorAll('a.nb-valg').forEach(function (a) {
        a.addEventListener('click', function (e) {
          if (e.metaKey || e.ctrlKey || e.shiftKey) return;
          e.preventDefault(); nb.dataset.pos = a.dataset.niva;
          setTimeout(function () { location.href = a.href; }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 450);
        });
      });
    }
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
