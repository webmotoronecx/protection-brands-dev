#!/usr/bin/env python3
"""Maintenance-window changes on the live store that only Shopify data needs (no theme files).

Read-only unless --apply. Run it with the store password-protected (go-live-checklist.md §12).

  1. Brand collections: delete the hand-picked permagard-car-care, cerface-ceramic and
     optivan-caravan-maintenance, then move the automatic replacements built on 17 Nov
     (<handle>-new) to those handles, so the URLs stay the same.
  2. Publish to the Online Store: the 9 collections created hidden on 17 Nov, the 3 brand
     collections from step 1, the 3 unpublished pages, and the 4 active Honda products.
  3. Page templates as on dev: About Us → about; Delivery & Returns, Privacy Policy, Terms &
     Conditions → default (Horizon has no templates of theirs; their text is in the page).

Run sync-menus.py (footer, footer-brands --replace) and sync-product-media.py separately.

    python3 go-live-window.py            # plan
    python3 go-live-window.py --apply
"""
import json
import subprocess
import sys

LIVE = 'protection-brands.myshopify.com'
APPLY = '--apply' in sys.argv

BRANDS = ['permagard-car-care', 'cerface-ceramic', 'optivan-caravan-maintenance']
HIDDEN_COLLECTIONS = ['protection-brands', 'honda-genuine-car-care', 'wash-detail', 'microfibre-drying',
                      'value-packs', 'power-emergency', 'cleaners-sprays', 'bulk-professional', 'best-sellers']
PAGES_TO_PUBLISH = ['safety-data-sheets', 'care-instructions', 'locate-dealership']
HONDA_TO_PUBLISH = ['hgcc-detailing-spray-500ml', 'hgcc-multipurpose-cleaner-500ml',
                    'hgcc-ph-neutral-vehicle-wash-500ml', 'hgcc-gift-box']
PAGE_TEMPLATES = {'about-us': 'about', 'delivery-returns': '', 'privacy-policy': '', 'terms-conditions': ''}


def gql(query, variables=None, mutation=False):
    if mutation and not APPLY:
        raise SystemExit('Refusing to run a mutation without --apply')
    cmd = ['shopify', 'store', 'execute', '--store', LIVE, '--json', '--no-input', '--query', query,
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


def mutate(query, variables, field):
    payload = gql(query, variables, mutation=True)[field]
    errors = payload.get('userErrors') or []
    if errors:
        raise SystemExit(f'{field}: {errors}')
    return payload


online_store = next(p['id'] for p in gql('{ publications(first: 20) { nodes { id name } } }')['publications']['nodes']
                    if p['name'] == 'Online Store')
COLLECTION = '{ collectionByHandle(handle: %s) { id handle title ruleSet { rules { column } } publishedOnPublication(publicationId: "%s") } }'


def collection(handle):
    return gql(COLLECTION % (json.dumps(handle), online_store))['collectionByHandle']


steps = []  # (description, function)

# 1. Brand collections
for handle in BRANDS:
    old, new = collection(handle), collection(handle + '-new')
    if new and old and not old['ruleSet']:
        steps.append((f'delete hand-picked {handle} ("{old["title"]}"), move {handle}-new to {handle}',
                      lambda o=old, n=new, h=handle: (
                          mutate('mutation($i: CollectionDeleteInput!) { collectionDelete(input: $i) { userErrors { message } } }',
                                 {'i': {'id': o['id']}}, 'collectionDelete'),
                          mutate('mutation($c: CollectionInput!) { collectionUpdate(input: $c) { userErrors { message } } }',
                                 {'c': {'id': n['id'], 'handle': h, 'redirectNewHandle': False}}, 'collectionUpdate'))))
    elif old and old['ruleSet']:
        print(f'  ok        {handle} is already automatic')
    else:
        print(f'  ! check   {handle}: old={bool(old)} new={bool(new)}')

# 2. Publish
def publish_step(label, find):
    def go():
        target = find()
        mutate('mutation($id: ID!, $p: ID!) { publishablePublish(id: $id, input: [{ publicationId: $p }]) { userErrors { message } } }',
               {'id': target, 'p': online_store}, 'publishablePublish')
    steps.append((f'publish {label}', go))


for handle in HIDDEN_COLLECTIONS + BRANDS:
    # A brand's replacement is still at <handle>-new until step 1 runs; that's the one to publish.
    c = (collection(handle + '-new') if handle in BRANDS else None) or collection(handle)
    if c and c['publishedOnPublication'] and c['handle'] == handle:
        print(f'  ok        collection {handle} is on the Online Store')
        continue
    publish_step(f'collection {handle}', lambda h=handle: collection(h)['id'])

for handle in PAGES_TO_PUBLISH:
    page = next((p for p in gql('{ pages(first: 5, query: %s) { nodes { id handle isPublished } } }' % json.dumps(f'handle:{handle}'))['pages']['nodes']
                 if p['handle'] == handle), None)
    if not page:
        print(f'  ! missing page {handle}')
    elif page['isPublished']:
        print(f'  ok        page {handle} is published')
    else:
        steps.append((f'publish page {handle}', lambda i=page['id']: mutate(
            'mutation($id: ID!, $p: PageUpdateInput!) { pageUpdate(id: $id, page: $p) { userErrors { message } } }',
            {'id': i, 'p': {'isPublished': True}}, 'pageUpdate')))

for handle in HONDA_TO_PUBLISH:
    p = gql('{ productByHandle(handle: %s) { id status publishedOnPublication(publicationId: "%s") } }' % (json.dumps(handle), online_store))['productByHandle']
    if p['publishedOnPublication']:
        print(f'  ok        product {handle} is on the Online Store')
    else:
        publish_step(f'product {handle} ({p["status"]})', lambda i=p['id']: i)

# 3. Page templates
for handle, suffix in PAGE_TEMPLATES.items():
    page = next((p for p in gql('{ pages(first: 5, query: %s) { nodes { id handle templateSuffix } } }' % json.dumps(f'handle:{handle}'))['pages']['nodes']
                 if p['handle'] == handle), None)
    if page and (page['templateSuffix'] or '') != suffix:
        steps.append((f'page {handle} template "{page["templateSuffix"] or "default"}" → "{suffix or "default"}"',
                      lambda i=page['id'], s=suffix: mutate(
                          'mutation($id: ID!, $p: PageUpdateInput!) { pageUpdate(id: $id, page: $p) { userErrors { message } } }',
                          {'id': i, 'p': {'templateSuffix': s}}, 'pageUpdate')))

for label, _ in steps:
    print(f'  + {label}')
print(f'\n{len(steps)} change(s).')
if not APPLY:
    print('Plan only; nothing was changed. Run again with --apply.')
    raise SystemExit
for label, go in steps:
    go()
    print(f'  done  {label}')
print('Done. Run without --apply: it should list no changes.')
