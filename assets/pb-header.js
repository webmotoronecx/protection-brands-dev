/*
  <pb-header-watch>, placed inside the light PB header (sections/pb-landing-header.liquid).
  Adds .is-scrolled to the header once the page has scrolled, which switches it to a
  see-through, blurred background.

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
  while the light page sections are under it: from when the first section below the hero
  slides up under the header until the dark footer reaches it. The header then shows as the
  compact frosted bar with a dark logo (sections/pb-landing-header.liquid).

  One IntersectionObserver on a strip along the top 10% of the screen (about the header's
  height), watching that first section and the footer; no scroll listener. Each crossing says
  whether the element's top is above the strip's bottom.
*/
class PBHeroWatch extends HTMLElement {
  #observer;
  #onChange = () => this.#observe();

  connectedCallback() {
    this.#observe();
    scrollContainerMediaQuery.addEventListener('change', this.#onChange);
  }

  disconnectedCallback() {
    this.#observer?.disconnect();
    scrollContainerMediaQuery.removeEventListener('change', this.#onChange);
    this.closest('.pb-landing-header')?.classList.remove('is-past-hero');
  }

  #observe() {
    const header = this.closest('.pb-landing-header');
    const hero = document.querySelector('.pb-hero-bottle-section');
    if (!header || !hero) return;

    // The first section after the hero that shows anything (empty sections render no height).
    let cover = hero.nextElementSibling;
    while (cover && cover.offsetHeight === 0) cover = cover.nextElementSibling;
    const footer = document.querySelector('.page-wrapper > footer');
    if (!cover) return;

    const above = new Map();
    this.#observer?.disconnect();
    this.#observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          above.set(entry.target, entry.boundingClientRect.top < entry.rootBounds.bottom);
        }
        header.classList.toggle('is-past-hero', above.get(cover) === true && above.get(footer) !== true);
      },
      { root: getIntersectionRoot(), rootMargin: '0px 0px -90% 0px' }
    );
    this.#observer.observe(cover);
    if (footer) this.#observer.observe(footer);
  }
}

if (!customElements.get('pb-hero-watch')) customElements.define('pb-hero-watch', PBHeroWatch);
