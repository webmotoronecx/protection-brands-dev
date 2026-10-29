#!/usr/bin/env node
// Creates the store setup the Horizon theme needs (setup-store.json) on a Shopify store,
// through `shopify store execute`. See automated-setup.md.
//
//   node setup-store.mjs --store protection-brands-dev                   # plan only, read-only
//   node setup-store.mjs --store protection-brands-dev --apply           # create what's missing
//   node setup-store.mjs --store protection-brands --apply --approve-edits
//
// Safety: nothing is written without --apply, and mutations are refused below unless it's set.
// Missing items are created. Existing items are never deleted or renamed, and only changed with
// --approve-edits (collection/page template, sort order, collection metafields, publishing).
// Anything else that differs is reported, not changed.

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SECTIONS = ['metaobjects', 'metafields', 'files', 'collections', 'pages', 'redirects', 'menus'];

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
let store = opt('--store');
const APPLY = args.includes('--apply');
const APPROVE_EDITS = args.includes('--approve-edits');
const ONLY = opt('--only')?.split(',') ?? SECTIONS;

if (!store || ONLY.some((s) => !SECTIONS.includes(s))) {
  console.error(`Usage: node setup-store.mjs --store <store> [--apply] [--approve-edits] [--only ${SECTIONS.join(',')}]`);
  process.exit(2);
}
if (!store.includes('.')) store += '.myshopify.com';

const config = JSON.parse(readFileSync(join(HERE, 'setup-store.json'), 'utf8'));

// ---------------------------------------------------------------------------------------------
// Admin API through the Shopify CLI

function gql(query, variables = {}, { mutation = false } = {}) {
  if (mutation && !APPLY) throw new Error('Refusing to run a mutation without --apply');
  const cmd = ['store', 'execute', '--store', store, '--query', query,
    '--variables', JSON.stringify(variables), '--json', '--no-input'];
  if (mutation) cmd.push('--allow-mutations');
  let out;
  try {
    out = execFileSync('shopify', cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20 });
  } catch (e) {
    throw new Error(`shopify store execute failed:\n${(e.stdout || '') + (e.stderr || e.message)}`.trim());
  }
  const result = parseOutput(out);
  if (result?.error) throw new Error(result.error.message || JSON.stringify(result.error));
  if (result?.errors?.length) throw new Error(result.errors.map((e) => e.message).join('\n'));
  return result?.data ?? result;
}

// --json prints one JSON document; tolerate event lines before it.
function parseOutput(out) {
  try { return JSON.parse(out); } catch {}
  const docs = out.split('\n').filter((l) => l.trim().startsWith('{')).map((l) => { try { return JSON.parse(l); } catch { return null; } });
  const last = docs.filter((d) => d && !d.event).pop();
  if (!last) throw new Error(`Unexpected output from shopify store execute:\n${out}`);
  return last;
}

// Runs a mutation and throws on userErrors. Returns the payload of `field`.
function mutate(query, variables, field) {
  const payload = gql(query, variables, { mutation: true })[field];
  if (payload.userErrors?.length) {
    throw new Error(`${field}: ${payload.userErrors.map((e) => `${(e.field || []).join('.')} ${e.message}`).join('; ')}`);
  }
  return payload;
}

function paginate(query, path, variables = {}) {
  const nodes = [];
  let after = null;
  do {
    const conn = gql(query, { ...variables, after })[path];
    nodes.push(...conn.nodes);
    after = conn.pageInfo.hasNextPage ? conn.pageInfo.endCursor : null;
  } while (after);
  return nodes;
}

// ---------------------------------------------------------------------------------------------
// Plan

const actions = []; // { section, label, status: create|edit|ok|differs|blocked, detail, run }
const ids = {};     // 'collection:wash-shampoo' -> gid, filled by reads and by creates
const planned = new Set(); // keys that a create action will fill

function add(section, label, status, detail, run) {
  actions.push({ section, label, status, detail, run });
}
const known = (key) => key in ids || planned.has(key);
const choicesValidation = (choices) => [{ name: 'choices', value: JSON.stringify(choices) }];

console.log(`Reading ${store}…`);

// Metaobject definitions --------------------------------------------------------------------

