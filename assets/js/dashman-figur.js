// Figurer fra Dashman. Dashman skriver ikke TikZ eller SVG selv, men en kort beskrivelse i JSON i en ```figur-blokk
// (formatet står i hint-tjener/dashman-instruks.md). Her blir beskrivelsen tegnet som SVG i krittstil.
// Ingen kode fra modellen kjøres: funksjonsuttrykk leses av en liten parser som bare kan regning og noen få funksjoner.
(function (rot) {
  var FARGE = { kritt: '#eceeea', gronn: '#8fcf86', oransje: '#e39d63', turkis: '#7fc3b4', gul: '#e6d98a', graa: '#a3a9ad', rod: '#e07a6f', bla: '#86a8e0' };
  function farge(n, std) { return FARGE[n] || (/^#[0-9a-f]{3,6}$/i.test(n || '') ? n : (FARGE[std] || FARGE.kritt)); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function tall(x, std) { x = Number(x); return isFinite(x) ? x : std; }
  function par(p, std) { return Array.isArray(p) && p.length === 2 ? [tall(p[0], std ? std[0] : 0), tall(p[1], std ? std[1] : 0)] : (std || [0, 0]); }

  // ---------------------------------------------------------------- uttrykk: + - * / ^, parenteser, funksjoner
  var FUNK = { sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan, exp: Math.exp,
    ln: Math.log, log: Math.log10, lg: Math.log10, sqrt: Math.sqrt, abs: Math.abs, sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh };
  var KONST = { pi: Math.PI, e: Math.E };
  function uttrykk(kilde, variabel) {
    var s = String(kilde).replace(/\*\*/g, '^').replace(/·|×/g, '*').replace(/−/g, '-').replace(/π/g, 'pi'), i = 0;
    var t = [], m;
    var re = /\s*(?:(\d+(?:[.,]\d+)?(?:e[-+]?\d+)?)|([a-zA-Z_][a-zA-Z_0-9]*)|(.))/g;
    while ((m = re.exec(s)) && m[0] !== '') {
      if (m[1]) t.push({ n: parseFloat(m[1].replace(',', '.')) });
      else if (m[2]) t.push({ id: m[2] });
      else if (m[3] && m[3].trim()) t.push({ op: m[3] });
      if (re.lastIndex >= s.length) break;
    }
    // Underforstått gange: 2t, 2(…), )( , t sin(t)
    var u = [];
    t.forEach(function (x, k) {
      var f = u[u.length - 1];
      if (f && (f.n != null || (f.id && !FUNK[f.id]) || f.op === ')') && (x.n != null || x.id || x.op === '(')) u.push({ op: '*' });
      u.push(x);
    });
    t = u;
    function se() { return t[i]; }
    function ta(op) { if (t[i] && t[i].op === op) { i++; return true; } return false; }
    function sum() { var a = prod(); for (;;) { if (ta('+')) { var b = prod(); a = (function (a, b) { return function (v) { return a(v) + b(v); }; })(a, b); } else if (ta('-')) { var c = prod(); a = (function (a, b) { return function (v) { return a(v) - b(v); }; })(a, c); } else return a; } }
    function prod() { var a = fortegn(); for (;;) { if (ta('*')) { var b = fortegn(); a = (function (a, b) { return function (v) { return a(v) * b(v); }; })(a, b); } else if (ta('/')) { var c = fortegn(); a = (function (a, b) { return function (v) { return a(v) / b(v); }; })(a, c); } else return a; } }
    function fortegn() { if (ta('-')) { var a = fortegn(); return function (v) { return -a(v); }; } ta('+'); return potens(); }
    function potens() { var a = atom(); if (ta('^')) { var b = fortegn(); return function (v) { return Math.pow(a(v), b(v)); }; } return a; }
    function atom() {
      var x = se(); if (!x) throw new Error('uttrykket slutter for tidlig');
      i++;
      if (x.n != null) return function () { return x.n; };
      if (x.op === '(') { var a = sum(); if (!ta(')')) throw new Error('mangler )'); return a; }
      if (x.id) {
        if (FUNK[x.id]) { var f = FUNK[x.id], arg = potensArg(); return function (v) { return f(arg(v)); }; }
        if (x.id === variabel) return function (v) { return v; };
        if (KONST[x.id] != null) return function () { return KONST[x.id]; };
        throw new Error('ukjent navn ' + x.id);
      }
      throw new Error('uventet ' + x.op);
    }
    function potensArg() { if (se() && se().op === '(') return atom(); return potens(); }
    var f = sum(); if (i < t.length) throw new Error('kunne ikke lese hele uttrykket');
    return f;
  }

  // ---------------------------------------------------------------- akser og skala
  function pentSteg(spenn) {
    var r = spenn / 6, p = Math.pow(10, Math.floor(Math.log10(r))), n = r / p;
    return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p;
  }
  function fmt(x) { var s = (Math.round(x * 1e6) / 1e6).toString(); return s.replace('-', '−'); }

  // Navn med enkel senket/hevet skrift: F_N, v_0, x^2, θ. Pil over med «vec:»-prefiks: vec:F.
  function navnSvg(navn, x, y, f, anker, str) {
    if (navn == null || navn === '') return '';
    var s = String(navn), pil = false;
    if (/^vec:/.test(s)) { pil = true; s = s.slice(4); }
    var deler = [], re = /([_^])(\{[^}]*\}|[^\s_^]+)|([^_^]+)/g, m;
    while ((m = re.exec(s))) deler.push(m[3] != null ? { t: m[3] } : { t: m[2].replace(/^\{|\}$/g, ''), side: m[1] });
    var inn = deler.map(function (d) {
      if (!d.side) return '<tspan>' + esc(d.t) + '</tspan>';
      var dy = d.side === '_' ? 0.32 : -0.45;
      return '<tspan dy="' + dy + 'em" font-size="70%">' + esc(d.t) + '</tspan><tspan dy="' + (-dy) + 'em">​</tspan>';
    }).join('');
    var sz = str || 15, ut = '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" fill="' + f + '" font-size="' + sz + '" text-anchor="' + (anker || 'middle') + '" dominant-baseline="middle">' + inn + '</text>';
    if (pil) {
      var b = Math.max(sz * 0.75, deler[0] ? deler[0].t.length * sz * 0.6 : 0), x0 = anker === 'start' ? x : anker === 'end' ? x - b : x - b / 2, yy = y - sz * 0.72;
      ut += '<path d="M' + x0.toFixed(1) + ' ' + yy.toFixed(1) + 'h' + b.toFixed(1) + 'm-3 -2.2l3 2.2l-3 2.2" stroke="' + f + '" stroke-width="1.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
    }
    return ut;
  }

  function lag(spek) {
    if (typeof spek === 'string') spek = JSON.parse(spek);
    if (!spek || typeof spek !== 'object') throw new Error('tom figur');
    var el = Array.isArray(spek.elementer) ? spek.elementer.slice(0, 60) : [];
    var xr = par(spek.x, [-1, 6]), yr = par(spek.y, [-1, 4]);
    if (!(xr[1] > xr[0])) xr = [xr[0] - 1, xr[0] + 1];
    if (!(yr[1] > yr[0])) yr = [yr[0] - 1, yr[0] + 1];
    var lik = spek.lik_skala !== false && !spek.akser;   // tegninger (krefter, skråplan) får lik skala, grafer ikke
    var W = 340, M = { v: spek.akser ? 40 : 18, h: 18, o: 18, n: spek.akser ? 30 : 18 };
    var bx = W - M.v - M.h, H;
    if (lik) H = Math.round(bx * (yr[1] - yr[0]) / (xr[1] - xr[0])) + M.o + M.n;
    else H = Math.round(W * tall(spek.forhold, 0.68));
    H = Math.max(140, Math.min(H, 420));
    var by = H - M.o - M.n;
    if (lik) { // behold lik skala innenfor rammen
      var sk = Math.min(bx / (xr[1] - xr[0]), by / (yr[1] - yr[0]));
      var X = function (x) { return M.v + (bx - sk * (xr[1] - xr[0])) / 2 + (x - xr[0]) * sk; };
      var Y = function (y) { return M.o + (by + sk * (yr[1] - yr[0])) / 2 - (y - yr[0]) * sk; };
      var SX = sk, SY = sk;
    } else {
      X = function (x) { return M.v + (x - xr[0]) / (xr[1] - xr[0]) * bx; };
      Y = function (y) { return M.o + by - (y - yr[0]) / (yr[1] - yr[0]) * by; };
      SX = bx / (xr[1] - xr[0]); SY = by / (yr[1] - yr[0]);
    }
    var bak = [], fram = [], tekst = [], id = 'dmf' + Math.random().toString(36).slice(2, 8);
    function pt(p) { return X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1); }
    function strek(e, std, fyll) { return ' stroke="' + farge(e.farge, std) + '" stroke-width="' + tall(e.tykkelse, 2.2) + '" fill="' + (fyll || 'none') + '" stroke-linecap="round" stroke-linejoin="round"' + (e.stiplet ? ' stroke-dasharray="6 5"' : ''); }
    function pil(x0, y0, x1, y1, f, tykk) {
      var dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, h = Math.min(11, L * 0.4);
      return '<path d="M' + x0.toFixed(1) + ' ' + y0.toFixed(1) + 'L' + x1.toFixed(1) + ' ' + y1.toFixed(1) + '" stroke="' + f + '" stroke-width="' + (tykk || 2.4) + '" stroke-linecap="round" fill="none"/>' +
        '<path d="M' + (x1 - h * ux + h * 0.45 * uy).toFixed(1) + ' ' + (y1 - h * uy - h * 0.45 * ux).toFixed(1) + 'L' + x1.toFixed(1) + ' ' + y1.toFixed(1) + 'L' + (x1 - h * ux - h * 0.45 * uy).toFixed(1) + ' ' + (y1 - h * uy + h * 0.45 * ux).toFixed(1) + '" stroke="' + f + '" stroke-width="' + (tykk || 2.4) + '" stroke-linecap="round" stroke-linejoin="round" fill="none"/>';
    }
    function fn(e) { return uttrykk(e.f, e.var || 'x'); }

    // Akser
    if (spek.akser) {
      var a = spek.akser === true ? {} : spek.akser, k = FARGE.graa;
      var x0 = X(Math.max(xr[0], Math.min(0, xr[1]))), y0 = Y(Math.max(yr[0], Math.min(0, yr[1])));
      if (a.rutenett) {
        var sg = pentSteg(xr[1] - xr[0]), sy = pentSteg(yr[1] - yr[0]);
        for (var gx = Math.ceil(xr[0] / sg) * sg; gx <= xr[1] + 1e-9; gx += sg) bak.push('<path d="M' + X(gx).toFixed(1) + ' ' + Y(yr[0]).toFixed(1) + 'V' + Y(yr[1]).toFixed(1) + '" stroke="#3f4448" stroke-width="1"/>');
        for (var gy = Math.ceil(yr[0] / sy) * sy; gy <= yr[1] + 1e-9; gy += sy) bak.push('<path d="M' + X(xr[0]).toFixed(1) + ' ' + Y(gy).toFixed(1) + 'H' + X(xr[1]).toFixed(1) + '" stroke="#3f4448" stroke-width="1"/>');
      }
      bak.push(pil(X(xr[0]), y0, X(xr[1]) + 6, y0, k, 1.6), pil(x0, Y(yr[0]), x0, Y(yr[1]) - 6, k, 1.6));
      if (a.tall !== false) {
        var st = tall(a.steg_x, pentSteg(xr[1] - xr[0])), sty = tall(a.steg_y, pentSteg(yr[1] - yr[0]));
        for (var tx = Math.ceil(xr[0] / st) * st; tx <= xr[1] - st * 0.3; tx += st) if (Math.abs(tx) > 1e-9) {
          tekst.push('<path d="M' + X(tx).toFixed(1) + ' ' + (y0 - 3) + 'v6" stroke="' + k + '" stroke-width="1.3"/>', '<text x="' + X(tx).toFixed(1) + '" y="' + (y0 + 14) + '" fill="' + k + '" font-size="11" text-anchor="middle">' + fmt(tx) + '</text>');
        }
        for (var ty = Math.ceil(yr[0] / sty) * sty; ty <= yr[1] - sty * 0.3; ty += sty) if (Math.abs(ty) > 1e-9) {
          tekst.push('<path d="M' + (x0 - 3) + ' ' + Y(ty).toFixed(1) + 'h6" stroke="' + k + '" stroke-width="1.3"/>', '<text x="' + (x0 - 6) + '" y="' + Y(ty).toFixed(1) + '" fill="' + k + '" font-size="11" text-anchor="end" dominant-baseline="middle">' + fmt(ty) + '</text>');
        }
      }
      if (a.x) tekst.push(navnSvg(a.x, X(xr[1]) + 4, y0 + (a.tall === false ? 14 : 26), FARGE.kritt, 'end', 13));
      if (a.y) tekst.push(navnSvg(a.y, x0 + 8, Y(yr[1]) - 2, FARGE.kritt, 'start', 13));
    }

    el.forEach(function (e) {
      if (!e || typeof e !== 'object') return;
      var f = farge(e.farge, 'kritt');
      try {
        switch (e.type) {
          case 'graf': case 'areal': {
            var g = fn(e), a0 = tall(e.fra, xr[0]), a1 = tall(e.til, xr[1]), N = 240, biter = [], bit = [];
            for (var n = 0; n <= N; n++) {
              var x = a0 + (a1 - a0) * n / N, y = g(x);
              if (!isFinite(y) || y > yr[1] + (yr[1] - yr[0]) * 3 || y < yr[0] - (yr[1] - yr[0]) * 3) { if (bit.length) biter.push(bit); bit = []; continue; }
              bit.push([x, y]);
            }
            if (bit.length) biter.push(bit);
            if (e.type === 'areal') {
              var y00 = tall(e.grunn, 0);
              biter.forEach(function (b) { bak.push('<path d="M' + pt([b[0][0], y00]) + b.map(function (p) { return 'L' + pt(p); }).join('') + 'L' + pt([b[b.length - 1][0], y00]) + 'Z" fill="' + farge(e.farge, 'gronn') + '" fill-opacity="' + tall(e.dekning, 0.28) + '" stroke="none"/>'); });
            } else {
              biter.forEach(function (b) { fram.push('<path d="M' + b.map(pt).join('L') + '"' + strek(e, 'gronn') + '/>'); });
            }
            if (e.navn && biter.length) { var s = biter[biter.length - 1], p = s[Math.max(0, s.length - 12)]; tekst.push(navnSvg(e.navn, X(p[0]), Y(p[1]) - 13, farge(e.farge, e.type === 'graf' ? 'gronn' : 'kritt'), 'middle')); }
            break;
          }
          case 'vektor': {
            var p0 = par(e.fra), p1 = e.til ? par(e.til) : [p0[0] + tall((e.komp || [])[0], 0), p0[1] + tall((e.komp || [])[1], 0)];
            fram.push(pil(X(p0[0]), Y(p0[1]), X(p1[0]), Y(p1[1]), farge(e.farge, 'oransje')));
            if (e.navn) {
              var dx = X(p1[0]) - X(p0[0]), dy = Y(p1[1]) - Y(p0[1]), L = Math.hypot(dx, dy) || 1;
              var side = e.side === 'venstre' ? -1 : 1, ox = -dy / L * 13 * side + dx / L * 8, oy = dx / L * 13 * side + dy / L * 8;
              tekst.push(navnSvg(e.navn, X(p1[0]) + ox, Y(p1[1]) + oy, farge(e.farge, 'oransje')));
            }
            break;
          }
          case 'linje': case 'kurve': {
            var ps = Array.isArray(e.punkter) ? e.punkter.map(function (q) { return par(q); }) : [par(e.fra), par(e.til)];
            fram.push('<path d="M' + ps.map(pt).join('L') + (e.lukket ? 'Z' : '') + '"' + strek(e, 'kritt', e.fyll ? farge(e.fyll) + '" fill-opacity=".25' : '') + '/>');
            if (e.navn) { var mp = ps[Math.floor((ps.length - 1) / 2)], np = ps[Math.floor((ps.length - 1) / 2) + 1] || mp; tekst.push(navnSvg(e.navn, (X(mp[0]) + X(np[0])) / 2, (Y(mp[1]) + Y(np[1])) / 2 - 12, f)); }
            break;
          }
          case 'punkt': {
            var q = par(e.pos);
            fram.push('<circle cx="' + X(q[0]).toFixed(1) + '" cy="' + Y(q[1]).toFixed(1) + '" r="3.6" fill="' + f + '"/>');
            if (e.navn) tekst.push(navnSvg(e.navn, X(q[0]) + 8, Y(q[1]) - 11, f, 'start'));
            break;
          }
          case 'sirkel': {
            var c = par(e.sentrum), r = tall(e.r, 1);
            fram.push('<ellipse cx="' + X(c[0]).toFixed(1) + '" cy="' + Y(c[1]).toFixed(1) + '" rx="' + (r * SX).toFixed(1) + '" ry="' + (r * SY).toFixed(1) + '"' + strek(e, 'kritt', e.fyll ? farge(e.fyll) + '" fill-opacity=".25' : '') + '/>');
            if (e.navn) tekst.push(navnSvg(e.navn, X(c[0]), Y(c[1]), f));
            break;
          }
          case 'kloss': {
            // pos = midt på undersiden; vinkel = helning (grader) når klossen ligger på et skråplan
            var pk = par(e.pos), b = tall(e.b, 1), h = tall(e.h, 0.7), v = tall(e.vinkel, 0) * Math.PI / 180, co = Math.cos(v), si = Math.sin(v);
            var hj = [[-b / 2, 0], [b / 2, 0], [b / 2, h], [-b / 2, h]].map(function (u) { return [pk[0] + u[0] * co - u[1] * si, pk[1] + u[0] * si + u[1] * co]; });
            fram.push('<path d="M' + hj.map(pt).join('L') + 'Z"' + strek(e, 'kritt', '#2c3033') + '/>');
            if (e.navn) { var mx = (hj[0][0] + hj[2][0]) / 2, my = (hj[0][1] + hj[2][1]) / 2; tekst.push(navnSvg(e.navn, X(mx), Y(my), f)); }
            break;
          }
          case 'skraplan': {
            var s0 = par(e.fra), Lp = tall(e.lengde, 4), vv = tall(e.vinkel, 30) * Math.PI / 180, ned = e.retning === 'venstre';
            var topp = [s0[0] + (ned ? -1 : 1) * Lp * Math.cos(vv), s0[1] + Lp * Math.sin(vv)], fot = [topp[0], s0[1]];
            fram.push('<path d="M' + pt(s0) + 'L' + pt(topp) + 'L' + pt(fot) + 'Z"' + strek(e, 'kritt') + '/>');
            if (e.vis_vinkel !== false) {
              var rr = Math.min(28, Lp * SX * 0.25), sx0 = X(s0[0]), sy0 = Y(s0[1]), d = ned ? -1 : 1;
              fram.push('<path d="M' + (sx0 + d * rr).toFixed(1) + ' ' + sy0.toFixed(1) + 'A' + rr + ' ' + rr + ' 0 0 ' + (ned ? 1 : 0) + ' ' + (sx0 + d * rr * Math.cos(vv)).toFixed(1) + ' ' + (sy0 - rr * Math.sin(vv)).toFixed(1) + '" stroke="' + FARGE.gul + '" stroke-width="1.6" fill="none"/>');
              tekst.push(navnSvg(e.navn || 'θ', sx0 + d * (rr + 11) * Math.cos(vv / 2), sy0 - (rr + 11) * Math.sin(vv / 2), FARGE.gul, 'middle', 14));
            }
            break;
          }
          case 'vinkel': {
            var cv = par(e.sentrum), r2 = tall(e.r, 26), f0 = tall(e.fra, 0) * Math.PI / 180, f1 = tall(e.til, 30) * Math.PI / 180, cx = X(cv[0]), cy = Y(cv[1]);
            var stor = Math.abs(f1 - f0) > Math.PI ? 1 : 0, sw = f1 > f0 ? 0 : 1;
            fram.push('<path d="M' + (cx + r2 * Math.cos(f0)).toFixed(1) + ' ' + (cy - r2 * Math.sin(f0)).toFixed(1) + 'A' + r2 + ' ' + r2 + ' 0 ' + stor + ' ' + sw + ' ' + (cx + r2 * Math.cos(f1)).toFixed(1) + ' ' + (cy - r2 * Math.sin(f1)).toFixed(1) + '" stroke="' + farge(e.farge, 'gul') + '" stroke-width="1.6" fill="none"/>');
            if (e.navn) { var fm = (f0 + f1) / 2; tekst.push(navnSvg(e.navn, cx + (r2 + 12) * Math.cos(fm), cy - (r2 + 12) * Math.sin(fm), farge(e.farge, 'gul'), 'middle', 14)); }
            break;
          }
          case 'tekst': {
            var tp = par(e.pos);
            tekst.push(navnSvg(e.tekst, X(tp[0]), Y(tp[1]), f, e.anker === 'venstre' ? 'start' : e.anker === 'hoyre' ? 'end' : 'middle', tall(e.storrelse, 15)));
            break;
          }
          case 'bakke': {
            var g0 = tall(e.fra, xr[0]), g1 = tall(e.til, xr[1]), gyv = tall(e.y, 0), str = '';
            for (var hx = g0; hx < g1; hx += 0.35 / (SX / 40)) str += 'M' + X(hx).toFixed(1) + ' ' + (Y(gyv) + 8).toFixed(1) + 'l7 -8';
            fram.push('<path d="M' + pt([g0, gyv]) + 'L' + pt([g1, gyv]) + '"' + strek(e, 'kritt') + '/><path d="' + str + '" stroke="' + FARGE.graa + '" stroke-width="1"/>');
            break;
          }
        }
      } catch (err) {
        tekst.push('<text x="' + (W / 2) + '" y="' + (H - 8) + '" fill="' + FARGE.oransje + '" font-size="11" text-anchor="middle">Klarte ikke å tegne én del: ' + esc(err.message) + '</text>');
      }
    });

    var tittel = spek.tittel ? esc(spek.tittel) : 'Figur fra Dashman';
    return '<svg class="dm-figur" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + tittel + '" font-family="\'Architects Daughter\', \'Comic Neue\', cursive" xmlns="http://www.w3.org/2000/svg">' +
      '<title>' + tittel + '</title>' +
      '<g id="' + id + '">' + bak.join('') + fram.join('') + tekst.join('') + '</g></svg>' +
      (spek.tekst ? '<p class="dm-figurtekst">' + esc(spek.tekst) + '</p>' : '');
  }

  var api = { lag: lag, uttrykk: uttrykk };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  rot.DashmanFigur = api;
})(typeof window !== 'undefined' ? window : this);
