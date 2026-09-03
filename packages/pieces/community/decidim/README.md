# Decidim piece (Activepieces)

Integration with a [Decidim](https://decidim.org/) instance via the REST API and generated `@octree/decidim-sdk` client.

## Layout (where to change what)

| Path | Purpose |
|------|---------|
| `src/decidimAuth.ts` | Piece auth: connection **Name** + **Tenants JSON** (host → credentials map). |
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

## Piece auth (tenant pack)

**Breaking in 1.0.0.** Old single-host connections (Base URL + Client ID + Client Secret + Scopes) must be recreated.

Connection fields:

- **Name** — label in the connections list.
- **Tenants JSON** — object keyed by Decidim instance URL:

```json
{
  "https://participate.city.fr": {
    "client_id": "...",
    "client_secret": "...",
    "scopes": "oauth"
  }
}
```

On save, `decidimAuth.validate` mints a client-credentials token for **every** host and collects failures (it does not fail on the first row only). Secrets live in LongText (visible in the connection form).

Every Decidim **action** has a required **Platform host** dropdown (keys of that JSON). Map it from a previous step with (X) when the host is known at runtime (e.g. WhatsApp → lookup → host). Webhook triggers do not call Decidim and have no host field.

`extractAuth` resolves `{ baseUrl, clientId, clientSecret, scopes }` from the selected host. Unknown host fails closed (no fallback to the first key).

**Custom API Call** also requires **Platform host**. Relative URLs use that host as the base. `Authorization` from Headers still overrides the minted connection token.

## Multi-tenant WhatsApp flow

1. One Decidim connection with the full tenant pack.
2. Lookup WhatsApp `phone_number_id` → platform host URL (Tables / state-store; non-secret).
3. Decidim steps: same connection + **Platform host** from the lookup.
4. Get Token / Impersonate only after host is set; they still return token only.
