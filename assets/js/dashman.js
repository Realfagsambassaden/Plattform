// Dashman – KI-læringspartneren. Vises nede til venstre for innloggede studenter på alle sider.
// Samtalen går via KI-tjeneren (/dashman), som henter nivå, mål, notat, kunnskapsprofil og fag selv fra Supabase.
// Samtalen lagres bare i denne fanen (sessionStorage) og forsvinner når fanen lukkes.
// Figuren er lærerens egen Dashman fra riggen i repoet Realfagsambassaden/dashman. Bildene i assets/img/dashman/ lages
// av verktoy/dashman_bilder.py: én positur per humør, fire munnformer til snakking, og blunk for den nøytrale.
(function () {
  try { if (window.self !== window.top) return; } catch (e) { return; }
  var skript = document.currentScript && document.currentScript.src || '';
  var BILDER = skript.replace(/js\/dashman\.js.*$/, 'img/dashman/');
  var URL_ = (document.querySelector('meta[name="supabase-url"]') || {}).content || '';
  var api = ((document.querySelector('meta[name="fysikkhjelp-hint-api"]') || {}).content || '').replace(/\/hint\/?$/, '/dashman');
  if (!URL_ || !api || !window.fhKonto) return;
  var lagringsnavn = 'sb-' + URL_.split('//')[1].split('.')[0] + '-auth-token';
  // Innlogget: Supabase-økta ligger i localStorage. Sjekk både det forventede navnet og alle «sb-…-auth-token»,
  // så knappen ikke forsvinner hvis navnet skulle avvike (f.eks. i appen på hjemskjermen).
  function innlogget() {
    try { if (lagringsnavn && localStorage.getItem(lagringsnavn)) return true;
      for (var i = 0; i < localStorage.length; i++) if (/^sb-.+-auth-token$/.test(localStorage.key(i) || '')) return true;
      return false; } catch (e) { return false; }
  }

  // ------------------------------------------------------------ figuren (lærerens Dashman-rigg)
  var POSITUR = { noytral: 'noytral', glad: 'glad', ler: 'ler', irritert: 'irritert', trist: 'trist', tenker: 'tenker' };
  var MUNNER = ['snakk_lukket', 'snakk_o', 'snakk_aapen', 'snakk_smil_tenner'];
  var ALLE = ['noytral', 'noytral_blunk', 'glad', 'ler', 'ler_a', 'ler_b', 'irritert', 'trist', 'tenker'].concat(MUNNER);
  var lastet = false;
  function forhandslast() { if (lastet) return; lastet = true; ALLE.forEach(function (n) { new Image().src = BILDER + n + '.webp'; }); }
  function figurImg(navn) { return '<img class="dm-bilde" alt="" src="' + BILDER + navn + '.webp">'; }

  // ------------------------------------------------------------ tilstand
  var LAGER = 'dashman-samtale';
  var samtale = []; try { samtale = JSON.parse(sessionStorage.getItem(LAGER) || '[]'); } catch (e) {}
  function lagre() { try { sessionStorage.setItem(LAGER, JSON.stringify(samtale.slice(-40))); } catch (e) {} }
  var humor = 'noytral', opptatt = false, profil = null;
  var oppgave = null; try { oppgave = JSON.parse(sessionStorage.getItem('dashman-oppgave') || 'null'); } catch (e) {}
  // Eksamensmodus (hint-tjener/eksamen.js): { pa, opp: oppgaven nå, svar: resultatet når den er besvart, diskuter: {eid,nr} }
  var EKS = 'dashman-eksamen', eks = { pa: false };
  try { eks = JSON.parse(sessionStorage.getItem(EKS) || 'null') || { pa: false }; } catch (e) {}
  function lagreEks() { try { sessionStorage.setItem(EKS, JSON.stringify(eks)); } catch (e) {} }
  var eksApi = api.replace(/\/dashman$/, '/eksamen');
  function lagreOppgave() { try { if (oppgave) sessionStorage.setItem('dashman-oppgave', JSON.stringify(oppgave)); else sessionStorage.removeItem('dashman-oppgave'); } catch (e) {} }

  // ------------------------------------------------------------ DOM
  var knapp = document.createElement('button');
  knapp.type = 'button'; knapp.className = 'dm-knapp'; knapp.setAttribute('aria-label', 'Snakk med Dashman');
  knapp.innerHTML = '<img class="dm-ikon" alt="" src="' + BILDER + 'ikon.webp"><span>Spør Dashman</span>';
  var panel = document.createElement('section');
  panel.className = 'dm-panel'; panel.hidden = true; panel.setAttribute('aria-label', 'Samtale med Dashman');
  panel.innerHTML =
    '<div class="dm-scene"><div class="dm-holder"></div></div>' +
    '<div class="dm-boble">' +
      // Krittstrek rundt boblen: hale mot venstre (bred skjerm) eller opp mot Dashman (smal skjerm)
      '<svg class="dm-kontur bred" viewBox="0 0 600 300" preserveAspectRatio="none" aria-hidden="true">' +
        '<path d="M70 14 C 200 2, 420 6, 548 18 C 596 26, 598 92, 594 160 C 590 236, 570 284, 470 288 C 340 296, 180 294, 92 284 C 60 280, 44 262, 40 236 L 2 252 L 30 204 C 18 150, 14 80, 24 46 C 32 22, 48 16, 70 14 Z"/>' +
        '<path class="dm-kontur-2" d="M74 20 C 210 9, 410 12, 544 24 C 588 34, 590 96, 588 160 C 584 230, 566 278, 470 282"/></svg>' +
      '<svg class="dm-kontur smal" viewBox="0 0 600 300" preserveAspectRatio="none" aria-hidden="true">' +
        '<path d="M40 30 L 52 2 L 96 22 C 220 10, 430 8, 552 20 C 596 28, 598 92, 594 160 C 590 236, 570 284, 470 288 C 340 296, 180 294, 92 284 C 40 278, 20 250, 16 200 C 10 140, 8 70, 40 30 Z"/>' +
        '<path class="dm-kontur-2" d="M100 28 C 222 16, 428 14, 548 26 C 588 36, 590 96, 588 160"/></svg>' +
      '<div class="dm-topp"><b>Dashman</b><label class="dm-bryter" title="Eksamensmodus: Dashman gir deg tidligere eksamensoppgaver. Du løser dem selv, og får tilbakemelding og forklaring etter at du har svart."><input type="checkbox" class="dm-eksamen"><span class="dm-spor" aria-hidden="true"></span><span>Eksamensmodus</span></label><span class="dm-verktoy">' +
        '<button type="button" data-h="husker" title="Hva Dashman husker om deg">Hva husker du?</button>' +
        '<button type="button" data-h="ny" title="Start en ny samtale">Ny samtale</button>' +
        '<button type="button" data-h="lukk" aria-label="Lukk">×</button></span></div>' +
      '<div class="dm-logg" aria-live="polite"></div>' +
      '<div class="dm-vedlegg" hidden><img alt="Bildet du legger ved"><button type="button" data-h="fjernbilde" aria-label="Fjern bildet">×</button></div>' +
      '<form class="dm-skriv"><label class="dm-kamera" title="Ta bilde av løsningen din, så ser Dashman på den"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg><span class="dm-skjult">Ta bilde av løsningen din</span><input type="file" accept="image/*" capture="environment"></label><textarea rows="2" maxlength="2000" placeholder="Hva lurer du på? Fortell gjerne hvor du står fast." aria-label="Melding til Dashman"></textarea>' +
      '<button type="submit">Send</button></form>' +
      '<p class="dm-info">Dashman er en KI-veileder. Han gir hint, ikke fasit. Samtalen lagres ikke. Sjekk viktige ting med faglæreren din.</p>' +
    '</div>';
  document.body.appendChild(knapp); document.body.appendChild(panel);
  // Knappen vises bare for innloggede. Sjekkes på nytt når siden vises igjen (tilbake-knappen, appen hentes fram)
  // og når innloggingen endres i en annen fane, så Dashman dukker opp straks studenten har logget inn.
  function synlig() {
    var inn = innlogget();
    if (!inn) panel.hidden = true;
    knapp.hidden = !inn || !panel.hidden;
  }
  synlig();
  window.addEventListener('pageshow', synlig); window.addEventListener('focus', synlig); window.addEventListener('storage', synlig);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) synlig(); });
  document.addEventListener('fh-innlogget', synlig);
  var logg = panel.querySelector('.dm-logg'), holder = panel.querySelector('.dm-holder'), felt = panel.querySelector('textarea');
  // Krittstreken rundt boblen tegnes etter boblens faktiske størrelse (i piksler), så hjørnene alltid er små og runde.
  // (Med en fast form som ble strukket, trakk hjørnet øverst til høyre seg langt inn når boblen var høy, og
  // knappene i toppen havnet utenfor streken.) «bred»: hale mot venstre nede; «smal»: hale opp mot Dashman.
  var boble = panel.querySelector('.dm-boble');
  function tegnKontur() {
    var w = boble.clientWidth, h = boble.clientHeight; if (!w || !h) return;
    var r = 28, f = function (n) { return Math.round(n * 10) / 10; };
    function sti(smal) {
      var L = smal ? 12 : 30, T = smal ? 22 : 8, R = w - 4, B = h - 5;
      var topp = 'C ' + f(w * .4) + ' ' + (T - 5) + ', ' + f(w * .72) + ' ' + (T - 1) + ', ' + f(R - r) + ' ' + (T + 3) + ' C ' + f(R - 6) + ' ' + (T + 6) + ', ' + R + ' ' + (T + 14) + ', ' + R + ' ' + (T + r + 4);
      var hoyre = ' C ' + (R + 3) + ' ' + f(h * .45) + ', ' + (R + 2) + ' ' + f(h * .72) + ', ' + (R - 2) + ' ' + f(B - r) + ' C ' + (R - 4) + ' ' + (B - 8) + ', ' + (R - 14) + ' ' + B + ', ' + f(R - r - 6) + ' ' + B;
      var bunn = ' C ' + f(w * .62) + ' ' + (B + 5) + ', ' + f(w * .3) + ' ' + (B + 3) + ', ' + f(L + r + 14) + ' ' + (B - 2);
      if (smal) return 'M ' + (L + 4) + ' ' + (T + 10) + ' L ' + (L + 18) + ' 2 L ' + (L + 52) + ' ' + T + ' ' + topp + hoyre + bunn +
        ' C ' + (L + 6) + ' ' + (B - 4) + ', ' + L + ' ' + (B - 22) + ', ' + (L - 2) + ' ' + f(B - r - 10) + ' C ' + (L - 6) + ' ' + f(h * .6) + ', ' + (L - 6) + ' ' + f(h * .3) + ', ' + (L + 4) + ' ' + (T + 10) + ' Z';
      return 'M ' + (L + r) + ' ' + T + ' ' + topp + hoyre + bunn +
        ' C ' + (L + 8) + ' ' + (B - 4) + ', ' + (L + 4) + ' ' + (B - 22) + ', ' + (L + 2) + ' ' + (B - 46) + ' L 2 ' + (B - 30) + ' L ' + L + ' ' + (B - 78) +
        ' C ' + (L - 8) + ' ' + f(h * .55) + ', ' + (L - 9) + ' ' + f(h * .25) + ', ' + (L - 3) + ' ' + (T + r) + ' C ' + L + ' ' + (T + 10) + ', ' + (L + 10) + ' ' + (T + 2) + ', ' + (L + r) + ' ' + T + ' Z';
    }
    panel.querySelectorAll('.dm-kontur').forEach(function (svg) {
      var smal = svg.classList.contains('smal'), L = smal ? 12 : 30, T = smal ? 22 : 8;
      svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      var p = svg.querySelectorAll('path');
      p[0].setAttribute('d', sti(smal));
      if (p[1]) p[1].setAttribute('d', 'M ' + (L + r + 6) + ' ' + (T + 6) + ' C ' + f(w * .4) + ' ' + T + ', ' + f(w * .72) + ' ' + (T + 4) + ', ' + f(w - r - 12) + ' ' + (T + 9) + ' C ' + (w - 14) + ' ' + (T + 13) + ', ' + (w - 11) + ' ' + (T + 24) + ', ' + (w - 11) + ' ' + f(h * .5));
    });
  }
  if (window.ResizeObserver) new ResizeObserver(tegnKontur).observe(boble); else window.addEventListener('resize', tegnKontur);
  // Mobil: Dashman skal alltid få plass på den delen av skjermen som faktisk synes (også når tastaturet er oppe
  // eller adresselinja i Safari tar plass), så × øverst alltid kan nås. visualViewport gir den synlige høyden.
  function tilpassHoyde() {
    var vv = window.visualViewport;
    if (!vv || window.innerWidth > 700 || panel.hidden) { panel.style.removeProperty('--dm-vh'); panel.style.removeProperty('bottom'); panel.classList.remove('dm-tastatur'); return; }
    panel.style.setProperty('--dm-vh', Math.round(vv.height) + 'px');
    panel.style.bottom = Math.max(8, Math.round(window.innerHeight - vv.height - vv.offsetTop) + 8) + 'px';
    panel.classList.toggle('dm-tastatur', vv.height < window.innerHeight * .75);   // tastaturet er oppe: skjul figuren
  }
  if (window.visualViewport) { visualViewport.addEventListener('resize', tilpassHoyde); visualViewport.addEventListener('scroll', tilpassHoyde); }
  window.addEventListener('orientationchange', function () { setTimeout(tilpassHoyde, 300); });
  new MutationObserver(tilpassHoyde).observe(panel, { attributes: true, attributeFilter: ['hidden'] });

  var bilde = null, animTid = null, blunkTid = null;
  function vis(navn) {
    if (!bilde) { holder.innerHTML = figurImg(navn); bilde = holder.querySelector('img'); bilde.onload = storrelse; return; }
    bilde.src = BILDER + navn + '.webp';
  }
  function storrelse() { bilde.style.height = 'calc(' + Math.round(bilde.naturalHeight / 1.6) + 'px * var(--dm-skala, 1))'; }
  function settHumor(h) {
    humor = h; clearInterval(animTid); clearTimeout(blunkTid); holder.className = 'dm-holder dm-' + h;
    if (h === 'ler') {   // ler: hoho og hoho_x vekselvis, så en mildere latter
      var i = 0; vis('ler_a');
      animTid = setInterval(function () { i++; if (i > 6) { clearInterval(animTid); vis('ler'); } else vis(i % 2 ? 'ler_b' : 'ler_a'); }, 170);
      return;
    }
    vis(POSITUR[h] || 'noytral');
    if (h === 'noytral') blunk();
  }
  function blunk() {
    blunkTid = setTimeout(function () {
      if (humor !== 'noytral') return;
      vis('noytral_blunk'); setTimeout(function () { if (humor === 'noytral') vis('noytral'); blunk(); }, 140);
    }, 2500 + Math.random() * 3500);
  }
  // Snakker: peker mot boblen, og munnen går (tilfeldig munnform, sjelden to like etter hverandre).
  function snakk(paa) {
    clearInterval(animTid); clearTimeout(blunkTid);
    if (!paa) { settHumor(humor); return; }
    var forrige = 0;
    animTid = setInterval(function () { var k; do { k = Math.floor(Math.random() * MUNNER.length); } while (k === forrige && Math.random() < .7); forrige = k; vis(MUNNER[k]); }, 110);
  }

  // Enkel Markdown: avsnitt, fet, kursiv, kode, lister. LaTeX tas av MathJax etterpå.
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  // Formler ($…$ og $$…$$) tas ut først, så Markdown ikke ødelegger dem, og settes inn igjen som \(…\) og \[…\] for MathJax.
  // Figurer: Dashman skriver ```figur {JSON} ``` (se hint-tjener/dashman-instruks.md), tegnet av dashman-figur.js.
  var FIGUR_RE = /```\s*figur\s*\n?([\s\S]*?)```/g;
  function figurHtml(json) {
    try {
      if (!window.DashmanFigur) throw new Error('mangler tegneverktøyet');
      return '<div class="dm-figurboks">' + window.DashmanFigur.lag(json.trim()) + '</div>';
    } catch (e) { return '<p class="dm-figurfeil">(Dashman prøvde å tegne en figur, men den ble ikke riktig. Spør ham gjerne om å forklare den med ord.)</p>'; }
  }
  function md(s) {
    var formler = [], figurer = [];
    s = String(s).replace(FIGUR_RE, function (_, j) { figurer.push(figurHtml(j)); return '\n\n\u0002' + (figurer.length - 1) + '\u0002\n\n'; })
      .replace(/```\s*figur[\s\S]*$/, '\n\n\u0003\n\n');   // figur som ikke er ferdig skrevet ennå
    s = s.replace(/\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\$([^$\n]+?)\$|\\\(([\s\S]+?)\\\)/g, function (_, b1, b2, l1, l2) {
      var blokk = b1 != null ? b1 : b2, linje = l1 != null ? l1 : l2;
      formler.push(blokk != null ? '\\[' + blokk + '\\]' : '\\(' + linje + '\\)'); return '\u0000' + (formler.length - 1) + '\u0000';
    });
    return mdTekst(s.trim()).replace(/\u0000(\d+)\u0000/g, function (_, i) { return esc(formler[+i]); })
      .replace(/(?:<p>)?\u0002(\d+)\u0002(?:<\/p>)?/g, function (_, i) { return figurer[+i]; })
      .replace(/(?:<p>)?\u0003(?:<\/p>)?/g, '<p class="dm-figurventer">Tegner en figur …</p>');
  }
  function mdTekst(s) {
    return esc(s).split(/\n{2,}/).filter(function (a) { return a.trim(); }).map(function (avsnitt) {
      var l = avsnitt.split('\n');
      if (l.every(function (x) { return /^\s*([-*]|\d+\.)\s/.test(x); }))
        return '<ul>' + l.map(function (x) { return '<li>' + inline(x.replace(/^\s*([-*]|\d+\.)\s/, '')) + '</li>'; }).join('') + '</ul>';
      return '<p>' + inline(avsnitt).replace(/\n/g, '<br>') + '</p>';
    }).join('');
  }
  // Lenker: bare til sider på nettstedene våre (/… eller https://fysikkhjelp.no/…, matematikkhjelp.no, realfagsambassaden.no)
  function lenker(s) {
    return s.replace(/\[([^\]\n]+)\]\(((?:\/|https:\/\/(?:www\.)?(?:fysikkhjelp|matematikkhjelp|realfagsambassaden)\.no\/)[^)\s"<>]*)\)/g, function (_, t, u) { return '<a href="' + u + '">' + t + '</a>'; });
  }
  function inline(s) { return lenker(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>'); }
  // Formler: MathJax lastes bare av Quarto på sider som selv har formler. Mangler det, laster vi det her.
  var mjLofte = null;
  function mathjax() {
    if (mjLofte) return mjLofte;
    if (window.MathJax && (MathJax.startup || MathJax.typesetPromise))
      return (mjLofte = (MathJax.startup && MathJax.startup.promise) || Promise.resolve());
    window.MathJax = { tex: { inlineMath: [['\\(', '\\)']], displayMath: [['\\[', '\\]']] }, startup: { typeset: false } };
    return (mjLofte = new Promise(function (ok) {
      var s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml-full.js'; s.async = true;
      s.onload = function () { (MathJax.startup && MathJax.startup.promise || Promise.resolve()).then(ok, ok); }; s.onerror = ok;
      document.head.appendChild(s);
    }));
  }
  function matte(el) { mathjax().then(function () { if (window.MathJax && MathJax.typesetPromise) return MathJax.typesetPromise([el]); }).catch(function () {}); }

  function visMelding(m, animer) {
    var d = document.createElement('div');
    d.className = 'dm-m ' + (m.rolle === 'dashman' ? 'dm-fra' : 'dm-til');
    logg.appendChild(d);
    if (!animer || m.rolle !== 'dashman') { d.innerHTML = m.rolle === 'dashman' ? md(m.tekst) : '<p>' + esc(m.tekst).replace(/\n/g, '<br>') + '</p>'; matte(d); logg.scrollTop = logg.scrollHeight; return Promise.resolve(); }
    // Dashman «snakker»: teksten kommer fram ord for ord mens munnen går.
    // Ord for ord, men en hel figur regnes som ett «ord», så den dukker opp på én gang
    var ord = [], i = 0;
    m.tekst.split(/(```\s*figur[\s\S]*?```)/).forEach(function (del, k) { if (k % 2) ord.push(del); else ord = ord.concat(del.split(/(\s+)/)); });
    var raskt = matchMedia('(prefers-reduced-motion: reduce)').matches;
    return new Promise(function (ferdig) {
      if (raskt) { d.innerHTML = md(m.tekst); matte(d); logg.scrollTop = logg.scrollHeight; return ferdig(); }
      snakk(true);
      var t = setInterval(function () {
        i += 2; d.innerHTML = md(ord.slice(0, i).join('')); logg.scrollTop = logg.scrollHeight;
        if (i >= ord.length) { clearInterval(t); snakk(false); d.innerHTML = md(m.tekst); matte(d); logg.scrollTop = logg.scrollHeight; ferdig(); }
      }, 55);
    });
  }
  function visAlt() {
    logg.innerHTML = '';
    if (oppgave) {
      var o = document.createElement('div'); o.className = 'dm-oppgave';
      var ot = String(oppgave.oppgave || ''); if (oppgave.tittel && ot.indexOf(oppgave.tittel) === 0) ot = ot.slice(oppgave.tittel.length).trim();
      o.innerHTML = '<b>Oppgaven dere jobber med' + (oppgave.tittel ? ': ' + esc(oppgave.tittel) : '') + '</b><span>' + esc(ot.slice(0, 220)) + (ot.length > 220 ? ' …' : '') + '</span>';
      logg.appendChild(o);
    }
    if (!samtale.length && !oppgave) visMelding({ rolle: 'dashman', tekst: 'Hei! Jeg er Dashman. Jeg gir deg ikke fasiten, men jeg hjelper deg å finne den selv. Hva jobber du med?' });
    samtale.forEach(function (m) { visMelding(m); });
    visNivavalg();
    bryter.checked = !!eks.pa; panel.classList.toggle("dm-eksmodus", !!eks.pa);
    if (eks.pa) { if (eks.opp) visEksOppgave(); else nesteEks(); }
  }

  // ------------------------------------------------------------ eksamensmodus
  var bryter = panel.querySelector('.dm-eksamen');
  var BOKST = ['A', 'B', 'C', 'D', 'E', 'F'];
  function eksTemaer() { try { return window.fhEksamenTemaer ? window.fhEksamenTemaer() : JSON.parse(localStorage.getItem('fh-eksamen-temaer') || '[]'); } catch (e) { return []; } }
  function eksPost(sti, data) {
    return token().then(function (t) {
      if (!t) throw { melding: 'Du må logge inn på nytt.' };
      return fetch(eksApi + sti, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(data) });
    }).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw { melding: d.feil }; return d; }); });
  }
  function eksPa(pa) {
    eks.pa = pa; if (!pa) { if (eks.opp && eks.svar) eks.diskuter = { eid: eks.opp.eid, nr: eks.opp.nr }; eks.opp = null; eks.svar = null; }
    lagreEks(); bryter.checked = pa; panel.classList.toggle('dm-eksmodus', pa);
    var m = { rolle: 'dashman', tekst: pa
      ? '**Eksamensmodus er på.** Jeg gir deg oppgaver fra tidligere eksamener. Løs dem helt selv, uten hjelp. Velg svaret ditt (ta gjerne bilde av utregningen med kameraet først), så gir jeg deg tilbakemelding og forklarer etterpå. Slå av eksamensmodus når du vil diskutere.'
      : 'Eksamensmodus er av. Nå kan vi diskutere' + (eks.diskuter ? ' oppgaven du nettopp gjorde, eller' : '') + ' hva du vil.' };
    samtale.push(m); lagre(); visMelding(m);
    if (pa) nesteEks();
  }
  function nesteEks() {
    var vent = document.createElement('div'); vent.className = 'dm-m dm-fra dm-tenker'; vent.innerHTML = '<p><span></span><span></span><span></span></p>'; logg.appendChild(vent);
    eksPost('/neste', { temaer: eksTemaer(), hoppOver: eks.hoppOver || [] }).then(function (d) {
      vent.remove();
      if (d.ferdig || !d.oppgave) { visMelding({ rolle: 'dashman', tekst: 'Du har vært gjennom alle eksamensoppgavene jeg har i temaene dine. Sterkt! Slå av eksamensmodus for å se på kunnskapsprofilen, eller prøv igjen senere.' }); return; }
      eks.opp = d.oppgave; eks.svar = null; eks.start = Date.now(); lagreEks(); visEksOppgave();
    }).catch(function (e) { vent.remove(); settHumor('trist'); visMelding({ rolle: 'dashman', tekst: (e && e.melding) || 'Fikk ikke hentet en eksamensoppgave nå. Prøv igjen om litt.' }); });
  }
  function visEksOppgave() {
    var o = eks.opp, d = document.createElement('div'); d.className = 'dm-m dm-fra dm-eksoppg';
    d.innerHTML = '<p class="dm-eksmerke">Eksamensoppgave · ' + esc(o.eksamen) + ', oppgave ' + o.nr + '</p>' +
      (o.kontekst ? '<details class="dm-ekskontekst"><summary>Bakgrunn fra oppgaven før</summary>' + md(o.kontekst) + '</details>' : '') +
      md(o.tekst) + (o.figur ? '<img class="dm-eksfig" alt="Figur til oppgaven" src="' + esc(o.figur) + '">' : '') +
      '<div class="dm-eksalt">' + o.alternativer.map(function (a, i) {
        var kl = eks.svar ? (i + 1 === eks.svar.fasit ? ' riktig' : i + 1 === eks.svar.valgt ? ' feil' : '') : '';
        return '<button type="button" class="dm-alt' + kl + '" data-alt="' + (i + 1) + '"' + (eks.svar ? ' disabled' : '') + '><b>' + BOKST[i] + '</b> <span>' + md(a).replace(/^<p>|<\/p>$/g, '') + '</span></button>';
      }).join('') + '</div>' +
      (eks.svar ? '<p class="dm-eksvidere"><button type="button" data-h="eksneste">Neste oppgave →</button> <button type="button" data-h="eksdiskuter">Diskuter denne</button></p>' : '<p class="dm-sm">Velg svaret ditt. Vil du ha tilbakemelding på utregningen også, ta bilde av den med kameraet før du velger.</p>');
    logg.appendChild(d); matte(d); logg.scrollTop = logg.scrollHeight;
    return d;
  }
  function svarEks(valgt, boks) {
    if (opptatt || !eks.opp || eks.svar) return;
    opptatt = true; panel.classList.add('dm-venter');
    var o = eks.opp, bildeNa = vedlegg; settVedlegg(null);
    boks.querySelectorAll('.dm-alt').forEach(function (b) { b.disabled = true; if (+b.getAttribute('data-alt') === valgt) b.classList.add('valgt'); });
    settHumor('tenker');
    var tenk = document.createElement('div'); tenk.className = 'dm-m dm-fra dm-tenker'; tenk.innerHTML = '<p><span></span><span></span><span></span></p>'; logg.appendChild(tenk); logg.scrollTop = logg.scrollHeight;
    eksPost('/svar', { eid: o.eid, nr: o.nr, valgt: valgt, bilde: bildeNa || undefined, tid_s: eks.start ? Math.round((Date.now() - eks.start) / 1000) : undefined }).then(function (d) {
      tenk.remove(); eks.svar = { valgt: valgt, fasit: d.fasit, riktig: d.riktig }; lagreEks();
      boks.remove(); visEksOppgave();
      settHumor(d.humor || (d.riktig ? 'glad' : 'tenker'));
      var m = { rolle: 'dashman', tekst: d.svar }; samtale.push(m); lagre();
      return visMelding(m, true);
    }).catch(function (e) {
      tenk.remove(); settHumor('trist'); if (bildeNa) settVedlegg(bildeNa);
      boks.querySelectorAll('.dm-alt').forEach(function (b) { b.disabled = false; b.classList.remove('valgt'); });
      visMelding({ rolle: 'dashman', tekst: (e && e.melding) || 'Fikk ikke sjekket svaret nå. Prøv igjen.' });
    }).then(function () { opptatt = false; panel.classList.remove('dm-venter'); });
  }
  logg.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('.dm-alt'); if (a && !a.disabled) svarEks(+a.getAttribute('data-alt'), a.closest('.dm-eksoppg'));
  });
  bryter.addEventListener('change', function () { eksPa(bryter.checked); });

  // Nivå: spør én gang hvis det mangler i profilen.
  function visNivavalg() {
    if (!profil || profil.niva) return;
    var d = document.createElement('div'); d.className = 'dm-m dm-fra dm-niva';
    d.innerHTML = '<p>Først: hvilket nivå er du på? Da kan jeg tilpasse meg deg.</p><p>' +
      [['forkurs', 'Forkurs'], ['ingenior', 'Ingeniør'], ['fordypning', 'Fordypning']].map(function (n) { return '<button type="button" data-niva="' + n[0] + '" data-nv="' + n[0] + '">' + n[1] + '</button>'; }).join(' ') + '</p>';
    logg.appendChild(d);
    d.addEventListener('click', function (e) {
      var n = e.target.getAttribute && e.target.getAttribute('data-niva'); if (!n) return;
      klient().then(function (k) { return k.rpc('sett_studentprofil', { n: n, m: null }); }).then(function () {
        profil.niva = n; d.innerHTML = '<p>Supert, da vet jeg det. Du kan endre nivået på Min side.</p>';
      });
    });
  }

  var klientLofte = null;
  function klient() { return klientLofte || (klientLofte = window.fhKonto()); }
  function token() { return klient().then(function (k) { return k.auth.getSession(); }).then(function (r) { return r && r.data && r.data.session && r.data.session.access_token; }); }
  function hentProfil() {
    return klient().then(function (k) { return k.auth.getSession().then(function (r) {
      var u = r && r.data && r.data.session && r.data.session.user; if (!u) return null;
      return k.from('profiler').select('niva, mal, dashman_notat').eq('id', u.id).maybeSingle().then(function (x) { return x.data || { niva: null, mal: '', dashman_notat: '' }; });
    }); }).catch(function () { return null; });
  }

  function sideInfo() {
    var main = document.querySelector('main') || document.body;
    var h1 = document.querySelector('h1.title, main h1');
    return { tittel: (h1 && h1.textContent.trim()) || document.title, url: location.pathname, tekst: (main.innerText || '').replace(/\s+/g, ' ').slice(0, 3000) };
  }

  // Bilde fra kameraknappen: krympes til 1600 px og sendes med neste melding. Lagres ikke (bare i minnet til det er sendt).
  var vedlegg = null, vedBoks = panel.querySelector('.dm-vedlegg');
  function settVedlegg(url) { vedlegg = url || null; vedBoks.hidden = !vedlegg; if (vedlegg) vedBoks.querySelector('img').src = vedlegg; }
  function krymp(fil) {
    return new Promise(function (ok, nei) {
      if (!fil || !/^image\//.test(fil.type)) return nei(new Error('Velg et bilde.'));
      var r = new FileReader();
      r.onload = function () {
        var img = new Image();
        img.onload = function () {
          var f = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas');
          c.width = Math.round(img.width * f); c.height = Math.round(img.height * f); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          ok(c.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = function () { nei(new Error('Klarte ikke å lese bildet.')); }; img.src = r.result;
      };
      r.readAsDataURL(fil);
    });
  }
  panel.querySelector('.dm-kamera input').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0]; e.target.value = '';
    krymp(f).then(function (u) { settVedlegg(u); felt.focus(); }).catch(function () {});
  });

  function send(tekst) {
    if (opptatt || (!tekst.trim() && !vedlegg)) return;
    if (eks.pa && eks.opp && !eks.svar) {
      visMelding({ rolle: 'student', tekst: tekst });
      visMelding({ rolle: 'dashman', tekst: 'Du er i eksamensmodus, så jeg hjelper ikke før du har svart. Velg et alternativ (ta gjerne bilde av utregningen først), eller slå av eksamensmodus øverst for å diskutere.' });
      return;
    }
    opptatt = true; panel.classList.add('dm-venter');
    var bildeNa = vedlegg; settVedlegg(null);
    var m = { rolle: 'student', tekst: (tekst.trim() || 'Her er løsningen min så langt. Hva synes du?').slice(0, 2000) + (bildeNa ? ' [bilde av løsningen]' : '') };
    samtale.push(m); lagre(); visMelding(m); settHumor('tenker');
    if (bildeNa) { var vis1 = document.createElement('img'); vis1.className = 'dm-mbilde'; vis1.alt = 'Bildet du sendte'; vis1.src = bildeNa; logg.lastChild.appendChild(vis1); logg.scrollTop = logg.scrollHeight; }
    var tenk = document.createElement('div'); tenk.className = 'dm-m dm-fra dm-tenker'; tenk.innerHTML = '<p><span></span><span></span><span></span></p>'; logg.appendChild(tenk); logg.scrollTop = logg.scrollHeight;
    token().then(function (t) {
      if (!t) throw { melding: 'Du må logge inn på nytt for å snakke med Dashman.' };
      return fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify({ meldinger: samtale, side: sideInfo(), oppgave: oppgave, eksamen: eks.diskuter || undefined, bilde: bildeNa || undefined, fag: window.fhDashmanFag ? window.fhDashmanFag() : null }) });
    }).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw { melding: d.feil }; return d; }); })
      .then(function (d) {
        tenk.remove(); settHumor(d.humor || 'noytral');
        // Undervisere i fagbyggeren: Dashman kan sende et nytt oppsett, som fagbyggeren tar i bruk (kan angres der).
        var endret = d.moduler && window.fhDashmanBruk ? window.fhDashmanBruk(d) : '';
        var svar = { rolle: 'dashman', tekst: d.svar + (endret ? '\n\n' + endret : '') }; samtale.push(svar); lagre();
        return visMelding(svar, true);
      })
      .catch(function (e) {
        tenk.remove(); samtale.pop(); lagre(); settHumor('trist');
        var f = document.createElement('div'); f.className = 'dm-m dm-fra dm-feil';
        f.innerHTML = '<p>' + esc((e && e.melding) || 'Jeg fikk ikke svart nå. Prøv igjen om litt.') + '</p>'; logg.appendChild(f); logg.scrollTop = logg.scrollHeight;
        felt.value = m.tekst.replace(/ \[bilde av løsningen\]$/, ''); if (bildeNa) settVedlegg(bildeNa);
      })
      .then(function () { opptatt = false; panel.classList.remove('dm-venter'); felt.focus(); });
  }

  // ------------------------------------------------------------ hendelser
  knapp.addEventListener('click', function () {
    forhandslast(); panel.hidden = false; knapp.hidden = true; settHumor('glad');
    if (profil === null) hentProfil().then(function (p) { profil = p; visAlt(); }); else visAlt();
    setTimeout(function () { felt.focus(); }, 50);
  });
  // Studieappen åpner Dashman fra bunnlinja, eventuelt med et forslag til melding i feltet.
  window.Dashman = { eksamen: function () { if (panel.hidden) knapp.click(); if (!eks.pa) eksPa(true); }, apne: function (forslag, bilde) { if (panel.hidden) knapp.click(); if (forslag) { felt.value = forslag; } if (bilde) settVedlegg(bilde); setTimeout(function () { felt.focus(); }, 60); } };
  panel.querySelector('.dm-skriv').addEventListener('submit', function (e) { e.preventDefault(); var t = felt.value; felt.value = ''; send(t); });
  felt.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); panel.querySelector('.dm-skriv').requestSubmit(); } });
  panel.addEventListener('click', function (e) {
    var h = e.target.getAttribute && e.target.getAttribute('data-h');
    if (h === 'fjernbilde') { settVedlegg(null); return; }
    if (h === 'eksneste') { e.target.closest('.dm-eksvidere').remove(); eks.opp = null; eks.svar = null; lagreEks(); nesteEks(); return; }
    if (h === 'eksdiskuter') { e.target.closest('.dm-eksvidere').remove(); eksPa(false); felt.focus(); return; }
    if (h === 'lukk') { panel.hidden = true; knapp.hidden = false; knapp.focus(); }
    if (h === 'ny') { samtale = []; lagre(); oppgave = null; lagreOppgave(); eks = { pa: eks.pa }; lagreEks(); settHumor('glad'); visAlt(); }
    if (h === 'husker') {
      hentProfil().then(function (p) {
        profil = p || profil;
        var notat = p && p.dashman_notat;
        var d = document.createElement('div'); d.className = 'dm-m dm-fra dm-husker';
        d.innerHTML = notat ? '<p><b>Dette har jeg notert om hvordan det går faglig:</b></p><p>' + esc(notat) + '</p><p><button type="button" data-h="glem">Slett notatet</button></p>'
          : '<p>Jeg har ikke notert noe om deg ennå. Når vi har jobbet sammen, skriver jeg et kort faglig notat, så jeg kan fortsette der vi slapp neste gang. Du kan alltid se og slette det her.</p>';
        logg.appendChild(d); logg.scrollTop = logg.scrollHeight;
      });
    }
    if (h === 'glem') {
      klient().then(function (k) { return k.rpc('sett_dashman_notat', { t: '' }); }).then(function () {
        e.target.closest('.dm-husker').innerHTML = '<p>Notatet er slettet. Jeg starter med blanke ark.</p>';
      });
    }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) { panel.hidden = true; knapp.hidden = false; } });

  // Fra hint-knappen på en oppgave (assets/js/oppgaver.js): ny samtale om oppgaven.
  window.addEventListener('dashman:oppgave', function (e) {
    var d = e.detail || {}; if (!d.oppgave) return;   // innlogging sjekkes av tjenesten; Dashman svarer selv om økta mangler
    oppgave = { tittel: String(d.tittel || '').slice(0, 150), oppgave: String(d.oppgave).slice(0, 2000), losning: String(d.losning || '').slice(0, 2500),
                forsok: String(d.forsok || '').slice(0, 1500), hint: (d.hint || []).slice(0, 3), kilde: d.kilde || 'hint', id: String(d.id || '').slice(0, 300) };
    lagreOppgave(); samtale = []; lagre();
    forhandslast(); panel.hidden = false; knapp.hidden = true; settHumor('glad');
    (profil === null ? hentProfil().then(function (p) { profil = p; }) : Promise.resolve()).then(function () {
      visAlt();
      if (d.bilde) settVedlegg(d.bilde);
      if (d.startmelding === false) { felt.focus(); return; }
      send(d.startmelding || ('Jeg står fast på denne oppgaven' + (oppgave.hint.length ? ' og har fått ' + oppgave.hint.length + ' hint' : '') + '. Kan du hjelpe meg videre?'));
    });
  });
})();
