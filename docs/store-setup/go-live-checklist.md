# Go-live checklist: Horizon theme

Everything outside the theme code that has to be done in the Shopify admin when this theme
replaces Debut. Work top to bottom. Tick items off in this file as you go.

Detail for the bigger steps: [README.md](README.md) (catalogue, filters, menu) and
[sds.md](sds.md) (SDS page).

Client amendments of 10 Nov 2026 (categories, Best Sellers, HGCC kits, brand text, footer menus):
[amendments-2026-11-10.md](amendments-2026-11-10.md). Done on dev; repeat on live from there.

## 1. Before you start

- [ ] Duplicate the live Debut theme (**Online Store → Themes → … → Duplicate**) and keep the
      copy unpublished as a rollback.
- [ ] Delete the theme from the failed upload attempt (the one with the
      "already exists with liquid extension" errors), if it's still there.
- [ ] **Products → Export** all products as a backup.

## 2. Catalogue data (README §1–3)

Create the categories from [categories-dev-to-live.md](categories-dev-to-live.md), the record
of what was finalised on the dev store.

These changes show on the live Debut site straight away. They're safe there, because Debut
doesn't use them, but do them close to launch day.

- [ ] Import the products with their cut-out images, categories and *Suitable for*: follow
      [product-import.md](product-import.md) (metafield, fresh export, Files upload, CSV,
      import, collections).
- [ ] Set type and vendor on any hidden products that should go live, and publish them to
      the Online Store sales channel.
- [ ] Give each collection from product-import.md §6 an image and description.
- [ ] Decide on **Accessories** (narrow it or hide it).
- [ ] Fix **Reapplication** and **Warranty Transfer**: publish their products or point the
      links at pages.

## 3. Search & Discovery (README §4)

- [ ] Filters: Category (product type), Brand (vendor), Suitable for.
- [ ] Remove the Tags filter. Price and Availability can go too: the collection pages hide
      them (the filter row shows sort pills instead), so they'd only show on Shopify's own
      filter drawer.

## 4. SDS (sds.md)

- [ ] Create the **SDS document** metaobject (`sds_document`, Storefront access on).
- [ ] Create the product metafield **SDS** (`custom.sds`).
- [ ] Add an entry for each SDS PDF from SharePoint.
- [ ] Set the SDS metafield on each product that has one.
- [ ] Create the page *Safety Data Sheets*, handle `sds`. The `page.sds` template can only be
      chosen once the Horizon theme is in the store, so set it after step 7, or now on the
      unpublished theme.

### Brand pages

- [ ] Brand collection fields (README §3): create the definitions with setup-store.mjs and fill
      Brand logo (light version), Tagline, Hero product and, for a full-screen banner, Hero image.
- [ ] Set each brand collection's template to its own `brand-<brand>` template
      ([amendments-2026-11-10.md](amendments-2026-11-10.md) §4, *Brand page layout*). Keep
      `collection.brand` in the theme: it is the brand's "View all" grid (`?view=brand`).

### Product page extras

- [ ] Product page tabs (README §2, *Product page tabs*): create the four Tab metafield
      definitions in admin (rich text), dry-run `split-descriptions.py --store protection-brands`,
      read the report, then run it with `--apply`. Safe before launch: Debut doesn't show them.
- [ ] **Card photos** (`custom.card_photo_media`, created by setup-store.mjs): which of a
      product's images are photos, shown full width on product cards and in the card's photo
      slides. Fill it after the product images are in (step 2): run
      `node card-photos.mjs --store protection-brands` (report only), check the report, then
      add `--apply`. Needs ffmpeg. Fix any wrong guesses by hand in the product's metafields.
      Products without it show their images whole on the grey card, so it's safe to leave
      some empty.
- [ ] Optional product metafield **How to use** (`custom.how_to_use`, rich text or multi-line
      text). Products with it show a "How to use" row under Add to cart.
- [ ] Check the **Delivery & returns** wording on the product page (Theme editor → Product →
      Product info rows (PB)); its link points to `/pages/delivery-returns`.

## 5. Navigation (README §5)

The main menu is shared by all themes, so a mega-menu layout would change Debut's menu
too. Either build it on launch day, or build it as a new menu (handle `main-menu-2026`)
and switch the header to it in the theme editor.

- [ ] Main menu: Shop (By category, By brand, Professional / Bulk), Services, Car Care Tips,
      SDS, About Us, Contact.
- [ ] Footer menu (`footer`): policies, Delivery, Terms & Conditions, Privacy Policy,
      Contact.
- [ ] Collection pages: pick the category row (Theme editor → Collection page → Collection
      header (PB) → Categories). Also pick the menu categories on inner pages (Header (PB)).
- [ ] Homepage floating menu: uses `main-menu` by default (Theme editor → Home page →
      Landing header → Floating menu). Top-level links only for now.
- [ ] Homepage footer row: uses the `footer` menu by default (Theme editor → Home page →
      Landing footer). The design shows, in order: Contact Us, Delivery & Returns, Warranty
      Claim, Privacy Policy, About Us, Terms & Conditions, Care Instructions, Refer a Friend,
      SDS. Top-level links only.

## 6. Store files the theme uses

Some theme settings point at images in **Content → Files**, not in the theme, so they don't
come with the theme upload. Download them from the dev store's Files and upload them to the
live store **under the same file names** before installing the theme, or those spots show
blank:

- [ ] `favicon-pb.png`: favicon (Theme settings → Logo and favicon).
- [ ] `bento-showroom.webp`, `bento-permagard.webp`, `bento-cerface.webp`,
      `bento-optivan.webp`: homepage bento tiles.
