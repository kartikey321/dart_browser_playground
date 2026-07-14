import {
  packageArchiveToMemoryText,
  parseTarGz,
  verifySha256,
} from './package_archive.js';

export async function loadHostedPackageSources(resolution, source, {
  packageRootUri = 'memory:/packages',
  languageVersion = '3.4',
} = {}) {
  const text = {};
  const packages = [];
  const loaded = [];

  for (const resolvedPackage of resolution.packages || []) {
    const archive = await source.fetchArchive(resolvedPackage.archiveUrl);
    if (!archive.corsAllowed) {
      throw new Error(`Archive for ${resolvedPackage.packageName} is not browser-CORS accessible: ${archive.corsHeader}`);
    }

    const verification = await verifySha256(archive.buffer, resolvedPackage.archiveSha256);
    if (!verification.ok) {
      throw new Error(`Archive SHA-256 mismatch for ${resolvedPackage.packageName}: expected ${verification.expectedHex}, got ${verification.actualHex}`);
    }

    const files = await parseTarGz(archive.buffer);
    const mapped = packageArchiveToMemoryText(resolvedPackage.packageName, files, { packageRootUri });
    Object.assign(text, mapped.text);

    packages.push(packageConfigEntry(resolvedPackage.packageName, {
      packageRootUri,
      languageVersion: languageVersionFor(resolvedPackage, languageVersion),
    }));
    loaded.push({
      packageName: resolvedPackage.packageName,
      version: resolvedPackage.version,
      fileCount: mapped.fileCount,
      archiveUrl: resolvedPackage.archiveUrl,
      rootPrefix: mapped.rootPrefix,
      sha256Verified: verification.ok,
    });
  }

  return {
    text,
    packageConfigEntries: packages.sort((a, b) => a.name.localeCompare(b.name)),
    loaded: loaded.sort((a, b) => a.packageName.localeCompare(b.packageName)),
  };
}

export function packageConfigEntry(packageName, {
  packageRootUri = 'memory:/packages',
  languageVersion = '3.4',
} = {}) {
  return {
    name: packageName,
    rootUri: `${packageRootUri}/${packageName}/`,
    packageUri: 'lib/',
    languageVersion,
  };
}

function languageVersionFor(resolvedPackage, fallback) {
  const sdkConstraint = resolvedPackage.environment?.sdk;
  const match = typeof sdkConstraint === 'string'
    ? sdkConstraint.match(/(\d+\.\d+)/)
    : null;
  return match?.[1] ?? fallback;
}
