#!/usr/bin/env node
import {
  formatPackagesReport,
  formatPubGetSuccess,
  packageResolutionDetails,
  resolveWorkspaceWithHostedPackages,
  workspacePackageConfig,
} from '../web/lib/package_resolution.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const baseConfig = {
  configVersion: 2,
  packages: [
    { name: 'jaspr', rootUri: 'memory:/packages/jaspr/', packageUri: 'lib/', languageVersion: '3.8' },
  ],
};

const pubspec = {
  name: 'sample_app',
  dependencies: new Set(['jaspr']),
};
const packageConfig = JSON.parse(workspacePackageConfig(baseConfig, pubspec));
assert(packageConfig.packages[0].name === 'sample_app', 'Expected workspace package first.');
assert(packageConfig.packages.some((pkg) => pkg.name === 'jaspr'), 'Expected bundled package preserved.');

const noHosted = await resolveWorkspaceWithHostedPackages({
  baseConfig,
  hostedSource: null,
  workspace: {
    '/pubspec.yaml': 'name: sample_app\ndependencies:\n  jaspr: any\n',
    '/lib/main.dart': "import 'package:jaspr/client.dart';\n",
  },
});
assert(noHosted.resolvedPackageCount === 0, 'Expected no hosted packages.');
assert(Object.keys(noHosted.packageSources).length === 0, 'Expected no hosted sources.');

const details = packageResolutionDetails({
  mode: 'hosted',
  loaded: [{ packageName: 'demo', version: '1.0.0', fileCount: 2, sha256Verified: true }],
  resolvedPackageCount: 1,
});
assert(formatPubGetSuccess(details).includes('demo 1.0.0'), 'Expected hosted success details.');

const report = formatPackagesReport({
  baseConfig,
  packageConfig: JSON.stringify({
    configVersion: 2,
    packages: [
      { name: 'sample_app' },
      { name: 'jaspr' },
      { name: 'demo' },
    ],
  }),
  packageResolution: details,
  hostedPubEnabled: true,
});
assert(report.includes('Current resolved packages (3):'), 'Expected current package count.');
assert(report.includes('demo 1.0.0 (2 files, sha256 verified)'), 'Expected hosted package line.');

console.log(
  JSON.stringify(
    {
      ok: true,
      noHostedPackageConfigBytes: noHosted.packageConfig.length,
      success: formatPubGetSuccess(details),
      report,
    },
    null,
    2,
  ),
);
