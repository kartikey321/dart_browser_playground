#!/usr/bin/env node
import { HostedPubPackageSource } from '../web/lib/hosted_pub_source.js';

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

console.log(
  JSON.stringify(
    {
      ok: true,
      origin,
      packageName: metadata.name,
      latestVersion: metadata.latest.version,
      versionCount: metadata.versions.length,
      archiveUrl: metadata.latest.archiveUrl,
      archiveSha256: metadata.latest.archiveSha256,
      metadataCors: metadata.corsHeader,
      archiveCors: archive.corsHeader,
      archiveContentLength: archive.contentLength,
      latestDependencies: metadata.latest.dependencies,
      latestEnvironment: metadata.latest.environment,
    },
    null,
    2,
  ),
);
