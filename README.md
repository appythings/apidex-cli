# apidex-cli
Commandline tool to use the management APIs of Apidex

Supports **OpenAPI 3.0.x and 3.1.x** (including JSON Schema 2020-12 features). Specs are validated locally before upload and again by the Apidex backend. Requires **Node.js >= 18**.

## Installation
```npm i -g @appythings/apidex-cli```

## Usage
To upload your API's to apidex, create a yaml file with the following content:
```
products:
  - name: ID-of-the-API # For SAP and Apigee this is the name of the product, not the displayName
    openapi: swagger.json # link to an openapi spec in yaml or json format
    permissionGroup: owners # Permission group that is allowed access to this product (optional)
    overlays: # optional: per-locale translation overlays, see "Localized spec content"
      - locale: nl-NL
        path: overlays/nl-NL.yaml
categories: # You can also bundle multiple products in a category
  - name: category1 # Choose a unique name for the category
    openapi: swagger.json # link to an openapi spec in yaml or json format
    overlays: # optional: translations for the category spec (and every product inheriting it)
      - locale: nl-NL
        path: overlays/category1-nl-NL.yaml
    products:
      - name: ID-of-the-API
        inheritSpec: true # You can choose to let the product inherit the spec from the category
        permissionGroup: owners # Permission group that is allowed access to this product (optional)
      - name: ID-of-the-API
        inheritSpec: false
        openapi: swagger.json # Or the product will have it's own spec
        permissionGroup: owners # Permission group that is allowed access to this product (optional)
        backendTeam: backend-squad # optional: assign this API product to a backend team (by team name)
teams: # optional: producer teams (teamType normal)
  - name: team-name
    owner: owner@test.com
    permissionGroups:
      - owners
backendTeams: # optional: backend teams (teamType backend)
  - name: backend-squad
    owner: owner@test.com # query param developerId when creating the team (required by the API for membership)
    permissionGroups:
      - owners
```
Run:
```
apidex-cli upload-spec [options] <manifest>

uploads an openapi spec to apidex (OpenAPI 3.0.x or 3.1.x)

Options:
  --environment <environment>    add the environment to deploy this to
  --host <host>                  add the hostname for the developer portal
  --clientId <clientId>          add the clientId from your OpenID Connect provider linked to the developer portal
  --clientSecret <clientSecret>  add the clientSecret from your OpenID Connect provider linked to the developer portal
  --aud <aud>                    Only used in combination with client certificate authentication instead of clientSecret. Provide the audience for the client token. (default: null)
  --scope <scope>                add the scope for the developer portal app registration
  --tokenUrl <tokenUrl>          add the tokenUrl from your OpenID Connect provider (ex: https://login.microsoftonline.com/yourcompany.onmicrosoft.com/oauth2/v2.0/token)
  --force                        Force the database to overwrite spec regardless of version number (default: false)
  --token <token>                provide a token instead
  -h, --help                     display help for command
```

```
apidex-cli upload-markdown [options] <directory>

uploads a directory of markdown files to apidex

Options:
  --host <host>                  add the hostname for the developer portal
  --clientId <clientId>          add the clientId from your OpenID Connect provider linked to the developer portal
  --clientSecret <clientSecret>  add the clientSecret from your OpenID Connect provider linked to the developer portal
  --aud <aud>                    Only used in combination with client certificate authentication instead of clientSecret. Provide the audience for the client token. (default: null)
  --scope <scope>                add the scope for the developer portal app registration
  --tokenUrl <tokenUrl>          add the tokenUrl from your OpenID Connect provider (ex: https://login.microsoftonline.com/yourcompany.onmicrosoft.com/oauth2/v2.0/token)
  -h, --help                     display help for command

```

### Backend teams

- **`backendTeams`**: same shape as `teams`, but each entry is created with `teamType: backend`. If a team with the same name already exists, it must already be a backend team or the CLI fails with a clear error.
- **`backendTeam` on a product** (top-level `products` or under `categories[].products`): optional. When set to a string, the CLI resolves the backend team by name and calls `POST /api/environments/{environment}/apiproducts/{productId}/assign-backend-team`. When set to `null` or YAML `~`, the CLI **unassigns** any backend team for that product. **Omit the key** entirely if you do not want the CLI to change existing assignments for that product.
- **Authorization**: the Apidex API currently allows **admin** callers (not plain `cicd` service accounts without admin) on the assign-backend-team endpoint. Ensure your `--token` or client-credentials user has admin rights before relying on assignments in CI.

### Automated tests

```bash
npm test
```

Coverage thresholds are enforced in `jest.config.js`: 90% global minimum, with higher bars for `formatAxiosError.js` and `portal.js`.

### Manual integration verification

1. Use a throwaway manifest with `backendTeams` and a `backendTeam` on one product; run `apidex-cli upload-spec …`.
2. Confirm with the Apidex API (`GET /api/teams`, or your tenant’s admin tools) that the team exists as `teamType: backend` and the product assignment matches.
3. **Cleanup**: call assign with `{ "backendTeamId": null }` (or manifest `backendTeam: ~`), then `DELETE /api/teams/{id}` for the scratch team.

### OpenAPI version notes

