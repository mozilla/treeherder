import React from 'react';
import PropTypes from 'prop-types';
import { react2angular } from 'react2angular/index.es2015';
import SplitPane from 'react-split-pane';
import { createBrowserHistory } from 'history';

import treeherder from '../js/treeherder';
import { thEvents } from '../js/constants';
import { getRevisionTxtUrl } from '../helpers/url';
import DetailsPanel from './details/DetailsPanel';
import ActiveFilters from './headerbars/ActiveFilters';
import UpdateAvailable from './headerbars/UpdateAvailable';
import PushList from './PushList';

const DEFAULT_DETAILS_PCT = 40;
const REVISION_POLL_INTERVAL = 1000 * 60 * 5;
const REVISION_POLL_DELAYED_INTERVAL = 1000 * 60 * 60;

const getWindowHeight = function () {
  const windowHeight = window.innerHeight;
  const navBar = document.getElementById('th-global-navbar');
  const navBarHeight = navBar ? navBar.clientHeight : 0;

  return windowHeight - navBarHeight;
};

class JobView extends React.Component {
  static getDerivedStateFromProps(props) {
    return JobView.getSplitterDimensions(props);
  }

  static getSplitterDimensions(props) {
    const { selectedJob } = props;
    const defaultPushListPct = selectedJob ? 100 - DEFAULT_DETAILS_PCT : 100;
    // calculate the height of the details panel to use if it has not been
    // resized by the user.
    const defaultDetailsHeight = defaultPushListPct < 100 ?
      DEFAULT_DETAILS_PCT / 100 * getWindowHeight() : 0;

    return {
      defaultPushListPct,
      defaultDetailsHeight,
    };
  }

  constructor(props) {
    super(props);

    const { $injector } = this.props;
    this.thJobFilters = $injector.get('thJobFilters');
    this.$rootScope = $injector.get('$rootScope');

    this.history = createBrowserHistory();

    this.state = {
      isFieldFilterVisible: false,
      filterBarFilters: [
       ...this.thJobFilters.getNonFieldFiltersArray(),
       ...this.thJobFilters.getFieldFiltersArray(),
      ],
      pushListPct: props.selectedJob ? 100 - DEFAULT_DETAILS_PCT : 100,
      serverChangedDelayed: false,
    };
  }

  componentDidMount() {
    this.toggleFieldFilterVisible = this.toggleFieldFilterVisible.bind(this);
    this.updateDimensions = this.updateDimensions.bind(this);

    window.addEventListener('resize', this.updateDimensions);

    this.$rootScope.$on(thEvents.toggleFieldFilterVisible, () => {
      this.toggleFieldFilterVisible();
    });

    this.history.listen(() => {
      this.setState({
        filterBarFilters: [
         ...this.thJobFilters.getNonFieldFiltersArray(),
         ...this.thJobFilters.getFieldFiltersArray(),
        ],
      });
    });

    // Only set up the revision polling interval if revision.txt exists on page load
    this.checkServerRevision().then((revision) => {
      this.setState({ serverRev: revision });
      this.updateInterval = setInterval(() => {
        this.checkServerRevision()
          .then((revision) => {
            const { serverChangedTimestamp, serverRev } = this.state;
            if (this.$rootScope.serverChanged) {
              if (Date.now() - serverChangedTimestamp > REVISION_POLL_DELAYED_INTERVAL) {
                this.setState({ serverChangedDelayed: true });
                // Now that we know there's an update, stop polling.
                clearInterval(this.updateInterval);
              }
            }
            // This request returns the treeherder git revision running on the server
            // If this differs from the version chosen during the UI page load, show a warning
            // Update $rootScope.serverChanged so that the subdued notification
            // can be shown on the secondary navbar.

            // TODO: Change this to a state/prop var when that secondary bar is
            // converted to React.
            if (serverRev && serverRev !== revision) {
              this.setState({ serverRev: revision });
              if (this.$rootScope.serverChanged === false) {
                this.$rootScope.serverChanged = true;
                this.$rootScope.$apply();
                this.setState({ serverChangedTimestamp: Date.now() });
              }
            }
          })
          .catch((error) => {
            console.error(error); // eslint-disable-line no-console
          });
      }, REVISION_POLL_INTERVAL);
    });
  }

