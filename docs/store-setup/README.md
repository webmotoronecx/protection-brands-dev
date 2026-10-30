# Store setup: categorisation, navigation and search

Admin-side changes that go with the theme (brief §3, eCommerce Experience Enhancement).
For the full launch-day list see [go-live-checklist.md](go-live-checklist.md). Categories are
built on the dev store first; record them in [categories-dev-to-live.md](categories-dev-to-live.md)
so they can be rebuilt on live.
Do them in this order; each step depends on the one before.

The theme expects these collection handles: `wash-shampoo`, `cleaners-sprays`, `microfibre-drying`,
`kits-packs`, `power-emergency` (home page "Shop by category"), and the existing
`permagard-car-care`, `cerface-ceramic`, `optivan-caravan-maintenance` ("Shop by brand").

## 1. Metafield definition

**Settings → Metafields and metaobjects → Products → Add definition**

Or create this and the two collection definitions in §3 in one go with
[`metafield-definitions.graphql`](metafield-definitions.graphql) (instructions at the top of the file).

| Field | Value |
|---|---|
| Name | Suitable for |
| Namespace and key | `custom.suitable_for` |
| Type | **List** → **Choice list (Single line text)** (plain *Single line text* has no choices) |
| Choices | `Permagard`, `CERFACE`, `OptiVAN`, `Honda Genuine Car Care` (spelled exactly; item count left empty) |
| Options | **Use as a condition in collections**: on (the "By treatment" collections need it). **Storefront API access**: on. **Filter on the product list and in the Admin API**: on (optional, admin only). Analytics: off. |

## 2. Import product data

Step by step, as done on dev and to repeat on live: [product-import.md](product-import.md).

Source: [`product-taxonomy.csv`](product-taxonomy.csv), the **Vendor** (brand), **Type**
(category) and **Suitable for** of the 19 products currently on the storefront. Don't import it
directly: run `product-images/make-import-csv.py`, which merges it into the full product export
with the cut-out images, alt text and the `Bulk` tag, and writes *Suitable for* in
the format the import needs. A list metafield takes **one value per line inside the cell**
(as Shopify exports it); `Permagard; CERFACE; OptiVAN` or commas are read as one value, and the
choice list rejects the whole product.

1. **Products → Export** a full backup first.
2. Test one product: delete all rows but one, then **Products → Import**, tick
   **Overwrite products with matching handles**, and check that product's vendor, type and
   *Suitable for* values. Columns not in the CSV are left unchanged.
3. Import the full file.

Products hidden from the Online Store aren't in the CSV. Give any that should go live a
type and vendor too.

### Product page tabs

The product page's tabs (Description, What's included, Key features, Key specifications) come
from four rich text product metafields, `custom.tab_description`, `custom.tab_what_s_included`,
`custom.tab_key_features` and `custom.tab_key_specifications` (**Tab: …** on the product page in
admin). A product with none of them set falls back to splitting its description at bold capital
headings. The fields don't show on Debut, so they can be filled on live before launch.

