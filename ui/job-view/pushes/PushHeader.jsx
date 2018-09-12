import React from 'react';
import PropTypes from 'prop-types';
import PushActionMenu from './PushActionMenu';
import { toDateStr } from '../../helpers/display';
import { formatTaskclusterError } from '../../helpers/errorMessage';
import { thEvents } from '../../js/constants';
import { getJobsUrl } from '../../helpers/url';
import PushModel from '../../models/push';

// url params we don't want added from the current querystring to the revision
// and author links.
const SKIPPED_LINK_PARAMS = [
  'revision', 'fromchange', 'tochange', 'nojobs', 'startdate', 'enddate', 'author',
];

function Author(props) {
  const authorMatch = props.author.match(/\<(.*?)\>+/);
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
  const percentComplete = total > 0 ?
    Math.floor(((completed / total) * 100)) : 0;

  return (
    <span className="push-progress">
      {percentComplete === 100 &&
      <span>- Complete -</span>
      }
      {percentComplete < 100 && total > 0 &&
        <span
          title="Proportion of jobs that are complete"
          data-job-clear-on-click
        >{percentComplete}% - {inProgress} in progress</span>
      }
    </span>
  );
}

PushCounts.propTypes = {
  pending: PropTypes.number.isRequired,
  running: PropTypes.number.isRequired,
  completed: PropTypes.number.isRequired,
};

export default class PushHeader extends React.PureComponent {
  constructor(props) {
    super(props);
    const { $injector, pushTimestamp } = this.props;

    this.$rootScope = $injector.get('$rootScope');
    this.thNotify = $injector.get('thNotify');
    this.ThResultSetStore = $injector.get('ThResultSetStore');

    this.pushDateStr = toDateStr(pushTimestamp);

    this.pinAllShownJobs = this.pinAllShownJobs.bind(this);
    this.cancelAllJobs = this.cancelAllJobs.bind(this);

    this.state = {
      runnableJobsSelected: false,
    };
  }

  componentWillMount() {
    this.triggerNewJobs = this.triggerNewJobs.bind(this);

    this.toggleRunnableJobUnlisten = this.$rootScope.$on(
      thEvents.selectRunnableJob, (ev, runnableJobs, pushId) => {
        if (this.props.pushId === pushId) {
          this.setState({ runnableJobsSelected: runnableJobs.length > 0 });
        }
      },
    );
  }

  componentWillUnmount() {
    this.toggleRunnableJobUnlisten();
  }

  getLinkParams() {
    const { filterModel } = this.props;

    return Object.entries(filterModel.getUrlParamsWithoutDefaults())
      .reduce((acc, [field, values]) => (
        SKIPPED_LINK_PARAMS.includes(field) ? acc : { ...acc, [field]: values }
      ), {});
  }

  triggerNewJobs() {
    const { isLoggedIn, pushId } = this.props;

    if (!window.confirm(
        'This will trigger all selected jobs. Click "OK" if you want to proceed.')) {
      return;
    }
    if (isLoggedIn) {
      const builderNames = this.ThResultSetStore.getSelectedRunnableJobs(pushId);
      this.ThResultSetStore.getGeckoDecisionTaskId(pushId)
        .then((decisionTaskID) => {
          PushModel.triggerNewJobs(builderNames, decisionTaskID).then((result) => {
            this.thNotify.send(result, 'success');
            this.ThResultSetStore.deleteRunnableJobs(pushId);
            this.props.hideRunnableJobsCb();
            this.setState({ runnableJobsSelected: false });
          }).catch((e) => {
            this.thNotify.send(formatTaskclusterError(e), 'danger', { sticky: true });
          });
        }).catch((e) => {
          this.thNotify.send(formatTaskclusterError(e), 'danger', { sticky: true });
        });
    } else {
      this.thNotify.send('Must be logged in to trigger a job', 'danger');
    }
  }

  async cancelAllJobs() {
    if (window.confirm('This will cancel all pending and running jobs for this push. It cannot be undone!. Are you sure?')) {
      const { push, isLoggedIn } = this.props;

      if (!isLoggedIn) return;

      const result = await (await PushModel.cancelAll(push.id));

      if (!result.ok) {
        return this.thNotify.send('Failed to cancel all jobs', 'danger', { sticky: true });
      }

      this.thNotify.send(
        `Request sent to cancel all jobs in push ${push.id}`,
        'success');
    }
  }

