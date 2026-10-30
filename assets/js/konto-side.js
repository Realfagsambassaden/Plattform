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
        if (neste === 'dekning') { location.href = '../dekning.html'; return; }
        vis('mal-inne');
        rot.querySelector('.profil-navn').textContent = sesjon.user.email;
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

    skjema.onsubmit = function (ev) {
      ev.preventDefault();
      var knapp = skjema.querySelector('button[type="submit"]'); knapp.disabled = true;
      var data = { email: skjema.epost.value.trim(), password: skjema.passord.value };
      var p = fane === 'ny'
        ? k.auth.signUp(Object.assign(data, { options: { emailRedirectTo: location.origin + location.pathname + (neste ? '?neste=' + neste : '') } }))
        : k.auth.signInWithPassword(data);
      p.then(function (r) {
        knapp.disabled = false;
        if (r.error) { melding(norsk(r.error), true); return; }
        if (fane === 'ny' && !r.data.session) melding('Nesten ferdig! Vi har sendt deg en e-post. Klikk på lenken i den for å bekrefte kontoen.');
      });
    };
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