1. Create the definitions in admin: **Settings → Custom data → Products → Add definition**, type
   **Rich text**, one each: *Tab: Description* (`custom.tab_description`), *Tab: What's
   included* (`custom.tab_what_s_included`), *Tab: Key features* (`custom.tab_key_features`),
   *Tab: Key specifications* (`custom.tab_key_specifications`). setup-store.mjs can't create
   `custom` definitions (the CLI's access is denied), but its plan then reports them as ok.
2. Dry run: `python3 split-descriptions.py --store <store>`. It splits each description at its
   headings (DESCRIPTION, INCLUSIONS / WHATS INCLUDED, KEY FEATURES, KEY SPECIFICATIONS /
   PRODUCT SIZE) and writes `setup-logs/split-descriptions-<store>.html`: each product's
   original next to its four parts. Read it; any unrecognised heading is listed.
3. `python3 split-descriptions.py --store <store> --apply` fills the empty fields (add
   `--overwrite` to replace ones already set, `--only <handle>,<handle>` for a few products).
   The descriptions themselves are not changed.

After that, edit the Tab fields in admin; the script is only for the first fill.

## 3. Collections

**Products → Collections.** New collections are automated, with *all conditions* matched.

| Collection | Handle | Condition |
|---|---|---|
| Wash & Shampoo | `wash-shampoo` | Product type is equal to `Wash & Shampoo` |
| Cleaners & Sprays | `cleaners-sprays` | Product type is equal to `Cleaners & Sprays` |
| Microfibre & Drying | `microfibre-drying` | Product type is equal to `Microfibre & Drying` |
| Kits & Packs | `kits-packs` | Product type is equal to `Kits & Packs` |
| Power & Emergency | `power-emergency` | Product type is equal to `Power & Emergency` |

"By treatment" and bulk, for the Shop menu (also automated, *all conditions*). Treatments use
the *Suitable for* metafield (Add condition → Suitable for → is equal to), which only appears once
the definition's **Use as a condition in collections** option is on (§1). A product suitable for
several treatments is in each of those collections. Don't use the old `OptiVAN` /
`CERFACE Ceramic` / `Permagard Products` tags: they're on almost every product.

| Collection | Handle | Condition |
|---|---|---|
| Permagard Car Care | `permagard-car-care` | Suitable for is equal to `Permagard` |
| CERFACE Ceramic | `cerface-ceramic` | Suitable for is equal to `CERFACE` |
| OptiVAN Caravan Maintenance | `optivan-caravan-maintenance` | Suitable for is equal to `OptiVAN` |
| Honda Genuine Car Care (from 4 Nov) | `honda-genuine-car-care` | Suitable for is equal to `Honda Genuine Car Care` |
| Bulk & Professional | `bulk-professional` | Product tag is equal to `Bulk` |

These are the brand collections listed below, so the menu and the brand logos share one
URL per treatment. On the dev store, create them with these conditions; on live, decide whether
to switch the existing ones to the same condition.

Only true bulk items carry the `Bulk` tag (now just the 20L drum). Don't use the old
`Professional` tag for this: most retail products have it.

Existing collections keep their handles, so old links and search rankings survive:

- **Permagard Car Care / CERFACE Ceramic / OptiVAN Caravan Maintenance**: leave as they are.
  They act as the brand landing pages. Set each one's **Theme template** to `brand`
  (`templates/collection.brand.json`): a tall banner (sections/pb-brand-header.liquid) with
  the brand name and tagline on the left, a product in the middle, the brand logo on the
  right and the brand name as the faint watermark; or a full-screen photo.
- **Honda Genuine Car Care** (from 4 Nov): new automated collection, handle
  `honda-genuine-car-care`, condition *Suitable for is equal to* `Honda Genuine Car Care`,
  theme template `brand`.
- **Car Care**: leave as it is (all car care products).
- **Accessories**: currently almost the same list as Car Care. Either change it to
  *any condition*: type = `Microfibre & Drying` OR type = `Power & Emergency`, or hide it
  and drop it from the menu.
- **Professional**: leave on the `Professional` tag (it marks trade/bulk items).
- **Reapplication / Warranty Transfer**: no products are visible publicly. Publish their
  products to the Online Store sales channel, or point the menu at a page instead.

Brand page banners use five collection metafield definitions. `node setup-store.mjs --store
<store> --only metafields --apply` creates them (or in admin: **Settings → Custom data →
Collections → Add definition**, storefront access on):

| Name | Namespace and key | Type | Use |
|---|---|---|---|
| Brand logo | `custom.brand_logo` | File (images only) | Logo on the right of the banner. A light or white version, as the banner is dark; transparent PNG or SVG. |
| Tagline | `custom.tagline` | Single line text | Short red line under the brand name. Empty hides it. |
| Hero product | `custom.hero_product` | Product | The product photo in the middle. Empty uses the collection's first product. |
| Hero image | `custom.hero_image` | File (images only) | Full-screen photo across the whole banner, in place of the middle product. Wide, at least 2400px. |
| Watermark | `custom.watermark` | Single line text | Short faint watermark when there's no hero image, e.g. `Honda`. Without it the collection title is used. |
| Hide banner title | `custom.hide_title` | True or false | Hides the name in the banner on that brand or collection page, e.g. when the photo already shows it. Screen readers still get it. |

The shared look (height, show or hide the title, tagline and logo, logo size, watermark) is in
the theme editor: Collections → brand template → Brand banner (PB).

Fill them in at the bottom of each brand collection's page in admin.

Pages have one metafield, **Page heading** (`custom.heading`, single line text), also created by
`--only metafields`. It's the large heading beside the page text (Contact and the text pages).
The title bar above already shows the page title, so use a different line, e.g. *Who we are*.
Empty: the template's heading (Contact: *Get in touch*), or no heading on text pages. Fill it
in at the bottom of the page in admin (**Online Store → Pages**).

Give each new collection an image and a one-line description; the home page cards show both.

## 4. Filters

**Apps → Search & Discovery → Filters.** Add, in this order:

1. Product type (label: *Category*)
2. Vendor (label: *Brand*)
3. Suitable for (product metafield)
4. Price
5. Availability

Remove the default *Tags* filter if present; every product carries the same tags.

## 5. Main menu

**Content → Menus → Main menu.** Nest by dragging items under a parent.
The theme shows nested items as a mega menu on desktop and a drawer on mobile.

- **Shop** → `/collections/all`
  - **By category** → `/collections/all`
    - Wash & Shampoo · Cleaners & Sprays · Microfibre & Drying · Kits & Packs · Power & Emergency
  - **By brand** → `/collections/all`
    - Permagard · CERFACE · OptiVAN · *(Honda Genuine Car Care, from 4 Nov)*
  - **Professional / Bulk** → Professional collection
- **Services**
  - Product Reapplication → Reapplication collection (or page, see §3)
  - Warranty Transfer → Warranty Transfer collection (or page)
  - Warranty Claim → `https://spark.permagard.com.au/warrantyclaim/`
- **Car Care Tips** → blog `car-care-tips`
- **SDS** → page `sds` (see [sds.md](sds.md))
- **About Us** → page `about-us`
- **Contact** → page `contact-page`

Every product is then two clicks from any page (menu → collection, then the product),
inside the brief's three-click limit.

## 6. Check

In the `theme dev` preview:

- Click through every menu link; none should land on an empty page.
- Each filter on `/collections/all` narrows the products correctly.
- Search for "shampoo", "microfibre" and "jump starter" and confirm the matching products
  and collections appear in the search dropdown.
- Old URLs still load: `/collections/car-care`, `/collections/accessories`,
  `/collections/permagard-car-care`.
