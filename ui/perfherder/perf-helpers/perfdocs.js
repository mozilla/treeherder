import {
  getStatus,
  getGraphsURL,
  modifyAlert,
  formatNumber,
  getFrameworkName,
  getTalosTestTitle,
  getSplitTestTitle,
} from './perf-helpers/helpers';

// const constant1 = 33,
//       constant2 = 2;
// class Example {
//
//   static get constant1() {
//     return constant1;
//   }
//
//   static get constant2() {
//     return constant2;
//   }
// }

const testDocumentationFrameworks = ['talos', 'awsy', 'browsertime'];

const perfdocsFrameworkName = {
  talos: 'talos',
  awsy: 'awsy',
  browsertime: 'raptor',
};

class Perfdocs {
  /**
   * Short description.
   */
  constructor(framework, platform, suite) {
    this.height = height;
    this.width = width;
  }

  // testDocumentationFrameworks

  // TODO: use static where possible
  // TODO: check what every view needs
  // Getter
  get splitTestTitle() {
    return bla;
  }

  get documentationURL() {}

  get markdownSuiteName() {}

  // Method
  hasDocumentation() {
    return true;
  }
}
