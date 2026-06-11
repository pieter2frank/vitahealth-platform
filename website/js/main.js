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

  // Eenvoudige formulier-afhandeling (demo: toont bevestiging, geen backend)
  const form = document.querySelector('form[data-demo]');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const ok = form.querySelector('.form-success');
      if (ok) ok.classList.add('show');
      form.reset();
      if (ok) ok.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }
})();
