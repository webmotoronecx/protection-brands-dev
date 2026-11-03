#!/usr/bin/env node
// Sets each product's "Card photos" field (custom.card_photo_media): the IDs of its images that
// are photos, through `shopify store execute`. Needs ffmpeg (brew install ffmpeg).
//
//   node card-photos.mjs --store protection-brands-dev               # report only, read-only
//   node card-photos.mjs --store protection-brands-dev --apply       # fill in products not set yet
//   node card-photos.mjs --store protection-brands-dev --apply --overwrite   # re-check them all
//
// A photo is an image with no see-through pixels and a background that isn't plain white.
// Product cards show photos full width, fading into the card; cut-outs (transparent) and
// white-background packshots are left out and shown whole on the card's grey
// (blocks/pb-card-buy.liquid, assets/pb-product-card.css). A product whose field is already
// set (even to an empty list) is left alone unless --overwrite is given, so fixes made by hand
// in admin stay. Products with no photos get an empty list, so they count as checked.

import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
let store = opt('--store');
const APPLY = args.includes('--apply');
const OVERWRITE = args.includes('--overwrite');
if (!store) {
  console.error('Usage: node card-photos.mjs --store <store> [--apply] [--overwrite]');
  process.exit(2);
}
if (!store.includes('.')) store += '.myshopify.com';

// The image is scaled to SIZE x SIZE to measure it.
const SIZE = 64;
// See-through: more than 1% of pixels under half opacity.
const TRANSPARENT_SHARE = 0.01;
// White background: 80% of the outer ring of pixels near white.
const WHITE_LEVEL = 235;
const WHITE_EDGE_SHARE = 0.8;

function gql(query, variables = {}, { mutation = false } = {}) {
  if (mutation && !APPLY) throw new Error('Refusing to run a mutation without --apply');
  const cmd = ['store', 'execute', '--store', store, '--query', query,
    '--variables', JSON.stringify(variables), '--json', '--no-input'];
  if (mutation) cmd.push('--allow-mutations');
  const out = execFileSync('shopify', cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20 });
  const doc = out.split('\n').filter((l) => l.trim()).map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter((d) => d && d.type !== 'progress').pop() ?? JSON.parse(out);
  if (doc?.errors?.length) throw new Error(doc.errors.map((e) => e.message).join('\n'));
  return doc?.data ?? doc;
}

function products() {
  const all = [];
  let after = null;
  do {
    const data = gql(`query ($after: String) {
      products(first: 100, after: $after) {
        nodes {
          id handle title
          media(first: 50) { nodes { id mediaContentType preview { image { url } } } }
          metafield(namespace: "custom", key: "card_photo_media") { value }
        }
        pageInfo { hasNextPage endCursor }
      }
    }`, { after });
    all.push(...data.products.nodes);
    after = data.products.pageInfo.hasNextPage ? data.products.pageInfo.endCursor : null;
  } while (after);
  return all;
}

// Downloads a small copy (same format, so transparency is kept) and decodes it to RGBA.
async function pixels(url) {
  const small = new URL(url);
  small.searchParams.set('width', '256');
  const res = await fetch(small);
  if (!res.ok) throw new Error(`${res.status} for ${small}`);
  const input = Buffer.from(await res.arrayBuffer());
  return execFileSync('ffmpeg', ['-v', 'error', '-i', 'pipe:0', '-vf', `scale=${SIZE}:${SIZE}`,
    '-pix_fmt', 'rgba', '-f', 'rawvideo', 'pipe:1'], { input, maxBuffer: 16 << 20 });
}

function classify(px) {
  let clear = 0;
  for (let i = 3; i < px.length; i += 4) if (px[i] < 128) clear++;
  if (clear / (SIZE * SIZE) > TRANSPARENT_SHARE) return 'cut-out';

  let edge = 0, white = 0;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (x > 1 && y > 1 && x < SIZE - 2 && y < SIZE - 2) continue;
      const i = (y * SIZE + x) * 4;
      edge++;
      if (px[i] >= WHITE_LEVEL && px[i + 1] >= WHITE_LEVEL && px[i + 2] >= WHITE_LEVEL) white++;
    }
  }
  return white / edge >= WHITE_EDGE_SHARE ? 'white packshot' : 'photo';
}

const list = products();
const changes = [];
for (const p of list) {
  const current = p.metafield ? JSON.parse(p.metafield.value) : null;
  const photos = [];
  const kinds = [];
  let failed = false;
  for (const m of p.media.nodes) {
    const url = m.preview?.image?.url;
    if (m.mediaContentType !== 'IMAGE' || !url) continue;
    let kind;
    try { kind = classify(await pixels(url)); } catch (e) { console.log(`  ! ${p.handle}: ${e.message}`); failed = true; break; }
    kinds.push(kind);
    if (kind === 'photo') photos.push(m.id.split('/').pop());
  }
  if (failed) continue;
  const same = current !== null && [...current].sort().join() === [...photos].sort().join();
  const note = current === null ? '' : same ? ' (already set)' : OVERWRITE ? ' (changing)' : ' (set by hand, left alone)';
  console.log(`  ${String(photos.length).padStart(2)} of ${String(kinds.length).padEnd(3)}${p.handle}${note}`);
  if (!same && (current === null || OVERWRITE)) {
    changes.push({ ownerId: p.id, namespace: 'custom', key: 'card_photo_media', type: 'list.single_line_text_field', value: JSON.stringify(photos) });
  }
}

console.log(`\n${list.length} products, ${changes.length} to ${APPLY ? 'set' : 'set with --apply'}.`);
if (APPLY) {
  for (let i = 0; i < changes.length; i += 25) {
    const data = gql(`mutation ($m: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $m) { userErrors { field message } } }`,
      { m: changes.slice(i, i + 25) }, { mutation: true });
    const errors = data.metafieldsSet.userErrors;
    if (errors.length) throw new Error(JSON.stringify(errors));
  }
  console.log('Done.');
}
