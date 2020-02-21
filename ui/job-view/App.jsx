import React from 'react';
import { Modal } from 'reactstrap';
import { hot } from 'react-hot-loader/root';
import SplitPane from 'react-split-pane';
import pick from 'lodash/pick';
import isEqual from 'lodash/isEqual';
import { Provider } from 'react-redux';

import { thFavicons, thEvents } from '../helpers/constants';
import ShortcutTable from '../shared/ShortcutTable';
import { hasUrlFilterChanges, matchesDefaults } from '../helpers/filter';
import { getAllUrlParams, getRepo } from '../helpers/location';
import { MAX_TRANSIENT_AGE } from '../helpers/notifications';
import { deployedRevisionUrl } from '../helpers/url';
import ClassificationTypeModel from '../models/classificationType';
import FilterModel from '../models/filter';
import RepositoryModel from '../models/repository';

import Notifications from './Notifications';
import PrimaryNavBar from './headerbars/PrimaryNavBar';
import ActiveFilters from './headerbars/ActiveFilters';
import UpdateAvailable from './headerbars/UpdateAvailable';
import { PUSH_HEALTH_VISIBILITY } from './headerbars/HealthMenu';
import DetailsPanel from './details/DetailsPanel';
import PushList from './pushes/PushList';
import KeyboardShortcuts from './KeyboardShortcuts';
import { store } from './redux/store';
import { CLEAR_EXPIRED_TRANSIENTS } from './redux/stores/notifications';

const DEFAULT_DETAILS_PCT = 40;
const REVISION_POLL_INTERVAL = 1000 * 60 * 5;
const REVISION_POLL_DELAYED_INTERVAL = 1000 * 60 * 60;
const HIDDEN_URL_PARAMS = [
  'repo',
  'classifiedState',
  'resultStatus',
  'selectedJob',
  'searchStr',
  'collapsedPushes',
];

const getWindowHeight = function getWindowHeight() {
  const windowHeight = window.innerHeight;
  const navBar = document.getElementById('th-global-navbar');
  const navBarHeight = navBar ? navBar.clientHeight : 0;

  return windowHeight - navBarHeight;
};

class App extends React.Component {
  constructor(props) {
    super(props);

    const filterModel = new FilterModel();
    // Set the URL to updated parameter styles, if needed.  Otherwise it's a no-op.
    filterModel.push();
    const urlParams = getAllUrlParams();
    const hasSelectedJob = urlParams.has('selectedJob');

    this.state = {
      repoName: getRepo(),
      revision: urlParams.get('revision'),
      user: { isLoggedIn: false, isStaff: false },
      filterModel,
      isFieldFilterVisible: false,
      serverChangedDelayed: false,
      serverChanged: false,
      repos: [],
      currentRepo: null,
      classificationTypes: [],
      classificationMap: {},
      hasSelectedJob,
      groupCountsExpanded: urlParams.get('group_state') === 'expanded',
      duplicateJobsVisible: urlParams.get('duplicate_jobs') === 'visible',
      showShortCuts: false,
      pushHealthVisibility:
        localStorage.getItem(PUSH_HEALTH_VISIBILITY) || 'Try',
    };
  }

  static getDerivedStateFromProps(props, state) {
    return {
      ...App.getSplitterDimensions(state.hasSelectedJob),
      repoName: getRepo(),
    };
  }

