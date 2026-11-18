// Forsiden på brede skjermer: samlekortene spres rundt forsideteksten og langs sidene nedover hele siden, litt på skrå
// (i stedet for de diffuse bildene av ambassadørene). Kortene gjentas til siden er fylt. Kopiene er skjult for
// skjermlesere; de ekte kortene ligger i #ambassadorer (som vises som en rad på smale skjermer).
// Må lastes før kort.js, så kopiene også får vippeeffekten.
(function () {
  var kilde = document.querySelectorAll('#ambassadorer .samlekort'), side = document.querySelector('.side');
  if (!kilde.length || !side) return;
  var lag = document.createElement('div'); lag.className = 'kortspredning'; lag.setAttribute('aria-hidden', 'true');
  side.insertBefore(lag, side.firstChild);

  // Fast «tilfeldighet», så kortene står likt hver gang.
  function rng(fro) { var a = fro; return function () { a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var KORT_B = 300, KORT_H = 535, nr = 0;

  function nyttKort(x, y, s, vri, o) {
    var k = kilde[nr++ % kilde.length].cloneNode(true);
    k.removeAttribute('id');
    k.querySelectorAll('a').forEach(function (a) { a.tabIndex = -1; });
    k.style.setProperty('--x', Math.round(x) + 'px'); k.style.setProperty('--y', Math.round(y) + 'px');
    k.style.setProperty('--s', s.toFixed(3)); k.style.setProperty('--vri', vri.toFixed(1) + 'deg');
    if (o) k.style.setProperty('--o', o);
    lag.appendChild(k);
  }

  function legg() {
    var W = document.documentElement.clientWidth;
    lag.innerHTML = ''; nr = 0;
    if (W < 1100) { document.documentElement.classList.remove('spredt'); return; }
    document.documentElement.classList.add('spredt');
    var r = rng(7), sr = side.getBoundingClientRect(), topp = sr.top + scrollY;
    var hero = document.querySelector('.hero'), tekst = document.querySelector('.hero-tekst'), main = document.querySelector('.side>main');
    var hr = hero.getBoundingClientRect(), tr = tekst.getBoundingClientRect(), mr = main.getBoundingClientRect();
    var H = side.scrollHeight;
    function vri() { return (r() * 2 - 1) * 11; }

    // 1) Rundt forsideteksten: to kort på hver side, forskjøvet.
    var rom = Math.min(tr.left - sr.left, sr.right - tr.right) - 30;
    var s = Math.max(.42, Math.min(.72, rom / KORT_B));
    var hy = hr.top + scrollY - topp, hh = hr.height;
    [[0, .02], [0, .5], [1, .1], [1, .58]].forEach(function (p, i) {
      var b = KORT_B * s, venstre = p[0] === 0;
      var x = venstre ? (tr.left - sr.left) - b - 30 - r() * 40 : (tr.right - sr.left) + 30 + r() * 40;
      nyttKort(x, hy + p[1] * hh - 10 + r() * 30, s * (.9 + r() * .15), vri());
    });

    // 2) Langs sidene nedover resten av siden, i margen utenfor innholdet (gjerne litt ut over kanten).
    var marg = mr.left - sr.left, start = hy + hh * .95;
    // Smal marg (f.eks. 1280 px): kortene stikker halvveis inn fra kanten.
    var smal = marg < 90;
    {
      var s2 = smal ? .42 : Math.max(.42, Math.min(.78, (marg + 70) / KORT_B)), b2 = KORT_B * s2, h2 = KORT_H * s2;
      var steg = h2 * (smal ? 1.5 : .78);
      for (var y = start, i = 0; y < H - h2 * .6; y += steg, i++) {
        // Venstre og høyre side forskjøvet med et halvt steg, så det blir et lappeteppe av kort.
        var xv = smal ? -b2 * .55 : marg / 2 - b2 / 2 + (r() * 2 - 1) * 30;
        nyttKort(smal ? xv : Math.max(-b2 * .4, xv), y + r() * 30, s2 * (.9 + r() * .15), vri());
        var xh = smal ? sr.width - b2 * .45 : (sr.width - marg / 2) - b2 / 2 + (r() * 2 - 1) * 30;
        nyttKort(smal ? xh : Math.min(sr.width - b2 * .6, xh), y + steg / 2 + r() * 30, s2 * (.9 + r() * .15), vri());
      }
    }
  }
  var t; window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(legg, 150); });
  // Fontene endrer høyden på siden; legg kortene på nytt når alt er lastet.
  legg(); window.addEventListener('load', legg);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(legg);
})();
