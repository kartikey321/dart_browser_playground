#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const experimentDir = resolve('experiments/pub_solver_js');
const outputPath = resolve(experimentDir, 'build/probe_compile.js');
const browserOutputPath = resolve(experimentDir, 'build/probe_browser.js');
const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: experimentDir,
    encoding: 'utf8',
    timeout: options.timeout ?? 120000,
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const pubGet = run('dart', ['pub', 'get'], { timeout: 60000 });
assert(pubGet.status === 0, pubGet.stderr || pubGet.stdout || 'dart pub get failed.');

const compile = run('dart', [
  'compile',
  'js',
  'bin/probe_compile.dart',
  '-O2',
  '-o',
  'build/probe_compile.js',
], { timeout: 120000 });
assert(compile.status === 0, compile.stderr || compile.stdout || 'dart compile js failed.');
assert(existsSync(outputPath), `Expected compiled JS at ${outputPath}.`);

const runtime = run('node', ['build/probe_compile.js'], { timeout: 10000 });
const runtimeStdout = String(runtime.stdout || '').trim();
const runtimeLines = runtimeStdout.split(/\r?\n/).filter(Boolean);
const runtimeJsonLine = runtimeLines.find((line) => line.startsWith('{') && line.endsWith('}')) ?? '';
const runtimeJson = runtimeJsonLine ? JSON.parse(runtimeJsonLine) : null;
const runtimeProducedJson = Boolean(runtimeJson);

const browserCompile = run('dart', [
  'compile',
  'js',
  'bin/probe_browser.dart',
  '-O2',
  '-o',
  'build/probe_browser.js',
], { timeout: 120000 });
assert(browserCompile.status === 0, browserCompile.stderr || browserCompile.stdout || 'dart compile js browser probe failed.');
assert(existsSync(browserOutputPath), `Expected compiled browser JS at ${browserOutputPath}.`);

const server = spawn('python3', ['-m', 'http.server', '9876'], {
  cwd: experimentDir,
  stdio: 'ignore',
});

let browser;
try {
  const url = 'http://localhost:9876/web/probe_browser.html';
  browser = spawnSync(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--virtual-time-budget=20000',
      '--dump-dom',
      url,
    ],
    { encoding: 'utf8', timeout: 30000 },
  );
} finally {
  server.kill();
}

const browserDom = String(browser?.stdout || '');
const browserMatch = browserDom.match(/data-probe-result="([^"]*)"/);
const browserProbeResult = browserMatch?.[1]?.replaceAll('&quot;', '"') ?? '';
let browserJson = null;
if (browserProbeResult.startsWith('{') && browserProbeResult.endsWith('}')) {
  browserJson = JSON.parse(browserProbeResult);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      experimentDir,
      compiled: true,
      jsBytes: statSync(outputPath).size,
      compileSummary: compile.stdout.trim().split(/\r?\n/).at(-1),
      runtimeStatus: runtime.status,
      runtimeSignal: runtime.signal,
      runtimeTimedOut: runtime.error?.code === 'ETIMEDOUT',
      runtimeProducedJson,
      runtimeStages: runtimeLines.filter((line) => line.startsWith('stage:')),
      runtimeJson,
      browserJsBytes: statSync(browserOutputPath).size,
      browserRuntimeStatus: browser?.status ?? null,
      browserProbeResult,
      browserJson,
      browserProducedJson: Boolean(browserJson),
      conclusion: browserJson
        ? 'Upstream resolveVersions compiled to browser JS and produced JSON for a no-dependency root package.'
        : 'Upstream resolveVersions compiles, but the browser probe did not yet produce usable JSON; next step is a browser-safe solver adapter around package listing/cache behavior.',
    },
    null,
    2,
  ),
);
