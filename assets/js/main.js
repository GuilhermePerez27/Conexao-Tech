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
     "pagina" é para onde o marcador leva: as 3 cidades atendidas levam ao
     site da própria prefeitura; Londrina leva ao Pensamento Computacional.
     -------------------------------------------------------------------- */
  var CIDADES = [
    { nome: 'Londrina',  lat: -23.3103,    lng: -51.1628,    pagina: 'https://unifil.br/pensamentocomputacional/', meta: 'Sede da UniFil', rotulo: 'Ir para o programa' },
    { nome: 'Cambé',     lat: -23.2782035, lng: -51.2779583, pagina: 'https://www.cambe.pr.gov.br/', meta: 'Prefeitura de Cambé', rotulo: 'Site da Prefeitura' },
    { nome: 'Arapongas', lat: -23.4152862, lng: -51.4293961, pagina: 'https://www.arapongas.pr.gov.br/', meta: 'Prefeitura de Arapongas', rotulo: 'Site da Prefeitura' },
    { nome: 'Rolândia',  lat: -23.3119901, lng: -51.3674145, pagina: 'https://www.rolandia.pr.gov.br/', meta: 'Prefeitura de Rolândia', rotulo: 'Site da Prefeitura' }
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
     5. Mapa das cidades atendidas (Leaflet + tiles CartoDB Positron)

     Sem chave de API e sem serviço pago: assets/vendor/leaflet/ é a própria
     biblioteca, baixada e hospedada dentro do projeto, carregada por um
     <script defer> logo antes deste arquivo em index.html. Os tiles vêm do
     CartoDB Positron (basemaps.cartocdn.com), um estilo claro/quase branco,
     gratuito e sem necessidade de chave.
     -------------------------------------------------------------------- */
  function initMapa() {
    var alvo = document.getElementById('mapa');
    if (!alvo) return;

    if (typeof L === 'undefined') {
      // Só acontece se assets/vendor/leaflet/leaflet.js não carregar
      // (arquivo ausente/renomeado). Evita deixar o painel vazio.
      alvo.innerHTML = '<p style="padding:24px;color:#6b6280;font-size:.9rem">' +
        'Não foi possível carregar o mapa. Veja a lista de cidades atendidas logo abaixo.</p>';
      return;
    }

    var mapa = L.map(alvo, {
      scrollWheelZoom: false, // exige Ctrl/2 dedos para zoom — não sequestra a rolagem da página
      zoomControl: true
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(mapa);

    // Ativa o zoom por scroll só depois de um Ctrl/Cmd + roda do mouse,
    // para não sequestrar a rolagem da página quando o mouse passa por cima do mapa.
    alvo.addEventListener('wheel', function (e) {
      if (e.ctrlKey || e.metaKey) mapa.scrollWheelZoom.enable();
      else mapa.scrollWheelZoom.disable();
    });

    var pontos = [];

    CIDADES.forEach(function (cidade) {
      var posicao = [cidade.lat, cidade.lng];
      pontos.push(posicao);

      var icone = L.divIcon({
        className: '', // remove a classe/estilo padrão do Leaflet para o ícone
        html: '<div class="pin"><span class="pin__pulse"></span><span class="pin__dot"></span></div>',
        iconSize: [26, 26],
        iconAnchor: [13, 13],
        popupAnchor: [0, -13]
      });

      // Todo marcador leva a um site externo (prefeitura da cidade, ou o
      // Pensamento Computacional no caso de Londrina), por isso sempre abre
      // em nova aba.
      var conteudo =
        '<div class="popup__city">' + cidade.nome + '</div>' +
        '<div class="popup__meta">' + cidade.meta + '</div>' +
        '<a class="popup__link" href="' + cidade.pagina + '" target="_blank" rel="noopener">' +
        cidade.rotulo + ' &rarr;</a>';

      L.marker(posicao, { icon: icone, title: cidade.nome, alt: cidade.nome })
        .addTo(mapa)
        .bindPopup(conteudo, { closeButton: false });
    });

    mapa.fitBounds(pontos, { padding: [32, 32] });
  }

  /* -----------------------------------------------------------------------
     6. Slideshow de fotos (linha do tempo)
     Fade + zoom lento automáticos entre as fotos, com uma barra de
     progresso por foto (mesma ideia de "stories") que também serve de
     navegação direta. Pausa com o mouse/foco em cima e enquanto a aba está
     em segundo plano — e ao pausar, guarda o tempo que já tinha passado,
     pra continuar de onde parou em vez de reiniciar a contagem.
     Quem pede menos movimento (prefers-reduced-motion) não recebe troca
     automática nem zoom — só navega manualmente pelas setas/segmentos.
     -------------------------------------------------------------------- */
  function initSlideshow() {
    var raiz = document.querySelector('[data-slideshow]');
    if (!raiz) return;

    var itens = Array.prototype.slice.call(raiz.querySelectorAll('.slide__item'));
    var segmentos = Array.prototype.slice.call(raiz.querySelectorAll('.slide__seg'));
    var btnAnt = raiz.querySelector('.slide__seta--ant');
    var btnProx = raiz.querySelector('.slide__seta--prox');
    if (itens.length < 2) return; // nada para trocar com 0 ou 1 foto

    var intervaloMs = parseInt(raiz.dataset.intervalo, 10) || 10000;
    var semMovimento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var atual = itens.findIndex(function (el) { return el.classList.contains('is-ativo'); });
    if (atual < 0) atual = 0;

    var temporizador = null;
    var restanteMs = intervaloMs;
    var inicioCiclo = null;

    function preencherBarra(indice, largura, comTransicao) {
      var fill = segmentos[indice] && segmentos[indice].querySelector('.slide__seg-fill');
      if (!fill) return;
      fill.style.transition = comTransicao ? 'width ' + comTransicao + 'ms linear' : 'none';
      fill.style.width = largura;
    }

    function mostrar(indice) {
      atual = (indice + itens.length) % itens.length;
      itens.forEach(function (el, i) { el.classList.toggle('is-ativo', i === atual); });
      segmentos.forEach(function (el, i) {
        el.classList.toggle('is-concluido', i < atual);
        el.classList.toggle('is-ativo', i === atual);
        el.setAttribute('aria-selected', i === atual ? 'true' : 'false');
        if (i !== atual) preencherBarra(i, i < atual ? '100%' : '0%', null);
      });
      restanteMs = intervaloMs;
      preencherBarra(atual, '0%', null);
      void raiz.offsetWidth; // força o navegador aplicar o width:0% antes de animar
      preencherBarra(atual, '100%', restanteMs);
      // Quem pede menos movimento nem chega a ver essa transição em câmera
      // lenta: a regra global de prefers-reduced-motion já zera a duração
      // de toda transição/animação do site, incluindo esta.
    }

    function agendar() {
      if (semMovimento) return; // troca automática desligada; navegação manual continua
      inicioCiclo = Date.now();
      temporizador = window.setTimeout(function () {
        mostrar(atual + 1);
        agendar();
      }, restanteMs);
    }

    function parar() {
      if (!temporizador) return;
      window.clearTimeout(temporizador);
      temporizador = null;
      if (inicioCiclo) {
        restanteMs = Math.max(0, restanteMs - (Date.now() - inicioCiclo));
      }
      var fill = segmentos[atual] && segmentos[atual].querySelector('.slide__seg-fill');
      if (fill) {
        // trava a barra exatamente na largura atual em vez de deixar a
        // transição continuar correndo sozinha enquanto está "pausado".
        var largadaAtual = window.getComputedStyle(fill).width;
        fill.style.transition = 'none';
        fill.style.width = largadaAtual;
      }
    }

    function retomar() {
      if (semMovimento || temporizador) return;
      agendar();
      preencherBarra(atual, '100%', restanteMs);
    }

    // Qualquer clique manual reinicia a contagem da foto escolhida.
    if (btnProx) btnProx.addEventListener('click', function () { parar(); mostrar(atual + 1); agendar(); });
    if (btnAnt) btnAnt.addEventListener('click', function () { parar(); mostrar(atual - 1); agendar(); });
    segmentos.forEach(function (el, i) {
      el.addEventListener('click', function () { parar(); mostrar(i); agendar(); });
    });

    raiz.addEventListener('mouseenter', parar);
    raiz.addEventListener('mouseleave', retomar);
    raiz.addEventListener('focusin', parar);
    raiz.addEventListener('focusout', retomar);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) parar(); else retomar();
    });

    mostrar(atual);
    agendar();
  }

  /* -----------------------------------------------------------------------
     7. Barra de ação fixa no mobile
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
     8. Ano dinâmico no rodapé
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
    initSlideshow();
    initActionBar();
    initAno();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
