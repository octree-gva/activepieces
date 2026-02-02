# State Store Piece

A conversation state machine piece for Activepieces that provides Redis-backed state storage with FSM validation and event streaming.

## Features

- **Namespace Isolation**: Each chatbot domain uses a separate namespace
- **FSM Validation**: Validates state transitions based on configured finite state machine
- **JSON Schema Validation**: Validates conversation data using JSON Schema
- **Event Streaming**: Emits events to Redis Streams for triggerable flows
- **Atomic Operations**: Safe concurrent access using Redis NX operations

## Actions

### Set Schema Bundle
Stores the FSM and JSON Schema for a namespace. Overwrites existing schema bundle.

**Inputs:**
- `namespace`: Namespace identifier (e.g., "bot:proposal")
- `fsm`: Optional FSM definition with `initial` state and `transitions` object
- `json_schema`: Optional JSON Schema for validating conversation state and data

### Get Conversation (UPSERT)
Fetches conversation state; creates it with initial state if missing.

**Inputs:**
- `namespace`: Namespace identifier
- `conversation_id`: Unique conversation identifier

**Output:**
- `ok`: Success indicator
- `created`: Whether conversation was created
- `conversation`: Conversation object with `state` and `data`

### Set Conversation
Updates conversation state with full validation and event emission.

**Inputs:**
- `namespace`: Namespace identifier
- `conversation_id`: Unique conversation identifier
- `state`: New state to transition to
- `data`: Data object for the conversation state

**Validation:**
- Validates FSM transition (if schema exists)
- Validates data with JSON Schema (if schema exists)
- Emits event to Redis Streams

**Output:**
- `ok`: Success indicator
- `conversation`: Updated conversation object
- `error`: Error object with `code` and `message` if validation fails

### Debug Schema Bundle
Returns schema bundle content and recent events for debugging.

**Inputs:**
- `namespace`: Namespace identifier
- `event_count`: Number of recent events to return (default: 10)

## Trigger

### On Conversation Changed
Polling trigger that emits events when conversation state changes.

**Configuration:**
- `namespace`: Namespace to monitor

**Event Payload:**
```json
{
  "namespace": "bot:proposal",
  "conversation_id": "whatsapp:+351...",
  "previous": { "state": "PROPOSE", "data": {} },
  "current": { "state": "PROPOSE_TITLE", "data": { "title": "..." } },
  "at": "2026-01-24T12:00:00Z"
}
```

## Redis Keys

All keys are derived from namespace:
- `{namespace}:schema` - Schema bundle storage
- `{namespace}:conversation:{conversation_id}` - Conversation storage
- `{namespace}:events` - Redis Streams event log

## Example Usage

1. **Set up schema:**
```json
{
  "fsm": {
    "initial": "START",
    "transitions": {
      "START": ["PROPOSE"],
      "PROPOSE": ["PROPOSE_TITLE", "START"]
    }
  },
  "json_schema": {
    "type": "object",
    "required": ["state", "data"],
    "properties": {
      "state": { "type": "string" },
      "data": { "type": "object" }
    }
  }
}
```

2. **Get or create conversation:**
   - Automatically creates with initial state if missing
   - Emits creation event

3. **Update conversation:**
   - Validates transition and data
   - Emits change event

4. **Listen for changes:**
   - Use trigger to react to conversation state changes
