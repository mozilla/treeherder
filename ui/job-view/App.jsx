import React from 'react';
import { Modal } from 'reactstrap';
import { hot } from 'react-hot-loader/root';
import SplitPane from 'react-split-pane';
import pick from 'lodash/pick';
import isEqual from 'lodash/isEqual';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { push as pushRoute } from 'connected-react-router';

import { thFavicons, thDefaultRepo, thEvents } from '../helpers/constants';
import ShortcutTable from '../shared/ShortcutTable';
import { matchesDefaults } from '../helpers/filter';
import { getAllUrlParams } from '../helpers/location';
import { MAX_TRANSIENT_AGE } from '../helpers/notifications';
import {
  deployedRevisionUrl,
  parseQueryParams,
  createQueryParams,
  getApiUrl,
  getLandoJobsUrl,
} from '../helpers/url';
import ClassificationTypeModel from '../models/classificationType';
import FilterModel from '../models/filter';
import RepositoryModel from '../models/repository';
import { getData } from '../helpers/http';
import { endpoints } from '../perfherder/perf-helpers/constants';

import Notifications from './Notifications';
import PrimaryNavBar from './headerbars/PrimaryNavBar';
import ActiveFilters from './headerbars/ActiveFilters';
import UpdateAvailable from './headerbars/UpdateAvailable';
import DetailsPanel from './details/DetailsPanel';
import PushList from './pushes/PushList';
import KeyboardShortcuts from './KeyboardShortcuts';
import { clearExpiredNotifications } from './redux/stores/notifications';
import { fetchPushes } from './redux/stores/pushes';

import '../css/treeherder.css';
import '../css/treeherder-navbar-panels.css';
import '../css/treeherder-notifications.css';
import '../css/treeherder-details-panel.css';
import '../css/failure-summary.css';
import '../css/treeherder-job-buttons.css';
import '../css/treeherder-pushes.css';
import '../css/treeherder-pinboard.css';
import '../css/treeherder-bugfiler.css';
import '../css/treeherder-fuzzyfinder.css';
import '../css/treeherder-loading-overlay.css';

