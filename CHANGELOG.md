# Changelog

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
