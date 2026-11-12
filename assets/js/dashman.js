// Dashman – KI-læringspartneren. Vises nede til venstre for innloggede studenter på alle sider.
// Samtalen går via KI-tjeneren (/dashman), som henter nivå, mål, notat, kunnskapsprofil og fag selv fra Supabase.
// Samtalen lagres bare i denne fanen (sessionStorage) og forsvinner når fanen lukkes.
// Figuren: FIGUR under. Byttes ut med lærerens egen Dashman-tegning: kroppen uten munn, og egne munner/øyne/bryn per humør.
(function () {
  try { if (window.self !== window.top) return; } catch (e) { return; }
  var URL_ = (document.querySelector('meta[name="supabase-url"]') || {}).content || '';
  var api = ((document.querySelector('meta[name="fysikkhjelp-hint-api"]') || {}).content || '').replace(/\/hint\/?$/, '/dashman');
  if (!URL_ || !api || !window.fhKonto) return;
  var lagringsnavn = 'sb-' + URL_.split('//')[1].split('.')[0] + '-auth-token';
  function innlogget() { try { return !!localStorage.getItem(lagringsnavn); } catch (e) { return false; } }
  if (!innlogget()) return;

  // ------------------------------------------------------------ figuren (kritt-strek, viewBox 0 0 160 230)
  var FIGUR = {
    kropp: '<circle cx="82" cy="62" r="46"/><path d="M80 108 L80 175"/><path d="M80 175 L66 205 L52 207"/><path d="M80 175 L92 205 L108 207"/>',
    armer: {
      vanlig: '<path d="M80 125 L58 142 L50 130"/><path d="M80 125 L104 140 L112 128"/>',
      ler: '<path d="M80 125 L56 112 L50 98"/><path d="M80 125 L106 112 L112 98"/>',
      irritert: '<path d="M80 125 L60 138 L70 146"/><path d="M80 125 L100 138 L90 146"/>',
      trist: '<path d="M80 125 L66 150 L64 160"/><path d="M80 125 L94 150 L96 160"/>',
      tenker: '<path d="M80 125 L58 142 L50 130"/><path d="M80 125 L100 112 L92 92"/>'
    },
    oyne: {
      vanlig: '<ellipse cx="62" cy="58" rx="13" ry="18"/><ellipse cx="88" cy="58" rx="13" ry="18"/><circle class="dm-pupill" cx="66" cy="56" r="3.6"/><circle class="dm-pupill" cx="90" cy="56" r="3.6"/>',
      ler: '<path d="M50 60 Q62 48 74 60"/><path d="M76 60 Q88 48 100 60"/>',
      tenker: '<ellipse cx="62" cy="58" rx="13" ry="18"/><ellipse cx="88" cy="58" rx="13" ry="18"/><circle class="dm-pupill" cx="66" cy="48" r="3.6"/><circle class="dm-pupill" cx="92" cy="48" r="3.6"/>'
    },
    bryn: {
      irritert: '<path d="M48 34 L74 44"/><path d="M78 44 L102 34"/>',
      trist: '<path d="M50 42 L72 34"/><path d="M80 34 L100 42"/>',
      glad: '<path d="M50 34 Q62 28 72 34"/><path d="M78 34 Q90 28 100 34"/>'
    },
    munn: {
      noytral: 'M66 88 Q80 98 94 87', glad: 'M62 85 Q80 104 98 84', ler: 'M60 84 Q80 114 100 82 Z',
      irritert: 'M66 95 Q80 87 94 95', trist: 'M66 97 Q80 85 94 97', tenker: 'M70 92 Q80 90 90 91',
      apen: 'M68 86 Q80 104 92 86 Q80 92 68 86', halv: 'M68 89 Q80 97 92 89 Q80 91 68 89'
    }
  };
  function figurSvg(humor) {
    var arm = FIGUR.armer[humor] || FIGUR.armer.vanlig, oy = FIGUR.oyne[humor] || FIGUR.oyne.vanlig, br = FIGUR.bryn[humor] || '';
    return '<svg class="dm-figur" viewBox="0 0 160 230" aria-hidden="true">' + FIGUR.kropp + arm + oy + br +
      '<path class="dm-munn" d="' + (FIGUR.munn[humor] || FIGUR.munn.noytral) + '"/></svg>';
  }

  // ------------------------------------------------------------ tilstand
  var LAGER = 'dashman-samtale';
  var samtale = []; try { samtale = JSON.parse(sessionStorage.getItem(LAGER) || '[]'); } catch (e) {}
  function lagre() { try { sessionStorage.setItem(LAGER, JSON.stringify(samtale.slice(-40))); } catch (e) {} }
  var humor = 'noytral', opptatt = false, profil = null;

  // ------------------------------------------------------------ DOM
  var knapp = document.createElement('button');
  knapp.type = 'button'; knapp.className = 'dm-knapp'; knapp.setAttribute('aria-label', 'Snakk med Dashman');
  knapp.innerHTML = figurSvg('glad') + '<span>Spør Dashman</span>';
  var panel = document.createElement('section');
  panel.className = 'dm-panel'; panel.hidden = true; panel.setAttribute('aria-label', 'Samtale med Dashman');
  panel.innerHTML =
    '<div class="dm-scene"><div class="dm-holder">' + figurSvg('noytral') + '</div></div>' +
    '<div class="dm-boble">' +
      '<div class="dm-topp"><b>Dashman</b><span class="dm-verktoy">' +
        '<button type="button" data-h="husker" title="Hva Dashman husker om deg">Hva husker du?</button>' +
        '<button type="button" data-h="ny" title="Start en ny samtale">Ny samtale</button>' +
        '<button type="button" data-h="lukk" aria-label="Lukk">×</button></span></div>' +
      '<div class="dm-logg" aria-live="polite"></div>' +
      '<form class="dm-skriv"><textarea rows="2" maxlength="2000" placeholder="Hva lurer du på? Fortell gjerne hvor du står fast." aria-label="Melding til Dashman"></textarea>' +
      '<button type="submit">Send</button></form>' +
      '<p class="dm-info">Dashman er en KI-veileder. Han gir hint, ikke fasit. Samtalen lagres ikke. Sjekk viktige ting med faglæreren din.</p>' +
    '</div>';
  document.body.appendChild(knapp); document.body.appendChild(panel);
  var logg = panel.querySelector('.dm-logg'), holder = panel.querySelector('.dm-holder'), felt = panel.querySelector('textarea');

  function settHumor(h) { humor = h; holder.innerHTML = figurSvg(h); holder.className = 'dm-holder dm-' + h; }
  var munnTid = null;
  function snakk(paa) {
    clearInterval(munnTid);
    var m = holder.querySelector('.dm-munn'); if (!m) return;
    if (!paa) { m.setAttribute('d', FIGUR.munn[humor] || FIGUR.munn.noytral); return; }
    var i = 0, rekke = [FIGUR.munn.apen, FIGUR.munn.halv, FIGUR.munn.noytral, FIGUR.munn.apen, FIGUR.munn.halv];
    munnTid = setInterval(function () { var mm = holder.querySelector('.dm-munn'); if (mm) mm.setAttribute('d', rekke[i++ % rekke.length]); }, 120);
  }

  // Enkel Markdown: avsnitt, fet, kursiv, kode, lister. LaTeX tas av MathJax etterpå.
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  // Formler ($…$ og $$…$$) tas ut først, så Markdown ikke ødelegger dem, og settes inn igjen som \(…\) og \[…\] for MathJax.
  function md(s) {
    var formler = [];
    s = String(s).replace(/\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g, function (_, blokk, linje) {
      formler.push(blokk != null ? '\\[' + blokk + '\\]' : '\\(' + linje + '\\)'); return '\u0000' + (formler.length - 1) + '\u0000';
    });
    return mdTekst(s).replace(/\u0000(\d+)\u0000/g, function (_, i) { return esc(formler[+i]); });
  }
  function mdTekst(s) {
    return esc(s).split(/\n{2,}/).map(function (avsnitt) {
      var l = avsnitt.split('\n');
      if (l.every(function (x) { return /^\s*([-*]|\d+\.)\s/.test(x); }))
        return '<ul>' + l.map(function (x) { return '<li>' + inline(x.replace(/^\s*([-*]|\d+\.)\s/, '')) + '</li>'; }).join('') + '</ul>';
      return '<p>' + inline(avsnitt).replace(/\n/g, '<br>') + '</p>';
    }).join('');
  }
  function inline(s) { return s.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>'); }
  function matte(el) { if (window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise([el]).catch(function () {}); }

  function visMelding(m, animer) {
    var d = document.createElement('div');
    d.className = 'dm-m ' + (m.rolle === 'dashman' ? 'dm-fra' : 'dm-til');
    logg.appendChild(d);
    if (!animer || m.rolle !== 'dashman') { d.innerHTML = m.rolle === 'dashman' ? md(m.tekst) : '<p>' + esc(m.tekst).replace(/\n/g, '<br>') + '</p>'; matte(d); logg.scrollTop = logg.scrollHeight; return Promise.resolve(); }
    // Dashman «snakker»: teksten kommer fram ord for ord mens munnen går.
    var ord = m.tekst.split(/(\s+)/), i = 0;
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
    if (!samtale.length) visMelding({ rolle: 'dashman', tekst: 'Hei! Jeg er Dashman. Jeg gir deg ikke fasiten, men jeg hjelper deg å finne den selv. Hva jobber du med?' });
    samtale.forEach(function (m) { visMelding(m); });
    visNivavalg();
  }

  // Nivå: spør én gang hvis det mangler i profilen.
  function visNivavalg() {
    if (!profil || profil.niva) return;
    var d = document.createElement('div'); d.className = 'dm-m dm-fra dm-niva';
    d.innerHTML = '<p>Først: hvilket nivå er du på? Da kan jeg tilpasse meg deg.</p><p>' +
      [['forkurs', 'Forkurs'], ['ingenior', 'Ingeniør'], ['fordypning', 'Fordypning']].map(function (n) { return '<button type="button" data-niva="' + n[0] + '">' + n[1] + '</button>'; }).join(' ') + '</p>';
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

  function send(tekst) {
    if (opptatt || !tekst.trim()) return;
    opptatt = true; panel.classList.add('dm-venter');
    var m = { rolle: 'student', tekst: tekst.trim().slice(0, 2000) };
    samtale.push(m); lagre(); visMelding(m); settHumor('tenker');
    var tenk = document.createElement('div'); tenk.className = 'dm-m dm-fra dm-tenker'; tenk.innerHTML = '<p><span></span><span></span><span></span></p>'; logg.appendChild(tenk); logg.scrollTop = logg.scrollHeight;
    token().then(function (t) {
      if (!t) throw { melding: 'Du må logge inn på nytt for å snakke med Dashman.' };
      return fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify({ meldinger: samtale, side: sideInfo() }) });
    }).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw { melding: d.feil }; return d; }); })
      .then(function (d) {
        tenk.remove(); settHumor(d.humor || 'noytral');
        var svar = { rolle: 'dashman', tekst: d.svar }; samtale.push(svar); lagre();
        return visMelding(svar, true);
      })
      .catch(function (e) {
        tenk.remove(); samtale.pop(); lagre(); settHumor('trist');
        var f = document.createElement('div'); f.className = 'dm-m dm-fra dm-feil';
        f.innerHTML = '<p>' + esc((e && e.melding) || 'Jeg fikk ikke svart nå. Prøv igjen om litt.') + '</p>'; logg.appendChild(f); logg.scrollTop = logg.scrollHeight;
        felt.value = m.tekst;
      })
      .then(function () { opptatt = false; panel.classList.remove('dm-venter'); felt.focus(); });
  }

  // ------------------------------------------------------------ hendelser
  knapp.addEventListener('click', function () {
    panel.hidden = false; knapp.hidden = true; settHumor('glad');
    if (profil === null) hentProfil().then(function (p) { profil = p; visAlt(); }); else visAlt();
    setTimeout(function () { felt.focus(); }, 50);
  });
  panel.querySelector('.dm-skriv').addEventListener('submit', function (e) { e.preventDefault(); var t = felt.value; felt.value = ''; send(t); });
  felt.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); panel.querySelector('.dm-skriv').requestSubmit(); } });
  panel.addEventListener('click', function (e) {
    var h = e.target.getAttribute && e.target.getAttribute('data-h');
    if (h === 'lukk') { panel.hidden = true; knapp.hidden = false; knapp.focus(); }
    if (h === 'ny') { samtale = []; lagre(); settHumor('glad'); visAlt(); }
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
})();
