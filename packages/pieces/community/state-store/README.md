# State Store Piece

Redis-backed finite-state machine for Activepieces. One FSM instance per Conversation ID in a connection namespace, with optional FSM-validated transitions and Jump to force a state. No history / go-back.

## Who this is for

Flow builders who need durable state for an FSM in Redis. Connection = Redis URL + namespace + optional FSM + Watcher URL. Conversation ID on each step = stable key for one instance.

## Product needs

| Need | How |
| --- | --- |
| Get state, then advance | **Get or Create State** → Router on `state` → **Update State** with next state |
| Force a state | **Update State** with **Jump, skip FSM** |
| Store data on the state | **Update State** merges `data` by default (or Replace Data) |
| Instance key | Conversation ID; Redis key `{namespace}:conversation:{conversationId}` |
| No history | No previous-state stack, no go-back |

## Connection

Configure once:

- **Redis URL** — use the same Redis as Activepieces when possible
  - Docker Compose (`docker-compose.octree.yml`): `redis://redis:6379` from another container, or `redis://localhost:6379` from the host if the Redis port is published
  - Do **not** start a second Redis on 6379 for the happy path
- **Namespace** — isolates FSM instances (e.g. `orders`)
- **Watcher URL** — HTTP URL of the Redis watcher for **On State Changed (Webhook)** (default `http://127.0.0.1:3847`). Falls back to `AP_STATE_STORE_BRIDGE_URL` when empty on an old connection
- **FSM** — optional `initial` + `transitions` map. Empty means any state is allowed

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

## Happy path

```text
Inbound event
  → Get or Create State (Conversation ID)
  → Router on conversation.state
  → handle
  → Update State (next state + merge data)
```

1. **Get or Create State** — returns `conversation`, `created`, and `allowed_next_states`.
2. **Router** — branch on `conversation.state`.
3. **Update State** — pick next state from the FSM dropdown (or type it when no FSM); merge data. Same-state updates always succeed. True no-ops (same state and same data) do not write a stream event.

## Force a state

```text
  → Update State (Jump, skip FSM → target state + optional data)
```

Turn on **Jump, skip FSM** so the target state does not need to be an allowed FSM transition.

## Actions

### Get or Create State

Retrieves state and data for a Conversation ID. Creates at FSM `initial` (or `unknown` if no FSM) if missing.

**Output:** `ok`, `created`, `conversation` (`state`, `data`), `allowed_next_states`

### Update State

Transitions and/or merges data.

| Prop | Role |
| --- | --- |
| Conversation ID | Same key as Get |
| State | Optional. Empty = stay; otherwise next state from FSM dropdown (or text when no FSM) |
| Data | Merged into existing payload |
| Replace Data | Wipe-and-set instead of merge |
| Jump, skip FSM | Skip transition validation |

**Errors:** `INVALID_TRANSITION` when Jump is off, an FSM is configured, and the move is not allowed (or current state is unknown to the FSM).

### Inspect FSM

Debug: connection FSM + recent stream events (optional Conversation ID filter).

## Triggers

**On State Changed** (polling) — fires when an FSM instance changes state or data. Optional State Filter. Skips true no-ops.

**On State Changed (Webhook)** — same events via the Redis watcher. On enable, HTTP-subscribes `context.webhookUrl` with the connection namespace (optional State Filter) at the connection **Watcher URL**. The step shows live watcher health (`GET /health`). One watcher process forwards `{namespace}:events` stream payloads to matching flows.

### Watcher process

| Variable | Default | Role |
| --- | --- | --- |
| `AP_STATE_STORE_BRIDGE_PORT` | `3847` | Port the watcher HTTP server binds |
| `AP_STATE_STORE_BRIDGE_URL` | `http://127.0.0.1:3847` | Fallback subscribe URL when the connection Watcher URL is empty |
| `AP_REDIS_URL` | (required) | Redis for FSM instances, streams, and subscriber registry |

Octree compose sets these on the `app` service. The watcher runs as PM2 `activepieces-state-store-bridge` in the same container.

Local watcher:

```bash
cd packages/pieces/community/state-store
AP_REDIS_URL="redis://localhost:6379" npm run bridge
```

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

- `{namespace}:conversation:{conversationId}` — current state + data
- `{namespace}:events` — Redis stream (trimmed ~10k); for triggers only, not history

## Concurrency

Create uses `SET NX`. Concurrent Gets for a new Conversation ID resolve to one instance.
