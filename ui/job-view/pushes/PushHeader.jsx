import React from 'react';
import PropTypes from 'prop-types';

import { getPercentComplete, toDateStr } from '../../helpers/display';
import { formatTaskclusterError } from '../../helpers/errorMessage';
import { getJobsUrl } from '../../helpers/url';
import PushModel from '../../models/push';
import JobModel from '../../models/job';
import { withPinnedJobs } from '../context/PinnedJobs';
import { withSelectedJob } from '../context/SelectedJob';
import { withPushes } from '../context/Pushes';
import { withNotifications } from '../../shared/context/Notifications';
import { getUrlParam, setUrlParam } from '../../helpers/location';

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

function Author(props) {
  const authorMatch = props.author.match(/<(.*?)>+/);
  const authorEmail = authorMatch ? authorMatch[1] : props.author;

  return (
    <span title="View pushes by this user" className="push-author">
      <a href={props.url}>{authorEmail}</a>
    </span>
  );
}

Author.propTypes = {
  author: PropTypes.string.isRequired,
  url: PropTypes.string.isRequired,
};

function PushCounts(props) {
  const { pending, running, completed } = props;
  const inProgress = pending + running;
  const total = completed + inProgress;
  const percentComplete = getPercentComplete(props);

  return (
    <span className="push-progress">
      {percentComplete === 100 && <span>- Complete -</span>}
      {percentComplete < 100 && total > 0 && (
        <span title="Proportion of jobs that are complete">
          {percentComplete}% - {inProgress} in progress
        </span>
      )}
    </span>
  );
}

PushCounts.propTypes = {
  pending: PropTypes.number.isRequired,
  running: PropTypes.number.isRequired,
  completed: PropTypes.number.isRequired,
};

class PushHeader extends React.PureComponent {
  constructor(props) {
    super(props);
    const { pushTimestamp } = this.props;

    this.pushDateStr = toDateStr(pushTimestamp);
  }

  getLinkParams() {
    const { filterModel } = this.props;

    return Object.entries(filterModel.getUrlParamsWithoutDefaults()).reduce(
      (acc, [field, values]) =>
        SKIPPED_LINK_PARAMS.includes(field) ? acc : { ...acc, [field]: values },
      {},
    );
  }

  triggerNewJobs = () => {
    const {
      isLoggedIn,
      pushId,
      getGeckoDecisionTaskId,
      selectedRunnableJobs,
      hideRunnableJobs,
      notify,
    } = this.props;

    if (
      !window.confirm(
        'This will trigger all selected jobs. Click "OK" if you want to proceed.',
      )
    ) {
      return;
    }
    if (isLoggedIn) {
      const builderNames = selectedRunnableJobs;
      getGeckoDecisionTaskId(pushId)
        .then(decisionTaskID => {
          PushModel.triggerNewJobs(builderNames, decisionTaskID)
            .then(result => {
              notify(result, 'success');
              hideRunnableJobs(pushId);
              this.props.hideRunnableJobs();
            })
            .catch(e => {
              notify(formatTaskclusterError(e), 'danger', { sticky: true });
            });
        })
        .catch(e => {
          notify(formatTaskclusterError(e), 'danger', { sticky: true });
        });
    } else {
      notify('Must be logged in to trigger a job', 'danger');
    }
  };

  cancelAllJobs = () => {
    const { notify, repoName } = this.props;

    if (
      window.confirm(
        'This will cancel all pending and running jobs for this push. It cannot be undone! Are you sure?',
      )
    ) {
      const { push, isLoggedIn, getGeckoDecisionTaskId } = this.props;

      if (!isLoggedIn) return;

      JobModel.cancelAll(push.id, repoName, getGeckoDecisionTaskId, notify);
    }
  };

  pinAllShownJobs = () => {
    const {
      selectedJob,
      setSelectedJob,
      pinJobs,
      expandAllPushGroups,
      getAllShownJobs,
      notify,
      pushId,
    } = this.props;
    const shownJobs = getAllShownJobs(pushId);

    if (shownJobs.length) {
      expandAllPushGroups(() => {
        pinJobs(shownJobs);
        if (!selectedJob) {
          setSelectedJob(shownJobs[0]);
        }
      });
    } else {
      notify('No jobs available to pin', 'danger');
    }
  };

  togglePushCollapsed = () => {
    const { push, collapsed } = this.props;
    const pushId = `${push.id}`;
    const collapsedPushesParam = getUrlParam('collapsedPushes');
    const collapsedPushes = collapsedPushesParam
      ? new Set(collapsedPushesParam.split(','))
      : new Set();

    if (collapsed) {
      collapsedPushes.delete(pushId);
    } else {
      collapsedPushes.add(pushId);
    }
    setUrlParam(
      'collapsedPushes',
      collapsedPushes.size ? Array.from(collapsedPushes) : null,
    );
  };

