# State Store Piece

Redis-backed conversation state for Activepieces chatbots. One conversation per user in a connection namespace, with FSM-validated advances and optional jump for intercepts. No history / go-back.

## Who this is for

Flow builders composing WhatsApp (or similar) → Decidim (or other) flows. Connection = Redis URL + namespace (bot) + FSM. User ID on each step = WhatsApp sender (or any stable user key).

## Product needs

| Need | How |
| --- | --- |
| On a message: get state, then advance | **Get or Create Conversation** → Router on `state` → **Update Conversation** with next state |
| On an intercept: jump | **Update Conversation** with **Jump, skip FSM** |
| Store data on the state | **Update Conversation** merges `data` by default (or Replace Data) |
| State linked to current user | User ID prop; Redis key `{namespace}:conversation:{userId}` |
| No history | No previous-state stack, no go-back |

## Connection

Configure once:

- **Redis URL** — use the same Redis as Activepieces when possible
  - Docker Compose (`docker-compose.octree.yml`): `redis://redis:6379` from another container, or `redis://localhost:6379` from the host if the Redis port is published
  - Do **not** start a second Redis on 6379 for the happy path
- **Namespace** — bot / domain isolation (e.g. `bot:proposal`)
- **FSM** — `initial` + `transitions` map

Example FSM:

```json
{
  "initial": "START",
  "transitions": {
    "START": ["PROPOSE", "MENU"],
    "PROPOSE": ["PROPOSE_SUBMIT", "MENU"],
    "PROPOSE_SUBMIT": ["MENU"],
    "MENU": ["PROPOSE", "START"]
  }
}
```

## Happy path: normal message

```text
WhatsApp message
  → Get or Create Conversation (User ID = sender)
  → Router on conversation.state
  → handle (Decidim / i18n / …)
  → Update Conversation (next state + merge data)
  → WhatsApp send
```

1. **Get or Create Conversation** — returns `conversation`, `created`, and `allowed_next_states`.
2. **Router** — branch on `conversation.state`.
3. **Update Conversation** — pick next state from the FSM dropdown; merge session data. Same-state updates are always allowed (patch data without leaving the state).

## Intercept: special message

```text
WhatsApp special message
  → Update Conversation (Jump, skip FSM → target state + optional data)
  → WhatsApp send
```

Turn on **Jump, skip FSM** so the target state does not need to be an allowed FSM transition.

## Actions

### Get or Create Conversation

Retrieves state and data for a user. Creates at FSM `initial` (or `unknown`) if missing.

**Output:** `ok`, `created`, `conversation` (`state`, `data`), `allowed_next_states`

### Update Conversation

Transitions and/or merges data.

| Prop | Role |
| --- | --- |
| User ID | Same key as Get |
| State | Optional. Empty = stay; otherwise next state from FSM dropdown |
| Data | Merged into existing session data |
| Replace Data | Wipe-and-set instead of merge |
| Jump, skip FSM | Intercepts — skip transition validation |

**Errors:** `INVALID_TRANSITION` when Jump is off and the move is not allowed (or current state is unknown to the FSM).

### Inspect State Configuration

Debug: connection FSM + recent stream events (optional User ID filter).

## Triggers (side-flows)

**On Conversation Changed** (polling) — analytics / operators. Optional state filter. Not the bot loop (polling is too slow for chat).

**On Conversation Changed (Webhook)** — advanced; needs `bin/redis-webhook-bridge.ts`. Prefer channel inbound triggers for the bot.

## Local development

```bash
# Enable the piece
# packages/server/api/.env → AP_DEV_PIECES=state-store

# Use the Activepieces Redis from docker-compose.octree.yml (already required by the app).
# Connection URL from the host if Redis is published, or redis://redis:6379 from compose network.

npm start   # from repo root
```

Tests:

```bash
npx turbo run test --filter=@activepieces/piece-state-store
# or
cd packages/pieces/community/state-store && npm test
```

Build / lint:

```bash
npx turbo run build --filter=@activepieces/piece-state-store
npx turbo run lint --filter=@activepieces/piece-state-store
```

## Redis keys

- `{namespace}:conversation:{userId}` — current state + data
- `{namespace}:events` — Redis stream (trimmed ~10k); for triggers only, not user history

## Concurrency

Create uses `SET NX`. Concurrent Gets for a new user resolve to one conversation.