for (const def of config.metaobjectDefinitions) {
  const key = `metaobject:${def.type}`;
  const found = gql(`query($type: String!) {
    metaobjectDefinitionByType(type: $type) { id access { storefront } fieldDefinitions { key type { name } } }
  }`, { type: def.type }).metaobjectDefinitionByType;

  if (!found) {
    planned.add(key);
    add('metaobjects', def.type, 'create', `${def.fields.map((f) => f.key).join(', ')}; storefront ${def.storefront}`, () => {
      const p = mutate(`mutation($d: MetaobjectDefinitionCreateInput!) {
        metaobjectDefinitionCreate(definition: $d) { metaobjectDefinition { id } userErrors { field message code } }
      }`, { d: {
        type: def.type,
        name: def.name,
        displayNameKey: def.displayNameKey,
        access: { storefront: def.storefront },
        fieldDefinitions: def.fields.map((f) => ({
          key: f.key, name: f.name, type: f.type, required: !!f.required,
          ...(f.choices && { validations: choicesValidation(f.choices) }),
        })),
      } }, 'metaobjectDefinitionCreate');
      return (ids[key] = p.metaobjectDefinition.id);
    });
    continue;
  }

  ids[key] = found.id;
  const problems = [];
  if (found.access.storefront !== def.storefront) problems.push(`storefront access is ${found.access.storefront}`);
  for (const f of def.fields) {
    const have = found.fieldDefinitions.find((x) => x.key === f.key);
    if (!have) problems.push(`no field "${f.key}"`);
    else if (have.type.name !== f.type) problems.push(`"${f.key}" is ${have.type.name}, expected ${f.type}`);
  }
  add('metaobjects', def.type, problems.length ? 'differs' : 'ok', problems.join('; ') || 'exists and matches');
}

// Metafield definitions ---------------------------------------------------------------------

for (const def of config.metafieldDefinitions) {
  const key = `metafield:${def.ownerType}.${def.namespace}.${def.key}`;
  const label = `${def.ownerType.toLowerCase()} ${def.namespace}.${def.key}`;
  const found = gql(`query($o: MetafieldOwnerType!, $n: String!, $k: String!) {
    metafieldDefinitions(ownerType: $o, namespace: $n, key: $k, first: 1) {
      nodes { id type { name } access { storefront } validations { name value }
        capabilities { smartCollectionCondition { enabled } } }
    }
  }`, { o: def.ownerType, n: def.namespace, k: def.key }).metafieldDefinitions.nodes[0];

  if (!found) {
    const refKey = def.metaobjectType && `metaobject:${def.metaobjectType}`;
    if (refKey && !known(refKey)) {
      add('metafields', label, 'blocked', `metaobject definition ${def.metaobjectType} doesn't exist`);
      continue;
    }
    planned.add(key);
    add('metafields', label, 'create', def.type, () => {
      const validations = [];
      if (def.choices) validations.push(...choicesValidation(def.choices));
      if (def.fileTypes) validations.push({ name: 'file_type_options', value: JSON.stringify(def.fileTypes) });
      if (refKey) validations.push({ name: 'metaobject_definition_id', value: ids[refKey] });
      const p = mutate(`mutation($d: MetafieldDefinitionInput!) {
        metafieldDefinitionCreate(definition: $d) { createdDefinition { id } userErrors { field message code } }
      }`, { d: {
        name: def.name, namespace: def.namespace, key: def.key, ownerType: def.ownerType, type: def.type,
        access: { storefront: 'PUBLIC_READ' },
        ...(validations.length && { validations }),
        ...(def.collectionCondition && { capabilities: { smartCollectionCondition: { enabled: true } } }),
      } }, 'metafieldDefinitionCreate');
      return (ids[key] = p.createdDefinition.id);
    });
    continue;
  }

  ids[key] = found.id;
  const problems = [];
  if (found.type.name !== def.type) problems.push(`type is ${found.type.name}, expected ${def.type}`);
  if (found.access.storefront !== 'PUBLIC_READ') problems.push(`storefront access is ${found.access.storefront}`);
  if (def.collectionCondition && !found.capabilities.smartCollectionCondition.enabled) {
    problems.push('"Use as a condition in collections" is off');
  }
  if (def.choices) {
    const have = JSON.parse(found.validations.find((v) => v.name === 'choices')?.value ?? '[]');
    const missing = def.choices.filter((c) => !have.includes(c));
    if (missing.length) problems.push(`choices missing: ${missing.join(', ')}`);
  }
  add('metafields', label, problems.length ? 'differs' : 'ok', problems.join('; ') || 'exists and matches');
}

