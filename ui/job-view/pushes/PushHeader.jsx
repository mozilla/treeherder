import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import isEqual from 'lodash/isEqual';
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
import { Badge, Button } from 'reactstrap';

import { getPercentComplete, toDateStr } from '../../helpers/display';
import { formatTaskclusterError } from '../../helpers/errorMessage';
import { getJobsUrl } from '../../helpers/url';
import PushModel from '../../models/push';
import JobModel from '../../models/job';
import PushHealthStatus from '../../shared/PushHealthStatus';
import {
  getSelectedJobId,
  getUrlParam,
  setUrlParam,
} from '../../helpers/location';
import { notify } from '../redux/stores/notifications';
import { setSelectedJob } from '../redux/stores/selectedJob';
import { pinJobs } from '../redux/stores/pinnedJobs';

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
  const { pending, running, completed, fixedByCommit } = props;
  const inProgress = pending + running;
  const total = completed + inProgress;
  const percentComplete = getPercentComplete(props);

  return (
    <div>
      {fixedByCommit >= 1 && (
        <span
          className="badge badge-warning ml-1"
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

class PushHeader extends React.Component {
  constructor(props) {
    super(props);
    const { pushTimestamp } = this.props;

    this.pushDateStr = toDateStr(pushTimestamp);
  }

  shouldComponentUpdate(prevProps) {
    const {
      jobCounts: prevJobCounts,
      watchState: prevWatchState,
      isLoggedIn: prevIsLoggedIn,
      selectedRunnableJobs: prevSelectedRunnableJobs,
      runnableVisible: prevRunnableVisible,
      collapsed: prevCollapsed,
      pushHealthVisibility: prevPushHealthVisibility,
      filterModel: prevFilterModel,
      groupCountsExpanded: prevgroupCountsExpanded,
    } = prevProps;
    const {
      jobCounts,
      watchState,
      isLoggedIn,
      selectedRunnableJobs,
      runnableVisible,
      collapsed,
      pushHealthVisibility,
      filterModel,
      groupCountsExpanded,
    } = this.props;

    return (
      !isEqual(prevJobCounts, jobCounts) ||
      prevWatchState !== watchState ||
      prevIsLoggedIn !== isLoggedIn ||
      prevSelectedRunnableJobs !== selectedRunnableJobs ||
      prevRunnableVisible !== runnableVisible ||
      prevCollapsed !== collapsed ||
      prevPushHealthVisibility !== pushHealthVisibility ||
      prevFilterModel !== filterModel ||
      prevgroupCountsExpanded !== groupCountsExpanded
    );
  }

  getLinkParams() {
    const { filterModel } = this.props;

    return Object.entries(filterModel.getUrlParamsWithoutDefaults()).reduce(
      (acc, [field, values]) =>
        SKIPPED_LINK_PARAMS.includes(field) ? acc : { ...acc, [field]: values },
      {},
    );
  }

  triggerNewJobs = async () => {
    const {
      isLoggedIn,
      pushId,
      selectedRunnableJobs,
      hideRunnableJobs,
      notify,
      decisionTaskMap,
      currentRepo,
    } = this.props;

    if (
      !window.confirm(
        'This will trigger all selected jobs. Click "OK" if you want to proceed.',
      )
    ) {
      return;
    }
    if (isLoggedIn) {
      const { id: decisionTaskId } = decisionTaskMap[pushId];

      PushModel.triggerNewJobs(
        selectedRunnableJobs,
        decisionTaskId,
        currentRepo,
      )
        .then(result => {
          notify(result, 'success');
          hideRunnableJobs(pushId);
          this.props.hideRunnableJobs();
        })
        .catch(e => {
          notify(formatTaskclusterError(e), 'danger', { sticky: true });
        });
    } else {
      notify('Must be logged in to trigger a job', 'danger');
    }
  };

  cancelAllJobs = () => {
    if (
      window.confirm(
        'This will cancel all pending and running jobs for this push. It cannot be undone! Are you sure?',
      )
    ) {
      const {
        notify,
        push,
        isLoggedIn,
        decisionTaskMap,
        currentRepo,
      } = this.props;

      if (!isLoggedIn) return;

      JobModel.cancelAll(
        push.id,
        currentRepo,
        notify,
        decisionTaskMap[push.id],
      );
    }
  };

  pinAllShownJobs = () => {
    const {
      setSelectedJob,
      pinJobs,
      expandAllPushGroups,
      getAllShownJobs,
      notify,
      pushId,
    } = this.props;
    const shownJobs = getAllShownJobs(pushId);
    const selectedJobId = getSelectedJobId();

    if (shownJobs.length) {
      expandAllPushGroups(() => {
        pinJobs(shownJobs);
        if (!selectedJobId) {
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
      isLoggedIn,
      pushId,
      jobCounts,
      author,
      revision,
      runnableVisible,
      watchState,
      showRunnableJobs,
      hideRunnableJobs,
      showFuzzyJobs,
      cycleWatchState,
      notificationSupported,
      selectedRunnableJobs,
      collapsed,
      pushHealthVisibility,
      currentRepo,
      pushHealthStatusCallback,
    } = this.props;
    const cancelJobsTitle = isLoggedIn
      ? 'Cancel all jobs'
      : 'Must be logged in to cancel jobs';
    const linkParams = this.getLinkParams();
    const revisionPushFilterUrl = getJobsUrl({ ...linkParams, revision });
    const authorPushFilterUrl = getJobsUrl({ ...linkParams, author });
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
                onClick={this.togglePushCollapsed}
                icon={collapsed ? faPlusSquare : faMinusSquare}
                className="mr-2 mt-2 text-muted pointable"
                title={`${collapsed ? 'Expand' : 'Collapse'} push data`}
              />
              <span>
                <a href={revisionPushFilterUrl} title="View only this push">
                  {this.pushDateStr}{' '}
                  <FontAwesomeIcon
                    icon={faExternalLinkAlt}
                    className="icon-superscript"
                  />
                </a>{' '}
                -{' '}
              </span>
              <Author author={author} url={authorPushFilterUrl} />
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
            {isLoggedIn && (
              <button
                type="button"
                className="btn btn-sm btn-push cancel-all-jobs-btn"
                title={cancelJobsTitle}
                onClick={this.cancelAllJobs}
                aria-label={cancelJobsTitle}
              >
                <FontAwesomeIcon
                  icon={faTimesCircle}
                  className="dim-quarter"
                  title="Cancel jobs"
                />
              </button>
            )}
            <button
              type="button"
              className="btn btn-sm btn-push pin-all-jobs-btn"
              title="Pin all available jobs in this push"
              aria-label="Pin all available jobs in this push"
              onClick={this.pinAllShownJobs}
            >
              <FontAwesomeIcon icon={faThumbtack} title="Pin all jobs" />
            </button>
            {!!countSelectedRunnableJobs && runnableVisible && (
              <Button
                className="btn btn-sm btn-push trigger-new-jobs-btn"
                title="Trigger new jobs"
                onClick={this.triggerNewJobs}
              >
                Trigger
                <Badge color="info" className="mx-1">
                  {countSelectedRunnableJobs}
                </Badge>
                New Job{countSelectedRunnableJobs > 1 ? 's' : ''}
              </Button>
            )}
            <PushActionMenu
              isLoggedIn={isLoggedIn}
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
}

PushHeader.propTypes = {
  push: PropTypes.shape({
    id: PropTypes.number,
  }).isRequired,
  pushId: PropTypes.number.isRequired,
  pushTimestamp: PropTypes.number.isRequired,
  author: PropTypes.string.isRequired,
  revision: PropTypes.string.isRequired,
  filterModel: PropTypes.shape({}).isRequired,
  runnableVisible: PropTypes.bool.isRequired,
  showRunnableJobs: PropTypes.func.isRequired,
  hideRunnableJobs: PropTypes.func.isRequired,
  showFuzzyJobs: PropTypes.func.isRequired,
  cycleWatchState: PropTypes.func.isRequired,
  isLoggedIn: PropTypes.bool.isRequired,
  setSelectedJob: PropTypes.func.isRequired,
  pinJobs: PropTypes.func.isRequired,
  expandAllPushGroups: PropTypes.func.isRequired,
  notificationSupported: PropTypes.bool.isRequired,
  getAllShownJobs: PropTypes.func.isRequired,
  selectedRunnableJobs: PropTypes.arrayOf(PropTypes.object).isRequired,
  collapsed: PropTypes.bool.isRequired,
  notify: PropTypes.func.isRequired,
  jobCounts: PropTypes.shape({}).isRequired,
  pushHealthVisibility: PropTypes.string.isRequired,
  decisionTaskMap: PropTypes.shape({}).isRequired,
  watchState: PropTypes.string,
  pushHealthStatusCallback: PropTypes.func,
  currentRepo: PropTypes.shape({}).isRequired,
};

PushHeader.defaultProps = {
  watchState: 'none',
  pushHealthStatusCallback: null,
};

const mapStateToProps = ({ pushes: { decisionTaskMap } }) => ({
  decisionTaskMap,
});

export default connect(mapStateToProps, { notify, setSelectedJob, pinJobs })(
  PushHeader,
);
