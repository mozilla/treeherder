import React from 'react';
import PropTypes from 'prop-types';

import { thEvents } from '../../js/constants';
import { getBtnClass } from '../../helpers/job';
import { thFilterGroups } from '../../helpers/filter';
import {
  getRepo,
  getUrlParam,
  setUrlParam,
} from '../../helpers/location';
import RepositoryModel from '../../models/repository';
import ErrorBoundary from '../../shared/ErrorBoundary';
import WatchedRepo from './WatchedRepo';

const MAX_WATCHED_REPOS = 3;
const WATCHED_REPOS_STORAGE_KEY = 'thWatchedRepos';

const getSearchStrFromUrl = function getSearchStrFromUrl() {
  const searchStr = getUrlParam('searchStr');
  return searchStr ? searchStr.replace(/,/g, ' ') : '';
};

export default class SecondaryNavBar extends React.Component {
  constructor(props) {
    super(props);

    const { $injector } = this.props;
    this.ThResultSetStore = $injector.get('ThResultSetStore');
    this.$rootScope = $injector.get('$rootScope');

    this.filterChicklets = [
      'failures',
      thFilterGroups.nonfailures,
      'in progress'].reduce((acc, val) => acc.concat(val), []);

    this.state = {
      groupsExpanded: getUrlParam('group_state') === 'expanded',
      showDuplicateJobs: getUrlParam('duplicate_jobs') === 'visible',
      searchQueryStr: getSearchStrFromUrl(),
      watchedRepoNames: [],
      allUnclassifiedFailureCount: 0,
      filteredUnclassifiedFailureCount: 0,
      repoName: getRepo(),
    };
  }

  componentDidMount() {
    this.toggleGroupState = this.toggleGroupState.bind(this);
    this.toggleFieldFilterVisible = this.toggleFieldFilterVisible.bind(this);
    this.toggleUnclassifiedFailures = this.toggleUnclassifiedFailures.bind(this);
    this.clearFilterBox = this.clearFilterBox.bind(this);
    this.unwatchRepo = this.unwatchRepo.bind(this);
    this.handleUrlChanges = this.handleUrlChanges.bind(this);

    window.addEventListener('hashchange', this.handleUrlChanges, false);
    this.unlistenJobsLoaded = this.$rootScope.$on(thEvents.jobsLoaded, () => (
      this.setState({
        allUnclassifiedFailureCount: this.ThResultSetStore.getAllUnclassifiedFailureCount(),
        filteredUnclassifiedFailureCount: this.ThResultSetStore.getFilteredUnclassifiedFailureCount(),
      })
    ));
    this.loadWatchedRepos();
  }

  componentWillUnmount() {
    window.removeEventListener('onhashchange', this.handleUrlChanges, false);
    this.unlistenJobsLoaded();
  }

  setSearchStr(ev) {
    this.setState({ searchQueryStr: ev.target.value });
  }

  handleUrlChanges() {
    this.ThResultSetStore.recalculateUnclassifiedCounts();
    this.setState({
      allUnclassifiedFailureCount: this.ThResultSetStore.getAllUnclassifiedFailureCount(),
      filteredUnclassifiedFailureCount: this.ThResultSetStore.getFilteredUnclassifiedFailureCount(),
      searchQueryStr: getSearchStrFromUrl(),
    });
  }

  search(ev) {
    const { filterModel } = this.props;
    const value = ev.target.value;

    if (ev.key === 'Enter') {
      if (value && value.length) {
        filterModel.replaceFilter('searchStr', value.split(' '));
      } else {
        filterModel.removeFilter('searchStr');
      }
      ev.target.blur();
    }
  }

  isFilterOn(filter) {
    const { filterModel } = this.props;
    const { resultStatus } = filterModel.urlParams;

    if (filter in thFilterGroups) {
      return thFilterGroups[filter].some(val => resultStatus.includes(val));
    }
    return resultStatus.includes(filter);
  }

