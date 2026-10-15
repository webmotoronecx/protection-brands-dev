# Categories: build on the dev store, then rebuild on live

The new categories are being set up and signed off on the dev store
(`protection-brands-dev.myshopify.com`), then created again on the live store
(`protection-brands.myshopify.com`) for launch.

**Only the theme moves between stores.** Collections, product types, collection images,
metafields, menus, filters, redirects and files in **Content → Files** all stay on the store
they were made on. This file records what was finalised on dev, so it can be repeated on live
exactly.

How to use it:

1. **On dev:** each time a category is changed, update the tables below. When the client signs
   off, mark it *Final* in §8.
2. **On live (close to launch):** work through §2 to §7 in order, ticking each box.

What each step means in the admin is in [README.md](README.md) (§1 to §5) and
[category-tiles-and-brand-logos.md](category-tiles-and-brand-logos.md).

---

## 1. Keep the source files

Images can't be copied from one store to the other. Save every image uploaded on dev in
`Protection Brands/Categories/` on the shared drive, **under the exact filename used on dev**.

The theme refers to images by filename (e.g. `shopify://shop_images/AtHomeDetailersKit.png`).
A tile or brand banner on live only finds its image if a file with the same name is uploaded
to the live store's **Content → Files**.

---

## 2. Product types (the category each product is in)

The automated collections in §3 select products by **Product type**, so set types before
creating collections.

The source is [`product-taxonomy.csv`](product-taxonomy.csv). When a product's category is
changed on dev, change it in this CSV too, so the CSV always matches dev.

Products whose type, vendor or *Suitable for* value differs from the CSV, or which aren't in it:

| Product handle | Type | Vendor | Suitable for | Note |
|---|---|---|---|---|
| | | | | |

On live:

- [ ] **Products → Export** a full backup.
- [ ] Create the **Suitable for** metafield definition (README §1).
- [ ] Import `product-taxonomy.csv` with **Overwrite products with matching handles**
      (one product first, then the rest; README §2).
- [ ] Apply any rows from the table above by hand.

---

## 3. Collections

One row per category collection, as finalised on dev.

The **handle** must be identical on live. The menu, the home page tiles and the brand logo
links all point to handles. If a handle is already taken on live, Shopify silently adds `-1`
(e.g. `wash-shampoo-1`). Rename or delete the old collection first, then check the handle
before saving.

| # | Title | Handle | Conditions (all / any) | Sort order | Theme template | Image filename | Description |
|---|---|---|---|---|---|---|---|
| 1 | Wash & Shampoo | `wash-shampoo` | all: Product type = `Wash & Shampoo` | Best selling | default | | |
| 2 | Cleaners & Sprays | `cleaners-sprays` | all: Product type = `Cleaners & Sprays` | Best selling | default | | |
| 3 | Microfibre & Drying | `microfibre-drying` | all: Product type = `Microfibre & Drying` | Best selling | default | | |
| 4 | Kits & Packs | `kits-packs` | all: Product type = `Kits & Packs` | Best selling | default | | |
| 5 | Power & Emergency | `power-emergency` | all: Product type = `Power & Emergency` | Best selling | default | | |
| | | | | | | | |

SEO, from each collection's **Search engine listing** panel:

| Handle | Page title | Meta description |
|---|---|---|
| | | |

Brand collections (template `brand`, with the hero image and watermark metafields; README §3):

| Title | Handle | Template | Hero image filename (`custom.hero_image`) | Watermark (`custom.watermark`) |
|---|---|---|---|---|
| Permagard Car Care | `permagard-car-care` | brand | | |
| CERFACE Ceramic | `cerface-ceramic` | brand | | |
| OptiVAN Caravan Maintenance | `optivan-caravan-maintenance` | brand | | |
| Honda Genuine Car Care | `honda-genuine-car-care` | brand | | |

Existing live collections that are changed, hidden or removed:

