# Architecture

This repo separates the generic browser-playground shell from a concrete Dart/Jaspr adapter.

## Generic shell

The shell owns:

- workspace file map
- Monaco models
- `pubspec.yaml` parsing and bundled-package validation
- Dart LSP bridge, including completions, hover, diagnostics, and code actions
- active file label and collapsible file explorer drawer
- file create, rename, and delete operations
- editor/preview layout
- worker compile request protocol
- preview iframe message protocol

## Adapter

An adapter owns:

- default workspace files
- compiler worker implementation
- package/toolchain assets
- preview boot logic

The current adapter is `web/adapters/jaspr/`.

## Current compile request shape

```js
{
  entrypoint: '/lib/main.dart',
  packageConfig: '{ "configVersion": 2, "packages": [...] }',
  files: {
    '/pubspec.yaml': '...',
    '/lib/main.dart': '...',
    '/lib/components/counter.dart': '...'
  }
}
```

The Jaspr adapter maps this to memory URIs:

```text
memory:/workspace/lib/main.dart
memory:/workspace/lib/components/counter.dart
memory:/workspace/.dart_tool/package_config.json
```

## Dependency model

The shell exposes dependencies through an editable `/pubspec.yaml`. For now the shell parses only the direct `dependencies:` section, validates that requested packages exist in the bundled toolchain package config, validates that direct Dart `package:` imports are declared, and sends a generated in-memory `package_config.json` to the compiler worker.

This is not a full `pub get` implementation yet. Real browser-side dependency support still needs a package metadata source, version solver, archive fetch/unpack flow, cache model, transitive graph handling, and lockfile/package-config generation.
