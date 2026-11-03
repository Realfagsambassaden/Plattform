// Formler i krittstil ute i kantene på innholdssidene. Ti bakgrunner per nettsted;
// hver side får alltid den samme (valgt ut fra adressen), så det skifter når man går fra side til side.
(function () {
  if (document.querySelector('.hero')) return;               // forsiden har sin egen tavle
  var m = document.querySelector('meta[name="bakgrunn-sett"]');
  var sett = m ? m.content : 'fysikk';
  var s = document.querySelector('script[src*="site_libs/"]');
  var root = s ? s.getAttribute('src').split('site_libs/')[0] : '';
  var sti = location.pathname.replace(/index\.html$/, ''), h = 0;
  for (var i = 0; i < sti.length; i++) h = (h * 31 + sti.charCodeAt(i)) >>> 0;
  var n = ('0' + (h % 10 + 1)).slice(-2);
  var d = document.createElement('div');
  d.className = 'tavle-kant'; d.setAttribute('aria-hidden', 'true');
  d.style.backgroundImage = 'url("' + root + 'assets/img/bakgrunner/' + sett + '-' + n + '.webp")';
  document.body.insertBefore(d, document.body.firstChild);
})();
