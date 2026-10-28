/*
  Protection Brands floating menu: <pb-menu>, rendered by sections/pb-landing-header.liquid.

  A native <dialog> opened with showModal(), so the browser handles focus trapping, Esc and
  making the page behind inert. Opens from any button with [data-pb-menu-toggle]; closes from
  [data-pb-menu-close], Esc, or a click outside the panel. It also opens by itself when it
  contains [data-pb-menu-open-on-load] (the newsletter form's thank-you or error).

  The panel slides and fades in (transform and opacity only). While it is open,
  html[data-pb-menu-open] is set, which locks page scrolling and pauses the 3D hero, and a
  'pb:menu' event is fired on document with { open }.
*/

const DURATION = 350; // keep in step with the CSS transition

class PBMenu extends HTMLElement {
  #abort = new AbortController();
  #closing;

  get dialog() {
    return this.querySelector('dialog');
  }

  connectedCallback() {
    const { signal } = this.#abort;
    const dialog = this.dialog;
    if (!dialog) return;

    document.addEventListener(
      'click',
      (event) => {
        if (event.target.closest('[data-pb-menu-toggle]')) this.toggle();
        // Header search icon: open Horizon's search dialog, closing the menu first if open.
        if (event.target.closest('[data-pb-search-open]')) {
          if (this.dialog.open) this.close();
          document.getElementById('search-modal')?.showDialog?.();
        }
      },
      { signal }
    );

    dialog.addEventListener(
      'click',
      (event) => {
        if (event.target.closest('[data-pb-menu-close]')) return this.close();
        // Clicks on the ::backdrop land on the dialog itself, outside its box.
        if (event.target !== dialog) return;
        const box = dialog.getBoundingClientRect();
        const inside =
          event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
        if (!inside) this.close();
      },
      { signal }
    );

    // After the newsletter form posts, the page reloads; reopen to show the result.
    if (dialog.querySelector('[data-pb-menu-open-on-load]')) this.open();

    // Esc: animate out instead of the browser's instant close.
    dialog.addEventListener(
      'cancel',
      (event) => {
        event.preventDefault();
        this.close();
      },
      { signal }
    );
  }

  disconnectedCallback() {
    this.#abort.abort();
    this.#setOpen(false);
  }

  toggle() {
    if (this.dialog.open && !this.#closing) this.close();
    else this.open();
  }

  open() {
    const dialog = this.dialog;
    clearTimeout(this.#closing);
    this.#closing = undefined;
    if (!dialog.open) {
      dialog.showModal();
      // Focus the panel, not the close button, so no focus ring shows after a mouse click.
      dialog.focus();
    }
    // Next frame, so the closed styles apply first and the transition runs.
    requestAnimationFrame(() => dialog.classList.add('is-open'));
    this.#setOpen(true);
  }

  close() {
    const dialog = this.dialog;
    if (!dialog.open || this.#closing) return;
    dialog.classList.remove('is-open');
    const instant = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.#closing = setTimeout(
      () => {
        this.#closing = undefined;
        dialog.close();
        this.#setOpen(false);
      },
      instant ? 0 : DURATION
    );
  }

  #setOpen(open) {
    document.documentElement.toggleAttribute('data-pb-menu-open', open);
    for (const button of document.querySelectorAll('[data-pb-menu-toggle]')) {
      button.setAttribute('aria-expanded', String(open));
    }
    document.dispatchEvent(new CustomEvent('pb:menu', { detail: { open } }));
  }
}

if (!customElements.get('pb-menu')) customElements.define('pb-menu', PBMenu);
