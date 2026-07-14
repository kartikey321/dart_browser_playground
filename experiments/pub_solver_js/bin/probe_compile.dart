import 'dart:convert';

import 'package:pub/src/package.dart';
import 'package:pub/src/pubspec.dart';
import 'package:pub/src/solver.dart' as pub_solver;
import 'package:pub/src/source/root.dart';
import 'package:pub/src/system_cache.dart';
import 'package:pub_semver/pub_semver.dart';

/// Minimal compile-boundary probe for reusing dart-lang/pub solver code.
///
/// This file intentionally imports the upstream internal solver entry point
/// from a separate package. The spike's first question is whether that import
/// can be compiled for the browser and called for a trivial root package before
/// we invest in a JSON wrapper.
Future<void> main() async {
  final cache = SystemCache(rootDir: '.pub-cache-spike');
  final pubspec = Pubspec.parse(
    '''
name: root_app
environment:
  sdk: ^3.7.0
''',
    cache.sources,
    containingDescription: ResolvedRootDescription.fromDir('.'),
  );
  final root = Package(pubspec, '.', const []);
  final result = await pub_solver.resolveVersions(
    pub_solver.SolveType.upgrade,
    cache,
    root,
    sdkOverrides: {'dart': Version.parse('3.12.0')},
  );

  final exportedSymbols = <String, Object?>{
    'solveTypeUpgrade': pub_solver.SolveType.upgrade.name,
    'boundary': 'package:pub/src/solver.dart',
    'attemptedSolutions': result.attemptedSolutions,
    'packages': result.packages.map((package) => package.toString()).toList(),
  };
  print(jsonEncode(exportedSymbols));
}
