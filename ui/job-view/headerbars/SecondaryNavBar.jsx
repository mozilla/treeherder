import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from 'react-bootstrap';
import PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircle, faDotCircle } from '@fortawesome/free-regular-svg-icons';
import {
  faExclamationCircle,
  faFilter,
  faTimesCircle,
} from '@fortawesome/free-solid-svg-icons';
import { useLocation, useNavigate } from 'react-router-dom';

import { getBtnClass } from '../../helpers/job';
import { hasUrlFilterChanges, thFilterGroups } from '../../helpers/filter';
import {
  getAllUrlParams,
  getRepo,
  getUrlParam,
  setUrlParams,
} from '../../helpers/location';
import RepositoryModel from '../../models/repository';
import ErrorBoundary from '../../shared/ErrorBoundary';
import { recalculateUnclassifiedCounts } from '../redux/stores/pushes';

import TierIndicator from './TierIndicator';
import WatchedRepo from './WatchedRepo';

const MAX_WATCHED_REPOS = 3;
const WATCHED_REPOS_STORAGE_KEY = 'thWatchedRepos';

const getSearchStrFromUrl = (location) => {
  const params = getAllUrlParams(location);
  const searchStr = params.get('searchStr');
  return searchStr ? searchStr.replace(/,/g, ' ') : '';
};

const filterChicklets = [
  'failures',
  thFilterGroups.nonfailures,
  'in progress',
].reduce((acc, val) => acc.concat(val), []);

