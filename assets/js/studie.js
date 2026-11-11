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
  // Inne i fokusvisningen (arbeidskrav-kortet) trengs ikke sidens overskrift.
  if (document.documentElement.classList.contains('fh-innebygd')) { var tb = document.getElementById('title-block-header'); if (tb) tb.style.display = 'none'; }
  var NETTSTED = ((document.querySelector('meta[name="nettsted-navn"]') || {}).content || 'fysikkhjelp.no').replace(/\.no$/, '');
  var apiMeta = (document.querySelector('meta[name="fysikkhjelp-hint-api"]') || {}).content || '';
  var API = apiMeta.replace(/\/hint\/?$/, '');
  var NIV = ['lett', 'middels', 'vanskelig'], VEKT = { lett: 1, middels: 1.5, vanskelig: 2 };
  var OKT = 6, REP = 2, PER_DAG = 2;
  var S = {}, K = {}, Q = [], k = null, bruker = null;
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
      else if (c === '{' || c === '}') i++; // grupper, f.eks. desimalkomma 2{,}5, vises uten klammer
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
  var tittel = function (t) { return S[t] ? S[t].tittel : K[t] ? K[t].tittel : t; };

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
    clearTimeout(varsle.t); varsle.t = setTimeout(function () { var x = document.getElementById('st-varsel'); if (x) x.hidden = true; }, feil ? 8000 : 3000);
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
      k.from('kurs_deltaker').select('kurs, samtykke_innsyn, pameldt, kursinfo:kurs ( id, navn, krev_innsyn, temaer, beskrivelse, moduler, ramme, elementer )').eq('student', bruker.id).then(sjekk),
      k.from('kurs').select('*').eq('eier', bruker.id).order('opprettet').then(sjekk),
      // Øvinger kom senere: mangler tabellene (SQL ikke kjørt ennå), virker resten likevel.
      k.from('ovelser').select('*').order('opprettet').then(sjekk).catch(function () { return []; }),
      k.from('studie_quiz').select('*').eq('eier', bruker.id).then(sjekk).catch(function () { return []; }),
      k.from('profiler').select('navn').eq('id', bruker.id).maybeSingle().then(function (r) { T.navn = ((r && r.data && r.data.navn) || '').trim(); }, function () {}),
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
  function velgNeste(t, brukt, ut) {
    var n = niva(t), rek = [n, n - 1, n + 1, n - 2, n + 2];
    for (var i = 0; i < rek.length; i++) {
      if (rek[i] < 0 || rek[i] > 2) continue;
      var l = Q.filter(function (x) { return x.vanskelighet === NIV[rek[i]] && brukt.indexOf(x.id) < 0 && (ut && ut.length ? ut.indexOf(x.tema + '/' + x.undertema) >= 0 : x.tema === t); });
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
    if (!K[t] && !S[t]) return varsle('Temaet finnes ikke lenger.', true);
    var ut = kravIder(o).map(function (id) { return id.split('/').slice(1).join('/'); });
    // Egne spørsmål: i tilfeldig rekkefølge. Spørsmålsbanken: tilpasset nivået, eventuelt bare valgte undertemaer.
    var liste = o.kilde === 'egne' ? (o.sporsmal || []).map(function (x) { if (!erMal(x)) return x; try { return lagVariant(x); } catch (e) { return null; } }).map(function (x, i) {
      if (!x) return null;
      var tu = String(x.undertema || ut[0] || '').split('/'), tt = tu.length > 1 ? tu[0] : t, uu = tu.length > 1 ? tu[1] : tu[0];
      return Object.assign({}, x, { id: 'ov-' + o.id.slice(0, 8) + '-' + i, tema: K[tt] || S[tt] ? tt : t, undertema: uu || '', vanskelighet: x.vanskelighet || 'middels', forventet_tid_s: x.forventet_tid_s || 90, forklaring: x.forklaring || '' });
    }).filter(Boolean).map(function (x) { return [Math.random(), x]; }).sort(function (a, b) { return a[0] - b[0]; }).map(function (a) { return a[1]; }) : null;
    var n = liste ? liste.length : o.antall;
    if (!n) return varsle('Arbeidskravet har ingen spørsmål ennå.', true);
    T.q = { tema: t, nr: 0, hoved: n, antall: n, brukt: [], res: [], hovedRes: [], rekke: 0, ovelse: o, liste: liste, ut: ut };
    nesteSp(); ga('quiz');
  }
  // Lagres når quizen er ferdig. Øvingsquizer teller mot godkjenning.
  function avsluttQuiz() {
    var q = T.q; if (q.lagret) return; q.lagret = true;
    var antall = q.hovedRes.length; if (!antall) return;
    var riktige = q.hovedRes.filter(function (x) { return x === 'riktig'; }).length;
    var rad = { nettsted: NETTSTED, tema: q.tema, ovelse: q.ovelse ? q.ovelse.id : null, antall: antall, riktige: riktige };
    T.quizer.push(Object.assign({ fullfort: new Date().toISOString() }, rad));
    k.from('studie_quiz').insert(rad).then(sjekk).then(function () { try { if (window.parent !== window) window.parent.postMessage({ type: 'fh-quiz', ovelse: rad.ovelse }, location.origin); } catch (e) {} })
      .catch(function (e) { varsle('Resultatet ble ikke lagret: ' + feilmelding(e), true); });
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
    if (!x && q.nr < q.hoved) x = q.liste ? q.liste[q.nr] : velgNeste(q.tema, q.brukt, q.ut);
    if (!x) { q.ferdig = true; return; }
    q.brukt.push(x.id);
    var alt = [{ svar: x.riktig, type: 'riktig' }].concat(x.feil).map(function (a) { return [Math.random(), a]; }).sort(function (a, b) { return a[0] - b[0]; }).map(function (a) { return a[1]; });
    stoppTale();
    q.na = Object.assign({}, x, { alt: alt, rep: rep, start: performance.now() }); q.svart = null; q.kiSvar = null; q.kiBilde = false; q.bilde = null; q.tekst = '';
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
  // Tale blir til tekst PÅ ENHETEN (processLocally). Lyden sendes aldri til noen tjeneste og lagres ikke; bare teksten brukes.
  // Kan ikke nettleseren gjøre det lokalt på norsk, startes ikke mikrofonen (vi faller aldri tilbake til en nettjeneste).
  var TALE_SPRAK = 'nb-NO', taleKlar = null, taleNei = false;
  function lokalTale() {
    if (taleKlar) return taleKlar;
    var opt = { langs: [TALE_SPRAK], processLocally: true };
    taleKlar = (typeof Tale.available !== 'function' ? Promise.resolve('unavailable') : Tale.available(opt)).then(function (st) {
      if (st === 'available') return true;
      if ((st === 'downloadable' || st === 'downloading') && typeof Tale.install === 'function') {
        varsle('Laster ned norsk talegjenkjenning til enheten din (bare første gang) …');
        return Tale.install(opt).then(function (ok) { return !!ok; });
      }
      return false;
    }).catch(function () { return false; });
    taleKlar.then(function (ok) { if (!ok) taleKlar = null; });
    return taleKlar;
  }
  var IKKE_LOKAL = 'Nettleseren din kan ikke gjøre om tale til tekst på enheten. Bruk dikteringsknappen på tastaturet i stedet, eller skriv svaret.';
  function tale(knapp) {
    if (lytter) { lytter.stop(); return; }
    knapp.disabled = true;
    lokalTale().then(function (ok) {
      knapp.disabled = false;
      if (!ok) { taleNei = true; knapp.style.display = 'none'; return varsle(IKKE_LOKAL, true); }
      var felt = document.getElementById('st-forklaring');
      if (!felt || !knapp.isConnected) return;
      lytter = new Tale(); lytter.lang = TALE_SPRAK; lytter.processLocally = true; lytter.continuous = true; lytter.interimResults = false;
      lytter.onresult = function (ev) { for (var i = ev.resultIndex; i < ev.results.length; i++) if (ev.results[i].isFinal) felt.value += (felt.value && !/\s$/.test(felt.value) ? ' ' : '') + ev.results[i][0].transcript; };
      var denne = lytter;
      lytter.onend = function () { if (lytter === denne) lytter = null; if (knapp.isConnected) { knapp.textContent = '🎤 Snakk'; knapp.classList.remove('pa'); } };
      lytter.onerror = function (e) {
        varsle(e.error === 'not-allowed' ? 'Gi nettleseren lov til å bruke mikrofonen.' : e.error === 'language-not-supported' ? IKKE_LOKAL : 'Talegjenkjenningen stoppet.', true);
      };
      lytter.start(); knapp.textContent = '■ Stopp'; knapp.classList.add('pa');
    });
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
  function ki(sti, body, sek) {
    if (!API) return Promise.reject(new Error('KI-tjenesten er ikke satt opp ennå.'));
    // Svarer ikke KI innen rimelig tid, avbrytes forespørselen med en tydelig melding.
    var styr = window.AbortController ? new AbortController() : null, tid = styr && setTimeout(function () { styr.abort(); }, (sek || 60) * 1000);
    return k.auth.getSession().then(function (r) {
      var tok = r.data.session && r.data.session.access_token;
      return fetch(API + sti, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify(body), signal: styr ? styr.signal : undefined });
    }).then(function (r) { clearTimeout(tid); return r; }, function (e) { clearTimeout(tid); throw e && e.name === 'AbortError' ? new Error('KI brukte for lang tid på å svare. Prøv igjen om litt.') : e; }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.feil || 'KI-tjenesten svarte ikke (' + r.status + ').'); return d; }); });
  }
  function vurder() {
    var q = T.q, x = q.na, s = q.sist, tekst = document.getElementById('st-forklaring').value.trim();
    stoppTale();
    if (!tekst && !q.bilde) return varsle('Skriv, snakk eller last opp et bilde først.', true);
    if (q.ovelse && q.ovelse.svarform === 'bilde' && !q.bilde) return varsle('Ta bilde av utregningen først.', true);
    q.venter = true; tegn();
    ki('/vurder', { sporsmal: { tekst: x.tekst, riktig: x.riktig, forklaring: x.forklaring }, valgt: x.alt[q.svart].svar, forklaring: tekst, bilde: q.bilde })
      .then(function (d) {
        q.kiSvar = d; q.kiBilde = !!q.bilde; s.ki = { vurdering: d.vurdering, sikkerhet: d.sikkerhet, tilbakemelding: d.tilbakemelding, kilde: q.bilde ? 'bilde' : 'tekst' };
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
      k.from('kurs').insert({ navn: navn, kode: lagKode(), krev_innsyn: krev, temaer: [], status: 'pabegynt', ramme: STD_RAMME(), elementer: STD_ELEM, moduler: [] }).select('*').single().then(function (r) {
        if (r.error && r.error.code === '23505' && n < 5) return prov(n + 1);
        var c = sjekk(r); c.antall = 0; T.mine.push(c); varsle('Faget er laget som utkast. Det lagres automatisk mens du jobber.'); apneKurs(c.id, 'design');
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
    var samme = T.fag && T.fag.c.id === id;
    var u0 = fraFag(c);
    T.fag = { c: c, fane: fane || (samme ? T.fag.fane : 'design'), u: u0, steg: samme ? T.fag.steg : (u0.moduler.length ? 'moduler' : 'start'), laster: true };
    ga('fag');
    Promise.all([k.rpc('kurs_oversikt', { k: id }).then(sjekk), k.rpc('kurs_statistikk', { k: id }).then(sjekk),
                 c.krev_innsyn ? k.rpc('kurs_deltakere', { k: id }).then(sjekk) : Promise.resolve([]),
                 k.rpc('kurs_godkjenning', { k: id }).then(sjekk),
                 k.from('kurs_notat').select('notater').eq('kurs', id).maybeSingle().then(function (r) { return (r && r.data && r.data.notater) || {}; }, function () { return {}; })])
      .then(function (r) { Object.assign(T.fag, { laster: false, oversikt: r[0] || [], statistikk: r[1] || [], deltakere: r[2] || [], godkjenning: r[3] || [], notater: r[4] || {} }); })
      .catch(function (e) { Object.assign(T.fag, { laster: false, feil: feilmelding(e) }); }).then(tegn);
  }
  // ---------------------------------------------------------------- fagbyggeren
  // Et fag bygges av moduler (bokser nedover). Hver modul har uker, og hver uke undertemaer fra katalogen (alle temaer på
  // nettsiden). Alt lagres fortløpende som utkast («påbegynt»). «Publiser» gjør faget synlig og setter studentenes løype.
  function isoUke(d) { var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())), dag = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - dag); var a = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - a) / 864e5 + 1) / 7); }
  var STD_RAMME = function () { return { uker: 14, form: 'forelesninger', samlinger: 2, lengde: 90, startuke: isoUke(new Date()) }; };
  var STD_ELEM = { moduler: true, arbeidskrav: true, samlinger: true, tidslinje: true };
  var utNavn = function (id) { var p = id.split('/'), t = K[p[1]]; return t ? (t.undertemaer[p[2]] || p[2]) : p[2]; };
  var utTema = function (id) { var t = K[id.split('/')[1]]; return t ? t.tittel : id.split('/')[1]; };
  function nyId() { return Math.random().toString(36).slice(2, 10); }
  // Hver modul har en fast id (for notater) og en liste med beskjeder [{tekst, tid}]. Gammelt felt «beskjed» gjøres om.
  function medId(l) { (l || []).forEach(function (m) { if (!m.id) m.id = nyId(); if (!Array.isArray(m.beskjeder)) m.beskjeder = []; if ((m.beskjed || '').trim()) m.beskjeder.push({ tekst: m.beskjed, tid: '' }); delete m.beskjed; }); return l; }
  function alleBeskjeder(m) { var l = (m.beskjeder || []).slice(); if ((m.beskjed || '').trim()) l.push({ tekst: m.beskjed, tid: '' }); return l.sort(function (a, b) { return (b.tid || '').localeCompare(a.tid || ''); }); }
  function klokke(d) { return d.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' }); }
  function sendBeskjed(mi) {
    var f = T.fag, m = f.u.moduler[mi], t = ((f.nyBeskjed || {})[m.id] || '').trim();
    if (!t) return varsle('Skriv beskjeden først.', true);
    m.beskjeder = m.beskjeder || []; m.beskjeder.push({ tekst: t, tid: new Date().toISOString() }); f.nyBeskjed[m.id] = '';
    clearTimeout(f.tid); tegn();
    lagreUtkast().then(function () { if (!f.lagreFeil) varsle(f.c.status === 'publisert' ? 'Beskjeden er publisert. Studentene ser den nå.' : 'Beskjeden er lagret. Studentene ser den når faget er publisert.'); tegn(); });
  }
  function slettBeskjed(mi, i) {
    var f = T.fag, n = mi + ':' + i;
    if (f.slettBesk !== n) { f.slettBesk = n; return tegn(); }
    f.slettBesk = null; var m = f.u.moduler[mi], l = alleBeskjeder(m), x = l[i];
    m.beskjeder = (m.beskjeder || []).filter(function (y) { return y !== x; }); tegn();
    lagreUtkast().then(function () { if (!f.lagreFeil) varsle('Beskjeden er slettet.'); });
  }
  function fraFag(c) {
    return { navn: c.navn, emnebeskrivelse: c.emnebeskrivelse || '', laringsutbytte: c.laringsutbytte || '', ramme: Object.assign(STD_RAMME(), c.ramme || {}),
      elementer: Object.assign({}, STD_ELEM, c.elementer || {}), moduler: medId((c.moduler || []).length ? JSON.parse(JSON.stringify(c.moduler)) : fraTemaer(c.temaer || [])) };
  }
  // Fag laget før fagbyggeren har bare en temaliste. Den gjøres om til moduler: én modul per tema, én uke per tema.
  function fraTemaer(l) {
    return l.map(function (x) { var t = x.split('/')[1], kt = K[t]; if (!kt || x.indexOf(NETTSTED + '/') !== 0) return null;
      return { navn: kt.tittel, uker: [{ undertemaer: Object.keys(kt.undertemaer).slice(0, 4).map(function (u) { return x + '/' + u; }), notat: '' }] }; }).filter(Boolean);
  }
  // Private notater (bare fageieren) lagres i kurs_notat, adskilt fra fagraden som studentene kan lese.
  function notStatus(tekst, feil) {
    T.fag.notStatus = { t: tekst, feil: !!feil };
    document.querySelectorAll('.st-notstatus').forEach(function (el) { el.textContent = tekst; el.classList.toggle('st-feil', !!feil); });
  }
  function lagreNotater(naa) {
    var f = T.fag; clearTimeout(f.notTid); notStatus('Lagrer …');
    f.notTid = setTimeout(function () {
      k.from('kurs_notat').upsert({ kurs: f.c.id, notater: f.notater || {}, endret: new Date().toISOString() }).then(sjekk)
        .then(function () { notStatus('Lagret kl. ' + klokke(new Date()) + ' ✓'); if (naa) varsle('Notatet er lagret.'); })
        .catch(function (e) { notStatus('Ikke lagret!', true); varsle('Notatet ble ikke lagret: ' + feilmelding(e), true); });
    }, naa ? 0 : 1000);
  }
  function planlagreFag() {
    var f = T.fag; f.lagrer = true; clearTimeout(f.tid);
    var el = document.getElementById('st-lagret'); if (el) el.textContent = 'Lagrer …';
    f.tid = setTimeout(lagreUtkast, 1200);
  }
  function lagreUtkast() {
    var f = T.fag, u = f.u; if (!u) return Promise.resolve();
    var rad = { navn: (u.navn || '').trim() || f.c.navn, emnebeskrivelse: u.emnebeskrivelse, laringsutbytte: u.laringsutbytte, ramme: u.ramme, elementer: u.elementer, moduler: u.moduler, endret: new Date().toISOString() };
    return k.from('kurs').update(rad).eq('id', f.c.id).then(sjekk).then(function () {
      Object.assign(f.c, rad); f.lagrer = false; f.lagreFeil = null; f.lagret = new Date();
      var el = document.getElementById('st-lagret'); if (el) el.textContent = 'Lagret ' + f.lagret.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
    }).catch(function (e) {
      f.lagrer = false; f.lagreFeil = feilmelding(e);
      var el = document.getElementById('st-lagret'); if (el) { el.textContent = 'Ikke lagret!'; el.className = 'st-feil'; }
      varsle('Fikk ikke lagret endringene: ' + f.lagreFeil, true);
    });
  }
  function katalogListe() { var l = []; Object.keys(K).forEach(function (t) { Object.keys(K[t].undertemaer).forEach(function (u) { l.push({ id: NETTSTED + '/' + t + '/' + u, tittel: K[t].tittel + ': ' + K[t].undertemaer[u] }); }); }); return l; }
  // KI-sparring om fagoppsettet: underviseren kan skrive ønsker eller lime inn/laste opp en tidligere plan (tekst, bilde, PDF).
  // «endre» = KI får det nåværende oppsettet og gjør bare endringene det blir bedt om. Forrige oppsett kan hentes tilbake.
  function kiSpar() { var f = T.fag; if (!f.spar) f.spar = { tekst: '', vedlegg: null, filnavn: '' }; return f.spar; }
  function kiOppsett(endre) {
    var f = T.fag, u = f.u, sp = kiSpar();
    if (endre && !sp.tekst.trim() && !sp.vedlegg) return varsle('Skriv hva KI skal endre.', true);
    if (!endre && u.moduler.length && f.bekreftKi !== true) { f.bekreftKi = true; return tegn(); }
    f.bekreftKi = false; f.kiVenter = endre ? 'endre' : 'nytt'; tegn();
    ki('/fagforslag', { navn: u.navn, emnebeskrivelse: u.emnebeskrivelse, laringsutbytte: u.laringsutbytte, ramme: u.ramme, katalog: katalogListe(),
      onske: sp.tekst, vedlegg: sp.vedlegg, navarende: endre ? u.moduler : null }, 120)
      .then(function (d) { f.forrige = JSON.parse(JSON.stringify(u.moduler)); u.moduler = medId(d.moduler); f.kiKommentar = d.kommentar || ''; f.steg = 'moduler'; sp.tekst = ''; sp.vedlegg = null; sp.filnavn = ''; return lagreUtkast(); })
      .catch(function (e) { varsle(feilmelding(e), true); })
      .then(function () { f.kiVenter = false; tegn(); });
  }
  function angreKi() { var f = T.fag; if (!f.forrige) return; f.u.moduler = f.forrige; f.forrige = null; f.kiKommentar = ''; planlagreFag(); tegn(); varsle('Forrige oppsett er hentet tilbake.'); }
  function sparBoks(endre) {
    var f = T.fag, sp = kiSpar(), v = f.kiVenter === (endre ? 'endre' : 'nytt');
    return '<div class="st-kibox"><b>' + (endre ? 'Spør KI om endringer' : 'Ønsker eller en tidligere plan (valgfritt)') + '</b><p class="st-sm" style="margin:.2rem 0">' +
      (endre ? 'F.eks. «Slå sammen de to første modulene», «Legg energi før bevegelsesmengde» eller «Bruk planen i filen, men med 12 uker». KI får det nåværende oppsettet og endrer bare det du ber om.'
        : 'Skriv hva du ønsker, eller lim inn/last opp en plan du har brukt før (tekst, bilde eller PDF), så bygger KI oppsettet ut fra den. Filen sendes bare til KI og lagres ikke.') + '</p>' +
      '<textarea class="st-felt" rows="3" data-spar="tekst" placeholder="' + (endre ? 'Hva skal endres?' : 'F.eks. «Følg planen fra i fjor» eller lim inn planen her …') + '">' + esc(sp.tekst) + '</textarea>' +
      '<div class="st-vedlegg"><label class="st-btn g liten">📎 ' + (sp.filnavn ? esc(sp.filnavn) : 'Last opp plan') + '<input type="file" class="st-spar-fil" accept="image/*,application/pdf,.txt,.md,.tex"></label>' +
      (sp.filnavn ? '<button type="button" class="st-btn g liten" data-h="sparFjernFil">Fjern fil</button>' : '') +
      (endre ? '<button type="button" class="st-btn liten" data-h="kiEndre"' + (f.kiVenter ? ' disabled' : '') + '>' + (v ? 'KI jobber … (kan ta opptil et minutt)' : 'Send til KI') + '</button>' : '') + '</div></div>';
  }
  function byggSelv() { var f = T.fag; if (!f.u.moduler.length) f.u.moduler = [{ id: nyId(), navn: 'Modul 1', uker: [{ undertemaer: [], notat: '' }] }]; f.steg = 'moduler'; planlagreFag(); tegn(); }
  function publiserFag() {
    var f = T.fag, u = f.u, tm = [];
    u.moduler.forEach(function (m) { m.uker.forEach(function (w) { w.undertemaer.forEach(function (id) { var x = id.split('/').slice(0, 2).join('/'); if (tm.indexOf(x) < 0) tm.push(x); }); }); });
    if (!tm.length) return varsle('Legg til minst ett undertema før du publiserer.', true);
    clearTimeout(f.tid);
    lagreUtkast().then(function () { return k.from('kurs').update({ status: 'publisert', temaer: tm }).eq('id', f.c.id).then(sjekk); })
      .then(function () { f.c.status = 'publisert'; f.c.temaer = tm; varsle('Faget er publisert. Studentene kan melde seg på med koden ' + f.c.kode + '.'); tegn(); })
      .catch(function (e) { varsle(feilmelding(e), true); });
  }
  // Arbeidskrav (øvinger) med frist vises i uken fristen faller i.
  function kravIUke(nr) {
    var f = T.fag, start = +f.u.ramme.startuke || 0; if (!start) return [];
    return (T.ovelser || []).filter(function (o) { if (o.kurs !== f.c.id || !o.frist) return false; var w = isoUke(new Date(o.frist)) - start + 1; if (w < 1) w += 52; return w === nr; });
  }
  function samlingTekst(r, el) {
    if (!el.samlinger || r.form === 'ingen' || !(+r.samlinger)) return '';
    var n = +r.samlinger; return n + ' ' + (r.form === 'omvendt' ? (n === 1 ? 'samling' : 'samlinger') : (n === 1 ? 'forelesning' : 'forelesninger')) + ' à ' + (+r.lengde || 90) + ' min';
  }
  // Rammen (antall uker) styrer ikke innholdet direkte. Er det flere uker i modulene enn rammen tillater, får underviseren velge.
  function ukerBrukt(u) { return u.moduler.reduce(function (a, m) { return a + m.uker.length; }, 0); }
  function forMangeUker() {
    var u = T.fag.u, b = ukerBrukt(u), r = +u.ramme.uker || 0;
    if (!r || b <= r) return '';
    return '<div class="st-fb r"><b>Modulene har ' + b + ' uker, men rammen er ' + r + ' uker.</b>' +
      '<p>Endringen i antall uker fjerner ikke innhold av seg selv. Velg hva du vil gjøre:</p>' +
      '<p><button type="button" class="st-btn liten" data-h="kuttUker">Fjern ukene etter uke ' + r + '</button> ' +
      '<button type="button" class="st-btn g liten" data-h="kiOppsett" data-v="ja">La KI lage nytt oppsett for ' + r + ' uker</button></p>' +
      '<p class="st-sm">Eller fjern uker selv med ✕ i modulene.</p></div>';
  }
  function kuttUker() {
    var u = T.fag.u, igjen = +u.ramme.uker || 0;
    u.moduler = u.moduler.map(function (m) { var w = m.uker.slice(0, Math.max(0, igjen)); igjen -= w.length; return { navn: m.navn, uker: w }; }).filter(function (m) { return m.uker.length; });
    planlagreFag(); varsle('Ukene etter uke ' + u.ramme.uker + ' er fjernet.'); tegn();
  }
  var MODFARGE = ['var(--st-f)', 'var(--st-p)', '#eee462', 'var(--st-h)', '#c792ea', '#ff8a8f'];
  function byggerHtml() {
    var f = T.fag, u = f.u, c = f.c, r = u.ramme, el = u.elementer;
    var topp = '<div class="st-rad st-bygg-topp"><span class="st-sm">' + (c.status === 'publisert' ? '<b class="st-ord f">Publisert</b> · studentene kan melde seg på med koden ' + esc(c.kode) + ' og ser opplegget' : '<b style="color:#eee462">Påbegynt</b> · studentene finner ikke faget før du publiserer det') + '</span>' +
      '<span class="' + (f.lagreFeil ? 'st-feil' : 'st-sm') + '" id="st-lagret">' + (f.lagreFeil ? 'Ikke lagret!' : f.lagret ? 'Lagret ' + f.lagret.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' }) : 'Lagres automatisk') + '</span></div>';
    if (f.steg === 'start') {
      var radio = function (v, navn) { return '<label class="st-valg st-pille"><input type="radio" name="st-form" value="' + v + '"' + (r.form === v ? ' checked' : '') + '> ' + navn + '</label>'; };
      var tall = function (felt, navn, b) { return '<label class="st-sm st-tall">' + navn + '<input class="st-felt" data-felt="ramme.' + felt + '" inputmode="numeric" value="' + esc(r[felt]) + '" style="width:' + (b || 70) + 'px"></label>'; };
      var boks = function (felt, navn) { return '<label class="st-valg"><input type="checkbox" data-elem="' + felt + '"' + (el[felt] ? ' checked' : '') + '> ' + navn + '</label>'; };
      return topp +
        '<label class="st-sm" for="st-fn">Navn på faget</label><input id="st-fn" class="st-felt" data-felt="navn" maxlength="120" value="' + esc(u.navn) + '">' +
        '<div class="st-to"><label class="st-sm">Emnebeskrivelse (valgfri)<textarea data-felt="emnebeskrivelse" maxlength="20000" placeholder="Lim inn teksten fra emnebeskrivelsen">' + esc(u.emnebeskrivelse) + '</textarea></label>' +
        '<label class="st-sm">Læringsutbytte (valgfritt, ett per linje)<textarea data-felt="laringsutbytte" maxlength="5000">' + esc(u.laringsutbytte) + '</textarea></label></div>' +
        '<fieldset class="st-feltsett"><legend>Ramme og undervisningsform</legend><div class="st-piller" role="radiogroup" aria-label="Undervisningsform">' +
        radio('forelesninger', 'Forelesninger') + radio('omvendt', 'Omvendt klasserom') + radio('ingen', 'Ingen faste samlinger') + '</div>' +
        '<div class="st-tallrad">' + tall('uker', 'Uker') + tall('samlinger', 'Samlinger per uke') + tall('lengde', 'Lengde (min)') + tall('startuke', 'Første kalenderuke', 90) + '</div>' +
        '<p class="st-sm">Slides kan lages fra opplegget uansett form, også uten faste forelesninger.</p></fieldset>' +
        '<fieldset class="st-feltsett"><legend>Dette skal faget ha</legend><div class="st-to">' + boks('moduler', 'Moduler') + boks('arbeidskrav', 'Arbeidskrav') + boks('samlinger', 'Samlinger og slides') + boks('tidslinje', 'Tidslinje') + '</div></fieldset>' +
        forMangeUker() +
        (f.bekreftKi ? '<div class="st-fb r"><b>Erstatte oppsettet?</b><p>Faget har allerede ' + u.moduler.length + ' moduler. Et nytt forslag fra KI erstatter dem.</p><p><button type="button" class="st-btn" data-h="kiOppsett">Ja, lag nytt forslag</button> <button type="button" class="st-btn g" data-h="avbrytKi">Avbryt</button></p></div>' : '') +
        sparBoks(false) +
        '<div class="st-to st-valgkort">' +
        '<button type="button" class="st-stor fylt" data-h="kiOppsett"' + (f.kiVenter ? ' disabled' : '') + '><b>' + (f.kiVenter ? 'KI lager forslaget … (kan ta opptil et minutt)' : 'La KI foreslå oppsett') + '</b><span>Moduler og temaer per uke ut fra beskrivelsen, læringsutbyttet og det du har skrevet eller lastet opp over. Du kan endre alt etterpå.</span></button>' +
        '<button type="button" class="st-stor" data-h="byggSelv"><b>' + (u.moduler.length ? 'Gå til modulene' : 'Bygg selv') + '</b><span>' + (u.moduler.length ? u.moduler.length + ' moduler i utkastet.' : 'Start med én tom modul og legg til temaer selv.') + '</span></button></div>';
    }
    // moduler
    var nr = 0, valg = '<option value="">+ undertema …</option>' + Object.keys(K).map(function (t) {
      return '<optgroup label="' + esc(K[t].tittel) + '">' + Object.keys(K[t].undertemaer).map(function (x) { return '<option value="' + NETTSTED + '/' + t + '/' + x + '">' + esc(K[t].undertemaer[x]) + '</option>'; }).join('') + '</optgroup>'; }).join('');
    var brukt = u.moduler.reduce(function (a, m) { return a + m.uker.length; }, 0);
    var o = topp + '<div class="st-rad"><button type="button" class="st-tilbake" data-h="tilStart">← Beskrivelse og ramme</button><span class="st-sm' + (brukt > r.uker ? ' st-feil' : '') + '">' + brukt + ' av ' + r.uker + ' uker brukt</span></div>';
    o += forMangeUker();
    if (f.kiKommentar || f.forrige) o += '<div class="st-fb ki"><b>KI-forslag</b>' + (f.kiKommentar ? '<div class="st-avsnitt">' + txLinje(f.kiKommentar) + '</div>' : '') +
      (f.forrige ? '<p><button type="button" class="st-btn g liten" data-h="angreKi">Angre: hent tilbake forrige oppsett</button></p>' : '') + '</div>';
    o += sparBoks(true);
    o += '<div class="st-rad st-visning"><p class="st-sm" style="margin:0">Temaer og undertemaer er nettstedets faste innhold. Moduler er din egen inndeling av faget i uker, og en modul kan hente undertemaer fra flere temaer.</p>' +
      '<button type="button" class="st-btn g liten" data-h="tidslinje">Vis som tidslinje</button></div>';
    if (f.tidslinje) return topp + '<div class="st-rad st-visning"><b>Tidslinje</b><button type="button" class="st-btn g liten" data-h="tidslinje">Tilbake til redigering</button></div>' +
      '<p class="st-sm">Slik ser studentene tidslinjen. <a href="fokus.html#' + encodeURIComponent(c.id) + '" target="_blank" rel="noopener">Åpne faget i fokusvisning</a></p>' +
      tidslinjeHtml(u.moduler, r, el.arbeidskrav ? (T.ovelser || []).filter(function (x) { return x.kurs === c.id; }) : [], null, el);
    var mineKrav = el.arbeidskrav ? (T.ovelser || []).filter(function (x) { return x.kurs === c.id; }) : [];
    o += '<p class="st-sm" id="st-kravuten"></p><div class="st-lerret" id="st-lerret">' + (mineKrav.length ? '<div class="st-kravkol" id="st-kravkol" aria-label="Arbeidskrav"></div>' : '') + '<div class="st-modkol">';
    o += u.moduler.map(function (m, mi) {
      var fra = nr + 1; nr += m.uker.length;
      var farge = MODFARGE[mi % MODFARGE.length];
      return '<div class="st-modrad"><section class="st-modul" style="border-color:' + farge + '"><header><span class="st-modnr" style="color:' + farge + '">Modul ' + (mi + 1) + '</span>' +
        '<input class="st-modnavn" data-felt="mod" data-m="' + mi + '" value="' + esc(m.navn) + '" aria-label="Navn på modul ' + (mi + 1) + '" maxlength="60">' +
        '<span class="st-sm">' + (m.uker.length ? 'Uke ' + fra + (m.uker.length > 1 ? '–' + nr : '') : 'Ingen uker') + '</span>' +
        '<span class="st-knapper"><button type="button" class="st-ikon" data-h="flyttModul" data-m="' + mi + '" data-r="-1"' + (mi ? '' : ' disabled') + ' aria-label="Flytt modulen opp">↑</button>' +
        '<button type="button" class="st-ikon" data-h="flyttModul" data-m="' + mi + '" data-r="1"' + (mi < u.moduler.length - 1 ? '' : ' disabled') + ' aria-label="Flytt modulen ned">↓</button>' +
        '<button type="button" class="st-ikon" data-h="slettModul" data-m="' + mi + '" aria-label="Slett modulen">' + (f.slettMod === mi ? 'Slett?' : '✕') + '</button></span></header>' +
        m.uker.map(function (w, wi) {
          var uke = fra + wi, kal = (+r.startuke || 0) ? ((+r.startuke + uke - 2) % 52) + 1 : null, krav = el.arbeidskrav ? kravIUke(uke) : [], st = samlingTekst(r, el);
          return '<div class="st-uke"><div class="st-ukenr">Uke ' + uke + (kal ? '<span class="st-sm">kal.uke ' + kal + '</span>' : '') + '</div><div class="st-ukeinn">' +
            '<div class="st-chips">' + w.undertemaer.map(function (id, ti) { return '<span class="st-chip" data-ut="' + esc(id) + '" title="' + esc(utTema(id)) + '">' + esc(utNavn(id)) + '<button type="button" data-h="fjernUT" data-m="' + mi + '" data-u="' + wi + '" data-i="' + ti + '" aria-label="Fjern ' + esc(utNavn(id)) + '">×</button></span>'; }).join('') +
            '<select class="st-leggut" data-felt="leggUT" data-m="' + mi + '" data-u="' + wi + '" aria-label="Legg til undertema i uke ' + uke + '">' + valg + '</select></div>' +
            '<input class="st-notat" data-felt="notat" data-m="' + mi + '" data-u="' + wi + '" value="' + esc(w.notat || '') + '" placeholder="Notat (valgfritt)' + (r.form === 'omvendt' ? ', f.eks. hva studentene forbereder' : '') + '" maxlength="200">' +
            (st ? '<span class="st-sm">' + st + '</span>' : '') +
            krav.map(function (x) { return '<span class="st-kravmerke">' + esc(x.tittel) + ' · frist ' + dato(x.frist) + '</span>'; }).join('') + '</div>' +
            '<button type="button" class="st-ikon" data-h="slettUke" data-m="' + mi + '" data-u="' + wi + '" aria-label="Slett uke ' + uke + '">✕</button></div>';
        }).join('') +
        '<div class="st-modfot"><button type="button" class="st-btn g liten" data-h="nyUke" data-m="' + mi + '">+ Uke</button></div></section>' +
        '<div class="st-sidenotat"><div class="st-sideboks"><b class="st-sm">📣 Beskjeder til studentene</b>' +
        alleBeskjeder(m).map(function (b, bi) { return '<div class="st-besk"><span class="st-sm">' + (b.tid ? dato(b.tid) + ' kl. ' + klokke(new Date(b.tid)) : '') + '</span><div>' + esc(b.tekst) + '</div>' +
          '<button type="button" class="st-lenke st-sm" data-h="slettBeskjed" data-m="' + mi + '" data-i="' + bi + '">' + (f.slettBesk === mi + ':' + bi ? 'Bekreft sletting' : 'Slett') + '</button></div>'; }).join('') +
        '<textarea class="st-felt" rows="2" data-nybeskjed="' + esc(m.id) + '" maxlength="500" placeholder="Ny beskjed …">' + esc((f.nyBeskjed || {})[m.id] || '') + '</textarea>' +
        '<button type="button" class="st-btn liten" data-h="sendBeskjed" data-m="' + mi + '">' + (c.status === 'publisert' ? 'Publiser beskjed' : 'Lagre beskjed') + '</button></div>' +
        '<div class="st-sideboks"><b class="st-sm">🔒 Notat (bare du ser det)</b><textarea class="st-felt" rows="3" data-notat="' + esc(m.id) + '" maxlength="2000" placeholder="Egne notater til modulen">' + esc((f.notater || {})[m.id] || '') + '</textarea>' +
        '<div class="st-rad"><span class="st-sm st-notstatus' + (f.notStatus && f.notStatus.feil ? ' st-feil' : '') + '">' + (f.notStatus ? f.notStatus.t : 'Lagres automatisk') + '</span><button type="button" class="st-btn g liten" data-h="lagreNotat">Lagre</button></div></div></div></div>' +
        '<div class="st-pil" aria-hidden="true">↓</div>';
    }).join('');
    o += '<button type="button" class="st-nymodul" data-h="nyModul">+ Ny modul</button></div></div>';
    o += '<div class="st-bygg-bunn">' + (c.status === 'publisert' ? '<p class="st-sm">Faget er publisert. Endringer lagres og vises for studentene med en gang. Løypa oppdateres når du trykker «Publiser» på nytt.</p><button type="button" class="st-btn g" data-h="publiser">Oppdater løypa</button>'
      : '<button type="button" class="st-btn" data-h="publiser">Publiser for studentene</button><p class="st-sm">Til da er faget et utkast, og studentene finner det ikke med koden.</p>') + '</div>';
    o += '<p><button type="button" class="st-btn g liten" data-h="slettKurs" data-id="' + c.id + '">' + (T.slett === c.id ? 'Bekreft: slett faget for godt' : 'Slett faget') + '</button></p>';
    return o;
  }
  function studentNavn(x) { return (x.navn || '').trim() || x.epost; }
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
  // ---------------------------------------------------------------- varierende tall i egne spørsmål
  // Et spørsmål med "variabler" er en oppgavemal: hver student (og hvert forsøk) får egne tall, og fasit og gale svar regnes ut
  // her i nettleseren fra uttrykk (f.eks. "0.5*a*t^2"). Én mal = én oppgave, så studenten får aldri to like med bare nye tall.
  // Uttrykk: + - * / ^, parenteser, tall, variabler, pi, e og sqrt, sin, cos, tan (radianer), sind, cosd, tand (grader),
  // asin, acos, atan, asind, acosd, atand, ln, log (tierlogaritme), exp, abs.
  var FUNK_R = { sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan, ln: Math.log, log: Math.log10, exp: Math.exp, abs: Math.abs,
    sind: function (x) { return Math.sin(x * Math.PI / 180); }, cosd: function (x) { return Math.cos(x * Math.PI / 180); }, tand: function (x) { return Math.tan(x * Math.PI / 180); },
    asind: function (x) { return Math.asin(x) * 180 / Math.PI; }, acosd: function (x) { return Math.acos(x) * 180 / Math.PI; }, atand: function (x) { return Math.atan(x) * 180 / Math.PI; } };
  function regn(uttr, v) {
    var t = String(uttr).replace(/\s+/g, '').replace(/·|×/g, '*').replace(/,/g, '.').match(/\d+\.?\d*(?:e[+-]?\d+)?|\.\d+|[a-zA-Z_]\w*|[-+*/^()]/g) || [], i = 0;
    if (t.join('') !== String(uttr).replace(/\s+/g, '').replace(/·|×/g, '*').replace(/,/g, '.')) throw new Error('Ugyldige tegn i «' + uttr + '»');
    function sum() { var x = prod(); while (t[i] === '+' || t[i] === '-') { var o = t[i++], y = prod(); x = o === '+' ? x + y : x - y; } return x; }
    function prod() { var x = pot(); while (t[i] === '*' || t[i] === '/') { var o = t[i++], y = pot(); x = o === '*' ? x * y : x / y; } return x; }
    function pot() { var x = fortegn(); if (t[i] === '^') { i++; x = Math.pow(x, pot()); } return x; }
    function fortegn() { if (t[i] === '-') { i++; return -pot(); } if (t[i] === '+') { i++; return pot(); } return enkel(); }
    function enkel() {
      var a = t[i++];
      if (a === '(') { var x = sum(); if (t[i++] !== ')') throw new Error('Mangler «)» i «' + uttr + '»'); return x; }
      if (a == null) throw new Error('Uttrykket «' + uttr + '» slutter for tidlig');
      if (/^[\d.]/.test(a)) return parseFloat(a);
      if (FUNK_R[a]) { if (t[i++] !== '(') throw new Error(a + ' må ha parentes'); var y = sum(); if (t[i++] !== ')') throw new Error('Mangler «)» i «' + uttr + '»'); return FUNK_R[a](y); }
      if (a === 'pi') return Math.PI; if (a === 'e') return Math.E;
      if (v && Object.prototype.hasOwnProperty.call(v, a)) return v[a];
      throw new Error('Ukjent navn «' + a + '» i «' + uttr + '»');
    }
    var r = sum(); if (i < t.length) throw new Error('Kunne ikke lese «' + uttr + '»'); return r;
  }
  // Tall med n gjeldende siffer; store og små tall på standardform.
  function tallTekst(x, n) {
    if (!isFinite(x)) return '?';
    var y = +x.toPrecision(n || 3); if (y === 0) return '0';
    var ex = Math.floor(Math.log10(Math.abs(y)));
    if (ex >= 5 || ex <= -4) { var m = +(y / Math.pow(10, ex)).toPrecision(n || 3); return '$' + m + ' \\cdot 10^{' + ex + '}$'; }
    return String(y);
  }
  function erMal(x) { return !!(x && x.variabler && x.variabler.length); }
  function settInn(tekst, v, n) {
    return String(tekst || '').replace(/\{\{([^{}]+)\}\}/g, function (_, u) { u = u.trim(); if (Object.prototype.hasOwnProperty.call(v, u) && u !== 'svar') return String(+v[u].toPrecision(12)); return tallTekst(regn(u, v), n); });
  }
  function lagVariant(x) {
    var n = +x.siffer || 3, enh = x.enhet ? ' ' + String(x.enhet).replace(/\^-?\d/g, function (m) { return m.slice(1).split('').map(function (c) { return '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(c)]; }).join(''); }) : '';
    if (!String(x.svar || '').trim()) throw new Error('Skriv fasit som et uttrykk, f.eks. m*a.');
    x.variabler.forEach(function (a) { if (!/^[a-zA-Z_]\w*$/.test(a.navn || '') || FUNK_R[a.navn] || a.navn === 'pi' || a.navn === 'e' || a.navn === 'svar') throw new Error('Ugyldig variabelnavn «' + (a.navn || '') + '». Bruk bokstaver, f.eks. m eller v0.');
      if (!isFinite(+a.min) || !isFinite(+a.maks) || +a.maks < +a.min || !(+a.steg > 0)) throw new Error('Sjekk fra/til/steg for ' + a.navn + '.'); });
    for (var forsok = 0; forsok < 30; forsok++) {
      var v = {};
      x.variabler.forEach(function (a) { var mi = +a.min, ma = +a.maks, st = +a.steg || 1, k = Math.floor((ma - mi) / st + 1e-9) + 1; v[a.navn] = +(mi + Math.floor(Math.random() * Math.max(1, k)) * st).toPrecision(12); });
      var svar = regn(x.svar, v); if (!isFinite(svar)) continue;
      v.svar = svar;
      var riktig = tallTekst(svar, n) + enh, sett = [riktig];
      var feil = (x.feil || []).map(function (f) { var s2 = f.uttrykk ? (function () { try { var y = regn(f.uttrykk, v); return isFinite(y) ? tallTekst(y, n) + enh : ''; } catch (e) { return ''; } })() : settInn(f.svar, v, n); return { svar: s2, type: f.type }; })
        .filter(function (f) { if (!f.svar || sett.indexOf(f.svar) >= 0) return false; sett.push(f.svar); return true; });
      if (feil.length < 2) continue;
      return { tekst: settInn(x.tekst, v, n), riktig: riktig, feil: feil, forklaring: settInn(x.forklaring, v, n), undertema: x.undertema, vanskelighet: x.vanskelighet, forventet_tid_s: x.forventet_tid_s };
    }
    throw new Error('Fant ingen tall der fasit og gale svar blir forskjellige. Sjekk uttrykkene og variablene.');
  }
  function eksHtml(pv) {
    return '<div class="st-rad"><span class="st-sm">' + (pv.feil ? '<span class="st-feil">' + esc(pv.feil) + '</span>' : 'Eksempel med tilfeldige tall:') + '</span><button type="button" class="st-btn g liten" data-h="nyeTall">Prøv nye tall</button></div>' +
      (pv.ok ? '<div class="st-eks"><p class="st-sporsmal">' + tx(pv.ok.tekst) + '</p><p class="st-sm">Riktig: <b>' + tx(pv.ok.riktig) + '</b> · Gale: ' + pv.ok.feil.map(function (y) { return tx(y.svar); }).join(' · ') + '</p></div>' : '');
  }
  function provVariant(x) { try { return { ok: lagVariant(x) }; } catch (e) { return { feil: e.message }; } }

  // ---------------------------------------------------------------- arbeidskrav (fagbyggeren steg 2)
  // Et arbeidskrav er en quiz: fra spørsmålsbanken (6 spørsmål, kan avgrenses til undertemaer) eller fagets egne spørsmål
  // (skrevet av underviseren eller laget av KI, eventuelt ut fra underviserens egne oppgaver). Svarformen sier om studenten
  // må forklare svaret skriftlig, muntlig eller ett av delene.
  var SVARFORM = { bilde: 'Må laste opp bilde av utregningen (bruk mobilen)', valgfri: 'Bare velge svar (forklaring er valgfri)', skriftlig: 'Må forklare skriftlig (tekst eller bilde av utregning)', muntlig: 'Må forklare muntlig (tale blir tekst på enheten)', begge: 'Må forklare, skriftlig eller muntlig' };
  var SVARFORM_KORT = { bilde: 'bilde av utregningen', valgfri: '', skriftlig: 'skriftlig forklaring', muntlig: 'muntlig forklaring', begge: 'forklaring (skriftlig eller muntlig)' };
  function fagTemaer() {
    // Temaene i fagets moduler (i rekkefølge), ellers fagets temaer, ellers alle.
    var l = [];
    (T.fag.u.moduler || []).forEach(function (m) { m.uker.forEach(function (w) { w.undertemaer.forEach(function (id) { var x = id.split('/').slice(0, 2).join('/'); if (x.indexOf(NETTSTED + '/') === 0 && l.indexOf(x) < 0) l.push(x); }); }); });
    (T.fag.c.temaer || []).forEach(function (x) { if (l.indexOf(x) < 0) l.push(x); });
    return l.length ? l : Object.keys(K).map(nokkel);
  }
  // Et arbeidskrav dekker undertemaer («nettsted/tema/undertema»), gjerne fra flere temaer og moduler.
  function bankAntall(ids) { return Q.filter(function (x) { return ids.indexOf(NETTSTED + '/' + x.tema + '/' + x.undertema) >= 0; }).length; }
  function kravIder(o) { if ((o.undertemaer || []).length) return o.undertemaer; var t = (o.tema || '').split('/')[1]; return K[t] ? Object.keys(K[t].undertemaer).map(function (u) { return o.tema + '/' + u; }) : []; }
  function utNavnKort(id) { var p = id.split('/'); return (K[p[1]] && K[p[1]].undertemaer[p[2]]) || p[2]; }
  function dekkerTekst(o) { var l = kravIder(o).map(utNavnKort); return l.length <= 3 ? l.join(', ') : l.slice(0, 3).join(', ') + ' + ' + (l.length - 3) + ' til'; }
  function fagUtIder() { var l = []; (T.fag.u.moduler || []).forEach(function (m) { m.uker.forEach(function (w) { w.undertemaer.forEach(function (id) { if (l.indexOf(id) < 0) l.push(id); }); }); }); return l; }
  function tomtSp() { return { tekst: '', riktig: '', feil: [{ svar: '', type: 'regnefeil' }, { svar: '', type: 'begrep' }, { svar: '', type: 'begrep' }], forklaring: '', undertema: '', vanskelighet: 'middels' }; }
  function nyttKrav(o) {
    var f = T.fag, t = fagTemaer()[0] || '';
    f.ov = o ? JSON.parse(JSON.stringify({ id: o.id, tittel: o.tittel, ut: kravIder(o), kilde: o.kilde || 'bank', sporsmal: o.sporsmal || [], svarform: o.svarform || 'valgfri', krav: o.krav, antall: o.antall, frist: o.frist ? o.frist.slice(0, 10) : '', beskrivelse: o.beskrivelse || '' }))
      : { tittel: 'Arbeidskrav ' + ((T.ovelser || []).filter(function (x) { return x.kurs === f.c.id; }).length + 1), ut: [], kilde: 'egne', sporsmal: [], svarform: 'bilde', krav: 4, antall: 6, frist: '', beskrivelse: '' };
    f.kiKviss = { antall: 6, vanskelighet: 'blandet', grunnlag: '', vedlegg: null, filnavn: '' };
    tegn();
  }
  function kravAntall(v) { return v.kilde === 'egne' ? v.sporsmal.length : Math.max(1, Math.min(20, +v.antall || 6)); }
  function lagreKrav() {
    var f = T.fag, v = f.ov, n = kravAntall(v);
    if (!v.tittel.trim()) return varsle('Gi arbeidskravet en tittel.', true);
    if (!v.ut.length) return varsle('Velg hvilke undertemaer arbeidskravet dekker.', true);
    if (v.kilde === 'bank' && bankAntall(v.ut) < 1) return varsle('Spørsmålsbanken har ingen spørsmål her ennå. Velg «Egne spørsmål».', true);
    if (v.kilde === 'egne') {
      if (!n) return varsle('Legg til minst ett spørsmål.', true);
      if (n > 20) return varsle('Et arbeidskrav kan ha høyst 20 spørsmål.', true);
      for (var i = 0; i < n; i++) { var x = v.sporsmal[i];
        if (erMal(x)) { var pv = provVariant(x); if (pv.feil) return varsle('Spørsmål ' + (i + 1) + ': ' + pv.feil, true); continue; }
        if (!x.tekst.trim() || !x.riktig.trim() || x.feil.filter(function (y) { return y.svar.trim(); }).length < 2) return varsle('Spørsmål ' + (i + 1) + ' mangler tekst, riktig svar eller minst to gale svar.', true); }
    }
    var krav = Math.max(1, Math.min(n, +v.krav || 1));
    var rad = { kurs: f.c.id, tittel: v.tittel.trim(), tema: v.ut[0].split('/').slice(0, 2).join('/'), undertemaer: v.ut, kilde: v.kilde,
      sporsmal: v.kilde === 'egne' ? v.sporsmal.map(function (x) { var y = Object.assign({}, x, { feil: x.feil.filter(function (z) { return (z.svar || '').trim() || (erMal(x) && (z.uttrykk || '').trim()); }) }); if (!erMal(y)) { delete y.variabler; delete y.svar; } return y; }) : [],
      svarform: v.svarform, antall: n, krav: krav, frist: v.frist ? new Date(v.frist + 'T23:59:59').toISOString() : null, beskrivelse: v.beskrivelse.trim() };
    var sp = v.id ? k.from('ovelser').update(rad).eq('id', v.id).select('*').single() : k.from('ovelser').insert(rad).select('*').single();
    f.ovLagrer = true; tegn();
    sp.then(sjekk).then(function (o) {
      T.ovelser = (T.ovelser || []).filter(function (x) { return x.id !== o.id; }).concat([o]);
      f.ov = null; f.ovLagrer = false; varsle(v.id ? 'Arbeidskravet er oppdatert.' : 'Arbeidskravet er laget.'); tegn();
    }).catch(function (e) { f.ovLagrer = false; tegn(); varsle(feilmelding(e), true); });
  }
  function lesVedlegg(fil) {
    if (/^image\//.test(fil.type)) return lesBilde(fil).then(function (url) { return { vedlegg: url }; });
    if (fil.type === 'application/pdf') return new Promise(function (ok, nei) {
      if (fil.size > 4e6) return nei(new Error('PDF-en er for stor (høyst 4 MB). Del den opp, eller lim inn teksten.'));
      var r = new FileReader(); r.onload = function () { ok({ vedlegg: r.result }); }; r.onerror = nei; r.readAsDataURL(fil);
    });
    if (/^text\//.test(fil.type) || /\.(txt|md|tex)$/i.test(fil.name)) return fil.text().then(function (t) { return { tekst: t.slice(0, 8000) }; });
    return Promise.reject(new Error('Last opp et bilde, en PDF eller en tekstfil.'));
  }
  function kiKviss() {
    var f = T.fag, v = f.ov, kk = f.kiKviss;
    if (v.sporsmal.length >= 20) return varsle('Et arbeidskrav kan ha høyst 20 spørsmål.', true);
    if (!v.ut.length) return varsle('Velg først hvilke undertemaer arbeidskravet dekker.', true);
    var temaNavn = [], ut = v.ut.map(function (id) { var p = id.split('/'), kt = K[p[1]] || { tittel: p[1], undertemaer: {} }; if (temaNavn.indexOf(kt.tittel) < 0) temaNavn.push(kt.tittel); return { id: p[1] + '/' + p[2], tittel: kt.tittel + ': ' + (kt.undertemaer[p[2]] || p[2]) }; });
    kk.venter = true; tegn();
    ki('/kvisslag', { tema: temaNavn.join(', '), undertemaer: ut, antall: Math.min(+kk.antall || 6, 20 - v.sporsmal.length), vanskelighet: kk.vanskelighet, grunnlag: kk.grunnlag, vedlegg: kk.vedlegg }, 120)
      .then(function (d) {
        var l = (d.sporsmal || []).map(function (x) { var y = Object.assign(tomtSp(), x); y.riktig = y.riktig || ''; while (y.feil.length < 3) y.feil.push({ svar: '', uttrykk: '', type: 'begrep' }); return y; });
        if (!l.length) throw new Error('Fikk ingen spørsmål fra KI denne gangen. Prøv igjen.');
        v.sporsmal = v.sporsmal.concat(l); v.kilde = 'egne'; if (v.krav > v.sporsmal.length) v.krav = v.sporsmal.length;
        varsle(l.length + ' spørsmål lagt til. Sjekk fasiten før du lagrer.');
      })
      .catch(function (e) { varsle(feilmelding(e), true); })
      .then(function () { kk.venter = false; tegn(); });
  }
  function dekkerVelger(v) {
    var mods = T.fag.u.moduler || [], iMod = fagUtIder();
    var boks = function (id) { return '<label class="st-valg st-dekk"><input type="checkbox" data-dekk="' + esc(id) + '"' + (v.ut.indexOf(id) >= 0 ? ' checked' : '') + '> ' + esc(utNavnKort(id)) + '</label>'; };
    var o = '<fieldset class="st-feltsett"><legend>Dekker</legend><p class="st-sm" style="margin-top:0">Kryss av undertemaene arbeidskravet skal dekke. De kan ligge i flere moduler og temaer.' + (v.ut.length ? ' <b>' + v.ut.length + ' valgt.</b>' : '') + '</p>';
    o += mods.map(function (m, mi) {
      var ids = []; m.uker.forEach(function (w) { w.undertemaer.forEach(function (id) { if (ids.indexOf(id) < 0) ids.push(id); }); });
      if (!ids.length) return '';
      var alle = ids.every(function (id) { return v.ut.indexOf(id) >= 0; });
      return '<div class="st-dekkmod" style="border-color:' + MODFARGE[mi % MODFARGE.length] + '"><label class="st-valg"><input type="checkbox" data-dekkmod="' + mi + '"' + (alle ? ' checked' : '') + '> <b>Modul ' + (mi + 1) + ': ' + esc(m.navn) + '</b> <span class="st-sm">(hele modulen)</span></label><div class="st-to">' + ids.map(boks).join('') + '</div></div>';
    }).join('');
    var andre = Object.keys(K).map(function (t) {
      var ids = Object.keys(K[t].undertemaer).map(function (u) { return NETTSTED + '/' + t + '/' + u; }).filter(function (id) { return iMod.indexOf(id) < 0; });
      if (!ids.length) return '';
      var n = ids.filter(function (id) { return v.ut.indexOf(id) >= 0; }).length;
      return '<details' + (n ? ' open' : '') + '><summary>' + esc(K[t].tittel) + (n ? ' <span class="st-sm">(' + n + ' valgt)</span>' : '') + '</summary><div class="st-to">' + ids.map(boks).join('') + '</div></details>';
    }).join('');
    o += mods.length ? '<details class="st-andre"' + (v.ut.some(function (id) { return iMod.indexOf(id) < 0; }) ? ' open' : '') + '><summary class="st-sm">Undertemaer som ikke er i modulene</summary>' + andre + '</details>' : andre;
    return o + '</fieldset>';
  }
  function kravRedigerer() {
    var f = T.fag, v = f.ov, kk = f.kiKviss, n = kravAntall(v), iBank = bankAntall(v.ut);
    var opt = function (verdi, navn, valgt) { return '<option value="' + esc(verdi) + '"' + (valgt ? ' selected' : '') + '>' + esc(navn) + '</option>'; };
    var o = '<div class="st-kort st-kravred"><h3 style="margin-top:0">' + (v.id ? 'Rediger arbeidskrav' : 'Nytt arbeidskrav') + '</h3>' +
      '<label class="st-sm" for="st-ov-tittel">Tittel</label><input id="st-ov-tittel" class="st-felt" maxlength="120" data-ov="tittel" value="' + esc(v.tittel) + '">' +
      dekkerVelger(v) +
      '<fieldset class="st-feltsett"><legend>Spørsmål</legend>' +
      '<label class="st-valg"><input type="radio" name="st-ov-kilde" value="bank"' + (v.kilde === 'bank' ? ' checked' : '') + (iBank ? '' : ' disabled') + '> Fra spørsmålsbanken: tilfeldige spørsmål tilpasset studentens nivå' + (iBank ? ' <span class="st-sm">(' + iBank + ' å velge mellom)</span>' : ' <span class="st-sm">(ingen spørsmål her ennå)</span>') + '</label>' +
      '<label class="st-valg"><input type="radio" name="st-ov-kilde" value="egne"' + (v.kilde === 'egne' ? ' checked' : '') + '> Egne spørsmål for dette faget (skriv selv eller la KI lage dem)</label>';
    if (v.kilde === 'bank') o += '<label class="st-sm">Antall spørsmål <select data-ovvalg="antall">' + [4, 5, 6, 8, 10, 12, 15, 20].map(function (x) { return opt(x, x, +v.antall === x); }).join('') + '</select></label>' +
      (iBank && iBank < n ? '<p class="st-sm st-feil">Bare ' + iBank + ' spørsmål å velge mellom. Studentene får da færre enn ' + n + ' spørsmål.</p>' : '');
    if (v.kilde === 'egne') {
      o += '<div class="st-kibox"><b>La KI lage spørsmål</b><p class="st-sm">KI lager flervalgsspørsmål med fasit og typiske feilsvar. Har du egne oppgaver, kan du lime dem inn eller laste dem opp (bilde, PDF eller tekst), så lages spørsmålene ut fra dem. Filen sendes bare til KI og lagres ikke.</p>' +
        '<div class="st-rad" style="gap:1rem;flex-wrap:wrap"><label class="st-sm">Antall <select data-kk="antall">' + [3, 4, 5, 6, 8, 10, 12, 15].map(function (x) { return opt(x, x, +kk.antall === x); }).join('') + '</select></label>' +
        '<label class="st-sm">Vanskelighet <select data-kk="vanskelighet">' + [['blandet', 'Blandet'], ['lett', 'Lett'], ['middels', 'Middels'], ['vanskelig', 'Vanskelig']].map(function (x) { return opt(x[0], x[1], kk.vanskelighet === x[0]); }).join('') + '</select></label></div>' +
        '<textarea class="st-felt" data-kk="grunnlag" rows="3" placeholder="Lim inn egne oppgaver (valgfritt) …">' + esc(kk.grunnlag) + '</textarea>' +
        '<div class="st-vedlegg"><label class="st-btn g liten">📎 ' + (kk.filnavn ? esc(kk.filnavn) : 'Last opp oppgaver') + '<input type="file" id="st-kk-fil" accept="image/*,application/pdf,.txt,.md,.tex"></label>' +
        (kk.filnavn ? '<button type="button" class="st-btn g liten" data-h="kkFjernFil">Fjern fil</button>' : '') +
        '<button type="button" class="st-btn liten" data-h="kiKviss"' + (kk.venter ? ' disabled' : '') + '>' + (kk.venter ? 'KI lager spørsmål … (kan ta opptil et minutt)' : 'Lag spørsmål') + '</button></div></div>';
      o += v.sporsmal.map(function (x, i) {
        var mal = !!x.variabler;
        var ff = function (j) { var y = x.feil[j] || { svar: '', type: 'begrep' };
          return '<div class="st-rad" style="gap:.5rem"><input class="st-felt" data-ovsp="' + i + '.feil.' + j + '.' + (mal ? 'uttrykk' : 'svar') + '" value="' + esc(mal ? (y.uttrykk || '') : y.svar) + '" placeholder="' + (mal ? 'Galt svar ' + (j + 1) + ' som uttrykk, f.eks. m+a' : 'Galt svar ' + (j + 1)) + '" style="flex:1">' +
            '<select data-ovspv="' + i + '.feil.' + j + '.type">' + opt('regnefeil', 'regnefeil', y.type === 'regnefeil') + opt('begrep', 'feil fysikk', y.type !== 'regnefeil') + '</select></div>'; };
        var hode = '<div class="st-rad"><b>Spørsmål ' + (i + 1) + '</b><span>' +
          '<select data-ovspv="' + i + '.vanskelighet">' + NIV.map(function (z) { return opt(z, z, x.vanskelighet === z); }).join('') + '</select> ' +
          (v.ut.length ? '<select data-ovspv="' + i + '.undertema">' + opt('', '(undertema)', !x.undertema) + v.ut.map(function (id) { var kort = id.split('/').slice(1).join('/'); return opt(kort, utNavnKort(id), x.undertema === kort || x.undertema === id.split('/')[2]); }).join('') + '</select> ' : '') +
          '<button type="button" class="st-btn g liten" data-h="slettSp" data-i="' + i + '">Fjern</button></span></div>' +
          '<label class="st-valg st-sm"><input type="checkbox" data-ovmal="' + i + '"' + (mal ? ' checked' : '') + '> Varierende tall (hver student får egne tall)</label>';
        if (!mal) return '<div class="st-spred">' + hode +
          '<textarea class="st-felt" rows="2" data-ovsp="' + i + '.tekst" placeholder="Oppgavetekst. Formler mellom $ … $">' + esc(x.tekst) + '</textarea>' +
          '<input class="st-felt st-riktig" data-ovsp="' + i + '.riktig" value="' + esc(x.riktig) + '" placeholder="Riktig svar">' + ff(0) + ff(1) + ff(2) +
          '<textarea class="st-felt" rows="2" data-ovsp="' + i + '.forklaring" placeholder="Løsning som vises etter svaret (valgfritt)">' + esc(x.forklaring) + '</textarea>' +
          (x.tekst ? '<details><summary class="st-sm">Forhåndsvisning</summary><p class="st-sporsmal">' + tx(x.tekst) + '</p><p class="st-sm">Riktig: ' + tx(x.riktig) + '</p></details>' : '') + '</div>';
        var pv = provVariant(x);
        return '<div class="st-spred">' + hode +
          '<p class="st-sm" style="margin:0">Skriv tall som skal variere som {{navn}}, f.eks. «En kloss på {{m}} kg …». Også uttrykk går: {{0.5*m}}.</p>' +
          '<textarea class="st-felt" rows="2" data-ovsp="' + i + '.tekst" placeholder="Oppgavetekst med {{variabler}}">' + esc(x.tekst) + '</textarea>' +
          '<div class="st-varrad st-sm"><b>Variabler</b>' + x.variabler.map(function (a, j) {
            var fe = function (k2, ph, w) { return '<input class="st-felt" data-ovsp="' + i + '.variabler.' + j + '.' + k2 + '" value="' + esc(a[k2] == null ? '' : a[k2]) + '" placeholder="' + ph + '" style="width:' + w + 'px">'; };
            return '<span class="st-var">' + fe('navn', 'navn', 70) + ' fra ' + fe('min', 'min', 70) + ' til ' + fe('maks', 'maks', 70) + ' steg ' + fe('steg', 'steg', 60) +
              ' <button type="button" class="st-btn g liten" data-h="slettVar" data-i="' + i + '" data-j="' + j + '">×</button></span>'; }).join('') +
          '<button type="button" class="st-btn g liten" data-h="nyVar" data-i="' + i + '">+ variabel</button></div>' +
          '<div class="st-rad" style="gap:.5rem"><input class="st-felt st-riktig" data-ovsp="' + i + '.svar" value="' + esc(x.svar || '') + '" placeholder="Fasit som uttrykk, f.eks. m*a" style="flex:2">' +
          '<input class="st-felt" data-ovsp="' + i + '.enhet" value="' + esc(x.enhet || '') + '" placeholder="enhet" style="flex:1"></div>' + ff(0) + ff(1) + ff(2) +
          '<textarea class="st-felt" rows="2" data-ovsp="' + i + '.forklaring" placeholder="Løsning, f.eks. $F = ma$ = {{svar}}">' + esc(x.forklaring) + '</textarea>' +
          '<div id="st-eks-' + i + '">' + eksHtml(pv) + '</div></div>';
      }).join('') + '<p><button type="button" class="st-btn g liten" data-h="nyttSp">+ Skriv spørsmål selv</button></p>';
    }
    o += '</fieldset><label class="st-sm" for="st-ov-form">Svarform</label><select id="st-ov-form" data-ovvalg="svarform">' + Object.keys(SVARFORM).map(function (x) { return opt(x, SVARFORM[x], v.svarform === x); }).join('') + '</select>' +
      (v.svarform !== 'valgfri' ? '<p class="st-sm">Studenten må forklare hvert svar og få det vurdert av KI før neste spørsmål. Lyd lagres aldri; tale blir tekst på studentens enhet.</p>' : '') +
      '<label class="st-sm" for="st-ov-besk">Beskjed til studentene (valgfri)</label><textarea id="st-ov-besk" class="st-felt" rows="2" data-ov="beskrivelse" maxlength="2000" placeholder="F.eks. «Bruk formelarket. Vis utregningen.»">' + esc(v.beskrivelse) + '</textarea>' +
      '<div class="st-rad" style="gap:1rem"><span style="flex:1"><label class="st-sm" for="st-ov-krav">Krav for godkjent</label><select id="st-ov-krav" data-ovvalg="krav">' +
      (n ? Array.apply(null, { length: n }).map(function (_, i) { return opt(i + 1, 'minst ' + (i + 1) + ' av ' + n + ' riktige', +v.krav === i + 1 || (+v.krav > n && i + 1 === n)); }).join('') : '<option>legg til spørsmål først</option>') + '</select></span>' +
      '<span style="flex:1"><label class="st-sm" for="st-ov-frist">Frist (valgfri)</label><input id="st-ov-frist" class="st-felt" type="date" data-ov="frist" value="' + esc(v.frist) + '"></span></div>' +
      '<p style="margin-top:1rem"><button type="button" class="st-btn" data-h="lagreKrav"' + (f.ovLagrer ? ' disabled' : '') + '>' + (f.ovLagrer ? 'Lagrer …' : v.id ? 'Lagre endringene' : 'Lagre arbeidskravet') + '</button> <button type="button" class="st-btn g" data-h="avbrytKrav">Avbryt</button></p></div>';
    return o;
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
    g.forEach(function (x) { if (!studenter.some(function (y) { return y.id === x.student; })) studenter.push({ id: x.student, epost: x.epost, navn: x.navn }); });
    studenter.sort(function (a, b) { return studentNavn(a).localeCompare(studentNavn(b), 'nb'); });
    var hode = ['Navn', 'E-post'].concat(ol.map(function (x) { return x.tittel; })).concat(['Antall godkjent', 'Av']);
    var rader = studenter.map(function (st) {
      var r = ol.map(function (x) { var y = g.find(function (z) { return z.student === st.id && z.ovelse === x.id; }); return y && y.godkjent ? 'Godkjent' : 'Ikke godkjent'; });
      return [st.navn || '', st.epost].concat(r).concat([r.filter(function (v) { return v === 'Godkjent'; }).length, ol.length]);
    });
    var info = [['Øving', 'Krav'], ['Fag: ' + c.navn, 'Kode ' + c.kode + ', laget ' + new Date().toLocaleString('nb-NO')]].concat(ol.map(function (x) {
      return [x.tittel, dekkerTekst(x) + ', minst ' + x.krav + ' av ' + x.antall + ' riktige' + (x.frist ? ', frist ' + new Date(x.frist).toLocaleDateString('nb-NO') : '')]; }));
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
  // Med et fag (studentvisning av faget) blir den fiktive studenten påmeldt faget, med fagets løype og arbeidskrav.
  function eksempelKlient(ekte, fag, ovelser) {
    var db = { studie_innstillinger: [], studie_svar: [], studie_ukevurdering: [], kurs: [], kurs_deltaker: [], ovelser: ovelser || [], studie_quiz: [] }, nr = 1;
    var meg = 'eksempel', fagTemaer = fag ? (fag.temaer || []).filter(function (x) { return S[x.split('/')[1]]; }) : [];
    db.studie_innstillinger.push({ eier: meg, valgt: fagTemaer.length ? fagTemaer : ['kinematikk', 'newtons-lover', 'arbeid-og-energi'].map(nokkel), modus: 'alle', repetisjon: true, varsler: true, niva: {} });
    if (fag) db.kurs_deltaker.push({ kurs: fag.id, student: meg, samtykke_innsyn: !!fag.krev_innsyn, pameldt: new Date().toISOString(), kursinfo: { id: fag.id, navn: fag.navn, krev_innsyn: fag.krev_innsyn, temaer: fag.temaer, beskrivelse: fag.beskrivelse, moduler: fag.moduler, ramme: fag.ramme, elementer: fag.elementer } });
    var planTemaer = fagTemaer.length ? fagTemaer.slice(0, 2).map(function (x) { return x.split('/')[1]; }) : ['kinematikk', 'newtons-lover'];
    var plan = {}, frø = 11; plan[planTemaer[0]] = [0.9, 0.7]; if (planTemaer[1]) plan[planTemaer[1]] = [0.55, 0.6];
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
      var fornavn = (T.navn || '').split(/\s+/)[0];
      var o = '<p class="st-hand">Hei' + (fornavn ? ', ' + esc(fornavn) : '') + '!</p>' + (!T.navn && !T.eksempel ? '<p class="st-sm">Legg inn navnet ditt på <a href="../konto/index.html">Min side</a>, så ser faglæreren navnet ditt i stedet for e-posten.</p>' : '') + appKort();
      if (!v.length) o += '<div class="st-kort st-viktig"><b>Kom i gang</b><p>Velg temaene du skal studere, så lager vi en løype med én uke per tema.</p></div>';
      else o += '<div class="st-rad" style="align-items:center"><h2>Din løype</h2>' + (T.eksempel ? '' : '<a class="st-btn g liten" href="fokus.html#min">Fokusvisning</a>') + '</div>' + v.map(function (t, i) {
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
          var sf = q.ovelse && q.ovelse.svarform && q.ovelse.svarform !== 'valgfri' ? q.ovelse.svarform : '', kanTale = Tale && !taleNei, bareTale = sf === 'muntlig' && kanTale;
          fb += '<h3>Vis hvordan du tenkte' + (sf ? ' <span class="st-pakrevd">påkrevd</span>' : '') + '</h3><p class="st-sm">' +
            (sf === 'bilde' ? 'Løs oppgaven på papir og ta bilde av utregningen med mobilen. KI vurderer om du har forstått fysikken. Bildet lagres ikke. Du kan også skrive en kort forklaring.' : sf === 'muntlig' ? (kanTale ? 'Forklar muntlig: trykk «Snakk» og si hvordan du tenkte. Talen blir gjort om til tekst på enheten din, og lyden lagres aldri. Du kan rette teksten etterpå.' : 'Dette arbeidskravet ber om muntlig forklaring, men nettleseren din kan ikke gjøre tale om til tekst på enheten. Bruk dikteringsknappen på tastaturet, eller skriv forklaringen.')
              : (sf ? 'Du må forklare svaret før du går videre. ' : 'Valgfritt. ') + 'Ta bilde av utregningen eller forklar med egne ord, så vurderer KI om du har forstått fysikken. Bildet lagres ikke. Snakker du, blir talen gjort om til tekst på enheten din, og lyden lagres aldri.') + '</p>' +
            '<textarea id="st-forklaring" placeholder="' + (bareTale ? 'Trykk «Snakk» …' : 'Forklar hvordan du tenkte …') + '">' + esc(q.tekst || '') + '</textarea>' +
            '<div class="st-vedlegg">' + (kanTale && sf !== 'skriftlig' && sf !== 'bilde' ? '<button type="button" class="st-btn g" data-h="tale">🎤 Snakk</button>' : '') +
            (sf === 'muntlig' ? '' : '<label class="st-btn g">📷 ' + (q.bilde ? 'Bytt bilde' : 'Ta bilde') + '<input type="file" accept="image/*" capture="environment" id="st-bilde"></label>') +
            '<button type="button" class="st-btn" data-h="vurder"' + (q.venter ? ' disabled' : '') + '>' + (q.venter ? 'Vurderer …' : 'Få tilbakemelding') + '</button></div>' +
            (q.bilde ? '<img class="st-forhand" alt="Bildet ditt" src="' + q.bilde + '">' : '') +
            (kis && kis.feil ? '<p class="st-feil">' + esc(kis.feil) + '</p>' : '');
        }
        var sfk = q.ovelse && q.ovelse.svarform, mangler = sfk && sfk !== 'valgfri' && (!q.kiSvar || (sfk === 'bilde' && !q.kiBilde));
        fb += '<p class="st-videre"><button type="button" class="st-btn" data-h="videre"' + (mangler ? ' disabled title="Forklar svaret først"' : '') + '>' + (q.nr + 1 >= q.antall ? 'Se resultat' : 'Neste') + '</button>' + (mangler ? ' <span class="st-sm">' + (sfk === 'bilde' ? 'Last opp bilde av utregningen og trykk «Få tilbakemelding» først.' : 'Forklar svaret og trykk «Få tilbakemelding» først.') + '</span>' : '') + '</p>';
      }
      return '<div class="st-rad st-sm"><span>' + esc(tittel(x.tema)) + (function (n) { return n ? ' · ' + esc(n) : ''; })(((S[x.tema] || K[x.tema] || {}).undertemaer || {})[x.undertema]) + (x.rep ? ' · repetisjon' : '') + '</span><span>' + (q.nr + 1) + ' av ' + q.antall + '</span></div>' +
        '<div class="st-fram"><i style="width:' + (q.nr / q.antall * 100) + '%"></i></div>' +
        (q.ovelse && q.nr === 0 && q.ovelse.beskrivelse && sv == null ? '<div class="st-fb"><b>' + esc(q.ovelse.tittel) + '</b><p>' + esc(q.ovelse.beskrivelse) + '</p></div>' : '') +
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
            return '<tr class="st-klikk" data-h="apneKurs" data-id="' + c.id + '" tabindex="0"><td><b>' + esc(c.navn) + '</b>' + (c.status === 'pabegynt' ? ' <span class="st-pabegynt">(påbegynt)</span>' : '') + (c.krev_innsyn ? '' : '<br><span class="st-sm">bare samletall</span>') + '</td><td class="st-kode">' + esc(c.kode) + '</td><td>' + (c.antall == null ? '–' : c.antall) + '</td><td>' + (c.temaer || []).length + '</td></tr>';
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
          ovelseListe(d.kurs) + studentFagTillegg(d) + '</div>';
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
      var o = '<button type="button" class="st-tilbake" data-h="ga" data-v="kurs">← Fagene dine</button><h2 class="st-h1">' + esc(c.navn) + (c.status === 'pabegynt' ? ' <span class="st-pabegynt">(påbegynt)</span>' : '') + '</h2>' +
        '<div class="st-rad" style="flex-wrap:wrap"><p class="st-sm" style="margin:0">Kode til studentene: <b class="st-kode">' + esc(c.kode) + '</b> · ' + (c.krev_innsyn ? 'innsyn i studentenes profil' : 'bare samletall') + '</p>' +
        '<span><a class="st-btn g liten" href="fokus.html#' + encodeURIComponent(c.id) + '" target="_blank" rel="noopener">Fokusvisning</a> <button type="button" class="st-btn g liten" data-h="studentvisning" data-id="' + c.id + '">Se faget som student</button></span></div>' +
        '<nav class="st-underfaner">' + [['design', 'Utforming'], ['ovinger', 'Arbeidskrav'], ['studenter', 'Studenter'], ['statistikk', 'Statistikk']].filter(function (x) { return x[0] !== 'ovinger' || f.u.elementer.arbeidskrav; }).map(function (x) {
          return '<button type="button" aria-selected="' + (f.fane === x[0]) + '" data-h="fagFane" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</nav>';
      if (f.fane === 'design') return o + byggerHtml();
      if (f.laster) return o + '<p class="st-ind">Laster …</p>';
      if (f.feil) return o + '<p class="st-feil">' + esc(f.feil) + '</p>';
      if (f.fane === 'ovinger') {
        var ol = (T.ovelser || []).filter(function (x) { return x.kurs === c.id; });
        o += '<h3>Arbeidskrav</h3>' + (ol.length ? ol.map(function (x) {

          return '<div class="st-kort"><div class="st-rad"><b>' + esc(x.tittel) + '</b><span><button type="button" class="st-btn g liten" data-h="redigerKrav" data-id="' + x.id + '">Rediger</button> ' +
            '<button type="button" class="st-btn g liten" data-h="slettOvelse" data-id="' + x.id + '">' + (T.slettOv === x.id ? 'Bekreft sletting' : 'Slett') + '</button></span></div>' +
            '<span class="st-sm">' + esc(dekkerTekst(x)) + ' · ' + (x.kilde === 'egne' ? x.antall + ' egne spørsmål' : 'spørsmålsbanken') + ' · minst ' + x.krav + ' av ' + x.antall + ' riktige' +
            (SVARFORM_KORT[x.svarform] ? ' · krever ' + SVARFORM_KORT[x.svarform] : '') + (x.frist ? ' · frist ' + dato(x.frist) : ' · ingen frist') + '</span></div>';
        }).join('') : '<p class="st-ind">Ingen arbeidskrav ennå.</p>') +
          (f.ov ? kravRedigerer() : '<p><button type="button" class="st-btn" data-h="nyttKrav">+ Nytt arbeidskrav</button></p>');
        if (!ol.length) return o;
        var g = f.godkjenning || [], studenter = [];
        g.forEach(function (x) { if (!studenter.some(function (y) { return y.id === x.student; })) studenter.push({ id: x.student, epost: x.epost, navn: x.navn }); });
        studenter.sort(function (a, b) { return studentNavn(a).localeCompare(studentNavn(b), 'nb'); });
        o += '<h3>Godkjenning</h3>';
        if (!studenter.length) return o + '<p class="st-ind">Ingen påmeldte ennå.</p>';
        var finn = function (sid, oid) { return g.find(function (x) { return x.student === sid && x.ovelse === oid; }) || {}; };
        return o + '<p><button type="button" class="st-btn g liten" data-h="excel">Last ned Excel-ark</button></p><div class="st-tabell-ramme"><table class="st-tabell"><thead><tr><th>Student</th>' +
          ol.map(function (x) { return '<th>' + esc(x.tittel) + '</th>'; }).join('') + '<th>Godkjent</th></tr></thead><tbody>' +
          studenter.map(function (st) {
            var n = ol.filter(function (x) { return finn(st.id, x.id).godkjent; }).length;
            return '<tr><td>' + esc(studentNavn(st)) + (st.navn ? '<br><span class="st-sm">' + esc(st.epost) + '</span>' : '') + '</td>' + ol.map(function (x) { var r = finn(st.id, x.id);
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
          if (sort === 'epost') return studentNavn(a).localeCompare(studentNavn(b), 'nb');
          var x = a[sort] == null ? 2 : +a[sort], y = b[sort] == null ? 2 : +b[sort];
          return sort === 'sist_aktiv' || sort === 'svar' ? (Date.parse(b[sort]) || +b[sort] || 0) - (Date.parse(a[sort]) || +a[sort] || 0) : x - y;
        });
        var th = function (k2, navn, kl) { return '<th><button type="button" class="st-sorter' + (sort === k2 ? ' pa' : '') + (kl ? ' st-ord ' + kl : '') + '" data-h="sorter" data-v="' + k2 + '">' + navn + '</button></th>'; };
        var celle = function (v, kl) { return '<td><div class="st-minibar"><i class="' + kl + '" style="width:' + (v == null ? 0 : Math.round(v * 100)) + '%"></i></div><span class="st-sm">' + pst(v) + '</span></td>'; };
        return o + '<p class="st-sm">' + f.deltakere.length + ' studenter har godtatt innsyn. Klikk på en student for å se hele profilen. Klikk på en overskrift for å sortere (svakest først).</p>' +
          '<div class="st-tabell-ramme"><table class="st-tabell"><thead><tr>' + th('epost', 'Student') + th('svar', 'Svar') + th('sist_aktiv', 'Sist aktiv') + th('forstaelse', 'Forståelse', 'f') + th('presisjon', 'Presisjon', 'p') + th('hurtighet', 'Hurtighet', 'h') + '</tr></thead><tbody>' +
          liste.map(function (s) {
            return '<tr class="st-klikk" data-h="visStudent" data-id="' + s.student + '" data-epost="' + esc(studentNavn(s)) + '" tabindex="0"><td>' + esc(studentNavn(s)) + '<br><span class="st-sm">' + (s.navn ? esc(s.epost) + ' · ' : '') + 'påmeldt ' + dato(s.pameldt) + '</span></td><td>' + s.svar + '</td><td>' + dato(s.sist_aktiv) + '</td>' +
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
  // «Få appen på telefonen»: installerbar nettapp. Android/Chrome gir en knapp; iPhone/iPad må bruke Del-menyen.
  function appKort() {
    var a = window.fhApp || {}, ua = navigator.userAgent || '';
    var ios = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1), mobil = ios || /android|mobile/i.test(ua);
    try { if (a.installert || T.eksempel || localStorage.getItem('fh-app-skjul')) return ''; } catch (e) {}
    if (!a.kanInstallere && !mobil) return '';
    var hjelp = a.kanInstallere ? '<button type="button" class="st-btn liten" data-h="installer">Installer appen</button>'
      : ios ? '<span class="st-sm">I Safari: trykk <b>Del</b>-knappen (firkant med pil opp) og velg <b>«Legg til på Hjem-skjerm»</b>.</span>'
      : '<span class="st-sm">Åpne nettlesermenyen (⋮) og velg <b>«Installer app»</b> eller <b>«Legg til på startskjermen»</b>.</span>';
    return '<div class="st-kort st-appkort"><div class="st-rad"><b>📱 Få appen på telefonen</b><button type="button" class="st-lenke st-sm" data-h="skjulApp">Ikke nå</button></div>' +
      '<p class="st-sm" style="margin:.2rem 0 .5rem">Med appen åpner du løypa, quizene og fagene dine rett fra hjemskjermen, i fullskjerm.</p>' + hjelp + '</div>';
  }
  document.addEventListener('fh-app', function () { if (T.svar) tegn(); });
  // Beskjeder fra underviseren og fagets tidslinje for studenten.
  function studentFagTillegg(d) {
    var c = d.kursinfo || {}, mods = c.moduler || [], o = '';
    var besk = []; mods.forEach(function (m) { alleBeskjeder(m).forEach(function (b) { besk.push({ m: m, b: b }); }); });
    besk.sort(function (x, y) { return (y.b.tid || '').localeCompare(x.b.tid || ''); });
    if (besk.length) o += '<p class="st-sm" style="margin-top:.6rem"><b>Beskjeder fra faglæreren</b></p>' + besk.map(function (x) { return '<div class="st-tl-beskjed">📣 ' + (x.b.tid ? '<span class="st-sm">' + dato(x.b.tid) + ' · </span>' : '') + '<b>' + esc(x.m.navn) + ':</b> ' + esc(x.b.tekst) + '</div>'; }).join('');
    if (mods.length && (c.elementer || {}).tidslinje !== false) {
      var apen = T.tid && T.tid[d.kurs];
      o += '<p><a class="st-btn liten" href="fokus.html#' + encodeURIComponent(d.kurs) + '">Fokusvisning</a> <button type="button" class="st-btn g liten" data-h="tidStudent" data-id="' + d.kurs + '">' + (apen ? 'Skjul tidslinjen' : 'Se tidslinjen for faget') + '</button></p>';
      if (apen) o += tidslinjeHtml(mods, c.ramme || {}, (T.ovelser || []).filter(function (x) { return x.kurs === d.kurs; }), null, Object.assign({}, STD_ELEM, c.elementer || {}));
    }
    return o;
  }
  function ovelseListe(kursId) {
    var l = (T.ovelser || []).filter(function (o) { return o.kurs === kursId; });
    if (!l.length) return '';
    return '<p class="st-sm" style="margin-top:.6rem"><b>Obligatoriske øvinger</b></p>' + l.map(function (o) {
      var ok = godkjent(o), ute = o.frist && Date.now() > Date.parse(o.frist);
      return '<div class="st-ovelse"><span class="st-status ' + (ok ? 'ok' : 'nei') + '">' + (ok ? '✓ Godkjent' : 'Ikke godkjent') + '</span><b>' + esc(o.tittel) + '</b>' +
        '<span class="st-sm">' + esc(dekkerTekst(o)) + ' · minst ' + o.krav + ' av ' + o.antall + ' riktige' + (SVARFORM_KORT[o.svarform] ? ' · krever ' + SVARFORM_KORT[o.svarform] : '') + (o.frist ? ' · frist ' + dato(o.frist) : '') + '</span>' +
        (o.beskrivelse ? '<span class="st-sm">' + esc(o.beskrivelse) + '</span>' : '') +
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

  function ga(v, p) { stoppTale(); if (T.fag && T.fag.lagrer) { clearTimeout(T.fag.tid); lagreUtkast(); } Object.assign(T, { vis: v }, p || {}); if (v !== 'profil') T.kiRad = T.kiRad && T.kiRad.rad ? T.kiRad : null; tegn(); rot.scrollIntoView({ block: 'start' }); }
  function tegn() {
    // Et synlig varsel skal overleve at siden tegnes på nytt.
    var gml = document.getElementById('st-varsel'), vis = gml && !gml.hidden ? { t: gml.textContent, k: gml.className } : null;
    var faner = erUnderviser() && !T.eksempel ? [['kurs', 'Fagene mine'], ['hjem', 'Løype'], ['profil', 'Profil']] : [['hjem', 'Løype'], ['profil', 'Profil'], ['kurs', 'Fag']];
    var aktiv = { uke: 'hjem', quiz: 'hjem', resultat: 'hjem', ferdigIdag: 'hjem', pamelding: 'kurs', fag: 'kurs' }[T.vis] || T.vis;
    rot.innerHTML = (T.eksempel ? '<div class="st-eksempel"><b>Studentvisning.</b> Du ser ' + (T.eksempelFag ? '«' + esc(T.eksempelFag.navn) + '»' : 'appen') + ' som en fiktiv student. Ingenting lagres. <a href="#" data-h="avsluttEksempel">Tilbake til undervisning</a></div>' : '') + '<nav class="st-faner" role="tablist">' + faner.map(function (f) { return '<button type="button" role="tab" aria-selected="' + (aktiv === f[0]) + '" data-h="ga" data-v="' + f[0] + '">' + f[1] + '</button>'; }).join('') + '</nav>' +
      '<div class="st-innhold">' + SKJ[T.vis]() + '</div><p id="st-varsel" class="st-varsel" role="status" hidden></p>';
    if (vis) { var ny = document.getElementById('st-varsel'); ny.textContent = vis.t; ny.className = vis.k; ny.hidden = false; }
    rot.classList.toggle('st-bred', !!document.getElementById('st-lerret'));
    tegnKravStolper();
  }
  // Arbeidskrav som stolper til venstre for modulene: en stolpe går langs de undertemaene den dekker. Dekker den hele modul 3
  // og ett av fire undertemaer i modul 4, går den langs hele modul 3 og en firedel av uka i modul 4. Overlappende stolper
  // legges i hver sin bane.
  // Felles for lerretet og tidslinjene: stolper i baner til venstre. segmenter(o) gir [topp, bunn] (px fra toppen av «ler»).
  function plasserStolper(ler, kol, l, segmenter, handling) {
    var bunn = ler.getBoundingClientRect().top, staver = [], ikke = [];
    l.forEach(function (o) {
      var top = Infinity, slutt = -Infinity;
      segmenter(o, bunn).forEach(function (x) { top = Math.min(top, x[0]); slutt = Math.max(slutt, x[1]); });
      if (top === Infinity) ikke.push(o); else staver.push({ o: o, top: top, slutt: slutt, farge: kravFarge(o) });
    });
    var baner = [];
    staver.sort(function (a, b) { return a.top - b.top; }).forEach(function (x) { for (var b = 0; b < baner.length && baner[b] > x.top + 2; b++); x.bane = b; baner[b] = x.slutt; });
    kol.style.width = (baner.length ? baner.length * 34 : 0) + 'px';
    kol.innerHTML = staver.map(function (x) {
      var t = x.o.tittel + (x.o.frist ? ' · frist ' + dato(x.o.frist) : '');
      return '<button type="button" class="st-kravstolpe" data-h="' + handling + '" data-id="' + x.o.id + '" title="' + esc(t + ' – ' + dekkerTekst(x.o)) + '" style="top:' + x.top + 'px;height:' + Math.max(28, x.slutt - x.top) + 'px;left:' + x.bane * 34 + 'px;border-color:' + x.farge + ';color:' + x.farge + '"><span>' + esc(t) + '</span></button>';
    }).join('');
    return ikke;
  }
  // Samme farge på et arbeidskrav overalt (stolpe og flagg), ut fra rekkefølgen i faget.
  function kravFarge(o) { var l = (T.ovelser || []).filter(function (x) { return x.kurs === o.kurs; }), i = l.indexOf(o); if (i < 0) i = l.findIndex(function (x) { return x.id === o.id; }); return MODFARGE[(Math.max(0, i) + 2) % MODFARGE.length]; }
  function tegnKravStolper() {
    var ler = document.getElementById('st-lerret'), kol = document.getElementById('st-kravkol'), uten = document.getElementById('st-kravuten');
    if (ler && kol && T.fag) {
      var ikke = plasserStolper(ler, kol, (T.ovelser || []).filter(function (x) { return x.kurs === T.fag.c.id; }), function (o, bunn) {
        var ids = kravIder(o), seg = [];
        ler.querySelectorAll('.st-chip[data-ut]').forEach(function (ch) {
          if (ids.indexOf(ch.dataset.ut) < 0) return;
          var uke = ch.closest('.st-uke'), alle = uke.querySelectorAll('.st-chip'), i = Array.prototype.indexOf.call(alle, ch), n = alle.length, r = uke.getBoundingClientRect();
          seg.push([r.top - bunn + r.height * i / n, r.top - bunn + r.height * (i + 1) / n]);
        });
        return seg;
      }, 'kravStolpe');
      if (uten) uten.textContent = ikke.length ? 'Arbeidskrav som ikke dekker noe i modulene: ' + ikke.map(function (o) { return o.tittel; }).join(', ') + '.' : '';
    }
    // Tidslinjene: stolpen går fra det første til det siste undertemaet arbeidskravet dekker, og ned til flagget.
    rot.querySelectorAll('.st-tl-lerret').forEach(function (tl) {
      var ids0 = (tl.dataset.krav || '').split(',').filter(Boolean), l = (T.ovelser || []).filter(function (o) { return ids0.indexOf(o.id) >= 0; });
      plasserStolper(tl, tl.querySelector('.st-tl-kravkol'), l, function (o, bunn) {
        var ids = kravIder(o), seg = [];
        tl.querySelectorAll('.st-tl-ut[data-ut]').forEach(function (ch) { if (ids.indexOf(ch.dataset.ut) < 0) return; var r = ch.getBoundingClientRect(); seg.push([r.top - bunn - 2, r.bottom - bunn + 2]); });
        tl.querySelectorAll('.st-tl-flagg[data-flagg="' + o.id + '"]').forEach(function (f) { var r = f.getBoundingClientRect(); seg.push([r.top - bunn, r.top - bunn + r.height / 2]); });
        return seg;
      }, tl.dataset.handling || 'ovelse');
    });
  }
  window.addEventListener('resize', function () { clearTimeout(tegnKravStolper.t); tegnKravStolper.t = setTimeout(tegnKravStolper, 150); });

  // ---------------------------------------------------------------- tidslinje
  // Uke for uke: kalenderuke og dato (når første kalenderuke er satt), modul, undertemaer, samlinger, beskjeder, arbeidskrav
  // med frist, og for underviseren egne notater. Brukes både i fagbyggeren og av studentene.
  function utUrlK(id) { var p = id.split('/'), kt = K[p[1]]; if (!kt || !kt.omrade) return null; var sti = '/tema/' + kt.omrade + '/' + p[1] + '/' + p[2] + '.html'; return FINNES && !FINNES[sti] ? null : '..' + sti; }
  function mandag(aar, uke) { var j4 = new Date(Date.UTC(aar, 0, 4)), d = (j4.getUTCDay() || 7) - 1; return new Date(Date.UTC(aar, 0, 4 - d + (uke - 1) * 7)); }
  function tidslinjeHtml(moduler, r, krav, notater, el) {
    el = el || STD_ELEM; r = r || {};
    var start = +r.startuke || 0, naa = new Date(), aar = naa.getFullYear(); if (start && start < isoUke(naa) - 26) aar++;
    // Uka der arbeidskravet hører hjemme (siste uke med noe det dekker), for flagget når det ikke har frist.
    var sisteUke = {}, n0 = 0; (moduler || []).forEach(function (m) { m.uker.forEach(function (w) { n0++; krav.forEach(function (o) { var ids = kravIder(o); if (w.undertemaer.some(function (id) { return ids.indexOf(id) >= 0; })) sisteUke[o.id] = n0; }); }); });
    var nr = 0, rader = [], brukt = {}, totalt = (moduler || []).reduce(function (a, m) { return a + m.uker.length; }, 0);
    // Beskjeder står i uka de ble gitt (ut fra datoen). Uten dato eller første kalenderuke: først i modulen.
    var besk = []; (moduler || []).forEach(function (m, mi) { alleBeskjeder(m).forEach(function (b) {
      var w = null; if (b.tid && start) { w = isoUke(new Date(b.tid)) - start + 1; if (w < -26) w += 52; w = Math.max(1, Math.min(totalt, w)); }
      besk.push({ m: m, mi: mi, b: b, uke: w }); }); });
    var beskHtml = function (x) { return '<div class="st-tl-beskjed">📣 ' + (x.b.tid ? '<span class="st-sm">' + dato(x.b.tid) + ' · ' + esc(x.m.navn) + ':</span> ' : '') + esc(x.b.tekst) + '</div>'; };
    var iUke = function (o) { if (!o.frist || !start) return false; var w = isoUke(new Date(o.frist)) - start + 1; if (w < 1) w += 52; return w; };
    (moduler || []).forEach(function (m, mi) {
      var farge = MODFARGE[mi % MODFARGE.length];
      m.uker.forEach(function (w, wi) {
        nr++;
        var dato0 = start ? mandag(aar + (start + nr - 2 >= 52 ? 1 : 0), ((start + nr - 2) % 52) + 1) : null;
        var frister = krav.filter(function (o) { return iUke(o) === nr; }); frister.forEach(function (o) { brukt[o.id] = 1; });
        var dekker = krav.filter(function (o) { var ids = kravIder(o); return w.undertemaer.some(function (id) { return ids.indexOf(id) >= 0; }); });
        var flagg = krav.filter(function (o) { return frister.indexOf(o) < 0 && !o.frist && sisteUke[o.id] === nr; });
        rader.push('<li class="st-tl-uke" style="border-color:' + farge + '">' +
          '<div class="st-tl-tid"><b>Uke ' + nr + '</b>' + (start ? '<span class="st-sm">kal.uke ' + (((start + nr - 2) % 52) + 1) + ' · ' + dato0.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', timeZone: 'UTC' }) + '</span>' : '') + '</div>' +
          '<div class="st-tl-inn">' + (wi === 0 ? '<div class="st-tl-modul" style="color:' + farge + '">Modul ' + (mi + 1) + ': ' + esc(m.navn) + '</div>' + besk.filter(function (x) { return x.uke === null && x.mi === mi; }).map(beskHtml).join('') + (notater && notater[m.id] ? '<div class="st-tl-notat">🔒 ' + esc(notater[m.id]) + '</div>' : '') : '') +
          besk.filter(function (x) { return x.uke === nr; }).sort(function (a, b) { return a.b.tid.localeCompare(b.b.tid); }).map(beskHtml).join('') +
          (w.undertemaer.length ? '<div>' + w.undertemaer.map(function (id) { var url = utUrlK(id); return url ? '<a class="st-tl-ut" data-ut="' + esc(id) + '" href="' + url + '">' + esc(utNavnKort(id)) + '</a>' : '<span class="st-tl-ut" data-ut="' + esc(id) + '" title="Lærestoffet kommer">' + esc(utNavnKort(id)) + '</span>'; }).join('') + '</div>' : '<div class="st-sm">' + (w.notat ? '' : 'Ingen undertemaer') + '</div>') +
          (w.notat ? '<div class="st-sm">' + esc(w.notat) + '</div>' : '') + (samlingTekst(r, el) ? '<div class="st-sm">' + samlingTekst(r, el) + '</div>' : '') +
          frister.concat(flagg).map(function (o) { var ok = godkjent(o); return '<button type="button" class="st-tl-flagg' + (ok ? ' ok' : '') + '" data-h="ovelse" data-id="' + o.id + '" data-flagg="' + o.id + '"' + (ok ? '' : ' style="border-color:' + kravFarge(o) + '"') + '><span class="st-tl-flaggikon">' + (ok ? '✓' : '🚩') + '</span><span><b>Arbeidskrav: ' + esc(o.tittel) + '</b><br><span class="st-sm">' + (o.frist ? 'Frist ' + dato(o.frist) : 'Ingen frist') + ' · minst ' + o.krav + ' av ' + o.antall + ' riktige' + (ok ? ' · godkjent' : '') + '</span></span></button>'; }).join('') + '</div></li>');
      });
    });
    var andre = krav.filter(function (o) { return o.frist && !brukt[o.id]; });
    return '<div class="st-tl-lerret" data-krav="' + krav.map(function (o) { return o.id; }).join(',') + '"><div class="st-tl-kravkol" aria-hidden="true"></div><ol class="st-tidslinje">' + rader.join('') + '</ol></div>' + (andre.length ? '<p class="st-sm">Andre frister: ' + andre.map(function (o) { return esc(o.tittel) + ' ' + dato(o.frist); }).join(', ') + '</p>' : '') +
      (!start ? '<p class="st-sm">Sett «Første kalenderuke» under Beskrivelse og ramme for å få datoer og frister inn i tidslinjen.</p>' : '');
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
      finnKurs: finnKurs, meldPa: meldPa, lagKurs: lagKurs,
      kiOppsett: function () { if (d.v === 'ja') T.fag.bekreftKi = true; kiOppsett(); }, byggSelv: byggSelv, publiser: publiserFag, kuttUker: kuttUker,
      avbrytKi: function () { T.fag.bekreftKi = false; tegn(); },
      kiEndre: function () { kiOppsett(true); }, angreKi: angreKi,
      tidslinje: function () { T.fag.tidslinje = !T.fag.tidslinje; tegn(); },
      installer: function () { var a = window.fhApp; if (!a || !a.hendelse) return; a.hendelse.prompt(); a.hendelse.userChoice.then(function (v) { if (v && v.outcome === 'accepted') { a.installert = true; varsle('Appen er installert. Du finner den på hjemskjermen.'); } a.hendelse = null; a.kanInstallere = false; tegn(); }); },
      skjulApp: function () { try { localStorage.setItem('fh-app-skjul', '1'); } catch (e) {} tegn(); },
      sendBeskjed: function () { sendBeskjed(+d.m); }, slettBeskjed: function () { slettBeskjed(+d.m, +d.i); }, lagreNotat: function () { lagreNotater(true); },
      kravStolpe: function () { var o = (T.ovelser || []).find(function (x) { return x.id === d.id; }); T.fag.fane = 'ovinger'; nyttKrav(o); rot.scrollIntoView({ block: 'start' }); },
      tidStudent: function () { T.tid = T.tid || {}; T.tid[d.id] = !T.tid[d.id]; tegn(); },
      sparFjernFil: function () { var sp = kiSpar(); sp.vedlegg = null; sp.filnavn = ''; tegn(); },
      tilStart: function () { T.fag.steg = 'start'; tegn(); },
      nyModul: function () { var m = T.fag.u.moduler; m.push({ id: nyId(), navn: 'Modul ' + (m.length + 1), uker: [{ undertemaer: [], notat: '' }] }); planlagreFag(); tegn(); },
      flyttModul: function () { var l = T.fag.u.moduler, i = +d.m, j = i + (+d.r), x = l[i]; l[i] = l[j]; l[j] = x; planlagreFag(); tegn(); },
      slettModul: function () { var f = T.fag, i = +d.m; if (f.slettMod !== i) { f.slettMod = i; return tegn(); } f.slettMod = null; f.u.moduler.splice(i, 1); planlagreFag(); tegn(); },
      nyUke: function () { T.fag.u.moduler[+d.m].uker.push({ undertemaer: [], notat: '' }); planlagreFag(); tegn(); },
      slettUke: function () { T.fag.u.moduler[+d.m].uker.splice(+d.u, 1); planlagreFag(); tegn(); },
      fjernUT: function () { T.fag.u.moduler[+d.m].uker[+d.u].undertemaer.splice(+d.i, 1); planlagreFag(); tegn(); },
      meldAv: function () { meldAv(d.id); },
      apneKurs: function () { apneKurs(d.id); },
      slettKurs: function () { slettKurs(d.id); },
      visStudent: function () { visStudent(d.id, d.epost); },
      lukkStudent: function () { T.fag.student = null; tegn(); },
      fagFane: function () { T.fag.fane = d.v; T.fag.student = null; tegn(); },
      sorter: function () { T.fag.sorter = d.v; tegn(); },
      brukLoype: function () { var x = T.deltar.find(function (y) { return y.kurs === d.id; }); brukFagetsLoype(x.kursinfo.temaer).then(function () { varsle('Løypa di følger nå faget.'); ga('hjem'); }); },
      ovelse: function () { startOvelse(d.id); },
      excel: lastNedExcel,
      nyttKrav: function () { nyttKrav(); }, redigerKrav: function () { nyttKrav(T.ovelser.find(function (x) { return x.id === d.id; })); },
      avbrytKrav: function () { T.fag.ov = null; tegn(); }, lagreKrav: lagreKrav, kiKviss: kiKviss,
      kkFjernFil: function () { T.fag.kiKviss.vedlegg = null; T.fag.kiKviss.filnavn = ''; tegn(); },
      nyttSp: function () { T.fag.ov.sporsmal.push(tomtSp()); tegn(); },
      nyVar: function () { T.fag.ov.sporsmal[+d.i].variabler.push({ navn: '', min: 1, maks: 10, steg: 1 }); tegn(); },
      slettVar: function () { T.fag.ov.sporsmal[+d.i].variabler.splice(+d.j, 1); tegn(); },
      nyeTall: function () { tegn(); },
      slettSp: function () { var v = T.fag.ov; v.sporsmal.splice(+d.i, 1); if (v.krav > v.sporsmal.length) v.krav = Math.max(1, v.sporsmal.length); tegn(); },
      slettOvelse: function () { slettOvelse(d.id); },
      eksempel: function () { ev.preventDefault(); location.hash = 'eksempel'; location.reload(); },
      avsluttEksempel: function () { ev.preventDefault(); history.replaceState(null, '', location.pathname + (T.eksempelFag ? '#fag-' + T.eksempelFag.id : '')); location.reload(); },
      studentvisning: function () { if (T.fag && T.fag.lagrer) { clearTimeout(T.fag.tid); lagreUtkast(); } location.hash = 'eksempel-' + d.id; location.reload(); },
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
    else if (el.dataset.felt === 'leggUT' && el.value) { var w = T.fag.u.moduler[+el.dataset.m].uker[+el.dataset.u]; if (w.undertemaer.indexOf(el.value) < 0) w.undertemaer.push(el.value); planlagreFag(); tegn(); }
    else if (el.name === 'st-form') { T.fag.u.ramme.form = el.value; planlagreFag(); }
    else if (el.dataset.felt && el.dataset.felt.indexOf('ramme.') === 0 && T.fag) { tegn(); }
    else if (el.dataset.elem) { T.fag.u.elementer[el.dataset.elem] = el.checked; planlagreFag(); tegn(); }
    else if (el.dataset.ovvalg && T.fag && T.fag.ov) { T.fag.ov[el.dataset.ovvalg] = el.value; tegn(); }
    else if ((el.dataset.dekk || el.dataset.dekkmod) && T.fag && T.fag.ov) {
      var v = T.fag.ov, ids = el.dataset.dekk ? [el.dataset.dekk] : [];
      if (el.dataset.dekkmod) T.fag.u.moduler[+el.dataset.dekkmod].uker.forEach(function (w) { w.undertemaer.forEach(function (id) { if (ids.indexOf(id) < 0) ids.push(id); }); });
      ids.forEach(function (id) { var i = v.ut.indexOf(id); if (el.checked && i < 0) v.ut.push(id); if (!el.checked && i >= 0) v.ut.splice(i, 1); });
      var y = scrollY; tegn(); scrollTo(0, y);
    }
    else if (el.name === 'st-ov-kilde' && T.fag && T.fag.ov) { T.fag.ov.kilde = el.value; if (el.value === 'egne' && !T.fag.ov.sporsmal.length) T.fag.ov.krav = 1; tegn(); }
    else if (el.dataset.ovmal && T.fag && T.fag.ov) {
      var sp = T.fag.ov.sporsmal[+el.dataset.ovmal];
      if (el.checked) { sp.variabler = sp.variabler || [{ navn: 'm', min: 1, maks: 5, steg: 0.5 }]; sp.svar = sp.svar || ''; sp.feil.forEach(function (f) { f.uttrykk = f.uttrykk || ''; }); }
      else { sp.variabler = null; }
      tegn();
    }
    else if (el.dataset.ovspv && T.fag && T.fag.ov) { settSti(T.fag.ov.sporsmal, el.dataset.ovspv, el.value); }
    else if (el.dataset.kk && el.tagName === 'SELECT' && T.fag) { T.fag.kiKviss[el.dataset.kk] = el.value; }
    else if (el.classList.contains('st-spar-fil') && el.files[0]) {
      var pf = el.files[0];
      lesVedlegg(pf).then(function (r) { var sp = kiSpar(); sp.vedlegg = r.vedlegg || null; sp.filnavn = r.vedlegg ? pf.name : ''; if (r.tekst) sp.tekst = (sp.tekst ? sp.tekst + '\n\n' : '') + r.tekst; tegn(); if (r.tekst) varsle('Teksten fra filen er lagt inn i feltet.'); })
        .catch(function (e) { varsle(feilmelding(e), true); });
    }
    else if (el.id === 'st-kk-fil' && el.files[0]) {
      var fil = el.files[0];
      lesVedlegg(fil).then(function (r) { var kk = T.fag.kiKviss; kk.vedlegg = r.vedlegg || null; if (r.tekst) kk.grunnlag = (kk.grunnlag ? kk.grunnlag + '\n\n' : '') + r.tekst; kk.filnavn = r.vedlegg ? fil.name : ''; tegn(); if (r.tekst) varsle('Teksten fra filen er lagt inn i feltet.'); })
        .catch(function (e) { varsle(feilmelding(e), true); });
    }
    else if (el.id === 'st-bilde' && el.files[0]) {
      var tekst = (document.getElementById('st-forklaring') || {}).value || '';
      lesBilde(el.files[0]).then(function (url) { T.q.bilde = url; T.q.tekst = tekst; tegn(); }).catch(function (e) { varsle(e.message, true); });
    }
  });
  rot.addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter' && ev.target.id === 'st-kode') finnKurs();
    else if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.classList.contains('st-klikk')) { ev.preventDefault(); ev.target.click(); }
  });
  // Tekstfelt i fagbyggeren: lagres fortløpende uten å tegne siden på nytt (markøren blir stående).
  function settSti(rotObj, sti, verdi) { var p = sti.split('.'), o = rotObj; for (var i = 0; i < p.length - 1; i++) o = o[p[i]]; o[p[p.length - 1]] = verdi; }
  rot.addEventListener('input', function (ev) {
    var el = ev.target;
    // Arbeidskrav-redigereren: lagres i minnet til «Lagre», uten å tegne siden på nytt.
    if (T.fag && T.fag.ov && el.dataset) {
      if (el.dataset.ov) { T.fag.ov[el.dataset.ov] = el.value; return; }
      if (el.dataset.ovsp) { var sti = el.dataset.ovsp, tall = /\.variabler\.\d+\.(min|maks|steg)$/.test(sti); settSti(T.fag.ov.sporsmal, sti, tall ? el.value.replace(',', '.') : el.value);
        var si = +sti.split('.')[0], sp = T.fag.ov.sporsmal[si], boks = document.getElementById('st-eks-' + si);
        if (boks && erMal(sp)) { clearTimeout(boks.t); boks.t = setTimeout(function () { boks.innerHTML = eksHtml(provVariant(sp)); }, 400); }
        return; }
      if (el.dataset.kk === 'grunnlag') { T.fag.kiKviss.grunnlag = el.value; return; }
    }
    if (T.fag && el.dataset && el.dataset.spar) { kiSpar().tekst = el.value; return; }
    if (T.fag && el.dataset && el.dataset.nybeskjed) { T.fag.nyBeskjed = T.fag.nyBeskjed || {}; T.fag.nyBeskjed[el.dataset.nybeskjed] = el.value; return; }
    if (T.fag && el.dataset && el.dataset.notat) { T.fag.notater = T.fag.notater || {}; T.fag.notater[el.dataset.notat] = el.value; lagreNotater(); return; }
    var felt = el.dataset && el.dataset.felt; if (!T.fag || !felt || felt === 'leggUT') return;
    var u = T.fag.u;
    if (felt === 'mod') u.moduler[+el.dataset.m].navn = el.value;
    else if (felt === 'notat') u.moduler[+el.dataset.m].uker[+el.dataset.u].notat = el.value;
    else if (felt.indexOf('ramme.') === 0) { var n = parseInt(el.value, 10); u.ramme[felt.slice(6)] = isNaN(n) ? '' : Math.max(0, Math.min(felt === 'ramme.lengde' ? 600 : felt === 'ramme.startuke' ? 53 : 52, n)); }
    else u[felt] = el.value;
    planlagreFag();
  });

  // Ulagrede endringer i fagbyggeren lagres når siden lukkes.
  window.addEventListener('pagehide', function () { if (T.fag && T.fag.lagrer) { clearTimeout(T.fag.tid); lagreUtkast(); } });

  // Undervisere får en side tilpasset dem: egen overskrift og undertekst, og fagene først. Eksempelmodus viser studentens side.
  function settOverskrift() {
    if (!erUnderviser() || T.eksempel) return;
    var h = document.querySelector('#title-block-header .title, header h1.title'), u = document.querySelector('#title-block-header .subtitle, header .subtitle');
    if (h) h.textContent = 'Fag og undervisning';
    if (u) u.textContent = 'Bygg fag, lag arbeidskrav og følg studentene. Under «Løype» og «Profil» kan du prøve appen slik studentene ser den.';
    document.title = document.title.replace(/^Test deg selv/, 'Fag og undervisning');
  }

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
    S = r[0].struktur; K = r[0].katalog || r[0].struktur; Q = r[0].sporsmal; T.omrader = r[0].omrader || {}; k = r[2];
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
      var ex = /^#eksempel(?:-(.+))?$/.exec(location.hash);
      if (!ex || !erUnderviser()) return;
      var ekte = k;
      return (ex[1] ? Promise.all([ekte.from('kurs').select('*').eq('id', ex[1]).maybeSingle().then(sjekk), ekte.from('ovelser').select('*').eq('kurs', ex[1]).then(sjekk).catch(function () { return []; })])
        : Promise.resolve([null, []])).then(function (r) {
        T.eksempel = true; T.eksempelFag = r[0]; bruker = { id: 'eksempel', email: 'eksempelstudent' }; k = eksempelKlient(ekte, r[0], r[1]);
        if (r[0]) T.vis = 'kurs';
      });
    }).then(function () {
      settOverskrift();
      return hentAlt();
    }).then(function () {
      var ov = /^#ovelse-(.+)$/.exec(location.hash);
      if (ov && (T.ovelser || []).some(function (x) { return x.id === decodeURIComponent(ov[1]); })) return startOvelse(decodeURIComponent(ov[1]));
      var m = /^#fag-(.+)$/.exec(location.hash);
      if (m && !T.eksempel && T.mine.some(function (c) { return c.id === m[1]; })) { T.vis = 'kurs'; apneKurs(m[1]); }
      else if (location.hash === '#fag' || (erUnderviser() && !T.eksempel && !location.hash)) { T.vis = 'kurs'; tegn(); }
      else tegn();
      if (T.ny && !T.eksempel) lagreInn();
    });
  }).catch(function (e) {
    rot.innerHTML = '<p class="st-feil">Fikk ikke startet studieappen: ' + esc(feilmelding(e)) + '</p>';
  });

  // For testene (verktoy/sporsmal/test_studie.js)
  window.__studie = { T: T, mat: mat, tx: tx, skar: skar, get Q() { return Q; } };
}
