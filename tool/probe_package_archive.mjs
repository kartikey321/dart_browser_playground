#!/usr/bin/env node
import { gzipSync } from 'node:zlib';
import {
  packageArchiveToMemoryText,
  parseTar,
  parseTarGz,
  sha256Hex,
  tarFileText,
  verifySha256,
} from '../web/lib/package_archive.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function tarHeader(path, size) {
  const header = new Uint8Array(512);
  writeAscii(header, 0, 100, path);
  writeAscii(header, 100, 8, '0000644');
  writeAscii(header, 108, 8, '0000000');
  writeAscii(header, 116, 8, '0000000');
  writeAscii(header, 124, 12, size.toString(8).padStart(11, '0'));
  writeAscii(header, 136, 12, '00000000000');
  header.fill(0x20, 148, 156);
  header[156] = '0'.charCodeAt(0);
  writeAscii(header, 257, 6, 'ustar');
  writeAscii(header, 263, 2, '00');
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  writeAscii(header, 148, 8, checksum.toString(8).padStart(6, '0'));
  header[154] = 0;
  header[155] = 0x20;
  return header;
}

function writeAscii(bytes, offset, length, value) {
  const encoded = new TextEncoder().encode(value);
  bytes.set(encoded.subarray(0, length), offset);
}

function tarFile(path, text) {
  const data = new TextEncoder().encode(text);
  const padded = new Uint8Array(Math.ceil(data.length / 512) * 512);
  padded.set(data);
  return [tarHeader(path, data.length), padded];
}

const tar = new Uint8Array([
  ...tarFile('package/pubspec.yaml', 'name: demo\nversion: 1.0.0\n').flatMap((part) => [...part]),
  ...tarFile('package/lib/demo.dart', 'String demo() => "ok";\n').flatMap((part) => [...part]),
  ...new Uint8Array(1024),
]);
const gzip = gzipSync(tar);
const gzipSha256 = await sha256Hex(gzip);
const verification = await verifySha256(gzip, gzipSha256);

const plainFiles = parseTar(tar);
const gzFiles = await parseTarGz(gzip);
const packageText = packageArchiveToMemoryText('demo', gzFiles);

assert(verification.ok, 'Expected SHA-256 verification to pass.');
assert((await verifySha256(gzip, '00')).ok === false, 'Expected SHA-256 mismatch to fail.');
assert(plainFiles.size === 2, 'Expected two files from plain tar.');
assert(gzFiles.size === 2, 'Expected two files from tar.gz.');
assert(tarFileText(gzFiles, 'package/pubspec.yaml').includes('name: demo'), 'Expected pubspec text.');
assert(tarFileText(gzFiles, 'package/lib/demo.dart').includes('demo()'), 'Expected Dart source text.');
assert(packageText.rootPrefix === 'package/', 'Expected top-level archive folder detection.');
assert(packageText.text['memory:/packages/demo/lib/demo.dart'].includes('demo()'), 'Expected memory package Dart file.');
assertThrows(
  () => packageArchiveToMemoryText('demo', new Map([['../evil.dart', new Uint8Array()]])),
  'Unsafe package archive path',
);

console.log(
  JSON.stringify(
    {
      ok: true,
      plainFiles: plainFiles.size,
      gzipBytes: gzip.length,
      gzipSha256,
      memoryFileCount: packageText.fileCount,
      memoryHasDart: Boolean(packageText.text['memory:/packages/demo/lib/demo.dart']),
      pubspec: tarFileText(gzFiles, 'package/pubspec.yaml'),
    },
    null,
    2,
  ),
);

function assertThrows(fn, expectedText) {
  try {
    fn();
  } catch (error) {
    const message = String((error && error.message) || error);
    assert(message.includes(expectedText), `Expected "${expectedText}", got "${message}"`);
    return;
  }
  throw new Error(`Expected function to throw "${expectedText}"`);
}
