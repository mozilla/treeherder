import {
  Perfdocs,
  removedOldTestsDevTools,
  nonDocumentedTestsDevTools,
} from '../../../ui/perfherder/perf-helpers/perfdocs';

test('Passing undefined to the Perfdocs constructor does not result in exception', () => {
  const framework = undefined;
  const suite = undefined;
  const platform = undefined;
  const title = undefined;

  const perfdocs = new Perfdocs(framework, suite, platform, title);
  expect(perfdocs.documentationURL).toBe(
    'https://firefox-source-docs.mozilla.org/testing/perfdocs/',
  );
  expect(perfdocs.framework).toBe('');
  expect(perfdocs.suite).toBe('');
  expect(perfdocs.platform).toBe('');
  expect(perfdocs.title).toBe('');
  expect(perfdocs.remainingName).toBe('');
  expect(perfdocs.hasDocumentation()).toBeFalsy();
});

test('Passing null to the Perfdocs constructor does not result in exception', () => {
  const framework = null;
  const suite = null;
  const platform = null;
  const title = null;

  const perfdocs = new Perfdocs(framework, suite, platform, title);
  expect(perfdocs.documentationURL).toBe(
    'https://firefox-source-docs.mozilla.org/testing/perfdocs/',
  );
  expect(perfdocs.framework).toBe('');
  expect(perfdocs.suite).toBe('');
  expect(perfdocs.platform).toBe('');
  expect(perfdocs.title).toBe('');
  expect(perfdocs.remainingName).toBe('');
  expect(perfdocs.hasDocumentation()).toBeFalsy();
});

test('If the framework is unknown the documentation url resulted is a general one', () => {
  const framework = 'someFrameworkName';
  const suite = 'someSuite';

  const perfdocs = new Perfdocs(framework, suite);
  expect(perfdocs.documentationURL).toBe(
    'https://firefox-source-docs.mozilla.org/testing/perfdocs/',
  );
});

test('For framework browsertime the documentation url is correct', () => {
  const framework = 'browsertime';
  const suite = 'web-de';
  const platform = 'android';

  const perfdocs = new Perfdocs(framework, suite, platform);
  expect(perfdocs.documentationURL).toBe(
    'https://firefox-source-docs.mozilla.org/testing/perfdocs/raptor.html#web-de-m',
  );
});

test('For framework devtools the documentation url is correct', () => {
  const framework = 'devtools';
  const suite = 'damp';

  const perfdocs = new Perfdocs(framework, suite);
  expect(perfdocs.documentationURL).toBe(
    'https://firefox-source-docs.mozilla.org/devtools/tests/performance-tests-overview.html#damp',
  );
});

test("Framework browsertime doesn't have documentation on Tests View", () => {
  const framework = 'browsertime';
  const suite = 'someSuite';

  const perfdocs = new Perfdocs(framework, suite);
  expect(perfdocs.hasDocumentation('testsView')).toBeFalsy();
});

test('Framework browsertime has documentation on Alerts View', () => {
  const framework = 'browsertime';
  const suite = 'someSuite';

  const perfdocs = new Perfdocs(framework, suite);
  expect(perfdocs.hasDocumentation('alertsView')).toBeTruthy();
});

test("Some DevTools tests were removed/renamed and don't have documentation", () => {
  const framework = 'devtools';
  const suite = removedOldTestsDevTools[0];

  const perfdocs = new Perfdocs(framework, suite);
  expect(perfdocs.hasDocumentation()).toBeFalsy();
});

test("Some DevTools tests are not yet completed and don't have documentation", () => {
  const framework = 'devtools';
  const suite = nonDocumentedTestsDevTools[0];

  const perfdocs = new Perfdocs(framework, suite);
  expect(perfdocs.hasDocumentation()).toBeFalsy();
});

test('For framework browsertime, the mobile suffix (-m) is added correctly', () => {
  const framework = 'browsertime';
  const suite = 'amazon';
  const platform = 'android';

  const perfdocs = new Perfdocs(framework, suite, platform);
  expect(perfdocs.documentationURL).toBe(
    'https://firefox-source-docs.mozilla.org/testing/perfdocs/raptor.html#amazon-m',
  );
});

test('For framework browsertime, the benchmark suffix (-b) is added correctly', () => {
  const framework = 'browsertime';
  const suite = 'speedometer';

  const perfdocs = new Perfdocs(framework, suite);
  expect(perfdocs.documentationURL).toBe(
    'https://firefox-source-docs.mozilla.org/testing/perfdocs/raptor.html#speedometer-b',
  );
});

test('For framework browsertime, the custom suffix (-c) is added correctly', () => {
  const framework = 'browsertime';
  const suite = 'process-switch';

  const perfdocs = new Perfdocs(framework, suite);
  expect(perfdocs.documentationURL).toBe(
    'https://firefox-source-docs.mozilla.org/testing/perfdocs/raptor.html#process-switch-c',
  );
});

test('For framework browsertime, the interactive suffix (-i) is added correctly', () => {
  const framework = 'browsertime';
  const suite = 'cnn-nav';

  const perfdocs = new Perfdocs(framework, suite);
  expect(perfdocs.documentationURL).toBe(
    'https://firefox-source-docs.mozilla.org/testing/perfdocs/raptor.html#cnn-nav-i',
  );
});

test('For framework browsertime, the default desktop suffix (-d) is added correctly', () => {
  const framework = 'browsertime';
  const suite = 'amazon';
  const platform = 'windows11-64-24h2-shippable';

  const perfdocs = new Perfdocs(framework, suite, platform);
  expect(perfdocs.documentationURL).toBe(
    'https://firefox-source-docs.mozilla.org/testing/perfdocs/raptor.html#amazon-d',
  );
});

test('For framework browsertime, a dotted suite name is handled correctly', () => {
  const framework = 'browsertime';
  const suite = 'reddit-billgates-ama.members';

  const perfdocs = new Perfdocs(framework, suite);
  expect(perfdocs.documentationURL).toBe(
    'https://firefox-source-docs.mozilla.org/testing/perfdocs/raptor.html#reddit-billgates-ama-i',
  );
});

test('For framework browsertime, a suite name with uppercase letters is converted to lowercase', () => {
  const framework = 'browsertime';
  const suite = 'addkARN';

  const perfdocs = new Perfdocs(framework, suite);
  expect(perfdocs.documentationURL).toBe(
    'https://firefox-source-docs.mozilla.org/testing/perfdocs/raptor.html#addkarn-c',
  );
});

test('For framework talos, underscores in the suite name are replaced with dashes', () => {
  const framework = 'talos';
  const suite = 'about_newtab_with_snippets';

  const perfdocs = new Perfdocs(framework, suite);
  expect(perfdocs.documentationURL).toBe(
    'https://firefox-source-docs.mozilla.org/testing/perfdocs/talos.html#about-newtab-with-snippets',
  );
});
