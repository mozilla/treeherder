import { useMemo, useCallback, memo } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faMinusSquare,
  faPlusSquare,
} from '@fortawesome/free-regular-svg-icons';
import {
  faExternalLinkAlt,
  faThumbtack,
  faTimesCircle,
} from '@fortawesome/free-solid-svg-icons';
import { Badge, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';

import { getPercentComplete, toDateStr } from '../../helpers/display';
import { formatTaskclusterError } from '../../helpers/errorMessage';
import { getJobsUrl } from '../../helpers/url';
import PushModel from '../../models/push';
import JobModel from '../../models/job';
import PushHealthStatus from '../../shared/PushHealthStatus';
import { getUrlParam } from '../../helpers/location';
import { notify } from '../stores/notificationStore';
import { setSelectedJob } from '../stores/selectedJobStore';
import { pinJobs } from '../stores/pinnedJobsStore';

import PushActionMenu from './PushActionMenu';

// url params we don't want added from the current querystring to the revision
// and author links.
const SKIPPED_LINK_PARAMS = [
  'revision',
  'fromchange',
  'tochange',
  'nojobs',
  'startdate',
  'enddate',
  'author',
];

function PushCounts({ pending, running, completed, fixedByCommit }) {
  const inProgress = pending + running;
  const total = completed + inProgress;
  const percentComplete = getPercentComplete({ pending, running, completed });

  return (
    <div>
      {fixedByCommit >= 1 && (
        <span
          className="badge text-bg-warning ms-1"
          title="Count of Fixed By Commit tasks for this push"
        >
          {fixedByCommit}
        </span>
      )}
      <span className="push-progress">
        {percentComplete === 100 && <span>- Complete -</span>}
        {percentComplete < 100 && total > 0 && (
          <span title="Proportion of jobs that are complete">
            {percentComplete}% - {inProgress} in progress
          </span>
        )}
      </span>
    </div>
  );
}

PushCounts.propTypes = {
  pending: PropTypes.number.isRequired,
  running: PropTypes.number.isRequired,
  completed: PropTypes.number.isRequired,
  fixedByCommit: PropTypes.number.isRequired,
};

function PushHeader({
  push,
  pushId,
  pushTimestamp,
  author,
  revision = null,
  filterModel,
  runnableVisible,
  showRunnableJobs,
  hideRunnableJobs,
  showFuzzyJobs,
  cycleWatchState,
  expandAllPushGroups,
  notificationSupported,
  getAllShownJobs,
  selectedRunnableJobs,
  collapsed,
  jobCounts,
  pushHealthVisibility,
  decisionTaskMap,
  watchState = 'none',
  pushHealthStatusCallback = null,
  currentRepo,
  togglePushCollapsed,
}) {
  const pushDateStr = useMemo(() => toDateStr(pushTimestamp), [pushTimestamp]);

  const getLinkParams = useCallback(() => {
    return Object.entries(filterModel.getUrlParamsWithoutDefaults()).reduce(
      (acc, [field, values]) =>
        SKIPPED_LINK_PARAMS.includes(field) ? acc : { ...acc, [field]: values },
      {},
    );
  }, [filterModel]);

  const triggerNewJobs = useCallback(async () => {
    if (
      !window.confirm(
        'This will trigger all selected jobs. Click "OK" if you want to proceed.',
      )
    ) {
      return;
    }
    const { id: decisionTaskId } = decisionTaskMap[pushId];

    PushModel.triggerNewJobs(selectedRunnableJobs, decisionTaskId, currentRepo)
      .then((result) => {
        notify(result, 'success');
        hideRunnableJobs(pushId);
        hideRunnableJobs();
      })
      .catch((e) => {
        notify(formatTaskclusterError(e), 'danger', { sticky: true });
      });
  }, [
    pushId,
    selectedRunnableJobs,
    hideRunnableJobs,
    decisionTaskMap,
    currentRepo,
  ]);

  const cancelAllJobs = useCallback(() => {
    if (
      window.confirm(
        'This will cancel all pending and running jobs for this push. It cannot be undone! Are you sure?',
      )
    ) {
      JobModel.cancelAll(
        push.id,
        currentRepo,
        notify,
        decisionTaskMap[push.id],
      );
    }
  }, [push, currentRepo, decisionTaskMap]);

  const pinAllShownJobs = useCallback(() => {
    const shownJobs = getAllShownJobs(pushId);
    const selectedTaskRun = getUrlParam('selectedTaskRun');

    if (shownJobs.length) {
      expandAllPushGroups(() => {
        pinJobs(shownJobs);
        if (!selectedTaskRun) {
          setSelectedJob(shownJobs[0]);
        }
      });
    } else {
      notify('No jobs available to pin', 'danger');
    }
  }, [pushId, expandAllPushGroups, getAllShownJobs]);

  const cancelJobsTitle = 'Cancel all jobs';
  const linkParams = getLinkParams();
  const revisionPushFilterUrl = getJobsUrl({ ...linkParams, revision });

  // we don't do this for revision because it is handled differently via updateRange.
  const authorParams = getLinkParams();
  if (authorParams.selectedTaskRun) {
    delete authorParams.selectedTaskRun;
  }
  const authorPushFilterUrl = getJobsUrl({ ...authorParams, author });
  const showPushHealthStatus =
    pushHealthVisibility === 'All' ||
    currentRepo.name === pushHealthVisibility.toLowerCase();
  const watchStateLabel = {
    none: 'Watch',
    push: 'Notifying (per-push)',
    job: 'Notifying (per-job)',
  }[watchState];
  const countSelectedRunnableJobs = selectedRunnableJobs.length;

  return (
    <div className="push-header" data-testid="push-header">
      <div className="push-bar">
        <span className="push-left">
          <span className="push-title-left">
            <FontAwesomeIcon
              onClick={togglePushCollapsed}
              icon={collapsed ? faPlusSquare : faMinusSquare}
              className="pe-3 mt-2 text-muted pointable"
              title={`${collapsed ? 'Expand' : 'Collapse'} push data`}
            />
            <span>
              <Link to={revisionPushFilterUrl} title="View only this push">
                {pushDateStr}{' '}
                <FontAwesomeIcon
                  icon={faExternalLinkAlt}
                  className="icon-superscript"
                />
              </Link>{' '}
              -{' '}
            </span>
            <Link to={authorPushFilterUrl}>{author}</Link>
          </span>
        </span>
        {showPushHealthStatus && (
          <PushHealthStatus
            repoName={currentRepo.name}
            revision={revision}
            jobCounts={jobCounts}
            statusCallback={pushHealthStatusCallback}
          />
        )}
        <PushCounts
          className="push-counts"
          pending={jobCounts.pending}
          running={jobCounts.running}
          completed={jobCounts.completed}
          fixedByCommit={jobCounts.fixedByCommit}
        />
        <span className="push-buttons">
          {jobCounts.pending + jobCounts.running > 0 && (
            <button
              type="button"
              className="btn btn-sm btn-push watch-commit-btn"
              disabled={!notificationSupported}
              title={
                notificationSupported
                  ? 'Get Desktop Notifications for this Push'
                  : 'Desktop notifications not supported in this browser'
              }
              data-watch-state={watchState}
              onClick={() => cycleWatchState()}
            >
              {watchStateLabel}
            </button>
          )}
          <button
            type="button"
            className="btn btn-sm btn-push cancel-all-jobs-btn"
            title={cancelJobsTitle}
            onClick={cancelAllJobs}
            aria-label={cancelJobsTitle}
          >
            <FontAwesomeIcon
              icon={faTimesCircle}
              className="dim-quarter"
              title="Cancel jobs"
            />
          </button>
          <button
            type="button"
            className="btn btn-sm btn-push pin-all-jobs-btn"
            title="Pin all available jobs in this push"
            aria-label="Pin all available jobs in this push"
            onClick={pinAllShownJobs}
          >
            <FontAwesomeIcon icon={faThumbtack} title="Pin all jobs" />
          </button>
          {!!countSelectedRunnableJobs && runnableVisible && (
            <Button
              className="btn btn-sm btn-push trigger-new-jobs-btn"
              title="Trigger new jobs"
              onClick={triggerNewJobs}
            >
              Trigger
              <Badge bg="info" className="mx-1">
                {countSelectedRunnableJobs}
              </Badge>
              New Job{countSelectedRunnableJobs > 1 ? 's' : ''}
            </Button>
          )}
          <PushActionMenu
            runnableVisible={runnableVisible}
            revision={revision}
            currentRepo={currentRepo}
            pushId={pushId}
            showRunnableJobs={showRunnableJobs}
            hideRunnableJobs={hideRunnableJobs}
            showFuzzyJobs={showFuzzyJobs}
          />
        </span>
      </div>
    </div>
  );
}

PushHeader.propTypes = {
  push: PropTypes.shape({
    id: PropTypes.number,
  }).isRequired,
  pushId: PropTypes.number.isRequired,
  pushTimestamp: PropTypes.number.isRequired,
  author: PropTypes.string.isRequired,
  revision: PropTypes.string,
  filterModel: PropTypes.shape({}).isRequired,
  runnableVisible: PropTypes.bool.isRequired,
  showRunnableJobs: PropTypes.func.isRequired,
  hideRunnableJobs: PropTypes.func.isRequired,
  showFuzzyJobs: PropTypes.func.isRequired,
  cycleWatchState: PropTypes.func.isRequired,
  expandAllPushGroups: PropTypes.func.isRequired,
  notificationSupported: PropTypes.bool.isRequired,
  getAllShownJobs: PropTypes.func.isRequired,
  selectedRunnableJobs: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  collapsed: PropTypes.bool.isRequired,
  jobCounts: PropTypes.shape({}).isRequired,
  pushHealthVisibility: PropTypes.string.isRequired,
  decisionTaskMap: PropTypes.shape({}).isRequired,
  watchState: PropTypes.string,
  pushHealthStatusCallback: PropTypes.func,
  currentRepo: PropTypes.shape({}).isRequired,
};

const mapStateToProps = ({ pushes: { decisionTaskMap } }) => ({
  decisionTaskMap,
});

export default connect(mapStateToProps)(memo(PushHeader));
