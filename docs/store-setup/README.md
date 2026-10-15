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
| Type | Single line text → **List of values** |
| Validation | Limit to preset choices: `Permagard`, `CERFACE`, `OptiVAN` |
| Storefront access | On |
| Filtering | On (lets Search & Discovery use it) |

## 2. Import product data

File: [`product-taxonomy.csv`](product-taxonomy.csv). It sets **Vendor** (brand), **Type**
(category) and **Suitable for** for the 19 products currently on the storefront.

1. **Products → Export** a full backup first.
2. Test one product: delete all rows but one, then **Products → Import**, tick
   **Overwrite products with matching handles**, and check that product's vendor, type and
   *Suitable for* values. Columns not in the CSV are left unchanged.
3. If the list metafield didn't take, export that product and copy the format Shopify
   uses for the *Suitable for* column (this CSV uses `Permagard; CERFACE; OptiVAN`).
4. Import the full file.

Products hidden from the Online Store aren't in the CSV. Give any that should go live a
type and vendor too.

## 3. Collections

**Products → Collections.** New collections are automated, with *all conditions* matched.

| Collection | Handle | Condition |
|---|---|---|
| Wash & Shampoo | `wash-shampoo` | Product type is equal to `Wash & Shampoo` |
| Cleaners & Sprays | `cleaners-sprays` | Product type is equal to `Cleaners & Sprays` |
| Microfibre & Drying | `microfibre-drying` | Product type is equal to `Microfibre & Drying` |
| Kits & Packs | `kits-packs` | Product type is equal to `Kits & Packs` |
| Power & Emergency | `power-emergency` | Product type is equal to `Power & Emergency` |

Existing collections keep their handles, so old links and search rankings survive:

- **Permagard Car Care / CERFACE Ceramic / OptiVAN Caravan Maintenance**: leave as they are.
  They act as the brand landing pages. Set each one's **Theme template** to `brand`
  (`templates/collection.brand.json`): the same title bar, with the brand name as the faint
  watermark instead of the Protection Brands wordmark.
- **Honda Genuine Car Care** (from 4 Nov): new automated collection, handle
  `honda-genuine-car-care`, condition *Product vendor is equal to* `Honda Genuine Car Care`,
  theme template `brand`.
- **Car Care**: leave as it is (all car care products).
- **Accessories**: currently almost the same list as Car Care. Either change it to
  *any condition*: type = `Microfibre & Drying` OR type = `Power & Emergency`, or hide it
  and drop it from the menu.
- **Professional**: leave on the `Professional` tag (it marks trade/bulk items).
- **Reapplication / Warranty Transfer**: no products are visible publicly. Publish their
  products to the Online Store sales channel, or point the menu at a page instead.

Brand page banners use two collection metafield definitions
(**Settings → Metafields and metaobjects → Collections → Add definition**, storefront access on):

| Name | Namespace and key | Type | Use |
|---|---|---|---|
| Hero image | `custom.hero_image` | File (images only) | Photo across the whole banner, behind a dark gradient. Wide, at least 2400px. |
| Watermark | `custom.watermark` | Single line text | Short faint watermark when there's no hero image, e.g. `Honda`. Without it the collection title is used. |

Fill them in at the bottom of each brand collection's page in admin.
If Honda products should show a *Suitable for* line, add `Honda` to the §1 preset choices.

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
