// Studieappen (fysikkhjelp.no/studie/): temavalg, løype, ukens quiz med tilpasset nivå, kunnskapsprofil og kurs.
// Data lagres i Supabase (tabellene studie_* og kurs*, se supabase/oppsett.sql). Én konto og én profil for alle
// nettstedene: svarene merkes med nettsted, og temavalget lagres som «nettsted/tema».
// KI-vurdering og eksamensråd går via hint-tjeneren (/vurder og /rad i hint-tjener/worker.js).
// Spørsmålene ligger i studie/sporsmal.json (lages av verktoy/sporsmal/lag_bank.py).
(function vent(n) {
  if (!window.fhKonto && (n || 0) < 100) return setTimeout(function () { vent((n || 0) + 1); }, 50);   // konto.js lastes etter denne
  studieStart();
})();

function studieStart() {
  'use strict';
  var rot = document.getElementById('studie');
  var NETTSTED = ((document.querySelector('meta[name="nettsted-navn"]') || {}).content || 'fysikkhjelp.no').replace(/\.no$/, '');
  var apiMeta = (document.querySelector('meta[name="fysikkhjelp-hint-api"]') || {}).content || '';
  var API = apiMeta.replace(/\/hint\/?$/, '');
  var NIV = ['lett', 'middels', 'vanskelig'], VEKT = { lett: 1, middels: 1.5, vanskelig: 2 };
  var OKT = 6, REP = 2, PER_DAG = 2;
  var S = {}, Q = [], k = null, bruker = null;
  var T = { vis: 'hjem', inn: null, svar: [], ukevurd: {}, deltar: [], mine: [], q: null };

  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var pst = function (v) { return v == null ? '–' : Math.round(v * 100) + ' %'; };

  // ---------------------------------------------------------------- formler
  // Gjengir den delen av LaTeX som spørsmålene bruker (variabler i kursiv, konstanter og enheter oppreist, jf. NOTASJON.md).
  var SYM = { cdot: '·', Delta: 'Δ', pi: 'π', theta: 'θ', mu: 'μ', omega: 'ω', alpha: 'α', tau: 'τ', eta: 'η', varepsilon: 'ε', int: '∫', hbar: 'ħ',
    approx: '≈', times: '×', Rightarrow: '⇒', rightarrow: '→', to: '→', leq: '≤', geq: '≥', le: '≤', ge: '≥', neq: '≠', pm: '±', infty: '∞', circ: '°',
    sum: 'Σ', sigma: 'σ', rho: 'ρ', lambda: 'λ', phi: 'φ', varphi: 'φ', gamma: 'γ', beta: 'β', epsilon: 'ε', Omega: 'Ω', ldots: '…', dots: '…',
    quad: ' ', qquad: '  ', left: '', right: '', displaystyle: '' };
  var FUNK = { sin: 1, cos: 1, tan: 1 };
  function mat(s, rett) {
    var o = '', i = 0;
    function arg() {
      while (s[i] === ' ') i++;
      var j, d;
      if (s[i] === '\\') {
        var m = /^\\[A-Za-z]+/.exec(s.slice(i)); j = i + (m ? m[0].length : 1);
        if (s[j] === '{') { d = 0; do { if (s[j] === '{') d++; if (s[j] === '}') d--; j++; } while (d > 0 && j < s.length); }
        var a0 = s.slice(i, j); i = j; return a0;
      }
      if (s[i] === '{') { j = i; d = 0; do { if (s[j] === '{') d++; if (s[j] === '}') d--; j++; } while (d > 0 && j < s.length); var a = s.slice(i + 1, j - 1); i = j; return a; }
      return s[i++] || '';
    }
    while (i < s.length) {
      var c = s[i];
      if (c === '\\') {
        i++; var m = /^[A-Za-z]+/.exec(s.slice(i));
        if (!m) { i++; o += ' '; continue; }
        var n = m[0]; i += n.length;
        if (n === 'mathrm' || n === 'text') o += mat(arg(), true);
        else if (n === 'frac') { var a = arg(), b = arg(); o += '<span class="st-brok"><span>' + mat(a, rett) + '</span><span>' + mat(b, rett) + '</span></span>'; }
        else if (n === 'sqrt') o += '√(' + mat(arg(), rett) + ')';
        else if (n === 'vec') o += mat(arg(), rett) + '⃗';
        else if (n === 'underline' || n === 'boxed') o += mat(arg(), rett);
        else if (FUNK[n]) o += ' ' + n + ' ';
        else o += SYM[n] || n;
      } else if (c === '^' || c === '_') { i++; var t = c === '^' ? 'sup' : 'sub'; o += '<' + t + '>' + mat(arg(), rett) + '</' + t + '>'; }
      else if (/[A-Za-z]/.test(c)) { o += rett ? c : '<i>' + c + '</i>'; i++; }
      else { o += esc(c); i++; }
    }
    return o;
  }
  // Tekst med formler: $$ … $$ (og \[ … \]) blir en formel på egen linje, $ … $ en formel i teksten.
  // Forståelse, presisjon og hurtighet får hver sin faste farge (samme som stolpene), så studenten finner dem igjen.
  var ORD = { 'forståelse': 'f', 'presisjon': 'p', 'hurtighet': 'h' };
  function fargeOrd(h) { return h.replace(/(forståelse|presisjon|hurtighet)[a-zæøå]*/gi, function (m, rot) { return '<span class="st-ord ' + ORD[rot.toLowerCase()] + '">' + m + '</span>'; }); }
  function txLinje(s) { return s.split('$').map(function (d, i) { return i % 2 ? '<span class="st-mat">' + mat(d) + '</span>' : fargeOrd(esc(d).replace(/\s*\n\s*/g, ' ')); }).join(''); }
  var tx = function (s) {
    return String(s || '').replace(/\\\[([\s\S]*?)\\\]/g, function (_, f) { return '$$' + f + '$$'; }).split('$$').map(function (d, i) {
      return i % 2 ? '<div class="st-formel">' + mat(d.trim()) + '</div>' : txLinje(d.trim());
    }).join('');
  };

  // ---------------------------------------------------------------- data
  var nokkel = function (t) { return NETTSTED + '/' + t; };
  var valgt = function () { return (T.inn.valgt || []).filter(function (x) { return x.indexOf(NETTSTED + '/') === 0; }).map(function (x) { return x.slice(NETTSTED.length + 1); }).filter(function (t) { return S[t]; }); };
  var niva = function (t) { var n = (T.inn.niva || {})[nokkel(t)]; return typeof n === 'number' ? n : 1; };
  var eff = function (s) { var v = s.ki && s.ki.vurdering; return v === 'riktig' || v === 'regnefeil' || v === 'begrep' ? v : s.type; };
  // Undertemasider finnes bare når det er stoff om dem (se verktoy/tema.py). FINNES lages fra loyper.json:
  // adressen til undertemasiden → sidene om undertemaet ({ url, tittel }).
  var FINNES = null;
  var temaUrl = function (t, u) {
    var sti = '/tema/' + S[t].omrade + '/' + t + (u ? '/' + u : '') + '.html';
    return u && FINNES && !FINNES[sti] ? null : '..' + sti;
  };
  var tittel = function (t) { return S[t] ? S[t].tittel : t; };

  function feilmelding(e) {
    var m = (e && (e.message || e.feil)) || String(e || '');
    if (/relation .* does not exist|schema cache/i.test(m)) return 'Databasen er ikke satt opp for studieappen ennå.';
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Fikk ikke kontakt. Sjekk nettforbindelsen.';
    return m || 'Noe gikk galt.';
  }
  function varsle(tekst, feil) {
    var el = document.getElementById('st-varsel');
    if (!el) return;
    el.textContent = tekst; el.className = 'st-varsel' + (feil ? ' feil' : ''); el.hidden = false;
    clearTimeout(varsle.t); varsle.t = setTimeout(function () { el.hidden = true; }, feil ? 8000 : 3000);
  }
  var sjekk = function (r) { if (r.error) throw r.error; return r.data; };

  function lagreInn() {
    T.inn.endret = new Date().toISOString();
    return k.from('studie_innstillinger').upsert({ eier: bruker.id, valgt: T.inn.valgt, modus: T.inn.modus, repetisjon: T.inn.repetisjon, varsler: T.inn.varsler, niva: T.inn.niva, endret: T.inn.endret })
      .then(sjekk).catch(function (e) { varsle('Fikk ikke lagret: ' + feilmelding(e), true); });
  }
  function fraRad(r) {
    return { dbid: r.id, id: r.sporsmal, nettsted: r.nettsted, tema: r.tema, undertema: r.undertema, v: r.vanskelighet, type: r.type,
             tid: r.tid_s, forv: r.forventet_s, rep: r.repetisjon, ki: r.ki, dato: r.opprettet };
  }
  function hentAlt() {
    return Promise.all([
      k.from('studie_innstillinger').select('*').eq('eier', bruker.id).maybeSingle().then(sjekk),
      k.from('studie_svar').select('*').eq('eier', bruker.id).order('opprettet').limit(5000).then(sjekk),
      k.from('studie_ukevurdering').select('*').eq('eier', bruker.id).then(sjekk),
      k.from('kurs_deltaker').select('kurs, samtykke_innsyn, pameldt, kursinfo:kurs ( id, navn, krev_innsyn, temaer, beskrivelse )').eq('student', bruker.id).then(sjekk),
      k.from('kurs').select('*').eq('eier', bruker.id).order('opprettet').then(sjekk),
      k.from('ovelser').select('*').order('opprettet').then(sjekk),
      k.from('studie_quiz').select('*').eq('eier', bruker.id).then(sjekk),
    ]).then(function (r) {
      T.ovelser = r[5] || []; T.quizer = r[6] || [];
      T.inn = r[0] || { valgt: [], modus: 'alle', repetisjon: true, varsler: true, niva: {} };
      T.ny = !r[0];
      T.svar = r[1].map(fraRad);
      T.ukevurd = {}; r[2].forEach(function (x) { if (x.nettsted === NETTSTED) T.ukevurd[x.tema] = x.vurdering; });
      T.deltar = r[3]; T.mine = r[4];
      if (!erUnderviser() || T.eksempel) return;
      return Promise.all(T.mine.map(function (c) { return k.rpc('kurs_antall', { k: c.id }).then(function (x) { c.antall = x.data; }); }));
    });
  }

  // ---------------------------------------------------------------- kunnskapsprofil
  // Forståelse: riktig tanke (riktig svar eller regnefeil), vektet etter vanskelighet. Presisjon: riktig blant dem med riktig tanke.
  // Hurtighet: riktig innen forventet tid. Har KI vurdert forklaringen, gjelder KI-vurderingen.
  function skar(l) {
    if (!l.length) return null;
    var v = 0, sv = 0, tanke = 0, rett = 0, fort = 0, ki = 0;
    l.forEach(function (s) {
      var e = eff(s); sv += VEKT[s.v] || 1;
      if (e !== 'begrep') { v += VEKT[s.v] || 1; tanke++; }
      if (e === 'riktig') { rett++; if (s.tid != null && s.forv && s.tid <= s.forv) fort++; }
      if (s.ki && s.ki.vurdering && s.ki.vurdering !== 'uklar') ki++;
    });
    return { n: l.length, f: v / sv, p: tanke ? rett / tanke : null, h: rett ? fort / rett : null, ki: ki };
  }
  var mineSvar = function (t, u) { return T.svar.filter(function (s) { return s.nettsted === NETTSTED && s.tema === t && (!u || s.undertema === u); }); };
  function stolpe(navn, v, kl) { return '<div class="st-stolpe"><span class="st-ord ' + kl + '">' + navn + '</span><div class="st-bar"><i class="' + kl + '" style="width:' + (v == null ? 0 : Math.round(v * 100)) + '%"></i></div><span class="st-sm">' + pst(v) + '</span></div>'; }
  function stolper(s) { return stolpe('Forståelse', s.f, 'f') + stolpe('Presisjon', s.p, 'p') + stolpe('Hurtighet', s.h, 'h'); }
  function profilRader() {
    var r = [];
    valgt().forEach(function (t) { Object.keys(S[t].undertemaer).forEach(function (u) { var s = skar(mineSvar(t, u)); if (s) r.push({ t: t, u: u, s: s }); }); });
    return r;
  }
  // Råd om eksamensforberedelse: tre kort i fast rekkefølge (forståelse → presisjon → hurtighet), hvert med undertemaene
  // det gjelder (lenket til stoffet), konkrete tiltak og eventuelt en nøkkelformel. Samme visning for enkle regler og KI.
  var RAD_DELER = [
    { k: 'forstaelse', kl: 'f', navn: 'Forståelse', merk: 'Viktigst', tom: 'Ingenting å jobbe med her nå' },
    { k: 'presisjon', kl: 'p', navn: 'Presisjon', merk: '', tom: 'Ingenting å jobbe med her nå' },
    { k: 'hurtighet', kl: 'h', navn: 'Hurtighet', merk: 'Minst viktig, men gir bedre tid på eksamen', tom: 'Ingenting å jobbe med her nå' },
  ];
  function undertemaLenke(x) {
    var url = temaUrl(x.t, x.u), sider = (FINNES && FINNES['/tema/' + S[x.t].omrade + '/' + x.t + '/' + x.u + '.html']) || [];
    return '<div class="st-rad-ut"><a href="' + (url || temaUrl(x.t)) + '">' + esc(S[x.t].undertemaer[x.u]) + '</a>' +
      (sider.length ? '<span class="st-sm"> Les: ' + sider.slice(0, 2).map(function (y) { return '<a href="' + y.url + '">' + esc(y.tittel || 'side') + '</a>'; }).join(' · ') + '</span>'
        : url ? '' : '<span class="st-sm"> (lærestoff kommer)</span>') + '</div>';
  }
  function radKort(r) {
    return '<div class="st-rad-kort">' + RAD_DELER.map(function (d, i) {
      var x = r[d.k] || {}, ut = x.undertemaer || [], tiltak = x.tiltak || [];
      var tom = !ut.length && !tiltak.length;
      return '<div class="st-rad-del ' + d.kl + (tom ? ' tom' : '') + '"><div class="st-rad-hode"><span class="st-rad-nr">' + (i + 1) + '</span><b class="st-ord ' + d.kl + '">' + d.navn + '</b>' +
        (d.merk ? '<span class="st-sm">' + d.merk + '</span>' : '') + '</div>' +
        (tom ? '<p class="st-sm">' + (x.ingenData ? 'Ikke nok svar ennå' : '✓ ' + d.tom) + '</p>' :
          ut.map(undertemaLenke).join('') +
          (tiltak.length ? '<ul>' + tiltak.map(function (t) { return '<li>' + txLinje(t) + '</li>'; }).join('') + '</ul>' : '') +
          (x.formel ? '<div class="st-formel">' + mat(x.formel) + '</div>' : '')) + '</div>';
    }).join('<div class="st-rad-pil" aria-hidden="true">↓</div>') + '</div>';
  }
  function regelRad() {
    var r = profilRader();
    if (!r.length) return '<p class="st-ind">Ta en quiz, så får du råd her.</p>';
    function min(kk, g) { return r.filter(function (x) { return x.s[kk] != null && x.s[kk] < g; }).sort(function (a, b) { return a.s[kk] - b.s[kk]; }).slice(0, 2); }
    var f = min('f', 0.7), p = min('p', 0.7), h = min('h', 0.6);
    var ingen = function (kk) { return !r.some(function (x) { return x.s[kk] != null; }); };
    return radKort({
      forstaelse: { undertemaer: f, tiltak: f.length ? ['Les teorien og se videoen før du regner mer.', 'Forklar med egne ord hvorfor fasiten blir som den blir.'] : [] },
      presisjon: { undertemaer: p, ingenData: ingen('p'), tiltak: p.length ? ['Skriv alle mellomregninger og enheter.', 'Gjør et overslag og sjekk at svaret er rimelig.'] : [] },
      hurtighet: { undertemaer: h, ingenData: ingen('h'), tiltak: h.length ? ['Regn oppgaver med tidtaking.'] : [] },
    });
  }
  // KI svarer med navnene på undertemaene. Finn dem igjen i profilen, så de kan lenkes.
  function fraKi(rad) {
    var rader = profilRader(), ut = {};
    RAD_DELER.forEach(function (d) {
      var x = rad[d.k] || {};
      ut[d.k] = { tiltak: x.tiltak || [], formel: x.formel || '', undertemaer: (x.undertemaer || []).map(function (navn) {
        var n = String(navn).trim().toLowerCase();
        return rader.find(function (y) { return S[y.t].undertemaer[y.u].toLowerCase() === n; }) || null;
      }).filter(Boolean) };
    });
    return ut;
  }

  // ---------------------------------------------------------------- quiz
  var idag = function () { return new Date().toISOString().slice(0, 10); };
  function iDag(t) { return T.svar.filter(function (s) { return s.nettsted === NETTSTED && s.tema === t && !s.rep && String(s.dato || '').slice(0, 10) === idag(); }).length; }
  function denneUken(t) { var g = Date.now() - 7 * 864e5; return T.svar.filter(function (s) { return s.nettsted === NETTSTED && s.tema === t && !s.rep && Date.parse(s.dato) >= g; }).length; }

  // To riktige på rad gir ett nivå opp, begrepsfeil ett ned, regnefeil beholder nivået (tanken var riktig).
  function velgNeste(t, brukt) {
    var n = niva(t), rek = [n, n - 1, n + 1, n - 2, n + 2];
    for (var i = 0; i < rek.length; i++) {
      if (rek[i] < 0 || rek[i] > 2) continue;
      var l = Q.filter(function (x) { return x.tema === t && x.vanskelighet === NIV[rek[i]] && brukt.indexOf(x.id) < 0; });
      if (!l.length) continue;
      var usett = l.filter(function (x) { return !T.svar.some(function (s) { return s.id === x.id; }); });
      var u = usett.length ? usett : l;
      return u[Math.floor(Math.random() * u.length)];
    }
    return null;
  }
  function repSp(q) {
    var andre = T.svar.filter(function (s) { return s.nettsted === NETTSTED && s.tema !== q.tema && q.brukt.indexOf(s.id) < 0; });
    var feil = andre.filter(function (s) { return eff(s) !== 'riktig'; });
    var kilde = feil.length ? feil : andre;
    for (var i = 0; i < 10 && kilde.length; i++) {
      var s = kilde[Math.floor(Math.random() * kilde.length)], x = Q.find(function (y) { return y.id === s.id; });
      if (x) return x;
    }
    return null;
  }
  // Obligatorisk øving: godkjent når en quiz for øvingen har minst «krav» riktige innen fristen.
  function godkjent(o) { return (T.quizer || []).some(function (q) { return q.ovelse === o.id && q.riktige >= o.krav && (!o.frist || Date.parse(q.fullfort) <= Date.parse(o.frist)); }); }
  function mineOvelser() { var mine = T.deltar.map(function (d) { return d.kurs; }); return (T.ovelser || []).filter(function (o) { return mine.indexOf(o.kurs) >= 0; }); }
  function startOvelse(id) {
    var o = T.ovelser.find(function (x) { return x.id === id; }), t = o.tema.split('/')[1];
    if (!S[t]) return varsle('Temaet finnes ikke lenger.', true);
    T.q = { tema: t, nr: 0, hoved: o.antall, antall: o.antall, brukt: [], res: [], hovedRes: [], rekke: 0, ovelse: o };
    nesteSp(); ga('quiz');
  }
  // Lagres når quizen er ferdig. Øvingsquizer teller mot godkjenning.
  function avsluttQuiz() {
    var q = T.q; if (q.lagret) return; q.lagret = true;
    var antall = q.hovedRes.length; if (!antall) return;
    var riktige = q.hovedRes.filter(function (x) { return x === 'riktig'; }).length;
    var rad = { nettsted: NETTSTED, tema: q.tema, ovelse: q.ovelse ? q.ovelse.id : null, antall: antall, riktige: riktige };
    T.quizer.push(Object.assign({ fullfort: new Date().toISOString() }, rad));
    k.from('studie_quiz').insert(rad).then(sjekk).catch(function (e) { varsle('Resultatet ble ikke lagret: ' + feilmelding(e), true); });
  }
  function startQuiz(t, flere) {
    var dag = T.inn.modus === 'dag' && !flere;
    var hoved = dag ? Math.max(0, PER_DAG - iDag(t)) : OKT;
    if (!hoved) return ga('ferdigIdag', { t: t });
    // Repetisjon bare når det finnes svar fra andre temaer å repetere.
    var kandidater = {}; T.svar.forEach(function (s) { if (s.nettsted === NETTSTED && s.tema !== t && Q.some(function (x) { return x.id === s.id; })) kandidater[s.id] = 1; });
    var rep = T.inn.repetisjon ? Math.min(dag ? 1 : REP, Object.keys(kandidater).length) : 0;
    T.q = { tema: t, nr: 0, hoved: hoved, antall: hoved + rep, brukt: [], res: [], hovedRes: [], rekke: 0 };
    nesteSp();
    ga('quiz');
  }
  function nesteSp() {
    var q = T.q, x = null, rep = false;
    if (q.nr >= q.hoved) { x = repSp(q); rep = !!x; }
    if (!x && q.nr < q.hoved) x = velgNeste(q.tema, q.brukt);
    if (!x) { q.ferdig = true; return; }
    q.brukt.push(x.id);
    var alt = [{ svar: x.riktig, type: 'riktig' }].concat(x.feil).map(function (a) { return [Math.random(), a]; }).sort(function (a, b) { return a[0] - b[0]; }).map(function (a) { return a[1]; });
    stoppTale();
    q.na = Object.assign({}, x, { alt: alt, rep: rep, start: performance.now() }); q.svart = null; q.kiSvar = null; q.bilde = null; q.tekst = '';
  }
  function svar(i) {
    var q = T.q, x = q.na, a = x.alt[i], tid = (performance.now() - x.start) / 1000;
    if (q.svart != null) return;
    q.svart = i;
    var s = { id: x.id, nettsted: NETTSTED, tema: x.tema, undertema: x.undertema, v: x.vanskelighet, type: a.type, tid: tid, forv: x.forventet_tid_s, rep: x.rep, ki: null, dato: new Date().toISOString() };
    T.svar.push(s); q.res.push(a.type); if (!x.rep) q.hovedRes.push(a.type); q.sist = s;
    s.lagret = k.from('studie_svar').insert({ nettsted: NETTSTED, sporsmal: x.id, tema: x.tema, undertema: x.undertema, vanskelighet: x.vanskelighet, type: a.type,
      tid_s: Math.round(tid * 10) / 10, forventet_s: x.forventet_tid_s, repetisjon: x.rep }).select('id').single()
      .then(function (r) { s.dbid = sjekk(r).id; return s.dbid; })
      .catch(function (e) { varsle('Svaret ble ikke lagret: ' + feilmelding(e), true); });
    if (!x.rep) {
      var t = x.tema, n = niva(t);
      if (a.type === 'riktig') { q.rekke++; if (q.rekke >= 2) { n = Math.min(2, n + 1); q.rekke = 0; } }
      else { q.rekke = 0; if (a.type === 'begrep') n = Math.max(0, n - 1); }
      if (n !== niva(t)) { T.inn.niva = Object.assign({}, T.inn.niva); T.inn.niva[nokkel(t)] = n; lagreInn(); }
    }
    tegn();
  }
  function videre() {
    var q = T.q; q.nr++;
    if (q.nr >= q.antall) { avsluttQuiz(); return ga('resultat'); }
    nesteSp(); if (q.ferdig) { avsluttQuiz(); return ga('resultat'); }
    tegn(); scrollTo(0, rot.getBoundingClientRect().top + scrollY - 80);
  }

  // ---------------------------------------------------------------- KI: tale, bilde, vurdering, råd
  var Tale = window.SpeechRecognition || window.webkitSpeechRecognition;
  var lytter = null;
  // Stopp talegjenkjenningen før noe nytt vises, så den ikke skriver inn i neste spørsmål.
  function stoppTale() { if (lytter) { var l = lytter; lytter = null; l.onresult = null; try { l.abort(); } catch (e) {} } }
  function tale(knapp) {
    if (lytter) { lytter.stop(); return; }
    var felt = document.getElementById('st-forklaring');
    lytter = new Tale(); lytter.lang = 'nb-NO'; lytter.continuous = true; lytter.interimResults = false;
    lytter.onresult = function (ev) { for (var i = ev.resultIndex; i < ev.results.length; i++) if (ev.results[i].isFinal) felt.value += (felt.value && !/\s$/.test(felt.value) ? ' ' : '') + ev.results[i][0].transcript; };
    var denne = lytter;
    lytter.onend = function () { if (lytter === denne) lytter = null; if (knapp.isConnected) { knapp.textContent = '🎤 Snakk'; knapp.classList.remove('pa'); } };
    lytter.onerror = function (e) { varsle(e.error === 'not-allowed' ? 'Gi nettleseren lov til å bruke mikrofonen.' : 'Talegjenkjenningen stoppet.', true); };
    lytter.start(); knapp.textContent = '■ Stopp'; knapp.classList.add('pa');
  }
  // Bildet skaleres ned til høyst 1600 px før det sendes. Det lagres ikke noe sted.
  function lesBilde(fil) {
    return new Promise(function (ok, nei) {
      if (!fil || !/^image\//.test(fil.type)) return nei(new Error('Velg et bilde.'));
      var r = new FileReader();
      r.onload = function () {
        var img = new Image();
        img.onload = function () {
          var m = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas');
          c.width = Math.round(img.width * m); c.height = Math.round(img.height * m);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          ok(c.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = function () { nei(new Error('Klarte ikke å lese bildet. Prøv JPEG eller PNG.')); };
        img.src = r.result;
      };
      r.onerror = nei; r.readAsDataURL(fil);
    });
  }
  function ki(sti, body) {
    if (!API) return Promise.reject(new Error('KI-tjenesten er ikke satt opp ennå.'));
    return k.auth.getSession().then(function (r) {
      var tok = r.data.session && r.data.session.access_token;
      return fetch(API + sti, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify(body) });
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.feil || 'KI-tjenesten svarte ikke (' + r.status + ').'); return d; }); });
  }
  function vurder() {
    var q = T.q, x = q.na, s = q.sist, tekst = document.getElementById('st-forklaring').value.trim();
    stoppTale();
    if (!tekst && !q.bilde) return varsle('Skriv, snakk eller last opp et bilde først.', true);
    q.venter = true; tegn();
    ki('/vurder', { sporsmal: { tekst: x.tekst, riktig: x.riktig, forklaring: x.forklaring }, valgt: x.alt[q.svart].svar, forklaring: tekst, bilde: q.bilde })
      .then(function (d) {
        q.kiSvar = d; s.ki = { vurdering: d.vurdering, sikkerhet: d.sikkerhet, tilbakemelding: d.tilbakemelding, kilde: q.bilde ? 'bilde' : 'tekst' };
        return Promise.resolve(s.lagret).then(function (id) { if (id) return k.from('studie_svar').update({ ki: s.ki }).eq('id', id).then(sjekk); });
      })
      .catch(function (e) { q.kiSvar = { feil: feilmelding(e) }; })
      .then(function () { q.venter = false; q.tekst = tekst; tegn(); });
  }
  function hentRad() {
    var r = profilRader().map(function (x) { return { tema: tittel(x.t), undertema: S[x.t].undertemaer[x.u], f: x.s.f, p: x.s.p, h: x.s.h, n: x.s.n }; });
    T.kiRad = { venter: true }; tegn();
    ki('/rad', { profil: r }).then(function (d) { if (!d.rad || typeof d.rad !== 'object') throw new Error('Fikk ikke noe råd fra KI denne gangen. Prøv igjen om litt.'); T.kiRad = { rad: d.rad }; }).catch(function (e) { T.kiRad = { feil: feilmelding(e) }; }).then(tegn);
  }

  // ---------------------------------------------------------------- fag (tabellen kurs)
  var erUnderviser = function () { return T.rolle === 'underviser' || T.rolle === 'admin'; };
  function lagKode() { var a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = ''; for (var i = 0; i < 6; i++) s += a[Math.floor(Math.random() * a.length)]; return s; }
  function lagKurs() {
    var navn = document.getElementById('st-kursnavn').value.trim(), krev = document.getElementById('st-kurskrev').checked;
    if (!navn) return varsle('Gi faget et navn.', true);
    (function prov(n) {
      k.from('kurs').insert({ navn: navn, kode: lagKode(), krev_innsyn: krev, temaer: [] }).select('*').single().then(function (r) {
        if (r.error && r.error.code === '23505' && n < 5) return prov(n + 1);
        var c = sjekk(r); c.antall = 0; T.mine.push(c); varsle('Faget er laget. Velg temaene, og gi studentene koden.'); apneKurs(c.id, 'design');
      }).catch(function (e) { varsle(feilmelding(e), true); });
    })(0);
  }
  function finnKurs() {
    var kode = document.getElementById('st-kode').value.trim();
    if (!kode) return;
    k.rpc('finn_kurs', { k: kode }).then(sjekk).then(function (d) {
      if (!d || !d.length) return varsle('Fant ikke noe fag med den koden.', true);
      if (T.deltar.some(function (x) { return x.kurs === d[0].id; })) return varsle('Du er allerede påmeldt ' + d[0].navn + '.');
      ga('pamelding', { kurs: d[0] });
    }).catch(function (e) { varsle(feilmelding(e), true); });
  }
  // Fagets temaer blir studentens løype (temaer fra andre nettsteder beholdes).
  function brukFagetsLoype(temaer) {
    var andre = (T.inn.valgt || []).filter(function (x) { return x.indexOf(NETTSTED + '/') !== 0; });
    T.inn.valgt = andre.concat((temaer || []).filter(function (x) { return x.indexOf(NETTSTED + '/') === 0 && S[x.slice(NETTSTED.length + 1)]; }));
    return lagreInn();
  }
  function meldPa() {
    var c = T.kurs;
    k.from('kurs_deltaker').insert({ kurs: c.id, student: bruker.id, samtykke_innsyn: !!c.krev_innsyn }).then(sjekk).then(function () {
      return hentAlt();
    }).then(function () {
      var d = T.deltar.find(function (x) { return x.kurs === c.id; }), tm = d && d.kursinfo && d.kursinfo.temaer;
      if (tm && tm.length) return brukFagetsLoype(tm).then(function () { varsle('Du er påmeldt ' + c.navn + ', og løypa di følger nå faget.'); ga('hjem'); });
      varsle('Du er påmeldt ' + c.navn + '.'); ga('kurs');
    }).catch(function (e) { varsle(feilmelding(e), true); });
  }
  function meldAv(id) {
    k.from('kurs_deltaker').delete().eq('kurs', id).eq('student', bruker.id).then(sjekk).then(function () {
      T.deltar = T.deltar.filter(function (x) { return x.kurs !== id; }); varsle('Du er meldt av.'); tegn();
    }).catch(function (e) { varsle(feilmelding(e), true); });
  }
  function apneKurs(id, fane) {
    var c = T.mine.find(function (x) { return x.id === id; });
    if (!c) return ga('kurs');
    T.fag = { c: c, fane: fane || (T.fag && T.fag.c.id === id ? T.fag.fane : 'design'), temaer: (c.temaer || []).slice(), laster: true };
    ga('fag');
    Promise.all([k.rpc('kurs_oversikt', { k: id }).then(sjekk), k.rpc('kurs_statistikk', { k: id }).then(sjekk),
                 c.krev_innsyn ? k.rpc('kurs_deltakere', { k: id }).then(sjekk) : Promise.resolve([]),
                 k.rpc('kurs_godkjenning', { k: id }).then(sjekk)])
      .then(function (r) { Object.assign(T.fag, { laster: false, oversikt: r[0] || [], statistikk: r[1] || [], deltakere: r[2] || [], godkjenning: r[3] || [] }); })
      .catch(function (e) { Object.assign(T.fag, { laster: false, feil: feilmelding(e) }); }).then(tegn);
  }
  function lagreFag() {
    var f = T.fag, navn = document.getElementById('st-fagnavn').value.trim(), beskr = document.getElementById('st-fagbeskr').value.trim();
    if (!navn) return varsle('Faget må ha et navn.', true);
    k.from('kurs').update({ navn: navn, beskrivelse: beskr, temaer: f.temaer }).eq('id', f.c.id).then(sjekk).then(function () {
      Object.assign(f.c, { navn: navn, beskrivelse: beskr, temaer: f.temaer.slice() }); f.endret = false; varsle('Faget er lagret.'); tegn();
    }).catch(function (e) { varsle(feilmelding(e), true); });
  }
  function visStudent(id, epost) {
    T.fag.student = { id: id, epost: epost, laster: true }; tegn();
    k.from('studie_svar').select('*').eq('eier', id).limit(5000).then(sjekk)
      .then(function (d) { T.fag.student = { id: id, epost: epost, svar: d.map(fraRad) }; })
      .catch(function (e) { T.fag.student = { id: id, epost: epost, feil: feilmelding(e) }; }).then(tegn);
  }
  function slettKurs(id) {
    if (T.slett !== id) { T.slett = id; return tegn(); }
    k.from('kurs').delete().eq('id', id).then(sjekk).then(function () { T.mine = T.mine.filter(function (x) { return x.id !== id; }); T.slett = null; varsle('Faget er slettet.'); ga('kurs'); })
      .catch(function (e) { varsle(feilmelding(e), true); });
  }
  function lagOvelse() {
    var c = T.fag.c, tittel_ = document.getElementById('st-ov-tittel').value.trim(), tema = document.getElementById('st-ov-tema').value,
        krav = +document.getElementById('st-ov-krav').value, frist = document.getElementById('st-ov-frist').value;
    if (!tittel_ || !tema) return varsle('Gi øvingen tittel og tema.', true);
    // Fristen gjelder ut dagen (norsk tid).
    var rad = { kurs: c.id, tittel: tittel_, tema: tema, antall: 6, krav: krav, frist: frist ? new Date(frist + 'T23:59:59').toISOString() : null };
    k.from('ovelser').insert(rad).select('*').single().then(sjekk).then(function (o) { T.ovelser.push(o); varsle('Øvingen er laget.'); apneKurs(c.id, 'ovinger'); })
      .catch(function (e) { varsle(feilmelding(e), true); });
  }
  function slettOvelse(id) {
    if (T.slettOv !== id) { T.slettOv = id; return tegn(); }
    k.from('ovelser').delete().eq('id', id).then(sjekk).then(function () { T.ovelser = T.ovelser.filter(function (x) { return x.id !== id; }); T.slettOv = null; varsle('Øvingen er slettet.'); apneKurs(T.fag.c.id, 'ovinger'); })
      .catch(function (e) { varsle(feilmelding(e), true); });
  }
  // Excel-ark (.xlsx) med godkjenning: én rad per student (assets/js/xlsx-lite.js, ingen eksterne biblioteker).
  function lastNedExcel() {
    var c = T.fag.c, ol = T.ovelser.filter(function (x) { return x.kurs === c.id; }), g = T.fag.godkjenning || [], studenter = [];
    if (!window.fhXlsx) return varsle('Fikk ikke laget Excel-arket. Last siden på nytt.', true);
    g.forEach(function (x) { if (!studenter.some(function (y) { return y.id === x.student; })) studenter.push({ id: x.student, epost: x.epost }); });
    var hode = ['Student (e-post)'].concat(ol.map(function (x) { return x.tittel; })).concat(['Antall godkjent', 'Av']);
    var rader = studenter.map(function (st) {
      var r = ol.map(function (x) { var y = g.find(function (z) { return z.student === st.id && z.ovelse === x.id; }); return y && y.godkjent ? 'Godkjent' : 'Ikke godkjent'; });
      return [st.epost].concat(r).concat([r.filter(function (v) { return v === 'Godkjent'; }).length, ol.length]);
    });
    var info = [['Øving', 'Krav'], ['Fag: ' + c.navn, 'Kode ' + c.kode + ', laget ' + new Date().toLocaleString('nb-NO')]].concat(ol.map(function (x) {
      return [x.tittel, tittel(x.tema.split('/')[1]) + ', minst ' + x.krav + ' av ' + x.antall + ' riktige' + (x.frist ? ', frist ' + new Date(x.frist).toLocaleDateString('nb-NO') : '')]; }));
    fhXlsx.last_ned((c.navn.replace(/[^\wæøåÆØÅ -]+/g, '').trim() || 'fag') + ' – godkjenning ' + new Date().toISOString().slice(0, 10) + '.xlsx', [
      { navn: 'Godkjenning', rader: [hode].concat(rader), bredder: hode.map(function (h, i) { return i ? Math.max(12, h.length + 2) : 34; }) },
      { navn: 'Øvinger', rader: info, bredder: [30, 60] },
    ]);
  }
  var dato = function (d) { return d ? new Date(d).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' }) : '–'; };
  var tal = function (v) { return v == null ? null : +v; };
  // Profil for én student (faglærers innsyn): per tema, med undertemaer.
  function studentProfil(svar, temaer) {
    var rek = (temaer || []).map(function (x) { return x.split('/')[1]; });
    svar.forEach(function (s) { if (s.nettsted === NETTSTED && rek.indexOf(s.tema) < 0) rek.push(s.tema); });
    return rek.filter(function (t) { return S[t]; }).map(function (t) {
      var l = svar.filter(function (x) { return x.nettsted === NETTSTED && x.tema === t; }), s = skar(l), u = S[t].undertemaer;
      if (!s) return '<div class="st-kort"><b>' + esc(tittel(t)) + '</b><p class="st-sm">Ingen svar ennå.</p></div>';
      return '<div class="st-kort"><b>' + esc(tittel(t)) + '</b><span class="st-sm"> · ' + s.n + ' svar' + (s.ki ? ', ' + s.ki + ' vurdert av KI' : '') + '</span>' + stolper(s) +
        Object.keys(u).map(function (id) { var d = skar(l.filter(function (x) { return x.undertema === id; })); return d ? '<details><summary class="st-sm">' + esc(u[id]) + ' (' + d.n + ' svar)</summary>' + stolper(d) + '</details>' : ''; }).join('') + '</div>';
    }).join('') || '<p class="st-ind">Ingen svar ennå.</p>';
  }

  // ---------------------------------------------------------------- eksempelmodus
  // Underviseren ser appen som en fiktiv student. Alt ligger i minnet og forsvinner når siden lastes på nytt.
  function eksempelKlient(ekte) {
    var db = { studie_innstillinger: [], studie_svar: [], studie_ukevurdering: [], kurs: [], kurs_deltaker: [] }, nr = 1;
    var meg = 'eksempel';
    db.studie_innstillinger.push({ eier: meg, valgt: ['kinematikk', 'newtons-lover', 'arbeid-og-energi'].map(nokkel), modus: 'alle', repetisjon: true, varsler: true, niva: {} });
    var plan = { kinematikk: [0.9, 0.7], 'newtons-lover': [0.55, 0.6] }, frø = 11;
    var rnd = function () { frø = frø * 16807 % 2147483647; return frø / 2147483647; };
    Object.keys(plan).forEach(function (t) {
      Q.filter(function (x) { return x.tema === t; }).slice(0, 12).forEach(function (x, i) {
        var forstod = rnd() < plan[t][0], type = !forstod ? 'begrep' : (rnd() < plan[t][1] ? 'riktig' : 'regnefeil');
        db.studie_svar.push({ id: nr++, eier: meg, nettsted: NETTSTED, sporsmal: x.id, tema: t, undertema: x.undertema, vanskelighet: x.vanskelighet, type: type,
          tid_s: x.forventet_tid_s * (rnd() < 0.6 ? 0.7 : 1.6), forventet_s: x.forventet_tid_s, repetisjon: false, ki: null, opprettet: new Date(Date.now() - (20 - i) * 864e5).toISOString() });
      });
    });
    db.studie_ukevurdering.push({ eier: meg, nettsted: NETTSTED, tema: 'newtons-lover', vurdering: 4 });
    function kjor(q) {
      var tab = db[q.t] || [], treff = function (r) { return q.f.every(function (x) { return r[x[0]] === x[1]; }); };
      if (q.op === 'insert') { var r = Object.assign({ id: nr++, eier: meg, opprettet: new Date().toISOString() }, q.rad); tab.push(r); return { data: q.en ? r : [r], error: null }; }
      if (q.op === 'upsert') { var nok = q.t === 'studie_innstillinger' ? ['eier'] : ['eier', 'nettsted', 'tema'], rad = Object.assign({}, q.rad, { eier: meg });
        var g = tab.find(function (x) { return nok.every(function (n) { return x[n] === rad[n]; }); }); if (g) Object.assign(g, rad); else tab.push(rad); return { data: null, error: null }; }
      if (q.op === 'update') { tab.filter(treff).forEach(function (x) { Object.assign(x, q.rad); }); return { data: null, error: null }; }
      if (q.op === 'delete') { db[q.t] = tab.filter(function (x) { return !treff(x); }); return { data: null, error: null }; }
      var rader = tab.filter(function (r) { return q.f.every(function (x) { return x[0] === 'eier' || x[0] === 'student' || r[x[0]] === x[1]; }); }).map(function (r) { return Object.assign({}, r); });
      if (q.kanskje) return { data: rader[0] || null, error: null };
      if (q.en) return { data: rader[0], error: null };
      return { data: rader, error: null };
    }
    return {
      auth: ekte.auth,
      rpc: function () { return Promise.resolve({ data: [], error: null }); },
      from: function (t) {
        var q = { t: t, f: [], op: 'select' }, b = {
          select: function () { return b; }, order: function () { return b; }, limit: function () { return b; },
          eq: function (c, v) { q.f.push([c, v]); return b; },
          maybeSingle: function () { q.kanskje = true; return b; }, single: function () { q.en = true; return b; },
          insert: function (r) { q.op = 'insert'; q.rad = r; return b; }, upsert: function (r) { q.op = 'upsert'; q.rad = r; return b; },
          update: function (r) { q.op = 'update'; q.rad = r; return b; }, delete: function () { q.op = 'delete'; return b; },
          then: function (ok, nei) { return Promise.resolve(kjor(q)).then(ok, nei); },
        };
        return b;
      },
    };
  }

  // ---------------------------------------------------------------- skjermer
  function skala(t) {
    var v = T.ukevurd[t];
    return '<div class="st-skala">' + [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" class="' + (v === n ? 'pa' : '') + '" data-h="vurd" data-t="' + t + '" data-n="' + n + '">' + n + '</button>'; }).join('') +
      '</div><div class="st-rad st-sm"><span>Lett</span><span>Vanskelig</span></div>';
  }
  var SKJ = {
    hjem: function () {
      var v = valgt(), alle = skar(T.svar.filter(function (s) { return s.nettsted === NETTSTED && v.indexOf(s.tema) >= 0; }));
      var o = '<p class="st-hand">Hei, ' + esc(bruker.email) + '!</p>';
      if (!v.length) o += '<div class="st-kort st-viktig"><b>Kom i gang</b><p>Velg temaene du skal studere, så lager vi en løype med én uke per tema.</p></div>';
      else o += '<h2>Din løype</h2>' + v.map(function (t, i) {
        return '<button type="button" class="st-kort" data-h="uke" data-t="' + t + '"><div class="st-rad"><b>Uke ' + (i + 1) + ': ' + esc(tittel(t)) + '</b><span class="st-sm">' + (T.ukevurd[t] ? 'Vurdert ' + T.ukevurd[t] + '/5' : '→') + '</span></div>' +
          '<span class="st-sm">' + Object.keys(S[t].undertemaer).length + ' undertemaer · nivå: ' + NIV[niva(t)] + ' · ' + Math.min(denneUken(t), OKT) + ' av ' + OKT + ' spørsmål denne uken</span></button>';
      }).join('');
      var mo = mineOvelser();
      if (mo.length) o += '<h2>Obligatoriske øvinger</h2><button type="button" class="st-kort" data-h="ga" data-v="kurs"><div class="st-rad"><b>' + mo.filter(godkjent).length + ' av ' + mo.length + ' godkjent</b><span class="st-sm">Se øvingene →</span></div></button>';
      if (alle) o += '<h2>Kunnskapsprofil</h2>' + stolper(alle) + '<p><button type="button" class="st-btn g" data-h="ga" data-v="profil">Se hele profilen</button></p>';
      o += '<h2>Temaer du studerer</h2><p class="st-sm">Rekkefølgen her blir rekkefølgen i løypa.</p>' + temavalg();
      o += '<h2>Innstillinger for quiz</h2>' +
        '<label class="st-valg"><input type="radio" name="st-modus" value="alle"' + (T.inn.modus === 'alle' ? ' checked' : '') + '> Alle spørsmålene på én gang</label>' +
        '<label class="st-valg"><input type="radio" name="st-modus" value="dag"' + (T.inn.modus === 'dag' ? ' checked' : '') + '> Noen spørsmål hver dag (' + PER_DAG + ' per tema)</label>' +
        '<label class="st-valg"><input type="checkbox" data-inn="repetisjon"' + (T.inn.repetisjon ? ' checked' : '') + '> Repetisjonsspørsmål</label>' +
        '<label class="st-valg"><input type="checkbox" data-inn="varsler"' + (T.inn.varsler ? ' checked' : '') + '> Påminnelser</label>' +
        '<p class="st-sm">Påminnelser sendes når studieappen kommer som app på mobilen. Valget ditt blir husket til da.</p>';
      return o;
    },
    uke: function () {
      var t = T.t, nr = valgt().indexOf(t) + 1, u = S[t].undertemaer, dag = T.inn.modus === 'dag';
      return '<button type="button" class="st-tilbake" data-h="ga" data-v="hjem">← Løypa</button><h2 class="st-h1">Uke ' + nr + ': ' + esc(tittel(t)) + '</h2>' +
        '<h3>Undertemaer</h3>' + Object.keys(u).map(function (id) {
          var url = temaUrl(t, id);
          return url ? '<a class="st-kort" href="' + url + '"><div class="st-rad"><span>' + esc(u[id]) + '</span><span class="st-sm">Lærestoff og video →</span></div></a>'
                     : '<div class="st-kort st-tom"><div class="st-rad"><span>' + esc(u[id]) + '</span><span class="st-sm">Lærestoff kommer</span></div></div>';
        }).join('') +
        '<h3>Ukens quiz</h3><p class="st-ind">Du starter på nivå <b>' + NIV[niva(t)] + '</b>, og nivået følger svarene dine. ' +
        (dag ? 'Du får ' + PER_DAG + ' spørsmål om dagen (' + iDag(t) + ' tatt i dag).' : 'Du får ' + OKT + ' spørsmål' + (T.inn.repetisjon ? ' og opptil ' + REP + ' repetisjonsspørsmål' : '') + '.') + '</p>' +
        '<p><button type="button" class="st-btn" data-h="quiz" data-t="' + t + '">Start quiz</button></p>';
    },
    ferdigIdag: function () {
      return '<h2 class="st-h1">Dagens spørsmål er tatt</h2><p>Du har svart på ' + PER_DAG + ' spørsmål i ' + esc(tittel(T.t)) + ' i dag. Kom tilbake i morgen!</p>' +
        '<p><button type="button" class="st-btn g" data-h="quizFlere" data-t="' + T.t + '">Ta flere likevel</button> <button type="button" class="st-btn" data-h="ga" data-v="hjem">Til løypa</button></p>';
    },
    quiz: function () {
      var q = T.q, x = q.na, sv = q.svart, a = sv == null ? null : x.alt[sv], fb = '';
      if (a) {
        var kl = a.type === 'riktig' ? '' : (a.type === 'regnefeil' ? 'r' : 'n');
        var ti = a.type === 'riktig' ? 'Riktig!' : (a.type === 'regnefeil' ? 'Riktig tanke, men regnefeil.' : 'Ikke riktig.');
        fb = '<div class="st-fb ' + kl + '"><b>' + ti + '</b><div class="st-avsnitt">' + tx(x.forklaring) + '</div></div>';
        var kis = q.kiSvar;
        if (kis && !kis.feil) {
          var kt = { riktig: 'KI: Riktig fysikk og riktig regning.', regnefeil: 'KI: Riktig tankegang, men en regnefeil.', begrep: 'KI: Her bør du se på fysikken igjen.', uklar: 'KI: Klarte ikke å lese besvarelsen.' }[kis.vurdering];
          fb += '<div class="st-fb ki"><b>' + kt + '</b><div class="st-avsnitt">' + tx(kis.tilbakemelding) + '</div>' + (kis.vurdering !== 'uklar' ? '<p class="st-sm">Denne vurderingen teller i kunnskapsprofilen din.</p>' : '') + '</div>';
        } else {
          fb += '<h3>Vis hvordan du tenkte</h3><p class="st-sm">Valgfritt. Ta bilde av utregningen eller forklar med egne ord, så vurderer KI om du har forstått fysikken. Bildet lagres ikke.</p>' +
            '<textarea id="st-forklaring" placeholder="Forklar hvordan du tenkte …">' + esc(q.tekst || '') + '</textarea>' +
            '<div class="st-vedlegg">' + (Tale ? '<button type="button" class="st-btn g" data-h="tale">🎤 Snakk</button>' : '') +
            '<label class="st-btn g">📷 ' + (q.bilde ? 'Bytt bilde' : 'Ta bilde') + '<input type="file" accept="image/*" capture="environment" id="st-bilde"></label>' +
            '<button type="button" class="st-btn" data-h="vurder"' + (q.venter ? ' disabled' : '') + '>' + (q.venter ? 'Vurderer …' : 'Få tilbakemelding') + '</button></div>' +
            (q.bilde ? '<img class="st-forhand" alt="Bildet ditt" src="' + q.bilde + '">' : '') +
            (kis && kis.feil ? '<p class="st-feil">' + esc(kis.feil) + '</p>' : '');
        }
        fb += '<p class="st-videre"><button type="button" class="st-btn" data-h="videre">' + (q.nr + 1 >= q.antall ? 'Se resultat' : 'Neste') + '</button></p>';
      }
      return '<div class="st-rad st-sm"><span>' + esc(tittel(x.tema)) + ' · ' + esc(S[x.tema].undertemaer[x.undertema] || '') + (x.rep ? ' · repetisjon' : '') + '</span><span>' + (q.nr + 1) + ' av ' + q.antall + '</span></div>' +
        '<div class="st-fram"><i style="width:' + (q.nr / q.antall * 100) + '%"></i></div>' +
        '<span class="st-mrk ' + x.vanskelighet + '">' + x.vanskelighet + '</span><p class="st-sporsmal">' + tx(x.tekst) + '</p>' +
        x.alt.map(function (o, i) { var c = ''; if (a) { if (o.type === 'riktig') c = 'ok'; else if (i === sv) c = 'nei'; } return '<button type="button" class="st-alt ' + c + '"' + (a ? ' disabled' : '') + ' data-h="svar" data-i="' + i + '">' + tx(o.svar) + '</button>'; }).join('') + fb;
    },
    resultat: function () {
      var q = T.q, r = q.res, c = function (t) { return r.filter(function (x) { return x === t; }).length; };
      var ov = q.ovelse, ok = ov && q.hovedRes.filter(function (x) { return x === 'riktig'; }).length >= ov.krav;
      if (ov && ok && ov.frist && Date.now() > Date.parse(ov.frist)) ok = false;
      return '<h2 class="st-h1">Quizzen er ferdig</h2><p class="st-hand">' + c('riktig') + ' av ' + r.length + ' riktige</p>' +
        (ov ? '<div class="st-fb ' + (ok ? '' : 'n') + '"><b>' + esc(ov.tittel) + ': ' + (ok ? 'Godkjent ✓' : 'Ikke godkjent') + '</b><p>' +
          (ok ? 'Bra jobbet! Øvingen er registrert som godkjent.' : 'Du trenger minst ' + ov.krav + ' av ' + ov.antall + ' riktige' + (ov.frist && Date.now() > Date.parse(ov.frist) ? ', og fristen har gått ut.' : '. Les på temaet og prøv igjen.')) + '</p></div>' : '') +
        '<div class="st-kort"><div class="st-rad"><span>Riktig</span><b>' + c('riktig') + '</b></div><div class="st-rad"><span>Riktig tanke, regnefeil</span><b>' + c('regnefeil') + '</b></div><div class="st-rad"><span>Må jobbes mer med</span><b>' + c('begrep') + '</b></div></div>' +
        '<p>Neste gang starter du på nivå <b>' + NIV[niva(q.tema)] + '</b>.</p><h3>Hvor vanskelig var dette temaet?</h3>' + skala(q.tema) +
        '<p class="st-sm">Faglæreren din ser bare samletall for kurset, og bare når minst 5 har svart.</p>' +
        '<p style="margin-top:1rem"><button type="button" class="st-btn" data-h="ga" data-v="profil">Se kunnskapsprofilen</button> <button type="button" class="st-btn g" data-h="ga" data-v="hjem">Til løypa</button></p>';
    },
    profil: function () {
      var bl = valgt().map(function (t) {
        var l = mineSvar(t), s = skar(l);
        if (!s) return '<div class="st-kort"><b>' + esc(tittel(t)) + '</b><p class="st-sm">Ingen svar ennå.</p></div>';
        var u = S[t].undertemaer;
        return '<div class="st-kort"><b>' + esc(tittel(t)) + '</b><span class="st-sm"> · ' + s.n + ' svar' + (s.ki ? ', ' + s.ki + ' vurdert av KI' : '') + '</span>' + stolper(s) +
          Object.keys(u).map(function (id) { var d = skar(l.filter(function (x) { return x.undertema === id; })); return d ? '<details><summary class="st-sm">' + esc(u[id]) + ' (' + d.n + ' svar)</summary>' + stolper(d) + '</details>' : ''; }).join('') + '</div>';
      }).join('') || '<p class="st-ind">Velg temaer på løypa først.</p>';
      var kr = T.kiRad, radDel = kr && kr.rad
        ? '<p class="st-sm">Personlige råd fra KI' + (kr.rad.bra ? ': ' + txLinje(kr.rad.bra) : '') + '</p>' + radKort(fraKi(kr.rad))
        : regelRad() + (!profilRader().length ? '' : kr && kr.venter ? '<p class="st-ind">KI lager rådene dine …</p>'
          : (kr && kr.feil ? '<p class="st-feil">' + esc(kr.feil) + '</p>' : '') + '<p><button type="button" class="st-btn g" data-h="rad">Få personlige råd fra KI</button></p>');
      return '<h2 class="st-h1">Kunnskapsprofil</h2><p class="st-sm"><b>Forståelse</b> er viktigst. <b>Presisjon</b> viser om du regner riktig når tanken er riktig. <b>Hurtighet</b> er minst viktig, men kan gi deg bedre tid på eksamen.</p>' +
        bl + '<h2>Slik forbereder du deg til eksamen</h2>' + radDel;
    },
    kurs: function () {
      var o = '<h2 class="st-h1">Fag</h2>';
      if (erUnderviser() && !T.eksempel) {
        o += '<h3>Fagene du underviser</h3>' + (T.mine.length ? '<div class="st-tabell-ramme"><table class="st-tabell"><thead><tr><th>Fag</th><th>Kode</th><th>Studenter</th><th>Temaer</th></tr></thead><tbody>' +
          T.mine.map(function (c) {
            return '<tr class="st-klikk" data-h="apneKurs" data-id="' + c.id + '" tabindex="0"><td><b>' + esc(c.navn) + '</b>' + (c.krev_innsyn ? '' : '<br><span class="st-sm">bare samletall</span>') + '</td><td class="st-kode">' + esc(c.kode) + '</td><td>' + (c.antall == null ? '–' : c.antall) + '</td><td>' + (c.temaer || []).length + '</td></tr>';
          }).join('') + '</tbody></table></div>' : '<p class="st-ind">Du har ingen fag ennå.</p>');
        o += '<details class="st-kort"' + (T.mine.length ? '' : ' open') + '><summary><b>Lag nytt fag</b></summary>' +
          '<label class="st-sm" for="st-kursnavn">Navn på faget</label><input id="st-kursnavn" maxlength="120">' +
          '<label class="st-valg"><input type="checkbox" id="st-kurskrev"> Krev innsyn i studentenes kunnskapsprofil (studentene må godta ved påmelding). Kan ikke endres senere.</label>' +
          '<button type="button" class="st-btn" data-h="lagKurs">Lag fag</button></details>';
        o += '<div class="st-kort"><b>Eksempelmodus</b><p class="st-sm">Se studieappen som en fiktiv student med ferdige svar. Ingenting lagres.</p><a class="st-btn g liten" href="#eksempel" data-h="eksempel">Åpne eksempelmodus</a></div>';
        o += '<h3>Fag du er med i som student</h3>';
      } else o += '<h3>Fag du er med i</h3>';
      o += T.deltar.length ? T.deltar.map(function (d) {
        var c = d.kursinfo || {}, tm = c.temaer || [];
        var folger = tm.length && tm.every(function (x) { return (T.inn.valgt || []).indexOf(x) >= 0; });
        return '<div class="st-kort"><div class="st-rad"><b>' + esc(c.navn) + '</b><button type="button" class="st-btn g liten" data-h="meldAv" data-id="' + d.kurs + '">Meld av</button></div>' +
          (c.beskrivelse ? '<p>' + esc(c.beskrivelse) + '</p>' : '') + '<span class="st-sm">' +
          (d.samtykke_innsyn ? 'Faglærer ser kunnskapsprofilen din. Meld deg av for å trekke samtykket.' : 'Faglærer ser bare samletall for faget.') + '</span>' +
          (tm.length && !folger ? '<p><button type="button" class="st-btn liten" data-h="brukLoype" data-id="' + d.kurs + '">Bruk fagets løype (' + tm.length + ' temaer)</button></p>' : '') +
          ovelseListe(d.kurs) + '</div>';
      }).join('') : '<p class="st-ind">Du er ikke med i noe fag.</p>';
      o += '<div class="st-kort"><label class="st-sm" for="st-kode">Meld deg på med koden fra faglæreren</label><div class="st-rad"><input id="st-kode" maxlength="12" placeholder="F.eks. K7Q2MX" autocomplete="off"><button type="button" class="st-btn" data-h="finnKurs">Finn fag</button></div></div>';
      if (!erUnderviser() && !T.eksempel) o += '<p class="st-sm">Underviser? Be administratoren om en underviserkode, og legg den inn på <a href="../konto/index.html">Min side</a>.</p>';
      return o;
    },
    pamelding: function () {
      var c = T.kurs;
      return '<button type="button" class="st-tilbake" data-h="ga" data-v="kurs">← Fag</button><h2 class="st-h1">Meld deg på ' + esc(c.navn) + '</h2>' +
        (c.krev_innsyn ? '<div class="st-fb r"><b>Faglærer krever innsyn</b><p>I dette faget ser faglærer kunnskapsprofilen din: svarene dine og forståelse, presisjon og hurtighet for hvert tema og undertema. Du må godta dette for å melde deg på. Du kan trekke samtykket når som helst ved å melde deg av.</p></div>'
          : '<p>Faglærer ser bare samletall for faget, aldri profilen din.</p>') +
        '<p class="st-sm">Har faget obligatoriske øvinger, ser faglærer om du har fått dem godkjent.</p>' +
        '<p style="margin-top:1rem"><button type="button" class="st-btn" data-h="meldPa">' + (c.krev_innsyn ? 'Godta og meld på' : 'Meld på') + '</button> <button type="button" class="st-btn g" data-h="ga" data-v="kurs">Avbryt</button></p>';
    },
    fag: function () {
      var f = T.fag, c = f.c;
      var o = '<button type="button" class="st-tilbake" data-h="ga" data-v="kurs">← Fagene dine</button><h2 class="st-h1">' + esc(c.navn) + '</h2>' +
        '<p class="st-sm">Kode til studentene: <b class="st-kode">' + esc(c.kode) + '</b> · ' + (c.krev_innsyn ? 'innsyn i studentenes profil' : 'bare samletall') + '</p>' +
        '<nav class="st-underfaner">' + [['design', 'Utforming'], ['ovinger', 'Øvinger'], ['studenter', 'Studenter'], ['statistikk', 'Statistikk']].map(function (x) {
          return '<button type="button" aria-selected="' + (f.fane === x[0]) + '" data-h="fagFane" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</nav>';
      if (f.fane === 'design') {
        var brukt = f.temaer.map(function (x) { return x.split('/')[1]; });
        o += '<label class="st-sm" for="st-fagnavn">Navn</label><input id="st-fagnavn" maxlength="120" value="' + esc(c.navn) + '">' +
          '<label class="st-sm" for="st-fagbeskr">Beskrivelse til studentene</label><textarea id="st-fagbeskr" maxlength="2000">' + esc(c.beskrivelse || '') + '</textarea>' +
          '<h3>Temaer i rekkefølge</h3><p class="st-sm">Dette blir løypa til studentene: én uke per tema.</p>' +
          (f.temaer.length ? '<ol class="st-temaliste">' + f.temaer.map(function (x, i) {
            var t = x.split('/')[1];
            return '<li><span>' + esc(tittel(t)) + '</span><span class="st-knapper"><button type="button" class="st-btn g liten" data-h="flyttTema" data-i="' + i + '" data-r="-1"' + (i ? '' : ' disabled') + ' aria-label="Flytt opp">↑</button>' +
              '<button type="button" class="st-btn g liten" data-h="flyttTema" data-i="' + i + '" data-r="1"' + (i < f.temaer.length - 1 ? '' : ' disabled') + ' aria-label="Flytt ned">↓</button>' +
              '<button type="button" class="st-btn g liten" data-h="fjernTema" data-i="' + i + '" aria-label="Fjern">✕</button></span></li>';
          }).join('') + '</ol>' : '<p class="st-ind">Ingen temaer ennå.</p>') +
          '<div class="st-rad"><select id="st-legg-tema"><option value="">Legg til tema …</option>' + Object.keys(S).filter(function (t) { return brukt.indexOf(t) < 0; }).map(function (t) {
            return '<option value="' + t + '">' + esc((T.omrader[S[t].omrade] || '') + ': ' + S[t].tittel) + '</option>'; }).join('') + '</select></div>' +
          '<p style="margin-top:1rem"><button type="button" class="st-btn" data-h="lagreFag">Lagre faget</button> ' + (f.endret ? '<span class="st-sm">Ulagrede endringer</span>' : '') + '</p>' +
          '<div class="st-kort"><b>Forelesninger</b><p class="st-sm">Plukk sider, eksempler og oppgaver og vis dem som tavleslides.</p><a class="st-btn g liten" href="../larer/index.html">Design forelesning →</a></div>' +
          '<p><button type="button" class="st-btn g liten" data-h="slettKurs" data-id="' + c.id + '">' + (T.slett === c.id ? 'Bekreft: slett faget for godt' : 'Slett faget') + '</button></p>';
        return o;
      }
      if (f.laster) return o + '<p class="st-ind">Laster …</p>';
      if (f.feil) return o + '<p class="st-feil">' + esc(f.feil) + '</p>';
      if (f.fane === 'ovinger') {
        var ol = (T.ovelser || []).filter(function (x) { return x.kurs === c.id; });
        var temaValg = (c.temaer.length ? c.temaer : Object.keys(S).map(nokkel)).map(function (x) { var t = x.split('/')[1]; return S[t] ? '<option value="' + x + '">' + esc(S[t].tittel) + '</option>' : ''; }).join('');
        o += '<h3>Obligatoriske øvinger</h3>' + (ol.length ? ol.map(function (x) {
          return '<div class="st-kort"><div class="st-rad"><b>' + esc(x.tittel) + '</b><button type="button" class="st-btn g liten" data-h="slettOvelse" data-id="' + x.id + '">' + (T.slettOv === x.id ? 'Bekreft sletting' : 'Slett') + '</button></div>' +
            '<span class="st-sm">' + esc(tittel(x.tema.split('/')[1])) + ' · minst ' + x.krav + ' av ' + x.antall + ' riktige' + (x.frist ? ' · frist ' + dato(x.frist) : ' · ingen frist') + '</span></div>';
        }).join('') : '<p class="st-ind">Ingen øvinger ennå.</p>') +
          '<details class="st-kort"' + (ol.length ? '' : ' open') + '><summary><b>Ny øving</b></summary>' +
          '<label class="st-sm" for="st-ov-tittel">Tittel</label><input id="st-ov-tittel" class="st-felt" maxlength="120" value="Øving ' + (ol.length + 1) + '">' +
          '<label class="st-sm" for="st-ov-tema">Tema</label><select id="st-ov-tema">' + temaValg + '</select>' +
          '<div class="st-rad" style="gap:1rem"><span style="flex:1"><label class="st-sm" for="st-ov-krav">Krav (av 6 spørsmål)</label><select id="st-ov-krav">' + [1, 2, 3, 4, 5, 6].map(function (n) { return '<option' + (n === 4 ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></span>' +
          '<span style="flex:1"><label class="st-sm" for="st-ov-frist">Frist (valgfri)</label><input id="st-ov-frist" class="st-felt" type="date"></span></div>' +
          '<p><button type="button" class="st-btn" data-h="lagOvelse">Lag øving</button></p></details>';
        if (!ol.length) return o;
        var g = f.godkjenning || [], studenter = [];
        g.forEach(function (x) { if (!studenter.some(function (y) { return y.id === x.student; })) studenter.push({ id: x.student, epost: x.epost }); });
        o += '<h3>Godkjenning</h3>';
        if (!studenter.length) return o + '<p class="st-ind">Ingen påmeldte ennå.</p>';
        var finn = function (sid, oid) { return g.find(function (x) { return x.student === sid && x.ovelse === oid; }) || {}; };
        return o + '<p><button type="button" class="st-btn g liten" data-h="excel">Last ned Excel-ark</button></p><div class="st-tabell-ramme"><table class="st-tabell"><thead><tr><th>Student</th>' +
          ol.map(function (x) { return '<th>' + esc(x.tittel) + '</th>'; }).join('') + '<th>Godkjent</th></tr></thead><tbody>' +
          studenter.map(function (st) {
            var n = ol.filter(function (x) { return finn(st.id, x.id).godkjent; }).length;
            return '<tr><td>' + esc(st.epost) + '</td>' + ol.map(function (x) { var r = finn(st.id, x.id);
              return '<td><span class="st-status ' + (r.godkjent ? 'ok' : 'nei') + '">' + (r.godkjent ? '✓' : '–') + '</span>' + (r.forsok ? '<span class="st-sm"> ' + (r.beste == null ? '' : 'beste ' + r.beste) + '</span>' : '') + '</td>'; }).join('') +
              '<td><b>' + n + ' / ' + ol.length + '</b></td></tr>';
          }).join('') + '</tbody></table></div>';
      }
      if (f.fane === 'studenter') {
        if (!c.krev_innsyn) return o + '<p class="st-ind">Dette faget krever ikke innsyn, så du ser bare samletall under «Statistikk».</p>';
        var st = f.student;
        if (st) {
          o += '<button type="button" class="st-tilbake" data-h="lukkStudent">← Alle studenter</button><h3>' + esc(st.epost) + '</h3>';
          if (st.laster) return o + '<p class="st-ind">Laster …</p>';
          if (st.feil) return o + '<p class="st-feil">' + esc(st.feil) + '</p>';
          return o + studentProfil(st.svar, c.temaer);
        }
        if (!f.deltakere.length) return o + '<p class="st-ind">Ingen påmeldte ennå. Gi studentene koden <b class="st-kode">' + esc(c.kode) + '</b>.</p>';
        var sort = f.sorter || 'epost';
        var liste = f.deltakere.slice().sort(function (a, b) {
          if (sort === 'epost') return a.epost.localeCompare(b.epost);
          var x = a[sort] == null ? 2 : +a[sort], y = b[sort] == null ? 2 : +b[sort];
          return sort === 'sist_aktiv' || sort === 'svar' ? (Date.parse(b[sort]) || +b[sort] || 0) - (Date.parse(a[sort]) || +a[sort] || 0) : x - y;
        });
        var th = function (k2, navn, kl) { return '<th><button type="button" class="st-sorter' + (sort === k2 ? ' pa' : '') + (kl ? ' st-ord ' + kl : '') + '" data-h="sorter" data-v="' + k2 + '">' + navn + '</button></th>'; };
        var celle = function (v, kl) { return '<td><div class="st-minibar"><i class="' + kl + '" style="width:' + (v == null ? 0 : Math.round(v * 100)) + '%"></i></div><span class="st-sm">' + pst(v) + '</span></td>'; };
        return o + '<p class="st-sm">' + f.deltakere.length + ' studenter har godtatt innsyn. Klikk på en student for å se hele profilen. Klikk på en overskrift for å sortere (svakest først).</p>' +
          '<div class="st-tabell-ramme"><table class="st-tabell"><thead><tr>' + th('epost', 'Student') + th('svar', 'Svar') + th('sist_aktiv', 'Sist aktiv') + th('forstaelse', 'Forståelse', 'f') + th('presisjon', 'Presisjon', 'p') + th('hurtighet', 'Hurtighet', 'h') + '</tr></thead><tbody>' +
          liste.map(function (s) {
            return '<tr class="st-klikk" data-h="visStudent" data-id="' + s.student + '" data-epost="' + esc(s.epost) + '" tabindex="0"><td>' + esc(s.epost) + '<br><span class="st-sm">påmeldt ' + dato(s.pameldt) + '</span></td><td>' + s.svar + '</td><td>' + dato(s.sist_aktiv) + '</td>' +
              celle(tal(s.forstaelse), 'f') + celle(tal(s.presisjon), 'p') + celle(tal(s.hurtighet), 'h') + '</tr>';
          }).join('') + '</tbody></table></div>';
      }
      // statistikk
      var ov = f.oversikt.filter(function (r) { return r.nettsted === NETTSTED; });
      var rader = f.statistikk.filter(function (r) { return r.nettsted === NETTSTED; });
      var synlige = rader.filter(function (r) { return r.forstaelse != null; }).sort(function (a, b) { return a.forstaelse - b.forstaelse; });
      var skjult = rader.length - synlige.length;
      o += '<h3>Hva studentene sliter med</h3><p class="st-sm">Undertemaene med svakest forståelse først. Tall vises bare når minst 5 studenter har svart.</p>';
      o += synlige.length ? synlige.map(function (r) {
        var navn = S[r.tema] ? (S[r.tema].undertemaer[r.undertema] || r.undertema) : r.undertema;
        return '<div class="st-kort"><div class="st-rad"><b>' + esc(navn) + '</b><span class="st-sm">' + esc(tittel(r.tema)) + '</span></div>' + stolper({ f: tal(r.forstaelse), p: tal(r.presisjon), h: tal(r.hurtighet) }) +
          '<span class="st-sm">' + r.studenter + ' studenter, ' + r.svar + ' svar</span></div>';
      }).join('') : '<p class="st-ind">Ingen undertemaer har svar fra minst 5 studenter ennå.</p>';
      if (skjult) o += '<p class="st-sm">' + skjult + ' undertemaer har svar fra færre enn 5 studenter og vises ikke.</p>';
      o += '<h3>Hvor vanskelig synes studentene temaene er?</h3>';
      o += ov.length ? ov.map(function (r) {
        return '<div class="st-kort"><div class="st-rad"><span>' + esc(tittel(r.tema)) + '</span>' + (r.vurdering != null ? '<b>' + Number(r.vurdering).toFixed(1) + ' / 5</b>' : '<span class="st-sm">Under 5 svar</span>') + '</div>' +
          (r.vurdering != null ? '<div class="st-bar"><i class="v" style="width:' + (r.vurdering / 5 * 100) + '%"></i></div>' : '') + '<span class="st-sm">' + r.studenter_vurdering + ' anonyme vurderinger</span></div>';
      }).join('') : '<p class="st-ind">Ingen vurderinger ennå.</p>';
      return o;
    },
  };
  function ovelseListe(kursId) {
    var l = (T.ovelser || []).filter(function (o) { return o.kurs === kursId; });
    if (!l.length) return '';
    return '<p class="st-sm" style="margin-top:.6rem"><b>Obligatoriske øvinger</b></p>' + l.map(function (o) {
      var ok = godkjent(o), ute = o.frist && Date.now() > Date.parse(o.frist);
      return '<div class="st-ovelse"><span class="st-status ' + (ok ? 'ok' : 'nei') + '">' + (ok ? '✓ Godkjent' : 'Ikke godkjent') + '</span><b>' + esc(o.tittel) + '</b>' +
        '<span class="st-sm">' + esc(tittel(o.tema.split('/')[1])) + ' · minst ' + o.krav + ' av ' + o.antall + ' riktige' + (o.frist ? ' · frist ' + dato(o.frist) : '') + '</span>' +
        (!ok && !ute ? '<button type="button" class="st-btn liten" data-h="ovelse" data-id="' + o.id + '">Ta quizen</button>' : '') + (!ok && ute ? '<span class="st-sm">Fristen har gått ut.</span>' : '') + '</div>';
    }).join('');
  }
  function temavalg() {
    var v = valgt(), gr = {}, rek = [];
    Object.keys(S).forEach(function (id) { var o = S[id].omrade; if (!gr[o]) { gr[o] = []; rek.push(o); } gr[o].push(id); });
    return rek.map(function (o) {
      return '<p class="st-sm" style="margin:.7rem 0 .2rem"><b>' + esc(T.omrader[o] || o) + '</b></p>' + gr[o].map(function (id) {
        return '<label class="st-valg"><input type="checkbox" data-tema="' + id + '"' + (v.indexOf(id) >= 0 ? ' checked' : '') + '> ' + esc(S[id].tittel) + '</label>';
      }).join('') + (o === 'elektromagnetisme' ? '<label class="st-valg av"><input type="checkbox" disabled> Magnetisme og induksjon (kommer)</label>' : '');
    }).join('');
  }

  function ga(v, p) { stoppTale(); Object.assign(T, { vis: v }, p || {}); if (v !== 'profil') T.kiRad = T.kiRad && T.kiRad.rad ? T.kiRad : null; tegn(); rot.scrollIntoView({ block: 'start' }); }
  function tegn() {
    var faner = [['hjem', 'Løype'], ['profil', 'Profil'], ['kurs', 'Fag']];
    var aktiv = { uke: 'hjem', quiz: 'hjem', resultat: 'hjem', ferdigIdag: 'hjem', pamelding: 'kurs', fag: 'kurs' }[T.vis] || T.vis;
    rot.innerHTML = (T.eksempel ? '<div class="st-eksempel"><b>Eksempelmodus.</b> Du ser appen som en fiktiv student. Ingenting lagres. <a href="#" data-h="avsluttEksempel">Avslutt</a></div>' : '') + '<nav class="st-faner" role="tablist">' + faner.map(function (f) { return '<button type="button" role="tab" aria-selected="' + (aktiv === f[0]) + '" data-h="ga" data-v="' + f[0] + '">' + f[1] + '</button>'; }).join('') + '</nav>' +
      '<div class="st-innhold">' + SKJ[T.vis]() + '</div><p id="st-varsel" class="st-varsel" role="status" hidden></p>';
  }

  // Alle klikk og endringer håndteres her (ingen inline-skript i HTML-en).
  rot.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-h]'); if (!b || b.disabled) return;
    var d = b.dataset;
    ({
      ga: function () { ga(d.v); },
      uke: function () { ga('uke', { t: d.t }); },
      quiz: function () { startQuiz(d.t); },
      quizFlere: function () { startQuiz(d.t, true); },
      svar: function () { svar(+d.i); },
      videre: videre,
      vurder: vurder,
      tale: function () { tale(b); },
      rad: hentRad,
      vurd: function () {
        T.ukevurd[d.t] = +d.n; tegn();
        k.from('studie_ukevurdering').upsert({ eier: bruker.id, nettsted: NETTSTED, tema: d.t, vurdering: +d.n, endret: new Date().toISOString() }).then(sjekk)
          .catch(function (e) { varsle('Fikk ikke lagret: ' + feilmelding(e), true); });
      },
      finnKurs: finnKurs, meldPa: meldPa, lagKurs: lagKurs, lagreFag: lagreFag,
      meldAv: function () { meldAv(d.id); },
      apneKurs: function () { apneKurs(d.id); },
      slettKurs: function () { slettKurs(d.id); },
      visStudent: function () { visStudent(d.id, d.epost); },
      lukkStudent: function () { T.fag.student = null; tegn(); },
      fagFane: function () { T.fag.fane = d.v; T.fag.student = null; tegn(); },
      sorter: function () { T.fag.sorter = d.v; tegn(); },
      flyttTema: function () { var l = T.fag.temaer, i = +d.i, j = i + (+d.r), x = l[i]; l[i] = l[j]; l[j] = x; T.fag.endret = true; tegn(); },
      fjernTema: function () { T.fag.temaer.splice(+d.i, 1); T.fag.endret = true; tegn(); },
      brukLoype: function () { var x = T.deltar.find(function (y) { return y.kurs === d.id; }); brukFagetsLoype(x.kursinfo.temaer).then(function () { varsle('Løypa di følger nå faget.'); ga('hjem'); }); },
      ovelse: function () { startOvelse(d.id); },
      lagOvelse: lagOvelse, excel: lastNedExcel,
      slettOvelse: function () { slettOvelse(d.id); },
      eksempel: function () { ev.preventDefault(); location.hash = 'eksempel'; location.reload(); },
      avsluttEksempel: function () { ev.preventDefault(); history.replaceState(null, '', location.pathname); location.reload(); },
    }[d.h] || function () {})();
  });
  rot.addEventListener('change', function (ev) {
    var el = ev.target;
    if (el.dataset.tema) {
      var id = el.dataset.tema, v = valgt(), ny = el.checked ? Object.keys(S).filter(function (t) { return v.indexOf(t) >= 0 || t === id; }) : v.filter(function (t) { return t !== id; });
      var andre = (T.inn.valgt || []).filter(function (x) { return x.indexOf(NETTSTED + '/') !== 0; });
      T.inn.valgt = andre.concat(ny.map(nokkel)); lagreInn(); tegn();
    } else if (el.name === 'st-modus') { T.inn.modus = el.value; lagreInn(); }
    else if (el.dataset.inn) { T.inn[el.dataset.inn] = el.checked; lagreInn(); }
    else if (el.id === 'st-legg-tema' && el.value) { T.fag.temaer.push(nokkel(el.value)); T.fag.endret = true; tegn(); }
    else if (el.id === 'st-bilde' && el.files[0]) {
      var tekst = (document.getElementById('st-forklaring') || {}).value || '';
      lesBilde(el.files[0]).then(function (url) { T.q.bilde = url; T.q.tekst = tekst; tegn(); }).catch(function (e) { varsle(e.message, true); });
    }
  });
  rot.addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter' && ev.target.id === 'st-kode') finnKurs();
    else if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.classList.contains('st-klikk')) { ev.preventDefault(); ev.target.click(); }
  });
  rot.addEventListener('input', function (ev) { if (T.fag && (ev.target.id === 'st-fagnavn' || ev.target.id === 'st-fagbeskr')) T.fag.endret = true; });

  // ---------------------------------------------------------------- oppstart
  if (!window.fhKonto || !window.fhKonto.sattOpp) { rot.innerHTML = '<p class="st-ind">Innlogging er ikke satt opp ennå.</p>'; return; }
  Promise.all([
    fetch('sporsmal.json').then(function (r) { if (!r.ok) throw new Error('Fant ikke spørsmålene.'); return r.json(); }),
    fetch('../loyper.json').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }).then(function (d) {
      if (!d || !d.sider) return;   // uten oversikten lenker vi til alle undertemaer
      var titler = {}; (d.temarekke || []).forEach(function (x) { titler[x.url] = x.tittel; });
      FINNES = {}; Object.keys(d.sider).forEach(function (k) { var u = d.sider[k].undertemaUrl; if (u) (FINNES[u] = FINNES[u] || []).push({ url: '..' + k, tittel: titler[k] || '' }); });
    }),
    window.fhKonto(),
  ]).then(function (r) {
    S = r[0].struktur; Q = r[0].sporsmal; T.omrader = r[0].omrader || {}; k = r[2];
    return k.auth.getSession();
  }).then(function (r) {
    var sesjon = r.data.session;
    if (!sesjon) {
      rot.innerHTML = '<div class="st-kort st-viktig"><b>Logg inn for å bruke studieappen</b><p>Med en gratis konto får du en løype gjennom temaene, ukentlige quizer tilpasset nivået ditt og en kunnskapsprofil. Samme konto gjelder på alle nettstedene til Realfagsambassaden.</p>' +
        '<p><a class="st-btn" href="../konto/index.html?neste=studie">Logg inn eller registrer deg</a></p></div>';
      return;
    }
    bruker = sesjon.user;
    return k.rpc('min_rolle').then(function (r) { T.rolle = r.data || 'student'; }).then(function () {
      if (location.hash === '#eksempel' && erUnderviser()) { T.eksempel = true; bruker = { id: 'eksempel', email: 'eksempelstudent' }; k = eksempelKlient(k); }
      return hentAlt();
    }).then(function () {
      var m = /^#fag-(.+)$/.exec(location.hash);
      if (m && !T.eksempel && T.mine.some(function (c) { return c.id === m[1]; })) { T.vis = 'kurs'; apneKurs(m[1]); }
      else if (location.hash === '#fag') ga('kurs');
      else tegn();
      if (T.ny && !T.eksempel) lagreInn();
    });
  }).catch(function (e) {
    rot.innerHTML = '<p class="st-feil">Fikk ikke startet studieappen: ' + esc(feilmelding(e)) + '</p>';
  });

  // For testene (verktoy/sporsmal/test_studie.js)
  window.__studie = { T: T, mat: mat, tx: tx, skar: skar, get Q() { return Q; } };
}
