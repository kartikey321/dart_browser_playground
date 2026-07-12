const textDecoder = new TextDecoder();

let baseRequestText;
let basePackageConfig;
let ddcOutlineBase64;
let compileDdc;

self.jasprDdcCompilerRegister = (compile) => {
  compileDdc = compile;
};

function send(type, payload = {}) {
  self.postMessage({ channel: 'jaspr-ddc-compiler-worker', type, ...payload });
}

function u32(view, offset) {
  return view.getUint32(offset, true);
}

function readString(bytes, state) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const length = u32(view, state.offset);
  state.offset += 4;
  const value = textDecoder.decode(bytes.subarray(state.offset, state.offset + length));
  state.offset += length;
  return value;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function parseDpkg(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] !== 0x44 || bytes[1] !== 0x50 || bytes[2] !== 0x4b || bytes[3] !== 0x47) {
    throw new Error('Invalid package source bundle: missing DPKG header.');
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const state = { offset: 4 };
  const packageCount = u32(view, state.offset);
  state.offset += 4;
  const text = {};
  let fileCount = 0;

  for (let p = 0; p < packageCount; p += 1) {
    const packageName = readString(bytes, state);
    const files = u32(view, state.offset);
    state.offset += 4;
    for (let f = 0; f < files; f += 1) {
      const path = readString(bytes, state);
      const length = u32(view, state.offset);
      state.offset += 4;
      text[`memory:/packages/${packageName}/${path}`] =
        textDecoder.decode(bytes.subarray(state.offset, state.offset + length));
      state.offset += length;
      fileCount += 1;
    }
  }

  return { text, packageCount, fileCount };
}

async function init() {
  importScripts('../../toolchain/web_compiler/jaspr_ddc_compiler.js');
  if (typeof compileDdc !== 'function') {
    throw new Error('Compiler wrapper did not register compileDdc.');
  }

  const [packageConfig, libraries, ddcOutline, sourceBundle] = await Promise.all([
    fetch('../../toolchain/web_compiler/package_config.json').then((r) => r.text()),
    fetch('../../toolchain/web_compiler/libraries.json').then((r) => r.text()),
    fetch('../../toolchain/web_compiler/ddc_outline.dill').then((r) => r.arrayBuffer()),
    fetch('../../toolchain/jaspr_web_sources.bin').then((r) => r.arrayBuffer()),
  ]);

  const parsed = parseDpkg(sourceBundle);
  basePackageConfig = packageConfig;
  baseRequestText = {
    ...parsed.text,
    'memory:/sdk/libraries.json': libraries,
  };
  ddcOutlineBase64 = arrayBufferToBase64(ddcOutline);
  send('ready', {
    packageCount: parsed.packageCount,
    fileCount: parsed.fileCount,
  });
}

async function compile({ requestId, files, entrypoint, packageConfig }) {
  if (typeof compileDdc !== 'function' || !baseRequestText || !ddcOutlineBase64) {
    throw new Error('Compiler worker is not ready.');
  }
  if (!files || typeof files !== 'object') {
    throw new Error('Compile request is missing workspace files.');
  }

  const workspaceText = {};
  for (const [path, source] of Object.entries(files)) {
    if (!path.startsWith('/')) {
      throw new Error(`Workspace file path must start with "/": ${path}`);
    }
    workspaceText[`memory:/workspace${path}`] = String(source);
  }

  const moduleName = `main_${Date.now().toString(36)}`;
  const request = {
    entrypoint: `memory:/workspace${entrypoint || '/lib/main.dart'}`,
    moduleName,
    dartSdkSummary: 'memory:/sdk/ddc_outline.dill',
    libraries: 'memory:/sdk/libraries.json',
    packageConfig: 'memory:/workspace/.dart_tool/package_config.json',
    text: {
      ...baseRequestText,
      'memory:/workspace/.dart_tool/package_config.json': packageConfig || basePackageConfig,
      ...workspaceText,
    },
    binaryBase64: {
      'memory:/sdk/ddc_outline.dill': ddcOutlineBase64,
    },
  };

  const started = performance.now();
  const raw = await compileDdc(JSON.stringify(request));
  const compiled = JSON.parse(String(raw));
  send('compiled', {
    requestId,
    elapsedMs: Math.round(performance.now() - started),
    compiled,
  });
}

self.addEventListener('message', (event) => {
  const message = event.data;
  if (message?.channel !== 'jaspr-ddc-compiler-main') return;

  if (message.type === 'compile') {
    compile(message).catch((error) => {
      send('error', {
        requestId: message.requestId,
        message: String((error && error.stack) || error),
      });
    });
  }
});

init().catch((error) => {
  send('error', { message: String((error && error.stack) || error) });
});
