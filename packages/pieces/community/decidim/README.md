<h1 align="center"><img src="./src/logo.svg" alt="Decidim ActivePiece - Integrate Decidim with Activepieces" /></h1>
<h4 align="center">
    <a href="https://voca.city">Voca.city</a> |
    <a href="https://decidim.org">Decidim</a> |
    <a href="https://docs.decidim.org/en/">Decidim Docs</a> |
    <a href="https://meta.decidim.org">Participatory Governance (meta decidim)</a>  <br/>
    <a href="https://matrix.to/#/+decidim:matrix.org">Decidim Community (Matrix+Element.io)</a>
</h4>

# Decidim ActivePiece

This piece interacts with [Decidim](https://github.com/decidim/decidim) using the [decidim-restfull module](ssh://git@git.octree.ch:6118/decidim/vocacity/decidim-modules/decidim-module-rest_full.git).

## Prerequisites

Ensure you have the correct Node.js version installed. Run `nvm use .` to use the version specified in the project.

## Setup

### Starting Decidim

1. Run `docker-compose` to start a Decidim container.
2. Compile assets: `bin/compile-assets`
3. Start the Rails server: `bundle exec rails s -b 0.0.0.0`
4. Start the asset server: `bundle exec bin/shakapacker-dev-server`
5. Seed the database: `bundle exec rails db:seed`

Decidim is exposed at port 3001.

### System Configuration

1. Navigate to `/system` with default credentials:
   - Email: `system@example.org`
   - Password: `decidim123456789`
2. Add a "Client API" for the created organization, and check scopes and permissions.
3. Set the host to `pieces.localhost` in the system settings (organization edition).

### Development

1. Export the piece you want to work on: `export AP_DEV_PIECES=store,decidim`
2. Start the development server: `npm start`

### Connection Configuration

The Decidim connection requires:
- `client_id`/`client_secret`: From the Client API created in `/system`
- Base URL: `http://pieces.localhost:3001`

## Building

Run `npx nx build pieces-decidim` to build the library. The build is done in a github workflow to have tarball exported at each versions. 
Version are managed in packages/pieces/community/decidim/package.json

## Running unit tests

Run `npx nx test pieces-decidim` to execute the unit tests via jest.

## Features

### 🧩 Impersonate

Get an access token to perform actions as a participant in Decidim.

**Inputs:**
- `username` (required): The nickname of the user to impersonate (minimum 5 characters)
- `fetchUserInfo` (optional): If enabled, fetches user information from the Decidim API
- `registerOnMissing` (optional): If enabled, registers the user if they don't exist
- `registrationOptions` (optional, shown when `registerOnMissing` is enabled):
  - `userFullName` (optional): Full name of the user to register (minimum 5 characters)
  - `sendConfirmationEmailOnRegister` (optional): If enabled, sends a confirmation email to the user

**Outputs:**
- `token`: OAuth access token object containing `access_token`, `token_type`, `expires_in`, `refresh_token`, and `scope`
- `user`: User resource details (only if `fetchUserInfo` is enabled)

### 🧩 Participant Management

Manage Decidim participants with Search, Create, Read, Update operations.

#### Search

Search participants by extended data query.

**Inputs:**
- `extendedDataQuery` (required): JSON string to search in extended_data (e.g., `'{"chatbotUserId": "123"}'`)

**Outputs:**
- `users`: Array of matching user objects
- `count`: Number of users found

#### Create

Create a new participant or find an existing one by username. If the user exists, returns an impersonate token. If not, creates the user and returns an impersonate token.

**Inputs:**
- `username` (required): Nickname of the user
- `userFullName` (optional): Full name of the user
- `email` (optional): Email address for the user
- `extendedData` (optional): Extended data object to set (e.g., `{"chatbotUserId": "123"}`)
- `fetchUserInfo` (optional): If enabled, fetches user information after creation

**Outputs:**
- `token`: OAuth impersonate access token object
- `userId`: Decidim user ID
- `user`: User resource details (only if `fetchUserInfo` is enabled)

#### Read

Read participant data including extended data and user information.

**Inputs:**
- `userId` (required): Decidim user ID

**Outputs:**
- `userId`: Decidim user ID
- `data`: Extended data object (null if not set)
- `user`: User resource details

#### Update

Update participant extended data.

**Inputs:**
- `userId` (required): Decidim user ID
- `extendedData` (required): Extended data object to update (e.g., `{"chatbotUserId": "123"}`)
- `dataPath` (optional): Path in extended_data to update (defaults to `"."`)

**Outputs:**
- `userId`: Decidim user ID
- `data`: Updated extended data object
