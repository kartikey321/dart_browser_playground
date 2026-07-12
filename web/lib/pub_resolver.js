import {
  allowsAllConstraints,
  compareVersions,
  parseVersion,
} from './pub_version.js';

export async function resolveHostedDependencies(rootDependencies, source, {
  maxPackages = 100,
  includePrerelease = false,
} = {}) {
  const constraints = new Map();
  const resolved = new Map();
  const metadataCache = new Map();
  const queue = [];

  for (const [packageName, constraint] of Object.entries(rootDependencies || {})) {
    addConstraint(constraints, queue, packageName, constraint || 'any');
  }

  while (queue.length) {
    if (resolved.size > maxPackages) {
      throw new Error(`Dependency resolution exceeded ${maxPackages} packages.`);
    }

    const packageName = queue.shift();
    const metadata = await cachedMetadata(metadataCache, source, packageName);
    const selected = selectBestVersion(metadata.versions, constraints.get(packageName), { includePrerelease });
    const previous = resolved.get(packageName);
    if (previous?.version === selected.version) continue;

    resolved.set(packageName, {
      packageName,
      version: selected.version,
      archiveUrl: selected.archiveUrl,
      archiveSha256: selected.archiveSha256,
      dependencies: selected.dependencies,
      environment: selected.environment,
    });

    for (const [dependencyName, dependencyConstraint] of Object.entries(selected.dependencies || {})) {
      if (dependencyName === 'flutter') continue;
      if (typeof dependencyConstraint !== 'string') {
        throw new Error(`Unsupported dependency syntax for ${packageName} -> ${dependencyName}.`);
      }
      addConstraint(constraints, queue, dependencyName, dependencyConstraint || 'any');
    }
  }

  return {
    packages: [...resolved.values()].sort((a, b) => a.packageName.localeCompare(b.packageName)),
    constraints: Object.fromEntries([...constraints.entries()].map(([name, values]) => [name, values])),
  };
}

export function selectBestVersion(versions, constraints = ['any'], { includePrerelease = false } = {}) {
  const selected = versions
    .filter((version) => includePrerelease || parseVersion(version.version).preRelease.length === 0)
    .filter((version) => !version.retracted)
    .filter((version) => allowsAllConstraints(constraints, version.version))
    .sort((a, b) => compareVersions(a.version, b.version))
    .at(-1);
  if (!selected) {
    throw new Error(`No version satisfies constraints: ${constraints.join(', ')}`);
  }
  return selected;
}

function addConstraint(constraints, queue, packageName, constraint) {
  if (!constraints.has(packageName)) constraints.set(packageName, []);
  const values = constraints.get(packageName);
  if (!values.includes(constraint)) values.push(constraint);
  if (!queue.includes(packageName)) queue.push(packageName);
}

async function cachedMetadata(cache, source, packageName) {
  if (!cache.has(packageName)) {
    cache.set(packageName, await source.fetchPackage(packageName));
  }
  return cache.get(packageName);
}
