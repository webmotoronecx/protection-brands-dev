# Amendments 10 Nov 2026: dev → live runbook

From `PB Shopify Amendments_09112026.docx`. Everything is built and checked on the **dev store**
(`protection-brands-dev`) first. Once the client approves, repeat the steps below on the **live
store** (`protection-brands`) in this order.

**Before you start on live.** Menus, products, collections and prices are shared by every theme on
a store. Live still runs Debut, so the steps marked **(changes Debut)** change the current live site
the moment you save them. Do those at the switch to the new theme, or once the client is happy for
Debut to change too. The IDs in this file are dev's; live's differ, so find everything by handle or
title.

## Status

| # | Item | Dev | Live |
|---|---|---|---|
| 0 | Theme files (logos, header, tiles, Best Sellers, brand text section, scroll fix) | Done (local theme) | Push theme |
| 1 | Categories: Wash & Detail, Microfibre & Drying, Value Packs, Power & Emergency | Done 11 Nov | To do |
| 2 | Best Sellers collection | Done 11 Nov | To do |
| 3 | HGCC: three dealer kits to Draft, Gift Box $99 | Done 11 Nov | To do |
| 4 | Brand page text | Done 11 Nov | To do |
| 5 | Footer menus: Our Brands, Shop | Done 11 Nov | To do |
| 6 | Footer menu: Information (remove two, add Warranty & Care, Privacy Policy link) | Done 11 Nov | To do |
| 7 | Contact form email to auto.admin@protectionbrands.com.au | Not on dev | At the switch |
| 8 | Brand page images | Waiting on client | Waiting on client |
| 9 | SDS sheets (Honda, Mazda, Mitsubishi, Permagard, Protection Brands) | Done 11 Nov | To do |
| 10 | Brand page layout (mock): one template per brand | Done 11 Nov | Set each collection's template |

## 0. Theme

Theme files only, nothing in the admin. Push with `shopify theme push -e live-preview` (unpublished
theme on live), after merging `origin/main`.

- Homepage and every page's brand logo row: Oridon removed, Protection Brands and Honda Genuine Car
  Care added, order Protection Brands, CERFACE, OptiVAN, Permagard, Honda Genuine Car Care. Default
  logos are in the theme (`assets/logo-black.png`, `assets/logo-hgcc.png`), so nothing to pick.
- Header: no Brands link or panel. Locate Dealership is now **Contact Us** (`/pages/contact-page`).
  Same in the phone menu, which no longer lists the brands.
- Category tiles, header category list and phone menu: `wash-detail`, `microfibre-drying`,
  `value-packs`, `power-emergency`. They need step 1 on live, or those tiles are empty.
- Homepage Best Sellers and the header's Best Sellers link: the `best-sellers` collection (step 2),
  6 products. Without it they fall back to all products by best selling.
- Brand pages show their collection's description under the products (step 4).
- Smooth scrolling on desktop no longer stops at the old bottom of the page when a collection loads
  more products (`assets/pb-motion.js`).

**Theme editor check on live.** If someone picked menus or collections in the theme editor on live
(Header (PB) → Header links, Floating menu, Categories; Collection header → Categories), check they
don't still point at Brands, Locate Dealership or the old categories.

## 1. Categories (changes Debut)

Wash & Shampoo, Cleaners & Sprays and Bulk & Professional merge into **Wash & Detail**. Kits & Packs
becomes **Value Packs**. Do the products before the collections, or the renamed collections are
empty for a moment.

1. **Products → bulk edit → Product type.** Change every product typed:
   - `Wash & Shampoo` → `Wash & Detail`
   - `Cleaners & Sprays` → `Wash & Detail`
   - `Kits & Packs` → `Value Packs` (include the Draft HGCC kits, so they stay grouped)

   On dev this was 17 products: 9 to Wash & Detail and 8 to Value Packs. The `Bulk` tag stays on the
   20L shampoo drum; it's typed Wash & Shampoo, so it moves with the others. Products typed
   `Professional` or `RETAIL` were all Draft or unlisted on dev and were left alone; check on live.
