# Dart Browser Playground

Generic browser playground shell for Dart-based in-browser experiments.

Current included adapter:

- Jaspr + browser DDC compiler worker

The intended split is:

- `web/index.html` - generic shell for layout, Monaco, workspace files, LSP, pubspec validation, and preview plumbing
- `web/lib/` - browser-compatible shared shell logic
- `web/adapters/jaspr/` - Jaspr-specific compiler worker and DDC preview boot
- `web/toolchain/` - static compiler, package, SDK, and analyzer assets

Run locally:

```sh
cd web
python3 -m http.server 8766
```

Open:

```text
http://localhost:8766/index.html
```

Validate page wiring:

```sh
npm run probe
```

The current shell supports:

- Monaco editor
- Dart LSP completions, hover, and diagnostics
- Dart LSP quick actions/lightbulb fixes
- multi-file workspace
- left file explorer drawer
- collapsible file explorer drawer
- file create, rename, and delete
- editable `pubspec.yaml` with validation against bundled packages
- live `pubspec.yaml` diagnostics for unsupported or undeclared package imports
- bundled package inspection from the Packages button
- browser worker compilation
- isolated iframe preview
- resizable editor/preview panes

`pubspec.yaml` support is intentionally staged. The playground currently accepts dependencies that are already bundled into the static toolchain, requires direct `package:` imports to be declared in `dependencies:`, and shows a clear error for unsupported packages. It does not yet perform full browser-side `pub get`, version solving, archive downloading, or package cache generation.
