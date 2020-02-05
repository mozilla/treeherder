/* eslint-disable jsx-a11y/no-static-element-interactions */

import React from 'react';
import { Button } from 'reactstrap';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircle, faDotCircle } from '@fortawesome/free-regular-svg-icons';
import {
  faExclamationCircle,
  faFilter,
  faTimesCircle,
} from '@fortawesome/free-solid-svg-icons';

import { getBtnClass } from '../../helpers/job';
import { hasUrlFilterChanges, thFilterGroups } from '../../helpers/filter';
import { getRepo, getUrlParam, setUrlParam } from '../../helpers/location';
import RepositoryModel from '../../models/repository';
import ErrorBoundary from '../../shared/ErrorBoundary';
import { recalculateUnclassifiedCounts } from '../redux/stores/pushes';

import TierIndicator from './TierIndicator';
import WatchedRepo from './WatchedRepo';

const MAX_WATCHED_REPOS = 3;
const WATCHED_REPOS_STORAGE_KEY = 'thWatchedRepos';

const getSearchStrFromUrl = function getSearchStrFromUrl() {
  const searchStr = getUrlParam('searchStr');
  return searchStr ? searchStr.replace(/,/g, ' ') : '';
};

class SecondaryNavBar extends React.PureComponent {
  constructor(props) {
    super(props);

    this.filterChicklets = [
      'failures',
      thFilterGroups.nonfailures,
      'in progress',
    ].reduce((acc, val) => acc.concat(val), []);

    this.state = {
      searchQueryStr: getSearchStrFromUrl(),
      watchedRepoNames: [],
      repoName: getRepo(),
    };
  }

  componentDidMount() {
    window.addEventListener('hashchange', this.handleUrlChanges, false);
    this.loadWatchedRepos();
  }

  componentDidUpdate(prevProps, prevState) {
    const { repoName } = this.state;

    if (repoName !== prevState.repoName) {
      this.loadWatchedRepos();
    }
  }

  componentWillUnmount() {
    window.removeEventListener('hashchange', this.handleUrlChanges, false);
  }

  setSearchStr(ev) {
    this.setState({ searchQueryStr: ev.target.value });
  }

  handleUrlChanges = evt => {
    const { oldURL, newURL } = evt;
    const { repoName } = this.state;
    const { recalculateUnclassifiedCounts } = this.props;
    const newState = {
      searchQueryStr: getSearchStrFromUrl(),
      repoName: getRepo(),
    };

    this.setState(newState, () => {
      if (
        hasUrlFilterChanges(oldURL, newURL) ||
        newState.repoName !== repoName
      ) {
        recalculateUnclassifiedCounts();
      }
    });
  };

  search = ev => {
    const { filterModel } = this.props;
    const { value } = ev.target;

    if (ev.key === 'Enter') {
      if (value && value.length) {
        filterModel.replaceFilter('searchStr', value.split(' '));
      } else {
        filterModel.removeFilter('searchStr');
      }
      ev.target.parentElement.focus();
    }
  };

  isFilterOn = filter => {
    const { filterModel } = this.props;
    const { resultStatus } = filterModel.urlParams;

    if (filter in thFilterGroups) {
      return thFilterGroups[filter].some(val => resultStatus.includes(val));
    }
    return resultStatus.includes(filter);
  };

  /**
   * Handle toggling one of the individual result status filter chicklets
   * on the nav bar
   */
  toggleResultStatusFilterChicklet = filter => {
    const { filterModel } = this.props;
    const filterValues =
      filter in thFilterGroups
        ? thFilterGroups[filter] // this is a filter grouping, so toggle all on/off
        : [filter];

    filterModel.toggleResultStatuses(filterValues);
  };

  toggleShowDuplicateJobs = () => {
    const { duplicateJobsVisible } = this.props;
    const duplicateJobs = duplicateJobsVisible ? null : 'visible';

    setUrlParam('duplicate_jobs', duplicateJobs);
  };

  toggleGroupState = () => {
    const { groupCountsExpanded } = this.props;
    const groupState = groupCountsExpanded ? null : 'expanded';

    setUrlParam('group_state', groupState);
  };

  toggleUnclassifiedFailures = () => {
    const { filterModel } = this.props;

    filterModel.toggleUnclassifiedFailures();
  };

  clearFilterBox = () => {
    const { filterModel } = this.props;

    filterModel.removeFilter('searchStr');
  };

  unwatchRepo = name => {
    const { watchedRepoNames } = this.state;

    this.saveWatchedRepos(watchedRepoNames.filter(repo => repo !== name));
  };

  loadWatchedRepos() {
    const { repoName } = this.state;

    try {
      const storedWatched =
        JSON.parse(localStorage.getItem(WATCHED_REPOS_STORAGE_KEY)) || [];
      // Ensure the current repo is first in the list
      const watchedRepoNames = [
        repoName,
        ...storedWatched.filter(value => value !== repoName),
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
      updateButtonClick,
      serverChanged,
      filterModel,
      setCurrentRepoTreeStatus,
      repos,
      allUnclassifiedFailureCount,
      filteredUnclassifiedFailureCount,
      groupCountsExpanded,
      duplicateJobsVisible,
      toggleFieldFilterVisible,
    } = this.props;
    const { watchedRepoNames, searchQueryStr, repoName } = this.state;
    // This array needs to be RepositoryModel objects, not strings.
    // If ``repos`` is not yet populated, then leave as empty array.
    // We need to filter just in case some of these repo names do not exist.
    // This could happen if the user typed an invalid ``repo`` param on the URL
    const watchedRepos =
      (repos.length &&
        watchedRepoNames
          .map(name => RepositoryModel.getRepo(name, repos))
          .filter(name => name)) ||
      [];

    return (
      <div
        id="watched-repo-navbar"
        className="th-context-navbar navbar-dark watched-repo-navbar"
        tabIndex={-1}
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
                  unwatchRepo={this.unwatchRepo}
                  setCurrentRepoTreeStatus={setCurrentRepoTreeStatus}
                />
              </ErrorBoundary>
            ))}
          </span>
          <form role="search" className="form-inline flex-row">
            {serverChanged && (
              <span
                className="btn btn-sm btn-view-nav nav-menu-btn"
                onClick={updateButtonClick}
                id="revisionChangedLabel"
                title="New version of Treeherder has been deployed. Reload to pick up changes."
              >
                <FontAwesomeIcon icon={faExclamationCircle} />
                &nbsp;Treeherder update available
              </span>
            )}