2. **Products → Collections → Wash & Shampoo.** Title **Wash & Detail**. Condition: Product type is
   equal to `Wash & Detail`. Search engine listing → URL handle `wash-detail`, tick **Create a URL
   redirect**. Save.
3. **Kits & Packs.** Title **Value Packs**. Condition: Product type is equal to `Value Packs`.
   Handle `value-packs`, tick **Create a URL redirect**. Save.
4. **Cleaners & Sprays** and **Bulk & Professional**: untick the **Online Store** sales channel (on
   dev they were hidden, not deleted).
5. **Online Store → Navigation → URL redirects**: add `/collections/cleaners-sprays` →
   `/collections/wash-detail` and `/collections/bulk-professional` → `/collections/wash-detail`.
   Or run `node setup-store.mjs --store protection-brands --apply --only redirects`, which creates all
   four listed in `setup-store.json` and skips any that exist.
6. Check: Wash & Detail had 9 products on dev, Value Packs 8 (5 on the shop, plus 3 Draft kits).

If a handle is already taken on live, Shopify quietly adds `-1`. Check each handle after saving.

## 2. Best Sellers

**Products → Collections → Create collection.** Title **Best Sellers**, type **Manual**, handle
`best-sellers`, Online Store sales channel on. Add the products in this order and set sort to
**Manually**. Then check each price.

| # | In the doc | Product | Handle | Price |
|---|---|---|---|---|
| 1 | PB pH Neutral Vehicle Wash 500ml | pH Neutral Vehicle Wash (500ml) | `ph-neutral-vehicle-wash-500ml` | $19.95 |
| 2 | PB Multipurpose Spray 500ml | Multipurpose Citrus Cleaning Spray | `car-shampoo-citrus-multipurpose-cleaner-500ml` | $24.95 |
| 3 | PB Detailing Spray | Car/Caravan Quick Hydrophobic Detailing Spray | `hydrophobic-detailing-finishing-spray` | $49.95 |
| 4 | PB Deluxe Exterior Wash Pack | Deluxe Exterior Wash Pack | `optivan-deluxe-wash-pack` | $149.95 |
| 5 | Microfibre Cloth/Towel | Microfibre Cloth/Towel: Plush | `plush-microfibre-cloth` | $19.95 |
| 6 | Microfibre Noodle Wash Mitt | Microfibre Noodle Wash Mitt | `microfibre-noodle-wash-mitt` | $14.95 |

Rows 3 and 5 matched by price: the Basic microfibre cloth is $4.95, and the Honda detailing spray
is $29.95. All six prices already matched on dev. Not visible on Debut until something links to it.

## 3. Honda Genuine Car Care products (changes Debut)

1. Set to **Draft** (dealer use only), don't delete:
   - `hgcc-interior-protection-giftbox`: Interior Protection & Gift Box
   - `hgcc-full-vehicle-kit-antimicrobial-giftbox`: Full Vehicle Kit with Antimicrobial Shield & Gift Box
   - `hgcc-exterior-ceramic-protection-giftbox`: Exterior Ceramic Protection & Gift Box
2. `hgcc-gift-box`, *Honda Genuine Car Care Gift Box*: price **$99.00**. Prices include GST on dev
   (Settings → Taxes and duties → "Include tax in prices"); check the same on live.

## 4. Brand pages

For each brand collection: **Products → Collections → (brand) → Description → Show HTML
(`<>`)**, replace everything with the file's contents, then save.

| Collection | File |
|---|---|
| `protection-brands` | `brand-copy/protection-brands.html` |
| `cerface-ceramic` | `brand-copy/cerface-ceramic.html` |
| `optivan-caravan-maintenance` | `brand-copy/optivan-caravan-maintenance.html` |
| `permagard-car-care` | `brand-copy/permagard-car-care.html` |
| `honda-genuine-car-care` | `brand-copy/honda-genuine-car-care.html` |

- The text is the doc's, word for word, including the "Discover …" links to optivan.com.au,
  permagardautomotive.com.au and honda.com.au.
