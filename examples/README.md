# Examples

Smoke kit for the three CLI commands against a **local Apigee X** portal.
Jest does **not** use this folder (`tests/fixtures/` covers automated cases).

Do not commit tokens. Export them in your shell (or a gitignored file):

```bash
export APIDEX_HOST=http://127.0.0.1:3000
export APIDEX_ENVIRONMENT=123456
export APIDEX_TOKEN=   # admin token if you assign backend teams
```

`--environment` is the Apidex environment **id** of the seeded Apigee X env
(`dev-env` / `123456`), not the Apigee environment name.

## Spec (`examples/spec/`)

| Piece | What it exercises |
| --- | --- |
| `CLI category` | Category spec: `echo.yaml` + overlays (`POST /api/specs`) |
| `pep-echo` | `inheritSpec: true` — no product spec; catalog join uses the inherit link (title **Echo v1**) |
| `teams` / `backendTeams` | Generic producer + backend team (`owner@example.test`) |

This matches [PDX-1728](https://appyknows.atlassian.net/browse/PDX-1728): a category spec plus inherit products. Overlays belong on the category only.

If `pep-echo` already has an own-spec from an earlier upload (`inheritSpec: false`, `latest: true`), delete that spec (or confirm the inherit row is the one `retrievePathsFromSpec` finds) before judging the catalog. A second inherit upload returns `200 {}`; the CLI still prints success.

`--force` does not apply to inherit link rows.

Run from `examples/spec/` so `openapi` and overlay `path` values resolve for
`upload-spec`.

```bash
cd examples/spec

node ../../src/index.js validate apis.yaml \
  --environment "$APIDEX_ENVIRONMENT" \
  --host "$APIDEX_HOST" \
  --token "$APIDEX_TOKEN"
node ../../src/index.js validate apis.yaml --require-locales nl-NL,de-DE \
  --environment "$APIDEX_ENVIRONMENT" \
  --host "$APIDEX_HOST" \
  --token "$APIDEX_TOKEN"

# live local portal
node ../../src/index.js upload-spec apis.yaml \
  --environment "$APIDEX_ENVIRONMENT" \
  --host "$APIDEX_HOST" \
  --token "$APIDEX_TOKEN"
```

`--host` must include the scheme (`http://127.0.0.1:3000`).

## Markdown (`examples/markdown/`)

From the repo root:

```bash
node src/index.js upload-markdown examples/markdown \
  --host "$APIDEX_HOST" \
  --token "$APIDEX_TOKEN"
```
