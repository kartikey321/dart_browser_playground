# pub solver JS spike

This experiment checks whether `dart-lang/pub` solver internals can be reused in a browser artifact.

The first probe is deliberately minimal:

```sh
dart pub get
dart compile js bin/probe_compile.dart -O2 -o build/probe_compile.js
```

If importing `package:pub/src/solver.dart` fails to compile to JavaScript, the playground cannot directly use the upstream solver entry point in the browser. The next viable path is a browser-safe Dart wrapper/fork layer that isolates Pubgrub logic from `dart:io`, `SystemCache`, filesystem cache, CLI logging, and source implementations.

Current result:

- importing `package:pub/src/solver.dart` compiles to JavaScript;
- calling `resolveVersions(...)` for a no-dependency root package also compiles;
- the naïve direct runtime wrapper does not yet produce usable JSON output, so the next step is not manual JS porting, but a browser-safe Dart adapter around package listing/cache behavior.

Run the repo-level probe:

```sh
npm run probe:pub-solver-js
```
