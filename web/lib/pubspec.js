export function stripYamlComment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if ((char === '"' || char === "'") && line[i - 1] !== '\\') {
      quote = quote === char ? null : quote || char;
    } else if (char === '#' && !quote) {
      return line.slice(0, i);
    }
  }
  return line;
}

export function parseSimplePubspec(source) {
  const pubspec = {
    name: null,
    dependencies: new Set(),
    dependencyConstraints: {},
    unsupportedDependencyKinds: [],
  };
  let section = null;
  let sectionIndent = 0;
  let dependencyIndent = null;

  for (const rawLine of String(source || '').split(/\r?\n/)) {
    const line = stripYamlComment(rawLine).replace(/\s+$/, '');
    if (!line.trim()) continue;
    const indent = line.match(/^\s*/)[0].length;
    const trimmed = line.trim();
    const pair = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*):(?:\s*(.*))?$/);
    if (!pair) continue;

    const key = pair[1];
    const value = (pair[2] ?? '').trim();
    if (indent === 0) {
      section = null;
      if (key === 'name') {
        pubspec.name = value.replace(/^['"]|['"]$/g, '') || null;
      } else if (key === 'dependencies') {
        section = 'dependencies';
        sectionIndent = indent;
        dependencyIndent = null;
      }
      continue;
    }

    if (section === 'dependencies' && indent > sectionIndent) {
      if (dependencyIndent === null) dependencyIndent = indent;
          if (indent !== dependencyIndent) continue;
          pubspec.dependencies.add(key);
          if (value === '' || value.startsWith('{')) {
            pubspec.unsupportedDependencyKinds.push(key);
          } else {
            pubspec.dependencyConstraints[key] = value.replace(/^['"]|['"]$/g, '') || 'any';
          }
    }
  }

  return pubspec;
}

export function packageImportsForWorkspace(workspace) {
  const imports = new Map();
  const pattern = /\b(?:import|export|part\s+of)\s+['"]package:([A-Za-z_][A-Za-z0-9_]*)\//g;
  for (const [path, source] of Object.entries(workspace || {})) {
    if (!path.endsWith('.dart')) continue;
    for (const match of String(source).matchAll(pattern)) {
      if (!imports.has(match[1])) imports.set(match[1], new Set());
      imports.get(match[1]).add(path);
    }
  }
  return imports;
}

export function validateDeclaredPackageImports(pubspec, workspace) {
  const missing = missingDeclaredPackageImports(pubspec, workspace);
  if (missing.length) {
    throw new Error([
      'Package imports must be declared in pubspec.yaml dependencies.',
      ...missing.map(({ packageName, paths }) => `${packageName} imported by ${paths.join(', ')}`)
        .map((item) => `- ${item}`),
    ].join('\n'));
  }
}

export function missingDeclaredPackageImports(pubspec, workspace) {
  const declared = new Set(pubspec.dependencies);
  const localName = pubspec.name && /^[A-Za-z_][A-Za-z0-9_]*$/.test(pubspec.name)
    ? pubspec.name
    : null;
  const missing = [];
  for (const [packageName, paths] of packageImportsForWorkspace(workspace)) {
    if (packageName === localName || declared.has(packageName)) continue;
    missing.push({ packageName, paths: [...paths].sort() });
  }
  return missing.sort((a, b) => a.packageName.localeCompare(b.packageName));
}

export function bundledPackageNames(baseConfig) {
  return new Set((baseConfig?.packages ?? []).map((pkg) => pkg.name));
}

export function buildPackageConfigFromPubspec(baseConfig, pubspec) {
  const packages = Array.isArray(baseConfig?.packages) ? [...baseConfig.packages] : [];
  const packageNames = bundledPackageNames(baseConfig);
  const requested = [...pubspec.dependencies].filter((name) => name !== 'flutter');
  const missing = requested.filter((name) => !packageNames.has(name));
  const unsupported = pubspec.unsupportedDependencyKinds.filter((name) => requested.includes(name));
  if (missing.length || unsupported.length) {
    const messages = [];
    if (missing.length) {
      messages.push(`Unsupported package(s): ${missing.join(', ')}.`);
    }
    if (unsupported.length) {
      messages.push(`Only bundled hosted/simple dependencies are supported right now; complex dependency syntax found for: ${unsupported.join(', ')}.`);
    }
    messages.push(`Bundled packages: ${[...packageNames].sort().join(', ')}.`);
    throw new Error(messages.join('\n'));
  }

  if (pubspec.name && /^[A-Za-z_][A-Za-z0-9_]*$/.test(pubspec.name) && !packageNames.has(pubspec.name)) {
    packages.unshift({
      name: pubspec.name,
      rootUri: 'memory:/workspace/',
      packageUri: 'lib/',
      languageVersion: '3.8',
    });
  }

  return JSON.stringify({ ...baseConfig, packages }, null, 2);
}

export function addDependencyToPubspec(source, packageName, constraint = 'any') {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(packageName)) {
    throw new Error(`Invalid package name: ${packageName}`);
  }

  const pubspec = parseSimplePubspec(source);
  if (pubspec.dependencies.has(packageName)) return String(source || '');

  const text = String(source || '').replace(/\s*$/, '');
  const dependencyLine = `  ${packageName}: ${constraint}`;
  const lines = text ? text.split(/\r?\n/) : [];
  const dependenciesIndex = lines.findIndex((line) => /^dependencies:\s*(?:#.*)?$/.test(stripYamlComment(line).trim()));

  if (dependenciesIndex === -1) {
    return `${text}${text ? '\n\n' : ''}dependencies:\n${dependencyLine}\n`;
  }

  let insertAt = lines.length;
  for (let i = dependenciesIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (!line.startsWith(' ') && !line.startsWith('\t')) {
      insertAt = i;
      break;
    }
  }

  lines.splice(insertAt, 0, dependencyLine);
  return `${lines.join('\n')}\n`;
}
