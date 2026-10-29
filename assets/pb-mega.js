/*
  Protection Brands mega menu: <pb-mega>, inside the PB header (sections/pb-landing-header.liquid),
  holding the panels (blocks/_pb-mega-panel.liquid). Desktop only (990px and up); smaller
  screens use the floating menu (assets/pb-menu.js).

  A header link with [data-pb-mega-trigger] opens the panel named by its aria-controls:
  - Mouse: on hover, after a short delay so passing over a link does not open it. Moving to
    another trigger switches panels; leaving the header, or hovering the logo, the icons or a
    plain link, closes it after a short delay.
  - Keyboard: focusing a trigger opens its panel, Tab moves into it, Esc closes it and returns
    focus to the trigger, and focus leaving the header closes it.
  - Click or tap: a button trigger opens its panel (Enter and taps toggle it); a link trigger
    opens it on the first tap by touch, and follows the link otherwise.
  - Theme editor: selecting a panel or one of its highlights opens that panel.

  While open, .is-mega-open is on the header (which turns the dark header's text dark) and
  .is-open on <pb-mega>; closed panels are inert. A 'pb:mega' event is fired on document with
  { open }.
*/

const OPEN_DELAY = 80;
const SWITCH_DELAY = 60;
const CLOSE_DELAY = 200;
const desktop = window.matchMedia('(min-width: 990px)');

class PBMega extends HTMLElement {
  #abort = new AbortController();
  #timer;
  #panel;
  #trigger;
  #pointerType = 'mouse';

  get header() {
    return this.closest('.pb-landing-header');
  }

