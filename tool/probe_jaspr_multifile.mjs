#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildPackageConfigFromPubspec,
  parseSimplePubspec,
  validateDeclaredPackageImports,
} from '../web/lib/pubspec.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const compilerJs = resolve(root, 'web/toolchain/web_compiler/jaspr_ddc_compiler.js');

if (!existsSync(compilerJs)) {
  throw new Error(`Missing browser DDC compiler artifact: ${compilerJs}`);
}

globalThis.self = globalThis;
globalThis.jasprDdcCompilerRegister = (compile) => {
  globalThis.compileDdc = compile;
};
await import(`file://${compilerJs}`);

function readU32(bytes, offset) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    .getUint32(offset, true);
}

function parseDpkg(buffer) {
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder();
  if (bytes[0] !== 0x44 || bytes[1] !== 0x50 || bytes[2] !== 0x4b || bytes[3] !== 0x47) {
    throw new Error('Invalid package source bundle: missing DPKG header.');
  }

  let offset = 4;
  const readString = () => {
    const length = readU32(bytes, offset);
    offset += 4;
    const value = decoder.decode(bytes.subarray(offset, offset + length));
    offset += length;
    return value;
  };

  const packageCount = readU32(bytes, offset);
  offset += 4;
  const text = {};
  let fileCount = 0;

  for (let p = 0; p < packageCount; p += 1) {
    const packageName = readString();
    const files = readU32(bytes, offset);
    offset += 4;
    for (let f = 0; f < files; f += 1) {
      const path = readString();
      const length = readU32(bytes, offset);
      offset += 4;
      text[`memory:/packages/${packageName}/${path}`] =
        decoder.decode(bytes.subarray(offset, offset + length));
      offset += length;
      fileCount += 1;
    }
  }

  return { text, packageCount, fileCount };
}

const packages = parseDpkg(
  readFileSync(resolve(root, 'web/toolchain/jaspr_web_sources.bin')),
);

const pubspecSource = `name: jaspr_browser_playground
dependencies:
  jaspr: any
`;
const workspace = {
  '/pubspec.yaml': pubspecSource,
  '/lib/main.dart': `import 'package:jaspr/client.dart';
import 'package:jaspr_browser_playground/components/counter.dart';

void main() {
  Jaspr.initializeApp();
  runApp(const PlaygroundApp(), attachTo: '#app');
}
`,
  '/lib/components/counter.dart': `import 'package:jaspr/client.dart';
import 'package:jaspr/dom.dart';

class PlaygroundApp extends StatefulComponent {
  const PlaygroundApp({super.key});

  @override
  State<PlaygroundApp> createState() => PlaygroundAppState();
}

class PlaygroundAppState extends State<PlaygroundApp> {
  var count = 0;

  @override
  Component build(BuildContext context) {
    return div(classes: 'app', [
      h1([text('Jaspr browser playground')]),
      p([text('Compiled from multiple files in the browser with DDC.')]),
      button(
        events: {
          'click': (event) {
            setState(() {
              count += 1;
            });
          },
        },
        [text('Clicked $count times')],
      ),
    ]);
  }
}
`,
};
const pubspec = parseSimplePubspec(pubspecSource);
validateDeclaredPackageImports(pubspec, workspace);
const packageConfig = buildPackageConfigFromPubspec(
  JSON.parse(readFileSync(resolve(root, 'web/toolchain/web_compiler/package_config.json'), 'utf8')),
  pubspec,
);

const text = {
  ...packages.text,
  ...Object.fromEntries(
    Object.entries(workspace).map(([path, source]) => [`memory:/workspace${path}`, source]),
  ),
  'memory:/sdk/libraries.json': readFileSync(
    resolve(root, 'web/toolchain/web_compiler/libraries.json'),
    'utf8',
  ),
  'memory:/workspace/.dart_tool/package_config.json': packageConfig,
};

const started = Date.now();
const raw = await globalThis.compileDdc(
  JSON.stringify({
    entrypoint: 'memory:/workspace/lib/main.dart',
    moduleName: 'main',
    dartSdkSummary: 'memory:/sdk/ddc_outline.dill',
    libraries: 'memory:/sdk/libraries.json',
    packageConfig: 'memory:/workspace/.dart_tool/package_config.json',
    text,
    binaryBase64: {
      'memory:/sdk/ddc_outline.dill': readFileSync(
        resolve(root, 'web/toolchain/web_compiler/ddc_outline.dill'),
      ).toString('base64'),
    },
  }),
);
const compiled = JSON.parse(String(raw));

if (!compiled.success) {
  throw new Error(JSON.stringify(compiled, null, 2));
}

console.log(
  JSON.stringify(
    {
      ok: true,
      packageFiles: packages.fileCount,
      compileMs: Date.now() - started,
      jsBytes: compiled.javascript.length,
      moduleName: compiled.moduleName,
      libraryName: compiled.libraryName,
      localPackageImportBacked: packageConfig.includes('"name": "jaspr_browser_playground"'),
      hasMultiFileText: compiled.javascript.includes(
        'Compiled from multiple files in the browser with DDC.',
      ),
    },
    null,
    2,
  ),
);
