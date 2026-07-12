export function parseVersion(input) {
  const text = String(input || '').trim();
  const match = text.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);
  if (!match) throw new Error(`Invalid version: ${input}`);
  return {
    text,
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    preRelease: match[4] ? match[4].split('.') : [],
  };
}

export function compareVersions(a, b) {
  const left = typeof a === 'string' ? parseVersion(a) : a;
  const right = typeof b === 'string' ? parseVersion(b) : b;
  for (const key of ['major', 'minor', 'patch']) {
    if (left[key] !== right[key]) return Math.sign(left[key] - right[key]);
  }
  return comparePreRelease(left.preRelease, right.preRelease);
}

export function parseConstraint(input) {
  const text = String(input || 'any').trim();
  if (!text || text === 'any') return { text: 'any', ranges: [] };
  if (text.startsWith('^')) return caretConstraint(text.slice(1).trim());

  const comparators = text.split(/\s+/).filter(Boolean).map(parseComparator);
  return { text, ranges: comparators };
}

export function allowsVersion(constraintInput, versionInput) {
  const constraint = typeof constraintInput === 'string'
    ? parseConstraint(constraintInput)
    : constraintInput;
  const version = typeof versionInput === 'string'
    ? parseVersion(versionInput)
    : versionInput;
  return constraint.ranges.every((range) => {
    const comparison = compareVersions(version, range.version);
    if (range.operator === '==') return comparison === 0;
    if (range.operator === '>') return comparison > 0;
    if (range.operator === '>=') return comparison >= 0;
    if (range.operator === '<') return comparison < 0;
    if (range.operator === '<=') return comparison <= 0;
    throw new Error(`Unsupported comparator: ${range.operator}`);
  });
}

export function allowsAllConstraints(constraintInputs, versionInput) {
  return constraintInputs.every((constraint) => allowsVersion(constraint, versionInput));
}

export function bestVersion(versions, constraintInput = 'any', { includePrerelease = false } = {}) {
  const constraint = parseConstraint(constraintInput);
  return versions
    .map((version) => typeof version === 'string' ? parseVersion(version) : parseVersion(version.version))
    .filter((version) => includePrerelease || version.preRelease.length === 0)
    .filter((version) => allowsVersion(constraint, version))
    .sort(compareVersions)
    .at(-1)?.text ?? null;
}

function parseComparator(text) {
  const match = text.match(/^(>=|<=|>|<|=)?(.+)$/);
  if (!match) throw new Error(`Invalid version comparator: ${text}`);
  return {
    operator: match[1] === '=' || !match[1] ? '==' : match[1],
    version: parseVersion(match[2]),
  };
}

function caretConstraint(versionText) {
  const lower = parseVersion(versionText);
  const upper = caretUpperBound(lower);
  return {
    text: `^${versionText}`,
    ranges: [
      { operator: '>=', version: lower },
      { operator: '<', version: upper },
    ],
  };
}

function caretUpperBound(version) {
  if (version.major > 0) {
    return parseVersion(`${version.major + 1}.0.0`);
  }
  if (version.minor > 0) {
    return parseVersion(`0.${version.minor + 1}.0`);
  }
  return parseVersion(`0.0.${version.patch + 1}`);
}

function comparePreRelease(left, right) {
  if (!left.length && !right.length) return 0;
  if (!left.length) return 1;
  if (!right.length) return -1;
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    if (left[i] === undefined) return -1;
    if (right[i] === undefined) return 1;
    const leftNumber = /^\d+$/.test(left[i]) ? Number(left[i]) : null;
    const rightNumber = /^\d+$/.test(right[i]) ? Number(right[i]) : null;
    if (leftNumber !== null && rightNumber !== null && leftNumber !== rightNumber) {
      return Math.sign(leftNumber - rightNumber);
    }
    if (leftNumber !== null && rightNumber === null) return -1;
    if (leftNumber === null && rightNumber !== null) return 1;
    if (left[i] !== right[i]) return left[i] < right[i] ? -1 : 1;
  }
  return 0;
}
