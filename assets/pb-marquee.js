/*
  <pb-marquee>, rendered by snippets/pb-marquee.liquid: pauses the scrolling wordmark while it
  is off screen, so it costs nothing until it is seen. The scrolling itself is a CSS animation.
*/

class PBMarquee extends HTMLElement {
  #observer;

  connectedCallback() {
    this.#observer = new IntersectionObserver(([entry]) => {
      this.classList.toggle('is-paused', !entry.isIntersecting);
    });
    this.#observer.observe(this);
  }

  disconnectedCallback() {
    this.#observer?.disconnect();
  }
}

if (!customElements.get('pb-marquee')) customElements.define('pb-marquee', PBMarquee);
