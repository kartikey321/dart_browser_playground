#!/usr/bin/env node
import {
  displayPath,
  fileUri,
  languageForPath,
  normalizeWorkspacePath,
  packageImportFingerprint,
  sortedWorkspacePaths,
  validateWorkspacePath,
  workspacePathTree,
} from '../web/lib/workspace.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const workspace = {
  '/pubspec.yaml': 'name: sample\n',
  '/lib/widgets/card.dart': "import 'package:sample/model.dart';\n",
  '/lib/main.dart': "import 'package:jaspr/client.dart';\nimport 'package:sample/widgets/card.dart';\n",
};

assert(fileUri('/lib/main.dart') === 'file:///user/lib/main.dart', 'Expected file URI.');
assert(displayPath('/lib/widgets/card.dart') === 'widgets/card.dart', 'Expected lib display path.');
assert(displayPath('/pubspec.yaml') === 'pubspec.yaml', 'Expected root display path.');
assert(normalizeWorkspacePath('components/counter') === '/lib/components/counter.dart', 'Expected normalized Dart path.');
assert(normalizeWorkspacePath('/lib/a/../b') === null, 'Expected parent segment rejection.');
assert(validateWorkspacePath('widgets/card', workspace).error?.includes('already exists'), 'Expected duplicate file validation.');
assert(validateWorkspacePath('/lib/main.dart', workspace, { protectedPaths: ['/lib/main.dart'] }).error?.includes('reserved'), 'Expected protected path validation.');
assert(validateWorkspacePath('components/new', workspace).path === '/lib/components/new.dart', 'Expected valid path.');
assert(languageForPath('/pubspec.yaml') === 'yaml', 'Expected YAML language.');
assert(languageForPath('/lib/main.dart') === 'dart', 'Expected Dart language.');
assert(
  packageImportFingerprint(workspace) === '/lib/main.dart:jaspr,sample|/lib/widgets/card.dart:sample',
  'Expected stable package import fingerprint.',
);
assert(sortedWorkspacePaths(workspace)[0] === '/lib/main.dart', 'Expected entrypoint first.');

const tree = workspacePathTree(workspace);
assert(tree.dirs.has('lib'), 'Expected lib directory in tree.');
assert(tree.files.some((file) => file.path === '/pubspec.yaml'), 'Expected root pubspec file in tree.');

console.log(
  JSON.stringify(
    {
      ok: true,
      normalized: normalizeWorkspacePath('components/counter'),
      fingerprint: packageImportFingerprint(workspace),
      sorted: sortedWorkspacePaths(workspace),
      rootDirs: [...tree.dirs.keys()],
      rootFiles: tree.files.map((file) => file.path),
    },
    null,
    2,
  ),
);
