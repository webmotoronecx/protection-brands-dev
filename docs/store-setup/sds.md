# Store setup: SDS page

The SDS page lists every Safety Data Sheet stored as an **SDS document** metaobject, grouped by
brand, with a search box. Product pages show a "Safety Data Sheet (PDF)" link when the
product's **SDS** metafield points at one.

Theme files: `templates/page.sds.json`, `blocks/sds-list.liquid`, `snippets/sds-row.liquid`,
`blocks/sds-link.liquid` (added to `templates/product.json` under the description).

## 1. Metaobject definition

**Settings → Custom data → Metaobjects → Add definition**

Name **SDS document**. Type (handle) must be `sds_document`. Turn on **Storefront access**.

| Field name | Key | Type | Validation |
|---|---|---|---|
| Product name | `product_name` | Single line text | Required |
| File | `file` | File | Required; accept PDFs |
| Brand | `brand` | Single line text | Preset choices: `Permagard`, `CERFACE`, `OptiVAN`, `Honda Genuine Car Care`, `Protection Brands` |
| Issue date | `issue_date` | Date | — |

Keys must match exactly; the theme reads them by name.

## 2. Product metafield

**Settings → Custom data → Products → Add definition**

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

1. **Content → Metaobjects → SDS document → Add entry.**
2. Fill in the product name, upload the PDF, pick the brand, set the issue date. Save.
3. If it belongs to a product sold online, open that product and set its **SDS** metafield
   (bottom of the product page in the admin) to the new entry.

To replace an outdated sheet, edit the entry and upload the new PDF; the page and the
product link update together.

Entries whose brand isn't in the block's **Brand order** setting appear under
*Other products*. Rows show in the order Shopify returns entries; there's no sorting.

## 5. Check

In the `theme dev` preview, with two or three entries:

- `/pages/sds` shows each brand as a heading with its documents underneath.
- Typing in the search box hides non-matching rows and empty brand groups, and shows
  "No safety data sheets match your search" when nothing matches.
- Each **Download PDF** opens the right file in a new tab.
- A product with its SDS metafield set shows the link under the description; one without
  shows nothing.
- With no entries, the page shows "Safety data sheets will be available here soon."
- With more than 50 entries, check all of them appear.
