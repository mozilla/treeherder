import React from 'react';
import PropTypes from 'prop-types';
import { react2angular } from 'react2angular/index.es2015';
import SplitPane from 'react-split-pane';
import { createBrowserHistory } from 'history';

import treeherder from '../js/treeherder';
import { thEvents } from '../js/constants';
import { deployedRevisionUrl } from '../helpers/url';
import DetailsPanel from './details/DetailsPanel';
import ActiveFilters from './headerbars/ActiveFilters';
import UpdateAvailable from './headerbars/UpdateAvailable';
import PushList from './PushList';
import PrimaryNavBar from './headerbars/PrimaryNavBar';

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
  constructor(props) {
    super(props);

    const { $injector } = this.props;
    this.thJobFilters = $injector.get('thJobFilters');
    this.$rootScope = $injector.get('$rootScope');
    this.ThRepositoryModel = $injector.get('ThRepositoryModel');
    this.ThResultSetStore = $injector.get('ThResultSetStore');
    this.thNotify = $injector.get('thNotify');

    this.history = createBrowserHistory();

    this.state = {
      user: { isLoggedIn: false },
      isFieldFilterVisible: false,
      filterBarFilters: [
       ...this.thJobFilters.getNonFieldFiltersArray(),
       ...this.thJobFilters.getFieldFiltersArray(),
      ],
      pushListPct: props.selectedJob ? 100 - DEFAULT_DETAILS_PCT : 100,
      serverChangedDelayed: false,
      serverChanged: false,
    };
  }

  static getDerivedStateFromProps(props) {
    return JobView.getSplitterDimensions(props);
  }

  componentDidMount() {
    this.toggleFieldFilterVisible = this.toggleFieldFilterVisible.bind(this);
    this.updateDimensions = this.updateDimensions.bind(this);
    this.pinJobs = this.pinJobs.bind(this);

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
        serverChanged: false,
      });
    });

    // Get the current Treeherder revision and poll to notify on updates.
    this.fetchDeployedRevision().then((revision) => {
      this.setState({ serverRev: revision });
      this.updateInterval = setInterval(() => {
        this.fetchDeployedRevision()
          .then((revision) => {
            const { serverChangedTimestamp, serverRev, serverChanged } = this.state;

            if (serverChanged) {
              if (Date.now() - serverChangedTimestamp > REVISION_POLL_DELAYED_INTERVAL) {
                this.setState({ serverChangedDelayed: true });
                // Now that we know there's an update, stop polling.
                clearInterval(this.updateInterval);
              }
            }
            // This request returns the treeherder git revision running on the server
            // If this differs from the version chosen during the UI page load, show a warning
            if (serverRev && serverRev !== revision) {
              this.setState({ serverRev: revision });
              if (serverChanged === false) {
                this.setState({ serverChangedTimestamp: Date.now(), serverChanged: true });
              }
            }
          });
      }, REVISION_POLL_INTERVAL);
    });
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

  setUser(user) {
    this.setState({ user });
  }

  fetchDeployedRevision() {
    return fetch(deployedRevisionUrl).then(resp => resp.text());
  }

  updateButtonClick() {
    if (window.confirm('Reload the page to pick up Treeherder updates?')) {
      window.location.reload(true);
    }
  }

  toggleFieldFilterVisible() {
    this.setState({ isFieldFilterVisible: !this.state.isFieldFilterVisible });
  }

  pinJobs() {
    this.$rootScope.$emit(thEvents.pinJobs, this.ThResultSetStore.getAllShownJobs());
  }

  updateDimensions() {
    this.setState(JobView.getSplitterDimensions(this.props));
  }

  handleSplitChange(latestSplitSize) {
    this.setState({
      latestSplitPct: latestSplitSize / getWindowHeight() * 100,
    });
  }

  clearIfEligibleTarget(target) {
    if (target.hasAttribute('data-job-clear-on-click')) {
      this.$rootScope.$emit(thEvents.clearSelectedJob, target);
    }
  }

  render() {
    const {
      repoName, revision, currentRepo, selectedJob, $injector,
    } = this.props;
    const {
      user, isFieldFilterVisible, filterBarFilters, serverChangedDelayed,
      defaultPushListPct, defaultDetailsHeight, latestSplitPct, serverChanged,
    } = this.state;
    // TODO: Move this to the constructor.  We are hitting some issues where
    // this function is not yet bound, so we are not getting logged in, even
    // when the user IS logged in.  Placing this here ensures the we can't
    // render when this function is not bound.
    // See Bug 1480166
    this.setUser = this.setUser.bind(this);
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
      <React.Fragment>
        <PrimaryNavBar
          jobFilters={this.thJobFilters}
          groupedRepos={this.ThRepositoryModel.getOrderedRepoGroups()}
          updateButtonClick={this.updateButtonClick}
          pinJobs={this.pinJobs}
          serverChanged={serverChanged}
          history={this.history}
          setUser={this.setUser}
          user={user}
          $injector={$injector}
        />
        <SplitPane
          split="horizontal"
          size={`${pushListPct}%`}
          onChange={size => this.handleSplitChange(size)}
        >
          <div className="d-flex flex-column w-100" onClick={evt => this.clearIfEligibleTarget(evt.target)}>
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
            <div id="th-global-content" className="th-global-content" data-job-clear-on-click>
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
      </React.Fragment>
    );
  }
}

JobView.propTypes = {
  $injector: PropTypes.object.isRequired,
  repoName: PropTypes.string.isRequired,
  revision: PropTypes.string,
  currentRepo: PropTypes.object,
  selectedJob: PropTypes.object,
};

// Some of these props are not ready by the time this renders.
JobView.defaultProps = {
  revision: null,
  currentRepo: {},
  selectedJob: null,
};

treeherder.component('jobView', react2angular(
  JobView,
  ['repoName', 'revision', 'currentRepo', 'selectedJob'],
  ['$injector']));
