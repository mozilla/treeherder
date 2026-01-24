import React, { useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { Button } from 'react-bootstrap';
import { connect } from 'react-redux';
import intersection from 'lodash/intersection';
import isEqual from 'lodash/isEqual';

import ErrorBoundary from '../../shared/ErrorBoundary';
import { notify } from '../redux/stores/notifications';
import {
  clearSelectedJob,
  setSelectedJob,
  setSelectedJobFromQueryString,
} from '../redux/stores/selectedJob';
import { fetchPushes, updateRange, pollPushes } from '../redux/stores/pushes';
import { updatePushParams } from '../../helpers/location';

import Push from './Push';
import PushLoadErrors from './PushLoadErrors';

const PUSH_POLL_INTERVAL = 60000;

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
  clearSelectedJob,
  setSelectedJob,
  pinnedJobs,
  setSelectedJobFromQueryString,
  getAllShownJobs,
  jobMap,
  notify,
  revision = null,
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
      // Target must be within the "push" area, but not be a dropdown-item or
      // a button/btn.
      // This will exclude the JobDetails and navbars.
      const globalContent = document.getElementById('th-global-content');
      const countPinnedJobs = Object.keys(pinnedJobs).length;
      const isEligible =
        globalContent.contains(target) &&
        target.tagName !== 'A' &&
        target.closest('button') === null &&
        !intersection(target.classList, ['btn', 'dropdown-item']).length;

      if (isEligible) {
        clearSelectedJob(countPinnedJobs);
      }
    },
    [pinnedJobs, clearSelectedJob],
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

  // componentDidUpdate - handle jobsLoaded changes
  useEffect(() => {
    if (jobsLoaded && jobsLoaded !== prevJobsLoaded.current) {
      setSelectedJobFromQueryString(notify, jobMap);
    }
    prevJobsLoaded.current = jobsLoaded;
  }, [jobsLoaded, setSelectedJobFromQueryString, notify, jobMap]);

  // componentDidUpdate - handle URL changes
  useEffect(() => {
    if (prevRouterSearch.current !== router.location.search) {
      handleUrlChanges(prevRouterSearch.current);

      // Check if selectedTaskRun changed (e.g., via browser back/forward)
      // Only re-select if the URL change wasn't caused by our own click handler.
      // We detect this by checking if the currently selected job already matches the URL.
      const newParams = new URLSearchParams(router.location.search);
      const newSelectedTaskRun = newParams.get('selectedTaskRun');
      const currentSelectedBtn = document.querySelector(
        '#push-list .job-btn.selected-job',
      );
      const currentSelectedJobId = currentSelectedBtn?.dataset?.jobId;

      // Find the job matching the URL's selectedTaskRun
      let urlJob = null;
      if (newSelectedTaskRun && jobMap) {
        urlJob = Object.values(jobMap).find(
          (job) =>
            `${job.task_id}.${job.retry_id}` === newSelectedTaskRun ||
            job.task_id === newSelectedTaskRun.split('.')[0],
        );
      }
      const urlJobId = urlJob?.id?.toString();

      // Only sync visual selection if it doesn't match URL
      // This avoids duplicate URL updates when user clicks (which already updates URL)
      const visualMatchesUrl =
        (!newSelectedTaskRun && !currentSelectedJobId) ||
        (urlJobId && urlJobId === currentSelectedJobId);

      if (!visualMatchesUrl && jobsLoaded) {
        // Use setSelectedJob/clearSelectedJob with updateUrl=false to sync visual
        // selection without pushing new history entries (for back/forward nav)
        if (urlJob) {
          setSelectedJob(urlJob, false);
        } else {
          clearSelectedJob(0, false);
        }
      }

      prevRouterSearch.current = router.location.search;
    }
  }, [
    router.location.search,
    handleUrlChanges,
    jobsLoaded,
    setSelectedJob,
    clearSelectedJob,
    jobMap,
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
  clearSelectedJob: PropTypes.func.isRequired,
  setSelectedJob: PropTypes.func.isRequired,
  pinnedJobs: PropTypes.shape({}).isRequired,
  setSelectedJobFromQueryString: PropTypes.func.isRequired,
  getAllShownJobs: PropTypes.func.isRequired,
  jobMap: PropTypes.shape({}).isRequired,
  notify: PropTypes.func.isRequired,
  revision: PropTypes.string,
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
  pinnedJobs: { pinnedJobs },
  router,
}) => ({
  loadingPushes,
  jobsLoaded,
  jobMap,
  pushList,
  allUnclassifiedFailureCount,
  pinnedJobs,
  router,
});

export default connect(mapStateToProps, {
  notify,
  clearSelectedJob,
  setSelectedJob,
  setSelectedJobFromQueryString,
  fetchPushes,
  updateRange,
  pollPushes,
})(PushList);
