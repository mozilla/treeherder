import { Perfdocs } from '../../../ui/perfherder/perf-helpers/perfdocs';

test('Passing undefined to the Perfdocs constructor does not result in exception', () => {
  const framework = undefined;
  const suite = undefined;
  const platform = undefined;
  const title = undefined;

  const perfdocs = new Perfdocs(framework, suite, platform, title);
  expect(perfdocs.documentationURL).toEqual(
    'https://firefox-source-docs.mozilla.org/testing/perfdocs/',
  );
  expect(perfdocs.framework).toEqual('');
  expect(perfdocs.suite).toEqual('');
  expect(perfdocs.platform).toEqual('');
  expect(perfdocs.title).toEqual('');
  expect(perfdocs.remainingName).toEqual('');
  expect(perfdocs.hasDocumentation()).toBeFalsy();
});

test('Passing null to the Perfdocs constructor does not result in exception', () => {
  const framework = null;
  const suite = null;
  const platform = null;
  const title = null;

  const perfdocs = new Perfdocs(framework, suite, platform, title);
  expect(perfdocs.documentationURL).toEqual(
    'https://firefox-source-docs.mozilla.org/testing/perfdocs/',
  );
  expect(perfdocs.framework).toEqual('');
  expect(perfdocs.suite).toEqual('');
  expect(perfdocs.platform).toEqual('');
  expect(perfdocs.title).toEqual('');
  expect(perfdocs.remainingName).toEqual('');
  expect(perfdocs.hasDocumentation()).toBeFalsy();
});

test('If the framework is unknown the documentation url resulted is a general one', () => {
  const framework = 'someFrameworkName';
  const suite = 'someSuite';

  const perfdocs = new Perfdocs(framework, suite);
  expect(perfdocs.documentationURL).toEqual(
    'https://firefox-source-docs.mozilla.org/testing/perfdocs/',
  );
});

test('For framework browsertime the documentation url is correct', () => {
  const framework = 'browsertime';
  const suite = 'web-de';
  const platform = 'android';

  const perfdocs = new Perfdocs(framework, suite, platform);
  expect(perfdocs.documentationURL).toEqual(
    'https://firefox-source-docs.mozilla.org/testing/perfdocs/raptor.html#web-de-m',
  );
});

test('For framework devtools the documentation url is correct', () => {
  const framework = 'devtools';
  const suite = 'damp';

  const perfdocs = new Perfdocs(framework, suite);
  expect(perfdocs.documentationURL).toEqual(
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
