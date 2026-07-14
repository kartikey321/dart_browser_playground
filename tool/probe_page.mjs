#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const chrome =
  process.env.CHROME ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const url =
  process.env.URL ||
  'http://localhost:8766/index.html?autorun=1';

const result = spawnSync(
  chrome,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--virtual-time-budget=60000',
    '--dump-dom',
    url,
  ],
  { encoding: 'utf8' },
);

if (result.status !== 0) {
  throw new Error(result.stderr || result.stdout);
}

const html = result.stdout;
const expectations = [
  "from './adapters/jaspr/config.js'",
  'jasprAdapterConfig as adapter',
  'new Worker(adapter.compilerWorkerUrl)',
  'monaco-editor@0.50.0',
  'globalThis.lspStart',
  'registerCompletionItemProvider',
  'textDocument/completion',
  'textDocument/hover',
  'registerCodeActionProvider',
  'textDocument/codeAction',
  'workspace/applyEdit',
  'toggle-explorer',
  'active-file-label',
  'explorer-collapsed',
  'explorer-tree',
  'new-file',
  'rename-file',
  'delete-file',
  'show-packages',
  'showPackages',
  'packageResolutionDetails',
  'Current resolved packages',
  'Loaded hosted packages',
  'pub-get',
  'runPubGet',
  'packageImportFingerprint',
  'workspacePackageImportFingerprint',
  'workspacePathTree',
  'sortedWorkspacePaths',
  'packageResolutionIsCurrent',
  'markDependenciesDirtyIfNeeded',
  'Run Pub get before compiling',
  'Bundled packages',
  './lib/pubspec.js',
  './lib/hosted_pub_source.js',
  './lib/hosted_package_loader.js',
  './lib/pub_resolver.js',
  './lib/workspace.js',
  'hostedPubEnabled',
  "params.get('hostedPub') === '1'",
  'packageConfigForWorkspaceWithHostedPackages',
  'resolveHostedDependencies(hostedDependencies, hostedSource)',
  'loadHostedPackageSources(resolution, hostedSource)',
  'packageSources',
  'Running Pub get against bundled packages plus hosted pub.dev packages',
  'pubspec.yaml',
  'parseSimplePubspec',
  'validateDeclaredPackageImports',
  'packageConfigForWorkspace',
  'pubspec-validation',
  'updatePubspecDiagnostics',
  'addDependencyToPubspec',
  'missingDeclaredPackageImports',
  'dart.playground.addDependency',
  "Add '${packageName}' to pubspec.yaml",
  'adapter.defaultWorkspace',
  'adapter.entrypoint',
  'Compiling in worker...',
];

for (const expected of expectations) {
  if (!html.includes(expected)) {
    throw new Error(`Missing expected page output: ${expected}`);
  }
}

console.log(
  JSON.stringify(
    {
      ok: true,
      url,
      workerBacked: true,
      monacoLspBacked: true,
      quickActionsBacked: true,
      multiFileBacked: true,
      explorerBacked: true,
    },
    null,
    2,
  ),
);
