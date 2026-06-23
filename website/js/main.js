// Vita Health — kleine interacties: mobiel menu + header-schaduw bij scroll
(function () {
  const header = document.querySelector('.site-header');
  const toggle = document.querySelector('.nav__toggle');
  const links = document.querySelector('.nav__links');

  if (toggle && links) {
    toggle.addEventListener('click', function () {
      const open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    // sluit menu na klik op een link (mobiel)
    links.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { links.classList.remove('open'); });
    });
  }

  function onScroll() {
    if (!header) return;
    header.classList.toggle('scrolled', window.scrollY > 8);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Roulerende hero-achtergrond (homepage): crossfade tussen home1..home10
  const rotator = document.querySelector('[data-hero-rotator]');
  if (rotator && !rotator.dataset.rotating) {
    rotator.dataset.rotating = '1'; // voorkom dubbele timers
    const layers = rotator.querySelectorAll('.hero__slide');
    const imgs = Array.from({ length: 10 }, function (_, i) { return 'assets/home' + (i + 1) + '.jpg'; });
    if (layers.length >= 2) {
      imgs.forEach(function (src) { var im = new Image(); im.src = src; }); // voorladen
      var idx = 0, front = 0;
      layers[0].style.backgroundImage = 'url("' + imgs[0] + '")';
      layers[0].classList.add('is-active');
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!reduce) {
        setInterval(function () {
          var next = (idx + 1) % imgs.length;
          var back = front ^ 1;
          layers[back].style.backgroundImage = 'url("' + imgs[next] + '")';
          layers[back].classList.add('is-active');
          layers[front].classList.remove('is-active');
          front = back; idx = next;
        }, 4500);
      }
    }
  }

  // Formulier-afhandeling: verstuur via AJAX naar het PHP-script.
  // Zonder JS valt het formulier terug op een normale POST (PHP toont dan een
  // bedanktpagina), dankzij action/method op het <form>.
  document.querySelectorAll('form[data-ajax]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      // .form-success/.form-error staan als broer van het formulier in .form-card
      var card = form.closest('.form-card') || form.parentElement || document;
      var ok  = card.querySelector('.form-success');
      var err = card.querySelector('.form-error');
      var btn = form.querySelector('button[type="submit"]');
      if (err) { err.classList.remove('show'); err.textContent = ''; }

      var original = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; btn.textContent = 'Versturen…'; }

      fetch(form.action, {
        method: 'POST',
        headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' },
        body: new FormData(form),
      })
        .then(function (res) { return res.json().then(function (d) { return { res: res, data: d }; }); })
        .then(function (r) {
          if (r.res.ok && r.data && r.data.ok) {
            if (ok) { ok.classList.add('show'); ok.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
            form.reset();
          } else {
            showFormError(err, (r.data && r.data.error) || 'Versturen mislukt. Probeer het later opnieuw.');
          }
        })
        .catch(function () {
          showFormError(err, 'Er ging iets mis. Controleer je verbinding en probeer het opnieuw.');
        })
        .finally(function () {
          if (btn) { btn.disabled = false; btn.textContent = original; }
        });
    });
  });

  function showFormError(el, msg) {
    if (!el) { alert(msg); return; }
    el.textContent = msg;
    el.classList.add('show');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
})();
