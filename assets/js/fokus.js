// Fokusvisning av et fag (studie/fokus.html#<fag-id>).
// Lærestoffet vises i hovedvinduet (en iframe), og to uttrekkskort ligger alltid klare:
//   - Tidslinjen (venstre): uke for uke med moduler, undertemaer, arbeidskrav og frister. Kommer frem når du holder
//     musen over fanen eller trykker på den, og kan festes. Den ruller for seg selv uten å flytte hovedvinduet.
//   - Arbeidskravet (høyre): studieappen i et eget vindu, så du kan lese og se video mens du svarer.
// «Forrige» og «Neste» går gjennom faget i rekkefølge (undertemaer og arbeidskrav).
(function vent(n) {
  if (!window.fhKonto && (n || 0) < 100) return setTimeout(function () { vent((n || 0) + 1); }, 50);
  fokusStart();
})();

function fokusStart() {
  'use strict';
  var rot = document.getElementById('fokus');
  if (!rot) return;
  var NETTSTED = ((document.querySelector('meta[name="nettsted-navn"]') || {}).content || 'fysikkhjelp.no').replace(/\.no$/, '');
  var kursId = decodeURIComponent((location.hash || '').slice(1));
  var MODFARGE = ['var(--bs-primary)', 'var(--bs-info)', '#eee462', 'var(--bs-warning)', '#c792ea', '#ff8a8f'];
  var K = {}, FINNES = null, kurs = null, krav = [], quizer = [], rekke = [], her = -1, aktivKrav = null, k = null, bruker = null;
  document.documentElement.classList.add('fk-aktiv');

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function dato(d) { return new Date(d).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' }); }
  function lagre(v) { try { sessionStorage.setItem('fokus-' + kursId, String(v)); } catch (e) {} }
  function hent() { try { return sessionStorage.getItem('fokus-' + kursId); } catch (e) { return null; } }
  function utUrl(id) {
    var p = id.split('/'), kt = K[p[1]]; if (!kt) return null;
    var sti = '/tema/' + kt.omrade + '/' + p[1] + '/' + p[2] + '.html';
    return FINNES && !FINNES[sti] ? null : sti;
  }
  function utNavn(id) { var p = id.split('/'), kt = K[p[1]]; return (kt && kt.undertemaer[p[2]]) || p[2]; }
  function kravIder(o) { if ((o.undertemaer || []).length) return o.undertemaer; var t = (o.tema || '').split('/')[1]; return K[t] ? Object.keys(K[t].undertemaer).map(function (u) { return o.tema + '/' + u; }) : []; }
  function godkjent(o) { return quizer.some(function (q) { return q.ovelse === o.id && q.riktige >= o.krav && (!o.frist || Date.parse(q.fullfort) <= Date.parse(o.frist)); }); }

  // Rekkefølgen i faget: undertemaene uke for uke, og hvert arbeidskrav rett etter det siste undertemaet det dekker.
  function lagRekke() {
    var r = [], nr = 0;
    (kurs.moduler || []).forEach(function (m, mi) {
      m.uker.forEach(function (w, wi) {
        nr++;
        w.undertemaer.forEach(function (id) { r.push({ type: 'ut', id: id, tittel: utNavn(id), url: utUrl(id), uke: nr, mi: mi, wi: wi }); });
      });
    });
    krav.forEach(function (o) {
      var ids = kravIder(o), sist = -1;
      r.forEach(function (x, i) { if (x.type === 'ut' && ids.indexOf(x.id) >= 0) sist = i; });
      var el = { type: 'krav', o: o, tittel: o.tittel, uke: sist >= 0 ? r[sist].uke : null };
      if (sist >= 0) r.splice(sist + 1, 0, el); else r.push(el);
    });
    return r;
  }

  function skjelett() {
    rot.innerHTML =
      '<div class="fk-topp"><a class="fk-ut" href="index.html" title="Avslutt fokusvisning">✕</a><b class="fk-fag"></b><span class="fk-her"></span>' +
      '<button type="button" class="fk-knapp" data-h="tid">☰ Tidslinje</button><button type="button" class="fk-knapp" data-h="kravkort">📝 Arbeidskrav</button></div>' +
      '<iframe class="fk-hoved" title="Lærestoff"></iframe>' +
      '<div class="fk-bunn"><button type="button" class="fk-knapp" data-h="forrige">← Forrige</button><span class="fk-pos"></span><button type="button" class="fk-knapp" data-h="neste">Neste →</button></div>' +
      '<aside class="fk-skuff fk-tid" aria-label="Tidslinje"><button type="button" class="fk-fane" data-h="tid">Tidslinje</button><div class="fk-panel"><div class="fk-panelhode"><b>Tidslinje</b><button type="button" class="fk-knapp liten" data-h="festTid" title="Fest tidslinjen">📌</button></div><div class="fk-rull"></div></div></aside>' +
      '<aside class="fk-skuff fk-krav" aria-label="Arbeidskrav"><button type="button" class="fk-fane" data-h="kravkort">Arbeidskrav</button><div class="fk-panel"><div class="fk-panelhode"><b class="fk-kravtittel">Arbeidskrav</b><button type="button" class="fk-knapp liten" data-h="lukkKrav" title="Skjul">✕</button></div><div class="fk-kravinn"><p class="fk-tom">Velg et arbeidskrav i tidslinjen.</p></div></div></aside>';
    var tid = rot.querySelector('.fk-tid');
    // Kommer frem når musen er over fanen, og forsvinner når den går ut (med mindre tidslinjen er festet).
    tid.addEventListener('mouseenter', function () { tid.classList.add('apen'); });
    tid.addEventListener('mouseleave', function () { if (!tid.classList.contains('festet')) tid.classList.remove('apen'); });
    rot.querySelector('.fk-hoved').addEventListener('load', etterLasting);
  }

  function isoUke(d) { var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())), dag = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - dag); var a = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - a) / 864e5 + 1) / 7); }
  // Beskjeder står i uka de ble gitt (ut fra datoen). Uten dato eller første kalenderuke: først i modulen.
  function beskjeder() {
    var start = +((kurs.ramme || {}).startuke) || 0, totalt = (kurs.moduler || []).reduce(function (a, m) { return a + m.uker.length; }, 0), l = [];
    (kurs.moduler || []).forEach(function (m, mi) {
      var gml = (m.beskjed || '').trim() ? [{ tekst: m.beskjed, tid: '' }] : [];
      (m.beskjeder || []).concat(gml).forEach(function (b) { var w = null; if (b.tid && start) { w = isoUke(new Date(b.tid)) - start + 1; if (w < -26) w += 52; w = Math.max(1, Math.min(totalt, w)); } l.push({ m: m, mi: mi, b: b, uke: w }); });
    });
    return l.sort(function (a, b) { return (a.b.tid || '').localeCompare(b.b.tid || ''); });
  }
  function beskHtml(x) { return '<div class="fk-besk">📣 ' + (x.b.tid ? '<span>' + dato(x.b.tid) + ' · ' + esc(x.m.navn) + ':</span> ' : '') + esc(x.b.tekst) + '</div>'; }
  function tidslinje() {
    var html = '', forrigeUke = null, forrigeMod = null, besk = beskjeder();
    rekke.forEach(function (x, i) {
      if (x.type === 'ut') {
        var m = kurs.moduler[x.mi];
        if (x.mi !== forrigeMod) {
          forrigeMod = x.mi;
          html += '<div class="fk-mod" style="color:' + MODFARGE[x.mi % MODFARGE.length] + '">Modul ' + (x.mi + 1) + ': ' + esc(m.navn) + '</div>' +
            besk.filter(function (y) { return y.uke === null && y.mi === x.mi; }).map(beskHtml).join('');
        }
        if (x.uke !== forrigeUke) { forrigeUke = x.uke; html += '<div class="fk-uke">Uke ' + x.uke + '</div>' + besk.filter(function (y) { return y.uke === x.uke; }).map(beskHtml).join(''); }
      }
      var kl = 'fk-punkt' + (i === her ? ' her' : '') + (x.type === 'krav' ? ' krav' + (godkjent(x.o) ? ' ok' : '') : '') + (x.type === 'ut' && !x.url ? ' mangler' : '');
      html += '<button type="button" class="' + kl + '" data-h="ga" data-i="' + i + '">' +
        (x.type === 'krav' ? '<span class="fk-flagg">' + (godkjent(x.o) ? '✓' : '🚩') + '</span><span><b>Arbeidskrav: ' + esc(x.tittel) + '</b><br><span class="fk-frist">' + (x.o.frist ? 'frist ' + dato(x.o.frist) : 'ingen frist') + (godkjent(x.o) ? ' · godkjent' : '') + '</span></span>' : esc(x.tittel) + (x.url ? '' : ' <span class="fk-sm">(kommer)</span>')) + '</button>';
    });
    rot.querySelector('.fk-rull').innerHTML = html || '<p class="fk-tom">Faget har ingen moduler ennå.</p>';
    var aktiv = rot.querySelector('.fk-punkt.her'); if (aktiv) aktiv.scrollIntoView({ block: 'nearest' });
  }
  function oppdater() {
    var x = rekke[her];
    rot.querySelector('.fk-her').textContent = x ? x.tittel : '';
    rot.querySelector('.fk-pos').textContent = rekke.length ? (her + 1) + ' av ' + rekke.length : '';
    rot.querySelector('[data-h=forrige]').disabled = her <= 0;
    rot.querySelector('[data-h=neste]').disabled = her >= rekke.length - 1;
    tidslinje();
  }
  function ga(i) {
    var x = rekke[i]; if (!x) return;
    her = i; lagre(i);
    if (x.type === 'krav') { apneKrav(x.o); oppdater(); return; }
    var ramme = rot.querySelector('.fk-hoved');
    if (x.url) ramme.src = '..' + x.url;
    else ramme.srcdoc = '<!DOCTYPE html><html lang="nb"><body style="font:18px system-ui,sans-serif;padding:2rem;color:#ccc;background:#111"><h2>' + esc(x.tittel) + '</h2><p>Lærestoffet til dette undertemaet kommer. Gå videre med «Neste», eller øv på temaet i studieappen.</p></body></html>';
    oppdater();
  }
  // Navigerer du selv inne i lærestoffet, finner vi siden i rekka hvis den er der.
  function etterLasting() {
    var ramme = rot.querySelector('.fk-hoved'), sti = '';
    try { sti = ramme.contentWindow.location.pathname; } catch (e) { return; }
    if (!sti || sti === 'srcdoc' || sti === 'blank') return;
    var i = rekke.findIndex(function (x) { return x.url && sti.slice(-x.url.length) === x.url; });
    if (i >= 0 && i !== her) { her = i; lagre(i); oppdater(); }
  }
  function apneKrav(o) {
    var skuff = rot.querySelector('.fk-krav');
    skuff.classList.add('apen'); document.documentElement.classList.add('fk-delt');
    if (aktivKrav !== o.id) {
      aktivKrav = o.id;
      rot.querySelector('.fk-kravtittel').textContent = o.tittel;
      rot.querySelector('.fk-kravinn').innerHTML = '<iframe class="fk-kravramme" title="Arbeidskrav: ' + esc(o.tittel) + '" src="index.html#ovelse-' + encodeURIComponent(o.id) + '"></iframe>';
    }
  }

  rot.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-h]'); if (!b || b.disabled) return;
    var h = b.dataset.h, tid = rot.querySelector('.fk-tid'), kk = rot.querySelector('.fk-krav');
    if (h === 'tid') tid.classList.toggle('apen');
    else if (h === 'festTid') { tid.classList.toggle('festet'); tid.classList.add('apen'); document.documentElement.classList.toggle('fk-tidfast', tid.classList.contains('festet')); }
    else if (h === 'kravkort') {
      var apen = kk.classList.toggle('apen'); document.documentElement.classList.toggle('fk-delt', apen);
      if (apen && !aktivKrav) { var ny = rekke.find(function (x) { return x.type === 'krav' && !godkjent(x.o); }); if (ny) apneKrav(ny.o); }
    }
    else if (h === 'lukkKrav') { kk.classList.remove('apen'); document.documentElement.classList.remove('fk-delt'); }
    else if (h === 'ga') { ga(+b.dataset.i); if (!tid.classList.contains('festet')) tid.classList.remove('apen'); }
    else if (h === 'forrige') ga(her - 1);
    else if (h === 'neste') ga(her + 1);
  });
  // Arbeidskravet sier fra når en quiz er levert, så tidslinjen kan vise godkjent.
  window.addEventListener('message', function (ev) {
    if (ev.origin !== location.origin || !ev.data || ev.data.type !== 'fh-quiz') return;
    hentQuizer().then(tidslinje);
  });
  function hentQuizer() { return k.from('studie_quiz').select('ovelse, riktige, fullfort').eq('eier', bruker.id).then(function (r) { quizer = (r && r.data) || []; }); }

  skjelett();
  Promise.all([
    fetch('sporsmal.json').then(function (r) { return r.json(); }),
    fetch('../loyper.json').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
    window.fhKonto(),
  ]).then(function (r) {
    K = r[0].katalog || r[0].struktur;
    if (r[1] && r[1].sider) { FINNES = {}; Object.keys(r[1].sider).forEach(function (s) { var u = r[1].sider[s].undertemaUrl; if (u) FINNES[u] = true; }); }
    k = r[2];
    return k.auth.getSession();
  }).then(function (s) {
    var sesjon = s && s.data && s.data.session;
    if (!sesjon) throw new Error('Logg inn for å bruke fokusvisningen.');
    bruker = sesjon.user;
    if (!kursId) throw new Error('Velg et fag under «Fag» i studieappen og trykk «Fokusvisning».');
    return Promise.all([k.from('kurs').select('id, navn, moduler, ramme, elementer').eq('id', kursId).maybeSingle(), k.from('ovelser').select('*').eq('kurs', kursId), hentQuizer()]);
  }).then(function (r) {
    kurs = r[0] && r[0].data; if (!kurs) throw new Error('Fant ikke faget. Er du påmeldt?');
    krav = ((r[1] && r[1].data) || []).filter(function () { return (kurs.elementer || {}).arbeidskrav !== false; });
    rot.querySelector('.fk-fag').textContent = kurs.navn;
    document.title = kurs.navn + ' – fokus';
    rekke = lagRekke();
    var start = parseInt(hent(), 10); if (!(start >= 0 && start < rekke.length)) start = rekke.findIndex(function (x) { return x.type === 'ut'; });
    if (start < 0) start = 0;
    var x = rekke[start];
    if (x && x.type === 'krav') { her = start; apneKrav(x.o); oppdater(); var forste = rekke.findIndex(function (y) { return y.type === 'ut'; }); if (forste >= 0) rot.querySelector('.fk-hoved').src = rekke[forste].url ? '..' + rekke[forste].url : 'about:blank'; }
    else if (x) ga(start); else oppdater();
    if (!rekke.length) rot.querySelector('.fk-tid').classList.add('apen');
  }).catch(function (e) {
    rot.innerHTML = '<div class="fk-feil"><p>' + esc(e && e.message || e) + '</p><p><a href="index.html">Til studieappen</a></p></div>';
  });
  window.__fokus = { get rekke() { return rekke; }, get her() { return her; } };
}
