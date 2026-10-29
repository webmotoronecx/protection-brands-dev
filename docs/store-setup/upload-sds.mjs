#!/usr/bin/env node
// Uploads Safety Data Sheet PDFs to a Shopify store and creates an SDS document entry for each
// (the sds_document metaobject, see sds.md), through `shopify store execute`. Optionally points
// products' SDS metafield (custom.sds) at their sheet, from sds-products.json.
//
//   node upload-sds.mjs --store protection-brands-dev                  # plan only, read-only
//   node upload-sds.mjs --store protection-brands-dev --apply          # upload + create entries
//   node upload-sds.mjs --store protection-brands-dev --apply --link-products
//
// PDFs are named "SDS - <Brand> <Product> <D.M.YYYY>.pdf", e.g.
// "SDS - CERFACE Shampoo 1.6.2022.pdf" → product name "CERFACE Shampoo 1.6.2022", brand
// CERFACE, issued 1 June 2022. The folder defaults to ../../../../files/SDS (--dir to change).
//
// Safety, as setup-store.mjs: nothing is written without --apply. Files and entries that
// already exist (same filename / handle) are left as they are; nothing is deleted or replaced.
// A product whose SDS metafield is already set to something else is reported, not changed.

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BRANDS = ['Permagard', 'CERFACE', 'OptiVAN', 'Honda Genuine Car Care', 'Protection Brands'];

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
let store = opt('--store');
const APPLY = args.includes('--apply');
const LINK = args.includes('--link-products');
const DIR = resolve(HERE, opt('--dir') ?? '../../../../files/SDS');

if (!store) {
  console.error('Usage: node upload-sds.mjs --store <store> [--apply] [--link-products] [--dir <folder>]');
  process.exit(2);
}
if (!store.includes('.')) store += '.myshopify.com';

// Admin API through the Shopify CLI (same as setup-store.mjs) ---------------------------------

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
  const last = docs.filter((d) => d && !d.event && !d.type).pop();
  if (last) return last;
  // A pretty-printed document after the event lines.
  const start = out.search(/^\{\s*$/m);
  if (start >= 0) return JSON.parse(out.slice(start));
  throw new Error(`Unexpected output from shopify store execute:\n${out}`);
}

function mutate(query, variables, field) {
  const payload = gql(query, variables, { mutation: true })[field];
  if (payload.userErrors?.length) {
    throw new Error(`${field}: ${payload.userErrors.map((e) => `${(e.field || []).join('.')} ${e.message}`).join('; ')}`);
  }
  return payload;
}

// The sheets ---------------------------------------------------------------------------------

const sheets = readdirSync(DIR).filter((n) => /\.pdf$/i.test(n)).sort().map((file) => {
  const name = file.replace(/^SDS\s*-\s*/i, '').replace(/\.pdf$/i, '').trim();
  const brand = BRANDS.find((b) => name.toLowerCase().startsWith(b.toLowerCase()));
  const d = name.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  return {
    file,
    // Shopify stores the file with spaces as underscores.
    storedName: file.replace(/ /g, '_'),
    name,
    brand,
    date: d ? `${d[3]}-${d[2].padStart(2, '0')}-${d[1].padStart(2, '0')}` : null,
    handle: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  };
});

const bad = sheets.filter((s) => !s.brand || !s.date);
if (bad.length) {
  for (const s of bad) console.error(`Can't read ${!s.brand ? 'the brand' : 'the date'} from "${s.file}"`);
  process.exit(1);
}

// What's on the store ------------------------------------------------------------------------

const fileIds = {};
for (const f of gql(`{ files(first: 250, query: "media_type:GenericFile") { nodes { ... on GenericFile { id url } } } }`).files.nodes) {
  if (f.url) fileIds[decodeURIComponent(basename(new URL(f.url).pathname))] = f.id;
}

const entries = {};
for (const m of gql(`{ metaobjects(type: "sds_document", first: 250) { nodes { id handle } } }`).metaobjects.nodes) {
  entries[m.handle] = m.id;
}

const links = LINK ? JSON.parse(readFileSync(join(HERE, 'sds-products.json'), 'utf8')).links : [];

// Plan ---------------------------------------------------------------------------------------

const steps = [];
const add = (mark, what, detail, run) => steps.push({ mark, what, detail, run });

for (const s of sheets) {
  if (fileIds[s.storedName]) add('ok', s.file, 'already in Files');
  else add('create', s.file, 'upload to Content → Files', () => uploadFile(s));

  if (entries[s.handle]) add('ok', s.handle, 'SDS document entry exists');
  else add('create', s.handle, `entry: ${s.name} · ${s.brand} · ${s.date}`, () => createEntry(s));
}

