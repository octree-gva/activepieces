<img src="https://raw.githubusercontent.com/octree-gva/activepieces/refs/heads/packages/octree/packages/pieces/community/i18n-store/src/logo.svg" /><br />
# i18n Store ActivePiece

A piece for managing internationalization (i18n) translations locally within Activepieces flows using [i18next](https://www.i18next.com/).

## Overview


Store translation files (JSON or YAML) at a project level and retrieve translations dynamically based on language and key paths.
This piece does not add any external dependancies, as it re-use `i18next` already used internally by ActivePiece.

## Actions

### Configure

Parse and store translation files into the flow store.
Will be re-usable in flows within the same project.

**Inputs:**
- `files` (required): Array of translation files
  - Each file should have `data` (Buffer), `filename`, and `extension`
  - Filename format: `{language}[_{region}].{ext}` (e.g., `en.json`, `fr.json`, `pt_BR.json`)
- `interpolationPrefix` (optional): Prefix for interpolation variables, default: `%{`
- `interpolationSuffix` (optional): Suffix for interpolation variables, default: `}`
- `fallbackLocale` (optional): Fallback language when translation not found, default: `en`

**Outputs:**
- `ok`: Boolean indicating success
- `languages`: Array of detected languages
- `message`: Status message

**Example:**
```json
{
  "ok": true,
  "languages": ["en", "fr"],
  "message": "Loaded 2 translation file(s) in your project"
}
```

### Translate

Retrieve a translation value by language and key path.

**Inputs:**
- `language` (required): Language code (e.g., `"en"`, `"fr"`)
- `path` (required): Translation key path
  - Simple: `"hello"`
  - Nested: `"greeting.hello"`
- `return_object` (optional): Return object instead of string, default: `false`
- `variables` (optional): Array of interpolation variables `[{key: "name", value: "John"}]`

**Outputs:**
- Translation value (string or object)

**Examples:**

Simple key:
- Input: `language: "en"`, `path: "hello"`
- Output: `"Hello"`

Nested key:
- Input: `language: "en"`, `path: "greeting.hello"`
- Output: `"Greetings"`

With interpolation:
- Translation: `"Hello %{name}"`
- Input: `language: "en"`, `path: "greeting"`, `variables: [{key: "name", value: "John"}]`
- Output: `"Hello John"`

Return object:
- Input: `language: "en"`, `path: "greeting"`, `return_object: true`
- Output: `{"hello": "Greetings", "goodbye": "Farewell"}`

### Get Settings

Retrieve current i18n store configuration settings.

**Inputs:**
- None

**Outputs:**
- `availableLocales`: Array of available locale codes (e.g., `["en", "fr", "de"]`)
- `fallbackLocale`: Fallback locale code (default: `"en"`)
- `interpolationPrefix`: Interpolation variable prefix (default: `"%{"`)
- `interpolationSuffix`: Interpolation variable suffix (default: `"}"`)

**Example:**
```json
{
  "availableLocales": ["en", "fr", "de"],
  "fallbackLocale": "en",
  "interpolationPrefix": "%{",
  "interpolationSuffix": "}"
}
```

## File Format

### JSON Example
```json
{
  "hello": "Hello",
  "greeting": {
    "hello": "Greetings",
    "goodbye": "Farewell"
  }
}
```

### YAML Example
```yaml
hello: Hello
greeting:
  hello: Greetings
  goodbye: Farewell
```

## Usage Example

**Step 1: Configure**
- Upload files: `en.json`, `fr.json`
- Set interpolation prefix: `%{` (default)
- Set interpolation suffix: `}` (default)
- Set fallback locale: `en` (default)

**Step 2: Translate**
- Language: `{{$json.userLanguage}}`
- Path: `"welcome.message"`
- Output: `"Welcome"` (if English) or `"Bienvenue"` (if French)

## Store Scope

All translations are stored with **PROJECT scope**, meaning:
- Isolated per project
- Persistent across flow runs
- Secure project-scoped data

## Development

Build:
```bash
npx nx build pieces-i18n-store
```

Test:
```bash
npx nx test pieces-i18n-store
```

Development:
```bash
export AP_DEV_PIECES=store,i18n-store
npm start
```
