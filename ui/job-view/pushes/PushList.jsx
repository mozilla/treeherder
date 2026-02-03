import React, { useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { Button } from 'react-bootstrap';
import { connect } from 'react-redux';
import intersection from 'lodash/intersection';
import isEqual from 'lodash/isEqual';

import ErrorBoundary from '../../shared/ErrorBoundary';
import { notify } from '../redux/stores/notifications';
import {
  syncSelectionFromUrl,
  clearJobViaUrl,
} from '../redux/stores/selectedJob';
import { fetchPushes, updateRange, pollPushes } from '../redux/stores/pushes';
import { updatePushParams } from '../../helpers/location';

import Push from './Push';
import PushLoadErrors from './PushLoadErrors';

const PUSH_POLL_INTERVAL = 60000;

/**
 * URL-FIRST ARCHITECTURE
 *
 * Job selection uses the URL as the single source of truth.
 * This component syncs the Redux state from the URL whenever the URL changes.
 *
 * Flow:
 * 1. User clicks job → PushJobs calls selectJobViaUrl() → URL updates
 * 2. URL change triggers useEffect below → calls syncSelectionFromUrl()
 * 3. syncSelectionFromUrl reads URL and updates Redux state + visual selection
 *
 * This eliminates race conditions because there's only one path for selection.
 */

function PushList({
  repoName,
  filterModel,
  pushList,
  fetchPushes,
  pollPushes,
  updateRange,
  loadingPushes,
  jobsLoaded,
  duplicateJobsVisible,
  groupCountsExpanded,
  allUnclassifiedFailureCount,
  clearJobViaUrl,
  syncSelectionFromUrl,
  getAllShownJobs,
  jobMap,
  notify,
  revision = null,
  landoInstance = null,
  landoCommitID = null,
  landoStatus = 'unknown',
  currentRepo = {},
  router,
  pushHealthVisibility,
}) {
  const [notificationSupported] = useState('Notification' in window);
  const pushIntervalId = useRef(null);
  const prevRouterSearch = useRef(router.location.search);
  const prevJobsLoaded = useRef(jobsLoaded);

  const getUrlRangeValues = useCallback((search) => {
    const params = [...new URLSearchParams(search)];

    return params.reduce((acc, [key, value]) => {
      return [
        'repo',
        'startdate',
        'enddate',
        'nojobs',
        'revision',
        'author',
      ].includes(key)
        ? { ...acc, [key]: value }
        : acc;
    }, {});
  }, []);

  const handleUrlChanges = useCallback(
    (prevSearch) => {
      const oldRange = getUrlRangeValues(prevSearch);
      const newRange = getUrlRangeValues(router.location.search);

      if (!isEqual(oldRange, newRange)) {
        updateRange(newRange);
      }
    },
    [router.location.search, updateRange, getUrlRangeValues],
  );

  const poll = useCallback(() => {
    pushIntervalId.current = setInterval(async () => {
      pollPushes();
    }, PUSH_POLL_INTERVAL);
  }, [pollPushes]);

  const clearIfEligibleTarget = useCallback(
    (target) => {
      // Target must be within the "push" area, but not be a dropdown-item,
      // button/btn, or job element.
      // This will exclude the JobDetails, navbars, and job buttons.
      const globalContent = document.getElementById('th-global-content');
      const isEligible =
        globalContent.contains(target) &&
        target.tagName !== 'A' &&
        target.closest('button') === null &&
        target.closest('[data-job-id]') === null &&
        !intersection(target.classList, ['btn', 'dropdown-item']).length;

      if (isEligible) {
        // Use URL-first pattern: just update URL, let sync effect handle the rest
        clearJobViaUrl();
      }
    },
    [clearJobViaUrl],
  );

  const fetchNextPushes = useCallback(
    (count) => {
      const params = updatePushParams(router.location);
      window.history.pushState(null, null, params);
      fetchPushes(count, true);
    },
    [fetchPushes, router.location],
  );

  const setWindowTitle = useCallback(() => {
    document.title = `[${allUnclassifiedFailureCount}] ${repoName}`;
  }, [allUnclassifiedFailureCount, repoName]);

  // componentDidMount - start polling
  useEffect(() => {
    poll();

    return () => {
      if (pushIntervalId.current) {
        clearInterval(pushIntervalId.current);
        pushIntervalId.current = null;
      }
    };
  }, [poll]);

  // Sync selection from URL when jobs first load
  useEffect(() => {
    if (jobsLoaded && jobsLoaded !== prevJobsLoaded.current) {
      // Jobs just finished loading - sync selection from URL
      syncSelectionFromUrl(jobMap, notify);
    }
    prevJobsLoaded.current = jobsLoaded;
  }, [jobsLoaded, syncSelectionFromUrl, notify, jobMap]);

  // URL-FIRST: Sync selection from URL whenever URL changes
  // This is the SINGLE place where selection state is updated from URL.
  // All selection changes (clicks, keyboard, back/forward) go through URL first,
  // then this effect syncs the state.
  useEffect(() => {
    if (prevRouterSearch.current !== router.location.search) {
      // Handle range changes (repo, dates, etc.)
      handleUrlChanges(prevRouterSearch.current);

      // Sync job selection from URL
      // This handles: user clicks, keyboard navigation, browser back/forward
      if (jobsLoaded) {
        syncSelectionFromUrl(jobMap, notify);
      }

      prevRouterSearch.current = router.location.search;
    }
  }, [
    router.location.search,
    handleUrlChanges,
    jobsLoaded,
    syncSelectionFromUrl,
    jobMap,
    notify,
  ]);

  if (!revision) {
    setWindowTitle();
  }

  return (
    // Bug 1619873 - role="list" works better here than an interactive role
    /* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
    <div
      role="list"
      id="push-list"
      onClick={(evt) => clearIfEligibleTarget(evt.target)}
    >
      {jobsLoaded && <span className="hidden ready" />}
      {repoName &&
        pushList.map((push) => (
          <ErrorBoundary
            errorClasses="ps-2 border-top border-bottom border-dark d-block"
            message={`Error on push with revision ${push.revision}: `}
            key={push.id}
          >
            <Push
              role="listitem"
              push={push}
              currentRepo={currentRepo}
              filterModel={filterModel}
              notificationSupported={notificationSupported}
              duplicateJobsVisible={duplicateJobsVisible}
              groupCountsExpanded={groupCountsExpanded}
              isOnlyRevision={push.revision === revision}
              pushHealthVisibility={pushHealthVisibility}
              getAllShownJobs={getAllShownJobs}
            />
          </ErrorBoundary>
        ))}
      {loadingPushes && (
        <div
          className="progress active progress-bar progress-bar-striped"
          role="progressbar"
          aria-label="Loading tests"
        />
      )}
      {pushList.length === 0 && !loadingPushes && (
        <PushLoadErrors
          loadingPushes={loadingPushes}
          currentRepo={currentRepo}
          repoName={repoName}
          revision={revision}
          landoInstance={landoInstance}
          landoCommitID={landoCommitID}
          landoStatus={landoStatus}
        />
      )}
      <div className="card card-body get-next">
        <span>get next:</span>
        <div className="btn-group">
          {[10, 20, 50].map((count) => (
            <Button
              variant="outline-dark"
              className="btn-light-bordered"
              onClick={() => fetchNextPushes(count)}
              key={count}
              data-testid={`get-next-${count}`}
            >
              {count}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

PushList.propTypes = {
  repoName: PropTypes.string.isRequired,
  filterModel: PropTypes.shape({}).isRequired,
  pushList: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  fetchPushes: PropTypes.func.isRequired,
  pollPushes: PropTypes.func.isRequired,
  updateRange: PropTypes.func.isRequired,
  loadingPushes: PropTypes.bool.isRequired,
  jobsLoaded: PropTypes.bool.isRequired,
  duplicateJobsVisible: PropTypes.bool.isRequired,
  groupCountsExpanded: PropTypes.bool.isRequired,
  allUnclassifiedFailureCount: PropTypes.number.isRequired,
  clearJobViaUrl: PropTypes.func.isRequired,
  syncSelectionFromUrl: PropTypes.func.isRequired,
  getAllShownJobs: PropTypes.func.isRequired,
  jobMap: PropTypes.shape({}).isRequired,
  notify: PropTypes.func.isRequired,
  revision: PropTypes.string,
  landoInstance: PropTypes.string,
  landoCommitID: PropTypes.string,
  landoStatus: PropTypes.string,
  currentRepo: PropTypes.shape({}),
  router: PropTypes.shape({}).isRequired,
};

const mapStateToProps = ({
  pushes: {
    loadingPushes,
    jobsLoaded,
    jobMap,
    pushList,
    allUnclassifiedFailureCount,
  },
  router,
}) => ({
  loadingPushes,
  jobsLoaded,
  jobMap,
  pushList,
  allUnclassifiedFailureCount,
  router,
});

export default connect(mapStateToProps, {
  notify,
  clearJobViaUrl,
  syncSelectionFromUrl,
  fetchPushes,
  updateRange,
  pollPushes,
})(PushList);
