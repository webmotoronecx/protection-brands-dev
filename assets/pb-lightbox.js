/*
  Protection Brands product lightbox. Loaded on product pages by snippets/pb-head.liquid.

  Clicking a photo in the product gallery opens a full-screen slider of the gallery's photos
  (read from the page when it opens, so the order always matches the gallery, including
  after a variant change): one photo at a time, previous/next arrows, swipe (CSS scroll
  snap), arrow keys, an "n / total" counter and a thumbnail strip. Closes with the close
  button, Esc, or a click on the empty space around the photo.

  Horizon's own zoom is switched off on the gallery (templates/product.json, zoom: false).
  A native <dialog> (focus trap, Esc); html[scroll-lock] while open, which Horizon and the
  smooth scroll (pb-motion.js) already respect.
*/

const GALLERY_ITEM = '.product-information media-gallery :is(slideshow-slide, .media-gallery__grid > li)';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const ICONS = {
  close:
    '<svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/></svg>',
  prev: '<svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3.5 5.5 8l4.5 4.5"/></svg>',
  next: '<svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5 10.5 8 6 12.5"/></svg>',
};

class Lightbox {
  index = 0;
  count = 0;
  #frame = 0;
  #target = null; // slide being scrolled to by an arrow, key or thumbnail