| Handle | Action (keep / change conditions / hide / delete) | Detail |
|---|---|---|
| `car-care` | keep | |
| `accessories` | | |
| Professional (check handle) | keep | Tag `Professional` |
| | | |

On live:

- [ ] Create the collection metafield definitions **Hero image** and **Watermark** (README §3).
- [ ] Upload every image from §1 to **Content → Files**, keeping the filenames.
- [ ] Create each collection in the first table, then check its URL shows the right handle.
- [ ] Set each collection's image, description, sort order, template and SEO.
- [ ] Publish each collection to the **Online Store** sales channel.
- [ ] Set up the brand collections and their metafields.
- [ ] Apply the changes in the last table.

---

## 4. Redirects for removed or renamed categories

Every live collection URL that goes away needs a redirect, so old links and Google results
don't land on a 404.
Add them in **Content → Menus → View URL redirects** (or **Online Store → Navigation → URL
redirects**, depending on the admin version).

| Old path | Redirect to |
|---|---|
| | |

- [ ] Add every redirect above on live.

Dev has no old URLs, so redirects are only added on live.

---

## 5. Main menu

Write the final menu exactly as built on dev: indent shows nesting, and the link target is in
brackets.

```
Shop (/collections/all)
  By category (/collections/all)
    Wash & Shampoo (/collections/wash-shampoo)
    Cleaners & Sprays (/collections/cleaners-sprays)
    Microfibre & Drying (/collections/microfibre-drying)
    Kits & Packs (/collections/kits-packs)
    Power & Emergency (/collections/power-emergency)
  By brand (/collections/all)
    Permagard (/collections/permagard-car-care)
    CERFACE (/collections/cerface-ceramic)
    OptiVAN (/collections/optivan-caravan-maintenance)
  Professional / Bulk (Professional collection)
```

Footer menu (`footer`), if it changes:

```
```

On live:

- [ ] Rebuild the **Main menu** to match. Link each item by choosing the collection from the
      picker, not by pasting a URL, so the link follows the collection if its handle changes.
- [ ] Rebuild the footer menu if it changed.

---

## 6. Filters (Search & Discovery)

Order and labels as finalised on dev:

| # | Filter | Label |
|---|---|---|
| 1 | Product type | Category |
| 2 | Vendor | Brand |
| 3 | Suitable for (metafield) | Suitable for |
| 4 | Price | Price |
| 5 | Availability | Availability |

- [ ] Install **Search & Discovery** on live if needed, and add the filters in this order.
- [ ] Remove the *Tags* filter.

---

## 7. Theme editor settings

Home page tiles, brand logos and section settings are stored in the theme
(`templates/*.json`), so they move with the theme. Two things don't:

- **Images picked from Files** move as a filename only. They show on live once §3's files
  are uploaded.
- **Changes made in the dev store's theme editor** are lost unless they're pulled back into this
  repo before pushing to live. After the last change on dev, run:

  ```bash
  shopify theme pull --store protection-brands-dev --only 'templates/*.json' --only 'sections/*.json' --only 'config/settings_data.json'
  ```

  Then review the diff and commit.

On live:

- [ ] Push the theme as an **unpublished** theme and open its preview.
- [ ] Check every category tile has its image and label, and every brand logo shows.
- [ ] Re-pick in the live theme editor any image that's still blank.

---

## 8. Sign-off and final check

| Item | Final on dev (date / who) | Done on live (date / who) |
|---|---|---|
| Product types | | |
| Collections | | |
| Redirects | n/a | |
| Main menu | | |
| Filters | | |
| Theme settings pulled into repo | | |

On live, in the unpublished theme's preview:

- [ ] Every menu link opens a collection with products in it.
- [ ] Each category tile on the home page opens the right collection.
- [ ] The filters on `/collections/all` narrow the results correctly.
- [ ] Each old URL in §4 redirects.
- [ ] Search finds "shampoo", "microfibre" and "jump starter".
