# Changelog

Major versions of apidex-cli track the API-dex release they target: 1.x targeted API-dex 1 and 2 (including SAP API Management), 3.x targets API-dex 3 (Apigee, Gravitee, Azure API Management). There was no 2.x release of the CLI.

## Unreleased

### Added
- OpenAPI **3.2.x** support via `@scalar/openapi-parser`.
- Automated tests for OAS 3.2 validation.
- `apidex-cli validate` always checks that manifest API products exist in the portal (name or id, not displayName). Needs `--host`, `--environment`, and `--token` or the same client credentials as `upload-spec`. Overlay checks still run if the portal call fails.
- Upload fails when a new spec version would drop published overlays: no overlay files, or a subset of the locales already on the portal (`--force` does not bypass). Equal or superset is OK.
- Failed category overlay PUT deletes the new category spec (same as the UI). That can cascade `inheritSpec` product specs for the same category; re-run `upload-spec` to restore inherit links.

### Fixed
- Startup crash on Node 25+ (`TypeError: Cannot read properties of undefined (reading 'prototype')` from the `jsonwebtoken` dependency chain). Client-assertion JWTs are now signed with Node's built-in `crypto`; `jsonwebtoken`, `jsrsasign` and `uuid` are no longer dependencies. The `x5t` header is now base64url-encoded as RFC 7515 requires (previously standard base64).
- Category overlay drop-check looks up the category spec only. It no longer falls through to an API product of the same name.

### Changed
- Licence declared as Apache-2.0 in package.json, matching the LICENSE file (previously mis-declared as ISC).
- npm package now ships only `src/`, README, CHANGELOG and LICENSE; releases publish from GitHub Actions with provenance.
- CI tests on Node 22 and 24. Maintainer notes moved from the README to CONTRIBUTING.md.
- Replaced `@apidevtools/swagger-parser` with `@scalar/openapi-parser`.
- Requires **Node.js >= 22**.
- Overlay wording is Overlay 1.x (including `remove` and non-copy `update`), not copy-only translations.
- Replaced `examples/overlay-demo/` with `examples/spec/` (validate + upload-spec) and `examples/markdown/` (upload-markdown). Spec example targets local Apigee X product `pep-echo` (displayName Echo v1) inheriting category `CLI category` (`echo.yaml`, OpenAPI 3.2).
- Spec upload paths encode environment and product names (so names like `Echo V1` work). `upload-markdown` keeps `https://` hosts as-is when `--host` already includes a scheme.

## 1.1.0

### Added
- OpenAPI **3.1.x** support (including `3.1.2`), aligned with `@apidevtools/swagger-parser@12.1.0` (same version as the Apidex backend).
- Automated tests for OAS 3.1 validation and upload flow.

### Changed
- Upgraded `@apidevtools/swagger-parser` from `10.1.1` to `12.1.0`.
- Requires **Node.js >= 18**.

### Notes
- `openapi` and `info.version` must be **quoted strings** in YAML (e.g. `openapi: "3.1.0"`, not unquoted `3.1`).
- Remote HTTP `$ref`s to internal/localhost hosts are no longer resolved by the parser (v12 SSRF hardening); use file or internal `#/` refs.
- Paths-less / webhooks-only OAS 3.1 documents are **not supported** by downstream portal features.

## 1.0.11

Previous release.
