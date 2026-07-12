const textDecoder = new TextDecoder();

export async function decompressGzip(buffer) {
  if (typeof DecompressionStream !== 'function') {
    throw new Error('Gzip decompression requires DecompressionStream in this environment.');
  }
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export function parseTar(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const files = new Map();

  for (let offset = 0; offset + 512 <= bytes.length;) {
    const header = bytes.subarray(offset, offset + 512);
    if (isZeroBlock(header)) break;

    const name = readNullTerminated(header, 0, 100);
    const prefix = readNullTerminated(header, 345, 155);
    const path = normalizeTarPath(prefix ? `${prefix}/${name}` : name);
    const size = readOctal(header, 124, 12);
    const typeflag = String.fromCharCode(header[156] || 0);
    const dataStart = offset + 512;
    const dataEnd = dataStart + size;

    if (dataEnd > bytes.length) {
      throw new Error(`Invalid tar archive: ${path} extends past end of archive.`);
    }

    if (path && (typeflag === '\0' || typeflag === '0')) {
      files.set(path, bytes.slice(dataStart, dataEnd));
    }

    offset = dataStart + roundUpToBlock(size);
  }

  return files;
}

export async function parseTarGz(buffer) {
  return parseTar(await decompressGzip(buffer));
}

export async function sha256Hex(buffer) {
  if (!globalThis.crypto?.subtle?.digest) {
    throw new Error('SHA-256 verification requires WebCrypto crypto.subtle.digest.');
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);
  return bytesToHex(new Uint8Array(digest));
}

export async function verifySha256(buffer, expectedHex) {
  if (!expectedHex) return { ok: true, actualHex: null, expectedHex: null };
  const normalizedExpected = String(expectedHex).toLowerCase();
  const actualHex = await sha256Hex(buffer);
  return {
    ok: actualHex === normalizedExpected,
    actualHex,
    expectedHex: normalizedExpected,
  };
}

export function tarFileText(files, path) {
  const bytes = files.get(path);
  return bytes ? textDecoder.decode(bytes) : null;
}

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function isZeroBlock(block) {
  for (const byte of block) {
    if (byte !== 0) return false;
  }
  return true;
}

function readNullTerminated(bytes, offset, length) {
  const end = offset + length;
  let cursor = offset;
  while (cursor < end && bytes[cursor] !== 0) cursor += 1;
  return textDecoder.decode(bytes.subarray(offset, cursor)).trim();
}

function readOctal(bytes, offset, length) {
  const raw = readNullTerminated(bytes, offset, length).trim();
  return raw ? Number.parseInt(raw, 8) : 0;
}

function roundUpToBlock(size) {
  return Math.ceil(size / 512) * 512;
}

function normalizeTarPath(path) {
  return path
    .replaceAll('\\', '/')
    .replace(/^\.\/+/, '')
    .replace(/\/+/g, '/');
}
