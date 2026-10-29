#!/usr/bin/env python3
"""Moves each product's description into the four product-page tab fields.

The product page (sections/pb-product-description.liquid) shows its tabs from four rich text
product metafields: custom.tab_description, custom.tab_what_s_included, custom.tab_key_features
and custom.tab_key_specifications (definitions in setup-store.json). This splits the old
descriptions, written as parts under short capital headings ("DESCRIPTION", "KEY FEATURES:",
"INCLUSIONS", ...) in all sorts of markup, into those fields, cleaned of the old theme's spans,
colours and accordion wrappers. The description itself is left as it is.

  python3 split-descriptions.py --store protection-brands-dev               # dry run, report only
  python3 split-descriptions.py --store protection-brands-dev --apply       # fill empty fields
  python3 split-descriptions.py --store protection-brands-dev --apply --overwrite

Every run writes setup-logs/split-descriptions-<store>.html: per product, the original next to
the parts it was split into, and any heading it didn't recognise (kept as bold text in the part
before it). Nothing is written to the store without --apply, and fields that already have a
value are kept unless --overwrite is given. Uses the Admin API through `shopify store execute`,
like setup-store.mjs.
"""

import argparse
import html
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

HERE = Path(__file__).resolve().parent
LOGS = HERE / 'setup-logs'

FIELDS = {
    'tab_description': 'Description',
    'tab_what_s_included': "What's included",
    'tab_key_features': 'Key features',
    'tab_key_specifications': 'Key specifications',
}

# Heading text (capitals, no trailing colon, straight apostrophes) -> field.
HEADINGS = {
    'DESCRIPTION': 'tab_description',
    'PRODUCT DESCRIPTION': 'tab_description',
    'INCLUSIONS': 'tab_what_s_included',
    'WHATS INCLUDED': 'tab_what_s_included',
    "WHAT'S INCLUDED": 'tab_what_s_included',
    'WHAT IS INCLUDED': 'tab_what_s_included',
    'IN THE BOX': 'tab_what_s_included',
    'KEY FEATURES': 'tab_key_features',
    'FEATURES': 'tab_key_features',
    'KEY BENEFITS': 'tab_key_features',
    'BENEFITS': 'tab_key_features',
    'KEY SPECIFICATIONS': 'tab_key_specifications',
    'SPECIFICATIONS': 'tab_key_specifications',
    'SPECS': 'tab_key_specifications',
    'SPECIFICATION': 'tab_key_specifications',
    'PRODUCT SIZE': 'tab_key_specifications',
    'SIZE': 'tab_key_specifications',
    'DIMENSIONS': 'tab_key_specifications',
}

BLOCK = {'p', 'div', 'li', 'ul', 'ol', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'tr', 'td', 'th',
         'tbody', 'thead', 'section', 'article', 'blockquote'}
VOID = {'br', 'img', 'hr', 'meta', 'input', 'wbr', 'source'}
BOLD = {'strong', 'b'}
ITALIC = {'em', 'i'}


# ---------------------------------------------------------------------------------------------
# Admin API through the Shopify CLI

def gql(store, query, variables=None, mutation=False):
    cmd = ['shopify', 'store', 'execute', '--store', store, '--query', query,
           '--variables', json.dumps(variables or {}), '--json', '--no-input']
    if mutation:
        cmd.append('--allow-mutations')
    out = subprocess.run(cmd, capture_output=True, text=True)
    if out.returncode != 0:
        sys.exit(f'shopify store execute failed:\n{out.stdout}{out.stderr}')
    result = parse_output(out.stdout)
    if result.get('errors'):
        sys.exit('\n'.join(e.get('message', str(e)) for e in result['errors']))
    return result.get('data', result)


def parse_output(out):
    try:
        return json.loads(out)
    except json.JSONDecodeError:
        pass
    docs = []
    for line in out.splitlines():
        if line.strip().startswith('{'):
            try:
                docs.append(json.loads(line))
            except json.JSONDecodeError:
                pass
    docs = [d for d in docs if not d.get('event')]
    if not docs:
        sys.exit(f'Unexpected output from shopify store execute:\n{out}')
    return docs[-1]


def products(store):
    fields = ' '.join(f'{k}: metafield(namespace: "custom", key: "{k}") {{ value }}' for k in FIELDS)
    query = f'''query($after: String) {{
      products(first: 100, after: $after, sortKey: TITLE) {{
        nodes {{ id handle title status descriptionHtml {fields} }}
        pageInfo {{ hasNextPage endCursor }}
      }}
    }}'''
    after = None
    while True:
        page = gql(store, query, {'after': after})['products']
        yield from page['nodes']
        if not page['pageInfo']['hasNextPage']:
            return
        after = page['pageInfo']['endCursor']


