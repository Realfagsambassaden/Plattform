// Tavlepenn: tegn på slidene i forelesningsmodusen (assets/js/forelesning.js).
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
                   : [['Hvit', '#ecefe6'], ['Grønn', '#6ef04a'], ['Gul', '#eee462'], ['Oransje', '#f19c2c'], ['Turkis', '#56d7b8']];
  var lerret = document.createElement('canvas'); lerret.className = 'tp-lerret';
  var tavle = document.createElement('div'); tavle.className = 'tp-tavle'; tavle.hidden = true;
  tavle.innerHTML = '<span class="tp-tavlenavn">Tavle</span>';
  flate.appendChild(tavle); flate.appendChild(lerret);
  var ctx = lerret.getContext('2d');

  var verktoy = document.createElement('div'); verktoy.className = 'tp-verktoy'; verktoy.hidden = true;
  verktoy.innerHTML = FARGER.map(function (f, i) { return '<button type="button" class="tp-farge" data-tp="farge" data-i="' + i + '" style="--f:' + f[1] + '" aria-label="' + f[0] + ' (' + (i + 1) + ')" title="' + f[0] + ' (' + (i + 1) + ')"></button>'; }).join('') +
    '<button type="button" data-tp="tykk" title="Tykkelse">●</button>' +
    '<button type="button" data-tp="visk" title="Viskelær (E)">Visk</button>' +
    '<button type="button" data-tp="angre" title="Angre (Z)">↶</button>' +
    '<button type="button" data-tp="tom" title="Tøm sliden (Delete)">Tøm</button>';

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
  function bredde(s, p) { return (s.v ? 30 : (s.t === 2 ? 9 : 4.2)) * (0.45 + 1.1 * p) * Math.min(B, H) / 800; }
  function strek(s, fra) {
    var p = s.p; if (!p.length) return;
    ctx.save(); ctx.scale(dpr, dpr);
    ctx.globalCompositeOperation = s.v ? 'destination-out' : 'source-over';
    ctx.strokeStyle = s.v ? '#000' : FARGER[s.f][1]; ctx.fillStyle = ctx.strokeStyle; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (p.length === 1) { ctx.beginPath(); ctx.arc(p[0][0] * B, p[0][1] * H, bredde(s, p[0][2]) / 2, 0, 7); ctx.fill(); ctx.restore(); return; }
    for (var i = Math.max(1, fra || 1); i < p.length; i++) {   // korte biter med trykkets tykkelse; myk kurve gjennom midtpunktene
      var a = p[i - 1], b = p[i], c = p[i - 2] || a;
      ctx.lineWidth = bredde(s, (a[2] + b[2]) / 2);
      ctx.beginPath();
      ctx.moveTo((c[0] + a[0]) / 2 * B, (c[1] + a[1]) / 2 * H);
      ctx.quadraticCurveTo(a[0] * B, a[1] * H, (a[0] + b[0]) / 2 * B, (a[1] + b[1]) / 2 * H);
      ctx.stroke();
    }
    ctx.restore();
  }
  function tegnAlt() { ctx.clearRect(0, 0, lerret.width, lerret.height); streker().forEach(function (s) { strek(s); }); }

  // ---- penn og finger. Har pennen vært brukt, tegner ikke fingeren (håndflaten på iPad).
  var naa = null, pennBrukt = false;
  function punkt(e) { var r = lerret.getBoundingClientRect(); return [(e.clientX - r.left) / B, (e.clientY - r.top) / H, e.pointerType === 'pen' ? (e.pressure || .5) : .5]; }
  lerret.addEventListener('pointerdown', function (e) {
    if (!aktiv) return;
    if (e.pointerType === 'pen') pennBrukt = true;
    if (e.pointerType === 'touch' && pennBrukt) return;
    if (e.button === 2) return;
    e.preventDefault(); try { lerret.setPointerCapture(e.pointerId); } catch (x) {}
    naa = { f: farge, t: tykk, v: visk || e.button === 5 || (e.buttons & 32) ? 1 : 0, p: [punkt(e)], id: e.pointerId };
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
    verktoy.querySelector('[data-tp="visk"]').classList.toggle('valgt', visk);
    verktoy.querySelector('[data-tp="tykk"]').textContent = tykk === 2 ? '⬤' : '●';
    tavle.hidden = !tavleVis; flate.classList.toggle('tp-tavlemodus', tavleVis);
  }
  function penn(paa) { aktiv = paa == null ? !aktiv : paa; if (!aktiv) visk = false; oppdater(); }
  function angre() { var s = streker(); s.pop(); tegnAlt(); lagre(); }
  function tom() { var k = (tavleVis ? 'tavle:' : '') + noekkel; tegninger[k] = []; tegnAlt(); lagre(); }
  function visTavle(paa) { tavleVis = paa == null ? !tavleVis : paa; if (tavleVis) aktiv = true; oppdater(); tegnAlt(); }
  verktoy.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return; var h = b.getAttribute('data-tp');
    if (h === 'farge') { farge = +b.getAttribute('data-i'); visk = false; }
    else if (h === 'visk') visk = !visk; else if (h === 'tykk') tykk = tykk === 2 ? 1 : 2;
    else if (h === 'angre') angre(); else if (h === 'tom') tom();
    oppdater();
  });
  document.addEventListener('keydown', function (e) {
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
  window.addEventListener('resize', function () { setTimeout(storrelse, 60); });
  document.addEventListener('fullscreenchange', function () { setTimeout(storrelse, 120); });
  storrelse(); oppdater();

  return {
    verktoy: verktoy,
    penn: penn, tavle: visTavle,
    // Kalles når sliden byttes: viser tegningene som hører til sliden (tavla lukkes)
    slide: function (k) { noekkel = String(k); tavleVis = false; oppdater(); storrelse(); }
  };
};
