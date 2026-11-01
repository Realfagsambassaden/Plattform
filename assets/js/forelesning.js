// Forelesningsmodus: henter de valgte sidene og deler dem opp i tavleslides.
// Adresse: larer/forelesning.html#id=<forelesning>  eller  #sider=/sti/a.html,/sti/b.html
(function () {
  var start = document.getElementById('foredrag-start'); if (!start) return;
  var R = (function () { var s = document.querySelector('script[src*="site_libs/"]'); return s ? s.getAttribute('src').split('site_libs/')[0] : ''; })();
  var MAKS_TEGN = 650;   // ca. hvor mye tekst som får plass på én slide

  function param(n) { var m = location.hash.match(new RegExp('[#&]' + n + '=([^&]*)')); return m ? decodeURIComponent(m[1]) : null; }
  function last(src) { return new Promise(function (ok) { var s = document.createElement('script'); s.src = R + src; s.onload = ok; s.onerror = ok; document.body.appendChild(s); }); }

  last('assets/js/larer-felles.js').then(function () { return fhLarer.klar(); }).then(function () {
    var navn = 'Forelesning', urler = [];
    var id = param('id'), sider = param('sider');
    if (id && fhLarer.hent(id)) { var f = fhLarer.hent(id); navn = f.navn; urler = f.sider; }
    else if (sider) urler = sider.split(',').filter(Boolean);
    if (!urler.length) { start.innerHTML = '<p>Fant ingen forelesning. <a href="' + R + 'larer/index.html">Lag en her.</a></p>'; return; }
    start.innerHTML = '<p>Henter ' + urler.length + ' sider …</p>';
    return Promise.all(urler.map(hentSide)).then(function (deler) { vis(navn, [].concat.apply([], deler)); });
  });

  function hentSide(url) {
    var abs = new URL(url, location.href);
    return fetch(abs).then(function (r) { return r.text(); }).then(function (html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var main = doc.querySelector('main#quarto-document-content') || doc.querySelector('main');
      var tittel = (doc.querySelector('h1.title') || doc.querySelector('h1') || {}).textContent || '';
      if (!main) return [];
      main.querySelectorAll('#title-block-header, script, .callout-warning, nav, .quarto-alternate-formats, footer').forEach(function (x) { x.remove(); });
      main.querySelectorAll('[src]').forEach(function (x) { x.setAttribute('src', new URL(x.getAttribute('src'), abs).href); });
      main.querySelectorAll('a[href]').forEach(function (x) { var h = x.getAttribute('href'); if (h && h[0] !== '#') { x.setAttribute('href', new URL(h, abs).href); x.target = '_blank'; } });
      return del(tittel.trim(), main);
    }).catch(function () { return [{ tittel: url, deler: [lagEl('<p>Fikk ikke hentet denne siden.</p>')] }]; });
  }
  function lagEl(h) { var d = document.createElement('div'); d.innerHTML = h; return d.firstChild; }

  // Del en side i slides: tittelslide, ny slide ved hver overskrift, egne slides for eksempler, oppgaver,
  // videoer og figurer, og ellers ny slide når det blir for mye tekst.
  function del(tittel, main) {
    var slides = [{ type: 'tittel', tittel: tittel, deler: [] }], cur = null, tegn = 0;
    function ny(overskrift) { cur = { tittel: overskrift || (cur && cur.tittel) || tittel, deler: [] }; slides.push(cur); tegn = 0; }
    function egen(el, type) { slides.push({ tittel: cur ? cur.tittel : tittel, type: type, deler: [el] }); cur = null; tegn = 0; }
    function blokk(el) {
      if (el.nodeType !== 1) return;
      var tag = el.tagName, cls = el.classList;
      if (tag === 'SECTION') { Array.prototype.slice.call(el.childNodes).forEach(blokk); return; }
      if (/^H[23]$/.test(tag)) { ny(el.textContent.trim()); return; }
      if (cls.contains('oppgaver')) { Array.prototype.slice.call(el.childNodes).forEach(blokk); return; }
      if (cls.contains('oppgave')) return egen(el, 'oppgave');
      if (cls.contains('eksempel') || cls.contains('quarto-video') || el.querySelector('iframe')) return egen(el, cls.contains('eksempel') ? 'eksempel' : 'video');
      if (el.querySelector('img') && (el.textContent || '').trim().length < 200) return egen(el, 'figur');
      var n = (el.textContent || '').length;
      if (!cur || (tegn + n > MAKS_TEGN && cur.deler.length)) ny();
      cur.deler.push(el); tegn += n;
    }
    Array.prototype.slice.call(main.childNodes).forEach(blokk);
    return slides.filter(function (s) { return s.type === 'tittel' || s.deler.length; });
  }

  function vis(navn, slides) {
    slides.unshift({ type: 'forside', tittel: navn, deler: [] });
    var scene = document.createElement('div'); scene.className = 'foredrag'; scene.tabIndex = 0;
    scene.innerHTML = '<div class="fd-slide"></div><div class="fd-linje"><span class="fd-navn"></span><span class="fd-pos"></span>' +
      '<span class="fd-knapper"><button type="button" data-h="løsning" hidden>Vis løsning (L)</button><button type="button" data-h="forrige" aria-label="Forrige">←</button><button type="button" data-h="neste" aria-label="Neste">→</button>' +
      '<button type="button" data-h="full" aria-label="Fullskjerm">⛶</button><a href="' + R + 'larer/index.html" aria-label="Avslutt">✕</a></span></div>';
    document.body.appendChild(scene); document.body.classList.add('har-foredrag'); start.remove();
    var flate = scene.querySelector('.fd-slide'), i = 0;
    var fra = parseInt(param('s'), 10); if (fra > 0 && fra <= slides.length) i = fra - 1;

    function tegn() {
      var s = slides[i]; flate.innerHTML = ''; flate.className = 'fd-slide fd-' + (s.type || 'vanlig');
      if (s.type === 'forside') flate.innerHTML = '<p class="fd-merke">fysikkhjelp.no</p><h1>' + esc(s.tittel) + '</h1><p class="fd-under">' + (slides.length - 1) + ' slides · bla med piltastene</p>';
      else if (s.type === 'tittel') flate.innerHTML = '<h1>' + esc(s.tittel) + '</h1>';
      else {
        var h = document.createElement('h2'); h.textContent = s.tittel; flate.appendChild(h);
        s.deler.forEach(function (d) { flate.appendChild(d.cloneNode(true)); });
        if (s.type === 'oppgave') {
          var o = flate.querySelector('.oppgave'), t = o && (o.getAttribute('data-tittel') || o.getAttribute('tittel'));
          h.textContent = 'Oppgave' + (t ? ': ' + t : '');
          flate.querySelectorAll('.oppg-tittel').forEach(function (x) { var p = x.closest('p'); (p && p.textContent.trim() === x.textContent.trim() ? p : x).remove(); });
        }
      }
      var los = flate.querySelectorAll('.losning'); los.forEach(function (l) { l.hidden = true; });
      var lk = scene.querySelector('[data-h="løsning"]'); lk.hidden = !los.length; lk.textContent = 'Vis løsning (L)';
      scene.querySelector('.fd-navn').textContent = slides[0].tittel;
      scene.querySelector('.fd-pos').textContent = (i + 1) + ' / ' + slides.length;
      history.replaceState(null, '', location.pathname + location.hash.replace(/&s=\d+/, '') + '&s=' + (i + 1));
      if (window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise([flate]).catch(function () {});
      flate.scrollTop = 0;
    }
    function gå(d) { var n = Math.max(0, Math.min(slides.length - 1, i + d)); if (n !== i) { i = n; tegn(); } }
    function løsning() {
      var los = flate.querySelectorAll('.losning'); if (!los.length) return;
      var skjul = !los[0].hidden; los.forEach(function (l) { l.hidden = skjul; });
      scene.querySelector('[data-h="løsning"]').textContent = skjul ? 'Vis løsning (L)' : 'Skjul løsning (L)';
      if (!skjul && window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise(Array.prototype.slice.call(los)).catch(function () {});
    }
    function full() { if (document.fullscreenElement) document.exitFullscreen(); else if (scene.requestFullscreen) scene.requestFullscreen(); }
    document.addEventListener('keydown', function (e) {
      if (e.target.closest && e.target.closest('input, textarea')) return;
      var k = e.key;
      if (k === 'ArrowRight' || k === 'PageDown' || k === ' ') { e.preventDefault(); gå(1); }
      else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); gå(-1); }
      else if (k === 'Home') { i = 0; tegn(); } else if (k === 'End') { i = slides.length - 1; tegn(); }
      else if (k === 'l' || k === 'L') løsning();
      else if (k === 'f' || k === 'F') full();
    });
    scene.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var h = b.getAttribute('data-h');
      if (h === 'neste') gå(1); else if (h === 'forrige') gå(-1); else if (h === 'full') full(); else if (h === 'løsning') løsning();
    });
    tegn(); scene.focus();
  }
  function esc(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
})();
