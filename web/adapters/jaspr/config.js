export const jasprAdapterConfig = {
  title: 'Jaspr Browser Playground',
  entrypoint: '/lib/main.dart',
  compilerWorkerUrl: 'adapters/jaspr/compiler_worker.js',
  previewUrl: 'adapters/jaspr/preview.html',
  toolchainRoot: './toolchain',
  lspPackageBundle: './toolchain/jaspr_dart_packages.bin',
  workspaceStorageKey: 'jaspr-ddc-playground-workspace',
  legacySourceStorageKey: 'jaspr-ddc-playground-source',
  splitStorageKey: 'jaspr-ddc-playground-split',
  defaultWorkspace: {
    '/pubspec.yaml': `name: jaspr_browser_playground
description: A Jaspr playground that compiles in the browser.
environment:
  sdk: ^3.8.0

dependencies:
  jaspr: any
`,
    '/lib/main.dart': `import 'package:jaspr/client.dart';
import 'package:jaspr_browser_playground/components/counter.dart';

void main() {
  Jaspr.initializeApp();
  runApp(const PlaygroundApp(), attachTo: '#app');
}
`,
    '/lib/components/counter.dart': `import 'package:jaspr/client.dart';
import 'package:jaspr/dom.dart';

class PlaygroundApp extends StatefulComponent {
  const PlaygroundApp({super.key});

  @override
  State<PlaygroundApp> createState() => PlaygroundAppState();
}

class PlaygroundAppState extends State<PlaygroundApp> {
  var count = 0;

  @override
  Component build(BuildContext context) {
    return div(classes: 'app', [
      h1([text('Jaspr browser playground')]),
      p([text('Compiled from multiple files in the browser with DDC.')]),
      button(
        events: {
          'click': (event) {
            setState(() {
              count += 1;
            });
          },
        },
        [text('Clicked $count times')],
      ),
    ]);
  }
}
`,
  },
  legacySample: `import 'package:jaspr/client.dart';
import 'package:jaspr/dom.dart';

class PlaygroundApp extends StatefulComponent {
  const PlaygroundApp({super.key});

  @override
  State<PlaygroundApp> createState() => PlaygroundAppState();
}

class PlaygroundAppState extends State<PlaygroundApp> {
  var count = 0;

  @override
  Component build(BuildContext context) {
    return div(classes: 'app', [
      h1([text('Jaspr browser playground')]),
      p([text('Compiled locally in the browser with DDC.')]),
      button(
        events: {
          'click': (event) {
            setState(() {
              count += 1;
            });
          },
        },
        [text('Clicked $count times')],
      ),
    ]);
  }
}

void main() {
  Jaspr.initializeApp();
  runApp(const PlaygroundApp(), attachTo: '#app');
}
`,
};
