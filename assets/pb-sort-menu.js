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

/*
  Sorting keeps the filters: the options are plain ?sort_by= links (they work without
  JavaScript), but filters applied in place change the address without rebuilding them, so a
  chosen option is applied to the current address instead, back to page 1.
*/
document.addEventListener('click', (event) => {
  const option = event.target.closest?.('.pb-sort-menu__option');
  if (!option || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey) return;
  const sortBy = new URL(option.href).searchParams.get('sort_by');
  if (!sortBy) return;
  event.preventDefault();
  const url = new URL(window.location.href);
  url.searchParams.set('sort_by', sortBy);
  url.searchParams.delete('page');
  window.location.assign(url);
});

/*
  Link pills (snippets/pb-facet-pills.liquid: the sort pills, and "In stock" on phones): each
  sets one parameter on the current address, keeping the filters and the rest; tapping a pill
  that's already on takes it off (for sort, back to the default order). Back to page 1.
*/
document.addEventListener('click', (event) => {
  const pill = event.target.closest?.('a.pb-pill[data-pb-param]');
  if (!pill || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey) return;
  event.preventDefault();
  const url = new URL(window.location.href);
  const { pbParam: param, pbValue: value } = pill.dataset;
  if (pill.hasAttribute('aria-current')) url.searchParams.delete(param);
  else url.searchParams.set(param, value);
  url.searchParams.delete('page');
  window.location.assign(url);
});

/*
  The "In stock" pill (snippets/pb-facet-pills.liquid), inside Horizon's filters form: applies
  as soon as it's clicked, through Horizon's own update (assets/facets.js), so the results
  change in place.
*/
const applyFilters = (input) => {
  const form = input.closest('facets-form-component');
  if (form && typeof form.updateFilters === 'function') form.updateFilters();
};
document.addEventListener('change', (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || !input.closest('.pb-facet-pills')) return;
  applyFilters(input);
});

/*
  Phones: the products bar's count (sections/pb-products-bar.liquid) follows the filters. The
  filter block's count heading (blocks/filters.liquid) is re-rendered with each change; its
  text is copied across. Text only, so nothing moves.
*/
const syncCount = () => {
  const source = document.querySelector('.pb-facets-count');
  const target = document.querySelector('.pb-products-bar__count');
  if (!source || !target) return;
  const text = source.textContent.replace(/\s+/g, ' ').trim();
  if (text && target.textContent.replace(/\s+/g, ' ').trim() !== text) target.textContent = text;
};
const main = document.querySelector('main');
if (main && document.querySelector('.pb-products-bar__count')) {
  syncCount();
  new MutationObserver(syncCount).observe(main, { childList: true, subtree: true });
}
