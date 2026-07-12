#!/usr/bin/env node
import { HostedPubPackageSource } from '../web/lib/hosted_pub_source.js';
import {
  packageArchiveToMemoryText,
  parseTarGz,
  tarFileText,
  verifySha256,
} from '../web/lib/package_archive.js';
import { resolveHostedDependencies } from '../web/lib/pub_resolver.js';
import { bestVersion } from '../web/lib/pub_version.js';

const origin = process.env.ORIGIN || 'http://localhost:8766';
const packageName = process.env.PACKAGE || 'http';
const source = new HostedPubPackageSource({ origin });
const metadata = await source.fetchPackage(packageName);
if (!metadata.corsAllowed) {
  throw new Error(`Metadata request is not browser-CORS accessible: ${metadata.corsHeader}`);
}

const archive = await source.checkArchive(metadata.latest.archiveUrl);
if (!archive.corsAllowed) {
  throw new Error(`Archive request is not browser-CORS accessible: ${archive.corsHeader}`);
}
const archiveResponse = await fetch(metadata.latest.archiveUrl, {
  headers: { Origin: origin },
  redirect: 'follow',
});
if (!archiveResponse.ok) {
  throw new Error(`Archive download failed: ${archiveResponse.status} ${archiveResponse.statusText}`);
}
const archiveBuffer = await archiveResponse.arrayBuffer();
const archiveVerification = await verifySha256(archiveBuffer, metadata.latest.archiveSha256);
if (!archiveVerification.ok) {
  throw new Error(`Archive SHA-256 mismatch: expected ${archiveVerification.expectedHex}, got ${archiveVerification.actualHex}`);
}
const archiveFiles = await parseTarGz(archiveBuffer);
const pubspecPath = [...archiveFiles.keys()].find((path) => path === 'pubspec.yaml' || path.endsWith('/pubspec.yaml'));
if (!pubspecPath) {
  throw new Error('Downloaded archive does not contain pubspec.yaml.');
}
const libFileCount = [...archiveFiles.keys()].filter((path) => path.startsWith('lib/') && path.endsWith('.dart')).length;
const packageText = packageArchiveToMemoryText(metadata.name, archiveFiles);
const packageMainLibrary = `memory:/packages/${metadata.name}/lib/${metadata.name}.dart`;
const constraint = process.env.CONSTRAINT || '^1.0.0';
const bestCompatibleVersion = bestVersion(metadata.versions, constraint);
const resolved = await resolveHostedDependencies({ [metadata.name]: constraint }, source);

console.log(
  JSON.stringify(
    {
      ok: true,
      origin,
      packageName: metadata.name,
      latestVersion: metadata.latest.version,
      versionCount: metadata.versions.length,
      constraint,
      bestCompatibleVersion,
      resolvedPackageCount: resolved.packages.length,
      resolvedPackages: Object.fromEntries(resolved.packages.map((pkg) => [pkg.packageName, pkg.version])),
      archiveUrl: metadata.latest.archiveUrl,
      archiveSha256: metadata.latest.archiveSha256,
      archiveSha256Verified: archiveVerification.ok,
      metadataCors: metadata.corsHeader,
      archiveCors: archive.corsHeader,
      archiveContentLength: archive.contentLength,
      archiveFileCount: archiveFiles.size,
      archivePubspecPath: pubspecPath,
      archivePubspecHasName: tarFileText(archiveFiles, pubspecPath)?.includes(`name: ${metadata.name}`) ?? false,
      archiveLibFileCount: libFileCount,
      memoryTextFileCount: packageText.fileCount,
      memoryTextRootPrefix: packageText.rootPrefix,
      memoryTextHasMainLibrary: Boolean(packageText.text[packageMainLibrary]),
      latestDependencies: metadata.latest.dependencies,
      latestEnvironment: metadata.latest.environment,
    },
    null,
    2,
  ),
);
