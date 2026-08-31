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
    overlays: # optional: per-locale OpenAPI Overlay 1.x documents, see "Per-locale OpenAPI overlays"
      - locale: nl-NL
        path: overlays/nl-NL.yaml
categories: # You can also bundle multiple products in a category
  - name: category1 # Choose a unique name for the category
    openapi: swagger.json # link to an openapi spec in yaml or json format
    overlays: # optional: Overlay 1.x for the category spec (and every product inheriting it)
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
apidex-cli validate [manifest] [--require-locales <list>]

validate OpenAPI overlay files in a spec manifest (no API calls, no tokens)

Options:
  --require-locales <list>  comma-separated locales every non-inherited spec must declare overlays for
  -h, --help                display help for command
```

Same binary as `upload-spec`. Spec-repo CI can run this in a PR job with only the CLI and the manifest. A settings file that supplies a default manifest path and required locales is coming later; until then pass the manifest path (and `--require-locales` when you want that gate). Example: `examples/overlay-demo/`.

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

### Per-locale OpenAPI overlays

The portal applies a full [OpenAPI Overlay 1.x](https://spec.openapis.org/overlay/v1.1.0.html)
document for the visitor's UI locale (`?locale=nl-NL`). The spec you upload stays
canonical in Mongo; each overlay is a JSONPath patch (`update` and/or `remove`)
that can change copy, hide paths, swap `servers`, or add `x-*` fields. The
downloaded spec **is** the merged overlay for that locale, including structural
changes, so only ship actions you intend consumers to see.

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

Run `apidex-cli validate apis.yaml` (and optionally `--require-locales nl-NL,de-DE`)
before `upload-spec` so unmatched JSONPath targets and missing files fail in CI
instead of at upload time.

#### Writing an overlay

Each action has a `target` ([JSONPath](https://datatracker.ietf.org/doc/html/rfc9535))
and either `update` or `remove: true`:

```yaml
overlay: 1.1.0
info:
  title: Dutch overlay
  version: 1.0.0
actions:
  - target: $.info
    update:
      description: Nederlandse overlay.
  - target: $.paths['/internal']
    remove: true
```

Upload still checks Overlay shape (`overlay` version `1.x.y`, non-empty `actions`,
each action a `target` plus `update` and/or `remove`). `validate` also fails when
a `target` matches no node in the local spec.

#### Categories and inherited specs

Overlays attach to a **spec**, not to a product name. A product with
`inheritSpec: true` shows the category's spec, so its overlays belong on the
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
        inheritSpec: true # uses the category overlay above
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
- Fields your overlay does not target keep their canonical values.
- A broken overlay never breaks a spec **read** — the portal logs it and serves the
  canonical spec. Overlay **writes** still surface errors.
- **Downloads and exports follow the portal language**, including `remove` /
  non-copy `update`. To fetch the canonical document, request it without a
  `locale`.

Overlays belong to a **spec version** and are **not** copied on a version bump.
`upload-spec` **fails** (exit 1) when the manifest entry has no overlay files and
the portal already has overlays for that product or category spec. `--force` does
not bypass this. First-time specs with no overlays succeed. `inheritSpec` products
are exempt (overlays live on the category). Clear stored overlays with
`DELETE /api/specs/{specId}/overlays`.

#### A note on `x-{attribute}-{locale}`

An earlier iteration embedded copy in the spec itself, as vendor extensions such
as `x-description-nl-NL`. The portal no longer reads them. Put new locale views
in overlay files as described above.

### Publishing (maintainers)

After merging to the release branch, from the repo root:

```bash
npm test
npm publish --access public
```

Run a staging `upload-spec` against a non-prod backend with a 3.1 fixture before publishing (see plan mitigations).
