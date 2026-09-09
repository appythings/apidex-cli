# Contributing to apidex-cli

## Development setup

```bash
npm ci
npm test
```

Requires Node.js 22 or newer. Tests run with Jest; coverage thresholds are enforced in `jest.config.js` (90% global minimum, higher for some files). New code under `src/` falls under those thresholds, so add tests beside it in `tests/`.

Run the CLI from the checkout with `node src/index.js <command>`, or `npm link` to get a global `apidex-cli` that points at your working copy. The `examples/` folder is a manual smoke kit against a local portal; Jest does not use it.

## Repository layout

- `src/index.js` wires the commander commands.
- `src/commands/` holds one orchestration module per command.
- `src/devportal/portal.js` contains every HTTP call to the API-dex API.
- `src/validate/` holds the `validate` command's checks and option resolution.
- `src/lib/` holds shared helpers: OpenAPI validation, overlays, JWT client assertions, error formatting.

## Manual integration verification

1. Use a throwaway manifest with `backendTeams` and a `backendTeam` on one product; run `apidex-cli upload-spec …` against a non-production environment.
2. Confirm with the API-dex API (`GET /api/teams`) that the team exists as `teamType: backend` and the product assignment matches.
3. Clean up: assign with `{ "backendTeamId": null }` (or manifest `backendTeam: ~`), then `DELETE /api/teams/{id}` for the scratch team.

## OpenAPI notes

- Supported: OpenAPI 3.0.x, 3.1.x and 3.2.x, validated with `@scalar/openapi-parser`, matching the API-dex backend.
- Paths-less or webhooks-only documents are not supported by all portal features.

## Releasing

1. Update `CHANGELOG.md` (rename the Unreleased section) and bump `version` in `package.json`.
2. Run `npm test` and `npm pack --dry-run`; the tarball must contain only `src/`, `README.md`, `CHANGELOG.md` and `LICENSE`.
3. Run a staging `upload-spec` against a non-production API-dex environment. Include one run with certificate credentials when `src/lib/jwt.js` changed.
4. Merge to `master`, tag `vX.Y.Z` and create a GitHub release. The `publish.yml` workflow publishes to npm with provenance; do not run `npm publish` locally.

Publishing with provenance requires an `NPM_TOKEN` repository secret with publish rights on `@appythings/apidex-cli`, or trusted publishing configured on npm for this repository.
