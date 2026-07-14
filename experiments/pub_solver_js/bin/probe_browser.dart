import 'dart:convert';

import 'package:pub/src/package.dart';
import 'package:pub/src/pubspec.dart';
import 'package:pub/src/solver.dart' as pub_solver;
import 'package:pub/src/source/root.dart';
import 'package:pub/src/system_cache.dart';
import 'package:pub_semver/pub_semver.dart';
import 'package:web/web.dart' as web;

Future<void> main() async {
  setProbeText('stage:cache');
  final cache = SystemCache(rootDir: '.pub-cache-spike');
  setProbeText('stage:pubspec');
  final pubspec = Pubspec.parse(
    '''
name: root_app
environment:
  sdk: ^3.7.0
''',
    cache.sources,
    containingDescription: ResolvedRootDescription.fromDir('.'),
  );
  setProbeText('stage:root');
  final root = Package(pubspec, '.', const []);
  setProbeText('stage:resolve-start');
  final result = await pub_solver.resolveVersions(
    pub_solver.SolveType.upgrade,
    cache,
    root,
    sdkOverrides: {'dart': Version.parse('3.12.0')},
  );
  setProbeText(jsonEncode({
    'ok': true,
    'attemptedSolutions': result.attemptedSolutions,
    'packages': result.packages.map((package) => package.toString()).toList(),
  }));
}

void setProbeText(String value) {
  web.document.body?.setAttribute('data-probe-result', value);
  web.document.body?.textContent = value;
}