// Files ---------------------------------------------------------------------------------------

const MIME = { '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.pdf': 'application/pdf' };

const storeFiles = paginate(`query($after: String) {
  files(first: 250, after: $after) {
    nodes { id preview { image { url } } ... on GenericFile { url } }
    pageInfo { hasNextPage endCursor }
  }
}`, 'files');
for (const f of storeFiles) {
  const url = f.url || f.preview?.image?.url;
  if (url) ids[`file:${decodeURIComponent(basename(new URL(url).pathname))}`] = f.id;
}

for (const group of config.files) {
  const dir = resolve(HERE, group.dir);
  let names;
  try { names = readdirSync(dir).filter((n) => new RegExp(group.pattern).test(n)).sort(); } catch {
    add('files', group.dir, 'blocked', `folder not found: ${dir}`);
    continue;
  }
  const missing = names.filter((n) => !ids[`file:${n}`]);
  if (names.length > missing.length) add('files', group.dir, 'ok', `${names.length - missing.length} of ${names.length} already in Files`);
  for (const name of missing) {
    if (!MIME[extname(name).toLowerCase()]) { add('files', name, 'blocked', 'unknown file type'); continue; }
    planned.add(`file:${name}`);
    add('files', name, 'create', 'upload to Content → Files', () => uploadFile(join(dir, name)));
  }
}

