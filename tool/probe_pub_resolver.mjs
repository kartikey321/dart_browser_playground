#!/usr/bin/env node
import {
  resolveHostedDependencies,
  selectBestVersion,
} from '../web/lib/pub_resolver.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertThrowsAsync(fn, expectedText) {
  return fn().then(
    () => {
      throw new Error(`Expected function to throw "${expectedText}"`);
    },
    (error) => {
      const message = String((error && error.message) || error);
      assert(message.includes(expectedText), `Expected "${expectedText}", got "${message}"`);
    },
  );
}

const packages = {
  app_dep: [
    version('1.0.0', { shared: '^1.0.0' }),
    version('1.1.0', { shared: '^1.1.0' }),
    version('2.0.0', { shared: '^2.0.0' }),
  ],
  other_dep: [
    version('1.0.0', { shared: '<2.0.0' }),
  ],
  shared: [
    version('1.0.0'),
    version('1.2.0'),
    version('2.0.0'),
  ],
};

const source = {
  async fetchPackage(packageName) {
    const versions = packages[packageName];
    if (!versions) throw new Error(`Unknown package ${packageName}`);
    return {
      name: packageName,
      latest: versions.at(-1),
      versions,
    };
  },
};

const backtrackingPackages = {
  foo: [
    version('1.0.0'),
    version('2.0.0'),
  ],
  bar: [
    version('1.0.0'),
    version('2.0.0', { baz: '1.0.0' }),
  ],
  baz: [
    version('1.0.0', { foo: '2.0.0' }),
  ],
};

const backtrackingSource = {
  async fetchPackage(packageName) {
    const versions = backtrackingPackages[packageName];
    if (!versions) throw new Error(`Unknown package ${packageName}`);
    return {
      name: packageName,
      latest: versions.at(-1),
      versions,
    };
  },
};

assert(
  selectBestVersion(packages.app_dep, ['^1.0.0']).version === '1.1.0',
  'Expected best direct version.',
);

const resolved = await resolveHostedDependencies({
  app_dep: '^1.0.0',
  other_dep: '^1.0.0',
}, source);

const selected = Object.fromEntries(resolved.packages.map((pkg) => [pkg.packageName, pkg.version]));
assert(selected.app_dep === '1.1.0', 'Expected app_dep 1.1.0.');
assert(selected.other_dep === '1.0.0', 'Expected other_dep 1.0.0.');
assert(selected.shared === '1.2.0', 'Expected shared constrained by both dependents.');

await assertThrowsAsync(
  () => resolveHostedDependencies({ app_dep: '^2.0.0', other_dep: '^1.0.0' }, source),
  'No version satisfies constraints',
);

const backtracked = await resolveHostedDependencies({
  foo: '1.0.0',
  bar: 'any',
}, backtrackingSource);

const backtrackedSelected = Object.fromEntries(
  backtracked.packages.map((pkg) => [pkg.packageName, pkg.version]),
);
assert(backtrackedSelected.foo === '1.0.0', 'Expected root foo 1.0.0.');
assert(backtrackedSelected.bar === '1.0.0', 'Expected resolver to backtrack to bar 1.0.0.');
assert(!backtrackedSelected.baz, 'Expected abandoned bar 2.0.0 dependency to be absent.');

console.log(
  JSON.stringify(
    {
      ok: true,
      selected,
      backtrackedSelected,
      constraints: resolved.constraints,
    },
    null,
    2,
  ),
);

function version(versionNumber, dependencies = {}) {
  return {
    version: versionNumber,
    archiveUrl: `https://pub.dev/api/archives/pkg-${versionNumber}.tar.gz`,
    archiveSha256: null,
    dependencies,
    environment: { sdk: '^3.0.0' },
    retracted: false,
  };
}
