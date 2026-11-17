#!/usr/bin/env python3
"""Copy menus from the dev store to the live store, by handle.

Each link is matched to the live store's page, collection or product with the same handle; web
links are copied as they are. A menu missing on live is created; an existing one has its items
replaced with dev's (only with --replace, because the `footer` menu is shared with Debut).

Read-only unless --apply.

    python3 sync-menus.py footer-shop footer-brands             # plan
    python3 sync-menus.py footer-shop footer-brands --apply     # create them
    python3 sync-menus.py footer --replace --apply              # maintenance window only
"""
import json
import subprocess
import sys

DEV = 'protection-brands-dev.myshopify.com'
LIVE = 'protection-brands.myshopify.com'
APPLY = '--apply' in sys.argv
REPLACE = '--replace' in sys.argv
HANDLES = [a for a in sys.argv[1:] if not a.startswith('--')]


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


ITEM = 'title type url resourceId'
MENUS = '{ menus(first: 50) { nodes { id handle title items { %s items { %s items { %s } } } } } }' % (ITEM, ITEM, ITEM)
HANDLE_OF = {
    'PAGE': '{ node(id: %s) { ... on Page { handle } } }',
    'COLLECTION': '{ node(id: %s) { ... on Collection { handle } } }',
    'PRODUCT': '{ node(id: %s) { ... on Product { handle } } }',
}
LIVE_ID = {
    'PAGE': '{ pages(first: 1, query: %s) { nodes { id handle } } }',
    'COLLECTION': '{ collectionByHandle(handle: %s) { id } }',
    'PRODUCT': '{ productByHandle(handle: %s) { id } }',
}


def live_resource(kind, dev_id):
    handle = (gql(DEV, HANDLE_OF[kind] % json.dumps(dev_id))['node'] or {}).get('handle')
    if not handle:
        return None, '?'
    if kind == 'PAGE':
        nodes = gql(LIVE, LIVE_ID[kind] % json.dumps(f'handle:{handle}'))['pages']['nodes']
        hit = next((n['id'] for n in nodes if n['handle'] == handle), None)
    elif kind == 'COLLECTION':
        hit = (gql(LIVE, LIVE_ID[kind] % json.dumps(handle))['collectionByHandle'] or {}).get('id')
    else:
        hit = (gql(LIVE, LIVE_ID[kind] % json.dumps(handle))['productByHandle'] or {}).get('id')
    return hit, handle


problems = []


def convert(items, depth=0):
    out = []
    for it in items:
        new = {'title': it['title'], 'type': it['type']}
        label = it['url']
        if it['type'] in LIVE_ID and it['resourceId']:
            rid, handle = live_resource(it['type'], it['resourceId'])
            label = f"{it['type'].lower()} {handle}"
            if rid:
                new['resourceId'] = rid
            else:
                problems.append(f"{it['title']}: no {it['type'].lower()} '{handle}' on live")
                label += '  (MISSING ON LIVE)'
        elif it['url']:
            new['url'] = it['url']
        print(f"      {'  ' * depth}{it['title']:28} → {label}")
        if it.get('items'):
            new['items'] = convert(it['items'], depth + 1)
        out.append(new)
    return out


dev_menus = {m['handle']: m for m in gql(DEV, MENUS)['menus']['nodes']}
live_menus = {m['handle']: m for m in gql(LIVE, MENUS)['menus']['nodes']}
work = []
for handle in HANDLES:
    dm = dev_menus.get(handle)
    if not dm:
        raise SystemExit(f'No menu "{handle}" on dev')
    lm = live_menus.get(handle)
    action = 'replace items of' if lm else 'create'
    print(f"  {action} {handle} ({dm['title']})" + (f", live has: {[i['title'] for i in lm['items']]}" if lm else ''))
    items = convert(dm['items'])
    if lm and not REPLACE:
        print(f"      skipped: {handle} exists on live; add --replace to overwrite it")
        continue
    work.append((handle, dm, lm, items))

if problems:
    print('\nProblems:\n  ' + '\n  '.join(problems))
if not APPLY:
    print('\nPlan only; nothing was changed.')
    raise SystemExit
if problems:
    raise SystemExit('Not applied: fix the problems first.')

for handle, dm, lm, items in work:
    if lm:
        r = gql(LIVE, '''mutation($id: ID!, $t: String!, $h: String!, $i: [MenuItemUpdateInput!]!) {
              menuUpdate(id: $id, title: $t, handle: $h, items: $i) { menu { handle } userErrors { message } } }''',
                {'id': lm['id'], 't': lm['title'], 'h': handle, 'i': items}, mutation=True)['menuUpdate']
    else:
        r = gql(LIVE, '''mutation($t: String!, $h: String!, $i: [MenuItemCreateInput!]!) {
              menuCreate(title: $t, handle: $h, items: $i) { menu { handle } userErrors { message } } }''',
                {'t': dm['title'], 'h': handle, 'i': items}, mutation=True)['menuCreate']
    assert not r['userErrors'], r
    print(f'  done  {handle}')
