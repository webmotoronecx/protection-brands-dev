# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The new Protection Brands storefront theme for the 2026 revamp, built on **Shopify Horizon 4.2.0** (Online Store 2.0, with theme blocks). It will replace the Debut theme in `../LIVE_THEME`. The brief is `../../PB Shopify Revamp Scope_917070272.docx`. Honda Genuine Car Care goes live on 4 Nov 2026.

**Build locally only.** Do not run `shopify theme push`/`publish` against the store unless explicitly asked.

## Commands

```bash
shopify theme check                                   # lint (stock Horizon baseline: 6 warnings)
shopify theme dev -e dev                              # local preview on the dev store (hidden development theme)
shopify theme push -e dev-theme                       # update "PB Horizon (dev)", the dev store's published theme
shopify theme push -e live-preview                    # update "PB Horizon (preview)", unpublished on the live store
```

Environments are in `shopify.theme.toml`. Never push to Debut (#91263697031), the live store's published theme.

## Upstream

`upstream` is github.com/Shopify/horizon. To pull a Horizon update, run `git fetch upstream && git merge upstream/main`. Prefer adding new sections, blocks and snippets over editing stock files, so upstream merges stay clean.
