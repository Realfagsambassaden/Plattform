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
      var nok = 'fh-forelesninger', l = []; try { l = JSON.parse(localStorage.getItem(nok)) || []; } catch (e) {}
      var f = l[0] || { id: 'f' + Date.now().toString(36), navn: 'Min forelesning', sider: [] };
      if (f.sider.indexOf(sti) < 0) f.sider.push(sti);
      l = [f].concat(l.filter(function (x) { return x.id !== f.id; }));
      try { localStorage.setItem(nok, JSON.stringify(l)); } catch (e) {}
      this.textContent = '✓ Lagt til i «' + f.navn + '»'; this.disabled = true;
    });
  }).catch(function () {});
})();
