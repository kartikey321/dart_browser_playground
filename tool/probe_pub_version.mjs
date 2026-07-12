#!/usr/bin/env node
import {
  allowsVersion,
  bestVersion,
  compareVersions,
  parseConstraint,
} from '../web/lib/pub_version.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(compareVersions('1.2.3', '1.2.4') < 0, 'Expected patch comparison.');
assert(compareVersions('1.2.3-alpha.1', '1.2.3') < 0, 'Expected prerelease before stable.');
assert(compareVersions('1.2.3-alpha.2', '1.2.3-alpha.10') < 0, 'Expected numeric prerelease comparison.');

assert(allowsVersion('any', '999.0.0'), 'Expected any to allow all versions.');
assert(allowsVersion('1.2.3', '1.2.3'), 'Expected exact version match.');
assert(!allowsVersion('1.2.3', '1.2.4'), 'Expected exact version mismatch.');
assert(allowsVersion('>=1.0.0 <2.0.0', '1.9.9'), 'Expected range match.');
assert(!allowsVersion('>=1.0.0 <2.0.0', '2.0.0'), 'Expected range upper bound.');
assert(allowsVersion('^1.2.3', '1.9.0'), 'Expected caret major range.');
assert(!allowsVersion('^1.2.3', '2.0.0'), 'Expected caret major upper bound.');
assert(allowsVersion('^0.2.3', '0.2.9'), 'Expected caret minor range for zero major.');
assert(!allowsVersion('^0.2.3', '0.3.0'), 'Expected caret minor upper bound for zero major.');
assert(allowsVersion('^0.0.3', '0.0.3'), 'Expected caret patch range for zero major/minor.');
assert(!allowsVersion('^0.0.3', '0.0.4'), 'Expected caret patch upper bound for zero major/minor.');

assert(
  bestVersion(['1.0.0', '1.5.0', '2.0.0'], '^1.0.0') === '1.5.0',
  'Expected best compatible stable version.',
);
assert(
  bestVersion(['1.0.0-dev.1', '1.0.0'], '>=0.0.0') === '1.0.0',
  'Expected prereleases excluded by default.',
);
assert(
  bestVersion(['1.0.0-dev.1'], '>=0.0.0', { includePrerelease: true }) === '1.0.0-dev.1',
  'Expected prereleases when enabled.',
);

console.log(
  JSON.stringify(
    {
      ok: true,
      caretRanges: parseConstraint('^1.2.3').ranges.map((range) => `${range.operator}${range.version.text}`),
      bestHttpCompatible: bestVersion(['1.4.0', '1.5.0', '1.6.0'], '>=1.0.0 <2.0.0'),
    },
    null,
    2,
  ),
);
