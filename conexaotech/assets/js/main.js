/* =========================================================================
   Conexão Tech — interatividade
   JavaScript puro, sem dependências (exceto Leaflet, carregado só na home).
   ========================================================================= */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* -----------------------------------------------------------------------
     Cidades atendidas — fonte única usada pelo mapa da home.
     Coordenadas conferidas via OpenStreetMap/Nominatim.
     -------------------------------------------------------------------- */
  var CIDADES = [
    { nome: 'Cambé',     lat: -23.2782035, lng: -51.2779583, pagina: 'cambe.html' },
    { nome: 'Ibiporã',   lat: -23.2684137, lng: -51.0475907, pagina: 'ibipora.html' },
    { nome: 'Arapongas', lat: -23.4152862, lng: -51.4293961, pagina: 'arapongas.html' },
    { nome: 'Rolândia',  lat: -23.3119901, lng: -51.3674145, pagina: 'rolandia.html' }
  ];

  /* -----------------------------------------------------------------------
     1. Header — estado "rolado" e menu mobile
     -------------------------------------------------------------------- */
  function initHeader() {
    var header = document.querySelector('.site-header');
    var toggle = document.querySelector('.nav-toggle');
    var nav = document.querySelector('.nav');

    if (header) {
      var onScroll = function () {
        header.classList.toggle('is-scrolled', window.scrollY > 12);
      };
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
    }

    if (!toggle || !nav) return;

    var setOpen = function (open) {
      toggle.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('is-open', open);
      toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    };

    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });

    // Fecha ao escolher um item do menu
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });

    // Fecha ao clicar fora
    document.addEventListener('click', function (e) {
      if (!nav.classList.contains('is-open')) return;
      if (nav.contains(e.target) || toggle.contains(e.target)) return;
      setOpen(false);
    });

    // Fecha com Esc e devolve o foco ao botão
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        setOpen(false);
        toggle.focus();
      }
    });

    // Ao voltar para o desktop, garante o menu em estado neutro
    window.matchMedia('(min-width: 961px)').addEventListener('change', function (e) {
      if (e.matches) setOpen(false);
    });
  }

  /* -----------------------------------------------------------------------
     2. FAQ — accordion acessível
     -------------------------------------------------------------------- */
  function initFaq() {
    var items = document.querySelectorAll('.faq-item');
    if (!items.length) return;

    Array.prototype.forEach.call(items, function (item) {
      var btn = item.querySelector('.faq-item__btn');
      var panel = item.querySelector('.faq-item__panel');
      if (!btn || !panel) return;

      btn.addEventListener('click', function () {
        var isOpen = item.classList.contains('is-open');

        // Um painel aberto por vez
        Array.prototype.forEach.call(items, function (other) {
          other.classList.remove('is-open');
          var b = other.querySelector('.faq-item__btn');
          var p = other.querySelector('.faq-item__panel');
          if (b) b.setAttribute('aria-expanded', 'false');
          if (p) p.setAttribute('aria-hidden', 'true');
        });

        if (!isOpen) {
          item.classList.add('is-open');
          btn.setAttribute('aria-expanded', 'true');
          panel.setAttribute('aria-hidden', 'false');
        }
      });
    });
  }

  /* -----------------------------------------------------------------------
     3. Scroll reveal (IntersectionObserver)
     -------------------------------------------------------------------- */
  function initReveal() {
    var els = document.querySelectorAll('.reveal');
    if (!els.length) return;

    if (reduceMotion || !('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(els, function (el) { el.classList.add('is-visible'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

    Array.prototype.forEach.call(els, function (el) { io.observe(el); });
  }

  /* -----------------------------------------------------------------------
     4. Contadores animados das estatísticas do hero
     -------------------------------------------------------------------- */
  function initCounters() {
    var counters = document.querySelectorAll('[data-count]');
    if (!counters.length) return;

    var run = function (el) {
      var target = parseFloat(el.getAttribute('data-count'));
      var suffix = el.getAttribute('data-suffix') || '';
      if (isNaN(target)) return;

      if (reduceMotion) {
        el.textContent = target + suffix;
        return;
      }

      var duration = 1400;
      var start = null;

      var tick = function (now) {
        if (start === null) start = now;
        var p = Math.min((now - start) / duration, 1);
        // easeOutExpo
        var eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
        el.textContent = Math.round(target * eased) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
    };

    if (!('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(counters, run);
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        run(entry.target);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.6 });

    Array.prototype.forEach.call(counters, function (el) { io.observe(el); });
  }

  /* -----------------------------------------------------------------------
     5. Mapa das cidades atendidas (Leaflet + tiles CartoDB Dark Matter)
     -------------------------------------------------------------------- */
  function initMapa() {
    var alvo = document.getElementById('mapa');
    if (!alvo) return;

    if (typeof L === 'undefined') {
      alvo.innerHTML = '<p style="padding:24px;color:#96a2c2;font-size:.9rem">' +
        'Não foi possível carregar o mapa. Veja a lista de cidades atendidas logo abaixo.</p>';
      return;
    }

    // No celular o mapa ocupa boa parte da tela e fica no caminho da rolagem:
    // com o arraste ligado, o polegar move o mapa em vez de avançar a página.
    // O arraste só é liberado depois de um toque deliberado — mesmo contrato
    // usado para a roda do mouse no desktop.
    // Detecta o dispositivo pelo tipo de ponteiro, não pela largura: quem apenas
    // estreita a janela no desktop continua conseguindo arrastar o mapa.
    var ehToque = window.matchMedia('(hover: none) and (pointer: coarse)').matches;

    var mapa = L.map(alvo, {
      scrollWheelZoom: false,   // evita "sequestrar" a rolagem da página
      dragging: !ehToque,
      tap: false,
      zoomControl: false,       // recriado abaixo com rótulos em pt-BR
      attributionControl: true
    });

    L.control.zoom({
      position: 'topleft',
      zoomInTitle: 'Aproximar',
      zoomOutTitle: 'Afastar'
    }).addTo(mapa);

    if (ehToque) {
      alvo.addEventListener('click', function liberar() {
        mapa.dragging.enable();
        alvo.removeEventListener('click', liberar);
      });
    }

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ' +
        '&copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(mapa);

    var icone = L.divIcon({
      className: '',
      html: '<div class="pin"><span class="pin__pulse"></span><span class="pin__dot"></span></div>',
      iconSize: [26, 26],
      iconAnchor: [13, 13],
      popupAnchor: [0, -12]
    });

    var pontos = [];

    CIDADES.forEach(function (cidade) {
      pontos.push([cidade.lat, cidade.lng]);

      L.marker([cidade.lat, cidade.lng], {
        icon: icone,
        title: cidade.nome,
        alt: 'Marcação de ' + cidade.nome + ' no mapa',
        keyboard: true
      })
        .addTo(mapa)
        .bindPopup(
          '<div class="popup__city">' + cidade.nome + '</div>' +
          '<div class="popup__meta">Paraná</div>' +
          '<a class="popup__link" href="' + cidade.pagina + '">Ver página da cidade &rarr;</a>'
        );
    });

    mapa.fitBounds(L.latLngBounds(pontos), { padding: [58, 58], maxZoom: 11 });

    // Habilita a roda do mouse apenas depois de um clique no mapa
    mapa.on('click', function () { mapa.scrollWheelZoom.enable(); });
    mapa.on('mouseout', function () { mapa.scrollWheelZoom.disable(); });
  }

  /* -----------------------------------------------------------------------
     6. Barra de ação fixa no mobile
     Aparece depois que a seção de cidades passa e some quando o CTA final
     entra em tela, para não competir com ele.
     -------------------------------------------------------------------- */
  function initActionBar() {
    var barra = document.querySelector('.action-bar');
    if (!barra) return;

    var cidades = document.getElementById('cidades');
    var ctaFinal = document.querySelector('.cta-band');
    if (!cidades || !ctaFinal) return;

    document.body.classList.add('has-action-bar');

    var atualizar = function () {
      var passouCidades = cidades.getBoundingClientRect().bottom < 0;
      var ctaAtingido = ctaFinal.getBoundingClientRect().top < window.innerHeight;
      barra.classList.toggle('is-visible', passouCidades && !ctaAtingido);
    };

    atualizar();
    window.addEventListener('scroll', atualizar, { passive: true });
    window.addEventListener('resize', atualizar);
  }

  /* -----------------------------------------------------------------------
     7. Ano dinâmico no rodapé
     -------------------------------------------------------------------- */
  function initAno() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-ano]'), function (el) {
      el.textContent = new Date().getFullYear();
    });
  }

  /* -----------------------------------------------------------------------
     Inicialização
     -------------------------------------------------------------------- */
  function init() {
    initHeader();
    initFaq();
    initReveal();
    initCounters();
    initMapa();
    initActionBar();
    initAno();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
