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

  // ── Cookie consent ──────────────────────────────────────────────────────────
  // Toont een balk tot de bezoeker kiest. Bij "Accepteren" wordt Google Analytics
  // geladen (zie het gtag-script in de <head>); de keuze wordt onthouden.
  (function initCookieConsent() {
    var KEY = 'vh-cookie-consent';
    var choice;
    try { choice = localStorage.getItem(KEY); } catch (e) { /* storage geblokkeerd → toon balk */ }
    if (choice === 'accepted' || choice === 'declined') return;

    var bar = document.createElement('div');
    bar.className = 'cookie-consent';
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-label', 'Cookietoestemming');
    bar.innerHTML =
      '<p class="cookie-consent__text">We gebruiken cookies om de website te laten werken en — met je toestemming — analytische cookies (Google Analytics) om de site te verbeteren.</p>' +
      '<div class="cookie-consent__actions">' +
        '<button type="button" class="btn btn-ghost" data-cc="decline">Weigeren</button>' +
        '<button type="button" class="btn btn-accent" data-cc="accept">Accepteren</button>' +
      '</div>';
    document.body.appendChild(bar); // zichtbaar via CSS-animatie (geen rAF nodig)

    function finish(value) {
      try { localStorage.setItem(KEY, value); } catch (e) {}
      if (value === 'accepted' && typeof window.loadGoogleAnalytics === 'function') {
        window.loadGoogleAnalytics();
      }
      bar.classList.add('is-hiding');
      setTimeout(function () { bar.remove(); }, 300);
    }
    bar.querySelector('[data-cc="accept"]').addEventListener('click', function () { finish('accepted'); });
    bar.querySelector('[data-cc="decline"]').addEventListener('click', function () { finish('declined'); });
  })();

  // ── Lightbox: klikbare afbeeldingen ([data-full]) openen in een modal ────────
  (function initLightbox() {
    var triggers = document.querySelectorAll('[data-full]');
    if (!triggers.length) return;

    var box = document.createElement('div');
    box.className = 'lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.innerHTML = '<button type="button" class="lightbox__close" aria-label="Sluiten">&times;</button><img alt="">';
    document.body.appendChild(box);

    var img = box.querySelector('img');
    var closeBtn = box.querySelector('.lightbox__close');

    function open(src, alt) {
      img.src = src; img.alt = alt || '';
      box.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    }
    function close() {
      box.classList.remove('is-open');
      document.body.style.overflow = '';
      setTimeout(function () { img.src = ''; }, 200);
    }

    triggers.forEach(function (t) {
      t.addEventListener('click', function () {
        var inner = t.querySelector('img');
        open(t.getAttribute('data-full'), inner ? inner.alt : '');
      });
    });
    box.addEventListener('click', function (e) { if (e.target === box) close(); });
    closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  })();

  // ── Artikel-modal: Nature Communications (2024) met 2 tabs ───────────────────
  // Triggers: elementen met [data-article]. De inhoud (eenvoudige + weten-
  // schappelijke samenvatting) staat hier centraal, zodat elke pagina dezelfde
  // toont. Zonder JS opent de link gewoon het artikel op nature.com.
  (function initArticleModal() {
    var triggers = document.querySelectorAll('[data-article]');
    if (!triggers.length) return;

    var NATURE = 'https://www.nature.com/articles/s41467-024-54357-0';

    var simple =
      '<p class="am-lead">Wat er onderzocht is — in gewone taal.</p>' +
      '<ul class="am-list">' +
        '<li>Onderzoekers analyseerden het bloed van ruim <strong>700.000 mensen</strong> uit drie Europese biobanken (Verenigd Koninkrijk, Estland, Finland).</li>' +
        '<li>Met <strong>één bloedmeting</strong> (NMR-metabolomics) keken ze of je stofwisselingsprofiel voorspelt wie in de jaren erna een van <strong>12 veelvoorkomende ziekten</strong> krijgt — zoals hartinfarct, beroerte, diabetes type 2, COPD, longkanker en leverziekte.</li>' +
        '<li>Dit bloedprofiel voorspelde ziekte <strong>vaak beter dan iemands DNA</strong>. De 10% met het hoogste risico had bijvoorbeeld tot ongeveer <strong>10× meer kans</strong> op diabetes of leverziekte.</li>' +
        '<li>Belangrijk voor preventie: anders dan DNA is dit profiel <strong>veranderbaar</strong>. Bij mensen van wie het profiel na een paar jaar verbeterde, daalde het ziekterisico duidelijk (diabetes ~2,5× lager, longkanker zelfs ~5× lager). Leefstijl en behandeling zijn dus <strong>meetbaar</strong> terug te zien.</li>' +
        '<li>Meer dan <strong>1 op de 4</strong> deelnemers had een verhoogd risico op minstens één hart-, long-, lever- of stofwisselingsziekte — precies de groep die baat heeft bij vroege, gerichte preventie.</li>' +
      '</ul>' +
      '<p class="am-note">Dit is de kern van Vita Health: met één bloedmeting risico’s vroeg zichtbaar maken én volgen of leefstijlaanpassingen werken.</p>';

    var science =
      '<p class="am-lead">Methoden &amp; bevindingen — in wetenschappelijke taal.</p>' +
      '<ul class="am-list">' +
        '<li><strong>Opzet:</strong> prospectieve cohortstudie in 700.217 deelnemers uit drie nationale biobanken (UK Biobank n=477.078; Estonian Biobank n=190.785; Finnish THL Biobank n=32.354).</li>' +
        '<li><strong>Meting:</strong> NMR-metabolomics (Nightingale Health-platform; 249 biomarkers, 36 klinisch gevalideerde markers voor modeltraining) in absolute concentraties (mmol/L) — daardoor zonder herkalibratie overdraagbaar tussen cohorten.</li>' +
        '<li><strong>Uitkomsten:</strong> 12 aandoeningen die samen meer dan een derde van de DALY’s in hoge-inkomenslanden veroorzaken. Cox-modellen; metabolomische scores vergeleken met polygene risicoscores (PGS) en klinische scores (QRISK3, QDiabetes, COPD-PS).</li>' +
        '<li><strong>Resultaat:</strong> metabolomische scores overtroffen PGS voor 9 van de 10 ziekten met beschikbare PGS. Hazard ratio’s (top 10% vs. rest): ~10× voor diabetes type 2 en leverziekten, ~2,5–4× voor hart- en longziekten; consistent gerepliceerd over de drie biobanken (Bonferroni-gecorrigeerd, p&lt;0,004).</li>' +
        '<li><strong>Complementariteit:</strong> metabolomische en genetische scores waren aanvullend (additief op log-HR-schaal); toevoeging aan klinische scores verbeterde de discriminatie (AUC-toename 0,006–0,118).</li>' +
        '<li><strong>Dynamiek:</strong> bij herhaalde metingen (n=18.709, mediaan ~4,4 jaar) bleef de score voorspellend; wie de hoogrisicogroep verliet had 1,9–4,9× lager risico — geschikt voor longitudinale risicomonitoring.</li>' +
        '<li><strong>Kanttekening auteurs:</strong> overwegend Noord-Europese afkomst; klinische implementatie vereist verder onderzoek naar het effect van interventies.</li>' +
      '</ul>' +
      '<p class="am-cite">Nightingale Health Biobank Collaborative Group. <em>Metabolomic and genomic prediction of common diseases in 700,217 participants in three national biobanks.</em> Nature Communications (2024). DOI: 10.1038/s41467-024-54357-0.</p>';

    var box = document.createElement('div');
    box.className = 'article-modal';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-labelledby', 'am-title');
    box.innerHTML =
      '<div class="article-modal__card">' +
        '<button type="button" class="article-modal__close" aria-label="Sluiten">&times;</button>' +
        '<div class="article-modal__head">' +
          '<span class="eyebrow"><span class="dot"></span> Nature Communications · 2024 · Nightingale Health</span>' +
          '<h3 id="am-title">Ziekte voorspellen uit één bloedmeting</h3>' +
          '<p class="article-modal__sub">700.217 deelnemers · 3 nationale biobanken · 12 ziekten</p>' +
        '</div>' +
        '<div class="article-modal__tabs" role="tablist">' +
          '<button type="button" class="article-modal__tab is-active" data-tab="simple" role="tab">Eenvoudige uitleg</button>' +
          '<button type="button" class="article-modal__tab" data-tab="science" role="tab">Wetenschappelijke uitleg</button>' +
        '</div>' +
        '<div class="article-modal__body">' +
          '<div class="article-modal__panel is-active" data-panel="simple">' + simple + '</div>' +
          '<div class="article-modal__panel" data-panel="science">' + science + '</div>' +
        '</div>' +
        '<div class="article-modal__foot">' +
          '<a href="' + NATURE + '" target="_blank" rel="noopener" class="text-link">Lees het volledige artikel op Nature Communications →</a>' +
        '</div>' +
      '</div>';
    document.body.appendChild(box);

    var tabs = box.querySelectorAll('.article-modal__tab');
    var panels = box.querySelectorAll('.article-modal__panel');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var name = tab.getAttribute('data-tab');
        tabs.forEach(function (t) { t.classList.toggle('is-active', t === tab); });
        panels.forEach(function (p) { p.classList.toggle('is-active', p.getAttribute('data-panel') === name); });
        box.querySelector('.article-modal__body').scrollTop = 0;
      });
    });

    function open() { box.classList.add('is-open'); document.body.style.overflow = 'hidden'; }
    function close() { box.classList.remove('is-open'); document.body.style.overflow = ''; }

    triggers.forEach(function (t) {
      t.addEventListener('click', function (e) { e.preventDefault(); open(); });
    });
    box.addEventListener('click', function (e) { if (e.target === box) close(); });
    box.querySelector('.article-modal__close').addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  })();
})();
