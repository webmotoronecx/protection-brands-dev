# Product import: cut-out images, categories and Suitable for

How the products were loaded onto the dev store (`protection-brands-dev`) in October 2026, written
so the same import can be repeated on the live store (`protection-brands`) at launch. It
updates every product in one CSV import:

- **Images**: the cut-out product shots (transparent, 2048 px square) replace the matching photos.
  A product's cut-outs come first, so its first image (the one on product cards) is a cut-out
  whenever it has one; the remaining live photos follow.
- **Type**: the category (`Wash & Shampoo`, `Cleaners & Sprays`, `Microfibre & Drying`,
  `Kits & Packs`, `Power & Emergency`).
- **Vendor**: the brand.
- **Suitable for** (`custom.suitable_for`): the treatments a product is safe on.
- **Tag** `Bulk`: on true bulk items (now only the 20 L drum).
- **Image alt text**: the product title, on every image that has none.

The source of the categories is [`product-taxonomy.csv`](product-taxonomy.csv). The script is
`../product-images/make-import-csv.py` (in the `shopify-theme` folder, next to this theme).

On live, these changes show on the Debut site as soon as they're imported. They're safe
there, but do them close to launch day.

---

## 1. Suitable for metafield

**Settings → Metafields and metaobjects → Products → Add definition**

| Field | Value |
|---|---|
| Name | `Suitable for` (namespace and key `custom.suitable_for`) |
| Type | **List** → **Choice list (Single line text)** |
| Choices | `Permagard`, `CERFACE`, `OptiVAN`, `Honda Genuine Car Care`, spelled exactly |
| Item count, Category assignments | Leave empty |
| Options | **Use as a condition in collections**: on. **Storefront API access**: on. **Filter on the product list and in the Admin API**: on. |

Create it **before** importing; a column for a metafield that doesn't exist is ignored. Or run
[`metafield-definitions.graphql`](metafield-definitions.graphql), which sets all of this.

- [ ] Definition created, and **Use as a condition in collections** is on.

## 2. Fresh export

Live products change (prices, descriptions, stock settings), so build the import from a fresh
export, not the October one.

- [ ] **Products → Export → All products → CSV for Excel, Numbers…**. Keep a copy as the
      backup.
- [ ] Save it as `shopprotectionbrands/CSV/products_export.csv` (the script reads it from there).
- [ ] If a product's category or *Suitable for* changed on dev after October, update
      [`product-taxonomy.csv`](product-taxonomy.csv) first. Values in its *Suitable for* column
      are separated by `; `; the script converts them.

## 3. Upload the images to Files

Files don't move between stores, so the cut-outs are uploaded again on live.

- [ ] **Content → Files → Upload files**, select every file in
      `shopify-theme/product-images/upload-webp/` (the 39 `.webp` cut-outs; not the `.png`s).
- [ ] Check the names weren't changed. If a file with the same name was already in Files,
      Shopify adds a suffix and the CSV won't find it: delete the old one and upload again.
- [ ] On any one of them, **Copy link**.

## 4. Build the CSV

```bash
cd shopify-theme/product-images
python3 make-import-csv.py '<the copied link>' ../../CSV/products_import_live.csv
```

It prints how many cut-outs it used (39), which images it kept from the live photos (the ones
with no cut-out), which products now start with a cut-out (6), which have none (6, so their
card still shows a live photo), and how many products it categorised (19). Products not in the taxonomy keep
their type and vendor. The market price columns (`Price / Australia` etc.) are left out, so
market prices on live are unchanged.

- [ ] Script run; it reports 39 cut-outs and 19 products categorised.

## 5. Import

1. **Test with one product.** Copy the CSV, delete every row except one product's (all of its
   rows: one per image), then **Products → Import**:
   - tick **Overwrite products with matching handles**;
   - leave **Publish new products to all sales channels** ticked;
   - **Upload and preview**, then **Import**.

   Use a product with three treatments, e.g. `ph-neutral-vehicle-wash-500ml`.
2. **Check it** in the admin: the images are the cut-outs (transparent), each has alt text,
   *Type* is set, and **Metafields → Suitable for** shows three separate values.
3. **Import the full file** the same way. Shopify emails a summary; it should have no failed
   rows.

- [ ] Test product correct.
- [ ] Full import done, no failed rows.

## 6. Collections

Create them as in [README.md](README.md) §3 (automated, *all conditions*):

| Group | Condition |
|---|---|
| The 5 categories | **Type** is equal to the category (pick *Type*, not *Category*: *Category* is Shopify's standard taxonomy) |
| Permagard / CERFACE / OptiVAN / Honda Genuine Car Care | **Suitable for** is equal to the treatment |
| Bulk & Professional | **Tag** is equal to `Bulk` |

After saving each one, check its URL handle matches README §3 (the theme links to the
handles), and that **Online Store** is among its sales channels.

Expected on the storefront: 3 / 3 / 7 / 4 / 2 products in the categories, 17 Permagard,
14 CERFACE, 14 OptiVAN, 1 Bulk, and Honda empty until Honda products are added.

- [ ] Collections created, handles checked, counts as expected.

---

## What went wrong on dev, and why the steps are as they are

- **"Value does not exist in provided choices"**: a list metafield with several values must
  have **one value per line inside the cell**, as Shopify exports it. `Permagard; CERFACE;
  OptiVAN`, commas or a JSON list are all read as one value, and the whole product fails.
  The script writes the line-break format.
- **Suitable for missing from Add condition**: the definition's **Use as a condition in
  collections** option was off.
- **A collection showing no products**: its condition used *Category* instead of *Type*, or
  the products hadn't been imported yet. The *Type* dropdown can lag after an import; type the
  value in.
- **Product category blank in the import preview**: normal. It's set after the import, and the
  collections don't use it.
- **Old tags** (`OptiVAN`, `CERFACE Ceramic`, `Permagard Products`) are on almost every
  product, so they can't be used for treatment collections.