  /**
   * Handle toggling one of the individual result status filter chicklets
   * on the nav bar
   */
  toggleResultStatusFilterChicklet(filter) {
    const { filterModel } = this.props;
    const filterValues = filter in thFilterGroups ?
      thFilterGroups[filter] : // this is a filter grouping, so toggle all on/off
      [filter];

    filterModel.toggleResultStatuses(filterValues);
  }

  toggleFieldFilterVisible() {
      this.$rootScope.$emit(thEvents.toggleFieldFilterVisible);
  }

  toggleShowDuplicateJobs() {
    const { showDuplicateJobs } = this.state;
    const newShowDuplicateJobs = showDuplicateJobs ? null : 'visible';

    this.setState({ showDuplicateJobs: !showDuplicateJobs });
    setUrlParam('duplicate_jobs', newShowDuplicateJobs);
    this.$rootScope.$emit(thEvents.duplicateJobsVisibilityChanged);
  }

  toggleGroupState() {
    const { groupsExpanded } = this.state;
    const newGroupState = groupsExpanded ? null : 'expanded';

    this.setState({ groupsExpanded: !groupsExpanded });
    setUrlParam('group_state', newGroupState);
    this.$rootScope.$emit(thEvents.groupStateChanged, newGroupState);
  }

  toggleUnclassifiedFailures() {
    const { filterModel } = this.props;

    filterModel.toggleUnclassifiedFailures();
  }

  clearFilterBox() {
    const { filterModel } = this.props;

    filterModel.removeFilter('searchStr');
  }

  unwatchRepo(name) {
    const { watchedRepoNames } = this.state;

    this.saveWatchedRepos(watchedRepoNames.filter(repo => repo !== name));
  }

  loadWatchedRepos() {
    const { repoName } = this.state;

    try {
      const storedWatched = JSON.parse(localStorage.getItem(WATCHED_REPOS_STORAGE_KEY)) || [];
      // Ensure the current repo is first in the list
      const watchedRepoNames = [
        repoName,
        ...storedWatched.filter(value => (value !== repoName)),
      ].slice(0, MAX_WATCHED_REPOS);

      // Re-save the list, in case it has now changed
      this.saveWatchedRepos(watchedRepoNames);
    } catch (e) {
      // localStorage is disabled/not supported.
      return [];
    }
  }

  saveWatchedRepos(repos) {
    this.setState({ watchedRepoNames: repos });
    try {
      localStorage.setItem(WATCHED_REPOS_STORAGE_KEY, JSON.stringify(repos));
    } catch (e) {
      // localStorage is disabled/not supported.
    }
  }

