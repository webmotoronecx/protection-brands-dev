# Store setup: SDS page

The SDS page shows every Safety Data Sheet stored as an **SDS document** metaobject as a grid
of cards, with a sidebar to search and to filter by brand. Product pages show a "Safety Data Sheet (PDF)" link when the
product's **SDS** metafield points at one.

Theme files: `templates/page.sds.json`, `sections/pb-sds-library.liquid`, `snippets/pb-sds-card.liquid`,
`blocks/sds-link.liquid` (added to `templates/product.json` under the description).

## 1. Metaobject definition

**Content → Metaobjects → Add definition** (if entries already exist, the button is under
**Manage definitions**). Metaobjects are no longer listed under **Settings → Metafields and
metaobjects**, which now only covers metafields.

Name **SDS document**. Type (handle) must be `sds_document`. Turn on **Storefront access**.

| Field name | Key | Type | Validation |
|---|---|---|---|
| Product name | `product_name` | Single line text | Required |
| File | `file` | File | Required; accepted file types **Any file type** (there's no PDF-only option, and *Media files only* blocks PDFs) |
| Brand | `brand` | Single line text | Preset choices: `Permagard`, `CERFACE`, `OptiVAN`, `Honda Genuine Car Care`, `Protection Brands` |
| Issue date | `issue_date` | Date | — |

Keys must match exactly; the theme reads them by name.

## 2. Product metafield

**Settings → Metafields and metaobjects → Products → Add definition**

| Field | Value |
|---|---|
| Name | SDS |
| Namespace and key | `custom.sds` |
| Type | Metaobject → SDS document (one entry) |
| Storefront access | On |

## 3. The page

**Online Store → Pages → Add page**

- Title: *Safety Data Sheets*
- Content: a short intro, e.g. what an SDS is and who to contact for one not listed
- Theme template: **page.sds** (visible once this theme is published or in the preview)
- URL handle: `sds`, so the page is at `/pages/sds`

Add it to the main menu (see the menu outline in [README.md](README.md)).

## 4. Adding a document

### From the PDF folder (script)

`upload-sds.mjs` uploads every PDF in `files/SDS` (next to `shopify-theme/`) and creates an
entry for each one the store doesn't have yet. Files must be named
`SDS - <Brand> <Product> <D.M.YYYY>.pdf`: the product name is the filename without
`SDS - `, the brand its first word(s), the issue date read day first (`3.2.2025` is 3 February
2025). From `docs/store-setup/`:

```bash
node upload-sds.mjs --store protection-brands-dev                   # plan, read-only
node upload-sds.mjs --store protection-brands-dev --apply           # upload + create entries
node upload-sds.mjs --store protection-brands-dev --apply --link-products
```

`--link-products` also sets the products' **SDS** metafield from
[`sds-products.json`](sds-products.json) (sheet filename → product handle). A product already
pointing at a different sheet is reported, not changed. The store login needs the
`read_metaobjects,write_metaobjects` scopes ([automated-setup.md](automated-setup.md)).

### By hand

1. **Content → Metaobjects → SDS document → Add entry.**
2. Fill in the product name, upload the PDF, pick the brand, set the issue date. Save.
3. If it belongs to a product sold online, open that product and set its **SDS** metafield
   (bottom of the product page in the admin) to the new entry.

To replace an outdated sheet, edit the entry and upload the new PDF; the page and the
product link update together.

Entries whose brand isn't in the section's **Brands** setting are counted under *Other* in the
sidebar. Brands without documents aren't listed. Cards show in the order Shopify returns
entries; there's no sorting.

## 5. Check

In the `theme dev` preview, with two or three entries:

- `/pages/sds` shows the dark banner, `HOME / SAFETY DATA SHEETS`, the sidebar and a card per
  document; the sidebar counts match the entries per brand.
- Clicking a brand shows only its cards (click again for all). Typing in the search box hides
  non-matching cards, together with the brand filter, and shows "No safety data sheets match
  your search" when nothing matches.
- Clicking a card opens the right PDF in a new tab.
- A product with its SDS metafield set shows the link under the description; one without
  shows nothing.
- With no entries, the page shows "Safety data sheets will be available here soon."
- With more than 50 entries, check all of them appear.
