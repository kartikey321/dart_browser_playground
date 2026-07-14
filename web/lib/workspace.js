export function fileUri(path, { rootUri = 'file:///user' } = {}) {
  return `${rootUri}${path}`;
}

export function displayPath(path) {
  return path.startsWith('/lib/') ? path.slice('/lib/'.length) : path.slice(1);
}

export function normalizeWorkspacePath(path, {
  defaultDirectory = '/lib',
  defaultExtension = '.dart',
} = {}) {
  let next = String(path || '').trim();
  if (!next) return null;
  if (!next.startsWith('/')) next = `/${next}`;
  next = next.replaceAll('\\', '/').replace(/\/+/g, '/');
  if (!next.endsWith(defaultExtension)) next = `${next}${defaultExtension}`;
  if (!next.startsWith(`${defaultDirectory}/`)) {
    next = `${defaultDirectory}/${next.replace(/^\/+/, '')}`;
  }
  if (next.includes('/../') || next.includes('/./')) return null;
  if (next.endsWith('/..') || next.endsWith('/.')) return null;
  if (next.split('/').some((part) => part === '..' || part === '.')) return null;
  return next;
}

export function validateWorkspacePath(path, workspace = {}, {
  currentPath = null,
  protectedPaths = [],
  defaultDirectory = '/lib',
  defaultExtension = '.dart',
  mustBeDart = true,
} = {}) {
  const normalized = normalizeWorkspacePath(path, { defaultDirectory, defaultExtension });
  if (!normalized) {
    return {
      path: null,
      error: `Enter a valid workspace path under ${defaultDirectory}, for example ${defaultDirectory}/components/counter${defaultExtension}.`,
    };
  }

  if (mustBeDart && !normalized.endsWith('.dart')) {
    return { path: null, error: `Only Dart files can be created here: ${normalized}` };
  }

  if (protectedPaths.includes(normalized) && normalized !== currentPath) {
    return { path: null, error: `This path is reserved: ${normalized}` };
  }

  if (workspace[normalized] !== undefined && normalized !== currentPath) {
    return { path: normalized, error: `File already exists: ${normalized}` };
  }

  return { path: normalized, error: null };
}

export function languageForPath(path) {
  if (path.endsWith('.dart')) return 'dart';
  if (path.endsWith('.yaml') || path.endsWith('.yml')) return 'yaml';
  return 'plaintext';
}

export function packageImportFingerprint(workspace) {
  const imports = [];
  const pattern = /\b(?:import|export|part\s+of)\s+['"]package:([A-Za-z_][A-Za-z0-9_]*)\//g;
  for (const [path, source] of Object.entries(workspace || {})) {
    if (!path.endsWith('.dart')) continue;
    const names = [...String(source).matchAll(pattern)].map((match) => match[1]).sort();
    if (names.length) imports.push(`${path}:${names.join(',')}`);
  }
  return imports.sort().join('|');
}

export function sortedWorkspacePaths(workspace, { entrypoint = '/lib/main.dart' } = {}) {
  return Object.keys(workspace || {}).sort((a, b) => {
    if (a === entrypoint) return -1;
    if (b === entrypoint) return 1;
    return a.localeCompare(b);
  });
}

export function workspacePathTree(workspace, { entrypoint = '/lib/main.dart' } = {}) {
  const root = { dirs: new Map(), files: [] };
  for (const path of sortedWorkspacePaths(workspace, { entrypoint })) {
    const parts = path.slice(1).split('/');
    const file = parts.pop();
    let node = root;
    for (const part of parts) {
      if (!node.dirs.has(part)) node.dirs.set(part, { dirs: new Map(), files: [] });
      node = node.dirs.get(part);
    }
    node.files.push({ name: file, path });
  }
  return root;
}
