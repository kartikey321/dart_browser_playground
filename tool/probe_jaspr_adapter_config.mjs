#!/usr/bin/env node
import { jasprAdapterConfig } from '../web/adapters/jaspr/config.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(jasprAdapterConfig.entrypoint === '/lib/main.dart', 'Expected Jaspr entrypoint.');
assert(jasprAdapterConfig.compilerWorkerUrl === 'adapters/jaspr/compiler_worker.js', 'Expected compiler worker URL.');
assert(jasprAdapterConfig.previewUrl === 'adapters/jaspr/preview.html', 'Expected preview URL.');
assert(jasprAdapterConfig.toolchainRoot === './toolchain', 'Expected toolchain root.');
assert(jasprAdapterConfig.lspPackageBundle.endsWith('/jaspr_dart_packages.bin'), 'Expected LSP package bundle.');
assert(jasprAdapterConfig.newFileTemplate.includes("package:jaspr/dom.dart"), 'Expected Jaspr new-file template.');
assert(typeof jasprAdapterConfig.defaultWorkspace['/pubspec.yaml'] === 'string', 'Expected default pubspec.');
assert(typeof jasprAdapterConfig.defaultWorkspace[jasprAdapterConfig.entrypoint] === 'string', 'Expected default entrypoint source.');
assert(
  jasprAdapterConfig.defaultWorkspace['/lib/components/counter.dart'].includes('StatefulComponent'),
  'Expected default component source.',
);
assert(jasprAdapterConfig.legacySample.includes('Compiled locally in the browser with DDC.'), 'Expected legacy sample.');

console.log(
  JSON.stringify(
    {
      ok: true,
      title: jasprAdapterConfig.title,
      entrypoint: jasprAdapterConfig.entrypoint,
      defaultFiles: Object.keys(jasprAdapterConfig.defaultWorkspace).sort(),
      compilerWorkerUrl: jasprAdapterConfig.compilerWorkerUrl,
      previewUrl: jasprAdapterConfig.previewUrl,
    },
    null,
    2,
  ),
);