- [ ] `brand-logo-cerface.png`, `brand-logo-optivan.png` and the Permagard logo: bento tile
      logos. On dev the Permagard one was renamed by Shopify
      (`brand-logo-permagard_27fd2ac9-….png`), so upload it as `brand-logo-permagard.png`
      and pick it again on the Permagard bento tile in step 8.
- [ ] `AtHomeDetailersKit.png`: the default hero image on the brand page template.
- [ ] `pb-protection-every-surface.webp`, `pb-trusted-manufacturers.webp`,
      `pb-support-beyond.webp`: the Protection Brands page's three image rows
      (`collection.brand-protection-brands`). Copies are in the dev store's Files.
- [ ] `optivan-advanced-protection.webp`, `optivan-design-australian.webp`,
      `optivan-protection-trust.webp` and `optivan-feat-row.webp` (banner): the OptiVAN page
      (`collection.brand-optivan`). Copies are in the dev store's Files.
- [ ] `perma-comprehensive.webp`, `perma-professionally.webp` and `perma-feat-row.webp`
      (banner): the Permagard page (`collection.brand-permagard`). Copies are in the dev store's Files.

After installing, open the home page and a brand page in the theme editor and check every
image slot is filled. To find the full list again: `grep -rhoE 'shopify://shop_images/[^"]+'
templates config sections | sort -u`.

## 7. Install the theme

- [ ] Add the theme as a **new, unpublished** theme: upload a zip of this repo
      (**Online Store → Themes → Add theme → Upload zip file**) or use
      `shopify theme push --unpublished`. Don't upload it into an existing theme.
- [ ] Rename it, e.g. *Protection Brands 2026*.

## 8. Theme editor (on the unpublished theme)

Placeholders from stock Horizon that must be replaced:

- [ ] **Logo** and **favicon** (Theme settings → Logo and favicon).
- [ ] **Announcement bar**: replace "Welcome to our store", or remove it.
- [ ] **Home hero**: add the banner image; replace "Browse our latest products".
- [ ] **Inner-page footer** (Footer (PB)): set each column's menu (Information = `footer`,
      Shop = `main-menu` by default). "Our brands" holds the OptiVAN/Permagard site and
      Instagram links. Horizon's old footer and copyright/policy bar are switched off, not
      deleted; re-enable them in the theme editor if a copyright line or policy links are needed.
- [ ] **Newsletter signups** (footer and homepage menu): go to Shopify customers, tagged
      `newsletter`, with email marketing on. Confirm that's wanted.
- [ ] **Header**: menu set to the main menu (or `main-menu-2026`).
- [ ] **Colours**: the new design once it's ready. Fonts are Manrope; colours are Horizon's
      defaults (black and white) until then.

## 9. Pages

- [ ] **Delivery, Privacy Policy, Terms & Conditions**: they used Debut's `page.delivery`,
      `page.privacy-policy` and `page.terms-conditions` templates. Horizon doesn't have
      them, so these pages fall back to the default page template. Their text is safe
      (it's in the page content). Only the Debut banner image goes, so check each page looks right.
- [ ] **Contact** (`contact-page`): template `page.contact`. Send a test message.
- [ ] **About Us**: updated copy (brief §6).
- [ ] **Refer a friend** (`refer-a-friend`): default page template; check it reads right.
- The six live pages (handles above plus `delivery-returns`) are copied into `setup-store.json`
  for the dev store. On live they already exist and the script leaves them alone.
- [ ] **Safety Data Sheets**: template `page.sds` (step 4).

## 10. Apps and tracking

- [ ] **Online Store → Themes → Customize → App embeds**: turn on any app embeds the
      Debut theme had on (reviews, chat, pop-ups, etc.). They don't carry across themes.
- [ ] **Google & YouTube** app (or Settings → Customer events): confirm GA4 is
      connected. The Debut theme has no hard-coded tracking to move.
- [ ] Google Search Console: verify the domain, submit `/sitemap.xml` (brief §8, can
      follow later).

## 11. Preview and test on the unpublished theme

Use **Preview** (and the share-preview link on a phone, iOS and Android):

- [ ] Every main-menu and footer link lands on a working page.
- [ ] Home page: 3D bottles load, follow the mouse, and both headings link to the right collections.
- [ ] Collection filters narrow correctly; sorting works.
- [ ] Search dropdown finds "shampoo", "microfibre", "jump starter".
- [ ] Product page: images, price, add to cart, SDS link where set.
- [ ] Cart drawer: quantity change, remove, discount code, checkout button.
- [ ] Place a test order (Bogus Gateway or a 100% discount), then cancel or refund it.
- [ ] `/pages/sds`: brand groups, search, PDFs open.
- [ ] Footer: OptiVAN and Permagard websites and Instagram open in a new tab.
- [ ] Old URLs still load: `/collections/car-care`, `/collections/accessories`,
      `/collections/permagard-car-care`, `/blogs/car-care-tips`, `/pages/about-us`.

## 12. Launch

- [ ] **Publish** the Horizon theme.
- [ ] Repeat the menu, add-to-cart and checkout checks on the live domain.
- [ ] **Online Store → Navigation → URL redirects**: check the 404 report over the
      following week and add redirects for anything customers or Google still request.
- [ ] Keep the Debut backup unpublished for at least a month.

## Open questions

- OptiVAN Instagram uses `instagram.com/protection_brands` for now. Swap it in the footer
  (Our brands → OptiVAN → Social icons) if OptiVAN gets its own account.
- Protection Brands' own social accounts, if any, go in the footer's bottom
  **Social icons** block (currently empty).
- Content cut-off date for SharePoint files (brief, still to be agreed).