            {/* Unclassified Failures Button */}
            <Button
              className={`btn btn-sm ${
                allUnclassifiedFailureCount
                  ? 'btn-unclassified-failures'
                  : 'btn-view-nav'
              }${filterModel.isUnclassifiedFailures() ? ' active' : ''}`}
              title="Loaded failures / toggle filtering for unclassified failures"
              onClick={this.toggleUnclassifiedFailures}
            >
              <span id="unclassified-failure-count">
                {allUnclassifiedFailureCount}
              </span>{' '}
              unclassified
            </Button>

            {/* Filtered Unclassified Failures Button */}
            {filteredUnclassifiedFailureCount !==
              allUnclassifiedFailureCount && (
              <span
                className="navbar-badge badge badge-secondary badge-pill"
                title="Reflects the unclassified failures which pass the current filters"
              >
                <span id="filtered-unclassified-failure-count">
                  {filteredUnclassifiedFailureCount}
                </span>
              </span>
            )}

            {/* Toggle Duplicate Jobs */}
            <Button
              className={`btn btn-view-nav btn-sm btn-toggle-duplicate-jobs bg-transparent border border-0 ${
                groupCountsExpanded ? 'disabled' : ''
              } ${!duplicateJobsVisible ? 'strikethrough' : ''}`}
              tabIndex="0"
              role="button"
              title={
                duplicateJobsVisible
                  ? 'Hide duplicate jobs'
                  : 'Show duplicate jobs'
              }
              onClick={() =>
                !groupCountsExpanded && this.toggleShowDuplicateJobs()
              }
            />
            <Button className="btn-group p-0 bg-transparent border border-0">
              {/* Toggle Group State Button */}
              <span
                className="btn btn-view-nav btn-sm btn-toggle-group-state"
                tabIndex="-1"
                role="button"
                title={
                  groupCountsExpanded
                    ? 'Collapse job groups'
                    : 'Expand job groups'
                }
                onClick={() => this.toggleGroupState()}
              >
                ({' '}
                <span className="group-state-nav-icon">
                  {groupCountsExpanded ? '-' : '+'}
                </span>{' '}
                )
              </span>
            </Button>

            {/* Result Status Filter Chicklets */}
            <span className="resultStatusChicklets">
              <span id="filter-chicklets">
                {this.filterChicklets.map(filterName => {
                  const isOn = this.isFilterOn(filterName);
                  return (
                    <span key={filterName}>
                      <FontAwesomeIcon
                        className={`btn btn-view-nav btn-nav-filter ${getBtnClass(
                          filterName,
                        )}-filter-chicklet`}
                        icon={isOn ? faDotCircle : faCircle}
                        onClick={() =>
                          this.toggleResultStatusFilterChicklet(filterName)
                        }
                        title={filterName}
                        aria-label={filterName}
                        role="checkbox"
                        aria-checked={isOn}
                        tabIndex={0}
                      />
                    </span>
                  );
                })}
              </span>
            </span>

            <span>
              <span
                className="btn btn-view-nav btn-sm"
                onClick={toggleFieldFilterVisible}
                title="Filter by a job field"
              >
                <FontAwesomeIcon
                  icon={faFilter}
                  size="sm"
                  title="Filter by a job field"
                />
              </span>
            </span>
            <span>
              <TierIndicator filterModel={filterModel} />
            </span>
            {/* Quick Filter Field */}
            <span
              id="quick-filter-parent"
              className="form-group form-inline"
              tabIndex={-1}
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
              <FontAwesomeIcon
                id="quick-filter-clear-button"
                icon={faTimesCircle}
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
  updateButtonClick: PropTypes.func.isRequired,
  serverChanged: PropTypes.bool.isRequired,
  filterModel: PropTypes.object.isRequired,
  repos: PropTypes.array.isRequired,
  setCurrentRepoTreeStatus: PropTypes.func.isRequired,
  allUnclassifiedFailureCount: PropTypes.number.isRequired,
  recalculateUnclassifiedCounts: PropTypes.func.isRequired,
  filteredUnclassifiedFailureCount: PropTypes.number.isRequired,
  duplicateJobsVisible: PropTypes.bool.isRequired,
  groupCountsExpanded: PropTypes.bool.isRequired,
  toggleFieldFilterVisible: PropTypes.func.isRequired,
};

const mapStateToProps = ({
  pushes: { allUnclassifiedFailureCount, filteredUnclassifiedFailureCount },
}) => ({ allUnclassifiedFailureCount, filteredUnclassifiedFailureCount });

export default connect(mapStateToProps, { recalculateUnclassifiedCounts })(
  SecondaryNavBar,
);