  connectedCallback() {
    const { signal } = this.#abort;
    const header = this.header;
    if (!header) return;
    this.#wire(header);

    header.addEventListener('pointerdown', (event) => (this.#pointerType = event.pointerType), { signal });

    header.addEventListener(
      'pointerover',
      (event) => {
        if (event.pointerType === 'touch' || !desktop.matches) return;
        const trigger = event.target.closest('[data-pb-mega-trigger]');
        if (trigger) {
          if (trigger === this.#trigger && this.#panel) return this.#cancel();
          return this.#later(() => this.open(trigger), this.#panel ? SWITCH_DELAY : OPEN_DELAY);
        }
        // The sheet and the bar's empty space keep it open; anything else in the bar closes it.
        if (this.contains(event.target) || event.target === header) return this.#cancel();
        if (this.#panel) this.#later(() => this.close(), CLOSE_DELAY);
        else this.#cancel();
      },
      { signal }
    );

    header.addEventListener(
      'pointerleave',
      (event) => {
        if (event.pointerType === 'touch') return;
        if (this.#panel) this.#later(() => this.close(), CLOSE_DELAY);
        else this.#cancel();
      },
      { signal }
    );

    header.addEventListener(
      'click',
      (event) => {
        const trigger = event.target.closest('[data-pb-mega-trigger]');
        if (!trigger || !desktop.matches) return;
        if (trigger.tagName === 'BUTTON') {
          // A mouse click lands on a panel hover has usually just opened: keep it open.
          // Keyboard (detail 0) and touch toggle.
          const toggles = event.detail === 0 || this.#pointerType === 'touch';
          if (toggles && this.#trigger === trigger) this.close();
          else this.open(trigger);
        } else if (this.#pointerType === 'touch' && this.#trigger !== trigger) {
          event.preventDefault();
          this.open(trigger);
        }
      },
      { signal }
    );

    header.addEventListener(
      'focusin',
      (event) => {
        if (!desktop.matches) return;
        const trigger = event.target.closest('[data-pb-mega-trigger]');
        if (trigger && trigger.matches(':focus-visible')) this.open(trigger);
      },
      { signal }
    );

    header.addEventListener(
      'focusout',
      (event) => {
        if (this.#panel && !header.contains(event.relatedTarget)) this.close();
      },
      { signal }
    );

    header.addEventListener(
      'keydown',
      (event) => {
        if (!this.#panel) return;
        if (event.key === 'Escape') {
          const trigger = this.#trigger;
          this.close();
          trigger?.focus();
        } else if (event.key === 'Tab') {
          this.#tab(event);
        }
      },
      { signal }
    );

    // The floating menu or the search dialog opening closes the mega menu.
    document.addEventListener('pb:menu', (event) => event.detail.open && this.close(), { signal });
    document.addEventListener(
      'click',
      (event) => event.target.closest('[data-pb-search-open]') && this.close(),
      { signal }
    );
    desktop.addEventListener('change', () => this.close(), { signal });

    document.addEventListener(
      'shopify:block:select',
      (event) => {
        const panel = event.target.closest?.('[data-pb-mega-panel]');
        if (!panel || !this.contains(panel)) return;
        this.#cancel();
        this.#show(panel, header.querySelector(`[aria-controls="${panel.id}"]`));
      },
      { signal }
    );
    document.addEventListener(
      'shopify:block:deselect',
      (event) => this.contains(event.target) && this.close(),
      { signal }
    );
  }

  disconnectedCallback() {
    this.#abort.abort();
    this.#cancel();
    this.header?.classList.remove('is-mega-open');
  }

  open(trigger) {
    this.#cancel();
    const panel = document.getElementById(trigger.getAttribute('aria-controls'));
    if (panel && this.contains(panel)) this.#show(panel, trigger);
  }

  close() {
    this.#cancel();
    if (!this.#panel) return;
    this.#panel.classList.remove('is-active');
    this.#panel.inert = true;
    this.#trigger?.setAttribute('aria-expanded', 'false');
    this.#panel = undefined;
    this.#trigger = undefined;
    this.classList.remove('is-open');
    this.header?.classList.remove('is-mega-open');
    document.dispatchEvent(new CustomEvent('pb:mega', { detail: { open: false } }));
  }

  #show(panel, trigger) {
    const wasOpen = Boolean(this.#panel);
    if (this.#panel && this.#panel !== panel) {
      this.#panel.classList.remove('is-active');
      this.#panel.inert = true;
      this.#trigger?.setAttribute('aria-expanded', 'false');
    }
    this.#panel = panel;
    this.#trigger = trigger ?? undefined;
    panel.inert = false;
    panel.classList.add('is-active');
    trigger?.setAttribute('aria-expanded', 'true');
    this.classList.add('is-open');
    this.header?.classList.add('is-mega-open');
    if (!wasOpen) document.dispatchEvent(new CustomEvent('pb:mega', { detail: { open: true } }));
  }

  /* The panels come last in the header, so Tab is steered to read them in place: from the
     open trigger into its panel, out of the panel's end to the header link after the trigger,
     and Shift+Tab from the panel's start back to the trigger. */
  #tab(event) {
    const trigger = this.#trigger;
    if (!trigger) return;
    // Visible only: a third highlight is in the panel but not shown.
    const items = [...this.#panel.querySelectorAll('a[href], button')].filter((item) => item.checkVisibility());
    if (!items.length) return;
    const active = document.activeElement;
    let target;
    if (active === trigger && !event.shiftKey) target = items[0];
    else if (active === items[0] && event.shiftKey) target = trigger;
    else if (active === items.at(-1) && !event.shiftKey) {
      target = trigger.closest('li')?.nextElementSibling?.querySelector('a, button');
      if (!target) this.close();
    }
    if (!target) return;
    event.preventDefault();
    target.focus();
  }

  /* Turns each header link whose text matches a panel's Header link (data-label, ignoring case)
     into its trigger. Done here because the section can't read its theme blocks' settings.
     Shop By Category stops opening the floating menu once it has a panel. */
  #wire(header) {
    const panels = new Map();
    for (const panel of this.querySelectorAll('[data-pb-mega-panel]')) {
      if (panel.dataset.label && !panels.has(panel.dataset.label)) panels.set(panel.dataset.label, panel);
    }
    for (const link of header.querySelectorAll('.pb-landing-header__link')) {
      const panel = panels.get(link.textContent.trim().toLowerCase());
      if (!panel) continue;
      link.removeAttribute('data-pb-menu-toggle');
      link.removeAttribute('aria-haspopup');
      link.setAttribute('aria-controls', panel.id);
      link.setAttribute('aria-expanded', 'false');
      link.setAttribute('data-pb-mega-trigger', '');
    }
  }

  #later(callback, delay) {
    clearTimeout(this.#timer);
    this.#timer = setTimeout(callback, delay);
  }

  #cancel() {
    clearTimeout(this.#timer);
    this.#timer = undefined;
  }
}

if (!customElements.get('pb-mega')) customElements.define('pb-mega', PBMega);
