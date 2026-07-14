#!/usr/bin/env node
import {
  lspRangeToMonaco,
  lspTextEditToMonaco,
  lspTextEditsToWorkspaceEdit,
  lspWorkspaceEditToMonaco,
  monacoPosToLsp,
  workspacePathFromUri,
} from '../web/lib/lsp.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const monaco = {
  Uri: {
    parse(value) {
      return {
        value,
        toString() {
          return value;
        },
      };
    },
  },
};

const range = {
  start: { line: 2, character: 4 },
  end: { line: 3, character: 8 },
};

assert(lspRangeToMonaco(range).startLineNumber === 3, 'Expected 1-based start line.');
assert(monacoPosToLsp({ lineNumber: 5, column: 7 }).line === 4, 'Expected 0-based LSP line.');
assert(lspTextEditToMonaco({ range, newText: 'next' }).text === 'next', 'Expected text edit conversion.');
assert(lspTextEditToMonaco({}) === null, 'Expected invalid edit to be skipped.');
assert(workspacePathFromUri('file:///user/lib/main.dart') === '/lib/main.dart', 'Expected workspace path.');
assert(workspacePathFromUri('file:///other/lib/main.dart') === null, 'Expected non-workspace URI rejection.');

const workspaceEdit = lspWorkspaceEditToMonaco({
  changes: {
    'file:///user/lib/main.dart': [{ range, newText: 'a' }],
  },
  documentChanges: [
    {
      textDocument: { uri: 'file:///user/lib/other.dart' },
      edits: [{ range, newText: 'b' }],
    },
  ],
}, monaco);
assert(workspaceEdit.edits.length === 2, 'Expected changes and documentChanges conversion.');
assert(
  lspTextEditsToWorkspaceEdit('file:///user/lib/main.dart', [{ range, newText: 'x' }], monaco).edits.length === 1,
  'Expected text edits helper.',
);

console.log(
  JSON.stringify(
    {
      ok: true,
      range: lspRangeToMonaco(range),
      workspacePath: workspacePathFromUri('file:///user/lib/main.dart'),
      editCount: workspaceEdit.edits.length,
    },
    null,
    2,
  ),
);
