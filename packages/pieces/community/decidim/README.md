# Decidim piece (Activepieces)

Integration with a [Decidim](https://decidim.org/) instance via the REST API and generated `@octree/decidim-sdk` client.

## Layout (where to change what)

| Path | Purpose |
|------|---------|
| `src/decidimAuth.ts` | Piece auth (base URL + OAuth client credentials). |
| `src/lib/props.ts` | Shared property definitions (labels, descriptions, dropdowns). |
| `src/lib/registry/actions.ts` | List of actions registered on the piece. |
| `src/lib/domains/*` | One folder per API area (users, spaces, components, …). Each action is a small file; heavy mapping lives in `*.helpers.ts` or focused modules like `spaces-search-params.ts`. |
| `src/lib/runtime/` | Cross-cutting: `authMode` (system vs user token), `clients` (SDK factories), `errors` (`getErrorMessage`), `locales`. |
| `src/lib/utils/` | `auth`, `configuration`, `response`, `systemAccessToken`, etc. |

### Naming

- **Action files**: `{verb}-{resource}.ts` (e.g. `search-participatory-space.ts`).
- **Parameter builders / validation**: `spaces-search-params.ts`, `search-component.helpers.ts` — pure parsing and SDK-shaped objects where possible.
- **Tests**: mirror `src` under `test/unit` and `test/integration`.

## Conventions

### Request flow (actions)

Typical shape, in order:

1. **Parse** props (and optional `extractAuth`).
2. **Validate** preconditions (Zod, `assertProp`, or API errors).
3. **Call** SDK / HTTP.
4. **Return** `response(payload)` or `response(payload, getErrorMessage(e))`.

Avoid empty `catch` blocks. Top-level action `catch` should surface a string via `getErrorMessage` (includes **Zod** and **Axios** detail).

### Responses

| Key | When |
|-----|------|
| `ok` | `true` on success, `false` when `error` is set |
| `error` | Human-readable message from the last failure |
| `access_token` | Impersonate, some user flows |
| `auth_mode` | `system` or `user` |
| `proposal_id`, `draft_proposal_id`, `component_id`, `space_id` | For chaining steps |
| `has_more` | List steps when `count === per_page` |
| `pagesFetched` | Search Participatory Space — API pages read during auto-pagination |

### Search Participatory Space

- **Title contains** + **Space type** and/or **Advanced filters** — at least one is required.
- **Max spaces (total)** caps how many items are collected across pages.
- **Items per page** maps to the API `per_page` (max 100).
- Advanced filter **Values (JSON array)** is optional; if **Value** is set, Values is ignored.
- Implementation: `spaces-search-params.ts` (validation + query params), `search-participatory-space.ts` (auth + pagination loop).

## Chaining outputs

Use **`access_token`** from **Impersonate** (or paste a token) into **User access token (optional)** on actions that use `resolveAuthContext`.

- **Impersonate** returns `access_token`, `token`, `user`, `expires_in`, `scope`.
- **Draft proposals** needs a user token; the action fails if only client credentials are used.

### Example flow

1. **Search Component** — find `manifest_name: proposals`, note `component_id`.
2. **Impersonate** — map `{{step.access_token}}` into the next step.
3. **Draft proposals → Create** — set **User access token** to `{{impersonate.access_token}}`, **Component ID** from step 1.
4. **Draft proposals → Update** — title/body JSON.
5. **Draft proposals → Publish** — use draft id from create/read.

Published listing/voting: **Proposals** action with the same optional user token when needed.

## OpenAPI coverage

`implemented-operation-ids.json` lists covered `operationId`s. With the Decidim spec available:

```bash
npm run check-openapi-coverage -w @activepieces/piece-decidim
# or: DECIDIM_OPENAPI_JSON=/path/to/openapi.json node scripts/verify-openapi-coverage.mjs
```

## Tests

```bash
cd packages/pieces/community/decidim
npm run test
# or: npx vitest run
# from repo root: npx turbo test --filter=@activepieces/piece-decidim
```

- **Unit**: helpers, `spaces-search-params`, mocked actions.
- **Integration**: behind env vars (see individual test files).

## Piece auth validation

`decidimAuth.validate` treats any request failure as invalid credentials (it does not return the upstream error text). That keeps the settings UI simple; use server logs if token exchange fails unexpectedly.
