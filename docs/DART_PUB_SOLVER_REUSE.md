# Reusing Dart pub solver code in the browser

We should not manually port all of `dart pub`.

The useful target is the Pubgrub/version-solving core. The browser playground can keep its existing JavaScript/browser pipeline for UI, CORS fetches, archive download, SHA-256 verification, TAR/GZip unpacking, virtual file mapping, and compiler-worker handoff. The solver implementation can later be swapped from the current JavaScript backtracking resolver to a Dart-compiled resolver module if the spike proves practical.

## Proposed boundary

```text
browser pubspec.yaml
  ↓
browser metadata/archive source
  ↓
JSON package graph input
  ↓
Dart pub solver wrapper compiled to JS/Wasm
  ↓
JSON selected versions output
  ↓
existing package archive loader + package_config generator
  ↓
DDC compiler worker
```

The wrapper should expose a small API, for example:

```text
solvePubVersions({
  root: { name, dependencies, environment },
  packages: {
    http: [
      { version, dependencies, environment, retracted }
    ]
  },
  sdk: { dart: "3.8.0" }
})
```

and return:

```text
{
  packages: [
    { name, version }
  ]
}
```

## What the local upstream audit shows

`tool/probe_pub_solver_reuse.mjs` inspects the sibling `dart-lang/pub` checkout. Current upstream files show:

- `lib/src/solver.dart` is the public internal entry point for `resolveVersions(...)`.
- `lib/src/solver/version_solver.dart` owns `VersionSolver`.
- `lib/src/solver/package_lister.dart` lazily asks `SystemCache` for package versions/dependencies.
- The solver path imports `SystemCache`, `Package`, `Pubspec`, `LockFile`, hosted/root source types, SDK handling, logging, and utility modules.

That means direct browser reuse is not just:

```text
import version_solver.dart
dart compile js
```

The likely required work is a small Dart package or fork layer that:

1. reuses Pubgrub solver classes where possible;
2. replaces `SystemCache` package lookup with an in-memory/browser metadata source;
3. avoids filesystem cache, lockfile persistence, process environment, and CLI logging;
4. compiles the wrapper with `dart compile js` or `dart compile wasm`;
5. is exercised against upstream `version_solver_test.dart` cases that match hosted-package browser support.

## Current decision

Keep the JavaScript resolver as an interim harness because it proves the browser dependency pipeline end-to-end. Do not expand it into a full Pub clone unless the Dart-compiled solver spike fails.

Next spike:

```sh
npm run probe:pub-solver-reuse
npm run probe:pub-solver-js
```

The JS spike lives in `experiments/pub_solver_js`.

Current result:

- `dart pub get` works against the sibling `dart-lang/pub` checkout as a path dependency.
- A minimal wrapper importing `package:pub/src/solver.dart` compiles to JavaScript.
- A wrapper that calls `resolveVersions(...)` for a no-dependency root package also compiles to JavaScript.
- The same wrapper completes on the Dart VM for a no-dependency root package.
- In the browser-compiled probe, the wrapper reaches `resolve-start` but does not complete through the direct `SystemCache`/`resolveVersions` path.

Interpretation: reuse is still promising, but the browser module should not call the stock `SystemCache` path directly. The next implementation step is a browser-safe Dart adapter around package listing/cache behavior, or a small fork layer that reuses Pubgrub solver internals while replacing `SystemCache`, hosted prefetching, and filesystem-oriented source/cache behavior.
