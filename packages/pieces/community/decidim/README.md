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
| `accessToken` | **Get Token** — the minted OAuth token only |
| `auth_mode` | `system` or `user` |
| `proposal_id`, `draft_proposal_id`, `component_id`, `space_id` | For chaining steps |
| `has_more` | List steps when `count === per_page` |

### Search Participatory Space

- Optional filters: **Space id**, **Space Manifest**, **Languages**, **Page**, **Items per page** (default 10, max 100).
- Empty filters list spaces (scoped by token).
- Implementation: `spaces-search-params.ts`, `search-participatory-space.ts`.

## Chaining outputs

Use **`access_token`** from **Impersonate** or **`accessToken`** from **Get Token** (or paste a token) into **User access token (optional)** on actions that use `resolveAuthContext`.

- **Get Token** returns only `accessToken`. Grant type is **ROPC** (nickname + scope; registers missing users, accepts TOS, skips confirmation) or **Client Credentials** (scope only). `client_id` / `client_secret` come from the connection.
- **Impersonate** returns `access_token`, `token`, `user`, `expires_in`, `scope`.
- **Draft proposals** needs a user token; the action fails if only client credentials are used.

### Example flow

1. **Search Component** — find `manifest_name: proposals`, note `component_id`.
2. **Impersonate** — map `{{step.access_token}}` into the next step.
3. **Draft proposal → Create** — set **User access token** to `{{impersonate.access_token}}`, **Component ID** from step 1.
4. **Draft proposal → Update** — title/body JSON.
5. **Draft proposal → Publish** — use draft id from create/read.

Published listing/voting: **Proposal** action with the same optional user token when needed.

**Organizations** — Search by host, Read by id.

**Blog** — Search by component id, Read by id.

**Proposal** — Search by component id, Read, Vote.

**Draft proposal** — Search by component id, Create, Read, Update, Withdraw, Publish.

**Search Users** — list users scoped by the current token.

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
