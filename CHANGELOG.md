# Changelog

## Unreleased

### Added
- `apidex-cli validate` always checks that manifest API products exist in the portal (name or id, not displayName). Needs `--host`, `--environment`, and `--token` or the same client credentials as `upload-spec`. Overlay checks still run if the portal call fails.
- Upload fails when a new spec version would ship without overlay files while the portal already has overlays for that spec (`--force` does not bypass).

### Changed
- Overlay wording is Overlay 1.x (including `remove` and non-copy `update`), not copy-only translations.
- Replaced `examples/overlay-demo/` with `examples/spec/` (validate + upload-spec) and `examples/markdown/` (upload-markdown). Spec example targets local Apigee X product `pep-echo` (displayName Echo v1) inheriting category `CLI category` (`echo.yaml`).
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
