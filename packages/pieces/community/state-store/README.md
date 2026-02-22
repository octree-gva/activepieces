# State Store Piece

A Redis-backed conversation state machine for Activepieces that manages conversation state with finite state machine (FSM) validation and event streaming.

## Overview

This piece provides a state management system for conversational applications. It stores conversation state in Redis, validates state transitions using a configurable FSM, and emits events when conversations change state.

**Key Concepts:**
- **Namespace**: Isolates different chatbot domains (e.g., "bot:proposal", "bot:support")
- **Conversation**: A single conversation instance identified by a unique ID
- **State**: The current position in the conversation flow (e.g., "START", "PROPOSE", "PROPOSE_TITLE")
- **FSM**: Defines valid state transitions (e.g., START → PROPOSE → PROPOSE_TITLE)
- **Events**: Automatically emitted when conversations change state, enabling reactive workflows

## Connection

When creating a State Store connection, configure:
- **Redis URL**: Connection URL (e.g., `redis://:password@localhost:6379`)
- **Namespace**: Isolates chatbot domains (e.g., `bot:proposal`)
- **FSM**: Finite state machine definition (see example below)

**Example FSM:**
```json
{
  "initial": "START",
  "transitions": {
    "START": ["PROPOSE"],
    "PROPOSE": ["PROPOSE_TITLE", "START"]
  }
}
```

All actions and triggers using the connection share this FSM.

## Actions

### Get Conversation State
Retrieves the current state and data for a conversation. If the conversation doesn't exist, it creates a new one with the initial state from the configured FSM (or "UNKNOWN" if no FSM is configured).

**When to use:** Check the current state of a conversation or initialize a new conversation.

**Inputs:**
- `namespace`: Namespace identifier
- `conversation_id`: Unique conversation identifier (e.g., user ID, session ID)

**Output:**
- `ok`: Success indicator (boolean)
- `created`: Whether a new conversation was created (boolean)
- `conversation`: Conversation object with `state` (string) and `data` (object)

**Behavior:**
- If conversation exists: returns existing state and data
- If conversation doesn't exist: creates it with initial state and emits a creation event

### Update Conversation State
Transitions a conversation to a new state. Validates the state transition (using FSM), then emits an event.

**When to use:** Move a conversation to the next step in your flow after user interaction or processing.

**Inputs:**
- `namespace`: Namespace identifier
- `conversation_id`: Unique conversation identifier
- `state`: New state to transition to (must be valid according to FSM)
- `data`: Data object for the conversation state (loosely validated; any JSON-serializable object)

**Output:**
- `ok`: Success indicator (boolean)
- `conversation`: Updated conversation object with new `state` and `data`
- `error`: Error object with `code` and `message` if validation fails

**Validation:**
- **FSM Transition**: Ensures the transition from current state to new state is allowed
- **Event Emission**: Automatically emits event to Redis Streams for triggerable flows

**Error Codes:**
- `INVALID_TRANSITION`: The state transition is not allowed by the FSM

### Inspect State Configuration
View the configured state machine schema and recent conversation events. Useful for debugging and monitoring.

**When to use:** Troubleshoot state machine issues or monitor conversation activity.

**Inputs:**
- `namespace`: Namespace identifier
- `event_count`: Number of recent events to return (default: 10)

**Output:**
- `ok`: Success indicator (boolean)
- `namespace`: The namespace queried
- `schema`: The configured schema bundle (FSM)
- `events`: Array of recent conversation change events
- `event_count`: Number of events returned

## Trigger

### On Conversation Changed
A polling trigger that fires whenever a conversation changes state in the specified namespace. Use this to build reactive workflows that respond to conversation state changes.

**When to use:** Create workflows that automatically respond when conversations move to specific states.

**Configuration:**
- `namespace`: Namespace to monitor for conversation changes

**Event Payload:**
```json
{
  "namespace": "bot:proposal",
  "conversation_id": "whatsapp:+351...",
  "previous": { 
    "state": "PROPOSE", 
    "data": {} 
  },
  "current": { 
    "state": "PROPOSE_TITLE", 
    "data": { 
      "title": "Example proposal" 
    } 
  },
  "at": "2026-01-24T12:00:00Z"
}
```

**How it works:**
- Polls Redis Streams for new conversation events
- Emits events in chronological order
- Deduplicates events to prevent duplicate triggers
- Works with any conversation state change (created or updated)

## Typical Workflow

1. **Create connection** (one-time setup)
   - Configure Redis URL, namespace, and FSM in the connection settings

2. **Get Conversation State** (when starting/interacting)
   - Use "Get Conversation State" to retrieve or initialize a conversation
   - Returns current state and data, or creates new conversation with initial state

