/*
  <pb-header-watch>, placed inside the light PB header (sections/pb-landing-header.liquid).
  Adds .is-scrolled to the header once the page has scrolled, which shrinks it to the compact
  white bar.

  Uses Horizon's own sticky-header technique: the header section sticks at top: -1px, so as
  soon as the page scrolls it is 1px out of view and an IntersectionObserver with threshold 1
  reports it. No scroll listener. The observer root follows Horizon's scroll container
  (.page-wrapper at 990px and up, the viewport below).
*/

import { getIntersectionRoot, scrollContainerMediaQuery } from '@theme/scroll-container';

class PBHeaderWatch extends HTMLElement {
  #observer;
  #onChange = () => this.#observe();

  connectedCallback() {
    this.#observe();
    scrollContainerMediaQuery.addEventListener('change', this.#onChange);
  }

  disconnectedCallback() {
    this.#observer?.disconnect();
    scrollContainerMediaQuery.removeEventListener('change', this.#onChange);
  }

  #observe() {
    const header = this.closest('.pb-landing-header');
    const section = header?.parentElement;
    if (!header || !section) return;

    this.#observer?.disconnect();
    this.#observer = new IntersectionObserver(
      ([entry]) => header.classList.toggle('is-scrolled', entry.intersectionRatio < 1),
      { root: getIntersectionRoot(), threshold: 1 }
    );
    this.#observer.observe(section);
  }
}

if (!customElements.get('pb-header-watch')) customElements.define('pb-header-watch', PBHeaderWatch);

/*
  <pb-hero-watch>, placed inside the dark homepage header. Adds .is-past-hero to the header
  once the page has scrolled about 100px; the header then shows as the compact white bar with
  a dark logo (sections/pb-landing-header.liquid). The change is made out of sight: the header
  slides up (.is-hidden), switches, then slides back down. Straight away with reduced motion
  or when the page loads already scrolled.

  A 100px tall, empty sentinel is put at the top of the page content (a negative margin cancels
  its height, so nothing moves) and one IntersectionObserver reports when it has scrolled out
  of view. No scroll listener. The observer root follows Horizon's scroll container.
*/
const SCROLL_OFFSET = 100;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

class PBHeroWatch extends HTMLElement {
  #observer;
  #sentinel;
  #header;
  #past;
  #hiding = false;
  #onChange = () => this.#observe();

  connectedCallback() {
    this.#observe();
    scrollContainerMediaQuery.addEventListener('change', this.#onChange);
  }

  disconnectedCallback() {
    this.#observer?.disconnect();
    this.#sentinel?.remove();
    this.#sentinel = undefined;
    this.#header?.classList.remove('is-hidden');
    scrollContainerMediaQuery.removeEventListener('change', this.#onChange);
    this.closest('.pb-landing-header')?.classList.remove('is-past-hero');
  }

  #observe() {
    const header = this.closest('.pb-landing-header');
    const main = document.getElementById('MainContent');
    if (!header || !main) return;

    if (!this.#sentinel) {
      this.#sentinel = document.createElement('div');
      this.#sentinel.setAttribute('aria-hidden', 'true');
      this.#sentinel.style.cssText = `height:${SCROLL_OFFSET}px;margin-block-end:-${SCROLL_OFFSET}px;pointer-events:none`;
      main.prepend(this.#sentinel);
    }

    this.#observer?.disconnect();
    this.#header = header;
    this.#observer = new IntersectionObserver(([entry]) => this.#set(!entry.isIntersecting), {
      root: getIntersectionRoot(),
    });
    this.#observer.observe(this.#sentinel);
  }

  /** @param {boolean} past */
  #set(past) {
    const header = this.#header;
    const first = this.#past === undefined;
    this.#past = past;
    if (!header || this.#hiding) return; // the slide already under way picks up the latest

    if (first || reducedMotion.matches) {
      header.classList.toggle('is-past-hero', past);
      return;
    }
    if (header.classList.contains('is-past-hero') === past) return;

    // Slide up, switch while out of sight, slide back down.
    this.#hiding = true;
    header.classList.add('is-hidden');
    const swap = () => {
      if (!this.#hiding) return;
      this.#hiding = false;
      header.removeEventListener('transitionend', onEnd);
      header.classList.toggle('is-past-hero', this.#past);
      header.getBoundingClientRect(); // apply the switch before sliding back
      header.classList.remove('is-hidden');
    };
    const onEnd = (/** @type {TransitionEvent} */ event) => {
      if (event.target === header && event.propertyName === 'translate') swap();
    };
    header.addEventListener('transitionend', onEnd);
    setTimeout(swap, 800); // in case transitionend never fires
  }
}

if (!customElements.get('pb-hero-watch')) customElements.define('pb-hero-watch', PBHeroWatch);

/*
  <pb-cart-count>, the red count on the header's cart icon. Server-rendered, then kept up to
  date from Shopify's cart event (as Horizon's own cart icon, assets/cart-icon.js), since with
  the cart drawer items are added without a page load. The cart icon's label follows it.
  The event name is imported on demand, so the header's scroll watchers above don't depend
  on Shopify's events script loading.
*/
class PBCartCount extends HTMLElement {
  /** @type {string | undefined} */
  #eventName;

  async connectedCallback() {
    const { StandardEvents } = await import('@shopify/events');
    if (!this.isConnected) return;
    this.#eventName = StandardEvents.cartLinesUpdate;
    document.addEventListener(this.#eventName, this.#onCartUpdate);
  }

  disconnectedCallback() {
    if (this.#eventName) document.removeEventListener(this.#eventName, this.#onCartUpdate);
  }

  #onCartUpdate = (event) => {
    event.promise
      ?.then(({ cart, detail }) => this.#render(cart?.totalQuantity ?? detail?.itemCount ?? 0))
      .catch((error) => {
        if (error?.name !== 'AbortError') console.warn('[pb-cart-count] Cart update failed:', error);
      });
  };

  /** @param {number} count */
  #render(count) {
    this.textContent = count > 99 ? '99+' : String(count);
    this.hidden = count === 0;
    this.closest('.pb-landing-header__cart')?.setAttribute(
      'aria-label',
      `Cart, ${count} ${count === 1 ? 'item' : 'items'}`
    );
  }
}

if (!customElements.get('pb-cart-count')) customElements.define('pb-cart-count', PBCartCount);

/*
  From 990px the floating cart drawer dims the page behind it (#cart-drawer::before,
  assets/pb-cart.css). A click on the dimmed page lands on the <theme-drawer> itself and
  closes the cart, as the backdrop does below 990px.
*/
document.addEventListener('click', (event) => {
  const drawer = event.target;
  if (drawer instanceof HTMLElement && drawer.id === 'cart-drawer' && drawer.hasAttribute('open')) {
    /** @type {HTMLElement & { close?: () => void }} */ (drawer).close?.();
  }
});
