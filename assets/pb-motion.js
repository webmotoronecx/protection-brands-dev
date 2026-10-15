/*
  Protection Brands motion: Lenis smooth scrolling and scroll-in reveals, driven by GSAP.
  Loaded with `defer` by snippets/pb-head.liquid, after gsap, ScrollTrigger and Lenis.

  Config comes from window.PBMotion = { smoothScroll, reveal }.

  Reveals:
  - Every section in #MainContent that starts below the first screen fades and slides in once.
  - Any element with [data-reveal] reveals its children with a stagger instead.
  - The footer ([data-pb-footer]) slides down from under the page above, scrubbed to the scroll,
    with parallax on its content.
  - Product cards (.product-grid__item) below the first screen fade in (no slide) in batches
    as they scroll in. Cards on screen at load get the CSS intro instead (assets/pb-intro.css).
  Nothing above the fold is hidden, so first paint and LCP are untouched. Elements are only
  hidden by this script, so without JS everything is visible.

  Scroller: at 990px and up Horizon scrolls .page-wrapper, not the window (see
  assets/scroll-container.js). Lenis and ScrollTrigger are both pointed at whichever element
  scrolls. Crossing 990px mid-visit rebuilds Lenis and shows anything not yet revealed.

  Off for prefers-reduced-motion and in the theme editor.
*/
(() => {
  const config = window.PBMotion || {};
  const { gsap, ScrollTrigger, Lenis } = window;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (!gsap || reducedMotion.matches || window.Shopify?.designMode) return;

  const squeeze = window.matchMedia('(min-width: 990px)');
  const pageWrapper = document.querySelector('.page-wrapper');
  const scroller = () => (squeeze.matches && pageWrapper ? pageWrapper : window);

  let lenis = null;

  /* Smooth scroll ---------------------------------------------------------------- */

  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const root = document.documentElement;

  const startLenis = () => {
    lenis?.destroy();
    const wrapper = scroller();
    lenis =
      wrapper === window
        ? new Lenis({ anchors: true, autoRaf: false, allowNestedScroll: true })
        : new Lenis({ wrapper, content: wrapper, anchors: true, autoRaf: false, allowNestedScroll: true });
    if (ScrollTrigger) lenis.on('scroll', ScrollTrigger.update);
    if (root.hasAttribute('scroll-lock') || root.hasAttribute('data-pb-menu-open')) lenis.stop();
  };

  if (config.smoothScroll && Lenis && finePointer) {
    startLenis();

    // One loop: Lenis runs on GSAP's ticker, and ScrollTrigger reads Lenis' position.
    gsap.ticker.add((time) => lenis?.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);

    // Pause while something covers the page: Horizon's drawers and dialogs set
    // html[scroll-lock], the PB floating menu sets html[data-pb-menu-open].
    const locked = () => root.hasAttribute('scroll-lock') || root.hasAttribute('data-pb-menu-open');
    new MutationObserver(() => (locked() ? lenis?.stop() : lenis?.start())).observe(root, {
      attributes: true,
      attributeFilter: ['scroll-lock', 'data-pb-menu-open'],
    });

    squeeze.addEventListener('change', startLenis);
  }

  /* Reveals ---------------------------------------------------------------------- */

  const revealed = [];
  const showAll = () => {
    ScrollTrigger?.getAll().forEach((trigger) => trigger.kill());
    gsap.killTweensOf(revealed);
    gsap.set(revealed, { clearProps: 'transform,opacity' });
  };

  if (config.reveal && ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.defaults({ scroller: scroller() });

    const belowFold = (el) => el.getBoundingClientRect().top > window.innerHeight;
    // Opacity, not visibility: hidden content must stay reachable by keyboard.
    const from = { opacity: 0, y: 24 };
    const to = { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', overwrite: true, clearProps: 'transform,opacity' };

    const groups = [...document.querySelectorAll('[data-reveal]')].filter(belowFold);
    const sections = [...document.querySelectorAll('#MainContent > .shopify-section')]
      .filter(belowFold)
      .filter((section) => !groups.some((group) => section.contains(group)));

    if (sections.length) {
      gsap.set(sections, from);
      revealed.push(...sections);
      ScrollTrigger.batch(sections, {
        start: 'top 90%',
        once: true,
        onEnter: (batch) => gsap.to(batch, { ...to, stagger: 0.08 }),
      });
    }

    // Product cards below the first screen, in batches as they scroll in.
    // Fade only: cards don't slide.
    const cards = [...document.querySelectorAll('.product-grid > .product-grid__item')].filter(belowFold);
    if (cards.length) {
      gsap.set(cards, { opacity: 0 });
      revealed.push(...cards);
      ScrollTrigger.batch(cards, {
        start: 'top 92%',
        once: true,
        onEnter: (batch) => gsap.to(batch, { opacity: 1, duration: 0.6, ease: 'power1.out', overwrite: true, clearProps: 'opacity', stagger: 0.06 }),
      });
    }

    groups.forEach((group) => {
      const children = [...group.children];
      if (!children.length) return;
      gsap.set(children, from);
      revealed.push(...children);
      ScrollTrigger.create({
        trigger: group,
        start: 'top 90%',
        once: true,
        onEnter: () => gsap.to(children, { ...to, stagger: 0.06 }),
      });
    });

    // Footer: scrubbed to the scroll. As the footer comes up from the bottom of the screen,
    // the panel slides down from under the page's curved edge (the footer clips it) and its
    // contents fade in; it's fully in place when the page reaches its end, and runs backwards
    // on the way up. Parallax: the content lags behind the panel, and the wordmark rises from
    // below, each by a different amount. Tabbing into it drops the scrub and shows it at once.
    document.querySelectorAll('[data-pb-footer]').forEach((footer) => {
      const panel = footer.querySelector('.pb-footer__panel');
      if (!panel || !belowFold(footer)) return;
      const items = [...panel.children];
      const layers = [
        [panel.querySelector('.pb-footer__top'), { y: 90 }],
        [panel.querySelector('.pb-footer__bottom'), { y: 50 }],
        [panel.querySelector('.pb-footer__marquee'), { yPercent: 45 }],
      ].filter(([el]) => el);
      revealed.push(panel, ...items);

      const timeline = gsap
        .timeline({
          scrollTrigger: { trigger: footer, start: 'top bottom', end: 'bottom bottom', scrub: true },
        })
        .fromTo(panel, { yPercent: -55 }, { yPercent: 0, ease: 'none', duration: 1 }, 0)
        .fromTo(items, { opacity: 0 }, { opacity: 1, ease: 'none', duration: 0.3, stagger: 0.1 }, 0.1);
      layers.forEach(([el, from]) => {
        timeline.fromTo(el, from, { y: 0, yPercent: 0, ease: 'none', duration: 1 }, 0);
      });

      footer.addEventListener(
        'focusin',
        () => {
          timeline.scrollTrigger.kill();
          timeline.kill();
          gsap.to(panel, { yPercent: 0, duration: 0.3, clearProps: 'transform' });
          gsap.to(items, { opacity: 1, y: 0, yPercent: 0, duration: 0.3, clearProps: 'transform,opacity' });
        },
        { once: true }
      );
    });

    // Tabbing into content that hasn't revealed yet shows it straight away.
    document.addEventListener('focusin', (event) => {
      const target = revealed.find((el) => el.contains(event.target) && gsap.getProperty(el, 'opacity') < 1);
      if (target) gsap.to(target, { ...to, duration: 0.2 });
    });

    // Fonts and lazy images change page height after load; re-measure once.
    window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });

    // The scroller changes at 990px. Rather than rebuild, show whatever hasn't revealed yet.
    squeeze.addEventListener('change', showAll, { once: true });
  }

  /* Reduced motion switched on mid-visit: stop everything, show everything. */
  reducedMotion.addEventListener(
    'change',
    () => {
      if (!reducedMotion.matches) return;
      squeeze.removeEventListener('change', startLenis);
      lenis?.destroy();
      lenis = null;
      showAll();
    },
    { once: true }
  );
})();
