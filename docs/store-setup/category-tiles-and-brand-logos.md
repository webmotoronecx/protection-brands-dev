# Store setup: Shop by category tiles and brand logos

Two sections you can add to any page in the theme editor:

- **Category tiles (PB)**: a "Shop by category" grid of photo tiles, each linking to a collection.
- **Brand logos (PB)**: a row of brand logos, each linking to its brand page.

The home page has both under the bottle hero. You can also add them to brand pages
(`collection.brand` template), landing pages or anywhere else.

Theme files: `sections/pb-category-tiles.liquid`, `sections/pb-brand-logos.liquid`.
Design: [`docs/superpowers/specs/2026-10-14-category-tiles-brand-logos-design.md`](../superpowers/specs/2026-10-14-category-tiles-brand-logos-design.md).

## 1. Before you start

Do [README.md](README.md) §3 first. The tiles link to the category collections, so these must
exist: `wash-shampoo`, `cleaners-sprays`, `microfibre-drying`, `kits-packs`, `power-emergency`.

## 2. Collection images (for the tiles)

A tile uses its collection's image unless you give the tile its own photo (step 4).

**Products → Collections → (collection) → Collection image → Upload.**

- Use square product cut-outs (transparent PNG), at least **1200 × 1200 px**. The whole photo
  always shows, never cropped: it's scaled to fit the tile, with the tile's dark studio
  background around it.
- The label sits along the bottom of the tile, over a dark fade, so leave a little space
  under the product.
- The same image shows wherever Shopify uses the collection image, such as social share
  previews. If that's a problem, set a tile image instead (step 4).

## 3. Upload the brand logos

**Content → Files → Upload files.**

| Brand | Links to |
|---|---|
| Permagard | `/collections/permagard-car-care` |
| CERFACE | `/collections/cerface-ceramic` |
| OptiVAN | `/collections/optivan-caravan-maintenance` |
| Honda Genuine Car Care (from 4 Nov) | `/collections/honda-genuine-car-care` |

- Use **SVG** or **PNG with a transparent background**. Avoid JPGs with a white box.
- Trim empty space around the logo, so all logos look the same size in the row.
- PNGs should be at least 480 px wide.
- Logos show in grey until hovered (this can be turned off, see step 5). Logos that are mostly
  white won't show on the white background, so upload a dark version.

## 4. Set up the category tiles

**Online Store → Themes → Customize → Home page.** The **Category tiles (PB)** section is
already there with the 5 categories. To add it to another page, use **Add section → Category
tiles (PB)**.

Section settings:

| Setting | What it does |
|---|---|
| Heading | Title above the grid (default "Shop by category"). Leave it blank for no title. |
| Columns on desktop | 3 or 4. Tablets always show 3 and phones 2. |
| Tile shape | Square, Landscape (4:3) or Portrait (3:4). |

Each **Tile** block:

| Setting | What it does |
|---|---|
| Collection | Required. The tile links here and uses its image and title. |
| Image | Optional. Use a different photo on this tile only. |
| Label | Optional. Use different words on this tile, e.g. "Wash & Dry" instead of "Wash & Shampoo". |

- **Add tile** adds a block, up to 12. Drag tiles to reorder them.
- A tile with no collection only shows in the editor, never on the live store. If no tile has a
  collection, the whole section is hidden on the live store, including its heading.

## 5. Set up the brand logos

On the same page, open **Brand logos (PB)**, or add it with **Add section → Brand logos (PB)**.
The Permagard, CERFACE and OptiVAN blocks are already there with their links. Each needs a
logo.

Section settings:

| Setting | What it does |
|---|---|
| Heading | Optional title above the logos, e.g. "Our brands". Blank for none. |
| Logo height | 24–96 px (default 48). All logos are scaled to this height. |
| Grey until hover | On: logos are grey and turn full colour on hover. Off: always full colour. |

Each **Logo** block:

| Setting | What it does |
|---|---|
| Image | Required. Pick the logo from Files (step 3). Logos without an image are skipped. |
| Link | Optional. Usually the brand's collection. Without it the logo isn't clickable. |
| Alt text | Optional. Read out by screen readers. Defaults to the image's alt text, otherwise use the brand name. |

- **Add logo** adds a block, up to 16. Drag logos to reorder them. Until at least one logo has an
  image, the section is hidden on the live store.
- **Honda (4 Nov):** add a logo block with the Honda logo, linked to `/collections/honda-genuine-car-care`.

## 6. Check

- Desktop: 4 tiles per row, or 3 if you chose that. Labels are readable on every photo. On
  hover, the photo zooms slightly and the » arrow turns red.
- Phone (resize the editor preview, or open it on a phone): 2 tiles per row, and the logos wrap
  onto two lines if needed.
- Click every tile and every logo once to check where it goes.
- **Save**. For the live theme, check again after publishing.
