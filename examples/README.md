# Examples

Smoke kit for the CLI against a **local Apigee X** portal.
Jest does **not** use this folder (`tests/fixtures/` covers automated cases).

Do not commit tokens. Export them in your shell (or a gitignored file):

```bash
export APIDEX_HOST=http://127.0.0.1:3000
export APIDEX_ENVIRONMENT=123456
export APIDEX_TOKEN=   # or client credentials: APIDEX_CLIENTID / APIDEX_SECRET / APIDEX_TOKENURL / APIDEX_SCOPE
```

`--environment` is the Apidex environment **id** of the seeded Apigee X env
(`dev-env` / `123456`), not the Apigee environment name.

`openapi`, overlay `path`, `docs[].markdown`, and localized docs markdown
resolve from the **manifest directory**. You do not need to `cd` into
`examples/spec/` for that.

## Spec (`examples/spec/`)

| Piece | What it exercises |
| --- | --- |
| `CLI category` | Category spec: `echo.yaml` + overlays (`POST /api/specs`) |
| `pep-echo` | `inheritSpec: true` — no product spec; catalog join uses the inherit link (title **Echo v1**). `docs:` are Payload product tabs; Getting started includes `nl-NL` |
| `teams` / `backendTeams` | Generic producer + backend team (`owner@example.test`) |

This matches [PDX-1728](https://appyknows.atlassian.net/browse/PDX-1728): a category spec plus inherit products. Overlays belong on the category only. Product tabs (`docs:`) belong on `pep-echo`.

If `pep-echo` already has an own-spec from an earlier upload (`inheritSpec: false`, `latest: true`), delete that spec (or confirm the inherit row is the one `retrievePathsFromSpec` finds) before judging the catalog. A second inherit upload returns `200 {}`; the CLI still prints success.

`--force` does not apply to inherit link rows. `--force-docs` overwrites Payload tabs after CMS edits. `--skip-docs` uploads specs only.

```bash
# laptop linter (no token)
node src/index.js validate examples/spec/apis.yaml
node src/index.js validate examples/spec/apis.yaml --json

# add another tab (flags only)
# node src/index.js manifest add-doc pep-echo examples/spec/docs/faq.md --manifest examples/spec/apis.yaml

# add/update a translation on an existing tab (requires its slug)
# node src/index.js manifest add-doc pep-echo examples/spec/docs/getting-started.nl-NL.md \
#   --manifest examples/spec/apis.yaml --slug getting-started --locale nl-NL --update

node src/index.js validate examples/spec/apis.yaml --check-portal \
  --environment "$APIDEX_ENVIRONMENT" \
  --host "$APIDEX_HOST" \
  --token "$APIDEX_TOKEN"
node src/index.js validate examples/spec/apis.yaml --require-locales nl-NL,de-DE \
  --check-portal \
  --environment "$APIDEX_ENVIRONMENT" \
  --host "$APIDEX_HOST" \
  --token "$APIDEX_TOKEN"

# live local portal (Payload also POSTs /api/cms/product-docs)
node src/index.js upload-spec examples/spec/apis.yaml \
  --environment "$APIDEX_ENVIRONMENT" \
  --host "$APIDEX_HOST" \
  --token "$APIDEX_TOKEN"
```

Strapi portals skip the docs POST with a warning; specs still upload.

`--host` must include the scheme (`http://127.0.0.1:3000`).

## Markdown (`examples/markdown/`)

Filesystem tree for `upload-markdown` (not Payload product tabs):

```bash
node src/index.js upload-markdown examples/markdown \
  --host "$APIDEX_HOST" \
  --token "$APIDEX_TOKEN"
```