async function uploadFile(path) {
  const name = basename(path);
  const mimeType = MIME[extname(name).toLowerCase()];
  const isImage = mimeType.startsWith('image/');
  const target = mutate(`mutation($i: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $i) { stagedTargets { url resourceUrl parameters { name value } } userErrors { field message } }
  }`, { i: [{ filename: name, mimeType, resource: isImage ? 'IMAGE' : 'FILE', httpMethod: 'POST', fileSize: String(statSync(path).size) }] },
  'stagedUploadsCreate').stagedTargets[0];

  const form = new FormData();
  for (const p of target.parameters) form.append(p.name, p.value);
  form.append('file', new Blob([readFileSync(path)], { type: mimeType }), name);
  const res = await fetch(target.url, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Upload of ${name} failed: ${res.status} ${await res.text()}`);

  // RAISE_ERROR: never rename or replace a file that's already there.
  const p = mutate(`mutation($f: [FileCreateInput!]!) {
    fileCreate(files: $f) { files { id } userErrors { field message code } }
  }`, { f: [{ originalSource: target.resourceUrl, filename: name, contentType: isImage ? 'IMAGE' : 'FILE', duplicateResolutionMode: 'RAISE_ERROR' }] },
  'fileCreate');
  return (ids[`file:${name}`] = p.files[0].id);
}

// Collections ---------------------------------------------------------------------------------

const onlineStore = gql(`{ publications(first: 50) { nodes { id name } } }`)
  .publications.nodes.find((p) => p.name === 'Online Store');
if (!onlineStore) throw new Error('No "Online Store" publication found on this store');

function findCollection(handle) {
  const c = gql(`query($h: String!, $p: ID!) {
    collectionByIdentifier(identifier: { handle: $h }) {
      id templateSuffix sortOrder publishedOnPublication(publicationId: $p)
      ruleSet { appliedDisjunctively rules { column relation condition } }
      watermark: metafield(namespace: "custom", key: "watermark") { value }
      heroImage: metafield(namespace: "custom", key: "hero_image") { value }
    }
  }`, { h: handle, p: onlineStore.id }).collectionByIdentifier;
  if (c) ids[`collection:${handle}`] = c.id;
  return c;
}

const SUITABLE_FOR = 'metafield:PRODUCT.custom.suitable_for';
const ruleInput = ([column, condition]) => column === 'SUITABLE_FOR'
  ? { column: 'PRODUCT_METAFIELD_DEFINITION', relation: 'EQUALS', condition, conditionObjectId: ids[SUITABLE_FOR] }
  : { column, relation: 'EQUALS', condition };
const ruleText = (column, condition) => `${column === 'SUITABLE_FOR' ? 'PRODUCT_METAFIELD_DEFINITION' : column} = ${condition}`;

function collectionMetafields(c) {
  const m = [];
  if (c.watermark) m.push({ namespace: 'custom', key: 'watermark', type: 'single_line_text_field', value: c.watermark });
  if (c.heroImage) m.push({ namespace: 'custom', key: 'hero_image', type: 'file_reference', value: ids[`file:${c.heroImage}`] });
  return m;
}

function publish(id) {
  mutate(`mutation($id: ID!, $p: ID!) {
    publishablePublish(id: $id, input: [{ publicationId: $p }]) { userErrors { field message } }
  }`, { id, p: onlineStore.id }, 'publishablePublish');
}

for (const c of config.collections) {
  const key = `collection:${c.handle}`;
  const blockers = [];
  if (c.rules.some(([col]) => col === 'SUITABLE_FOR') && !known(SUITABLE_FOR)) blockers.push('Suitable for metafield definition missing');
  if (c.heroImage && !known(`file:${c.heroImage}`)) blockers.push(`hero image ${c.heroImage} not in Files`);
  const found = findCollection(c.handle);

  if (!found) {
    if (blockers.length) { add('collections', c.handle, 'blocked', blockers.join('; ')); continue; }
    planned.add(key);
    add('collections', c.handle, 'create', `${c.rules.map((r) => ruleText(...r)).join(' and ')}${c.templateSuffix ? `; template ${c.templateSuffix}` : ''}; published to Online Store`, () => {
      const metafields = collectionMetafields(c);
      const p = mutate(`mutation($i: CollectionInput!) {
        collectionCreate(input: $i) { collection { id handle } userErrors { field message } }
      }`, { i: {
        title: c.title, handle: c.handle,
        ruleSet: { appliedDisjunctively: false, rules: c.rules.map(ruleInput) },
        ...(c.sortOrder && { sortOrder: c.sortOrder }),
        ...(c.templateSuffix && { templateSuffix: c.templateSuffix }),
        ...(metafields.length && { metafields }),
      } }, 'collectionCreate');
      ids[key] = p.collection.id;
      if (p.collection.handle !== c.handle) {
        throw new Error(`Collection was created with handle "${p.collection.handle}", not "${c.handle}". Fix it in the admin before continuing.`);
      }
      publish(p.collection.id);
      return p.collection.id;
    });
    continue;
  }

  // Rules are never changed on an existing collection: that would change which products
  // it shows on the current theme too.
  const want = c.rules.map((r) => ruleText(...r)).sort().join(' and ');
  const have = (found.ruleSet?.rules ?? []).map((r) => `${r.column} = ${r.condition}`).sort().join(' and ');
  if (want !== have || found.ruleSet?.appliedDisjunctively) {
    add('collections', c.handle, 'differs', `conditions are "${have || 'manual'}"${found.ruleSet?.appliedDisjunctively ? ' (any)' : ''}, config has "${want}". Not changed; decide in the admin.`);
  }

  const changes = [];
  const update = { id: found.id };
  if ((c.templateSuffix || '') !== (found.templateSuffix || '')) {
    changes.push(`template "${found.templateSuffix || 'default'}" → "${c.templateSuffix || 'default'}"`);
    update.templateSuffix = c.templateSuffix || '';
  }
  if (c.sortOrder && c.sortOrder !== found.sortOrder) {
    changes.push(`sort ${found.sortOrder} → ${c.sortOrder}`);
    update.sortOrder = c.sortOrder;
  }
  const setWatermark = c.watermark && c.watermark !== found.watermark?.value;
  const setHero = c.heroImage && ids[`file:${c.heroImage}`] !== found.heroImage?.value;
  if (setWatermark) changes.push(`watermark → "${c.watermark}"`);
  if (setHero) changes.push(`hero image → ${c.heroImage}`);
  if (!found.publishedOnPublication) changes.push('publish to Online Store');

  if (!changes.length) { add('collections', c.handle, 'ok', 'exists and matches'); continue; }
  if (blockers.length) { add('collections', c.handle, 'blocked', `${changes.join('; ')}: ${blockers.join('; ')}`); continue; }
  add('collections', c.handle, 'edit', changes.join('; '), () => {
    const metafields = collectionMetafields({ watermark: setWatermark && c.watermark, heroImage: setHero && c.heroImage });
    if (Object.keys(update).length > 1 || metafields.length) {
      mutate(`mutation($i: CollectionInput!) {
        collectionUpdate(input: $i) { collection { id } userErrors { field message } }
      }`, { i: { ...update, ...(metafields.length && { metafields }) } }, 'collectionUpdate');
    }
    if (!found.publishedOnPublication) publish(found.id);
    return found.id;
  });
}

// Pages and blogs -----------------------------------------------------------------------------

const pages = new Map(paginate(`query($after: String) {
  pages(first: 250, after: $after) { nodes { id handle templateSuffix } pageInfo { hasNextPage endCursor } }
}`, 'pages').map((p) => [p.handle, p]));
for (const [handle, p] of pages) ids[`page:${handle}`] = p.id;

for (const b of gql(`{ blogs(first: 50) { nodes { id handle } } }`).blogs.nodes) ids[`blog:${b.handle}`] = b.id;

for (const pg of config.pages) {
  const key = `page:${pg.handle}`;
  const found = pages.get(pg.handle);
  if (!found) {
    planned.add(key);
    add('pages', pg.handle, 'create', `"${pg.title}", template ${pg.templateSuffix || 'default'}${pg.published ? ', published' : ', hidden'}`, () => {
      const p = mutate(`mutation($p: PageCreateInput!) {
        pageCreate(page: $p) { page { id handle } userErrors { field message code } }
      }`, { p: { title: pg.title, handle: pg.handle, body: pg.body, templateSuffix: pg.templateSuffix, isPublished: !!pg.published } }, 'pageCreate');
      ids[key] = p.page.id;
      if (p.page.handle !== pg.handle) throw new Error(`Page was created with handle "${p.page.handle}", not "${pg.handle}".`);
      return p.page.id;
    });
    continue;
  }
  if ((pg.templateSuffix || '') === (found.templateSuffix || '')) { add('pages', pg.handle, 'ok', 'exists and matches'); continue; }
  add('pages', pg.handle, 'edit', `template "${found.templateSuffix || 'default'}" → "${pg.templateSuffix}"`, () => {
    mutate(`mutation($id: ID!, $p: PageUpdateInput!) {
      pageUpdate(id: $id, page: $p) { page { id } userErrors { field message code } }
    }`, { id: found.id, p: { templateSuffix: pg.templateSuffix } }, 'pageUpdate');
    return found.id;
  });
}

// Redirects -----------------------------------------------------------------------------------

if (config.redirects.length) {
  const existing = new Map(paginate(`query($after: String) {
    urlRedirects(first: 250, after: $after) { nodes { id path target } pageInfo { hasNextPage endCursor } }
  }`, 'urlRedirects').map((r) => [r.path, r]));
  for (const r of config.redirects) {
    const found = existing.get(r.path);
    if (found) {
      add('redirects', r.path, found.target === r.target ? 'ok' : 'differs', found.target === r.target ? 'exists' : `goes to ${found.target}, config has ${r.target}. Not changed.`);
      continue;
    }
    add('redirects', r.path, 'create', `→ ${r.target}`, () => mutate(`mutation($r: UrlRedirectInput!) {
      urlRedirectCreate(urlRedirect: $r) { urlRedirect { id } userErrors { field message } }
    }`, { r: { path: r.path, target: r.target } }, 'urlRedirectCreate').urlRedirect.id);
  }
}

// Menus ---------------------------------------------------------------------------------------

const menus = new Map(gql(`{ menus(first: 50) { nodes { id handle } } }`).menus.nodes.map((m) => [m.handle, m]));

function linkKey(link) {
  const [kind, value] = link.split(/:(.*)/);
  return ['collection', 'page', 'blog', 'product'].includes(kind) ? `${kind}:${value}` : null;
}

for (const menu of config.menus) {
  if (menus.has(menu.handle)) { add('menus', menu.handle, 'ok', 'exists; left as it is'); continue; }

  const unresolved = [];
  const walk = (items) => items.forEach((it) => {
    const key = linkKey(it.link);
    if (key && !known(key)) {
      if (key.startsWith('collection:')) findCollection(key.slice('collection:'.length));
      if (key.startsWith('product:')) {
        const p = gql(`query($h: String!) { productByIdentifier(identifier: { handle: $h }) { id } }`, { h: key.slice('product:'.length) }).productByIdentifier;
        if (p) ids[key] = p.id;
      }
      if (!known(key)) unresolved.push(`${it.title} (${it.link})`);
    }
    if (it.items) walk(it.items);
  });
  walk(menu.items);
  if (unresolved.length) { add('menus', menu.handle, 'blocked', `links not found: ${unresolved.join(', ')}`); continue; }

  add('menus', menu.handle, 'create', `"${menu.title}", ${menu.items.length} top-level items`, () => {
    const build = (items) => items.map((it) => {
      const [kind, value] = it.link.split(/:(.*)/);
      const base = { title: it.title, ...(it.items && { items: build(it.items) }) };
      if (kind === 'catalog') return { ...base, type: 'CATALOG', url: '/collections/all' };
      if (kind === 'url') return { ...base, type: 'HTTP', url: value };
      return { ...base, type: kind.toUpperCase(), resourceId: ids[`${kind}:${value}`] };
    });
    const p = mutate(`mutation($t: String!, $h: String!, $i: [MenuItemCreateInput!]!) {
      menuCreate(title: $t, handle: $h, items: $i) { menu { id handle } userErrors { field message code } }
    }`, { t: menu.title, h: menu.handle, i: build(menu.items) }, 'menuCreate');
    if (p.menu.handle !== menu.handle) throw new Error(`Menu was created with handle "${p.menu.handle}", not "${menu.handle}".`);
    return p.menu.id;
  });
}

// ---------------------------------------------------------------------------------------------
// Report and apply

const MARK = { create: '+ create ', edit: '~ edit   ', ok: '  ok     ', differs: '! differs', blocked: 'x blocked' };
const shown = actions.filter((a) => ONLY.includes(a.section));

for (const section of ONLY) {
  const rows = shown.filter((a) => a.section === section);
  if (!rows.length) continue;
  console.log(`\n${section}`);
  for (const a of rows) console.log(`  ${MARK[a.status]}  ${a.label}${a.detail ? `  ${a.detail}` : ''}`);
}

const count = (s) => shown.filter((a) => a.status === s).length;
console.log(`\n${count('create')} to create, ${count('edit')} edits${APPROVE_EDITS ? '' : ' (need --approve-edits)'}, ${count('differs')} differ (not changed), ${count('blocked')} blocked.`);

if (!APPLY) {
  console.log('Plan only; nothing was changed. Run again with --apply to create.');
  process.exit(0);
}

const todo = shown.filter((a) => a.status === 'create' || (a.status === 'edit' && APPROVE_EDITS));
if (!todo.length) { console.log('Nothing to do.'); process.exit(0); }

console.log(`\nApplying ${todo.length} change(s) to ${store}…`);
const log = { store, startedAt: new Date().toISOString(), done: [] };
let failed = false;
for (const a of todo) {
  try {
    const id = await a.run();
    log.done.push({ section: a.section, label: a.label, status: a.status, id });
    console.log(`  done  ${a.section} ${a.label}${id ? `  ${id}` : ''}`);
  } catch (e) {
    console.error(`  FAILED  ${a.section} ${a.label}\n${e.message}\nStopped. Everything above was applied; run the plan again to see what's left.`);
    log.error = { section: a.section, label: a.label, message: e.message };
    failed = true;
    break;
  }
}

const logDir = join(HERE, 'setup-logs');
mkdirSync(logDir, { recursive: true });
const logFile = join(logDir, `${store.split('.')[0]}-${log.startedAt.replace(/[:.]/g, '-')}.json`);
writeFileSync(logFile, JSON.stringify(log, null, 2) + '\n');
console.log(`\nLog: ${logFile}`);
process.exit(failed ? 1 : 0);
