/*
  Protection Brands sort menu: <pb-sort-menu> around a <details> (snippets/pb-sort-menu.liquid).
  The <details> opens and closes it on its own; this closes it on Esc (returning focus to the
  toggle), on a click outside, and when focus leaves it.
*/

class PBSortMenu extends HTMLElement {
  #abort = new AbortController();

  connectedCallback() {
    const details = this.querySelector('details');
    if (!details) return;
    const { signal } = this.#abort;
    const close = () => (details.open = false);

    document.addEventListener(
      'click',
      (event) => details.open && !this.contains(event.target) && close(),
      { signal }
    );
    this.addEventListener(
      'keydown',
      (event) => {
        if (event.key !== 'Escape' || !details.open) return;
        close();
        details.querySelector('summary')?.focus();
      },
      { signal }
    );
    this.addEventListener(
      'focusout',
      (event) => event.relatedTarget && !this.contains(event.relatedTarget) && close(),
      { signal }
    );
  }

  disconnectedCallback() {
    this.#abort.abort();
    this.#abort = new AbortController();
  }
}

if (!customElements.get('pb-sort-menu')) customElements.define('pb-sort-menu', PBSortMenu);
