#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  addDependencyToPubspec,
  buildPackageConfigFromPubspec,
  missingDeclaredPackageImports,
  parseSimplePubspec,
  validateDeclaredPackageImports,
} from '../web/lib/pubspec.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertThrows(fn, expectedText) {
  try {
    fn();
  } catch (error) {
    const message = String((error && error.message) || error);
    assert(
      message.includes(expectedText),
      `Expected error containing "${expectedText}", got "${message}"`,
    );
    return message;
  }
  throw new Error(`Expected function to throw "${expectedText}"`);
}

const baseConfig = JSON.parse(
  readFileSync(resolve('web/toolchain/web_compiler/package_config.json'), 'utf8'),
);

const pubspec = parseSimplePubspec(`
name: sample_app
dependencies:
  jaspr: any
  http: ^1.0.0 # comment is ignored
dev_dependencies:
  lints: any
`);

assert(pubspec.name === 'sample_app', 'Expected pubspec name to parse.');
assert(pubspec.dependencies.has('jaspr'), 'Expected jaspr dependency to parse.');
assert(pubspec.dependencies.has('http'), 'Expected http dependency to parse.');
assert(!pubspec.dependencies.has('lints'), 'Expected dev_dependencies to be ignored.');

validateDeclaredPackageImports(pubspec, {
  '/lib/main.dart': `
import 'package:jaspr/client.dart';
import "package:http/http.dart";
import 'package:sample_app/widgets.dart';
`,
});

const packageConfig = JSON.parse(buildPackageConfigFromPubspec(baseConfig, pubspec));
assert(
  packageConfig.packages[0].name === 'sample_app',
  'Expected local workspace package to be added first.',
);

const undeclaredMessage = assertThrows(
  () => validateDeclaredPackageImports(pubspec, {
    '/lib/main.dart': `import 'package:web/web.dart';`,
  }),
  'Package imports must be declared',
);
const missing = missingDeclaredPackageImports(pubspec, {
  '/lib/main.dart': `import 'package:web/web.dart';`,
});
assert(missing.length === 1 && missing[0].packageName === 'web', 'Expected missing web dependency.');

const patchedPubspec = addDependencyToPubspec(`
name: sample_app
dependencies:
  jaspr: any
dev_dependencies:
  lints: any
`, 'web');
assert(
  patchedPubspec.includes('dependencies:\n  jaspr: any\n  web: any\ndev_dependencies:'),
  'Expected dependency to be inserted before dev_dependencies.',
);
assert(
  addDependencyToPubspec(patchedPubspec, 'web') === patchedPubspec,
  'Expected duplicate dependency insertion to be a no-op.',
);

const unsupportedMessage = assertThrows(
  () => buildPackageConfigFromPubspec(baseConfig, parseSimplePubspec(`
name: sample_app
dependencies:
  does_not_exist: any
`)),
  'Unsupported package(s): does_not_exist.',
);

console.log(
  JSON.stringify(
    {
      ok: true,
      localPackage: packageConfig.packages[0].name,
      patchedPubspec,
      undeclaredMessage,
      unsupportedMessage,
    },
    null,
    2,
  ),
);
