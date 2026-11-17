# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The new Protection Brands storefront theme for the 2026 revamp, built on **Shopify Horizon 4.2.0** (Online Store 2.0, with theme blocks). It will replace the Debut theme in `../LIVE_THEME`. The brief is `../../PB Shopify Revamp Scope_917070272.docx`. Honda Genuine Car Care goes live on 4 Nov 2026.

**Build locally only.** Do not run `shopify theme push`/`publish` against the store unless explicitly asked.

## Commands

```bash
shopify theme check                                   # lint (stock Horizon baseline: 6 warnings)
shopify theme dev -e dev                              # local preview on the dev store (hidden development theme)
shopify theme push -e dev-theme --allow-live          # update "PB Horizon (dev)", the dev store's published theme
shopify theme push -e live-preview --allow-live       # update "PB Horizon (preview)": the LIVE store's published theme since 17 Nov 2026
```

Environments are in `shopify.theme.toml`. Since 17 Nov 2026 the live store (protection-brands) runs this theme: `live-preview` is its **published** theme, so a push there changes the live site at once; only push it when explicitly asked. Debut (#91263697031) is unpublished, kept as the rollback; never push to it.

## Upstream

`upstream` is github.com/Shopify/horizon. To pull a Horizon update, run `git fetch upstream && git merge upstream/main`. Prefer adding new sections, blocks and snippets over editing stock files, so upstream merges stay clean.
