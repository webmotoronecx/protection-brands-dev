#!/usr/bin/env python3
"""Copy product images and vendor from the dev store to the live store, by handle.

For the maintenance window (go-live-checklist.md §12): the dev store holds the finished
catalogue (cut-out images in their final order, with alt text, and the Permagard vendor on the
five Permagard-named products). This makes live match it, product by product:

  - Images: if a product's images differ from dev's (by file name, in order), dev's images are
    added to the live product in dev's order, then the live product's old images are removed.
    Products whose dev images are only the "coming soon" placeholder are skipped.
  - Vendor: set to dev's where it differs.

Read-only unless --apply. Through `shopify store execute`, so both stores need a CLI login.

    python3 sync-product-media.py              # plan
    python3 sync-product-media.py --apply      # do it
"""
import json
import subprocess
import sys
import time

DEV = 'protection-brands-dev.myshopify.com'
LIVE = 'protection-brands.myshopify.com'
APPLY = '--apply' in sys.argv
PLACEHOLDER = 'PRODUCTIMAGECOMINGSOON'


def gql(store, query, variables=None, mutation=False):
    if mutation and not APPLY:
        raise SystemExit('Refusing to run a mutation without --apply')
    cmd = ['shopify', 'store', 'execute', '--store', store, '--json', '--no-input', '--query', query,
           '--variables', json.dumps(variables or {})]
    if mutation:
        cmd.append('--allow-mutations')
    run = subprocess.run(cmd, capture_output=True, text=True)
    out = '\n'.join(l for l in run.stdout.splitlines() if not l.startswith('{"type"'))
    if '{' not in out:
        raise SystemExit(run.stdout[-800:] + run.stderr[-800:])
    data = json.JSONDecoder().raw_decode(out[out.index('{'):])[0]
    if 'error' in data:
        raise SystemExit(json.dumps(data)[:800])
    return data.get('data', data)


PRODUCTS = '''query($a: String) { products(first: 100, after: $a) {
  nodes { id handle title vendor media(first: 30) { nodes { id alt ... on MediaImage { image { url } } } } }
  pageInfo { hasNextPage endCursor } } }'''


def products(store):
    found, after = {}, None
    while True:
        page = gql(store, PRODUCTS, {'a': after})['products']
        for p in page['nodes']:
            found[p['handle']] = p
        if not page['pageInfo']['hasNextPage']:
            return found
        after = page['pageInfo']['endCursor']


def file_name(media):
    return (media.get('image') or {}).get('url', '').split('/files/')[-1].split('?')[0]


live, dev = products(LIVE), products(DEV)
plan = []
for handle, lp in sorted(live.items()):
    dp = dev.get(handle)
    if not dp:
        continue
    l_files = [file_name(m) for m in lp['media']['nodes']]
    d_media = [m for m in dp['media']['nodes'] if m.get('image')]
    d_files = [file_name(m) for m in d_media]
    images = d_files != l_files and d_files and not all(PLACEHOLDER in f for f in d_files)
    vendor = dp['vendor'] != lp['vendor']
    if images or vendor:
        plan.append((lp, dp, d_media if images else None, dp['vendor'] if vendor else None))

for lp, dp, media, vendor in plan:
    parts = []
    if media:
        parts.append(f"images {len(lp['media']['nodes'])} → {len(media)}")
    if vendor:
        parts.append(f"vendor {lp['vendor']} → {vendor}")
    print(f"  {lp['handle'][:60]:60} {' | '.join(parts)}")
print(f"\n{sum(1 for p in plan if p[2])} products get dev's images, {sum(1 for p in plan if p[3])} get dev's vendor.")

if not APPLY:
    print('Plan only; nothing was changed. Run again with --apply.')
    raise SystemExit

for lp, dp, media, vendor in plan:
    if vendor:
        r = gql(LIVE, 'mutation($p: ProductUpdateInput!) { productUpdate(product: $p) { userErrors { message } } }',
                {'p': {'id': lp['id'], 'vendor': vendor}}, mutation=True)['productUpdate']
        assert not r['userErrors'], r
    if media:
        new = [{'originalSource': m['image']['url'].split('?')[0], 'alt': m['alt'] or dp['title'],
                'mediaContentType': 'IMAGE'} for m in media]
        r = gql(LIVE, '''mutation($id: ID!, $m: [CreateMediaInput!]!) {
              productCreateMedia(productId: $id, media: $m) { media { id } mediaUserErrors { message } } }''',
                {'id': lp['id'], 'm': new}, mutation=True)['productCreateMedia']
        assert not r['mediaUserErrors'], r
        old = [m['id'] for m in lp['media']['nodes']]
        if old:
            r = gql(LIVE, '''mutation($id: ID!, $m: [ID!]!) {
                  productDeleteMedia(productId: $id, mediaIds: $m) { mediaUserErrors { message } } }''',
                    {'id': lp['id'], 'm': old}, mutation=True)['productDeleteMedia']
            assert not r['mediaUserErrors'], r
    print(f"  done  {lp['handle']}")
    time.sleep(0.3)
print('Done. Run without --apply to check: it should list nothing.')
