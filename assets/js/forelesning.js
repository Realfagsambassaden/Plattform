// Forelesningsmodus og «Tilpass innholdet».
//   larer/forelesning.html#id=<forelesning>            -> vis forelesningen som tavleslides
//   larer/forelesning.html#id=<forelesning>&rediger=1  -> tilpass: klikk − for å fjerne tekst, definisjoner, løsninger …
//   larer/forelesning.html#sider=/a.html,/b.html        -> vis enkeltsider (fra knappen på innholdssidene)
//
// Slik lages slidene:
//  1. Hver side hentes og deles i blokker (avsnitt, bokser, figurer, eksempler, oppgaver …). Løsningen til et
//     eksempel eller en oppgave er en egen del av blokken.
//  2. Blokkene foreleseren har fjernet, tas bort. Resten settes med MathJax i et usynlig «lager».
//  3. Blokkene pakkes på slides ved å MÅLE dem i en usynlig slide med samme størrelse som skjermen,
//     så alt som vises på én slide får plass uten skrolling. For store blokker deles opp eller skaleres ned.
//  4. En løsning kommer først på neste klikk: på samme slide hvis den får plass, ellers på en egen slide.
(function () {
  var start = document.getElementById('foredrag-start'); if (!start) return;
  var R = (function () { var s = document.querySelector('script[src*="site_libs/"]'); return s ? s.getAttribute('src').split('site_libs/')[0] : ''; })();

  function param(n) { var m = location.hash.match(new RegExp('[#&]' + n + '=([^&]*)')); return m ? decodeURIComponent(m[1]) : null; }
  function last(src) { return new Promise(function (ok) { var s = document.createElement('script'); s.src = R + src; s.onload = ok; s.onerror = ok; document.body.appendChild(s); }); }
  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function settMatte(noder) {
    if (!(window.MathJax && MathJax.typesetPromise)) return new Promise(function (ok) {   // MathJax lastes kanskje fortsatt
      var n = 0; (function vent() { if (window.MathJax && MathJax.typesetPromise) ok(settMatte(noder)); else if (n++ > 60) ok(); else setTimeout(vent, 100); })();
    });
    return (MathJax.startup && MathJax.startup.promise ? MathJax.startup.promise : Promise.resolve()).then(function () { return MathJax.typesetPromise(noder); }).catch(function () {});
  }

  var forelesning = null, navn = 'Forelesning', oppforinger = [];   // oppføringer: [{url, skjul:[…]}]

  last('assets/js/larer-felles.js').then(function () { return fhLarer.klar(); }).then(function () {
    var id = param('id'), sider = param('sider');
    if (id && fhLarer.hent(id)) { forelesning = fhLarer.hent(id); navn = forelesning.navn; oppforinger = forelesning.sider.map(fhLarer.oppforing); }
    else if (sider) oppforinger = sider.split(',').filter(Boolean).map(fhLarer.oppforing);
    if (!oppforinger.length) { start.innerHTML = '<p>Fant ingen forelesning. <a href="' + R + 'larer/index.html">Lag en her.</a></p>'; return; }
    start.innerHTML = '<p>Henter ' + oppforinger.length + ' sider …</p>';
    return Promise.all(oppforinger.map(function (o) { return hentSide(o.url); })).then(function (sider) {
      if (param('rediger')) rediger(sider); else presenter(sider);
    });
  });

  // ---------- 1. Hent en side og del den i blokker ----------
  function hentSide(url) {
    var abs = new URL(url, location.href);
    return fetch(abs).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }).then(function (html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var main = doc.querySelector('main#quarto-document-content') || doc.querySelector('main');
      var tittel = ((doc.querySelector('h1.title') || doc.querySelector('h1') || {}).textContent || url).trim();
      if (!main) return { url: url, tittel: tittel, blokker: [] };
      main.querySelectorAll('#title-block-header, script, .callout-warning, nav, .quarto-alternate-formats, footer, .fd-sideknapper').forEach(function (x) { x.remove(); });
      main.querySelectorAll('[src]').forEach(function (x) { x.setAttribute('src', new URL(x.getAttribute('src'), abs).href); });
      main.querySelectorAll('a[href]').forEach(function (x) { var h = x.getAttribute('href'); if (h && h[0] !== '#') { x.setAttribute('href', new URL(h, abs).href); x.target = '_blank'; } });
      main.querySelectorAll('[id]').forEach(function (x) { x.removeAttribute('id'); });
      return { url: url, tittel: tittel, blokker: blokker(main) };
    }).catch(function () { return { url: url, tittel: url, blokker: [{ nr: 0, type: 'tekst', overskrift: '', el: el('p', null, 'Fikk ikke hentet denne siden.') }] }; });
  }

  function svarInnhold(callout) {
    var b = callout.querySelector('.callout-body-container') || callout.querySelector('.callout-body') || callout;
    var d = el('div', 'losning'); Array.prototype.slice.call(b.childNodes).forEach(function (n) { d.appendChild(n); }); return d;
  }
  function blokker(main) {
    var ut = [], overskrift = '', nr = 0;
    function legg(type, e, los, tittel) { ut.push({ nr: nr++, type: type, overskrift: overskrift, el: e, los: los || null, tittel: tittel || '' }); }
    function gaa(node) {
      var barn = Array.prototype.slice.call(node.childNodes);
      for (var k = 0; k < barn.length; k++) {
        var e = barn[k]; if (e.nodeType !== 1) { if (e.nodeType === 3 && e.textContent.trim()) legg('tekst', el('p', null, esc(e.textContent))); continue; }
        var tag = e.tagName, c = e.classList;
        if (tag === 'SECTION' || c.contains('oppgaver') || (tag === 'DIV' && !e.className && e.children.length && !e.querySelector(':scope > p, :scope > img'))) { gaa(e); continue; }
        if (/^H[2-4]$/.test(tag)) { overskrift = e.textContent.trim(); legg('overskrift', e); continue; }
        if (c.contains('eksempel')) {
          var los = e.querySelector(':scope > .losning'); if (los) los.remove();
          var neste = barn[k + 1]; while (neste && neste.nodeType !== 1) neste = barn[++k + 1];
          if (!los && neste && neste.classList && neste.classList.contains('svar')) { los = svarInnhold(neste); k++; }
          var tt = e.querySelector('.eks-tittel'), st = e.querySelector('p > strong');
          var tittel = tt ? tt.textContent : (st && /^Eksempel/.test(st.textContent) ? st.textContent.replace(/[.:]\s*$/, '') : 'Eksempel');
          // Tittelen står øverst på sliden, så den fjernes fra selve teksten
          if (tt) { var tp = tt.closest('p'); (tp && tp.textContent.trim() === tt.textContent.trim() ? tp : tt).remove(); }
          else if (st && /^Eksempel/.test(st.textContent)) { if (/^Eksempel:?\s*$/.test(st.textContent.trim())) tittel = 'Eksempel'; st.remove(); }
          legg('eksempel', e, los, tittel.trim()); continue;
        }
        if (c.contains('oppgave')) {
          var lo = e.querySelector(':scope > .losning'); if (lo) lo.remove();
          e.querySelectorAll('.oppg-tittel').forEach(function (x) { var p = x.closest('p'); (p && p.textContent.trim() === x.textContent.trim() ? p : x).remove(); });
          var t = e.getAttribute('data-tittel') || e.getAttribute('tittel');
          legg('oppgave', e, lo, 'Oppgave' + (t ? ': ' + t : '')); continue;
        }
        if (c.contains('svar')) { legg('tekst', svarInnhold(e)); continue; }
        if (c.contains('quarto-video') || e.querySelector('iframe')) { legg('video', e); continue; }
        if (c.contains('callout') || c.contains('graa') || c.contains('intro') || c.contains('spm')) { legg('boks', e); continue; }
        if (c.contains('sourceCode') || tag === 'PRE' || c.contains('cell')) { legg('kode', e); continue; }
        if ((tag === 'FIGURE' || e.querySelector('img')) && (e.textContent || '').trim().length < 250) { legg('figur', e); continue; }
        legg('tekst', e);
      }
    }
    gaa(main);
    return ut;
  }

  function skjult(o, nr, del) { return o.skjul.indexOf(String(nr) + (del || '')) >= 0; }

  // ---------- 2. Tilpass innholdet: klikk − for å fjerne ----------
  function rediger(sider) {
    start.remove();
    var rot = el('div', 'fd-rediger');
    var kanLagre = !!forelesning;
    rot.innerHTML = '<div class="fd-rediger-topp"><div><h1>' + esc(navn) + '</h1>' +
      '<p>Klikk <b>−</b> på det du <b>ikke</b> vil ha med. Det du fjerner blir grått, og <b>+</b> tar det med igjen. Løsninger er egne deler, så du kan vise oppgaven uten løsning.' +
      (kanLagre ? ' Endringene lagres med en gang.' : ' <i>Dette er en enkeltside, så endringene lagres ikke. Legg den til i en forelesning for å lagre.</i>') + '</p></div>' +
      '<div class="fd-rediger-knapper"><a class="btn-chalk sekundar" href="' + R + 'larer/index.html">← Tilbake</a> <a class="btn-chalk" data-h="start" href="#">▶ Start forelesning</a></div></div>';
    var innhold = el('div', 'fd-rediger-innhold'); rot.appendChild(innhold);
    document.querySelector('main') ? document.querySelector('main').appendChild(rot) : document.body.appendChild(rot);

    sider.forEach(function (side, si) {
      var o = oppforinger[si];
      var sek = el('section', 'fd-r-side'); sek.innerHTML = '<h2 class="fd-r-sidetittel">' + esc(side.tittel) + ' <small>' + side.blokker.length + ' deler</small></h2>';
      side.blokker.forEach(function (b) {
        sek.appendChild(radFor(o, b, '', b.el, b.type === 'overskrift' ? 'Overskrift' : (b.tittel || null)));
        if (b.los) sek.appendChild(radFor(o, b, 'l', b.los, 'Løsning', true));
      });
      innhold.appendChild(sek);
    });
    settMatte([innhold]);

    function radFor(o, b, del, innholdEl, merke, erLos) {
      var rad = el('div', 'fd-r-rad fd-r-' + b.type + (erLos ? ' fd-r-los' : ''));
      var knapp = el('button', 'fd-r-knapp'); knapp.type = 'button';
      var boks = el('div', 'fd-r-innhold'); boks.appendChild(innholdEl.cloneNode(true));
      if (merke) boks.insertBefore(el('span', 'fd-r-merke', esc(merke)), boks.firstChild);
      rad.appendChild(knapp); rad.appendChild(boks);
      function oppdater() {
        var av = !!(skjult(o, b.nr, del) || (erLos && skjult(o, b.nr, '')));
        rad.classList.toggle('av', av);
        knapp.textContent = av ? '+' : '−';
        knapp.setAttribute('aria-label', (av ? 'Ta med igjen: ' : 'Fjern: ') + (merke || b.tittel || b.type));
        knapp.disabled = !!(erLos && skjult(o, b.nr, ''));
      }
      knapp.addEventListener('click', function () {
        var nokkel = String(b.nr) + del, i = o.skjul.indexOf(nokkel);
        if (i >= 0) o.skjul.splice(i, 1); else o.skjul.push(nokkel);
        rot.querySelectorAll('.fd-r-rad').forEach(function (r) { if (r._oppdater) r._oppdater(); });
        lagre();
      });
      rad._oppdater = oppdater; oppdater();
      return rad;
    }
    function lagre() {
      if (!forelesning) return;
      forelesning.sider = oppforinger.map(function (o) { return o.skjul.length ? { url: o.url, skjul: o.skjul.slice() } : o.url; });
      fhLarer.lagre(forelesning);
    }
    rot.querySelector('[data-h="start"]').addEventListener('click', function (e) {
      e.preventDefault();
      if (forelesning) { location.hash = '#id=' + encodeURIComponent(forelesning.id); location.reload(); }
      else { rot.remove(); presenter(sider); }
    });
  }

  // ---------- 3. Presentasjon ----------
  function presenter(sider) {
    if (start.parentNode) start.remove();
    var scene = el('div', 'foredrag'); scene.tabIndex = 0;
    scene.innerHTML = '<div class="fd-flate"><div class="fd-slide"></div></div><div class="fd-linje"><span class="fd-navn"></span><span class="fd-pos"></span>' +
      '<span class="fd-knapper"><button type="button" data-h="løsning" hidden>Vis løsning (L)</button><button type="button" data-h="forrige" aria-label="Forrige">←</button><button type="button" data-h="neste" aria-label="Neste">→</button>' +
      (forelesning ? '<a href="#" data-h="rediger" aria-label="Tilpass innholdet" title="Tilpass innholdet">✎</a>' : '') +
      '<button type="button" data-h="full" aria-label="Fullskjerm">⛶</button><a href="' + R + 'larer/index.html" aria-label="Avslutt">✕</a></span></div>' +
      '<div class="fd-lager" aria-hidden="true"></div><div class="fd-flate fd-maaleflate" aria-hidden="true"><div class="fd-slide fd-maal"></div></div>';
    document.body.appendChild(scene); document.body.classList.add('har-foredrag');
    var flate = scene.querySelector('.fd-slide:not(.fd-maal)'), maal = scene.querySelector('.fd-maal'), lager = scene.querySelector('.fd-lager');
    scene.querySelector('.fd-navn').textContent = navn;
    flate.innerHTML = '<p class="fd-under">Gjør klar slidene …</p>';

    // Synlige blokker, satt med MathJax i lageret (samme bredde og skrift som en slide)
    var deler = [];   // [{side, b, el, los}]
    sider.forEach(function (side, si) {
      var o = oppforinger[si];
      deler.push({ side: side, type: 'sidetittel' });
      side.blokker.forEach(function (b) {
        if (skjult(o, b.nr, '')) return;
        var d = { side: side, b: b, type: b.type, el: b.el.cloneNode(true), los: b.los && !skjult(o, b.nr, 'l') ? b.los.cloneNode(true) : null };
        lager.appendChild(d.el); if (d.los) lager.appendChild(d.los);
        deler.push(d);
      });
    });
    var bilder = Array.prototype.slice.call(lager.querySelectorAll('img')).map(function (im) { return im.complete ? null : new Promise(function (ok) { im.onload = im.onerror = ok; setTimeout(ok, 4000); }); });
    Promise.all([settMatte([lager])].concat(bilder)).then(function () {
      var slides = pakk(), i = 0, trinn = 0;
      var fra = parseInt(param('s'), 10); if (fra > 0 && fra <= slides.length) i = fra - 1;

      function tegn() {
        var s = slides[i]; flate.innerHTML = ''; flate.className = 'fd-slide fd-' + (s.type || 'vanlig');
        bygg(flate, s, true);
        vist();
        scene.querySelector('.fd-pos').textContent = (i + 1) + ' / ' + slides.length;
        history.replaceState(null, '', location.pathname + location.hash.replace(/&s=\d+/, '') + '&s=' + (i + 1));
      }
      function vist() {
        var s = slides[i];
        flate.querySelectorAll('[data-trinn]').forEach(function (x) { x.hidden = +x.getAttribute('data-trinn') > trinn; });
        var lk = scene.querySelector('[data-h="løsning"]'); lk.hidden = !(s.trinn > 0);
        lk.textContent = trinn < (s.trinn || 0) ? 'Vis løsning (L)' : 'Skjul løsning (L)';
      }
      function frem() { var s = slides[i]; if (trinn < (s.trinn || 0)) { trinn++; vist(); } else if (i < slides.length - 1) { i++; trinn = 0; tegn(); } }
      function tilbake() { if (trinn > 0) { trinn--; vist(); } else if (i > 0) { i--; trinn = slides[i].trinn || 0; tegn(); } }
      function losning() { var s = slides[i]; if (!s.trinn) return; trinn = trinn < s.trinn ? s.trinn : 0; vist(); }
      function full() { if (document.fullscreenElement) document.exitFullscreen(); else if (scene.requestFullscreen) scene.requestFullscreen(); }
      document.addEventListener('keydown', function (e) {
        if (e.target.closest && e.target.closest('input, textarea')) return;
        var k = e.key;
        if (k === 'ArrowRight' || k === 'PageDown' || k === ' ' || k === 'ArrowDown') { e.preventDefault(); frem(); }
        else if (k === 'ArrowLeft' || k === 'PageUp' || k === 'ArrowUp') { e.preventDefault(); tilbake(); }
        else if (k === 'Home') { i = 0; trinn = 0; tegn(); } else if (k === 'End') { i = slides.length - 1; trinn = 0; tegn(); }
        else if (k === 'l' || k === 'L') losning();
        else if (k === 'f' || k === 'F') full();
      });
      scene.addEventListener('click', function (e) {
        var b = e.target.closest('button, a[data-h]'); if (!b) return;
        var h = b.getAttribute('data-h');
        if (h === 'neste') frem(); else if (h === 'forrige') tilbake(); else if (h === 'full') full(); else if (h === 'løsning') losning();
        else if (h === 'rediger') { e.preventDefault(); location.hash = '#id=' + encodeURIComponent(forelesning.id) + '&rediger=1'; location.reload(); }
      });
      // Ny skjermstørrelse (f.eks. fullskjerm): pakk på nytt, og bli stående på samme innhold
      var tidtaker = null, sistStr = str();
      function str() { return flate.clientWidth + 'x' + flate.clientHeight; }
      window.addEventListener('resize', function () {
        clearTimeout(tidtaker);
        tidtaker = setTimeout(function () {
          if (str() === sistStr) return; sistStr = str();
          var anker = slides[i].anker; slides = pakk(); trinn = 0;
          i = Math.max(0, slides.findIndex(function (s) { return s.anker >= anker; })); tegn();
        }, 250);
      });
      tegn(); scene.focus();
    });

    // Bygg innholdet til en slide i en beholder. Trinn 1 (løsning) merkes med data-trinn.
    function bygg(boks, s, ekte) {
      if (s.type === 'forside') { boks.innerHTML = '<p class="fd-merke">fysikkhjelp.no</p><h1>' + esc(s.tittel) + '</h1><p class="fd-under">' + esc(s.under || '') + '</p>'; return; }
      if (s.type === 'sidetittel') { boks.innerHTML = '<h1>' + esc(s.tittel) + '</h1>'; return; }
      var innhold = el('div', 'fd-innhold');
      if (s.tittel) { var h = el('h2'); h.textContent = s.tittel; boks.appendChild(h); }
      boks.appendChild(innhold);
      s.deler.forEach(function (d) {
        var c = d.el.cloneNode(true);
        if (d.skala && d.skala < 1) c.style.fontSize = Math.round(d.skala * 100) + '%';
        if (d.losMerke) {   // «Løsning:» i teksten blir overflødig når sliden har eget løsningsmerke
          var f = c.querySelector('p > strong, p > em');
          if (f && /^Løsning:?$/.test(f.textContent.trim()) && !f.previousSibling) f.remove();
          c.insertBefore(el('p', 'fd-losmerke', 'Løsning'), c.firstChild);
        }
        if (d.trinn) c.setAttribute('data-trinn', d.trinn);
        innhold.appendChild(c);
      });
    }
    function passer(s) {
      maal.innerHTML = ''; maal.className = 'fd-slide fd-maal fd-' + (s.type || 'vanlig'); bygg(maal, s, false);
      return maal.scrollHeight <= maal.clientHeight + 2;
    }

    // ---------- Pakking ----------
    function pakk() {
      maal.style.width = flate.offsetWidth + 'px'; maal.style.height = flate.offsetHeight + 'px';
      var slides = [{ type: 'forside', tittel: navn, anker: -1, deler: [] }], cur = null, n = 0, sideTittel = '', overskrift = '';
      function ny(tittel, type) { cur = { tittel: tittel, type: type || 'vanlig', deler: [], trinn: 0, anker: n }; slides.push(cur); return cur; }
      function proevLegg(del) { cur.deler.push(del); if (passer(cur)) return true; cur.deler.pop(); return false; }
      // Legg en del på gjeldende slide; ellers ny slide; er den for stor alene: skaler ned, eller del den opp.
      function legg(del, tittel, type) {
        if (cur && cur.deler.length && proevLegg(del)) return;
        if (!cur || cur.deler.length) ny(tittel, type);
        if (proevLegg(del)) return;
        for (var sk = 0.9; sk >= 0.62; sk -= 0.07) { del.skala = sk; if (proevLegg(del)) return; }
        delete del.skala;
        var biter = splitt(del.el);
        if (biter.length > 1) { biter.forEach(function (b, k) { legg({ el: b, trinn: del.trinn, losMerke: del.losMerke && k === 0 }, tittel + (k ? ' (forts.)' : ''), type); }); return; }
        del.skala = 0.55; cur.deler.push(del);   // siste utvei: så lite det går
      }
      deler.forEach(function (d, k) {
        n = k;
        if (d.type === 'sidetittel') { sideTittel = d.side.tittel; overskrift = ''; cur = null; slides.push({ type: 'sidetittel', tittel: sideTittel, anker: k, deler: [] }); return; }
        if (d.type === 'overskrift') { overskrift = d.el.textContent.trim(); cur = null; return; }
        var tittel = overskrift || sideTittel;
        if (d.type === 'eksempel' || d.type === 'oppgave') {
          cur = null; var t = d.b.tittel || tittel;
          var sporsmal = { el: d.el };
          legg(sporsmal, t, d.type);
          if (d.los) {
            var losDel = { el: d.los, trinn: 1, losMerke: true };
            if (!(cur && proevLegg(losDel))) { cur = null; legg(losDel, 'Løsning – ' + t, d.type); }   // ellers: løsningen får plass på samme slide
          }
          cur = null; return;
        }
        if (d.type === 'video' || d.type === 'figur') { if (cur && cur.deler.length && proevLegg({ el: d.el })) return; cur = null; legg({ el: d.el }, tittel, d.type); return; }
        // En mellomtittel (avsnitt med bare fet skrift) eller en innledning som slutter med kolon skal stå sammen med det som kommer etter
        var nesteD = deler[k + 1];
        if (cur && cur.deler.length && medNeste(d.el) && nesteD && nesteD.el && /^(tekst|boks|kode|figur)$/.test(nesteD.type)) {
          var a = { el: d.el }, b = { el: nesteD.el };
          if (proevLegg(a)) { var ok = proevLegg(b); cur.deler.pop(); if (ok) cur.deler.pop(); else { cur.deler.pop(); cur = null; } }
          else cur = null;
        }
        legg({ el: d.el }, tittel, 'vanlig');
      });
      // Løsninger på egne slides vises med en gang (det er allerede et nytt klikk å komme dit)
      slides.forEach(function (s) {
        if (!s.deler) return;
        var harSp = s.deler.some(function (x) { return !x.trinn; });
        if (!harSp) { s.deler.forEach(function (x) { x.trinn = 0; }); s.trinn = 0; }
        else s.trinn = s.deler.some(function (x) { return x.trinn; }) ? 1 : 0;
      });
      slides[0].under = (slides.length - 1) + ' slides · bla med piltastene';
      return slides;
    }
    function medNeste(e) {
      if (e.tagName !== 'P') return false;
      var t = (e.textContent || '').trim();
      if (/:$/.test(t)) return true;
      return e.children.length === 1 && /^(STRONG|B)$/.test(e.children[0].tagName) && e.children[0].textContent.trim() === t;
    }
    // Del et element i mindre biter (avsnitt i en boks, punkter i en liste)
    function splitt(e) {
      var barn = Array.prototype.slice.call(e.children);
      if (barn.length < 2) return [e];
      if (e.tagName === 'UL' || e.tagName === 'OL') {
        var halv = Math.ceil(barn.length / 2), a = e.cloneNode(false), b = e.cloneNode(false);
        barn.forEach(function (x, k) { (k < halv ? a : b).appendChild(x.cloneNode(true)); });
        if (e.tagName === 'OL') b.setAttribute('start', (+(e.getAttribute('start') || 1)) + halv);
        return [a, b];
      }
      return barn.map(function (x) { var w = e.cloneNode(false); w.removeAttribute('id'); w.appendChild(x.cloneNode(true)); return w; });
    }
  }
})();