  render() {
    const {
      updateButtonClick, serverChanged, $injector, setCurrentRepoTreeStatus,
      repos,
    } = this.props;
    const {
      watchedRepoNames, groupsExpanded, showDuplicateJobs, searchQueryStr,
      allUnclassifiedFailureCount, filteredUnclassifiedFailureCount, repoName,
    } = this.state;
    // This array needs to be RepositoryModel objects, not strings.
    // If ``repos`` is not yet populated, then leave as empty array.
    // We need to filter just in case some of these repo names do not exist.
    // This could happen if the user typed an invalid ``repo`` param on the URL
    const watchedRepos = !!repos.length && watchedRepoNames.map(
      name => RepositoryModel.getRepo(name, repos)).filter(name => name) || [];

    return (
      <div
        id="watched-repo-navbar"
        className="th-context-navbar navbar-dark watched-repo-navbar"
      >
        <span className="justify-content-between w-100 d-flex flex-wrap">
          <span className="d-flex push-left watched-repos">
            {watchedRepos.map(watchedRepo => (
              <ErrorBoundary
                errorClasses="pl-1 pr-1 btn-view-nav border-right"
                message={`Error watching ${watchedRepo.name}: `}
                key={watchedRepo.name}
              >
                <WatchedRepo
                  repo={watchedRepo}
                  repoName={repoName}
                  $injector={$injector}
                  unwatchRepo={this.unwatchRepo}
                  setCurrentRepoTreeStatus={setCurrentRepoTreeStatus}
                />
              </ErrorBoundary>
            ))}
          </span>
          <form role="search" className="form-inline flex-row">
            {serverChanged && <span
              className="btn btn-sm btn-view-nav nav-menu-btn"
              onClick={updateButtonClick}
              id="revisionChangedLabel"
              title="New version of Treeherder has been deployed. Reload to pick up changes."
            >
              <span className="fa fa-exclamation-circle" />&nbsp;Treeherder update available
            </span>}

            {/* Unclassified Failures Button */}
            <span
              className={`btn btn-sm ${allUnclassifiedFailureCount ? 'btn-unclassified-failures' : 'btn-view-nav'}`}
              title="Loaded failures / toggle filtering for unclassified failures"
              tabIndex="-1"
              role="button"
              onClick={this.toggleUnclassifiedFailures}
            >
              <span id="unclassified-failure-count">{allUnclassifiedFailureCount}</span> unclassified
            </span>

            {/* Filtered Unclassified Failures Button */}
            {filteredUnclassifiedFailureCount !== allUnclassifiedFailureCount &&
            <span
              className="navbar-badge badge badge-secondary badge-pill"
              title="Reflects the unclassified failures which pass the current filters"
            >
              <span id="filtered-unclassified-failure-count">{filteredUnclassifiedFailureCount}</span>
            </span>}

            {/* Toggle Duplicate Jobs */}
            <span
              className={`btn btn-view-nav btn-sm btn-toggle-duplicate-jobs ${groupsExpanded ? 'disabled' : ''} ${!showDuplicateJobs ? 'strikethrough' : ''}`}
              tabIndex="0"
              role="button"
              title={showDuplicateJobs ? 'Hide duplicate jobs' : 'Show duplicate jobs'}
              onClick={() => !groupsExpanded && this.toggleShowDuplicateJobs()}
            />
            <span className="btn-group">
              {/* Toggle Group State Button */}
              <span
                className="btn btn-view-nav btn-sm btn-toggle-group-state"
                tabIndex="-1"
                role="button"
                title={groupsExpanded ? 'Collapse job groups' : 'Expand job groups'}
                onClick={() => this.toggleGroupState()}
              >( <span className="group-state-nav-icon">{groupsExpanded ? '-' : '+'}</span> )
              </span>
            </span>

            {/* Result Status Filter Chicklets */}
            <span className="resultStatusChicklets">
              <span id="filter-chicklets">
                {this.filterChicklets.map((filterName) => {
                  const isOn = this.isFilterOn(filterName);
                  return (<span key={filterName}>
                    <span
                      className={`btn btn-view-nav btn-sm btn-nav-filter ${getBtnClass(filterName)}-filter-chicklet fa ${isOn ? 'fa-dot-circle-o' : 'fa-circle-thin'}`}
                      onClick={() => this.toggleResultStatusFilterChicklet(filterName)}
                      title={filterName}
                      aria-label={filterName}
                      role="checkbox"
                      aria-checked={isOn}
                      tabIndex={0}
                    />
                  </span>);
                })}
              </span>
            </span>

            <span>
              <span
                className="btn btn-view-nav btn-sm"
                onClick={() => this.toggleFieldFilterVisible()}
                title="Filter by a job field"
              ><i className="fa fa-filter" /></span>
            </span>

            {/* Quick Filter Field */}
            <span
              id="quick-filter-parent"
              className="form-group form-inline"
            >
              <input
                id="quick-filter"
                className="form-control form-control-sm"
                required
                value={searchQueryStr}
                title="Click to enter filter values"
                onChange={evt => this.setSearchStr(evt)}
                onKeyDown={evt => this.search(evt)}
                type="text"
                placeholder="Filter platforms & jobs"
              />
              <span
                id="quick-filter-clear-button"
                className="fa fa-times-circle"
                title="Clear this filter"
                onClick={this.clearFilterBox}
              />
            </span>
          </form>
        </span>
      </div>
    );
  }
}

SecondaryNavBar.propTypes = {
  $injector: PropTypes.object.isRequired,
  updateButtonClick: PropTypes.func.isRequired,
  serverChanged: PropTypes.bool.isRequired,
  filterModel: PropTypes.object.isRequired,
  repos: PropTypes.array.isRequired,
  setCurrentRepoTreeStatus: PropTypes.func.isRequired,
};
