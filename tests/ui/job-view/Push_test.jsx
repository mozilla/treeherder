import {
  transformTestPath,
  transformedPaths,
} from '../../../ui/job-view/pushes/Push';

const manifestsByTask = {
  'test-linux1804-64/debug-mochitest-devtools-chrome-e10s-1': [
    'devtools/client/framework/browser-toolbox/test/browser.ini',
    'devtools/client/framework/test/browser.ini',
    'devtools/client/framework/test/metrics/browser_metrics_inspector.ini',
    'devtools/client/inspector/changes/test/browser.ini',
    'devtools/client/inspector/extensions/test/browser.ini',
    'devtools/client/inspector/markup/test/browser.ini',
    'devtools/client/jsonview/test/browser.ini',
    'devtools/client/shared/test/browser.ini',
    'devtools/client/styleeditor/test/browser.ini',
    'devtools/client/webconsole/test/node/fixtures/stubs/stubs.ini',
  ],
  'test-linux1804-64-shippable-qr/opt-web-platform-tests-e10s-5': [
    '/IndexedDB',
    '/WebCryptoAPI/wrapKey_unwrapKey',
    '/_mozilla/fetch/api/redirect',
    '/mixed-content/gen/sharedworker-classic.http-rp',
    '/upgrade-insecure-requests/gen/sharedworker-module-data.meta',
  ],
};

describe('Transformations', () => {
  test('Manifest by task structure transformations', () => {
    const transformed = transformedPaths(manifestsByTask);
    expect(transformed).toEqual({
      'test-linux1804-64/debug-mochitest-devtools-chrome-e10s-1': [
        'devtools/client/framework/browser-toolbox/test/browser.ini',
        'devtools/client/framework/test/browser.ini',
        'devtools/client/framework/test/metrics/browser_metrics_inspector.ini',
        'devtools/client/inspector/changes/test/browser.ini',
        'devtools/client/inspector/extensions/test/browser.ini',
        'devtools/client/inspector/markup/test/browser.ini',
        'devtools/client/jsonview/test/browser.ini',
        'devtools/client/shared/test/browser.ini',
        'devtools/client/styleeditor/test/browser.ini',
        'devtools/client/webconsole/test/node/fixtures/stubs/stubs.ini',
      ],
      'test-linux1804-64-shippable-qr/opt-web-platform-tests-e10s-5': [
        'testing/web-platform/tests/IndexedDB',
        'testing/web-platform/tests/WebCryptoAPI/wrapKey_unwrapKey',
        'testing/web-platform/mozilla/tests/fetch/api/redirect',
        'testing/web-platform/tests/mixed-content/gen/sharedworker-classic.http-rp',
        'testing/web-platform/tests/upgrade-insecure-requests/gen/sharedworker-module-data.meta',
      ],
    });
  });

  test('Path transformations (WPT)', () => {
    const tests = [
      {
        path: 'devtools/client/framework/browser-toolbox/test/browser.ini',
        expected: 'devtools/client/framework/browser-toolbox/test/browser.ini',
      },
      {
        path:
          'devtools/client/framework/browser-toolbox/test/browser_browser_toolbox.js',
        expected:
          'devtools/client/framework/browser-toolbox/test/browser_browser_toolbox.js',
      },
      {
        path: '/IndexedDB',
        expected: 'testing/web-platform/tests/IndexedDB',
      },
      {
        path: '/IndexedDB/abort-in-initial-upgradeneeded.html',
        expected:
          'testing/web-platform/tests/IndexedDB/abort-in-initial-upgradeneeded.html',
      },
      {
        path: '/_mozilla/xml',
        expected: 'testing/web-platform/mozilla/tests/xml',
      },
      {
        path: '/_mozilla/xml/parsedepth.html',
        expected: 'testing/web-platform/mozilla/tests/xml/parsedepth.html',
      },
      {
        path: '/IndexedDB/key-generators',
        expected: 'testing/web-platform/tests/IndexedDB/key-generators',
      },
    ];
    tests.forEach(({ path, expected }) => {
      expect(transformTestPath(path)).toEqual(expected);
    });
  });
});
