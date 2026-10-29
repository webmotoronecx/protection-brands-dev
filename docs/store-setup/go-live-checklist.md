# Go-live checklist: Horizon theme

Everything outside the theme code that has to be done in the Shopify admin when this theme
replaces Debut. Work top to bottom. Tick items off in this file as you go.

Detail for the bigger steps: [README.md](README.md) (catalogue, filters, menu) and
[sds.md](sds.md) (SDS page).

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

- [ ] Filters: Category (product type), Brand (vendor), Suitable for, Price, Availability.
- [ ] Remove the Tags filter.

## 4. SDS (sds.md)

- [ ] Create the **SDS document** metaobject (`sds_document`, Storefront access on).
- [ ] Create the product metafield **SDS** (`custom.sds`).
- [ ] Add an entry for each SDS PDF from SharePoint.
- [ ] Set the SDS metafield on each product that has one.
- [ ] Create the page *Safety Data Sheets*, handle `sds`. The `page.sds` template can only be
      chosen once the Horizon theme is in the store, so set it after step 6, or now on the
      unpublished theme.

### Product page extras

- [ ] Product page tabs (README §2, *Product page tabs*): create the four Tab metafield
      definitions in admin (rich text), dry-run `split-descriptions.py --store protection-brands`,
      read the report, then run it with `--apply`. Safe before launch: Debut doesn't show them.
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

## 6. Install the theme

- [ ] Add the theme as a **new, unpublished** theme: upload a zip of this repo
      (**Online Store → Themes → Add theme → Upload zip file**) or use
      `shopify theme push --unpublished`. Don't upload it into an existing theme.
- [ ] Rename it, e.g. *Protection Brands 2026*.

## 7. Theme editor (on the unpublished theme)

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

## 8. Pages

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

## 9. Apps and tracking

- [ ] **Online Store → Themes → Customize → App embeds**: turn on any app embeds the
      Debut theme had on (reviews, chat, pop-ups, etc.). They don't carry across themes.
- [ ] **Google & YouTube** app (or Settings → Customer events): confirm GA4 is
      connected. The Debut theme has no hard-coded tracking to move.
- [ ] Google Search Console: verify the domain, submit `/sitemap.xml` (brief §8, can
      follow later).

## 10. Preview and test on the unpublished theme

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

## 11. Launch

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
