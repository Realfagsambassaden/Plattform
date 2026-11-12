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
  function innlogget() { try { return !!localStorage.getItem(lagringsnavn); } catch (e) { return false; } }
  if (!innlogget()) return;

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

  // ------------------------------------------------------------ DOM
  var knapp = document.createElement('button');
  knapp.type = 'button'; knapp.className = 'dm-knapp'; knapp.setAttribute('aria-label', 'Snakk med Dashman');
  knapp.innerHTML = '<img class="dm-ikon" alt="" src="' + BILDER + 'ikon.webp"><span>Spør Dashman</span>';
  var panel = document.createElement('section');
  panel.className = 'dm-panel'; panel.hidden = true; panel.setAttribute('aria-label', 'Samtale med Dashman');
  panel.innerHTML =
    '<div class="dm-scene"><div class="dm-holder"></div></div>' +
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
    forhandslast(); panel.hidden = false; knapp.hidden = true; settHumor('glad');
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
