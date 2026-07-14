import {
  bundledPackageNames,
  parseSimplePubspec,
  validateDeclaredPackageImports,
} from './pubspec.js';
import {
  loadHostedPackageSources,
} from './hosted_package_loader.js';
import {
  resolveHostedDependencies,
} from './pub_resolver.js';

export function assertSimplePubspecDependencies(pubspec) {
  if (pubspec.unsupportedDependencyKinds.length) {
    throw new Error(`Only simple hosted dependencies are supported right now; complex dependency syntax found for: ${pubspec.unsupportedDependencyKinds.join(', ')}.`);
  }
}

export function workspacePackageConfig(baseConfig, pubspec, hostedPackageConfigEntries = []) {
  const hostedNames = new Set(hostedPackageConfigEntries.map((entry) => entry.name));
  const packages = Array.isArray(baseConfig?.packages)
    ? baseConfig.packages.filter((pkg) => !hostedNames.has(pkg.name))
    : [];
  const packageNames = new Set(packages.map((pkg) => pkg.name));

  for (const hostedEntry of hostedPackageConfigEntries) {
    packages.push(hostedEntry);
    packageNames.add(hostedEntry.name);
  }

  if (pubspec.name && /^[A-Za-z_][A-Za-z0-9_]*$/.test(pubspec.name) && !packageNames.has(pubspec.name)) {
    packages.unshift({
      name: pubspec.name,
      rootUri: 'memory:/workspace/',
      packageUri: 'lib/',
      languageVersion: '3.8',
    });
  }

  return JSON.stringify({ ...baseConfig, packages }, null, 2);
}

export async function resolveWorkspaceWithHostedPackages({
  workspace,
  baseConfig,
  hostedSource,
}) {
  const pubspec = parseSimplePubspec(workspace['/pubspec.yaml']);
  validateDeclaredPackageImports(pubspec, workspace);
  assertSimplePubspecDependencies(pubspec);

  const bundledNames = bundledPackageNames(baseConfig);
  const hostedDependencies = Object.fromEntries(
    [...pubspec.dependencies]
      .filter((name) => name !== 'flutter' && !bundledNames.has(name))
      .map((name) => [name, pubspec.dependencyConstraints[name] || 'any']),
  );

  if (!Object.keys(hostedDependencies).length) {
    return {
      packageConfig: workspacePackageConfig(baseConfig, pubspec),
      packageSources: {},
      loaded: [],
      hostedDependencies,
      resolvedPackageCount: 0,
    };
  }

  const resolution = await resolveHostedDependencies(hostedDependencies, hostedSource);
  const loaded = await loadHostedPackageSources(resolution, hostedSource);

  return {
    packageConfig: workspacePackageConfig(baseConfig, pubspec, loaded.packageConfigEntries),
    packageSources: loaded.text,
    loaded: loaded.loaded,
    hostedDependencies,
    resolvedPackageCount: resolution.packages.length,
  };
}

export function packageResolutionDetails({
  mode,
  hostedDependencies = {},
  loaded = [],
  resolvedPackageCount = 0,
} = {}) {
  return {
    mode,
    hostedDependencies,
    loaded,
    resolvedPackageCount,
  };
}

export function formatPubGetSuccess(resolution) {
  if (resolution.mode === 'bundled') {
    return 'Pub get complete. Dependencies resolved from bundled packages.';
  }

  const loadedNames = (resolution.loaded ?? []).map((pkg) => `${pkg.packageName} ${pkg.version}`);
  return [
    'Pub get complete.',
    `Hosted mode: ${resolution.resolvedPackageCount ?? 0} package(s) resolved, ${(resolution.loaded ?? []).length} package archive(s) loaded.`,
    loadedNames.length ? `Loaded hosted packages:\n${loadedNames.join('\n')}` : 'No hosted packages were needed; all dependencies came from the bundled toolchain.',
  ].join('\n');
}

export function formatPackagesReport({
  baseConfig,
  packageConfig,
  packageResolution = null,
  hostedPubEnabled = false,
}) {
  const bundledNames = [...bundledPackageNames(baseConfig)].sort();
  if (!packageConfig) {
    return [
      `Bundled packages (${bundledNames.length}):`,
      bundledNames.join(', '),
      '',
      'Run Pub get to see the current workspace package_config.',
      hostedPubEnabled ? 'Hosted mode is enabled with ?hostedPub=1.' : 'Hosted mode is disabled.',
    ].join('\n');
  }

  const currentPackages = JSON.parse(packageConfig).packages ?? [];
  const currentNames = currentPackages.map((pkg) => pkg.name).sort();
  const hostedLoaded = packageResolution?.loaded ?? [];
  const hostedLines = hostedLoaded.map((pkg) =>
    `${pkg.packageName} ${pkg.version} (${pkg.fileCount} files, ${pkg.sha256Verified ? 'sha256 verified' : 'sha256 not verified'})`);

  return [
    `Current resolved packages (${currentNames.length}):`,
    currentNames.join(', '),
    '',
    `Bundled toolchain packages (${bundledNames.length}):`,
    bundledNames.join(', '),
    '',
    hostedPubEnabled
      ? `Hosted mode: ${packageResolution?.resolvedPackageCount ?? 0} resolved, ${hostedLoaded.length} loaded archive(s).`
      : 'Hosted mode: disabled.',
    hostedLines.length ? `Loaded hosted packages:\n${hostedLines.join('\n')}` : 'Loaded hosted packages: none.',
  ].join('\n');
}
