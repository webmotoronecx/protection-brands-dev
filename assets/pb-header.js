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
