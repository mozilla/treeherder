import React from 'react';
import PropTypes from 'prop-types';
import { react2angular } from 'react2angular/index.es2015';
import SplitPane from 'react-split-pane';

import treeherder from '../js/treeherder';
import { thEvents, thFavicons } from '../helpers/constants';
import { Pushes } from './context/Pushes';
import { SelectedJob } from './context/SelectedJob';
import { PinnedJobs } from './context/PinnedJobs';
import { matchesDefaults } from '../helpers/filter';
import { getAllUrlParams, getRepo } from '../helpers/location';
import { deployedRevisionUrl } from '../helpers/url';
import ClassificationTypeModel from '../models/classificationType';
import FilterModel from '../models/filter';
import RepositoryModel from '../models/repository';
import PrimaryNavBar from './headerbars/PrimaryNavBar';
import ActiveFilters from './headerbars/ActiveFilters';
import UpdateAvailable from './headerbars/UpdateAvailable';
import DetailsPanel from './details/DetailsPanel';
import PushList from './pushes/PushList';
import KeyboardShortcuts from './KeyboardShortcuts';

const DEFAULT_DETAILS_PCT = 40;
const REVISION_POLL_INTERVAL = 1000 * 60 * 5;
const REVISION_POLL_DELAYED_INTERVAL = 1000 * 60 * 60;
const HIDDEN_URL_PARAMS = [
  'repo', 'classifiedState', 'resultStatus', 'selectedJob', 'searchStr',
];

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
    this.$rootScope = $injector.get('$rootScope');
    this.thNotify = $injector.get('thNotify');

    const filterModel = new FilterModel();
    this.$rootScope.filterModel = filterModel;
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
      pushListPct: hasSelectedJob ? 100 - DEFAULT_DETAILS_PCT : 100,
      serverChangedDelayed: false,
      serverChanged: false,
      repos: [],
      currentRepo: new RepositoryModel({ is_try_repo: true }),
      classificationTypes: [],
      classificationMap: {},
      hasSelectedJob,
    };
  }

  static getDerivedStateFromProps(props, state) {
    return {
      ...JobView.getSplitterDimensions(state.hasSelectedJob),
      repoName: getRepo(),
    };
  }

  componentDidMount() {
    const { repoName } = this.state;

    this.toggleFieldFilterVisible = this.toggleFieldFilterVisible.bind(this);
    this.updateDimensions = this.updateDimensions.bind(this);
    this.setCurrentRepoTreeStatus = this.setCurrentRepoTreeStatus.bind(this);
    this.handleUrlChanges = this.handleUrlChanges.bind(this);

    RepositoryModel.getList().then((repos) => {
      const currentRepo = repos.find(repo => repo.name === repoName) || this.state.currentRepo;
      // To support the title string of the tab when a single revision is showing.
      this.$rootScope.currentRepo = currentRepo;
      this.setState({ currentRepo, repos });
    });

    ClassificationTypeModel.getList().then((classificationTypes) => {
      this.setState({
        classificationTypes,
        classificationMap: ClassificationTypeModel.getMap(classificationTypes),
      });
    });

    window.addEventListener('resize', this.updateDimensions, false);
    window.addEventListener('hashchange', this.handleUrlChanges, false);

    this.toggleFieldFilterVisibleUnlisten = this.$rootScope.$on(thEvents.toggleFieldFilterVisible, () => {
      this.toggleFieldFilterVisible();
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

  componentWillUnmount() {
    this.toggleFieldFilterVisibleUnlisten();
    window.removeEventListener('resize', this.updateDimensions, false);
    window.removeEventListener('hashchange', this.handleUrlChanges, false);
  }

  static getSplitterDimensions(hasSelectedJob) {
    const defaultPushListPct = hasSelectedJob ? 100 - DEFAULT_DETAILS_PCT : 100;
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

  setCurrentRepoTreeStatus(status) {
    document.getElementById('favicon').href = thFavicons[status] || thFavicons.open;
  }

  handleUrlChanges() {
    const filterModel = new FilterModel();

    this.$rootScope.filterModel = filterModel;
    this.setState({
      filterModel,
      serverChanged: false,
      hasSelectedJob: getAllUrlParams().has('selectedJob'),
    });
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

  updateDimensions() {
    this.setState(JobView.getSplitterDimensions(this.state.hasSelectedJob));
  }

  handleSplitChange(latestSplitSize) {
    this.setState({
      latestSplitPct: latestSplitSize / getWindowHeight() * 100,
    });
  }

  render() {
    const { $injector } = this.props;
    const {
      user, isFieldFilterVisible, serverChangedDelayed,
      defaultPushListPct, defaultDetailsHeight, latestSplitPct, serverChanged,
      currentRepo, repoName, repos, classificationTypes, classificationMap,
      filterModel, hasSelectedJob, revision,
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
    const pushListPct = latestSplitPct === undefined || !hasSelectedJob ?
      defaultPushListPct :
      latestSplitPct;
    const detailsHeight = latestSplitPct === undefined || !hasSelectedJob ?
      defaultDetailsHeight :
      getWindowHeight() * (1 - latestSplitPct / 100);
    const filterBarFilters = Object.entries(filterModel.urlParams).reduce((acc, [field, value]) => (
      HIDDEN_URL_PARAMS.includes(field) || matchesDefaults(field, value) ?
        acc : [...acc, { field, value }]
    ), []);

    return (
      <Pushes filterModel={filterModel} $injector={$injector}>
        <PinnedJobs notify={this.thNotify}>
          <SelectedJob
            notify={this.thNotify}
            $injector={$injector}
          >
            <KeyboardShortcuts
              filterModel={filterModel}
              $injector={$injector}
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
                $injector={$injector}
              />
              <SplitPane
                split="horizontal"
                size={`${pushListPct}%`}
                onChange={size => this.handleSplitChange(size)}
              >
                <div className="d-flex flex-column w-100">
                  {(isFieldFilterVisible || !!filterBarFilters.length) && <ActiveFilters
                    $injector={$injector}
                    classificationTypes={classificationTypes}
                    filterModel={filterModel}
                    filterBarFilters={filterBarFilters}
                    isFieldFilterVisible={isFieldFilterVisible}
                    toggleFieldFilterVisible={this.toggleFieldFilterVisible}
                  />}
                  {serverChangedDelayed && <UpdateAvailable
                    updateButtonClick={this.updateButtonClick}
                  />}
                  <div id="th-global-content" className="th-global-content" data-job-clear-on-click>
                    <span className="th-view-content" tabIndex={-1}>
                      <PushList
                        user={user}
                        repoName={repoName}
                        revision={revision}
                        currentRepo={currentRepo}
                        filterModel={filterModel}
                        $injector={$injector}
                      />
                    </span>
                  </div>
                </div>
                <DetailsPanel
                  resizedHeight={detailsHeight}
                  currentRepo={currentRepo}
                  repoName={repoName}
                  user={user}
                  classificationTypes={classificationTypes}
                  classificationMap={classificationMap}
                  $injector={$injector}
                />
              </SplitPane>
            </KeyboardShortcuts>
          </SelectedJob>
        </PinnedJobs>
      </Pushes>
    );
  }
}

JobView.propTypes = {
  $injector: PropTypes.object.isRequired,
};

treeherder.component('jobView', react2angular(JobView, [], ['$injector']));
