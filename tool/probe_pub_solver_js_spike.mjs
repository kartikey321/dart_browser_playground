#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const experimentDir = resolve('experiments/pub_solver_js');
const outputPath = resolve(experimentDir, 'build/probe_compile.js');

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
const runtimeProducedJson = runtimeStdout.startsWith('{') && runtimeStdout.endsWith('}');

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
      runtimeStdout,
      conclusion: runtimeProducedJson
        ? 'Naive upstream resolveVersions wrapper produced JSON.'
        : 'Naive upstream resolveVersions wrapper compiles, but does not yet produce usable runtime JSON; next step is a browser-safe solver adapter around package listing/cache behavior.',
    },
    null,
    2,
  ),
);
