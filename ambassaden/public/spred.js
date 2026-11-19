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
  var KORT_B = 300, KORT_H = 535, nr = 0, kransFase = 0, kransAnim = 0;

  // «Eksplosjonen» rundt forsideteksten: en sirkelformet stjerne med tagger, i kritt med grønt lys. Tegnes etter
  // tekstens størrelse. På brede skjermer får forsiden høyde nok til at kortkransen får plass rundt.
  function tegnStjerne(W) {
    var hero = document.querySelector('.hero'), tekst = document.querySelector('.hero-tekst');
    if (!hero || !tekst) return;
    var st = hero.querySelector('.stjerne');
    if (!st) { st = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); st.setAttribute('class', 'stjerne'); st.setAttribute('aria-hidden', 'true'); hero.insertBefore(st, hero.firstChild); }
    hero.style.minHeight = '';
    var b = tekst.offsetWidth, h = tekst.offsetHeight;
    var d = Math.round(Math.min(W < 700 ? W * 1.25 : 980, Math.max(Math.hypot(b, h) * 1.02, 420)));
    if (W >= 1100) hero.style.minHeight = Math.round(d + 330) + 'px';   // plass til kransen over og under
    st.setAttribute('viewBox', '0 0 ' + d + ' ' + d); st.style.width = st.style.height = d + 'px';
    var r = rng(11), n = 46, c = d / 2, ytre = d / 2 - 6, pkt = [], pkt2 = [];
    for (var i = 0; i < n * 2; i++) {
      var a = i / (n * 2) * Math.PI * 2 - Math.PI / 2, tagg = i % 2 === 0;
      var rr = tagg ? ytre * (.95 + r() * .05) : ytre * (.9 + r() * .02);
      pkt.push((c + rr * Math.cos(a)).toFixed(1) + ',' + (c + rr * Math.sin(a)).toFixed(1));
      var r2 = rr - (tagg ? 14 : 10);
      pkt2.push((c + r2 * Math.cos(a + .012)).toFixed(1) + ',' + (c + r2 * Math.sin(a + .012)).toFixed(1));
    }
    st.innerHTML = '<defs><radialGradient id="stjerne-lys"><stop offset="0" stop-color="#2f3a33"/><stop offset=".7" stop-color="#262b2b"/><stop offset="1" stop-color="#22262a"/></radialGradient></defs>' +
      '<polygon points="' + pkt.join(' ') + '" fill="url(#stjerne-lys)" fill-opacity=".94" stroke="#8fcf86" stroke-opacity=".75" stroke-width="2.4" stroke-linejoin="round" filter="url(#kritt)"/>' +
      '<polygon points="' + pkt2.join(' ') + '" fill="none" stroke="#eceeea" stroke-opacity=".28" stroke-width="1.6" stroke-linejoin="round" filter="url(#kritt)"/>';
  }

  function nyttKort(x, y, s, vri, o) {
    var k = kilde[nr++ % kilde.length].cloneNode(true);
    k.removeAttribute('id');
    k.querySelectorAll('a').forEach(function (a) { a.tabIndex = -1; });
    k.style.setProperty('--x', Math.round(x) + 'px'); k.style.setProperty('--y', Math.round(y) + 'px');
    k.style.setProperty('--s', s.toFixed(3)); k.style.setProperty('--vri', vri.toFixed(1) + 'deg');
    if (o) k.style.setProperty('--o', o);
    lag.appendChild(k);
  }

  // «ambassaden» skaleres til samme bredde som «REALFAGS».
  function navnebredde() {
    var st = document.querySelector('.ht-stor'), li = document.querySelector('.ht-liten');
    if (!st || !li) return;
    li.style.fontSize = ''; li.style.letterSpacing = '';
    var f = st.getBoundingClientRect().width / Math.max(1, li.getBoundingClientRect().width);
    li.style.fontSize = (parseFloat(getComputedStyle(li).fontSize) * f).toFixed(1) + 'px';
  }
  function legg() {
    navnebredde();
    var W = document.documentElement.clientWidth;
    lag.innerHTML = ''; nr = 0;
    cancelAnimationFrame(kransAnim);
    if (W < 1100) { document.documentElement.classList.remove('spredt'); tegnStjerne(W); return; }
    document.documentElement.classList.add('spredt');
    tegnStjerne(W);
    var r = rng(7), sr = side.getBoundingClientRect(), topp = sr.top + scrollY;
    var hero = document.querySelector('.hero'), tekst = document.querySelector('.hero-tekst'), main = document.querySelector('.side>main');
    var hr = hero.getBoundingClientRect(), tr = tekst.getBoundingClientRect(), mr = main.getBoundingClientRect();
    var H = side.scrollHeight;
    function vri() { return (r() * 2 - 1) * 11; }

    // 1) Laurbærkrans: kortene står rundt «eksplosjonen» rundt forsideteksten, som blad på en krans – fra bunnen
    //    i midten og opp langs begge sider, vippet langs kransen (mer liggende nederst, mer stående på siden).
    var hy = hr.top + scrollY - topp, hh = hr.height;
    var st = hero.querySelector('.stjerne'), sb = st ? st.getBoundingClientRect() : tr;
    var cx = (sb.left + sb.right) / 2 - sr.left, cy = (sb.top + sb.bottom) / 2 + scrollY - topp, rs = Math.max(sb.width, sb.height) / 2;
    var s = Math.max(.34, Math.min(.46, (W - 2 * rs) / 2 / 330)), kb = KORT_B * s, kh = KORT_H * s;
    var R = rs + kh * .42;   // brukes av pynten og kortene nedover
    // Kortene som en hånd med kort: to vifter, én på hver side, med bunnen skjult bak stjerna og kortene delvis
    // over hverandre. Hver vifte dreier rundt et punkt inne i stjerna.
    function senter(x, y, sk, rot) {   // plasser et kort med midtpunkt i (x, y)
      var a = rot * Math.PI / 180, bx = KORT_B * sk / 2, by = KORT_H * sk / 2;
      nyttKort(x - (bx * Math.cos(a) - by * Math.sin(a)), y - (bx * Math.sin(a) + by * Math.cos(a)), sk, rot);
    }
    // Kortene ruller sakte rundt stjerna (én runde på ca. 3 minutter). De vippes etter hvor de står (rett opp
    // øverst, på skrå langs sidene), og tones ut nederst, der de ellers ville snudd. Står stille når musa er over et kort,
    // og for dem som har bedt om mindre bevegelse.
    var N = 12, L = rs + kh * .12, ring = [];   // 12 = to av hver, så samme person aldri står ved siden av seg selv
    for (var i = 0; i < N; i++) { senter(0, 0, s * (.95 + r() * .1), 0); var k = lag.lastChild; k.classList.add('i-ring'); ring.push({ k: k, sk: parseFloat(k.style.getPropertyValue('--s')), l: L + (r() * 2 - 1) * kh * .05 }); }
    function plasserRing(fase) {
      ring.forEach(function (o, i) {
        var v = ((fase + i * 360 / N) % 360 + 360) % 360, vv = v > 180 ? v - 360 : v;   // -180..180, 0 = rett opp
        var a = vv * Math.PI / 180, rot = vv * .55;
        var x = cx + Math.sin(a) * o.l, y = cy - Math.cos(a) * o.l, ar = rot * Math.PI / 180, bx = KORT_B * o.sk / 2, by = KORT_H * o.sk / 2;
        o.k.style.setProperty('--x', Math.round(x - (bx * Math.cos(ar) - by * Math.sin(ar))) + 'px');
        o.k.style.setProperty('--y', Math.round(y - (bx * Math.sin(ar) + by * Math.cos(ar))) + 'px');
        o.k.style.setProperty('--vri', rot.toFixed(1) + 'deg');
        var nede = Math.abs(vv) > 125 ? Math.max(0, 1 - (Math.abs(vv) - 125) / 30) : 1;   // tones ut nederst
        o.k.style.setProperty('--o', nede.toFixed(2)); o.k.style.pointerEvents = nede < .3 ? 'none' : '';
      });
    }
    var rolig = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    kransFase = kransFase || 0; plasserRing(kransFase);
    if (!rolig) {
      cancelAnimationFrame(kransAnim);
      var forrige = null;
      (function steg(t) {
        if (forrige !== null && !lag.querySelector('.i-ring:hover')) kransFase += (t - forrige) * 360 / 180000;
        forrige = t; plasserRing(kransFase); kransAnim = requestAnimationFrame(steg);
      })(performance.now());
    }

    // Emojier og stjerner strødd rundt kransen og nedover sidene.
    var EMOJI = ['⭐', '⭐', '🌟', '✨', '⭐', '🧪', '🧪', '⚗️', '🧫', '🦠', '🧬', '🔬', '🔭', '🪐', '🪐', '🌍', '🌙', '☄️', '🚀', '⚛️', '🧲', '💡', '⚡', '🌡️', '📐', '🧮',
      '🐢', '🐙', '🦋', '🐝', '🐸', '🦕', '🐋', '🦉', '🌱', '🍄'];
    var FORMLER = ['E = mc²', 'F = ma', 'π', '∑', '∫ f dx', '√2', 'ΔU = Q + W', 'λ = h/p', 'H₂O', 'e^iπ + 1 = 0', 'pV = nRT', 'DNA', 'CO₂', 'a² + b² = c²', '∇·E = ρ/ε₀'];
    function pynt(x, y, tegn, kl, str, o) {
      var e = document.createElement('span'); e.className = 'pynt ' + (kl || ''); e.textContent = tegn;
      e.style.setProperty('--x', Math.round(x) + 'px'); e.style.setProperty('--y', Math.round(y) + 'px');
      e.style.setProperty('--vri', Math.round((r() * 2 - 1) * 25) + 'deg'); e.style.setProperty('--d', (r() * 3).toFixed(2) + 's');
      e.style.fontSize = str + 'px'; if (o) e.style.setProperty('--o', o); lag.appendChild(e);
    }
    for (var j = 0; j < 30; j++) {   // rundt kransen, mellom og utenfor kortene
      var pa = (j / 30) * Math.PI * 2 + r() * .2, pr = R + kh * (.55 + r() * .45);
      var px = cx + pr * Math.cos(pa), py = cy + pr * Math.sin(pa);
      if (px < 10 || px > sr.width - 40 || py < hy + 10) continue;
      var hva = j % 4;   // 0, 1: emoji, 2: stjerne, 3: formel i kritt
      if (hva === 3) pynt(px, py, FORMLER[Math.floor(r() * FORMLER.length)], 'formel', 15 + r() * 8, .75);
      else if (hva === 2) pynt(px, py, r() < .7 ? '⭐' : '✦', r() < .6 ? 'stjerne-tegn' : 'glimt', 18 + r() * 16, .7 + r() * .3);
      else pynt(px, py, EMOJI[Math.floor(r() * EMOJI.length)], '', 26 + r() * 14, .92);
    }

    for (var q = 0; q < 14; q++) {   // ekstra ⭐ tett rundt stjerna i midten
      var qa = r() * Math.PI * 2, qr = rs * (1.02 + r() * .12);
      pynt(cx + qr * Math.cos(qa) - 12, cy + qr * Math.sin(qa) - 12, '⭐', 'stjerne-tegn', 16 + r() * 14, .75 + r() * .25);
    }

    // 2) Langs sidene nedover resten av siden, i margen utenfor innholdet (gjerne litt ut over kanten).
    var marg = mr.left - sr.left, start = Math.max(hy + hh * .95, cy + R + kh * .6);
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
        if (!smal) {   // litt pynt i margen mellom kortene
          pynt(Math.max(8, xv + b2 * (.2 + r() * .6)), y + steg * .7, r() < .35 ? '✦' : EMOJI[Math.floor(r() * EMOJI.length)], r() < .35 ? 'stjerne-tegn' : '', 20 + r() * 14, .85);
          pynt(Math.min(sr.width - 60, xh + b2 * (.1 + r() * .5)), y + steg * 1.15, r() < .4 ? FORMLER[Math.floor(r() * FORMLER.length)] : EMOJI[Math.floor(r() * EMOJI.length)], 'formel', 18 + r() * 10, .8);
        }
      }
    }
  }
  var t; window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(legg, 150); });
  // Fontene endrer høyden på siden; legg kortene på nytt når alt er lastet.
  legg(); window.addEventListener('load', legg);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(legg);
})();