  render() {
    const {
      repoName,
      isLoggedIn,
      pushId,
      jobCounts,
      author,
      revision,
      runnableVisible,
      watchState,
      showRunnableJobs,
      hideRunnableJobs,
      cycleWatchState,
      notificationSupported,
      selectedRunnableJobs,
      collapsed,
    } = this.props;
    const cancelJobsTitle = isLoggedIn
      ? 'Cancel all jobs'
      : 'Must be logged in to cancel jobs';
    const linkParams = this.getLinkParams();
    const revisionPushFilterUrl = getJobsUrl({ ...linkParams, revision });
    const authorPushFilterUrl = getJobsUrl({ ...linkParams, author });

    const watchStateLabel = {
      none: 'Watch',
      push: 'Notifying (per-push)',
      job: 'Notifying (per-job)',
    }[watchState];

    return (
      <div className="push-header">
        <div className="push-bar">
          <span className="push-left">
            <span className="push-title-left">
              <span
                onClick={this.togglePushCollapsed}
                className={`fa ${
                  collapsed ? 'fa-plus-square-o' : 'fa-minus-square-o'
                } mr-2 mt-2 text-muted pointable`}
                title={`${collapsed ? 'Expand' : 'Collapse'} push data`}
              />
              <span>
                <a href={revisionPushFilterUrl} title="View only this push">
                  {this.pushDateStr}{' '}
                  <span className="fa fa-external-link icon-superscript" />
                </a>{' '}
                -{' '}
              </span>
              <Author author={author} url={authorPushFilterUrl} />
            </span>
          </span>
          <PushCounts
            className="push-counts"
            pending={jobCounts.pending}
            running={jobCounts.running}
            completed={jobCounts.completed}
          />
          <span className="push-buttons">
            {jobCounts.pending + jobCounts.running > 0 && (
              <button
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
            <a
              className="btn btn-sm btn-push test-view-btn"
              href={`/testview.html?repo=${repoName}&revision=${revision}`}
              target="_blank"
              rel="noopener noreferrer"
              title="View details on failed test results for this push"
            >
              View Tests
            </a>
            {isLoggedIn && (
              <button
                className="btn btn-sm btn-push cancel-all-jobs-btn"
                title={cancelJobsTitle}
                onClick={this.cancelAllJobs}
              >
                <span className="fa fa-times-circle cancel-job-icon dim-quarter" />
              </button>
            )}
            <button
              className="btn btn-sm btn-push pin-all-jobs-btn"
              title="Pin all available jobs in this push"
              aria-label="Pin all available jobs in this push"
              onClick={this.pinAllShownJobs}
            >
              <span className="fa fa-thumb-tack" />
            </button>
            {!!selectedRunnableJobs.length && runnableVisible && (
              <button
                className="btn btn-sm btn-push trigger-new-jobs-btn"
                title="Trigger new jobs"
                onClick={this.triggerNewJobs}
              >
                Trigger New Jobs
              </button>
            )}
            <PushActionMenu
              isLoggedIn={isLoggedIn}
              runnableVisible={runnableVisible}
              revision={revision}
              repoName={repoName}
              pushId={pushId}
              showRunnableJobs={showRunnableJobs}
              hideRunnableJobs={hideRunnableJobs}
            />
          </span>
        </div>
      </div>
    );
  }
}

PushHeader.propTypes = {
  push: PropTypes.object.isRequired,
  pushId: PropTypes.number.isRequired,
  pushTimestamp: PropTypes.number.isRequired,
  author: PropTypes.string.isRequired,
  revision: PropTypes.string.isRequired,
  repoName: PropTypes.string.isRequired,
  filterModel: PropTypes.object.isRequired,
  runnableVisible: PropTypes.bool.isRequired,
  showRunnableJobs: PropTypes.func.isRequired,
  hideRunnableJobs: PropTypes.func.isRequired,
  cycleWatchState: PropTypes.func.isRequired,
  isLoggedIn: PropTypes.bool.isRequired,
  setSelectedJob: PropTypes.func.isRequired,
  pinJobs: PropTypes.func.isRequired,
  expandAllPushGroups: PropTypes.func.isRequired,
  notificationSupported: PropTypes.bool.isRequired,
  getAllShownJobs: PropTypes.func.isRequired,
  getGeckoDecisionTaskId: PropTypes.func.isRequired,
  selectedRunnableJobs: PropTypes.array.isRequired,
  collapsed: PropTypes.bool.isRequired,
  notify: PropTypes.func.isRequired,
  jobCounts: PropTypes.object.isRequired,
  watchState: PropTypes.string,
  selectedJob: PropTypes.object,
};

PushHeader.defaultProps = {
  selectedJob: null,
  watchState: 'none',
};

export default withNotifications(
  withPushes(withSelectedJob(withPinnedJobs(PushHeader))),
);
