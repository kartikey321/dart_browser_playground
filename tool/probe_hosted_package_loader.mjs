#!/usr/bin/env node
import { gzipSync } from 'node:zlib';
import {
  loadHostedPackageSources,
  packageConfigEntry,
} from '../web/lib/hosted_package_loader.js';
import { sha256Hex } from '../web/lib/package_archive.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function writeAscii(bytes, offset, length, value) {
  const encoded = new TextEncoder().encode(value);
  bytes.set(encoded.subarray(0, length), offset);
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

function tarFile(path, text) {
  const data = new TextEncoder().encode(text);
  const padded = new Uint8Array(Math.ceil(data.length / 512) * 512);
  padded.set(data);
  return [tarHeader(path, data.length), padded];
}

function makeTarGz(packageName) {
  return gzipSync(new Uint8Array([
    ...tarFile('pubspec.yaml', `name: ${packageName}\n`).flatMap((part) => [...part]),
    ...tarFile(`lib/${packageName}.dart`, `String ${packageName}() => "${packageName}";\n`).flatMap((part) => [...part]),
    ...new Uint8Array(1024),
  ]));
}

const archive = makeTarGz('demo');
const archiveSha256 = await sha256Hex(archive);
const source = {
  async fetchArchive() {
    return {
      corsAllowed: true,
      corsHeader: '*',
      buffer: archive,
    };
  },
};

const loaded = await loadHostedPackageSources({
  packages: [{
    packageName: 'demo',
    version: '1.0.0',
    archiveUrl: 'https://pub.dev/api/archives/demo-1.0.0.tar.gz',
    archiveSha256,
    environment: { sdk: '^3.4.0' },
  }],
}, source);

assert(
  loaded.text['memory:/packages/demo/lib/demo.dart'].includes('String demo()'),
  'Expected loaded virtual Dart source.',
);
assert(loaded.packageConfigEntries[0].name === 'demo', 'Expected package config entry.');
assert(loaded.packageConfigEntries[0].languageVersion === '3.4', 'Expected language version from SDK constraint.');
assert(packageConfigEntry('demo').rootUri === 'memory:/packages/demo/', 'Expected default package root URI.');
assert(loaded.loaded[0].sha256Verified === true, 'Expected archive verification.');

console.log(
  JSON.stringify(
    {
      ok: true,
      loaded: loaded.loaded,
      packageConfigEntries: loaded.packageConfigEntries,
      textKeys: Object.keys(loaded.text).sort(),
    },
    null,
    2,
  ),
);
