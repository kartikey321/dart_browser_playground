const PUB_API_ACCEPT = 'application/vnd.pub.v2+json';

export class HostedPubPackageSource {
  constructor({
    hostedUrl = 'https://pub.dev',
    fetchImpl = globalThis.fetch?.bind(globalThis),
    origin = globalThis.location?.origin,
  } = {}) {
    if (!fetchImpl) throw new Error('HostedPubPackageSource requires a fetch implementation.');
    this.hostedUrl = normalizeHostedUrl(hostedUrl);
    this.fetchImpl = fetchImpl;
    this.origin = origin;
  }

  packageMetadataUrl(packageName) {
    assertPackageName(packageName);
    return `${this.hostedUrl}/api/packages/${packageName}`;
  }

  async fetchPackage(packageName) {
    const response = await this.fetchImpl(this.packageMetadataUrl(packageName), {
      headers: this.origin ? {
        Accept: PUB_API_ACCEPT,
        Origin: this.origin,
      } : {
        Accept: PUB_API_ACCEPT,
      },
      redirect: 'follow',
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${packageName} metadata: ${response.status} ${response.statusText}`);
    }
    const metadata = await response.json();
    return normalizePackageMetadata(metadata, response, this.origin);
  }

  async checkArchive(archiveUrl) {
    const response = await this.fetchImpl(archiveUrl, {
      method: 'HEAD',
      headers: this.origin ? { Origin: this.origin } : {},
      redirect: 'follow',
    });
    if (!response.ok) {
      throw new Error(`Failed to check archive: ${response.status} ${response.statusText}`);
    }
    return {
      url: response.url || archiveUrl,
      corsAllowed: corsAllowed(response, this.origin),
      corsHeader: response.headers.get('access-control-allow-origin'),
      contentLength: response.headers.get('content-length'),
      etag: response.headers.get('etag'),
      sha256: response.headers.get('x-goog-hash'),
    };
  }
}

export function normalizeHostedUrl(hostedUrl) {
  const normalized = String(hostedUrl || '').replace(/\/+$/, '');
  const url = new URL(normalized);
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(`Invalid hosted pub URL: ${hostedUrl}`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`Hosted pub URL must be http or https: ${hostedUrl}`);
  }
  return url.toString().replace(/\/+$/, '');
}

export function assertPackageName(packageName) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(packageName)) {
    throw new Error(`Invalid package name: ${packageName}`);
  }
}

export function corsAllowed(response, origin) {
  const value = response.headers.get('access-control-allow-origin');
  return value === '*' || Boolean(origin && value === origin);
}

export function normalizePackageMetadata(metadata, response = null, origin = null) {
  if (!metadata || typeof metadata !== 'object') {
    throw new Error('Invalid package metadata: expected object.');
  }
  assertPackageName(metadata.name);
  if (!metadata.latest?.version || !metadata.latest?.archive_url) {
    throw new Error(`Invalid package metadata for ${metadata.name}: missing latest version/archive.`);
  }
  if (!Array.isArray(metadata.versions)) {
    throw new Error(`Invalid package metadata for ${metadata.name}: missing versions.`);
  }

  return {
    name: metadata.name,
    latest: normalizePackageVersion(metadata.latest),
    versions: metadata.versions.map(normalizePackageVersion),
    corsAllowed: response ? corsAllowed(response, origin) : null,
    corsHeader: response?.headers?.get('access-control-allow-origin') ?? null,
    cacheControl: response?.headers?.get('cache-control') ?? null,
    etag: response?.headers?.get('etag') ?? null,
  };
}

export function normalizePackageVersion(version) {
  return {
    version: String(version.version),
    archiveUrl: String(version.archive_url),
    archiveSha256: version.archive_sha256 ? String(version.archive_sha256) : null,
    pubspec: version.pubspec ?? {},
    dependencies: version.pubspec?.dependencies ?? {},
    environment: version.pubspec?.environment ?? {},
    retracted: Boolean(version.retracted),
  };
}
