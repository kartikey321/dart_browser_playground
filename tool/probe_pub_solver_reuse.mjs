#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pubRepo = resolve(process.env.PUB_REPO || '../pub');
const files = [
  'lib/src/solver.dart',
  'lib/src/solver/version_solver.dart',
  'lib/src/solver/package_lister.dart',
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(existsSync(pubRepo), `Missing dart-lang/pub checkout at ${pubRepo}. Set PUB_REPO=/path/to/pub.`);

const importPattern = /^import\s+['"]([^'"]+)['"]/gm;
const importsByFile = {};
const allImports = new Set();

for (const relativePath of files) {
  const absolutePath = resolve(pubRepo, relativePath);
  assert(existsSync(absolutePath), `Missing expected pub source file: ${absolutePath}`);
  const source = readFileSync(absolutePath, 'utf8');
  const imports = [...source.matchAll(importPattern)].map((match) => match[1]).sort();
  importsByFile[relativePath] = imports;
  for (const item of imports) allImports.add(item);
}

const browserAdapterDependencies = [...allImports]
  .filter((item) => item.includes('system_cache') ||
    item.includes('source/hosted') ||
    item.includes('source/root') ||
    item.includes('lock_file') ||
    item.includes('package.dart') ||
    item.includes('pubspec.dart') ||
    item.includes('sdk.dart') ||
    item.includes('log.dart') ||
    item.includes('utils.dart'))
  .sort();

assert(
  importsByFile['lib/src/solver/version_solver.dart'].includes('../system_cache.dart'),
  'Expected VersionSolver to depend on SystemCache; the wrapper spike needs a browser package-source adapter.',
);
assert(
  importsByFile['lib/src/solver/package_lister.dart'].includes('../system_cache.dart'),
  'Expected PackageLister to depend on SystemCache; the wrapper spike needs a browser package-source adapter.',
);

console.log(
  JSON.stringify(
    {
      ok: true,
      pubRepo,
      inspectedFiles: files,
      uniqueImportCount: allImports.size,
      browserAdapterDependencies,
      conclusion: [
        'The upstream Pubgrub solver is reusable in principle, but not as a direct browser import.',
        'A Dart-to-JS spike should wrap solver internals behind JSON and provide browser adapters for SystemCache/package metadata.',
      ],
    },
    null,
    2,
  ),
);
