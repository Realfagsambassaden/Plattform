// Profilkortene som samlekort: hele kortet vippes etter musa (eller fingeren), og en holografisk glans følger med.
// Uten JavaScript (eller med redusert bevegelse) vippes kortet litt med CSS i stedet.
(function () {
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelectorAll('.samlekort .sk-inni').forEach(function (k) {
    function flytt(x, y) {
      var r = k.getBoundingClientRect(), px = (x - r.left) / r.width, py = (y - r.top) / r.height;
      k.style.setProperty('--ry', ((px - .5) * 22).toFixed(1) + 'deg');
      k.style.setProperty('--rx', ((.5 - py) * 18).toFixed(1) + 'deg');
      k.style.setProperty('--mx', (px * 100).toFixed(0) + '%');
      k.style.setProperty('--my', (py * 100).toFixed(0) + '%');
      k.classList.add('vipper');
    }
    function slipp() { k.classList.remove('vipper'); ['--rx', '--ry', '--mx', '--my'].forEach(function (v) { k.style.removeProperty(v); }); }
    k.addEventListener('pointermove', function (e) { flytt(e.clientX, e.clientY); });
    k.addEventListener('pointerleave', slipp);
  });
})();
