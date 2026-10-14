# Shop by category tiles and brand logo row: design

Date: 14 Oct 2026. Status: approved in chat, awaiting spec review.

## Goal

Two reusable theme-editor sections, modelled on Supercheap Auto's Car Care page:
- a grid of photo tiles linking to category collections, and
- a row of brand logos linking to brand pages.

They can go on any page. The first use is the home page, under the bottle hero. Later they will also go on category landing pages and brand pages.

**Success criteria:** a merchandiser can add, reorder and edit tiles and logos in the theme editor without code. Tiles fill themselves from the chosen collection. The home page shows both at desktop, tablet and phone widths.

## Decisions

| Question | Decision |
|---|---|
| Where | Two separate sections, usable on any template |
| Tile content | A collection picker per tile; optional image or label replaces the collection's own |
| Logo row | Static row that wraps; no scrolling |
| Logo files | Uploaded to the store by the user; the theme only references them |
| Build | New `pb-*` sections, with no edits to Horizon's stock sections, so upstream merges stay clean |

## Section 1: `sections/pb-category-tiles.liquid`

**Settings**

| id | type | default | notes |
|---|---|---|---|
| `heading` | text | `Shop by category` | Hidden if blank |
| `columns` | select `3` / `4` | `4` | Desktop column count |
| `ratio` | select `square` / `landscape` (4:3) / `portrait` (3:4) | `square` | |
| `color_scheme` | color_scheme | `scheme-1` | |

**Blocks:** `tile`, up to 12.

| id | type | notes |
|---|---|---|
| `collection` | collection | Link, image and title come from here |
| `image` | image_picker | Optional; replaces `collection.featured_image` |
| `label` | text | Optional; replaces `collection.title` |

**How each tile resolves**
- Image: `block.settings.image`, then `collection.featured_image`, otherwise no image (a dark tile).
- Label: `block.settings.label`, then `collection.title`.
- Link: `collection.url`.
- No collection picked: the tile isn't rendered on the storefront. In the theme editor (`request.design_mode`) it shows a placeholder tile saying "Pick a collection".

**Markup:** `<section>`, an optional `<h2>`, then `<ul>` of `<li><a class="pb-category-tiles__tile">`. Each tile holds an image (`image_tag`, `widths: '360, 540, 720, 1080'`, `sizes` set from the column count, `loading: lazy`), the label, and a `»` chevron icon (`aria-hidden`).

**Styles**
- The heading uses the title-bar font: body font at weight 300, uppercase, `clamp(2rem, 3vw, 3rem)`.
- Tiles:
  - 12px border radius, `overflow: hidden`, `aspect-ratio` from the setting.
  - The image covers the tile.
  - A dark gradient rises from the bottom: `linear-gradient(0deg, rgb(0 0 0 / 0.7), transparent 55%)`.
- Label: white, bottom-left, uppercase, `clamp(1.25rem, 2vw, 2rem)`, at most 2 lines. The chevron sits bottom-right.
- Hover or keyboard focus: the image scales to 1.04 (transform only, 0.4s), and the chevron turns `var(--pb-accent)`. Disabled under `prefers-reduced-motion`.
- Columns:
  - 2 below 750px.
  - 3 from 750px to 989px.
  - The `columns` setting from 990px.
- Gaps: 16px, or 8px on phones.
- Outer edge: the same margin as the other PB sections, `0 10px` (`0 8px` on phones).

## Section 2: `sections/pb-brand-logos.liquid`

**Settings**

| id | type | default |
|---|---|---|
| `heading` | text | blank (hidden) |
| `logo_height` | range 24–96px, step 4 | `48` |
| `greyscale` | checkbox: greyscale until hover | `true` |
| `color_scheme` | color_scheme | `scheme-1` |

**Blocks:** `logo`, up to 16.

| id | type | notes |
|---|---|---|
| `image` | image_picker | Required; the block is skipped if empty (an editor placeholder shows in design mode) |
| `link` | url | Optional; without it the logo isn't a link |
| `alt` | text | Optional; replaces `image.alt` |

**Markup:** a `<ul>` of logos. Each is an `<img>` (`image_tag`, height set by `logo_height`, width auto, `widths: '160, 320, 480'`, `loading: lazy`), wrapped in an `<a>` when there's a link.

**Styles**
- Flex row, wrapping, centred, `justify-content: space-evenly`, gaps of `24px 48px`.
- Logos are `height: var(--logo-height)` with `width: auto` and `max-width: 180px`, so the aspect ratio is kept.
- With `greyscale` on, logos are `filter: grayscale(1)` at `opacity: 0.7`, and show in full colour on hover or focus.
- Padding: 32px top and bottom, 24px on phones.

## Home page (`templates/index.json`)

Both sections go after `pb_hero_bottle`:
- **Tiles:** the 5 category collections from `docs/store-setup/README.md` §3: `wash-shampoo`, `cleaners-sprays`, `microfibre-drying`, `kits-packs`, `power-emergency`.
- **Logos:** blocks for Permagard, CERFACE and OptiVAN linking to their collections, with no images until they're uploaded. Add Honda once its logo exists.

The home page uses `layout/pb-landing.liquid`. It renders `theme-styles-variables`, `color-palette` and `pb-head` like `theme.liquid` does, so colour schemes and the PB styles work there (checked).

## Out of scope

- A category landing-page template like the Supercheap hero (an existing title bar or hero section can be used).
- Scrolling logos.
- Logo upload (done by the user).

## Testing

- `shopify theme check`: still the 6 baseline warnings.
- `shopify theme dev`, home page at 1440px, 900px and 390px:
  - 4, 3 and 2 tile columns.
  - Labels readable on the photos.
  - Hover zoom and red chevron.
  - Logos wrap on phones.
- Theme editor:
  - Add, reorder and delete tiles.
  - A tile with no collection shows the placeholder in the editor only.
  - The image and label overrides win over the collection's.
  - A logo with no link isn't clickable.
- Keyboard: tiles and logos reachable by Tab, with a visible focus ring.