3. **Update Conversation State** (when progressing)
   - Use "Update Conversation State" to move conversations through your flow
   - Validates transitions against the connection's FSM, then emits events

4. **React to Changes** (optional, for reactive workflows)
   - Use "On Conversation Changed" trigger to build workflows that respond to state changes
   - Useful for notifications, analytics, or multi-step processes

## Example: Proposal Bot Flow

```json
// Connection: namespace = "bot:proposal", FSM =
{
  "initial": "START",
  "transitions": {
    "START": ["PROPOSE"],
    "PROPOSE": ["PROPOSE_TITLE", "START"],
    "PROPOSE_TITLE": ["PROPOSE_DESCRIPTION", "START"],
    "PROPOSE_DESCRIPTION": ["COMPLETE", "START"]
  }
}

// Step 1: Get or create conversation
{
  "namespace": "bot:proposal",
  "conversation_id": "whatsapp:+351912345678"
}
// Returns: { "state": "START", "data": {} }

// Step 2: Update conversation state
{
  "namespace": "bot:proposal",
  "conversation_id": "whatsapp:+351912345678",
  "state": "PROPOSE",
  "data": {}
}
// Validates transition START → PROPOSE, emits event

// Step 3: Update with data
{
  "namespace": "bot:proposal",
  "conversation_id": "whatsapp:+351912345678",
  "state": "PROPOSE_TITLE",
  "data": { "title": "My Proposal" }
}
// Validates transition PROPOSE → PROPOSE_TITLE, emits event
```

## Local Development and Testing

### Prerequisites

- Node.js v18+ and npm v9+
- Docker and Docker Compose (for local Redis)
- Activepieces development environment set up

### Setting Up Redis Locally

The piece includes a `docker-compose.yml` file for local Redis development:

```bash
cd packages/pieces/community/state-store
docker-compose up -d
```

This starts Redis on `localhost:6379` with:
- Password: `my_insecure_password`
- Persistence enabled (AOF)
- Health checks configured

**Connection URL for local development:**
```
redis://:my_insecure_password@localhost:6379
```

To stop Redis:
```bash
docker-compose down
```

### Running Tests

Run unit tests using Nx:

```bash
# From the repository root
nx test pieces-state-store

# Or from the piece directory
cd packages/pieces/community/state-store
nx test pieces-state-store
```

Tests use mocked Redis connections and cover:
- Action implementations (get-conversation, set-conversation)
- Utility functions (validation, schema, JSON, Redis)
- Error handling and edge cases

### Running Activepieces with This Piece

1. **Enable the piece in development mode:**

   Set the `AP_DEV_PIECES` environment variable to include `state-store`:

   ```bash
   export AP_DEV_PIECES=state-store
   ```

   Or add it to `packages/server/api/.env`:
   ```
   AP_DEV_PIECES=state-store
   ```

2. **Start Activepieces:**

   ```bash
   # From repository root
   npm start
   ```

   This starts:
   - Frontend at `http://localhost:4200` (or 4300)
   - Backend API at `http://localhost:3000`
   - Engine worker

3. **Configure the connection:**

   - Navigate to `http://localhost:4200` and sign in (default: `dev@ap.com` / `12345678`)
   - Create a new connection for the State Store piece
   - Use Redis URL: `redis://:my_insecure_password@localhost:6379`
   - Set your namespace (e.g., `bot:proposal`)
   - Define FSM (initial state and transitions)
   - Enable SSL only if using a secured Redis instance

### Testing in Activepieces UI

1. Create a workflow using the State Store piece
2. Use "Get Conversation State" to retrieve or create conversations
3. Use "Update Conversation State" to transition conversations
4. Set up "On Conversation Changed" trigger to react to state changes

### Debugging

- Use "Inspect State Configuration" action to view configured schemas and recent events
- Check Redis directly: `docker exec -it state-store-redis redis-cli -a my_insecure_password`
- View Redis keys: `KEYS bot:*` (replace `bot` with your namespace prefix)
- Monitor events: `XREAD COUNT 10 STREAMS bot:proposal:events 0`

## Technical Details

### Redis Keys

All keys are derived from namespace:
- `{namespace}:conversation:{conversation_id}` - Conversation state storage
- `{namespace}:events` - Redis Streams event log (max 10,000 events)

### Concurrency

- Uses Redis `SET NX` for atomic conversation creation
- Safe for concurrent access from multiple workflows
- Race conditions are handled gracefully

### Event Streaming

- Events are stored in Redis Streams with automatic trimming (max 10,000 events)
- Events include previous state, current state, and timestamp
- Trigger uses polling strategy with deduplication