  componentDidMount() {
    const { repoName } = this.state;

    RepositoryModel.getList().then(repos => {
      const newRepo = repos.find(repo => repo.name === repoName);

      this.setState({ currentRepo: newRepo, repos });
    });

    ClassificationTypeModel.getList().then(classificationTypes => {
      this.setState({
        classificationTypes,
        classificationMap: ClassificationTypeModel.getMap(classificationTypes),
      });
    });

    window.addEventListener('resize', this.updateDimensions, false);
    window.addEventListener('hashchange', this.handleUrlChanges, false);
    window.addEventListener('storage', this.handleStorageEvent);
    window.addEventListener(thEvents.filtersUpdated, this.handleFiltersUpdated);

    // Get the current Treeherder revision and poll to notify on updates.
    this.fetchDeployedRevision().then(revision => {
      this.setState({ serverRev: revision });
      this.updateInterval = setInterval(() => {
        this.fetchDeployedRevision().then(revision => {
          const {
            serverChangedTimestamp,
            serverRev,
            serverChanged,
          } = this.state;

          if (serverChanged) {
            if (
              Date.now() - serverChangedTimestamp >
              REVISION_POLL_DELAYED_INTERVAL
            ) {
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
              this.setState({
                serverChangedTimestamp: Date.now(),
                serverChanged: true,
              });
            }
          }
        });
      }, REVISION_POLL_INTERVAL);
    });

    // clear expired notifications
    this.notificationInterval = setInterval(() => {
      store.dispatch({ type: CLEAR_EXPIRED_TRANSIENTS });
    }, MAX_TRANSIENT_AGE);
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.updateDimensions, false);
    window.removeEventListener('hashchange', this.handleUrlChanges, false);
    window.removeEventListener('storage', this.handleUrlChanges, false);

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
  }

  static getSplitterDimensions(hasSelectedJob) {
    const defaultPushListPct = hasSelectedJob ? 100 - DEFAULT_DETAILS_PCT : 100;
    // calculate the height of the details panel to use if it has not been
    // resized by the user.
    const defaultDetailsHeight =
      defaultPushListPct < 100
        ? (DEFAULT_DETAILS_PCT / 100) * getWindowHeight()
        : 0;

    return {
      defaultPushListPct,
      defaultDetailsHeight,
    };
  }

  handleStorageEvent = e => {
    if (e.key === PUSH_HEALTH_VISIBILITY) {
      this.setState({
        pushHealthVisibility: localStorage.getItem(PUSH_HEALTH_VISIBILITY),
      });
    }
  };

  setPushHealthVisibility = visibility => {
    localStorage.setItem(PUSH_HEALTH_VISIBILITY, visibility);
    this.setState({ pushHealthVisibility: visibility });
  };

  setUser = user => {
    this.setState({ user });
  };

  setCurrentRepoTreeStatus = status => {
    const link = document.head.querySelector('link[rel="shortcut icon"]');

    if (link) {
      link.href = thFavicons[status] || thFavicons.open;
    }
  };

  getAllShownJobs = pushId => {
    const {
      pushes: { jobMap },
    } = store.getState();
    const jobList = Object.values(jobMap);

    return pushId
      ? jobList.filter(job => job.push_id === pushId && job.visible)
      : jobList.filter(job => job.visible);
  };

  toggleFieldFilterVisible = () => {
    this.setState(prevState => ({
      isFieldFilterVisible: !prevState.isFieldFilterVisible,
    }));
  };

  updateDimensions = () => {
    this.setState(prevState =>
      App.getSplitterDimensions(prevState.hasSelectedJob),
    );
  };

  handleUrlChanges = ev => {
    const { repos } = this.state;
    const { newURL, oldURL } = ev;
    const urlParams = getAllUrlParams();
    const newRepo = urlParams.get('repo');
    // We only want to set state if any of these or the filter values have changed
    const newState = {
      hasSelectedJob: getAllUrlParams().has('selectedJob'),
      groupCountsExpanded: urlParams.get('group_state') === 'expanded',
      duplicateJobsVisible: urlParams.get('duplicate_jobs') === 'visible',
      currentRepo: repos.find(repo => repo.name === newRepo),
    };
    const oldState = pick(this.state, Object.keys(newState));

    // Only re-create the FilterModel if url params that affect it have changed.
    if (hasUrlFilterChanges(oldURL, newURL)) {
      this.setState({ filterModel: new FilterModel() });
    }
    if (!isEqual(newState, oldState)) {
      this.setState(newState);
    }
  };

  handleFiltersUpdated = () => {
    this.setState({ filterModel: new FilterModel() });
  };

  // If ``show`` is a boolean, then set to that value.  If it's not, then toggle
  showOnScreenShortcuts = show => {
    const { showShortCuts } = this.state;
    const newValue = typeof show === 'boolean' ? show : !showShortCuts;

    this.setState({ showShortCuts: newValue });
  };

  fetchDeployedRevision() {
    return fetch(deployedRevisionUrl).then(resp => resp.text());
  }

  updateButtonClick() {
    window.location.reload(true);
  }

  handleSplitChange(latestSplitSize) {
    this.setState({
      latestSplitPct: (latestSplitSize / getWindowHeight()) * 100,
    });
  }

  render() {
    const {
      user,
      isFieldFilterVisible,
      serverChangedDelayed,
      defaultPushListPct,
      defaultDetailsHeight,
      latestSplitPct,
      serverChanged,
      currentRepo,
      repoName,
      repos,
      classificationTypes,
      classificationMap,
      filterModel,
      hasSelectedJob,
      revision,
      duplicateJobsVisible,
      groupCountsExpanded,
      showShortCuts,
      pushHealthVisibility,
    } = this.state;

    // SplitPane will adjust the CSS height of the top component, but not the
    // bottom component.  So the scrollbars won't work in the DetailsPanel when
    // we resize.  Therefore, we must calculate the new
    // height of the DetailsPanel based on the current height of the PushList.
    // Reported this upstream: https://github.com/tomkp/react-split-pane/issues/282
    const pushListPct =
      latestSplitPct === undefined || !hasSelectedJob
        ? defaultPushListPct
        : latestSplitPct;
    const detailsHeight =
      latestSplitPct === undefined || !hasSelectedJob
        ? defaultDetailsHeight
        : getWindowHeight() * (1 - latestSplitPct / 100);
    const filterBarFilters = Object.entries(filterModel.urlParams).reduce(
      (acc, [field, value]) =>
        HIDDEN_URL_PARAMS.includes(field) || matchesDefaults(field, value)
          ? acc
          : [...acc, { field, value }],
      [],
    );

    return (
      <div id="global-container" className="height-minus-navbars">
        <Provider store={store}>
          <KeyboardShortcuts
            filterModel={filterModel}
            showOnScreenShortcuts={this.showOnScreenShortcuts}
          >
            <PrimaryNavBar
              repos={repos}
              updateButtonClick={this.updateButtonClick}
              serverChanged={serverChanged}
              filterModel={filterModel}
              setUser={this.setUser}
              user={user}
              setCurrentRepoTreeStatus={this.setCurrentRepoTreeStatus}
              getAllShownJobs={this.getAllShownJobs}
              duplicateJobsVisible={duplicateJobsVisible}
              groupCountsExpanded={groupCountsExpanded}
              toggleFieldFilterVisible={this.toggleFieldFilterVisible}
              pushHealthVisibility={pushHealthVisibility}
              setPushHealthVisibility={this.setPushHealthVisibility}
            />
            <SplitPane
              split="horizontal"
              size={`${pushListPct}%`}
              onChange={size => this.handleSplitChange(size)}
            >
              <div className="d-flex flex-column w-100">
                {(isFieldFilterVisible || !!filterBarFilters.length) && (
                  <ActiveFilters
                    classificationTypes={classificationTypes}
                    filterModel={filterModel}
                    filterBarFilters={filterBarFilters}
                    isFieldFilterVisible={isFieldFilterVisible}
                    toggleFieldFilterVisible={this.toggleFieldFilterVisible}
                  />
                )}
                {serverChangedDelayed && (
                  <UpdateAvailable updateButtonClick={this.updateButtonClick} />
                )}
                {currentRepo && (
                  <div id="th-global-content" className="th-global-content">
                    <span className="th-view-content" tabIndex={-1}>
                      <PushList
                        user={user}
                        repoName={repoName}
                        revision={revision}
                        currentRepo={currentRepo}
                        filterModel={filterModel}
                        duplicateJobsVisible={duplicateJobsVisible}
                        groupCountsExpanded={groupCountsExpanded}
                        pushHealthVisibility={pushHealthVisibility}
                        getAllShownJobs={this.getAllShownJobs}
                      />
                    </span>
                  </div>
                )}
              </div>
              <>
                {currentRepo && (
                  <DetailsPanel
                    resizedHeight={detailsHeight}
                    currentRepo={currentRepo}
                    user={user}
                    classificationTypes={classificationTypes}
                    classificationMap={classificationMap}
                  />
                )}
              </>
            </SplitPane>
            <Notifications />
            <Modal
              isOpen={showShortCuts}
              toggle={() => this.showOnScreenShortcuts(false)}
              id="onscreen-shortcuts"
            >
              <ShortcutTable />
            </Modal>
          </KeyboardShortcuts>
        </Provider>
      </div>
    );
  }
}

export default hot(App);
