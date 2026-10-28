# Store setup: automated

`setup-store.mjs` creates the admin-side setup the theme needs on a store, from
[`setup-store.json`](setup-store.json), through the Admin API. It replaces the manual steps
for:

| Section | What | Manual steps it replaces |
|---|---|---|
| `metaobjects` | **SDS document** definition (`sds_document`) | [sds.md](sds.md) §1 |
| `metafields` | Product *Suitable for*, *SDS*, *How to use*; collection *Hero image*, *Watermark* | README §1 and §3, sds.md §2, [metafield-definitions.graphql](metafield-definitions.graphql) |
| `files` | Uploads the cut-outs in `product-images/upload-webp/` to **Content → Files** | [product-import.md](product-import.md) §3 |
| `collections` | The 5 categories, the brand collections, *Bulk & Professional*: handle, conditions, template, sort order, published to Online Store | README §3, product-import.md §6 |
| `pages` | *Safety Data Sheets* (`sds`, template `page.sds`) | sds.md §3 |
| `redirects` | URL redirects (none listed yet) | categories-dev-to-live.md §4 |
| `menus` | A **new** menu `main-menu-2026`. The existing *Main menu* is never touched. | README §5 |

Still manual: the product CSV import, Search & Discovery filters (no API), SDS entries and
their PDFs, collection images and descriptions, theme editor settings and app embeds.

## How it keeps the live store safe

- **Read-only by default.** Without `--apply` it only reads the store and prints a plan.
  The script refuses to send a mutation without `--apply`, and the CLI refuses one without
  `--allow-mutations`, which the script only adds in apply mode.
- **Creates what's missing; never deletes.** It never deletes or renames anything, and never
  changes an existing item's conditions, title, content or products.
- **Edits to existing items need a second flag.** On an existing collection it can set the
  template, sort order, *Hero image* / *Watermark*, and publish it to the Online Store. On an
  existing page it can set the template. These show as `~ edit` in the plan and only run
  with `--approve-edits`.
- **Everything else that differs is reported** as `! differs`, e.g. an existing brand
  collection whose conditions are tags instead of *Suitable for*. Decide those in the admin.
- **Handles are checked first.** A collection, page or menu is only created when its handle
  is free, so Shopify can't quietly add `-1`. If the created handle still comes back different,
  the script stops.
- **Files are never renamed or replaced.** Uploads use `RAISE_ERROR` for duplicates.
- **Stops on the first error.** Running it again is safe: whatever was already created
  shows as `ok`.
- **Logs every change.** Each `--apply` run writes the IDs it created or edited to
  `setup-logs/<store>-<time>.json`.

What the live (Debut) site sees from the creates: new collection URLs and `/pages/sds` exist
but aren't linked from Debut's menus. The new metafields and the metaobject are invisible to
Debut. Setting the `brand` template on an existing collection has no effect on Debut, which has
no such template.

## One-time login per store

```bash
shopify store auth --store protection-brands-dev.myshopify.com --scopes read_products,write_products,read_metaobject_definitions,write_metaobject_definitions,read_files,write_files,read_publications,write_publications,read_online_store_pages,write_online_store_pages,read_content,read_online_store_navigation,write_online_store_navigation
```

Run it again with `--store protection-brands.myshopify.com` for live. It opens the browser
to approve.

## Running it

From `docs/store-setup/`:

```bash
node setup-store.mjs --store protection-brands-dev                  # 1. plan on dev
node setup-store.mjs --store protection-brands-dev --apply          # 2. fill any gaps on dev
node setup-store.mjs --store protection-brands                      # 3. plan on live; read it
node setup-store.mjs --store protection-brands --apply              # 4. create on live
node setup-store.mjs --store protection-brands --apply --approve-edits   # 5. the ~ edit lines
```

`--only collections,pages` limits the plan and the changes to some sections.

The plan marks each item:

| Mark | Meaning |
|---|---|
| `+ create` | Missing; created by `--apply` |
| `~ edit` | Exists; changed by `--apply --approve-edits` |
| `ok` | Exists and matches |
| `! differs` | Exists but differs in a way the script won't change; decide in the admin |
| `x blocked` | Can't be created yet, e.g. a menu link to a collection that doesn't exist |

On dev, step 1 should show almost everything as `ok`: that checks `setup-store.json`
matches what was signed off. Fix the JSON, not the store, where they differ.

## Go-live order

1. **Products → Export** as a backup.
2. Run the script on live (steps 3 to 5). This uploads the cut-outs, so the CSV can be built.
3. Build and import the product CSV ([product-import.md](product-import.md) §4 and §5).
4. Check the collection counts (product-import.md §6), then do the manual items in
   [go-live-checklist.md](go-live-checklist.md).

## Changing what it creates

Edit [`setup-store.json`](setup-store.json):

- **Collection rules** are `[column, value]` pairs, all must match. Columns: `TYPE`, `TAG`,
  `VENDOR`, or `SUITABLE_FOR` for the *Suitable for* metafield. Optional: `sortOrder`
  (`BEST_SELLING`, `ALPHA_ASC`, …), `templateSuffix`, `watermark`, `heroImage` (a filename
  in Files).
- **Menu links**: `collection:<handle>`, `page:<handle>`, `blog:<handle>`, `catalog`
  (all products) or `url:<address>`.
- **Redirects**: `{ "path": "/collections/old", "target": "/collections/new" }`.
- **Files**: a folder relative to this one and a filename pattern.