const SecondaryNavBar = ({
  updateButtonClick,
  serverChanged,
  filterModel,
  repos,
  setCurrentRepoTreeStatus,
  duplicateJobsVisible,
  groupCountsExpanded,
  toggleFieldFilterVisible,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const prevLocationSearch = useRef(location.search);

  // Redux state
  const allUnclassifiedFailureCount = useSelector(
    (state) => state.pushes.allUnclassifiedFailureCount,
  );
  const filteredUnclassifiedFailureCount = useSelector(
    (state) => state.pushes.filteredUnclassifiedFailureCount,
  );

  // Local state - initialize from React Router location
  const [searchQueryStr, setSearchQueryStr] = useState(() =>
    getSearchStrFromUrl(location),
  );
  const [watchedRepoNames, setWatchedRepoNames] = useState([]);
  const [repoName, setRepoName] = useState(getRepo());

  const saveWatchedRepos = useCallback((repoList) => {
    setWatchedRepoNames(repoList);
    try {
      localStorage.setItem(WATCHED_REPOS_STORAGE_KEY, JSON.stringify(repoList));
    } catch {
      // localStorage is disabled/not supported.
    }
  }, []);

  const loadWatchedRepos = useCallback(() => {
    try {
      const storedWatched =
        JSON.parse(localStorage.getItem(WATCHED_REPOS_STORAGE_KEY)) || [];
      // Ensure the current repo is first in the list
      const newWatchedRepoNames = [
        repoName,
        ...storedWatched.filter((value) => value !== repoName),
      ].slice(0, MAX_WATCHED_REPOS);

      // Re-save the list, in case it has now changed
      saveWatchedRepos(newWatchedRepoNames);
    } catch {
      // localStorage is disabled/not supported.
    }
  }, [repoName, saveWatchedRepos]);

  const handleUrlChanges = useCallback(
    (prevParams, currentParams) => {
      // Parse search string from currentParams (which is the new location.search)
      const newSearchQueryStr = getSearchStrFromUrl({ search: currentParams });
      const newRepoName = getRepo();

      setSearchQueryStr(newSearchQueryStr);
      setRepoName(newRepoName);

      if (
        hasUrlFilterChanges(prevParams, currentParams) ||
        newRepoName !== repoName
      ) {
        dispatch(recalculateUnclassifiedCounts());
      }
    },
    [repoName, dispatch],
  );

  // Effect for initial load
  useEffect(() => {
    loadWatchedRepos();
  }, []);

  // Effect for repoName changes
  useEffect(() => {
    loadWatchedRepos();
  }, [repoName, loadWatchedRepos]);

  // Effect for URL changes
  useEffect(() => {
    if (prevLocationSearch.current !== location.search) {
      handleUrlChanges(prevLocationSearch.current, location.search);
      prevLocationSearch.current = location.search;
    }
  }, [location.search, handleUrlChanges]);

  const setSearchStr = (ev) => {
    setSearchQueryStr(ev.target.value);
  };

  const search = (ev) => {
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

  const isFilterOn = (filter) => {
    const { resultStatus } = filterModel.urlParams;

    if (filter in thFilterGroups) {
      return thFilterGroups[filter].some((val) => resultStatus.includes(val));
    }
    return resultStatus.includes(filter);
  };

  const toggleResultStatusFilterChicklet = (filter) => {
    const filterValues =
      filter in thFilterGroups
        ? thFilterGroups[filter] // this is a filter grouping, so toggle all on/off
        : [filter];

    filterModel.toggleResultStatuses(filterValues);
  };

  const toggleShowDuplicateJobs = () => {
    const duplicateJobs = duplicateJobsVisible ? null : 'visible';
    const queryParams = setUrlParams([['duplicate_jobs', duplicateJobs]]);

    navigate({
      search: queryParams,
    });
  };

  const toggleGroupState = () => {
    const groupState = groupCountsExpanded ? null : 'expanded';
    const queryParams = setUrlParams([['group_state', groupState]]);

    navigate({
      search: queryParams,
    });
  };

  const toggleUnclassifiedFailures = () => {
    filterModel.toggleUnclassifiedFailures();
  };

  const clearFilterBox = () => {
    filterModel.removeFilter('searchStr');
  };

  const unwatchRepo = (name) => {
    saveWatchedRepos(watchedRepoNames.filter((repo) => repo !== name));
  };

  // This array needs to be RepositoryModel objects, not strings.
  // If ``repos`` is not yet populated, then leave as empty array.
  // We need to filter just in case some of these repo names do not exist.
  const watchedRepos =
    (repos.length &&
      watchedRepoNames
        .map((name) => RepositoryModel.getRepo(name, repos))
        .filter((name) => name)) ||
    [];

  return (
    <div
      id="watched-repo-navbar"
      className="th-context-navbar navbar-dark watched-repo-navbar"
      tabIndex={-1}
    >
      <span className="justify-content-between w-100 d-flex flex-wrap">
        <span className="d-flex push-left watched-repos">
          {watchedRepos.map((watchedRepo) => (
            <ErrorBoundary
              errorClasses="ps-1 pe-1 btn-view-nav border-right"
              message={`Error watching ${watchedRepo.name}: `}
              key={watchedRepo.name}
            >
              <WatchedRepo
                repo={watchedRepo}
                repoName={repoName}
                unwatchRepo={unwatchRepo}
                setCurrentRepoTreeStatus={setCurrentRepoTreeStatus}
              />
            </ErrorBoundary>
          ))}
        </span>
        <form role="search" className="form-inline flex-row">
          {serverChanged && (
            <Button
              size="sm"
              className="btn-view-nav nav-menu-btn"
              onClick={updateButtonClick}
              id="revisionChangedLabel"
              title="New version of Treeherder has been deployed. Reload to pick up changes."
            >
              <FontAwesomeIcon icon={faExclamationCircle} />
              &nbsp;Treeherder update available
            </Button>
          )}

          {/* Unclassified Failures Button */}
          <Button
            className={`btn btn-sm ${
              allUnclassifiedFailureCount
                ? 'btn-unclassified-failures'
                : 'btn-view-nav'
            }${filterModel.isUnclassifiedFailures() ? ' active' : ''}`}
            title="Loaded failures / toggle filtering for unclassified failures"
            onClick={toggleUnclassifiedFailures}
          >
            <span id="unclassified-failure-count">
              {allUnclassifiedFailureCount}
            </span>{' '}
            unclassified
          </Button>

          {/* Filtered Unclassified Failures Button */}
          {filteredUnclassifiedFailureCount !== allUnclassifiedFailureCount && (
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
            onClick={() => !groupCountsExpanded && toggleShowDuplicateJobs()}
          />
          {/* Toggle Group State Button */}
          <Button
            className="py-0 px-1 btn-view-nav me-1"
            title={
              groupCountsExpanded ? 'Collapse job groups' : 'Expand job groups'
            }
            onClick={toggleGroupState}
          >
            (
            <span className="group-state-nav-icon mx-1">
              {groupCountsExpanded ? '-' : '+'}
            </span>
            )
          </Button>

          {/* Result Status Filter Chicklets */}
          <span className="resultStatusChicklets">
            <span id="filter-chicklets">
              {filterChicklets.map((filterName) => {
                const isOn = isFilterOn(filterName);
                const { status } = getBtnClass(filterName);
                return (
                  <span key={filterName}>
                    <FontAwesomeIcon
                      className="btn btn-view-nav btn-nav-filter"
                      data-status={status}
                      icon={isOn ? faDotCircle : faCircle}
                      onClick={() =>
                        toggleResultStatusFilterChicklet(filterName)
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
            <Button
              size="sm"
              className="btn-view-nav"
              onClick={toggleFieldFilterVisible}
              title="Filter by a job field"
            >
              <FontAwesomeIcon
                icon={faFilter}
                size="sm"
                title="Filter by a job field"
              />
            </Button>
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
              value={searchQueryStr || ''}
              title="Click to enter filter values"
              onChange={(evt) => setSearchStr(evt)}
              onKeyDown={(evt) => search(evt)}
              type="text"
              placeholder="Filter platforms & jobs"
            />
            <FontAwesomeIcon
              id="quick-filter-clear-button"
              icon={faTimesCircle}
              title="Clear this filter"
              onClick={clearFilterBox}
            />
          </span>
        </form>
      </span>
    </div>
  );
};

SecondaryNavBar.propTypes = {
  updateButtonClick: PropTypes.func.isRequired,
  serverChanged: PropTypes.bool.isRequired,
  filterModel: PropTypes.shape({}).isRequired,
  repos: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  setCurrentRepoTreeStatus: PropTypes.func.isRequired,
  duplicateJobsVisible: PropTypes.bool.isRequired,
  groupCountsExpanded: PropTypes.bool.isRequired,
  toggleFieldFilterVisible: PropTypes.func.isRequired,
};

export default SecondaryNavBar;
