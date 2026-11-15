// For lærere og undervisere: knapper for å vise stoffet i forelesningsmodus (larer/forelesning.html).
//  - Innholdsside: «▶ Forelesningsmodus» viser denne siden og resten av kapittelet som slides,
//    og «+ Legg til i forelesning» legger siden i forelesningen man holder på med.
//  - Kapittelside (…/index.html): «▶ Hele kapittelet i forelesningsmodus».
//  - Løypeside (loyper/<id>.html): en ▶-knapp ved hvert kapittel, med de sidene løypa har valgt.
// Vises når man har vært på lærersiden i denne nettleseren, eller er logget inn som underviser/administrator.
(function () {
  function erLarer() {
    try {
      if (localStorage.getItem('fh-larer') === '1') return true;
      var r = JSON.parse(localStorage.getItem('fh-rolle') || 'null');
      return !!(r && (r.rolle === 'underviser' || r.rolle === 'admin'));
    } catch (e) { return false; }
  }
  var main = document.querySelector('main#quarto-document-content'); var hode = main && main.querySelector('#title-block-header');
  if (!hode || /\/larer\//.test(location.pathname)) return;
  var R = (function () { var s = document.querySelector('script[src*="site_libs/"]'); return s ? s.getAttribute('src').split('site_libs/')[0] : ''; })();
  var sti = location.pathname.replace(/\/$/, '/index.html');
  function lenke(sider, s) { return R + 'larer/forelesning.html#sider=' + sider.map(encodeURIComponent).join(',') + (s ? '&s=' + s : ''); }
  function abs(h) { return new URL(h, location.href).pathname; }

  function vis() {
    if (document.querySelector('.fd-sideknapper')) return;
    // Løypeside: én knapp per kapittel
    if (/\/loyper\/[^/]+\.html$/.test(sti) && sti.indexOf('/loyper/index.html') < 0) {
      main.querySelectorAll('h3').forEach(function (h3) {
        var ul = h3.nextElementSibling; while (ul && ul.tagName !== 'UL' && !/^H[1-3]$/.test(ul.tagName)) ul = ul.nextElementSibling;
        if (!ul || ul.tagName !== 'UL') return;
        var sider = Array.prototype.map.call(ul.querySelectorAll('a[href]'), function (a) { return abs(a.getAttribute('href')); });
        if (!sider.length) return;
        var a = document.createElement('a'); a.className = 'btn-chalk sekundar fd-kapittelknapp'; a.href = lenke(sider); a.textContent = '▶ Forelesningsmodus';
        h3.appendChild(document.createTextNode(' ')); h3.appendChild(a);
      });
      var bar0 = document.createElement('div'); bar0.className = 'fd-sideknapper'; hode.appendChild(bar0);
      return;
    }
    fetch(R + 'innhold.json').then(function (r) { return r.json(); }).then(function (d) {
      var mappe = sti.replace(/[^/]+$/, '');
      var kapittel = d.sider.filter(function (s) { return s.url.indexOf(mappe) === 0 && s.url.slice(mappe.length).indexOf('/') < 0; }).map(function (s) { return s.url; });
      var bar = document.createElement('div'); bar.className = 'fd-sideknapper';
      if (kapittel.indexOf(sti) >= 0) {
        var herfra = kapittel.slice(kapittel.indexOf(sti));
        bar.innerHTML = '<a class="btn-chalk sekundar" title="Viser denne siden og resten av kapittelet som slides" href="' + lenke(herfra) + '">▶ Forelesningsmodus</a>' +
          '<button type="button" class="btn-chalk sekundar">+ Legg til i forelesning</button>';
      } else if (/\/index\.html$/.test(sti) && kapittel.length) {
        bar.innerHTML = '<a class="btn-chalk sekundar" href="' + lenke(kapittel) + '">▶ Hele kapittelet i forelesningsmodus</a>';
      } else return;
      hode.appendChild(bar);
      var knapp = bar.querySelector('button'); if (!knapp) return;
      knapp.addEventListener('click', function () {
        knapp.disabled = true;
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
  }
  if (erLarer()) vis();
  else setTimeout(function () { if (erLarer()) vis(); }, 2500);   // rollen hentes av konto.js etter innlogging
})();