for (const link of links) {
  const sheet = sheets.find((s) => s.file === link.sheet);
  if (!sheet) { add('blocked', link.product, `no sheet "${link.sheet}" in ${DIR}`); continue; }
  const p = gql(`query($h: String!) { productByIdentifier(identifier: { handle: $h }) {
    id title sds: metafield(namespace: "custom", key: "sds") { value } } }`, { h: link.product }).productByIdentifier;
  if (!p) { add('blocked', link.product, 'product not found'); continue; }
  const current = p.sds?.value;
  if (current && current === entries[sheet.handle]) add('ok', p.title, `SDS → ${sheet.name}`);
  else if (current) add('differs', p.title, `SDS is already set to ${current}; change it in the admin`);
  else add('create', p.title, `SDS → ${sheet.name}`, () => linkProduct(p.id, sheet));
}

const MARKS = { ok: '  ok      ', create: '+ create  ', differs: '! differs ', blocked: 'x blocked ' };
console.log(`\n${store}${APPLY ? '' : ' (plan only; --apply to run)'}\n`);
for (const s of steps) console.log(`${MARKS[s.mark]}${s.what}\n            ${s.detail}`);

// Apply --------------------------------------------------------------------------------------

async function uploadFile(s) {
  const path = join(DIR, s.file);
  const target = mutate(`mutation($i: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $i) { stagedTargets { url resourceUrl parameters { name value } } userErrors { field message } }
  }`, { i: [{ filename: s.file, mimeType: 'application/pdf', resource: 'FILE', httpMethod: 'POST', fileSize: String(statSync(path).size) }] },
  'stagedUploadsCreate').stagedTargets[0];

  const form = new FormData();
  for (const p of target.parameters) form.append(p.name, p.value);
  form.append('file', new Blob([readFileSync(path)], { type: 'application/pdf' }), s.file);
  const res = await fetch(target.url, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Upload of ${s.file} failed: ${res.status} ${await res.text()}`);

  // RAISE_ERROR: never rename or replace a file that's already there.
  const p = mutate(`mutation($f: [FileCreateInput!]!) {
    fileCreate(files: $f) { files { id } userErrors { field message code } }
  }`, { f: [{ originalSource: target.resourceUrl, filename: s.file, contentType: 'FILE', duplicateResolutionMode: 'RAISE_ERROR' }] },
  'fileCreate');
  return { file: s.file, id: (fileIds[s.storedName] = p.files[0].id) };
}

function createEntry(s) {
  const fileId = fileIds[s.storedName];
  if (!fileId) throw new Error(`No file ID for ${s.file}`);
  const m = mutate(`mutation($m: MetaobjectCreateInput!) {
    metaobjectCreate(metaobject: $m) { metaobject { id handle } userErrors { field message code } }
  }`, { m: {
    type: 'sds_document',
    handle: s.handle,
    capabilities: { publishable: { status: 'ACTIVE' } },
    fields: [
      { key: 'product_name', value: s.name },
      { key: 'file', value: fileId },
      { key: 'brand', value: s.brand },
      { key: 'issue_date', value: s.date },
    ],
  } }, 'metaobjectCreate').metaobject;
  if (m.handle !== s.handle) throw new Error(`Entry created as ${m.handle}, expected ${s.handle}`);
  return { entry: m.handle, id: (entries[s.handle] = m.id) };
}

function linkProduct(productId, sheet) {
  const entryId = entries[sheet.handle];
  if (!entryId) throw new Error(`No SDS entry for ${sheet.name}`);
  mutate(`mutation($m: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $m) { metafields { id } userErrors { field message code } }
  }`, { m: [{ ownerId: productId, namespace: 'custom', key: 'sds', type: 'metaobject_reference', value: entryId }] },
  'metafieldsSet');
  return { product: productId, sds: entryId };
}

if (APPLY) {
  const done = [];
  try {
    for (const s of steps.filter((s) => s.run)) {
      process.stdout.write(`\n${s.what} ... `);
      done.push({ what: s.what, result: await s.run() });
      process.stdout.write('done');
    }
  } finally {
    if (done.length) {
      const logDir = join(HERE, 'setup-logs');
      mkdirSync(logDir, { recursive: true });
      const log = join(logDir, `sds-${store.split('.')[0]}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
      writeFileSync(log, JSON.stringify(done, null, 2) + '\n');
      console.log(`\n\nLogged to ${log}`);
    }
  }
}
