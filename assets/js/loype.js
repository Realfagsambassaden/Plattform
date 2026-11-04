// Løypelinje øverst på innholdssider: emnet siden hører til, og «Forrige / Neste» i løypa du følger.
// Data: /loyper.json (lages av verktoy/emner.py ved hver bygging).
(function () {
  var main = document.querySelector('main#quarto-document-content') || document.querySelector('main');
  if (!main) return;
  var sti = location.pathname.replace(/\/index\.html$/, '/').replace(/\/$/, '/index.html');
  if (!/\.html$/.test(sti)) sti += '.html';
  var root = (function () { var s = document.querySelector('script[src*="site_libs/"]'); return s ? s.getAttribute('src').split('site_libs/')[0] : ''; })();
  fetch(root + 'loyper.json').then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
    if (!d) return;
    var info = d.sider[sti];
    var aktiv = null; try { aktiv = sessionStorage.getItem('loype'); } catch (e) {}
    // Står vi på en løypes oversiktsside? Husk den som aktiv løype.
    d.loyper.forEach(function (L) { if (L.url === sti) { try { sessionStorage.setItem('loype', L.id); } catch (e) {} } });
    var treff = d.loyper.filter(function (L) { return L.sider.some(function (s) { return s.url === sti; }); });
    var L = treff.filter(function (x) { return x.id === aktiv; })[0] || (treff.length === 1 ? treff[0] : null);
    if (!info && !L) return;
    var bar = document.createElement('nav'); bar.className = 'loype-linje'; bar.setAttribute('aria-label', 'Løype og emne');
    var h = '';
    if (info) h += '<span class="ll-emne"><span class="ll-merke">Emne</span><a href="' + info.emneUrl + '">' + esc(info.omrade) + ' › ' + esc(info.emne) + '</a>' +
                   (info.delemne ? ' › <a href="' + info.delemneUrl + '">' + esc(info.delemne) + '</a>' : '') + '</span>' + (info.niva ? '<span class="ll-niva">' + esc(info.niva) + '</span>' : '');
    if (L) {
      var i = L.sider.findIndex(function (s) { return s.url === sti; });
      var f = L.sider[i - 1], n = L.sider[i + 1];
      h += '<span class="ll-loype"><a href="' + L.url + '"><span class="ll-merke">Løype</span>' + esc(L.tittel) + '</a> <span class="ll-pos">' + (i + 1) + ' av ' + L.sider.length + '</span></span>';
      h += '<span class="ll-knapper">' + (f ? '<a href="' + f.url + '" title="' + esc(f.tittel) + '">← Forrige</a>' : '') + (n ? '<a href="' + n.url + '" title="' + esc(n.tittel) + '">Neste →</a>' : '') + '</span>';
    }
    // «Samme tema på et annet nivå»: andre sider om samme delemne (fra emner.yml + delemne-merkingen)
    if (info && info.tvillinger && info.tvillinger.length) {
      h += '<span class="ll-bytt"><span class="ll-merke">Samme tema på et annet nivå</span>' + info.tvillinger.map(function (t) {
        return '<a href="' + t.url + '" title="' + esc(t.tittel) + '">' + (t.niva ? '<b>' + esc(t.niva) + '</b> · ' : '') + esc(t.kilde) + '</a>';
      }).join('') + '</span>';
    }
    bar.innerHTML = h;
    var hode = main.querySelector('#title-block-header');
    if (hode) hode.parentNode.insertBefore(bar, hode); else main.insertBefore(bar, main.firstChild);
    // Forrige / neste nederst på siden, bare når siden er del av en løype
    if (L && (f || n)) {
      var bunn = document.createElement('nav'); bunn.className = 'loype-bunn'; bunn.setAttribute('aria-label', 'Forrige og neste i løypa');
      bunn.innerHTML = (f ? '<a class="lb-forrige" href="' + f.url + '"><span class="lb-merke">← Forrige i ' + esc(L.tittel) + '</span>' + esc(f.tittel) + '</a>' : '<span></span>') +
                       (n ? '<a class="lb-neste" href="' + n.url + '"><span class="lb-merke">Neste i ' + esc(L.tittel) + ' →</span>' + esc(n.tittel) + '</a>' : '<span></span>');
      main.appendChild(bunn);
    }
  }).catch(function () {});
  function esc(s) { var x = document.createElement('div'); x.textContent = s || ''; return x.innerHTML; }
})();
