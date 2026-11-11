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
    if (/Invalid login credentials/i.test(t)) return 'Feil e-post/brukernavn eller passord.';
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
        visNavn(k, sesjon);
        visBrukernavn(k, sesjon);
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
      // Innlogging: e-post eller brukernavn. Registrering: e-post.
      skjema.epost.type = f === 'ny' ? 'email' : 'text';
      skjema.epost.autocomplete = f === 'ny' ? 'email' : 'username';
      var et = rot.querySelector('.epost-tekst'); if (et) et.textContent = f === 'ny' ? 'E-post' : 'E-post eller brukernavn';
      melding('');
    }
    rot.querySelectorAll('[role="tab"]').forEach(function (b) { b.onclick = function () { velg(b.dataset.fane); }; });
    velg(fane);

    rot.querySelector('[data-handling="glemt"]').onclick = function (ev) {
      ev.preventDefault();
      var e = skjema.epost.value.trim();
      if (!e || e.indexOf('@') < 0) { melding('Skriv inn e-postadressen din (ikke brukernavnet) først, og trykk på lenken igjen.', true); return; }
      k.auth.resetPasswordForEmail(e, { redirectTo: location.origin + location.pathname }).then(function (r) {
        if (r.error) melding(norsk(r.error), true);
        else melding('Vi har sendt deg en e-post med lenke for å velge nytt passord.');
      });
    };

    // Rollevalg ved registrering: student er standard. Underviser krever en personlig kode fra administratoren.
    // (matematikkhjelp.no har ikke rollevalg; der er alle studenter.)
    function rolleValgt() { var r = skjema.querySelector('input[name="rolle"]:checked'); return r ? r.value : 'student'; }
    function visKode() { if (!skjema.kode) return; var u = rolleValgt() === 'underviser'; skjema.querySelectorAll('.konto-kode').forEach(function (el) { el.hidden = !u; }); skjema.kode.required = false; }
    skjema.querySelectorAll('input[name="rolle"]').forEach(function (r) { r.onchange = visKode; });
    visKode();

    skjema.onsubmit = function (ev) {
      ev.preventDefault();
      var knapp = skjema.querySelector('button[type="submit"]'); knapp.disabled = true;
      var data = { email: skjema.epost.value.trim(), password: skjema.passord.value }, navn = fane === 'ny' && skjema.navn ? skjema.navn.value.trim() : '';
      if (fane === 'ny' && skjema.navn && !navn) { knapp.disabled = false; melding('Skriv navnet ditt.', true); skjema.navn.focus(); return; }
      if (fane === 'ny' && skjema.passord2 && skjema.passord2.value !== data.password) { knapp.disabled = false; melding('Passordene er ikke like. Skriv det samme passordet to ganger.', true); skjema.passord2.focus(); return; }
      // Brukernavn i stedet for e-post: databasen gir e-posten bare når passordet stemmer (epost_for_innlogging).
      if (fane === 'inn' && data.email.indexOf('@') < 0) {
        k.rpc('epost_for_innlogging', { b: data.email, p: data.password }).then(function (r) {
          if (r.error) throw r.error;
          if (!r.data) throw new Error('Feil brukernavn eller passord.');
          return k.auth.signInWithPassword({ email: r.data, password: data.password });
        }).then(function (r) { knapp.disabled = false; if (r.error) melding(norsk(r.error), true); })
          .catch(function (e) { knapp.disabled = false; melding(/Feil brukernavn|For mange/.test(e.message || '') ? e.message : norsk(e), true); });
        return;
      }
      var underviser = fane === 'ny' && rolleValgt() === 'underviser';
      var kode = underviser ? skjema.kode.value.trim().toUpperCase() : '';
      var info = underviser ? skjema.info.value.trim() : '';
      var sjekk = underviser && kode ? k.rpc('sjekk_underviserkode', { k: kode }).then(function (r) {
        if (r.error) throw r.error;
        if (!r.data) throw new Error('Underviserkoden er ugyldig eller allerede brukt. Sjekk koden, eller la feltet stå tomt for å be om tilgang.');
      }) : Promise.resolve();
      var p = sjekk.then(function () {
        return fane === 'ny'
          ? k.auth.signUp(Object.assign(data, { options: { data: Object.assign({ navn: navn }, kode ? { underviserkode: kode } : underviser ? { be_om_underviser: 'true', underviser_info: info } : {}), emailRedirectTo: location.origin + location.pathname + (neste ? '?neste=' + neste : '') } }))
          : k.auth.signInWithPassword(data);
      }).catch(function (e) { return { error: e }; });
      p.then(function (r) {
        knapp.disabled = false;
        if (r.error) { melding(norsk(r.error), true); return; }
        if (fane === 'ny' && !r.data.session) melding('Nesten ferdig! Vi har sendt deg en e-post. Klikk på lenken i den for å bekrefte kontoen.' + (underviser ? (kode ? ' Kontoen blir en underviserkonto.' : ' Forespørselen om underviser-tilgang sendes til administratoren når kontoen er bekreftet.') : ''));
      });
    };
  }

  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var dato = function (d) { return d ? new Date(d).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' }) : ''; };

  // Valgfritt brukernavn for innlogging.
  function visBrukernavn(k, sesjon) {
    var skj = rot.querySelector('.profil-brukernavn'); if (!skj) return;
    var m = skj.querySelector('.profil-brukernavnmelding');
    k.from('profiler').select('brukernavn').eq('id', sesjon.user.id).maybeSingle().then(function (r) { skj.brukernavn.value = (r && r.data && r.data.brukernavn) || ''; }, function () {});
    skj.onsubmit = function (ev) {
      ev.preventDefault();
      k.rpc('sett_brukernavn', { b: skj.brukernavn.value }).then(function (r) {
        var ok = !r.error && r.data === 'ok';
        m.textContent = ok ? (skj.brukernavn.value.trim() ? 'Lagret. Du kan nå logge inn med brukernavnet.' : 'Brukernavnet er fjernet.') : ((r.error && r.error.message) || r.data);
        m.classList.toggle('feil', !ok);
        if (ok) skj.brukernavn.value = skj.brukernavn.value.trim().toLowerCase();
      });
    };
  }
  // Navnet vises i stedet for e-post. Mangler det (eldre kontoer), ber vi om det.
  function visNavn(k, sesjon) {
    var el = rot.querySelector('.profil-navn'), skj = rot.querySelector('.profil-navnskjema'), knapp = rot.querySelector('.profil-endrenavn');
    el.textContent = sesjon.user.email;
    if (!skj) return;
    var sett = function (navn) { el.textContent = navn ? navn.split(/\s+/)[0] : sesjon.user.email; skj.navn.value = navn; skj.hidden = !!navn; };
    k.from('profiler').select('navn').eq('id', sesjon.user.id).maybeSingle().then(function (r) { sett(((r && r.data && r.data.navn) || '').trim()); }, function () {});
    if (knapp) knapp.onclick = function () { skj.hidden = !skj.hidden; if (!skj.hidden) skj.navn.focus(); };
    skj.onsubmit = function (ev) {
      ev.preventDefault();
      var navn = skj.navn.value.trim(), m = skj.querySelector('.profil-navnmelding');
      if (!navn) { m.textContent = 'Skriv navnet ditt.'; return; }
      k.rpc('sett_navn', { n: navn }).then(function (r) { if (r.error) throw r.error; m.textContent = ''; sett(navn); })
        .catch(function (e) { m.textContent = 'Fikk ikke lagret: ' + (e.message || e); });
    };
  }
  // Min side er todelt: studentdel for alle, underviserdel for godkjente undervisere, og administrasjon for administratoren.
  function fyllMinSide(k, sesjon) {
    if (!rot.querySelector('.profil-rolle')) return; // Enklere Min side (f.eks. matematikkhjelp.no) har ingen rolledel.
    k.rpc('min_rolle').then(function (r) {
      var rolle = (r && r.data) || 'student', underviser = rolle === 'underviser' || rolle === 'admin';
      rot.querySelector('.profil-rolle').textContent = { student: 'Student', underviser: 'Underviser', admin: 'Administrator' }[rolle];
      rot.querySelector('.profil-underviser').hidden = !underviser;
      // For undervisere: undervisningen først, studentdelen skjult bak «Vis studentvisning».
      var sd = rot.querySelector('.profil-studentdel'), knappP = rot.querySelector('.profil-studentknapp'), knapp = knappP.querySelector('button');
      knappP.hidden = !underviser;
      if (underviser) {
        var ud = rot.querySelector('.profil-underviser'); ud.parentNode.insertBefore(knappP, ud.nextSibling); knappP.parentNode.insertBefore(sd, knappP.nextSibling);
        sd.hidden = true;
        sd.querySelector('.profil-studentinfo').hidden = false;
        knapp.onclick = function () { sd.hidden = !sd.hidden; knapp.textContent = sd.hidden ? 'Vis studentvisning' : 'Skjul studentvisning'; knapp.setAttribute('aria-expanded', String(!sd.hidden)); };
      } else sd.hidden = false;
      rot.querySelector('.profil-blivunderviser').hidden = underviser;
      rot.querySelector('.profil-admin').hidden = rolle !== 'admin';
      if (underviser) k.from('kurs').select('id,navn,kode,status').eq('eier', sesjon.user.id).order('opprettet').then(function (r2) {
        var l = (r2 && r2.data) || [], el = rot.querySelector('.profil-fagliste');
        el.innerHTML = l.length ? '<p><b>Fagene dine</b></p><ul>' + l.map(function (c) { return '<li><a href="../studie/index.html#fag-' + c.id + '">' + esc(c.navn) + (c.status === 'pabegynt' ? ' <span style="color:#eee462">(påbegynt)</span>' : '') + '</a></li>'; }).join('') + '</ul>'
          : '<p class="konto-ingress">Du har ingen fag ennå.</p>';
      });
      if (rolle === 'admin') admin(k);
      if (!underviser) visForesporsel(k, sesjon);
    });
    var forespForm = rot.querySelector('.profil-blivunderviser .blivforesporsel');
    forespForm.onsubmit = function (ev) {
      ev.preventDefault();
      var m = rot.querySelector('.profil-blivunderviser .konto-melding');
      k.rpc('be_om_underviser', { tekst: forespForm.info.value.trim() }).then(function (r) {
        if (r.error || !r.data) { m.textContent = r.error ? norsk(r.error) : 'Fikk ikke sendt forespørselen.'; m.classList.add('feil'); return; }
        m.textContent = ''; visForesporsel(k, sesjon);
      });
    };
    var blivForm = rot.querySelector('.profil-blivunderviser .blivkode');
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

  // Statuslinje øverst på Min side når brukeren har bedt om underviser-tilgang.
  function visForesporsel(k, sesjon) {
    k.from('profiler').select('foresporsel, foresporsel_tid').eq('id', sesjon.user.id).maybeSingle().then(function (r) {
      var p = r && r.data, el = rot.querySelector('.profil-foresporsel'), skjema = rot.querySelector('.profil-blivunderviser .blivforesporsel');
      if (!p || !p.foresporsel) { el.hidden = true; return; }
      el.hidden = false;
      el.innerHTML = p.foresporsel === 'venter'
        ? '<b>Du har bedt om underviser-tilgang.</b> Forespørselen din behandles' + (p.foresporsel_tid ? ' (sendt ' + dato(p.foresporsel_tid) + ')' : '') + '. Til den er godkjent, er kontoen en studentkonto.'
        : '<b>Forespørselen om underviser-tilgang ble ikke godkjent.</b> Ta kontakt med administratoren hvis du mener dette er feil, eller send en ny forespørsel under.';
      if (p.foresporsel === 'venter') { skjema.hidden = true; if (skjema.previousElementSibling) skjema.previousElementSibling.hidden = true; }
    });
  }

  function admin(k) {
    var boks = rot.querySelector('.profil-admin'), m = boks.querySelector('.admin-melding');
    var visAlle = false;
    function tegnTilbakemeldinger() {
      var el = boks.querySelector('.admin-tilbakemeldinger'); if (!el) return;
      var q = k.from('tilbakemeldinger').select('*').order('tid', { ascending: false }).limit(100);
      if (!visAlle) q = q.neq('status', 'fikset');
      q.then(function (r) {
        var l = (r && r.data) || [], nye = l.filter(function (t) { return t.status === 'ny'; }).length;
        el.innerHTML = (l.length ? '<p class="konto-ingress">' + nye + ' nye.</p><table class="admin-tabell"><thead><tr><th>Når</th><th>Side</th><th>Melding</th><th>Fra</th><th>Status</th></tr></thead><tbody>' + l.map(function (t) {
          var side = t.side || '', url = (t.nettsted ? 'https://' + t.nettsted : '') + side;
          return '<tr' + (t.status === 'ny' ? ' style="font-weight:600"' : '') + '><td>' + dato(t.tid) + '</td><td>' + (side ? '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(side) + '</a>' : '–') + '</td><td style="white-space:pre-wrap">' + esc(t.tekst) + '</td>' +
            '<td>' + esc(t.epost || (t.bruker ? 'innlogget bruker' : 'anonym')) + '</td><td>' +
            ['ny', 'lest', 'fikset'].map(function (s) { return '<button type="button" data-tb="' + t.id + '" data-status="' + s + '"' + (t.status === s ? ' disabled' : '') + '>' + { ny: 'Ny', lest: 'Lest', fikset: 'Fikset' }[s] + '</button>'; }).join(' ') + '</td></tr>';
        }).join('') + '</tbody></table>' : '<p class="konto-ingress">Ingen tilbakemeldinger' + (visAlle ? '' : ' som venter') + '.</p>') +
          '<p><button type="button" data-tb-alle="1">' + (visAlle ? 'Skjul de som er fikset' : 'Vis også de som er fikset') + '</button></p>';
      });
    }
    function tegnAdmin() {
      tegnTilbakemeldinger();
      k.rpc('admin_foresporsler').then(function (r) {
        var l = (r && r.data) || [], el = boks.querySelector('.admin-foresporsler');
        el.innerHTML = l.length ? '<table class="admin-tabell"><thead><tr><th>E-post</th><th>Hvor underviser du?</th><th>Sendt</th><th></th></tr></thead><tbody>' + l.map(function (f) {
          return '<tr><td>' + esc(f.epost) + '</td><td>' + esc(f.tekst || '–') + '</td><td>' + dato(f.tid) + '</td><td><button type="button" data-godkjenn="' + f.id + '">Godkjenn</button> <button type="button" data-avsla="' + f.id + '">Avslå</button></td></tr>';
        }).join('') + '</tbody></table>' : '<p class="konto-ingress">Ingen ventende forespørsler.</p>';
      });
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
      if (b.dataset.tb) { k.from('tilbakemeldinger').update({ status: b.dataset.status }).eq('id', +b.dataset.tb).then(tegnTilbakemeldinger); return; }
      if (b.dataset.tbAlle) { visAlle = !visAlle; tegnTilbakemeldinger(); return; }
      if (b.dataset.slettKode) k.from('underviserkoder').delete().eq('kode', b.dataset.slettKode).then(tegnAdmin);
      if (b.dataset.godkjenn) k.rpc('svar_foresporsel', { b: b.dataset.godkjenn, godkjenn: true }).then(tegnAdmin);
      if (b.dataset.avsla) {
        if (b.dataset.bekreft !== '1') { b.dataset.bekreft = '1'; b.textContent = 'Bekreft avslag'; return; }
        k.rpc('svar_foresporsel', { b: b.dataset.avsla, godkjenn: false }).then(tegnAdmin);
      }
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
