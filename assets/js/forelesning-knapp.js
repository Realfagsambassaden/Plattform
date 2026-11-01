// For lærere (har vært på lærersiden): knapper øverst på innholdssider for å vise siden i forelesningsmodus
// eller legge den til i forelesningen de holder på med.
(function () {
  var erLarer = false; try { erLarer = localStorage.getItem('fh-larer') === '1'; } catch (e) {}
  if (!erLarer) return;
  var main = document.querySelector('main#quarto-document-content'); var hode = main && main.querySelector('#title-block-header');
  if (!hode || /\/larer\//.test(location.pathname)) return;
  var R = (function () { var s = document.querySelector('script[src*="site_libs/"]'); return s ? s.getAttribute('src').split('site_libs/')[0] : ''; })();
  var sti = location.pathname.replace(/\/$/, '/index.html');
  fetch(R + 'innhold.json').then(function (r) { return r.json(); }).then(function (d) {
    if (!d.sider.some(function (s) { return s.url === sti; })) return;   // bare innholdssider
    var bar = document.createElement('div'); bar.className = 'fd-sideknapper';
    bar.innerHTML = '<a class="btn-chalk sekundar" href="' + R + 'larer/forelesning.html#sider=' + encodeURIComponent(sti) + '">▶ Forelesningsmodus</a>' +
      '<button type="button" class="btn-chalk sekundar">+ Legg til i forelesning</button>';
    hode.appendChild(bar);
    bar.querySelector('button').addEventListener('click', function () {
      var knapp = this; knapp.disabled = true;
      var lastet = window.fhLarer ? Promise.resolve() : new Promise(function (ok) { var s = document.createElement('script'); s.src = R + 'assets/js/larer-felles.js'; s.onload = ok; s.onerror = ok; document.body.appendChild(s); });
      lastet.then(function () { return window.fhLarer ? fhLarer.klar() : 'feil'; }).then(function (m) {
        if (m === 'ute') { location.href = R + 'konto/index.html?neste=larer'; return; }
        if (m === 'feil') { knapp.disabled = false; return; }
        var f = fhLarer.utkast() || { id: 'f' + Date.now().toString(36), navn: 'Min forelesning', sider: [] };
        if (!fhLarer.harSide(f, sti)) f.sider.push(sti);
        return fhLarer.lagre(f).then(function () { knapp.textContent = '✓ Lagt til i «' + f.navn + '»'; });
      });
    });
  }).catch(function () {});
})();