  pinAllShownJobs() {
    const shownJobs = this.ThResultSetStore.getAllShownJobs(this.props.pushId);
    this.$rootScope.$emit(thEvents.pinJobs, shownJobs);

    if (!this.$rootScope.selectedJob) {
      this.$rootScope.$emit(thEvents.jobClick, shownJobs[0]);
    }
  }

  render() {
    const { repoName, isLoggedIn, pushId, isStaff, jobCounts, author,
            revision, runnableVisible, $injector, watchState,
            showRunnableJobsCb, hideRunnableJobsCb, cycleWatchState,
            notificationSupported } = this.props;
    const cancelJobsTitle = isLoggedIn ?
      'Cancel all jobs' :
      'Must be logged in to cancel jobs';
    const counts = jobCounts || { pending: 0, running: 0, completed: 0 };
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
        <div className="push-bar" data-job-clear-on-click>
          <span className="push-left" data-job-clear-on-click>
            <span className="push-title-left">
              <span>
                <a
                  href={revisionPushFilterUrl}
                  title="View only this push"
                >{this.pushDateStr} <span className="fa fa-external-link icon-superscript" />
                </a> - </span>
              <Author author={author} url={authorPushFilterUrl} />
            </span>
          </span>
          <PushCounts
            className="push-counts"
            pending={counts.pending}
            running={counts.running}
            completed={counts.completed}
          />
          <span className="push-buttons">
            {counts.pending + counts.running > 0 &&
              <button
                className="btn btn-sm btn-push watch-commit-btn"
                disabled={!notificationSupported}
                title={notificationSupported ? 'Get Desktop Notifications for this Push' : 'Desktop notifications not supported in this browser'}
                data-watch-state={watchState}
                onClick={() => cycleWatchState()}
              >{watchStateLabel}</button>}
            <a
              className="btn btn-sm btn-push test-view-btn"
              href={`/testview.html?repo=${repoName}&revision=${revision}`}
              target="_blank"
              rel="noopener noreferrer"
              title="View details on failed test results for this push"
            >View Tests</a>
            {isLoggedIn &&
              <button
                className="btn btn-sm btn-push cancel-all-jobs-btn"
                title={cancelJobsTitle}
                onClick={this.cancelAllJobs}
              >
                <span
                  className="fa fa-times-circle cancel-job-icon dim-quarter"
                />
              </button>
            }
            <button
              className="btn btn-sm btn-push pin-all-jobs-btn"
              title="Pin all available jobs in this push"
              aria-label="Pin all available jobs in this push"
              onClick={this.pinAllShownJobs}
            >
              <span
                className="fa fa-thumb-tack"
              />
            </button>
            {this.state.runnableJobsSelected && runnableVisible &&
              <button
                className="btn btn-sm btn-push trigger-new-jobs-btn"
                title="Trigger new jobs"
                onClick={this.triggerNewJobs}
              >Trigger New Jobs</button>
            }
            <PushActionMenu
              isLoggedIn={isLoggedIn}
              isStaff={isStaff || false}
              runnableVisible={runnableVisible}
              revision={revision}
              repoName={repoName}
              pushId={pushId}
              $injector={$injector}
              showRunnableJobsCb={showRunnableJobsCb}
              hideRunnableJobsCb={hideRunnableJobsCb}
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
  $injector: PropTypes.object.isRequired,
  filterModel: PropTypes.object.isRequired,
  runnableVisible: PropTypes.bool.isRequired,
  showRunnableJobsCb: PropTypes.func.isRequired,
  hideRunnableJobsCb: PropTypes.func.isRequired,
  cycleWatchState: PropTypes.func.isRequired,
  isLoggedIn: PropTypes.bool.isRequired,
  isStaff: PropTypes.bool.isRequired,
  notificationSupported: PropTypes.bool.isRequired,
  jobCounts: PropTypes.object,
  watchState: PropTypes.string,
};

PushHeader.defaultProps = {
  jobCounts: null,
  watchState: 'none',
};
