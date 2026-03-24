#!/usr/bin/env node
/**
 * Compares OpenAPI operationIds to implemented-operation-ids.json.
 * Set DECIDIM_OPENAPI_JSON to the spec path; otherwise tries a path relative to this monorepo layout.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function collectOperationIds(spec) {
  const ids = [];
  for (const route of Object.keys(spec.paths || {})) {
    const item = spec.paths[route];
    for (const method of Object.keys(item)) {
      if (!['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(method)) continue;
      const op = item[method];
      if (op && typeof op.operationId === 'string') ids.push(op.operationId);
    }
  }
  return [...new Set(ids)].sort();
}

const manifestPath = path.join(__dirname, '..', 'implemented-operation-ids.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (!Array.isArray(manifest)) {
  console.error('implemented-operation-ids.json must be a JSON array');
  process.exit(1);
}

const defaultOpenapi = path.resolve(
  __dirname,
  '../../../../../../decidim-restfull/website/static/openapi.json'
);
const openapiPath = process.env.DECIDIM_OPENAPI_JSON || defaultOpenapi;

if (!fs.existsSync(openapiPath)) {
  console.warn(
    `[verify-openapi-coverage] Skip: OpenAPI not found at ${openapiPath} (set DECIDIM_OPENAPI_JSON).`
  );
  process.exit(0);
}

const spec = JSON.parse(fs.readFileSync(openapiPath, 'utf8'));
const fromSpec = new Set(collectOperationIds(spec));
const fromManifest = new Set(manifest);

const unknownInManifest = [...fromManifest].filter((id) => !fromSpec.has(id));
const notDocumented = [...fromSpec].filter((id) => !fromManifest.has(id));

if (unknownInManifest.length) {
  console.error('implemented-operation-ids.json references unknown operationIds:', unknownInManifest.join(', '));
  process.exit(1);
}

if (notDocumented.length) {
  console.warn(
    `[verify-openapi-coverage] OpenAPI operations not listed in manifest (${notDocumented.length}):`
  );
  console.warn(notDocumented.join('\n'));
}

console.log(
  `[verify-openapi-coverage] OK — ${fromManifest.size} implemented ids; ${notDocumented.length} spec ops not in manifest.`
);
process.exit(0);