- Before replacing, copy any existing description into this file. On dev only Permagard had one:
  "Permagard ensures your vehicle is protected by the market’s most tested and proven coating
  technology".
- **(changes Debut)** if Debut shows collection descriptions on these pages. Check one on live
  before and after.
- The brand collections need the `brand` template (README §3), or the new layout doesn't show.
  Since 11 Nov each has its own template instead (below); the description is kept for search
  engines and as the source of the text.

### Brand page layout (11 Nov, from `mocks/brand-protectionbrands.png`)

Each brand has its own template, filled with its text from `brand-copy/`. Under the unchanged
banner, in order:

1. Intro: brand name label, the tagline large on the left, the opening paragraphs on the right.
2. "<Brand> Products": the brand collection's products in a sideways row. **View all** opens
   the same collection with the full grid and filters (`?view=brand`, the `collection.brand`
   template, unchanged).
3. Image and text rows, photo left and right in turn, one per subheading of the copy. Lists
   show in two columns with red bullets.
4. Trust strip: Australian Owned, Made for dealer-applied protection, Fast AU shipping.
5. Banner: the closing bold line over a photo. OptiVAN, Permagard and HGCC have their
   "Discover …" button (opens their site in a new tab).
6. Our brands logos.

Sections: **Image with text (PB)** (`pb-feature-rows`: rows and banner, one block per row,
Layout = Text / Image left / Image right / Banner, optional button and watermark word) and
**Trust strip (PB)** (`pb-trust-strip`). Both can be added to any page.

