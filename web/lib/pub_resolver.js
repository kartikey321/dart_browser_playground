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
  const metadataCache = new Map();

  for (const [packageName, constraint] of Object.entries(rootDependencies || {})) {
    addConstraint(constraints, packageName, constraint || 'any');
  }

  const resolved = await resolveState({
    constraints,
    selected: new Map(),
    metadataCache,
    source,
    maxPackages,
    includePrerelease,
  });

  return {
    packages: [...resolved.selected.values()].sort((a, b) => a.packageName.localeCompare(b.packageName)),
    constraints: Object.fromEntries([...resolved.constraints.entries()].map(([name, values]) => [name, values])),
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

async function resolveState({
  constraints,
  selected,
  metadataCache,
  source,
  maxPackages,
  includePrerelease,
}) {
  if (selected.size > maxPackages || constraints.size > maxPackages) {
    throw new Error(`Dependency resolution exceeded ${maxPackages} packages.`);
  }

  const packageName = nextPackageToResolve(constraints, selected);
  if (!packageName) return { constraints, selected };

  const packageConstraints = constraints.get(packageName) || ['any'];
  const metadata = await cachedMetadata(metadataCache, source, packageName);
  const candidates = candidateVersions(metadata.versions, packageConstraints, { includePrerelease });

  for (const candidate of candidates) {
    const branchConstraints = cloneConstraints(constraints);
    const branchSelected = new Map(selected);
    branchSelected.set(packageName, packageSelection(packageName, candidate));

    addDependencyConstraints(branchConstraints, packageName, candidate.dependencies || {});

    try {
      return await resolveState({
        constraints: branchConstraints,
        selected: branchSelected,
        metadataCache,
        source,
        maxPackages,
        includePrerelease,
      });
    } catch (error) {
      if (!isResolutionFailure(error)) throw error;
    }
  }

  throw new Error(`No version satisfies constraints for ${packageName}: ${packageConstraints.join(', ')}`);
}

function nextPackageToResolve(constraints, selected) {
  const names = [...constraints.keys()].sort();
  for (const packageName of names) {
    const current = selected.get(packageName);
    const packageConstraints = constraints.get(packageName) || ['any'];
    if (!current || !allowsAllConstraints(packageConstraints, current.version)) return packageName;
  }
  return null;
}

function candidateVersions(versions, constraints = ['any'], { includePrerelease = false } = {}) {
  return versions
    .filter((version) => includePrerelease || parseVersion(version.version).preRelease.length === 0)
    .filter((version) => !version.retracted)
    .filter((version) => allowsAllConstraints(constraints, version.version))
    .sort((a, b) => compareVersions(b.version, a.version));
}

function packageSelection(packageName, version) {
  return {
    packageName,
    version: version.version,
    archiveUrl: version.archiveUrl,
    archiveSha256: version.archiveSha256,
    dependencies: version.dependencies,
    environment: version.environment,
  };
}

function addDependencyConstraints(constraints, packageName, dependencies) {
  for (const [dependencyName, dependencyConstraint] of Object.entries(dependencies)) {
    if (dependencyName === 'flutter') continue;
    if (typeof dependencyConstraint !== 'string') {
      throw new Error(`Unsupported dependency syntax for ${packageName} -> ${dependencyName}.`);
    }
    addConstraint(constraints, dependencyName, dependencyConstraint || 'any');
  }
}

function addConstraint(constraints, packageName, constraint) {
  if (!constraints.has(packageName)) constraints.set(packageName, []);
  const values = constraints.get(packageName);
  if (!values.includes(constraint)) values.push(constraint);
}

async function cachedMetadata(cache, source, packageName) {
  if (!cache.has(packageName)) {
    cache.set(packageName, await source.fetchPackage(packageName));
  }
  return cache.get(packageName);
}

function cloneConstraints(constraints) {
  return new Map([...constraints.entries()].map(([name, values]) => [name, [...values]]));
}

function isResolutionFailure(error) {
  return String((error && error.message) || error).includes('No version satisfies constraints');
}
