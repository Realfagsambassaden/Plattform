// Tavlepenn: tegn på slidene i forelesningsmodusen (assets/js/forelesning.js) og i undervisningsmodusen for fag (assets/js/studie.js).
// Siden kan lage en ny Tavlepenn når den tegnes på nytt; den gamle slutter å reagere når flaten er borte fra siden.
// Apple Pencil og finger på iPad, mus eller tegnebrett på Mac. Trykkfølsom strek med pennen.
// Tegningene huskes per slide (og per tavle) mens forelesningen pågår, også om siden lastes på nytt (sessionStorage).
// Koordinatene lagres som andeler av flaten, så tegningene skalerer med skjermen.
//
// Taster: P penn av/på · E viskelær · B tom tavle · Z (eller Ctrl/Cmd+Z) angre · Delete tøm sliden · 1–5 farge
window.Tavlepenn = function (scene, flate, lagringsnokkel) {
  // Kritt på mørk tavle, tusj på lyst papir (lys modus)
  var bg = getComputedStyle(scene).backgroundColor.match(/\d+/g) || [0, 0, 0];
  var lys = (0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2]) / 255 > 0.5;
  var FARGER = lys ? [['Svart', '#1c2320'], ['Grønn', '#1c8a2c'], ['Gul', '#776600'], ['Oransje', '#b05f08'], ['Turkis', '#0b7b6b']]
                   : [['Hvit', '#eceeea'], ['Grønn', '#8fcf86'], ['Gul', '#e6d98a'], ['Oransje', '#e39d63'], ['Turkis', '#7fc3b4']];
  var lerret = document.createElement('canvas'); lerret.className = 'tp-lerret';
  var tavle = document.createElement('div'); tavle.className = 'tp-tavle'; tavle.hidden = true;
  tavle.innerHTML = '<span class="tp-tavlenavn">Tavle</span>';
  flate.appendChild(tavle); flate.appendChild(lerret);
  var ctx = lerret.getContext('2d');

  var verktoy = document.createElement('div'); verktoy.className = 'tp-verktoy'; verktoy.hidden = true;
  verktoy.innerHTML = FARGER.map(function (f, i) { return '<button type="button" class="tp-farge" data-tp="farge" data-i="' + i + '" style="--f:' + f[1] + '" aria-label="' + f[0] + ' (' + (i + 1) + ')" title="' + f[0] + ' (' + (i + 1) + ')"></button>'; }).join('') +
    '<label class="tp-egen" title="Velg en annen farge"><input type="color" data-tp="egen" aria-label="Velg en annen farge"><span>+</span></label>' +
    '<button type="button" data-tp="tykk" title="Tykkelse">●</button>' +
    '<button type="button" data-tp="visk" title="Viskelær (E)">Visk</button>' +
    '<button type="button" data-tp="angre" title="Angre (Z)">↶</button>' +
    '<button type="button" data-tp="tom" title="Tøm sliden (Delete)">Tøm</button>';

  var egen = null; try { egen = localStorage.getItem('tavlepenn-egenfarge'); } catch (e) {}
  var aktiv = false, farge = 0, visk = false, tykk = 1, tavleVis = false, noekkel = '0';
  var tegninger = {}; try { tegninger = JSON.parse(sessionStorage.getItem(lagringsnokkel) || '{}'); } catch (e) {}
  var lagreTid = null;
  function lagre() { clearTimeout(lagreTid); lagreTid = setTimeout(function () { try { sessionStorage.setItem(lagringsnokkel, JSON.stringify(tegninger)); } catch (e) {} }, 400); }
  function streker() { var k = (tavleVis ? 'tavle:' : '') + noekkel; return tegninger[k] || (tegninger[k] = []); }

  // ---- tegning
  var B = 1, H = 1, dpr = 1;
  function storrelse() {
    var r = flate.getBoundingClientRect(); dpr = window.devicePixelRatio || 1; B = r.width; H = r.height;
    lerret.width = Math.round(B * dpr); lerret.height = Math.round(H * dpr); lerret.style.width = B + 'px'; lerret.style.height = H + 'px';
    tegnAlt();
  }
  function bredde(s, p, b, h) { return (s.v ? 30 : (s.t === 2 ? 9 : 4.2)) * (0.45 + 1.1 * p) * Math.min(b, h) / 800; }
  function strek(s, fra) { strekPa(ctx, B, H, dpr, s, fra); planSpeil(); }
  function strekPa(ctx, B, H, dpr, s, fra) {
    var p = s.p; if (!p.length) return;
    ctx.save(); ctx.scale(dpr, dpr);
    ctx.globalCompositeOperation = s.v ? 'destination-out' : 'source-over';
    ctx.strokeStyle = s.v ? '#000' : (s.c || (FARGER[s.f] || FARGER[0])[1]); ctx.fillStyle = ctx.strokeStyle; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (p.length === 1) { ctx.beginPath(); ctx.arc(p[0][0] * B, p[0][1] * H, bredde(s, p[0][2], B, H) / 2, 0, 7); ctx.fill(); ctx.restore(); return; }
    for (var i = Math.max(1, fra || 1); i < p.length; i++) {   // korte biter med trykkets tykkelse; myk kurve gjennom midtpunktene
      var a = p[i - 1], b = p[i], c = p[i - 2] || a;
      ctx.lineWidth = bredde(s, (a[2] + b[2]) / 2, B, H);
      ctx.beginPath();
      ctx.moveTo((c[0] + a[0]) / 2 * B, (c[1] + a[1]) / 2 * H);
      ctx.quadraticCurveTo(a[0] * B, a[1] * H, (a[0] + b[0]) / 2 * B, (a[1] + b[1]) / 2 * H);
      ctx.stroke();
    }
    ctx.restore();
  }
  function tegnAlt() { ctx.clearRect(0, 0, lerret.width, lerret.height); streker().forEach(function (s) { strekPa(ctx, B, H, dpr, s); }); planSpeil(); }

  // ---- speil: samme tegninger på slidene i vinduet på den andre skjermen (projektoren). Tegnes på nytt etter hver endring.
  var speil = null, speilPlan = false;
  function planSpeil() { if (!speil || speilPlan) return; speilPlan = true; (window.requestAnimationFrame || setTimeout)(function () { speilPlan = false; tegnSpeil(); }); }
  function tegnSpeil() {
    if (!speil || !speil.flate.isConnected) return;
    var r = speil.flate.getBoundingClientRect(), d = (speil.flate.ownerDocument.defaultView || window).devicePixelRatio || 1, c = speil.lerret;
    if (c.width !== Math.round(r.width * d) || c.height !== Math.round(r.height * d)) { c.width = Math.round(r.width * d); c.height = Math.round(r.height * d); c.style.width = r.width + 'px'; c.style.height = r.height + 'px'; }
    var x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height);
    streker().forEach(function (s) { strekPa(x, r.width, r.height, d, s); });
    speil.tavle.hidden = !tavleVis;
  }
  function settSpeil(flate2) {
    if (speil && speil.flate === flate2 && speil.lerret.isConnected) return planSpeil();
    var dok = flate2.ownerDocument;
    Array.prototype.slice.call(flate2.querySelectorAll('.tp-lerret, .tp-tavle')).forEach(function (e) { e.remove(); });
    var c = dok.createElement('canvas'); c.className = 'tp-lerret';
    var t = dok.createElement('div'); t.className = 'tp-tavle'; t.hidden = true; t.innerHTML = '<span class="tp-tavlenavn">Tavle</span>';
    flate2.appendChild(t); flate2.appendChild(c);
    speil = { flate: flate2, lerret: c, tavle: t };
    var w = dok.defaultView; if (w) w.addEventListener('resize', planSpeil);
    planSpeil();
  }

  // ---- penn og finger. Har pennen vært brukt, tegner ikke fingeren (håndflaten på iPad).
  var naa = null, pennBrukt = false;
  function punkt(e) { var r = lerret.getBoundingClientRect(); return [(e.clientX - r.left) / B, (e.clientY - r.top) / H, e.pointerType === 'pen' ? (e.pressure || .5) : .5]; }
  lerret.addEventListener('pointerdown', function (e) {
    if (!aktiv) return;
    if (e.pointerType === 'pen') pennBrukt = true;
    if (e.pointerType === 'touch' && pennBrukt) return;
    if (e.button === 2) return;
    e.preventDefault(); try { lerret.setPointerCapture(e.pointerId); } catch (x) {}
    naa = { f: Math.max(farge, 0), c: farge < 0 ? egen : undefined, t: tykk, v: visk || e.button === 5 || (e.buttons & 32) ? 1 : 0, p: [punkt(e)], id: e.pointerId };
    streker().push(naa); strek(naa);
  });
  lerret.addEventListener('pointermove', function (e) {
    if (!naa || e.pointerId !== naa.id) return;
    e.preventDefault();
    var liste = e.getCoalescedEvents && e.getCoalescedEvents(); if (!liste || !liste.length) liste = [e];   // alle punktene mellom to hendelser (jevnere strek med Pencil)
    var fra = naa.p.length;
    liste.forEach(function (x) { naa.p.push(punkt(x)); });
    strek(naa, fra);
  });
  function slutt(e) { if (!naa || e.pointerId !== naa.id) return; naa.p = naa.p.map(function (q) { return [+q[0].toFixed(4), +q[1].toFixed(4), +q[2].toFixed(2)]; }); delete naa.id; naa = null; lagre(); }
  lerret.addEventListener('pointerup', slutt); lerret.addEventListener('pointercancel', slutt);
  lerret.addEventListener('contextmenu', function (e) { if (aktiv) e.preventDefault(); });

  // ---- knapper og taster
  function oppdater() {
    lerret.classList.toggle('tp-aktiv', aktiv); verktoy.hidden = !aktiv; scene.classList.toggle('tp-tegner', aktiv);
    var pk = scene.querySelector('[data-h="penn"]'); if (pk) { pk.classList.toggle('tp-pa', aktiv); pk.setAttribute('aria-pressed', aktiv); }
    var tk = scene.querySelector('[data-h="tavle"]'); if (tk) tk.classList.toggle('tp-pa', tavleVis);
    verktoy.querySelectorAll('.tp-farge').forEach(function (b, i) { b.classList.toggle('valgt', !visk && i === farge); });
    var eg = verktoy.querySelector('.tp-egen'); eg.classList.toggle('valgt', !visk && farge < 0); eg.classList.toggle('har', !!egen);
    if (egen) { eg.style.setProperty('--f', egen); eg.querySelector('input').value = egen; }
    verktoy.querySelector('[data-tp="visk"]').classList.toggle('valgt', visk);
    verktoy.querySelector('[data-tp="tykk"]').textContent = tykk === 2 ? '⬤' : '●';
    tavle.hidden = !tavleVis; flate.classList.toggle('tp-tavlemodus', tavleVis);
    planSpeil();
  }
  function penn(paa) { aktiv = paa == null ? !aktiv : paa; if (!aktiv) visk = false; oppdater(); }
  function angre() { var s = streker(); s.pop(); tegnAlt(); lagre(); }
  function tom() { var k = (tavleVis ? 'tavle:' : '') + noekkel; tegninger[k] = []; tegnAlt(); lagre(); }
  function visTavle(paa) { tavleVis = paa == null ? !tavleVis : paa; if (tavleVis) aktiv = true; oppdater(); tegnAlt(); }
  verktoy.addEventListener('input', function (e) {
    if (e.target.getAttribute('data-tp') !== 'egen') return;
    egen = e.target.value; farge = -1; visk = false; try { localStorage.setItem('tavlepenn-egenfarge', egen); } catch (x) {}
    oppdater();
  });
  verktoy.addEventListener('click', function (e) {
    if (e.target.closest('.tp-egen') && egen && farge >= 0) { farge = -1; visk = false; oppdater(); }
    var b = e.target.closest('button'); if (!b) return; var h = b.getAttribute('data-tp');
    if (h === 'farge') { farge = +b.getAttribute('data-i'); visk = false; }
    else if (h === 'visk') visk = !visk; else if (h === 'tykk') tykk = tykk === 2 ? 1 : 2;
    else if (h === 'angre') angre(); else if (h === 'tom') tom();
    oppdater();
  });
  document.addEventListener('keydown', function (e) {
    if (!flate.isConnected) return;
    if (e.target.closest && e.target.closest('input, textarea')) return;
    var k = e.key;
    if ((k === 'z' || k === 'Z') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); angre(); return; }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (k === 'p' || k === 'P') penn();
    else if (k === 'b' || k === 'B') visTavle();
    else if ((k === 'e' || k === 'E') && aktiv) { visk = !visk; oppdater(); }
    else if ((k === 'z' || k === 'Z') && aktiv) angre();
    else if (k === 'Delete' && aktiv) { e.preventDefault(); tom(); }
    else if (/^[1-5]$/.test(k) && aktiv) { farge = +k - 1; visk = false; oppdater(); }
    else if (k === 'Escape' && (aktiv || tavleVis)) { tavleVis = false; penn(false); tegnAlt(); }
  });
  window.addEventListener('resize', function () { if (flate.isConnected) setTimeout(storrelse, 60); });
  document.addEventListener('fullscreenchange', function () { if (flate.isConnected) setTimeout(storrelse, 120); });
  document.addEventListener('webkitfullscreenchange', function () { if (flate.isConnected) setTimeout(storrelse, 120); });
  storrelse(); oppdater();

  return {
    verktoy: verktoy,
    penn: penn, tavle: visTavle,
    erAktiv: function () { return aktiv; },
    // Viser de samme tegningene (skrivebeskyttet) på en annen flate, f.eks. sliden i vinduet på projektoren.
    speil: settSpeil,
    // Kalles når sliden byttes: viser tegningene som hører til sliden (tavla lukkes)
    slide: function (k) { noekkel = String(k); tavleVis = false; oppdater(); storrelse(); }
  };
};

// iPad/iPhone: Safari viser en advarsel («Det ser ut som du skriver i fullskjermmodus») når man skriver med Pencil i ekte
// fullskjerm. Der bruker vi i stedet en «fast» visning som dekker hele vinduet.
window.Tavlepenn.ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
