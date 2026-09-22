export const perfViews = {
  graphsView: 'graphsView',
  compareView: 'compareView',
  alertsView: 'alertView',
  testsView: 'testsView',
  fileBugMarkdown: 'fileBugMarkdown',
};

const testDocumentationFrameworks = [
  'talos',
  'awsy',
  'browsertime',
  'devtools',
];

const browsertimeDocsUnavailableViews = [
  perfViews.compareView,
  perfViews.testsView,
];

const supportedPerfdocsFrameworks = {
  talos: 'talos',
  awsy: 'awsy',
  browsertime: 'raptor',
  devtools: 'performance-tests-overview',
};

/**
 * TODO: remove hardcoded names once suffixes are removed from Perfdocs
 * @link https://firefox-source-docs.mozilla.org/testing/perfdocs/raptor.html#interactive
 */
const browsertimeInteractiveTests = ['-nav', 'reddit-billgates'];

/**
 * TODO: remove hardcoded names once suffixes are removed from Perfdocs
 * @link https://firefox-source-docs.mozilla.org/testing/perfdocs/raptor.html#benchmarks
 */
const browsertimeBenchmarkTests = [
  'speedometer',
  'youtube-playback',
  'wasm',
  'jetstream',
  'stylebench',
  'sunspider',
  'ares6',
  'webaudio',
  'assorted-dom',
  'motionmark',
  'media-capabilities',
  'twitch-animation',
  'unity-webgl',
  'matrix-react-bench',
];

/**
 * TODO: remove hardcoded names once suffixes are removed from Perfdocs
 * @link https://firefox-source-docs.mozilla.org/testing/perfdocs/raptor.html#custom
 */
const browsertimeCustomTests = [
  'process-switch',
  'welcome',
  'addkab',
  'addkar',
  'addkbl',
  'addmab',
  'addmar',
  'addmbl',
  'baseline',
  'browsertime',
  'connect',
  'constant-regression',
  'dns-',
  'getkeyrng',
  'h2-',
  'h3-',
  'he3',
  'idb',
  'media-seek',
  'mp-',
  'prefetch-',
  'sample-',
  'throttled',
  'tp6-',
  'trr-',
  'upload',
  've-',
  'vpl-',
];

export const removedOldTestsDevTools = [
  'total-after-gc',
  'reload-total-after-gc',
  'content-total-after-gc',
  'reload-content-total-after-gc',
  'toolbox-total-after-gc',
  'target-total-after-gc',
];

// TODO: remove these once the documentation for DevTools is complete
export const nonDocumentedTestsDevTools = [
  'reload-inspector:content-process',
  'reload-inspector:parent-process',
  'reload-debugger:content-process',
  'reload-debugger:parent-process',
  'reload-no-devtools:content-process',
  'reload-no-devtools:parent-process',
  'reload-netmonitor:content-process',
  'reload-netmonitor:parent-process',
  'reload-webconsole:parent-process',
  'reload-webconsole:content-process',
];

const baseURL = 'https://firefox-source-docs.mozilla.org/';

export class Perfdocs {
  /**
   * Class that provides a link where possible with
   * detailed information about each test suite.
   */
  constructor(framework, suite, platform = '', title = '') {
    this.framework = framework || '';
    this.suite = suite || '';
    this.platform = platform || '';
    this.title = title || '';
    this.remainingTestName = '';
    this.url = '';
  }

  get remainingName() {
    if (this.remainingTestName.length === 0) {
      this.remainingTestName = this.title.replace(this.suite, '');
    }
    return this.remainingTestName;
  }

  get documentationURL() {
    const frameworkName = supportedPerfdocsFrameworks[this.framework];
    if (!frameworkName) {
      this.url = baseURL.concat('testing/perfdocs/');
      return this.url;
    }
    this.url =
      frameworkName === 'performance-tests-overview'
        ? baseURL.concat('devtools/tests/')
        : baseURL.concat('testing/perfdocs/');

    this.url = this.url.concat(frameworkName, '.html#');

    if (frameworkName === 'raptor') {
      // amazon-sec doesn't have yet documentation added
      if (this.suite === 'amazon-sec') {
        this.url = this.url.slice(0, -1);
        return this.url;
      }
      this.url = this.updatedURLWithSuffix;
    } else {
      // framework is either awsy, talos or devtools
      if (this.suite === 'about_newtab_with_snippets') {
        // talos
        this.suite = 'about-newtab-with-snippets';
      }
      this.url = this.url.concat(
        this.suite.replace(/:|\s|\./g, '-').toLowerCase(),
      );
    }
    return this.url;
  }

  get updatedURLWithSuffix() {
    let suffixForSuite;
    const suiteNameBeforeDot = this.suite.split('.')[0].toLowerCase();

    const isInteractive = browsertimeInteractiveTests.some((keyword) =>
      suiteNameBeforeDot.includes(keyword),
    );
    const isBenchmark = browsertimeBenchmarkTests.some((keyword) =>
      suiteNameBeforeDot.includes(keyword),
    );
    const isCustom = browsertimeCustomTests.some((keyword) =>
      suiteNameBeforeDot.includes(keyword),
    );
    const isMobile = this.platform.includes('android');

    if (isInteractive) {
      this.url = this.url.concat(suiteNameBeforeDot);
      suffixForSuite = '-i';
    } else {
      this.url = this.url.concat(this.suite);
      if (isBenchmark) {
        suffixForSuite = '-b';
      } else if (isCustom) {
        suffixForSuite = '-c';
      } else if (isMobile) {
        suffixForSuite = '-m';
      } else suffixForSuite = '-d';
    }
    return this.url.concat(suffixForSuite);
  }

  hasDocumentation(perfherderView = null) {
    if (
      (this.framework === 'browsertime' &&
        browsertimeDocsUnavailableViews.includes(perfherderView)) ||
      removedOldTestsDevTools.includes(this.suite) ||
      nonDocumentedTestsDevTools.includes(this.suite)
    ) {
      return false;
    }

    return testDocumentationFrameworks.includes(this.framework);
  }
}