# ---------------------------------------------------------------------------------------------
# HTML -> a small tree

class Node:
    def __init__(self, tag, attrs=None, parent=None):
        self.tag, self.attrs, self.parent, self.children = tag, dict(attrs or {}), parent, []


class TreeBuilder(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = self.cur = Node('root')

    def handle_starttag(self, tag, attrs):
        # A new block closes an open <p> (browsers do the same).
        if tag in BLOCK and tag != 'li':
            p = self.find_open('p')
            if p is not None:
                self.cur = p.parent
        node = Node(tag, attrs, self.cur)
        self.cur.children.append(node)
        if tag not in VOID:
            self.cur = node

    def handle_startendtag(self, tag, attrs):
        self.cur.children.append(Node(tag, attrs, self.cur))

    def handle_endtag(self, tag):
        node = self.find_open(tag)
        if node is not None:
            self.cur = node.parent

    def handle_data(self, data):
        self.cur.children.append(data)

    def find_open(self, tag):
        node = self.cur
        while node is not None and node.tag != 'root':
            if node.tag == tag:
                return node
            node = node.parent
        return None


def text_of(node):
    if isinstance(node, str):
        return node
    if node.tag == 'br':
        return ' '
    return ''.join(text_of(c) for c in node.children)


def clean(text):
    return re.sub(r'\s+', ' ', text.replace('\xa0', ' ')).strip()


def has_block_child(node):
    return any(isinstance(c, Node) and (c.tag in BLOCK or has_block_child(c)) for c in node.children)


def is_emphasised(node):
    """Bold, coloured or a heading tag, on the node or anything inside it."""
    if isinstance(node, str):
        return False
    if node.tag in BOLD or re.match(r'h[1-6]$', node.tag) or 'color' in node.attrs.get('style', ''):
        return True
    return any(is_emphasised(c) for c in node.children)


def heading_text(node):
    """The heading's text when `node` reads as one: short, capitals, emphasised. Else None."""
    text = clean(text_of(node))
    if not text or len(text) > 40 or text != text.upper() or text == text.lower():
        return None
    if not is_emphasised(node):
        return None
    return text


def heading_key(text):
    return clean(text.replace('’', "'").rstrip(':').strip()).upper()


# ---------------------------------------------------------------------------------------------
# Tree -> blocks: ('heading', text) | ('paragraph', runs) | ('list', ordered, [runs])
# A run is a dict: {value, bold, italic, url}

def runs_of(node, bold=False, italic=False, url=None):
    if isinstance(node, str):
        return [{'value': node, 'bold': bold, 'italic': italic, 'url': url}]
    if node.tag == 'br':
        return [{'value': '\n', 'bold': False, 'italic': False, 'url': None}]
    if node.tag in VOID or node.tag in ('script', 'style'):
        return []
    bold = bold or node.tag in BOLD or 'font-weight: bold' in node.attrs.get('style', '')
    italic = italic or node.tag in ITALIC
    if node.tag == 'a' and node.attrs.get('href'):
        url = node.attrs['href']
    runs = []
    for c in node.children:
        runs.extend(runs_of(c, bold, italic, url))
    return runs


def tidy(runs):
    """Collapse whitespace, merge neighbours with the same formatting, trim the ends. Returns a
    list of paragraphs' runs (split at <br>)."""
    lines, line = [], []
    for r in runs:
        parts = r['value'].split('\n')
        for i, part in enumerate(parts):
            if i:
                lines.append(line)
                line = []
            value = re.sub(r'\s+', ' ', part.replace('\xa0', ' '))
            if value:
                line.append({**r, 'value': value})
    lines.append(line)

    out = []
    for line in lines:
        merged = []
        for r in line:
            if merged and all(merged[-1][k] == r[k] for k in ('bold', 'italic', 'url')):
                merged[-1]['value'] += r['value']
            else:
                merged.append(dict(r))
        # Collapse spaces across runs and trim the ends.
        for i, r in enumerate(merged):
            if i and merged[i - 1]['value'].endswith(' ') and r['value'].startswith(' '):
                r['value'] = r['value'][1:]
        if merged:
            merged[0]['value'] = merged[0]['value'].lstrip()
            merged[-1]['value'] = merged[-1]['value'].rstrip()
        merged = [r for r in merged if r['value']]
        # Bold that is only spaces adds nothing.
        if merged and ''.join(r['value'] for r in merged).strip():
            out.append(merged)
    return out


def blocks_of(node, out):
    """Walks the tree in order, turning it into blocks."""
    pending = []  # inline content waiting for a block boundary

    def flush():
        for para in tidy([r for n in pending for r in runs_of(n)]):
            out.append(('paragraph', para))
        pending.clear()

    for c in node.children:
        if isinstance(c, str) or (c.tag not in BLOCK and not has_block_child(c)):
            # Inline. A whole inline element can also be a heading (<strong>KEY FEATURES:</strong>
            # straight inside a div, between blocks).
            if isinstance(c, Node) and heading_text(c) and not clean(text_of_pending(pending)):
                flush()
                out.append(('heading', heading_text(c)))
            else:
                pending.append(c)
            continue
        flush()
        if c.tag in ('ul', 'ol'):
            items = []
            for li in c.children:
                if isinstance(li, Node) and li.tag == 'li':
                    paras = tidy(runs_of(li))
                    if paras:
                        # Several lines in one item stay one item, joined by a space.
                        items.append([r for i, p in enumerate(paras) for r in ([{'value': ' ', 'bold': False, 'italic': False, 'url': None}] if i else []) + p])
            if items:
                out.append(('list', c.tag == 'ol', items))
        elif not has_block_child(c):
            text = heading_text(c)
            if text:
                out.append(('heading', text))
            else:
                for para in tidy(runs_of(c)):
                    out.append(('paragraph', para))
        else:
            blocks_of(c, out)
    flush()  # inline content left at the end of this container
    return out


def text_of_pending(pending):
    return ''.join(text_of(p) for p in pending)


def to_blocks(description_html):
    builder = TreeBuilder()
    builder.feed(description_html or '')
    builder.close()
    blocks = blocks_of(builder.root, [])
    # A paragraph that is only a heading-like line inside a <p> with other inline siblings was
    # already caught; also catch paragraphs whose whole text reads as a heading and is bold.
    fixed = []
    for b in blocks:
        if b[0] == 'paragraph':
            text = clean(''.join(r['value'] for r in b[1]))
            if text and len(text) <= 40 and text == text.upper() and text != text.lower() and all(r['bold'] for r in b[1]):
                fixed.append(('heading', text))
                continue
        fixed.append(b)
    return fixed


# ---------------------------------------------------------------------------------------------
# Blocks -> the four parts

def split(blocks):
    parts = {k: [] for k in FIELDS}
    unknown = []
    current = 'tab_description'
    for b in blocks:
        if b[0] == 'heading':
            key = HEADINGS.get(heading_key(b[1]))
            if key:
                current = key
                continue
            unknown.append(b[1])
            parts[current].append(('paragraph', [{'value': b[1], 'bold': True, 'italic': False, 'url': None}]))
            continue
        parts[current].append(b)
    return parts, unknown


def rich_text(blocks):
    def inline(runs):
        nodes = []
        for r in runs:
            text = {'type': 'text', 'value': r['value']}
            if r['bold']:
                text['bold'] = True
            if r['italic']:
                text['italic'] = True
            if r['url']:
                nodes.append({'type': 'link', 'url': r['url'], 'children': [text]})
            else:
                nodes.append(text)
        return nodes

    children = []
    for b in blocks:
        if b[0] == 'paragraph':
            children.append({'type': 'paragraph', 'children': inline(b[1])})
        elif b[0] == 'list':
            children.append({
                'type': 'list',
                'listType': 'ordered' if b[1] else 'unordered',
                'children': [{'type': 'list-item', 'children': inline(item)} for item in b[2]],
            })
    return {'type': 'root', 'children': children}


def preview_html(blocks):
    def inline(runs):
        out = ''
        for r in runs:
            s = html.escape(r['value'])
            if r['bold']:
                s = f'<strong>{s}</strong>'
            if r['italic']:
                s = f'<em>{s}</em>'
            if r['url']:
                s = f'<a href="{html.escape(r["url"])}">{s}</a>'
            out += s
        return out

    out = ''
    for b in blocks:
        if b[0] == 'paragraph':
            out += f'<p>{inline(b[1])}</p>'
        elif b[0] == 'list':
            tag = 'ol' if b[1] else 'ul'
            out += f'<{tag}>' + ''.join(f'<li>{inline(i)}</li>' for i in b[2]) + f'</{tag}>'
    return out


# ---------------------------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--store', required=True)
    ap.add_argument('--apply', action='store_true', help='write the fields to the store')
    ap.add_argument('--overwrite', action='store_true', help='also replace fields that already have a value')
    ap.add_argument('--only', help='comma-separated product handles')
    args = ap.parse_args()
    store = args.store if '.' in args.store else f'{args.store}.myshopify.com'
    only = set(args.only.split(',')) if args.only else None

    writes, report, problems = [], [], []
    for p in products(store):
        if only and p['handle'] not in only:
            continue
        parts, unknown = split(to_blocks(p['descriptionHtml']))
        entry = {'product': p, 'parts': parts, 'unknown': unknown, 'actions': {}}
        for key, blocks in parts.items():
            existing = (p.get(key) or {}).get('value')
            if not blocks:
                entry['actions'][key] = 'empty'
            elif existing and not args.overwrite:
                entry['actions'][key] = 'kept (already set)'
            else:
                entry['actions'][key] = 'replace' if existing else 'set'
                writes.append({'ownerId': p['id'], 'namespace': 'custom', 'key': key,
                               'type': 'rich_text_field', 'value': json.dumps(rich_text(blocks))})
        if unknown:
            problems.append(f"{p['handle']}: unrecognised heading(s) {unknown}")
        report.append(entry)

    LOGS.mkdir(exist_ok=True)
    name = store.split('.')[0]
    write_report(LOGS / f'split-descriptions-{name}.html', store, report, args)

    print(f'{len(report)} products, {len(writes)} field(s) to write.')
    for line in problems:
        print('  ' + line)
    print(f'Report: {LOGS / f"split-descriptions-{name}.html"}')

    if not args.apply:
        print('Dry run: nothing written. Add --apply to write.')
        return

    mutation = '''mutation($m: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $m) { metafields { id } userErrors { field message code } }
    }'''
    done = 0
    for i in range(0, len(writes), 25):
        batch = writes[i:i + 25]
        result = gql(store, mutation, {'m': batch}, mutation=True)['metafieldsSet']
        if result['userErrors']:
            sys.exit(f'metafieldsSet: {result["userErrors"]}')
        done += len(batch)
    stamp = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H-%M-%SZ')
    log = LOGS / f'split-descriptions-{name}-{stamp}.json'
    log.write_text(json.dumps(writes, indent=1))
    print(f'Wrote {done} field(s). Log: {log}')


def write_report(path, store, report, args):
    rows = []
    for e in report:
        p = e['product']
        cells = ''.join(
            f'<div class="part"><h3>{html.escape(label)} <small>{html.escape(e["actions"][key])}</small></h3>'
            f'{preview_html(e["parts"][key]) or "<p class=none>(empty)</p>"}</div>'
            for key, label in FIELDS.items()
        )
        warn = f'<p class="warn">Unrecognised heading(s), kept as bold text: {html.escape(", ".join(e["unknown"]))}</p>' if e['unknown'] else ''
        rows.append(
            f'<section><h2>{html.escape(p["title"])} <small>{html.escape(p["handle"])} · {p["status"].lower()}</small></h2>{warn}'
            f'<div class="grid"><div class="part original"><h3>Original description</h3>{p["descriptionHtml"] or ""}</div>'
            f'<div class="parts">{cells}</div></div></section>'
        )
    mode = 'apply' + (' --overwrite' if args.overwrite else '') if args.apply else 'dry run'
    path.write_text(f'''<!doctype html><meta charset="utf-8"><title>Split descriptions: {html.escape(store)}</title>
<style>
body {{ font: 14px/1.45 system-ui, sans-serif; margin: 24px; color: #111; background: #f4f4f4; }}
section {{ background: #fff; border-radius: 8px; padding: 16px 20px; margin: 0 0 20px; }}
h2 {{ margin: 0 0 10px; font-size: 18px; }} h3 {{ margin: 0 0 6px; font-size: 12px; text-transform: uppercase; color: #ca0d0d; }}
small {{ color: #777; font-weight: 400; text-transform: none; }}
.grid {{ display: grid; grid-template-columns: 1fr 1.4fr; gap: 20px; }}
.parts {{ display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }}
.part {{ border: 1px solid #e4e4e4; border-radius: 6px; padding: 10px 12px; overflow: auto; }}
.original {{ background: #fafafa; max-height: 520px; }}
.none {{ color: #aaa; }} .warn {{ color: #a30a0a; font-weight: 600; }}
</style>
<h1>Split descriptions: {html.escape(store)} ({mode})</h1>
<p>{len(report)} products. Left: the description as it is. Right: what goes in each tab field.</p>
{''.join(rows)}''')


if __name__ == '__main__':
    main()