  updateButtonClick() {
    if (window.confirm('Reload the page to pick up Treeherder updates?')) {
      window.location.reload(true);
    }
  }

  toggleFieldFilterVisible() {
    this.setState({ isFieldFilterVisible: !this.state.isFieldFilterVisible });
  }

  updateDimensions() {
    this.setState(JobView.getSplitterDimensions(this.props));
  }

  handleSplitChange(latestSplitSize) {
    this.setState({
      latestSplitPct: latestSplitSize / getWindowHeight() * 100,
    });
  }

  checkServerRevision() {
    return fetch(getRevisionTxtUrl()).then((resp) => {
      if (!resp.ok) {
        throw Error(`Error loading revision.txt: ${resp.statusText}`);
      }
      return resp.text();
    });
  }

  render() {
    const {
      user, repoName, revision, currentRepo, selectedJob, $injector,
    } = this.props;
    const {
      isFieldFilterVisible, filterBarFilters, serverChangedDelayed,
      defaultPushListPct, defaultDetailsHeight, latestSplitPct,
    } = this.state;
    // SplitPane will adjust the CSS height of the top component, but not the
    // bottom component.  So the scrollbars won't work in the DetailsPanel when
    // we resize.  Therefore, we must calculate the new
    // height of the DetailsPanel based on the current height of the PushList.
    // Reported this upstream: https://github.com/tomkp/react-split-pane/issues/282
    const pushListPct = latestSplitPct === undefined || !selectedJob ?
      defaultPushListPct :
      latestSplitPct;
    const detailsHeight = latestSplitPct === undefined || !selectedJob ?
      defaultDetailsHeight :
      getWindowHeight() * (1 - latestSplitPct / 100);

    return (
      <SplitPane
        split="horizontal"
        size={`${pushListPct}%`}
        onDragFinished={size => this.handleSplitChange(size)}
      >
        <div className="d-flex flex-column w-100">
          {(isFieldFilterVisible || !!filterBarFilters.length) && <ActiveFilters
            $injector={$injector}
            filterBarFilters={filterBarFilters}
            history={this.history}
            isFieldFilterVisible={isFieldFilterVisible}
            toggleFieldFilterVisible={this.toggleFieldFilterVisible}
          />}
          {serverChangedDelayed && <UpdateAvailable
            updateButtonClick={this.updateButtonClick}
          />}
          <div id="th-global-content" className="th-global-content">
            <span className="th-view-content">
              <PushList
                user={user}
                repoName={repoName}
                revision={revision}
                currentRepo={currentRepo}
                $injector={$injector}
              />
            </span>
          </div>
        </div>
        <DetailsPanel
          resizedHeight={detailsHeight}
          currentRepo={currentRepo}
          repoName={repoName}
          selectedJob={selectedJob}
          user={user}
          $injector={$injector}
        />
      </SplitPane>
    );
  }
}

JobView.propTypes = {
  $injector: PropTypes.object.isRequired,
  user: PropTypes.object.isRequired,
  repoName: PropTypes.string.isRequired,
  revision: PropTypes.string,
  currentRepo: PropTypes.object,
  selectedJob: PropTypes.object,
};

// Sometime of these props are not ready by the time this renders, so
// need some defaults for them.
JobView.defaultProps = {
  revision: null,
  currentRepo: {},
  selectedJob: null,
};

treeherder.component('jobView', react2angular(
  JobView,
  ['repoName', 'user', 'revision', 'currentRepo', 'selectedJob'],
  ['$injector']));