  constructor() {
    const dialog = document.createElement('dialog');
    dialog.className = 'pb-lightbox';
    dialog.setAttribute('aria-label', 'Product images');
    dialog.setAttribute('data-lenis-prevent', '');
    dialog.tabIndex = -1;
    dialog.innerHTML = `
      <div class="pb-lightbox__top">
        <span class="pb-lightbox__count" aria-live="polite"></span>
        <button type="button" class="pb-lightbox__close" aria-label="Close">${ICONS.close}</button>
      </div>
      <div class="pb-lightbox__stage">
        <button type="button" class="pb-lightbox__arrow pb-lightbox__arrow--prev" aria-label="Previous image">${ICONS.prev}</button>
        <ul class="pb-lightbox__track"></ul>
        <button type="button" class="pb-lightbox__arrow pb-lightbox__arrow--next" aria-label="Next image">${ICONS.next}</button>
      </div>
      <ul class="pb-lightbox__thumbs"></ul>`;
    document.body.append(dialog);

    this.dialog = dialog;
    this.track = dialog.querySelector('.pb-lightbox__track');
    this.thumbs = dialog.querySelector('.pb-lightbox__thumbs');
    this.counter = dialog.querySelector('.pb-lightbox__count');
    this.prev = dialog.querySelector('.pb-lightbox__arrow--prev');
    this.next = dialog.querySelector('.pb-lightbox__arrow--next');

    dialog.querySelector('.pb-lightbox__close').addEventListener('click', () => dialog.close());
    this.prev.addEventListener('click', () => this.goTo(this.index - 1));
    this.next.addEventListener('click', () => this.goTo(this.index + 1));
    this.thumbs.addEventListener('click', (event) => {
      const thumb = event.target.closest('[data-index]');
      if (thumb) this.goTo(Number(thumb.dataset.index));
    });
    // A click on the empty space around the photo closes.
    this.track.addEventListener('click', (event) => {
      if (event.target === this.track || event.target.classList.contains('pb-lightbox__slide')) dialog.close();
    });
    this.track.addEventListener('pointerdown', () => (this.#target = null));
    this.track.addEventListener('scrollend', () => {
      this.#target = null;
      this.#sync();
    });
    this.track.addEventListener('scroll', () => {
      cancelAnimationFrame(this.#frame);
      this.#frame = requestAnimationFrame(() => this.#sync());
    });
    // Keys on the document while open: focus can leave the arrows when one is disabled.
    document.addEventListener('keydown', (event) => {
      if (!dialog.open) return;
      if (event.key === 'ArrowLeft') this.goTo(this.index - 1);
      if (event.key === 'ArrowRight') this.goTo(this.index + 1);
    });
    dialog.addEventListener('close', () => document.documentElement.removeAttribute('scroll-lock'));
  }

  open(images, start) {
    this.count = images.length;
    this.track.replaceChildren(
      ...images.map((image, index) => {
        const slide = document.createElement('li');
        slide.className = 'pb-lightbox__slide';
        const photo = document.createElement('img');
        if (image.srcset) photo.srcset = image.srcset;
        photo.sizes = '100vw';
        photo.src = image.src;
        photo.alt = image.alt;
        photo.loading = Math.abs(index - start) <= 1 ? 'eager' : 'lazy';
        slide.append(photo);
        return slide;
      })
    );
    this.thumbs.replaceChildren(
      ...images.map((image, index) => {
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'pb-lightbox__thumb';
        button.dataset.index = String(index);
        button.setAttribute('aria-label', `Image ${index + 1} of ${images.length}`);
        const photo = document.createElement('img');
        photo.src = image.thumb;
        photo.alt = '';
        button.append(photo);
        item.append(button);
        return item;
      })
    );
    this.dialog.classList.toggle('pb-lightbox--single', images.length < 2);

    document.documentElement.setAttribute('scroll-lock', '');
    this.dialog.showModal();
    // Focus the lightbox, not the close button, so no focus ring shows after a click.
    this.dialog.focus();
    requestAnimationFrame(() => this.goTo(start, true));
  }

  goTo(index, instant = false) {
    const target = Math.min(Math.max(index, 0), this.count - 1);
    this.#target = instant ? null : target;
    this.track.scrollTo({
      left: target * this.track.clientWidth,
      behavior: instant || reducedMotion.matches ? 'instant' : 'smooth',
    });
    this.#set(target);
  }

  /* Follows swipes. While an arrow/key/thumbnail scroll is still moving, the in-between
     position is ignored (otherwise quick presses would read it and go the wrong way). */
  #sync() {
    const width = this.track.clientWidth;
    if (!width) return;
    const position = Math.round(this.track.scrollLeft / width);
    if (this.#target !== null) {
      if (Math.abs(this.track.scrollLeft - this.#target * width) < 2) this.#target = null;
      return;
    }
    this.#set(position);
  }

  #set(index) {
    this.index = index;
    this.counter.textContent = `${index + 1} / ${this.count}`;
    // Keep focus in the lightbox when the focused arrow becomes disabled.
    const focused = document.activeElement;
    this.prev.disabled = index <= 0;
    this.next.disabled = index >= this.count - 1;
    if (focused?.disabled) (focused === this.next ? this.prev : this.next).focus();
    for (const thumb of this.thumbs.querySelectorAll('[data-index]')) {
      const current = Number(thumb.dataset.index) === index;
      thumb.toggleAttribute('aria-current', current);
      if (current) thumb.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }
}

let lightbox;

/* Photos of the gallery the clicked item belongs to, in page order (images only; videos
   and 3D models keep their own controls). */
function galleryImages(item) {
  const gallery = item.closest('media-gallery');
  const items = [...gallery.querySelectorAll(':is(slideshow-slide, .media-gallery__grid > li)')].filter(
    (element) => element.querySelector('img') && !element.querySelector('video, iframe, model-viewer, deferred-media')
  );
  const images = items.map((element) => {
    const img = element.querySelector('img');
    return { src: img.currentSrc || img.src, srcset: img.getAttribute('srcset'), alt: img.alt, thumb: img.currentSrc || img.src };
  });
  return { images, index: Math.max(items.indexOf(item), 0) };
}

document.addEventListener('click', (event) => {
  const item = event.target.closest(GALLERY_ITEM);
  if (!item || event.target.closest('button, a, video, model-viewer, deferred-media')) return;
  if (!item.querySelector('img')) return;
  const { images, index } = galleryImages(item);
  if (!images.length) return;
  lightbox ??= new Lightbox();
  lightbox.open(images, index);
});
