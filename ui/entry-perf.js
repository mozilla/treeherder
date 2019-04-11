// Webpack entry point for perf.html

// Vendor Styles
import 'angular/angular-csp.css';
import 'bootstrap/dist/css/bootstrap.min.css';

// Vendor JS
import 'bootstrap';
import { library, dom, config } from '@fortawesome/fontawesome-svg-core';
import {
  faArrowAltCircleRight,
  faClock,
  faFileCode,
  faFileWord,
  faStar as faStarRegular,
} from '@fortawesome/free-regular-svg-icons';
import {
  faAngleDoubleLeft,
  faAngleDoubleRight,
  faBan,
  faBug,
  faCheck,
  faChevronLeft,
  faChevronRight,
  faCode,
  faExclamationCircle,
  faExclamationTriangle,
  faLevelDownAlt,
  faPlus,
  faQuestionCircle,
  faSpinner,
  faStar as faStarSolid,
  faUser,
} from '@fortawesome/free-solid-svg-icons';
import { faGithub } from '@fortawesome/free-brands-svg-icons';

// The official 'flot' NPM package is out of date, so we're using 'jquery.flot'
// instead, which is identical to https://github.com/flot/flot
import 'jquery.flot';
import 'jquery.flot/jquery.flot.time';
import 'jquery.flot/jquery.flot.selection';

// Perf Styles
import './css/treeherder-global.css';
import './css/treeherder-navbar.css';
import './css/perf.css';
import './css/treeherder-loading-overlay.css';

// Bootstrap the Angular modules against which everything will be registered
import './js/perf';

// Perf JS
import './js/filters';
import './js/controllers/perf/graphs';
import './js/controllers/perf/alerts';
import './js/components/loading';
import './js/perfapp';
import './perfherder/compare/CompareSelectorView';
import './perfherder/compare/CompareView';
import './perfherder/compare/CompareSubtestDistributionView';
import './perfherder/compare/CompareSubtestsView';
import './perfherder/alerts/AlertTable';
import './perfherder/alerts/AlertsView';

config.showMissingIcons = true;

// TODO: Remove these as Perfherder components switch to using react-fontawesome.
library.add(
  faAngleDoubleLeft,
  faAngleDoubleRight,
  faArrowAltCircleRight,
  faBan,
  faBug,
  faCheck,
  faChevronLeft,
  faChevronRight,
  faClock,
  faCode,
  faExclamationCircle,
  faExclamationTriangle,
  faFileCode,
  faFileWord,
  faGithub,
  faLevelDownAlt,
  faPlus,
  faQuestionCircle,
  faSpinner,
  faStarRegular,
  faStarSolid,
  faUser,
);

// Replace any existing <i> or <span> tags with <svg> and set up a MutationObserver
// to continue doing this as the DOM changes. Remove once using react-fontawesome.
dom.watch();
