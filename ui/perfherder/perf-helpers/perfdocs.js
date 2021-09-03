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
 * @link https://firefox-source-docs.mozilla.org/testing/perfdocs/raptor.html#benchmarks
 */
const browsertimeBenchmarks = [
  'ares6',
  'assorted-dom',
  'jetstream2',
  'motionmark-animometer',
  'motionmark-htmlsuite',
  'raptor-speedometer-geckoview',
  'raptor-youtube-playback-av1-sfr-chrome',
  'raptor-youtube-playback-av1-sfr-fenix',
  'raptor-youtube-playback-av1-sfr-firefox',
  'raptor-youtube-playback-av1-sfr-geckoview',
  'raptor-youtube-playback-h264-1080p30-firefox',
  'raptor-youtube-playback-h264-1080p60-firefox',
  'raptor-youtube-playback-h264-full-1080p30-firefox',
  'raptor-youtube-playback-h264-full-1080p60-firefox',
  'raptor-youtube-playback-h264-sfr-chrome',
  'raptor-youtube-playback-h264-sfr-fenix',
  'raptor-youtube-playback-h264-sfr-firefox',
  'raptor-youtube-playback-h264-sfr-geckoview',
  'raptor-youtube-playback-hfr-chrome',
  'raptor-youtube-playback-hfr-fenix',
  'raptor-youtube-playback-hfr-firefox',
  'raptor-youtube-playback-hfr-geckoview',
  'raptor-youtube-playback-v9-1080p30-firefox',
  'raptor-youtube-playback-v9-1080p60-firefox',
  'raptor-youtube-playback-v9-full-1080p30-firefox',
  'raptor-youtube-playback-v9-full-1080p60-firefox',
  'raptor-youtube-playback-vp9-sfr-chrome',
  'raptor-youtube-playback-vp9-sfr-fenix',
  'raptor-youtube-playback-vp9-sfr-firefox',
  'raptor-youtube-playback-vp9-sfr-geckoview',
  'raptor-youtube-playback-widevine-h264-sfr-chrome',
  'raptor-youtube-playback-widevine-h264-sfr-fenix',
  'raptor-youtube-playback-widevine-h264-sfr-firefox',
  'raptor-youtube-playback-widevine-h264-sfr-geckoview',
  'raptor-youtube-playback-widevine-hfr-chrome',
  'raptor-youtube-playback-widevine-hfr-fenix',
  'raptor-youtube-playback-widevine-hfr-firefox',
  'raptor-youtube-playback-widevine-hfr-geckoview',
  'raptor-youtube-playback-widevine-vp9-sfr-chrome',
  'raptor-youtube-playback-widevine-vp9-sfr-fenix',
  'raptor-youtube-playback-widevine-vp9-sfr-firefox',
  'raptor-youtube-playback-widevine-vp9-sfr-geckoview',
  'speedometer',
  'stylebench',
  'sunspider',
  'unity-webgl',
  'wasm-godot',
  'wasm-godotaseline',
  'wasm-godot-optimizing',
  'wasm-misc',
  'wasm-miscaseline',
  'wasm-misc-optimizing',
  'webaudio',
  'youtube-playback',
  'youtube-playback-av1-sfr',
  'youtube-playback-h264-1080p30',
  'youtube-playback-h264-1080p60',
  'youtube-playback-h264-full-1080p30',
  'youtube-playback-h264-full-1080p60',
  'youtube-playback-h264-sfr',
  'youtube-playback-hfr',
  'youtube-playback-v9-1080p30',
  'youtube-playback-v9-1080p60',
  'youtube-playback-v9-full-1080p30',
  'youtube-playback-v9-full-1080p60',
  'youtube-playback-vp9-sfr',
  'youtube-playback-widevine-h264-sfr',
  'youtube-playback-widevine-hfr',
  'youtube-playback-widevine-hfr',
];

/**
 * TODO: remove hardcoded names once suffixes are removed from Perfdocs
 * @link https://firefox-source-docs.mozilla.org/testing/perfdocs/raptor.html#custom
 */
const browsertimeCustomTests = ['process-switch', 'welcome'];

const baseURL = 'https://firefox-source-docs.mozilla.org/';

export class Perfdocs {
  /**
   * Class that provides a link where possible with
   * detailed information about each test suite.
   */
  constructor(framework, suite, platform = null, title = null) {
    this.framework = framework;
    this.suite = suite || '';
    this.platform = platform;
    this.title = title || '';
    this.url = null;
    this.remainingTestName = null;
  }

  get remainingName() {
    if (!this.remainingTestName) {
      this.remainingTestName = this.title.replace(this.suite, '');
    }
    return this.remainingTestName;
  }

  get documentationURL() {
    if (!this.url) {
      const frameworkName = supportedPerfdocsFrameworks[this.framework];
      this.url =
        frameworkName !== 'performance-tests-overview'
          ? baseURL.concat('testing/perfdocs/')
          : baseURL.concat('devtools/tests/');

      this.url = this.url.concat(
        frameworkName,
        '.html#',
        this.suite.replace(/_|\s|\./g, '-').toLowerCase(),
      );
      if (this.framework === 'browsertime') {
        if (browsertimeBenchmarks.includes(this.suite)) {
          this.url = this.url.concat('-b');
        } else if (browsertimeCustomTests.includes(this.suite)) {
          this.url = this.url.concat('-c');
        } else if (this.platform.includes('android')) {
          this.url = this.url.concat('-m');
        } else this.url = this.url.concat('-d');
      }
    }
    return this.url;
  }

  hasDocumentation(perfherderView = null) {
    if (
      this.framework === 'browsertime' &&
      browsertimeDocsUnavailableViews.includes(perfherderView)
    ) {
      return false;
    }
    return testDocumentationFrameworks.includes(this.framework);
  }
}
