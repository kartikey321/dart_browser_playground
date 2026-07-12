#!/usr/bin/env node
const origin = process.env.ORIGIN || 'http://localhost:8766';
const packageName = process.env.PACKAGE || 'http';
const metadataUrl = `https://pub.dev/api/packages/${packageName}`;

async function fetchWithOrigin(url, init = {}) {
  return fetch(url, {
    ...init,
    headers: {
      Origin: origin,
      Accept: init.method === 'HEAD' ? 'application/octet-stream' : 'application/vnd.pub.v2+json',
      ...(init.headers ?? {}),
    },
    redirect: 'follow',
  });
}

function corsAllowed(response) {
  const value = response.headers.get('access-control-allow-origin');
  return value === '*' || value === origin;
}

const metadataResponse = await fetchWithOrigin(metadataUrl);
if (!metadataResponse.ok) {
  throw new Error(`Metadata request failed: ${metadataResponse.status} ${metadataResponse.statusText}`);
}
if (!corsAllowed(metadataResponse)) {
  throw new Error(`Metadata request is not browser-CORS accessible: ${metadataResponse.headers.get('access-control-allow-origin')}`);
}

const metadata = await metadataResponse.json();
const archiveUrl = metadata.latest?.archive_url;
if (!archiveUrl) {
  throw new Error(`No latest.archive_url found for ${packageName}.`);
}

const archiveResponse = await fetchWithOrigin(archiveUrl, { method: 'HEAD' });
if (!archiveResponse.ok) {
  throw new Error(`Archive HEAD failed: ${archiveResponse.status} ${archiveResponse.statusText}`);
}
if (!corsAllowed(archiveResponse)) {
  throw new Error(`Archive request is not browser-CORS accessible: ${archiveResponse.headers.get('access-control-allow-origin')}`);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      origin,
      packageName: metadata.name,
      latestVersion: metadata.latest.version,
      versionCount: metadata.versions.length,
      archiveUrl,
      archiveSha256: metadata.latest.archive_sha256 ?? null,
      metadataCors: metadataResponse.headers.get('access-control-allow-origin'),
      archiveCors: archiveResponse.headers.get('access-control-allow-origin'),
      archiveContentLength: archiveResponse.headers.get('content-length'),
      latestDependencies: metadata.latest.pubspec?.dependencies ?? {},
      latestEnvironment: metadata.latest.pubspec?.environment ?? {},
    },
    null,
    2,
  ),
);
