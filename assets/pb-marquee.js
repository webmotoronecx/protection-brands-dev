/*
  <pb-marquee>, rendered by snippets/pb-marquee.liquid: pauses the scrolling wordmark while it
  is off screen, so it costs nothing until it is seen. The scrolling itself is a CSS animation.

  With [data-follow-mouse] it also drifts slightly against the mouse (transform only). The
  frame loop runs only while it is still easing towards the mouse, and only on screen. Off
  for touch screens and reduced motion.
*/

const SHIFT_X = 40; // px at the screen edge
const SHIFT_Y = 12;

class PBMarquee extends HTMLElement {
  #observer;
  #abort = new AbortController();
  #frame = 0;
  #target = { x: 0, y: 0 };
  #current = { x: 0, y: 0 };

  connectedCallback() {
    this.#observer = new IntersectionObserver(([entry]) => {
      this.classList.toggle('is-paused', !entry.isIntersecting);
    });
    this.#observer.observe(this);

    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (this.hasAttribute('data-follow-mouse') && finePointer && !reducedMotion) {
      window.addEventListener('pointermove', this.#onPointerMove, { passive: true, signal: this.#abort.signal });
    }
  }

  disconnectedCallback() {
    this.#observer?.disconnect();
    this.#abort.abort();
    cancelAnimationFrame(this.#frame);
  }

  #onPointerMove = (event) => {
    this.#target.x = -((event.clientX / window.innerWidth) * 2 - 1) * SHIFT_X;
    this.#target.y = -((event.clientY / window.innerHeight) * 2 - 1) * SHIFT_Y;
    if (!this.#frame && !this.classList.contains('is-paused')) this.#frame = requestAnimationFrame(this.#step);
  };

  #step = () => {
    const current = this.#current;
    const target = this.#target;
    current.x += (target.x - current.x) * 0.08;
    current.y += (target.y - current.y) * 0.08;
    this.style.transform = `translate3d(${current.x.toFixed(1)}px, ${current.y.toFixed(1)}px, 0)`;

    const settled = Math.abs(target.x - current.x) < 0.1 && Math.abs(target.y - current.y) < 0.1;
    this.#frame = settled || this.classList.contains('is-paused') ? 0 : requestAnimationFrame(this.#step);
  };
}

if (!customElements.get('pb-marquee')) customElements.define('pb-marquee', PBMarquee);