| Collection | Template (Theme template in the collection's admin page) |
|---|---|
| `protection-brands` | `brand-protection-brands` |
| `cerface-ceramic` | `brand-cerface` |
| `optivan-caravan-maintenance` | `brand-optivan` |
| `permagard-car-care` | `brand-permagard` |
| `honda-genuine-car-care` | `brand-hgcc` |

**Live:** the templates only appear once the Horizon theme is installed. After installing, set
each collection's **Theme template** as above (it doesn't change Debut, which ignores the
templates it doesn't have). Edit the words and photos per brand in **Customize → Collections →
(template)**, not in the collection description.

Photos: every row and banner has an empty image slot until the client sends images (step 9).
Protection Brands has its three row photos (11 Nov, square, in the dev store's Files:
`pb-protection-every-surface.webp`, `pb-trusted-manufacturers.webp`, `pb-support-beyond.webp`;
upload them to live's Files under the same names, go-live checklist §6).
OptiVAN has its three row photos and its banner photo (11 Nov): `optivan-advanced-protection.webp`,
`optivan-design-australian.webp`, `optivan-protection-trust.webp`, `optivan-feat-row.webp`.
Permagard has its two row photos and its banner photo (11 Nov): `perma-comprehensive.webp`,
`perma-professionally.webp`, `perma-feat-row.webp`.
Honda Genuine Car Care has its banner photo (11 Nov): `hgcc-feat-row.webp`; its rows keep the default image.
Without a photo a row shows the default image (`assets/image-default.webp`, dark with the logo), and the banner `assets/pb-feat-row.webp` (a detailer polishing a black car).

## 5. Footer menus: Our Brands and Shop

**Online Store → Navigation.** These two menus were made for the new theme. Check whether Debut uses
them on live; if it does, they're **(changes Debut)**.

- **Footer brands** (`footer-brands`): remove Oridon. Order: Protection Brands, CERFACE, OptiVAN,
  Permagard, Honda Genuine Car Care. All link to their brand collections.
- **Footer shop** (`footer-shop`): Shop All (`/collections/all`), Wash & Detail, Microfibre & Drying,
  Value Packs, Power & Emergency. Remove Cleaners & Sprays and Bulk & Professional. Do this after
  step 1.

If these menus don't exist on live yet, `setup-store.mjs --only menus` creates them from
`setup-store.json`, which has the new versions. It never changes a menu that already exists.

## 6. Footer menu: Information (changes Debut)

Done on dev 11 Nov. The `footer` menu is Debut's live footer too, so change it at the switch.
Final order on dev:

1. About Us → `/pages/about-us`
2. Contact Us → `/pages/contact-page`
3. Delivery & Returns → `/pages/delivery-returns`
4. Terms & Conditions → `/pages/terms-conditions`
5. Privacy Policy → `https://motoronegroup.com/privacy-policy/` (the old site's link, until the
   client confirms which policy is current; the store's `privacy-policy` page and
   `Privacy Policy.docx` are on hold)
6. Safety Data Sheets → the SDS page (`/pages/safety-data-sheets` on dev; check the handle on live)
7. **Warranty & Care** → `https://spark.permagard.com.au/warrantyclaim/` (one link, as in the
   doc's mock-up, to the old site's Warranty Claim page)

Removed: **Locate Dealership** and **Refer a Friend**. The old site's separate Care Instructions
link (`/blogs/car-care-tips/exterior-interior-vehicle-care-tips`) isn't in the footer any more;
the article still exists.

The spark.permagard.com.au site blocks automated checks, so click the Warranty & Care link in a
browser to confirm it opens.

## 7. Contact Us email (at the switch)

The Contact Us links go to `/pages/contact-page`. Its form sends to the store's contact email
(**Settings → General → Store contact**). Change it to **auto.admin@protectionbrands.com.au**. It's
also the reply-to address on customer notifications, so confirm with the client first.

## 8. SDS sheets

Done on dev 11 Nov: 33 sheets from `files/SDS/more-sds` (Honda 7 from the *New - 11.9.2026*
folder, the *Old* folder left out; Mazda 4; Mitsubishi 9; Permagard 10; Protection Brands 3), with
names, brands and dates from `sds-sheets.json`. Eight products now link to their sheet (list in
`sds-products.json`). Not visible on Debut.

On live:

1. **Content → Metaobjects → SDS document → Manage definition → Brand**: add the choices `Mazda`
   and `Mitsubishi`, or the entries for those brands are refused.
2. From `docs/store-setup/`: `node upload-sds.mjs --store protection-brands --link-products`
   (plan, read-only), read it, then add `--apply`. Run the plan again afterwards: every line
   should be `ok`.
3. Any `! differs` line is a product already pointing at another sheet. On dev the pH Neutral
   Vehicle Wash pointed at the CERFACE Beyond Interior sheet by mistake; it now points at
   *Protection Brands pH Neutral Vehicle Wash*. Fix the same way on live in the product's **SDS**
   field.
4. The SDS page sidebar lists Protection Brands, CERFACE, OptiVAN, Permagard, Honda Genuine Car
   Care, Mazda, Mitsubishi (theme, `templates/page.sds.json`).

## 9. Waiting on the client

- **Brand page images:** each brand in the doc says "[Insert any … images where applicable]". None
  supplied yet. Slots per brand template (step 4): one per image row and one banner. Protection
  Brands, CERFACE and OptiVAN 3 + 1; Permagard and HGCC 2 + 1. Landscape, at least 1600 px
  wide; banners at least 2400 px wide.

## Check on live after the switch

- Homepage: five brand logos in order, Best Sellers shows the 6 products, four category tiles all
  with photos.
- Header: Shop By Category, Best Sellers, Contact Us. Phone menu: categories, Best Sellers, Contact
  Us.
- Footer: the three columns as in steps 5 and 6. Click every link, including Warranty & Care.
- Old links redirect: `/collections/wash-shampoo`, `/collections/cleaners-sprays`,
  `/collections/bulk-professional`, `/collections/kits-packs`.
- Each brand page: intro, its products (View all opens the full grid), image rows, trust strip,
  banner (with the Discover button on OptiVAN, Permagard, HGCC), logos.
- The three HGCC kits don't appear anywhere; the Gift Box shows $99.00.
- Contact form: send a test message and check it arrives at auto.admin@.
- SDS page: 40 sheets, each brand button filters; open one PDF per brand. Product pages for the
  eight linked products show "Safety Data Sheet (PDF)".
