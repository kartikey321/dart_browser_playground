#!/usr/bin/env node
import {
  HostedPubPackageSource,
  normalizeHostedUrl,
} from '../web/lib/hosted_pub_source.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function headers(entries) {
  const values = new Map(Object.entries(entries).map(([key, value]) => [key.toLowerCase(), value]));
  return {
    get(name) {
      return values.get(String(name).toLowerCase()) ?? null;
    },
  };
}

function jsonResponse(body, headerValues = {}) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    url: 'https://pub.dev/api/packages/demo',
    headers: headers(headerValues),
    async json() {
      return body;
    },
  };
}

function headResponse(headerValues = {}) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    url: 'https://pub.dev/api/archives/demo-1.0.0.tar.gz',
    headers: headers(headerValues),
  };
}

const calls = [];
const source = new HostedPubPackageSource({
  origin: 'http://localhost:8766',
  fetchImpl: async (url, init) => {
    calls.push({ url, init });
    if (init?.method === 'HEAD') {
      return headResponse({
        'access-control-allow-origin': 'http://localhost:8766',
        'content-length': '1234',
        etag: '"archive-etag"',
      });
    }
    return jsonResponse({
      name: 'demo',
      latest: {
        version: '1.0.0',
        archive_url: 'https://pub.dev/api/archives/demo-1.0.0.tar.gz',
        archive_sha256: 'abc123',
        pubspec: {
          dependencies: { web: '^1.0.0' },
          environment: { sdk: '^3.4.0' },
        },
      },
      versions: [
        {
          version: '1.0.0',
          archive_url: 'https://pub.dev/api/archives/demo-1.0.0.tar.gz',
          archive_sha256: 'abc123',
          pubspec: {},
        },
      ],
    }, {
      'access-control-allow-origin': 'http://localhost:8766',
      'cache-control': 'public, max-age=120',
      etag: '"metadata-etag"',
    });
  },
});

assert(normalizeHostedUrl('https://pub.dev/') === 'https://pub.dev', 'Expected hosted URL normalization.');

const metadata = await source.fetchPackage('demo');
assert(metadata.name === 'demo', 'Expected normalized package name.');
assert(metadata.latest.version === '1.0.0', 'Expected latest version.');
assert(metadata.latest.archiveUrl.endsWith('demo-1.0.0.tar.gz'), 'Expected archive URL normalization.');
assert(metadata.latest.dependencies.web === '^1.0.0', 'Expected latest dependencies.');
assert(metadata.corsAllowed === true, 'Expected origin-specific metadata CORS to be accepted.');
assert(calls[0].init.headers.Accept === 'application/vnd.pub.v2+json', 'Expected pub API accept header.');
assert(!('Origin' in calls[0].init.headers), 'Expected browser-forbidden Origin header not to be set manually.');

const archive = await source.checkArchive(metadata.latest.archiveUrl);
assert(archive.corsAllowed === true, 'Expected origin-specific archive CORS to be accepted.');
assert(archive.contentLength === '1234', 'Expected archive content length.');
assert(!calls[1].init.headers, 'Expected archive HEAD request not to set browser-forbidden Origin header manually.');

console.log(
  JSON.stringify(
    {
      ok: true,
      metadataUrl: calls[0].url,
      archiveUrl: calls[1].url,
      latestVersion: metadata.latest.version,
      dependencyCount: Object.keys(metadata.latest.dependencies).length,
      archiveContentLength: archive.contentLength,
    },
    null,
    2,
  ),
);
