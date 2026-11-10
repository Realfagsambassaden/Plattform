// Siden «Min side»: logg inn, registrer deg, glemt passord, profil.
(function vent(n) {
  if (!window.fhKonto && (n || 0) < 100) return setTimeout(function () { vent((n || 0) + 1); }, 50);   // konto.js lastes etter denne
  start();
})();

function start() {
  var rot = document.getElementById('konto');
  var neste = new URLSearchParams(location.search).get('neste');   // f.eks. «dekning»: send brukeren dit etter innlogging
  var gjenoppretter = /type=recovery/.test(location.hash);

  function vis(mal) {
    rot.innerHTML = '';
    rot.appendChild(document.getElementById(mal).content.cloneNode(true));
  }
  function melding(tekst, feil) {
    var m = rot.querySelector('.konto-melding');
    if (m) { m.textContent = tekst; m.classList.toggle('feil', !!feil); }
  }
  function norsk(e) {
    var t = (e && e.message) || '';
    if (/Invalid login credentials/i.test(t)) return 'Feil e-post eller passord.';
    if (/Email not confirmed/i.test(t)) return 'Du må bekrefte e-postadressen først. Sjekk innboksen din (og søppelpost).';
    if (/already registered|already exists/i.test(t)) return 'Det finnes allerede en bruker med denne e-postadressen. Prøv å logge inn.';
    if (/Password should be|weak/i.test(t)) return 'Passordet er for svakt. Bruk minst 8 tegn.';
    if (/rate limit|too many/i.test(t)) return 'For mange forsøk. Vent litt og prøv igjen.';
    if (/Underviserkoden/.test(t)) return t;
    return 'Noe gikk galt: ' + t;
  }

  if (!window.fhKonto || !window.fhKonto.sattOpp) {
    rot.innerHTML = '<p class="konto-laster">Innlogging er ikke satt opp ennå. Kom tilbake snart!</p>';
    return;
  }

  window.fhKonto().then(function (k) {
    function tegn(sesjon) {
      if (gjenoppretter && sesjon) return tegnNyttPassord(k);
      if (sesjon) {
        var mal = { dekning: '../dekning.html', larer: '../larer/index.html', studie: '../studie/index.html' }[neste];
        if (mal) { location.href = mal; return; }
        vis('mal-inne');
        rot.querySelector('.profil-navn').textContent = sesjon.user.email;
        fyllMinSide(k, sesjon);
        rot.querySelector('[data-handling="ut"]').onclick = function () { k.auth.signOut().then(function () { tegn(null); }); };
      } else tegnUte(k);
    }
    k.auth.getSession().then(function (r) { tegn(r.data.session); });
    k.auth.onAuthStateChange(function (hendelse, sesjon) {
      if (hendelse === 'PASSWORD_RECOVERY') { gjenoppretter = true; tegnNyttPassord(k); }
      else if (hendelse === 'SIGNED_IN' && !gjenoppretter) tegn(sesjon);
    });
  }).catch(function () {
    rot.innerHTML = '<p class="konto-laster">Fikk ikke lastet innloggingen. Sjekk nettforbindelsen og last siden på nytt.</p>';
  });

  function tegnUte(k) {
    vis('mal-ute');
    var fane = neste ? 'ny' : 'inn';
    var skjema = rot.querySelector('form');
    function velg(f) {
      fane = f;
      rot.querySelectorAll('[role="tab"]').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.fane === f)); });
      rot.querySelectorAll('[data-for]').forEach(function (el) { el.hidden = el.dataset.for !== f; });
      skjema.querySelector('button[type="submit"]').textContent = f === 'ny' ? 'Registrer deg' : 'Logg inn';
      skjema.passord.autocomplete = f === 'ny' ? 'new-password' : 'current-password';
      melding('');
    }
    rot.querySelectorAll('[role="tab"]').forEach(function (b) { b.onclick = function () { velg(b.dataset.fane); }; });
    velg(fane);

    rot.querySelector('[data-handling="glemt"]').onclick = function (ev) {
      ev.preventDefault();
      var e = skjema.epost.value.trim();
      if (!e) { melding('Skriv inn e-postadressen din først, og trykk på lenken igjen.', true); return; }
      k.auth.resetPasswordForEmail(e, { redirectTo: location.origin + location.pathname }).then(function (r) {
        if (r.error) melding(norsk(r.error), true);
        else melding('Vi har sendt deg en e-post med lenke for å velge nytt passord.');
      });
    };

    // Rollevalg ved registrering: student er standard. Underviser krever en personlig kode fra administratoren.
    function visKode() { var u = skjema.querySelector('input[name="rolle"]:checked').value === 'underviser'; skjema.querySelectorAll('.konto-kode').forEach(function (el) { el.hidden = !u; }); skjema.kode.required = u; }
    skjema.querySelectorAll('input[name="rolle"]').forEach(function (r) { r.onchange = visKode; });
    visKode();

    skjema.onsubmit = function (ev) {
      ev.preventDefault();
      var knapp = skjema.querySelector('button[type="submit"]'); knapp.disabled = true;
      var data = { email: skjema.epost.value.trim(), password: skjema.passord.value };
      var underviser = fane === 'ny' && skjema.querySelector('input[name="rolle"]:checked').value === 'underviser';
      var kode = underviser ? skjema.kode.value.trim().toUpperCase() : '';
      var sjekk = underviser ? k.rpc('sjekk_underviserkode', { k: kode }).then(function (r) {
        if (r.error) throw r.error;
        if (!r.data) throw new Error('Underviserkoden er ugyldig eller allerede brukt. Sjekk koden, eller registrer deg som student.');
      }) : Promise.resolve();
      var p = sjekk.then(function () {
        return fane === 'ny'
          ? k.auth.signUp(Object.assign(data, { options: { data: kode ? { underviserkode: kode } : {}, emailRedirectTo: location.origin + location.pathname + (neste ? '?neste=' + neste : '') } }))
          : k.auth.signInWithPassword(data);
      }).catch(function (e) { return { error: e }; });
      p.then(function (r) {
        knapp.disabled = false;
        if (r.error) { melding(norsk(r.error), true); return; }
        if (fane === 'ny' && !r.data.session) melding('Nesten ferdig! Vi har sendt deg en e-post. Klikk på lenken i den for å bekrefte kontoen.' + (underviser ? ' Kontoen blir en underviserkonto.' : ''));
      });
    };
  }

  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var dato = function (d) { return d ? new Date(d).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' }) : ''; };

  // Min side er todelt: studentdel for alle, underviserdel for godkjente undervisere, og administrasjon for administratoren.
  function fyllMinSide(k, sesjon) {
    k.rpc('min_rolle').then(function (r) {
      var rolle = (r && r.data) || 'student', underviser = rolle === 'underviser' || rolle === 'admin';
      rot.querySelector('.profil-rolle').textContent = { student: 'Student', underviser: 'Underviser', admin: 'Administrator' }[rolle];
      rot.querySelector('.profil-underviser').hidden = !underviser;
      rot.querySelector('.profil-blivunderviser').hidden = underviser;
      rot.querySelector('.profil-admin').hidden = rolle !== 'admin';
      if (underviser) k.from('kurs').select('id,navn,kode').eq('eier', sesjon.user.id).order('opprettet').then(function (r2) {
        var l = (r2 && r2.data) || [], el = rot.querySelector('.profil-fagliste');
        el.innerHTML = l.length ? '<p><b>Fagene dine</b></p><ul>' + l.map(function (c) { return '<li><a href="../studie/index.html#fag-' + c.id + '">' + esc(c.navn) + '</a></li>'; }).join('') + '</ul>'
          : '<p class="konto-ingress">Du har ingen fag ennå.</p>';
      });
      if (rolle === 'admin') admin(k);
    });
    var blivForm = rot.querySelector('.profil-blivunderviser form');
    blivForm.onsubmit = function (ev) {
      ev.preventDefault();
      var m = rot.querySelector('.profil-blivunderviser .konto-melding');
      k.rpc('bli_underviser', { k: blivForm.kode.value.trim().toUpperCase() }).then(function (r) {
        if (r.error) { m.textContent = norsk(r.error); m.classList.add('feil'); return; }
        if (!r.data) { m.textContent = 'Koden er ugyldig eller allerede brukt.'; m.classList.add('feil'); return; }
        m.textContent = 'Du er nå underviser.'; m.classList.remove('feil'); fyllMinSide(k, sesjon);
      });
    };
  }

  function admin(k) {
    var boks = rot.querySelector('.profil-admin'), m = boks.querySelector('.admin-melding');
    function tegnAdmin() {
      Promise.all([k.from('underviserkoder').select('*').order('opprettet', { ascending: false }), k.rpc('admin_undervisere')]).then(function (r) {
        var koder = r[0].data || [], und = r[1].data || [], epost = {};
        und.forEach(function (u) { epost[u.id] = u.epost; });
        boks.querySelector('.admin-koder').innerHTML = koder.length ? '<table class="admin-tabell"><thead><tr><th>Til</th><th>Kode</th><th>Status</th><th></th></tr></thead><tbody>' + koder.map(function (c) {
          return '<tr><td>' + esc(c.navn) + '</td><td class="kode">' + esc(c.kode) + '</td><td>' + (c.brukt_av ? 'Brukt av ' + esc(epost[c.brukt_av] || 'ukjent') + ' ' + dato(c.brukt) : 'Ledig') + '</td>' +
            '<td>' + (c.brukt_av ? '' : '<button type="button" data-slett-kode="' + esc(c.kode) + '">Slett</button>') + '</td></tr>';
        }).join('') + '</tbody></table>' : '<p class="konto-ingress">Ingen koder ennå.</p>';
        boks.querySelector('.admin-undervisere').innerHTML = und.length ? '<table class="admin-tabell"><thead><tr><th>E-post</th><th>Rolle</th><th>Kode laget til</th><th>Siden</th><th></th></tr></thead><tbody>' + und.map(function (u) {
          return '<tr><td>' + esc(u.epost) + '</td><td>' + (u.rolle === 'admin' ? 'Administrator' : 'Underviser') + '</td><td>' + esc(u.kode_til || '') + '</td><td>' + dato(u.siden) + '</td>' +
            '<td>' + (u.rolle === 'underviser' ? '<button type="button" data-fjern="' + u.id + '">Fjern tilgang</button>' : '') + '</td></tr>';
        }).join('') + '</tbody></table>' : '<p class="konto-ingress">Ingen undervisere ennå.</p>';
      });
    }
    var form = boks.querySelector('.admin-ny');
    form.onsubmit = function (ev) {
      ev.preventDefault();
      var a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', kode = '', tall = new Uint32Array(10);
      crypto.getRandomValues(tall); for (var i = 0; i < 10; i++) kode += a[tall[i] % a.length];
      k.from('underviserkoder').insert({ kode: kode, navn: form.navn.value.trim() }).then(function (r) {
        if (r.error) { m.textContent = norsk(r.error); m.classList.add('feil'); return; }
        m.classList.remove('feil'); m.textContent = 'Ny kode til ' + form.navn.value.trim() + ': ' + kode + '. Send den til personen.'; form.reset(); tegnAdmin();
      });
    };
    boks.onclick = function (ev) {
      var b = ev.target.closest('button'); if (!b) return;
      if (b.dataset.slettKode) k.from('underviserkoder').delete().eq('kode', b.dataset.slettKode).then(tegnAdmin);
      if (b.dataset.fjern) {
        if (b.dataset.bekreft !== '1') { b.dataset.bekreft = '1'; b.textContent = 'Bekreft'; return; }
        k.rpc('sett_student', { b: b.dataset.fjern }).then(tegnAdmin);
      }
    };
    tegnAdmin();
  }

  function tegnNyttPassord(k) {
    vis('mal-nytt-passord');
    var skjema = rot.querySelector('form');
    skjema.onsubmit = function (ev) {
      ev.preventDefault();
      k.auth.updateUser({ password: skjema.passord.value }).then(function (r) {
        if (r.error) { melding(norsk(r.error), true); return; }
        gjenoppretter = false;
        history.replaceState(null, '', location.pathname);
        k.auth.getSession().then(function (s) { melding('Passordet er lagret.'); setTimeout(function () { location.reload(); }, 800); });
      });
    };
  }
}