const DEFAULT_DETAILS_PCT = 40;
const REVISION_POLL_INTERVAL = 1000 * 60 * 5;
const REVISION_POLL_DELAYED_INTERVAL = 1000 * 60 * 60;
const LANDO_POLL_INTERVAL = 1000 * 60;
const HIDDEN_URL_PARAMS = [
  'repo',
  'classifiedState',
  'resultStatus',
  'selectedTaskRun',
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

    const filterModel = new FilterModel(this.props);
    const urlParams = getAllUrlParams();
    const hasSelectedJob =
      urlParams.has('selectedJob') || urlParams.has('selectedTaskRun');

    this.state = {
      repoName: this.getOrSetRepo(),
      revision: urlParams.get('revision'),
      landoCommitID: urlParams.get('landoCommitID'),
      landoStatus: 'unknown',
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
      pushHealthVisibility: 'try',
    };
  }

  static getDerivedStateFromProps(props, state) {
    return {
      ...App.getSplitterDimensions(state.hasSelectedJob),
    };
  }

  async componentDidMount() {
    const { repoName, landoCommitID } = this.state;
    const { fetchPushes } = this.props;

    // Start all API requests in parallel - including pushes.
    getData(getApiUrl(endpoints.frameworks)).then((response) =>
      this.setState({ frameworks: response.data }),
    );

    RepositoryModel.getList().then((repos) => {
      const newRepo = repos.find((repo) => repo.name === repoName);
      this.setState({ currentRepo: newRepo, repos });
    });

    ClassificationTypeModel.getList().then((classificationTypes) => {
      this.setState({
        classificationTypes,
        classificationMap: ClassificationTypeModel.getMap(classificationTypes),
      });
    });

    // Start (pre)fetching pushes immediately. The PushList component needs
    // currentRepo but it is not needed to start the network request.
    fetchPushes();

    window.addEventListener('resize', this.updateDimensions, false);
    window.addEventListener('storage', this.handleStorageEvent);
    window.addEventListener(thEvents.filtersUpdated, this.handleFiltersUpdated);

    if (landoCommitID) {
      let revision = await this.setLandoRevision();
      if (!revision) {
        this.landoInterval = setInterval(async () => {
          revision = await this.setLandoRevision();
          if (revision) {
            clearInterval(this.landoInterval);
          }
        }, LANDO_POLL_INTERVAL);
      }
    }

    // Get the current Treeherder revision and poll to notify on updates.
    this.fetchDeployedRevision().then((revision) => {
      this.setState({ serverRev: revision });
      this.updateInterval = setInterval(() => {
        this.fetchDeployedRevision().then((revision) => {
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
      this.props.clearExpiredNotifications();
    }, MAX_TRANSIENT_AGE);
  }

  componentDidUpdate(prevProps) {
    if (
      prevProps.router.location.search !== this.props.router.location.search
    ) {
      this.handleUrlChanges();
    }
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.updateDimensions, false);
    window.removeEventListener('storage', this.handleStorageEvent);
    window.removeEventListener(
      thEvents.filtersUpdated,
      this.handleFiltersUpdated,
    );

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    if (this.landoInterval) {
      clearInterval(this.landoInterval);
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

  getOrSetRepo() {
    const { pushRoute } = this.props;
    const params = getAllUrlParams();
    let repo = params.get('repo');

    if (!repo) {
      repo = thDefaultRepo;
      params.set('repo', repo);
      pushRoute({
        search: createQueryParams(params),
      });
    }

    return repo;
  }

  async setLandoRevision() {
    const { pushRoute } = this.props;
    const params = getAllUrlParams();
    const landoCommitID = params.get('landoCommitID');

    const { data } = await getData(getLandoJobsUrl(landoCommitID));
    const revision = data.commit_id;

    if (revision) {
      this.setState({ revision });

      params.set('revision', revision);
      params.delete('landoCommitID');

      pushRoute({
        search: createQueryParams(params),
      });
    } else {
      const status = data.status ? data.status : 'unknown';
      this.setState({ landoStatus: status.toLowerCase() });
    }

    return revision;
  }

  handleFiltersUpdated = () => {
    // we're only using window.location here because of how we're setting param changes for fetchNextPushes
    // in PushList and addPushes.
    this.setState({
      filterModel: new FilterModel({
        router: window,
        pushRoute: this.props.pushRoute,
      }),
    });
  };

  setUser = (user) => {
    this.setState({ user });
  };

  setCurrentRepoTreeStatus = (status) => {
    const link = document.head.querySelector('link[rel="icon"]');

    if (link) {
      link.href = thFavicons[status] || thFavicons.open;
    }
  };

  getAllShownJobs = (pushId) => {
    const { jobMap } = this.props;
    const jobList = Object.values(jobMap);

    return pushId
      ? jobList.filter((job) => job.push_id === pushId && job.visible)
      : jobList.filter((job) => job.visible);
  };

  toggleFieldFilterVisible = () => {
    this.setState((prevState) => ({
      isFieldFilterVisible: !prevState.isFieldFilterVisible,
    }));
  };

  updateDimensions = () => {
    this.setState((prevState) =>
      App.getSplitterDimensions(prevState.hasSelectedJob),
    );
  };

  handleUrlChanges = () => {
    const { repos } = this.state;
    const { router } = this.props;

    const {
      selectedJob,
      selectedTaskRun,
      group_state: groupState,
      duplicate_jobs: duplicateJobs,
      repo: newRepo,
    } = parseQueryParams(router.location.search);

    const currentRepo = repos.find((repo) => repo.name === newRepo);
    const newState = {
      hasSelectedJob: selectedJob || selectedTaskRun,
      groupCountsExpanded: groupState === 'expanded',
      duplicateJobsVisible: duplicateJobs === 'visible',
      currentRepo,
      repoName: currentRepo ? currentRepo.name : thDefaultRepo,
    };

    const oldState = pick(this.state, Object.keys(newState));
    let stateChanges = { filterModel: new FilterModel(this.props) };

    if (!isEqual(newState, oldState)) {
      stateChanges = { ...stateChanges, ...newState };
    }

    this.setState(stateChanges);
  };

  // If ``show`` is a boolean, then set to that value.  If it's not, then toggle
  showOnScreenShortcuts = (show) => {
    const { showShortCuts } = this.state;
    const newValue = typeof show === 'boolean' ? show : !showShortCuts;

    this.setState({ showShortCuts: newValue });
  };

  fetchDeployedRevision() {
    return fetch(deployedRevisionUrl).then((resp) => resp.text());
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
      landoCommitID,
      landoStatus,
      duplicateJobsVisible,
      groupCountsExpanded,
      showShortCuts,
      pushHealthVisibility,
      frameworks,
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
            {...this.props}
          />
          <SplitPane
            split="horizontal"
            size={`${pushListPct}%`}
            onChange={(size) => this.handleSplitChange(size)}
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
                      landoCommitID={landoCommitID}
                      landoStatus={landoStatus}
                      currentRepo={currentRepo}
                      filterModel={filterModel}
                      duplicateJobsVisible={duplicateJobsVisible}
                      groupCountsExpanded={groupCountsExpanded}
                      pushHealthVisibility={pushHealthVisibility}
                      getAllShownJobs={this.getAllShownJobs}
                      {...this.props}
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
                  frameworks={frameworks}
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
      </div>
    );
  }
}

App.propTypes = {
  jobMap: PropTypes.shape({}).isRequired,
  router: PropTypes.shape({}).isRequired,
  pushRoute: PropTypes.func.isRequired,
  fetchPushes: PropTypes.func.isRequired,
};

const mapStateToProps = ({ pushes: { jobMap }, router }) => ({
  jobMap,
  router,
});

export default connect(mapStateToProps, {
  pushRoute,
  clearExpiredNotifications,
  fetchPushes,
})(hot(App));
