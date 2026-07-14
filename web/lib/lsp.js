export function lspRangeToMonaco(range) {
  return {
    startLineNumber: range.start.line + 1,
    startColumn: range.start.character + 1,
    endLineNumber: range.end.line + 1,
    endColumn: range.end.character + 1,
  };
}

export function monacoPosToLsp(position) {
  return { line: position.lineNumber - 1, character: position.column - 1 };
}

export function lspTextEditToMonaco(edit) {
  if (!edit?.range) return null;
  return { range: lspRangeToMonaco(edit.range), text: edit.newText ?? '' };
}

export function workspacePathFromUri(uri, { rootUri = 'file:///user' } = {}) {
  if (!uri?.startsWith(`${rootUri}/`)) return null;
  return uri.slice(rootUri.length);
}

export function lspWorkspaceEditToMonaco(edit, monaco) {
  const edits = [];
  const pushEdits = (uri, textEdits) => {
    const resource = monaco.Uri.parse(uri);
    for (const textEdit of textEdits || []) {
      const converted = lspTextEditToMonaco(textEdit);
      if (!converted) continue;
      edits.push({
        resource,
        versionId: undefined,
        textEdit: converted,
      });
    }
  };

  if (edit?.changes) {
    for (const [uri, textEdits] of Object.entries(edit.changes)) {
      pushEdits(uri, textEdits);
    }
  }
  if (edit?.documentChanges) {
    for (const change of edit.documentChanges) {
      if (change?.textDocument?.uri && Array.isArray(change.edits)) {
        pushEdits(change.textDocument.uri, change.edits);
      }
    }
  }

  return { edits };
}

export function lspTextEditsToWorkspaceEdit(uri, textEdits, monaco) {
  return lspWorkspaceEditToMonaco({ changes: { [uri]: textEdits } }, monaco);
}