- Supported: **OpenAPI 3.0.x** and **3.1.x** (validated with `@apidevtools/swagger-parser@12.1.0`, matching the backend).
- In YAML manifests/specs, quote version fields: `openapi: "3.1.0"` and `info.version: "1.0.0"` (unquoted `openapi: 3.1` is parsed as a number and rejected).
- Paths-less / webhooks-only 3.1 documents are not supported by all portal features; include `paths` for REST APIs.
- See [CHANGELOG.md](./CHANGELOG.md) for release details.

### Localized spec content (translations)

The developer portal can display OpenAPI spec content (titles, descriptions,
summaries) in the visitor's selected UI language. Translation is a
**presentation concern**: the spec you upload stays canonical, and each
translation ships as a separate [OpenAPI Overlay](https://spec.openapis.org/overlay/v1.1.0.html)
document. The portal merges the overlay into the spec when it serves it.

Declare one overlay per locale on a product or a category:

```yaml
products:
  - name: pet-store
    openapi: spec.yml
    overlays:
      - locale: nl-NL
        path: overlays/nl-NL.yaml
      - locale: de-DE
        path: overlays/de-DE.yaml
```

- `locale` is a portal locale code. Supported locales: `en-GB`, `nl-NL`,
  `de-DE`, `fr-FR`, `es-ES`, `se-SE`, `ar-SA`. A bare primary subtag (`nl`) or
  different casing (`NL-nl`) resolves to the canonical tag. An unsupported
  locale fails the upload rather than being silently dropped.
- `path` points at a `.yaml`, `.yml`, or `.json` overlay document, resolved
  relative to where you run the CLI.
- One entry per locale — a duplicate locale fails the upload.

#### Writing an overlay

An overlay is a small document of `actions`. Each action has a `target`
([JSONPath](https://datatracker.ietf.org/doc/html/rfc9535)) selecting a node in
the spec, and an `update` object merged into that node:

```yaml
overlay: 1.1.0
info:
  title: Dutch translation for Pet Store API
  version: 1.0.0
actions:
  - target: $.info
    update:
      description: Nederlandse beschrijving.
  - target: $.paths['/pets'].get
    update:
      summary: Huisdieren weergeven
      description: Geeft alle huisdieren terug.
```

Translate only presentation fields — `title`, `description`, `summary`, and tag
descriptions. Do **not** use overlays to change schema definitions, paths,
operation ids, or anything a consumer generates code from: the portal would then
show an API that does not match the one you published.

The CLI validates every overlay before uploading, so mistakes surface locally:
the `overlay` version must be `1.x.y`, `actions` must be non-empty, and each
action needs a `target` plus either an `update` or `remove: true`.

#### Categories and inherited specs

Overlays attach to a **spec**, not to a product name. A product with
`inheritSpec: true` shows the category's spec, so its translations belong on the
category:

```yaml
categories:
  - name: pet-category
    openapi: spec.yml
    overlays:
      - locale: nl-NL
        path: overlays/category-nl-NL.yaml
    products:
      - name: pets-public
        inheritSpec: true # translated by the category overlay above
      - name: pets-internal
        inheritSpec: false
        openapi: internal.yml
        overlays: # its own spec, so its own overlays
          - locale: nl-NL
            path: overlays/internal-nl-NL.yaml
```

Declaring `overlays` on an inheriting product logs a warning and is ignored,
because there is no product-owned spec to apply them to.

#### How the portal serves them

- The stored spec is never modified. Overlays are applied at read time, keyed by
  the requested locale.
- Fallback is per request, not per field: an exact locale match wins, then the
  primary subtag (`nl-NL` → `nl`), then the canonical spec. A locale with no
  overlay returns the canonical spec.
- Fields your overlay does not target keep their canonical values, so a partial
  translation never renders blank.
- A broken overlay never breaks a spec read — the portal logs it and serves the
  canonical spec.
- Unrelated vendor extensions (`x-request-id`, `x-correlation-id`) and `$ref`
  pointers are untouched.
- **Downloads and exports follow the portal language**, so a consumer reading
  the portal in Dutch downloads the Dutch rendering. Because only presentation
  fields are translated, the downloaded document is still a valid spec
  describing the same API — which is exactly why overlays must not touch
  schemas or operation ids. To fetch the canonical document, request it without
  a `locale`.

Overlays belong to a **spec version**. Uploading a new version carries up
whatever your manifest declares at that moment, so keep the overlay files in step
with the spec. Re-uploading an overlay for a locale replaces the previous one for
that locale; dropping an entry from `overlays` does **not** delete the
translation already stored. Remove it explicitly with
`DELETE /api/specs/{specId}/overlays`.

#### A note on `x-{attribute}-{locale}`

An earlier iteration embedded translations in the spec itself, as vendor
extensions such as `x-description-nl-NL`. The portal no longer reads them. It
never ran against real content, so there is nothing to migrate — such keys are
now just ordinary vendor extensions and are stored and served untouched. Put new
translations in overlay files as described above.

### Publishing (maintainers)

After merging to the release branch, from the repo root:

```bash
npm test
npm publish --access public
```

Run a staging `upload-spec` against a non-prod backend with a 3.1 fixture before publishing (see plan mitigations).
