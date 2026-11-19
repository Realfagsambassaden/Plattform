// Oppgaver: «Få et hint» (KI-hint via hint-tjeneren) og «Vis svar» (bare sluttsvaret, ::: {.fasit}).
// Løsningsforslagene står ikke i lærebøkene (de kan brukes i øvingsopplegg): de ligger i det private repoet og
// hentes av hint-tjeneren. Undervisere og admin får knappen «Løsningsforslag (lærer)» (/losning).
// Etter et hint: innloggede kan fortsette med Dashman (assets/js/dashman.js) om oppgaven; andre får lenke til innlogging.
// Er studenten påmeldt et fag der faglæreren har satt Dashman i fase 4 (selvstendighet) eller av, svarer tjenesten
// at hint er slått av.
// Bruk i en .qmd-fil:
//   ::: {.oppgave niva="Middels"}
//   Oppgavetekst …
//   ::: {.fasit}
//   a) $4.5\,\mathrm{MJ}$ · b) $12\,^\circ\mathrm{C}$
//   :::
//   :::
(function () {
  var meta = document.querySelector('meta[name="fysikkhjelp-hint-api"]');
  var API = meta ? meta.getAttribute('content') : '';
  var MAX_HINT = 3;
  var SB = (document.querySelector('meta[name="supabase-url"]') || {}).content || '';
  function innlogget() { try { return !!SB && !!localStorage.getItem('sb-' + SB.split('//')[1].split('.')[0] + '-auth-token'); } catch (e) { return false; } }
  function token() {
    if (!innlogget() || !window.fhKonto) return Promise.resolve(null);
    return window.fhKonto().then(function (k) { return k.auth.getSession(); }).then(function (r) { return r && r.data && r.data.session && r.data.session.access_token; }).catch(function () { return null; });
  }
  var emne = ((document.querySelector('h1.title') || {}).textContent || document.title) + ' – ' + ((document.querySelector('.subtitle') || {}).textContent || '');

  // Er brukeren underviser eller admin? (Spørres én gang per side.)
  var laerer = null;
  function erLaerer() {
    if (!laerer) laerer = !innlogget() || !window.fhKonto ? Promise.resolve(false)
      : window.fhKonto().then(function (k) { return k.rpc('min_rolle'); }).then(function (r) { return r && (r.data === 'underviser' || r.data === 'admin'); }).catch(function () { return false; });
    return laerer;
  }
  var LOS_API = API.replace(/\/hint\/?$/, '/losning');

  document.querySelectorAll('div.oppgave').forEach(function (opp, i) {
    var oppId = location.pathname + '#' + i;
    // Gammelt oppsett med løsning i læreboka vises som før; nytt oppsett har bare fasit.
    var los = opp.querySelector(':scope > .losning') || opp.querySelector(':scope > .fasit');
    var erFasit = !!(los && los.classList.contains('fasit'));
    var niva = opp.getAttribute('data-niva') || opp.getAttribute('niva') || '';
    var tittel = opp.getAttribute('data-tittel') || opp.getAttribute('tittel') || '';
    var tEl = opp.querySelector(':scope > p > .oppg-tittel, :scope > .oppg-tittel'); if (tEl) { var par = tEl.closest('p'); (par && par.parentNode === opp && par.textContent.trim() === tEl.textContent.trim() ? par : tEl).remove(); }

    // Oppgaveteksten = alt utenom løsningen
    var tekstDeler = [];
    Array.prototype.forEach.call(opp.children, function (ch) { if (ch !== los) tekstDeler.push(ch.textContent.trim()); });
    var oppgavetekst = (tittel ? tittel + '\n' : '') + tekstDeler.join('\n');
    var losningstekst = los ? los.textContent.trim() : '';

    var hode = document.createElement('div');
    hode.className = 'oppg-hode';
    hode.innerHTML = '<span class="nr">Oppgave</span>' + (tittel ? '<span class="tt"></span>' : '') + (niva ? '<span class="niva"></span>' : '');
    if (tittel) hode.querySelector('.tt').textContent = tittel;
    if (niva) hode.querySelector('.niva').textContent = niva;
    opp.insertBefore(hode, opp.firstChild);

    var verktoy = document.createElement('div');
    verktoy.className = 'oppg-verktoy';
    verktoy.innerHTML = '<button type="button" class="hint" aria-expanded="false">Få et hint</button>' +
                        (los ? '<button type="button" class="vis" aria-expanded="false">' + (erFasit ? 'Vis svar' : 'Vis løsning') + '</button>' : '') +
                        '<button type="button" class="laerer-los" hidden>Løsningsforslag (lærer)</button>' +
                        // Skann: ta bilde av den håndskrevne løsningen i studieappen, som henter oppgaven og løsningsforslaget fra oppgaver.json
                        '<a class="skann" href="/studie/index.html#skann=' + encodeURIComponent(location.pathname + '#' + i) + '">📷 Skann løsningen din</a>';
    var panel = document.createElement('div');
    panel.className = 'hint-panel'; panel.hidden = true;
    var id = 'forsok-' + (i + 1);
    panel.innerHTML = '<label for="' + id + '">Hva har du prøvd så langt? (valgfritt)</label>' +
      '<textarea id="' + id + '" placeholder="For eksempel: Jeg ganget 50 med 20 og fikk 1000 J, men fasiten er annerledes."></textarea>' +
      '<div><button type="button" class="hint send">Send og få hint</button></div>' +
      '<div class="hint-liste" aria-live="polite"></div>';
    if (los) { los.hidden = true; opp.insertBefore(verktoy, los); opp.insertBefore(panel, los); }
    else { opp.appendChild(verktoy); opp.appendChild(panel); }

    var visBtn = verktoy.querySelector('.vis');
    if (visBtn) visBtn.addEventListener('click', function () {
      los.hidden = !los.hidden;
      visBtn.textContent = los.hidden ? (erFasit ? 'Vis svar' : 'Vis løsning') : (erFasit ? 'Skjul svar' : 'Skjul løsning');
      visBtn.setAttribute('aria-expanded', String(!los.hidden));
      if (!los.hidden && window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise([los]);
    });

    // Undervisere: løsningsforslaget fra det private repoet, vist under oppgaven.
    var lBtn = verktoy.querySelector('.laerer-los'), lBoks = null;
    erLaerer().then(function (ja) { if (ja) lBtn.hidden = false; });
    lBtn.addEventListener('click', function () {
      if (lBoks) { lBoks.hidden = !lBoks.hidden; return; }
      lBtn.disabled = true;
      token().then(function (t) { return fetch(LOS_API, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify({ id: oppId }) }); })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          lBoks = document.createElement('div'); lBoks.className = 'losning laerer-losning';
          var md = (j && j.losning) || (j && j.feil) || 'Det finnes ikke noe løsningsforslag til denne oppgaven.';
          lBoks.innerHTML = '<p class="laerer-merke">Løsningsforslag – bare for undervisere</p>' + md.split(/\n{2,}/).map(function (p) {
            return '<p>' + p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>') + '</p>'; }).join('');
          panel.after(lBoks);
          if (window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise([lBoks]);
        })
        .catch(function () { alert('Fikk ikke hentet løsningsforslaget.'); })
        .then(function () { lBtn.disabled = false; });
    });

    var hintBtn = verktoy.querySelector('.hint');
    hintBtn.addEventListener('click', function () {
      panel.hidden = !panel.hidden;
      hintBtn.setAttribute('aria-expanded', String(!panel.hidden));
      if (!panel.hidden) panel.querySelector('textarea').focus();
    });

    var liste = panel.querySelector('.hint-liste');
    var send = panel.querySelector('.send');
    var tidligere = [];
    send.addEventListener('click', function () {
      if (tidligere.length >= MAX_HINT) { vis('Du har fått tre hint på denne oppgaven. Prøv litt selv, eller snakk med Dashman om den.', true); return; }
      if (!API || API.indexOf('DITTNAVN') >= 0) { vis('Hint-tjenesten er ikke satt opp ennå.', true); return; }
      send.disabled = true; send.textContent = 'Tenker …';
      token().then(function (t) { return fetch(API, {
        method: 'POST',
        headers: t ? { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t } : { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emne: emne.trim(),
          id: oppId,
          oppgave: oppgavetekst,
          losning: erFasit ? '' : losningstekst,
          forsok: panel.querySelector('textarea').value.slice(0, 1500),
          tidligereHint: tidligere
        })
      }); }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) { var f = new Error(j.feil || 'Hint-tjenesten svarte ikke (' + r.status + ').'); f.sperret = !!j.sperret; throw f; }
          return j;
        });
      }).then(function (j) {
        tidligere.push(j.hint);
        vis(j.hint, false, tidligere.length);
        videre();
      }).catch(function (e) {
        if (e.sperret) { vis(e.message, true); return; }
        vis(e instanceof TypeError ? 'Fikk ikke kontakt med hint-tjenesten. Prøv igjen om litt.' : (e.message || 'Noe gikk galt. Prøv igjen om litt.'), true);
      }).finally(function () {
        send.disabled = false;
        send.textContent = tidligere.length ? 'Gi meg et hint til' : 'Send og få hint';
      });
    });
    // Videre med Dashman: oppgaven, forsøket, hintene og løsningen (som Dashman ikke viser) sendes med.
    function videre() {
      var gml = panel.querySelector('.hint-videre'); if (gml) gml.remove();
      var d = document.createElement('div'); d.className = 'hint-videre';
      if (innlogget()) {
        d.innerHTML = '<button type="button" class="hint-dashman">Snakk med Dashman om denne oppgaven</button>';
        d.querySelector('button').addEventListener('click', function () {
          window.dispatchEvent(new CustomEvent('dashman:oppgave', { detail: {
            emne: emne.trim(), tittel: tittel, oppgave: oppgavetekst, losning: erFasit ? '' : losningstekst, id: oppId,
            forsok: panel.querySelector('textarea').value.slice(0, 1500), hint: tidligere.slice()
          } }));
        });
      } else {
        d.innerHTML = 'Står du fortsatt fast? <a href="/konto/">Logg inn</a> for å jobbe videre med Dashman, læringspartneren vår.';
      }
      liste.after(d);
    }
    function vis(tekst, feil, n) {
      var d = document.createElement('div');
      d.className = 'hint-svar' + (feil ? ' feil' : '');
      var t = document.createElement('div'); t.className = 'hint-tittel'; t.textContent = feil ? 'Obs' : 'Hint ' + n;
      var p = document.createElement('div'); p.textContent = tekst;
      d.appendChild(t); d.appendChild(p); liste.appendChild(d);
      if (window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise([d]);
    }
  });
})();

// Eksempler: løsningen (::: {.losning} inne i ::: {.eksempel}) skjules bak «Vis løsning».
(function () {
  document.querySelectorAll('div.eksempel').forEach(function (eks) {
    var los = eks.querySelector(':scope > .losning'); if (!los) return;
    eks.classList.add('eks-skjult');
    var knapp = document.createElement('button');
    knapp.type = 'button'; knapp.className = 'eks-vis'; knapp.setAttribute('aria-expanded', 'false');
    knapp.textContent = 'Vis løsning';
    eks.insertBefore(knapp, los);
    knapp.addEventListener('click', function () {
      var apen = eks.classList.toggle('eks-apen');
      knapp.setAttribute('aria-expanded', String(apen));
      knapp.textContent = apen ? 'Skjul løsning' : 'Vis løsning';
    });
  });
})();
