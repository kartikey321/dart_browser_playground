# Browser-side pub.dev resolution research

This document records the current feasibility of real browser-side `pub get` for `dart_browser_playground`.

## Current finding

Browser-only pub.dev fetching appears feasible for public hosted packages.

Verified on 2026-07-12:

- `https://pub.dev/api/packages/http` returns package metadata, all versions, `pubspec` data, `archive_url`, and `archive_sha256`.
- Metadata responses include `access-control-allow-origin: *`.
- Package archive responses from `archive_url` also include `access-control-allow-origin: *`.
- Archives are downloadable directly as `.tar.gz` from browser-accessible URLs.
- Downloaded archives can be decompressed and parsed in browser-compatible code using `DecompressionStream` and a minimal TAR reader.
- Downloaded archives can be verified against `archive_sha256` using WebCrypto SHA-256.
- Parsed archive files can be mapped into compiler-compatible virtual paths like `memory:/packages/<package>/lib/<file>.dart`.

Run the live check:

```sh
npm run probe:pubdev
```

The probe is intentionally not part of `npm run probe` because it depends on live network access and current pub.dev behavior.

## Relevant upstream contracts

Official pub.dev API docs:

- `https://pub.dev/help/api`

Hosted Pub Repository Specification V2:

- `https://github.com/dart-lang/pub/blob/master/doc/repository-spec-v2.md`

The hosted repository spec defines package metadata with `latest`, `versions`, `archive_url`, `archive_sha256`, and `pubspec`. It also says clients fetch the package archive by following the returned `archive_url`; the response must be a gzipped TAR archive.

## Proposed browser architecture

```text
pubspec.yaml
  ↓
pubspec parser
  ↓
hosted package source
  ├─ fetch https://pub.dev/api/packages/<name>
  ├─ cache metadata in IndexedDB
  └─ expose versions + pubspec constraints
  ↓
version solver
  ├─ SDK constraint filtering
  ├─ transitive dependency solving
  └─ selected package/version graph
  ↓
archive fetcher
  ├─ fetch archive_url
  ├─ verify archive_sha256 when present
  ├─ decompress gzip
  └─ unpack tar into virtual package store
  ↓
package_config generator
  ↓
analyzer + compiler worker
```

## Implementation stages

1. Keep current bundled-package Pub get as the stable path.
2. Add a `HostedPubPackageSource` module that can fetch metadata for one package. (`web/lib/hosted_pub_source.js`)
3. Add a package archive fetch/unpack probe for one small package. (`web/lib/package_archive.js`)
4. Add package source caching in IndexedDB.
5. Port or implement a minimal Pubgrub-compatible solver over fetched metadata. Current building blocks are `web/lib/pub_version.js`, which supports pub-style version comparison/ranges/caret constraints, and `web/lib/pub_resolver.js`, which performs simple hosted transitive resolution by accumulating constraints and selecting the best compatible version. This is not full Pubgrub yet.
6. Generate `package_config.json` from the solved graph.
7. Feed downloaded package sources into the analyzer and compiler workers.

## Constraints and non-goals for first real implementation

Initial real browser-side pub.dev support should be restricted:

- hosted pub.dev packages only
- no Git dependencies
- no path dependencies except the current workspace package
- no Flutter SDK packages
- no build_runner/build scripts
- no native assets
- no package hooks

This keeps the browser playground aligned with client-side Dart/Jaspr examples and avoids pretending to support full `dart pub get` semantics before the infrastructure exists.

## Open technical questions

- Which gzip/tar implementation should be used in-browser?
- Should the version solver be ported from `dart-lang/pub`, implemented in JS, or compiled from Dart?
- How much metadata/archive data should be cached in IndexedDB?
- Should package downloads be capped by compressed/uncompressed size?
- How should the UI distinguish bundled, downloaded, and unsupported dependencies?

## Current implementation artifacts

- `web/lib/hosted_pub_source.js` contains the browser-compatible hosted source client.
- `web/lib/package_archive.js` contains browser-compatible gzip/TAR archive parsing, SHA-256 verification, and archive-to-virtual-package text mapping.
- `web/lib/hosted_package_loader.js` downloads resolved hosted package archives, verifies them, maps them into `memory:/packages/...`, and produces package config entries.
- `web/lib/pub_version.js` contains the browser-compatible version/constraint helper used before full transitive solving exists.
- `web/lib/pub_resolver.js` contains the first simple hosted dependency resolver.
- `tool/probe_hosted_pub_source.mjs` tests the hosted source client without network access.
- `tool/probe_package_archive.mjs` tests archive parsing without network access.
- `tool/probe_hosted_package_loader.mjs` tests resolved package archive loading without network access.
- `tool/probe_pub_resolver.mjs` tests simple transitive dependency resolution without network access.
- `tool/probe_pubdev_feasibility.mjs` verifies live pub.dev metadata/archive CORS behavior.
