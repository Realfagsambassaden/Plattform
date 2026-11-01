// «Design din forelesning»: velg sider fra innhold.json, ordne dem, lagre og vis som slides (forelesning.html).
(function () {
  var rot = document.getElementById('larer'); if (!rot) return;
  var R = (function () { var s = document.querySelector('script[src*="site_libs/"]'); return s ? s.getAttribute('src').split('site_libs/')[0] : ''; })();
  function last(src) { return new Promise(function (ok) { if (window.fhLarer) return ok(); var s = document.createElement('script'); s.src = R + src; s.onload = ok; document.body.appendChild(s); }); }
  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
  function vent(n) { return new Promise(function (ok) { (function sjekk(i) { if (window.fhKonto || i > n) ok(); else setTimeout(function () { sjekk(i + 1); }, 100); })(0); }); }

  vent(30).then(function () { return last('assets/js/larer-felles.js'); }).then(function () { return fhLarer.klar(); }).then(function (t) {
    if (t === 'ute') {
      rot.innerHTML = '<div class="konto-boks"><h2>Logg inn som lærer</h2><p>Forelesningsverktøyet er for forelesere og lærere. Logg inn (eller registrer deg gratis) for å lage dine egne forelesninger. De lagres på kontoen din, så du finner dem igjen på alle maskiner.</p><p><a class="btn-chalk" href="' + R + 'konto/index.html?neste=larer">Logg inn</a></p></div>';
      return;
    }
    try { localStorage.setItem('fh-larer', '1'); } catch (e) {}
    return Promise.all([fetch(R + 'innhold.json').then(function (r) { return r.json(); }), fetch(R + 'loyper.json').then(function (r) { return r.json(); })]).then(function (d) { bygg(d[0].sider, d[1], t); });
  });

  function bygg(sider, lj, tilgang) {
    var info = lj.sider || {};
    var omrRekke = [], emneRekke = {};
    sider.forEach(function (s) { var i = info[s.url]; s.emne = i ? i.emne : 'Annet'; s.omrade = i ? i.omrade : 'Annet'; });
    var f = fhLarer.utkast() || ny();
    function ny() { return { id: 'f' + Date.now().toString(36), navn: 'Min forelesning', sider: [] }; }

    rot.innerHTML =
      (tilgang === 'test' ? '<p class="larer-test">Testversjon: innlogging er ikke slått på ennå, så forelesningene lagres bare i denne nettleseren.</p>'
        : '<p class="larer-konto">Innlogget som <b>' + esc(fhLarer.epost()) + '</b>. Forelesningene lagres på kontoen din. <a href="' + R + 'konto/index.html">Min side</a></p>') +
      '<p class="larer-test larer-feil" hidden>Fikk ikke lagret på kontoen din akkurat nå. Endringene vises her, men sjekk nettforbindelsen og last siden på nytt.</p>' +
      '<div class="larer-rutenett">' +
      '<section class="larer-kilde"><h2>1. Plukk stoff</h2>' +
      '<input type="search" class="larer-sok" placeholder="Søk etter tema, f.eks. skrått kast, vektorer, energi …" aria-label="Søk i stoffet">' +
      '<div class="larer-liste"></div></section>' +
      '<section class="larer-valgt"><h2>2. Din forelesning</h2>' +
      '<input class="larer-navn" aria-label="Navn på forelesningen">' +
      '<ol class="larer-sider"></ol>' +
      '<p class="larer-tom">Ingen sider valgt ennå. Klikk <b>+</b> ved siden av en side til venstre.</p>' +
      '<div class="larer-knapper"><button type="button" class="btn-chalk" data-h="vis">▶ Vis forelesning</button>' +
      '<button type="button" class="btn-chalk sekundar" data-h="tilpass">✎ Tilpass innholdet</button>' +
      '<button type="button" class="btn-chalk sekundar" data-h="ny">Ny forelesning</button></div>' +
      '<p class="larer-tips">Tips: Med <b>✎ Tilpass innholdet</b> klikker du vekk tekst, definisjoner og løsninger du ikke vil ha med. I forelesningsmodus blar du med piltastene. Løsninger kommer først på neste klikk, og <kbd>F</kbd> gir fullskjerm.</p>' +
      '<div class="larer-lagret"></div></section></div>';

    var liste = rot.querySelector('.larer-liste'), sok = rot.querySelector('.larer-sok'), ol = rot.querySelector('.larer-sider'), navn = rot.querySelector('.larer-navn');

    function tegnKilde() {
      var q = sok.value.trim().toLowerCase(), grupper = {}, rekke = [];
      sider.forEach(function (s) {
        var tekst = [s.tittel, s.emne, s.omrade, s.del, s.kapittel].concat(s.emner || [], s.oppgaver || []).join(' ').toLowerCase();
        if (q && tekst.indexOf(q) < 0) return;
        var k = s.omrade + ' › ' + s.emne; if (!grupper[k]) { grupper[k] = []; rekke.push(k); } grupper[k].push(s);
      });
      liste.innerHTML = rekke.length ? rekke.map(function (k) {
        return '<details' + (q ? ' open' : '') + '><summary>' + esc(k) + ' <span class="ant">' + grupper[k].length + '</span></summary><ul>' +
          grupper[k].map(function (s) {
            var valgt = fhLarer.harSide(f, s.url);
            return '<li><button type="button" class="larer-pluss" data-url="' + esc(s.url) + '"' + (valgt ? ' disabled' : '') + ' aria-label="Legg til ' + esc(s.tittel) + '">' + (valgt ? '✓' : '+') + '</button>' +
              '<span><a href="' + esc(s.url) + '" target="_blank">' + esc(s.tittel) + '</a><small>' + esc(s.del) + (s.antall_oppgaver ? ' · ' + s.antall_oppgaver + ' oppg.' : '') + (s.video ? ' · video' : '') + '</small></span></li>';
          }).join('') + '</ul></details>';
      }).join('') : '<p>Fant ingen sider.</p>';
    }
    function tittel(url) { var s = sider.filter(function (x) { return x.url === url; })[0]; return s ? s.tittel : url; }
    function tegnValgt() {
      navn.value = f.navn;
      ol.innerHTML = f.sider.map(function (u, i) {
        var uu = fhLarer.url(u), ant = typeof u === 'string' ? 0 : (u.skjul || []).length;
        return '<li><span>' + esc(tittel(uu)) + (ant ? ' <small class="larer-tilpasset">' + ant + ' del' + (ant > 1 ? 'er' : '') + ' fjernet</small>' : '') + '</span><span class="larer-flytt">' +
          '<button type="button" data-i="' + i + '" data-h="opp" aria-label="Flytt opp"' + (i ? '' : ' disabled') + '>↑</button>' +
          '<button type="button" data-i="' + i + '" data-h="ned" aria-label="Flytt ned"' + (i < f.sider.length - 1 ? '' : ' disabled') + '>↓</button>' +
          '<button type="button" data-i="' + i + '" data-h="fjern" aria-label="Fjern">✕</button></span></li>';
      }).join('');
      rot.querySelector('.larer-tom').hidden = f.sider.length > 0;
      rot.querySelector('[data-h="vis"]').disabled = !f.sider.length;
      rot.querySelector('[data-h="tilpass"]').disabled = !f.sider.length;
      var andre = fhLarer.alle().filter(function (x) { return x.id !== f.id; });
      rot.querySelector('.larer-lagret').innerHTML = andre.length ? '<h3>Lagrede forelesninger</h3><ul>' + andre.map(function (x) {
        return '<li><a href="#" data-h="apne" data-id="' + esc(x.id) + '">' + esc(x.navn) + '</a> <small>' + x.sider.length + ' sider</small> <button type="button" data-h="slett" data-id="' + esc(x.id) + '" aria-label="Slett">✕</button></li>';
      }).join('') + '</ul>' : '';
    }
    function lagre() { fhLarer.lagre(f); tegnValgt(); tegnKilde(); }

    sok.addEventListener('input', tegnKilde);
    navn.addEventListener('change', function () { f.navn = navn.value.trim() || 'Min forelesning'; lagre(); });
    rot.addEventListener('click', function (e) {
      var b = e.target.closest('button, a[data-h]'); if (!b) return;
      if (b.classList.contains('larer-pluss')) { f.sider.push(b.getAttribute('data-url')); return lagre(); }
      var h = b.getAttribute('data-h'), i = +b.getAttribute('data-i');
      if (h === 'opp') { f.sider.splice(i - 1, 0, f.sider.splice(i, 1)[0]); lagre(); }
      else if (h === 'ned') { f.sider.splice(i + 1, 0, f.sider.splice(i, 1)[0]); lagre(); }
      else if (h === 'fjern') { f.sider.splice(i, 1); lagre(); }
      else if (h === 'ny') { f = ny(); lagre(); }
      else if (h === 'apne') { e.preventDefault(); f = fhLarer.hent(b.getAttribute('data-id')); lagre(); }
      else if (h === 'slett') { if (confirmSlett(b)) { fhLarer.slett(b.getAttribute('data-id')); tegnValgt(); } }
      else if (h === 'vis') { lagre(); location.href = R + 'larer/forelesning.html#id=' + encodeURIComponent(f.id); }
      else if (h === 'tilpass') { lagre(); location.href = R + 'larer/forelesning.html#id=' + encodeURIComponent(f.id) + '&rediger=1'; }
    });
    function confirmSlett(b) { if (b.dataset.sikker) return true; b.dataset.sikker = '1'; b.textContent = 'Slett?'; return false; }
    document.addEventListener('fh-larer-feil', function () { rot.querySelector('.larer-feil').hidden = false; });
    tegnValgt(); tegnKilde();
  }
})();
