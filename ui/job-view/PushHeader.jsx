import React from 'react';
import PropTypes from 'prop-types';
import { Alert } from 'reactstrap';
import PushActionMenu from './PushActionMenu';
import { toDateStr } from '../helpers/display';
import { formatModelError, formatTaskclusterError } from '../helpers/errorMessage';
import { thEvents } from '../js/constants';

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
    const { $injector, pushTimestamp, urlBasePath, repoName, revision, author } = this.props;

    this.$rootScope = $injector.get('$rootScope');
    this.thJobFilters = $injector.get('thJobFilters');
    this.thNotify = $injector.get('thNotify');
    this.thBuildApi = $injector.get('thBuildApi');
    this.ThResultSetStore = $injector.get('ThResultSetStore');
    this.ThResultSetModel = $injector.get('ThResultSetModel');

    this.pushDateStr = toDateStr(pushTimestamp);
    this.revisionPushFilterUrl = `${urlBasePath}?repo=${repoName}&revision=${revision}`;
    this.authorPushFilterUrl = `${urlBasePath}?repo=${repoName}&author=${encodeURIComponent(author)}`;

    this.pinAllShownJobs = this.pinAllShownJobs.bind(this);
    this.triggerNewJobs = this.triggerNewJobs.bind(this);
    this.cancelAllJobs = this.cancelAllJobs.bind(this);

    this.state = {
      showConfirmCancelAll: false,
      runnableJobsSelected: false,
      filterParams: this.getFilterParams(),
    };
  }

  componentWillMount() {
    this.toggleRunnableJobUnlisten = this.$rootScope.$on(
      thEvents.selectRunnableJob, (ev, runnableJobs, pushId) => {
        if (this.props.pushId === pushId) {
          this.setState({ runnableJobsSelected: runnableJobs.length > 0 });
        }
      },
    );
    this.globalFilterChangedUnlisten = this.$rootScope.$on(
      thEvents.globalFilterChanged, () => {
        this.setState({ filterParams: this.getFilterParams() });
      },
    );
  }

  componentWillUnmount() {
    this.toggleRunnableJobUnlisten();
    this.globalFilterChangedUnlisten();
  }

  getFilterParams() {
    return Object.entries(this.thJobFilters.getActiveFilters())
      .reduce(function getFilterParamsStrings(acc, [key, value]) {
        if (Array.isArray(value)) {
          acc += value.reduce((valuesStr, valueItem) => valuesStr + `&${key}=${valueItem}`, '');
        } else {
          acc += `&${key}=${value}`;
        }
        return acc;
      },
        '');
  }

  triggerNewJobs() {
    const { isLoggedIn, pushId } = this.props;

    if (!window.confirm(
        'This will trigger all selected jobs. Click "OK" if you want to proceed.')) {
      return;
    }
    if (isLoggedIn) {
      const builderNames = this.ThResultSetStore.getSelectedRunnableJobs(pushId);
      this.ThResultSetStore.getGeckoDecisionTaskId(pushId).then((decisionTaskID) => {
        this.ThResultSetModel.triggerNewJobs(builderNames, decisionTaskID).then((result) => {
          this.thNotify.send(result, 'success');
          this.ThResultSetStore.deleteRunnableJobs(pushId);
          this.props.hideRunnableJobsCb();
          this.setState({ runnableJobsSelected: false });
        }, (e) => {
          this.thNotify.send(formatTaskclusterError(e), 'danger', { sticky: true });
        });
      });
    } else {
      this.thNotify.send('Must be logged in to trigger a job', 'danger');
    }
  }

  cancelAllJobs() {
    const { repoName, revision, isLoggedIn, pushId } = this.props;

    this.setState({ showConfirmCancelAll: false });
    if (!isLoggedIn) return;

    this.ThResultSetModel.cancelAll(pushId).then(() => (
        this.thBuildApi.cancelAll(repoName, revision)
    )).catch((e) => {
      this.thNotify.send(
          formatModelError(e, 'Failed to cancel all jobs'),
          'danger',
          { sticky: true },
        );
    });
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
            revision, runnableVisible, $injector, watchState, history,
            showRunnableJobsCb, hideRunnableJobsCb, cycleWatchState } = this.props;
    const { filterParams } = this.state;
    const cancelJobsTitle = isLoggedIn ?
      'Cancel all jobs' :
      'Must be logged in to cancel jobs';
    const counts = jobCounts || { pending: 0, running: 0, completed: 0 };

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
                  href={`${this.revisionPushFilterUrl}${filterParams}`}
                  title="View only this push"
                >{this.pushDateStr} <span className="fa fa-external-link icon-superscript" />
                </a> - </span>
              <Author author={author} url={this.authorPushFilterUrl} />
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
              title="Get Desktop Notifications for this Push"
              data-watch-state={watchState}
              onClick={() => cycleWatchState()}
            >{watchStateLabel}</button>}
            <a
              className="btn btn-sm btn-push test-view-btn"
              href={`/testview.html?repo=${repoName}&revision=${revision}`}
              target="_blank"
              rel="noopener"
              title="View details on failed test results for this push"
            >View Tests</a>
            {isLoggedIn &&
              <button
                className="btn btn-sm btn-push cancel-all-jobs-btn"
                title={cancelJobsTitle}
                onClick={() => this.setState({ showConfirmCancelAll: true })}
              >
                <span
                  className="fa fa-times-circle cancel-job-icon dim-quarter"
                />
              </button>
            }
            <button
              className="btn btn-sm btn-push pin-all-jobs-btn"
              title="Pin all available jobs in this push"
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
              history={history}
            />
          </span>
        </div>
        {this.state.showConfirmCancelAll &&
          <div
            className="cancel-all-jobs-confirm animate-show"
            key="cancelConfirm"
          >
            <Alert color="danger" toggle={() => this.setState({ showConfirmCancelAll: false })}>
              <span className="fa fa-exclamation-triangle" />
              <span> This action will cancel all pending and running jobs for this push. <i>It cannot be undone!</i>
              </span>
              <button
                onClick={this.cancelAllJobs}
                className="btn btn-xs btn-danger cancel-all-jobs-confirm-btn"
              >Confirm</button>
            </Alert>
          </div>
        }
      </div>
    );
  }
}

PushHeader.propTypes = {
  pushId: PropTypes.number.isRequired,
  pushTimestamp: PropTypes.number.isRequired,
  author: PropTypes.string.isRequired,
  revision: PropTypes.string.isRequired,
  repoName: PropTypes.string.isRequired,
  $injector: PropTypes.object.isRequired,
  runnableVisible: PropTypes.bool.isRequired,
  showRunnableJobsCb: PropTypes.func.isRequired,
  hideRunnableJobsCb: PropTypes.func.isRequired,
  cycleWatchState: PropTypes.func.isRequired,
  history: PropTypes.object.isRequired,
  jobCounts: PropTypes.object,
  watchState: PropTypes.string,
  isLoggedIn: PropTypes.bool,
  isStaff: PropTypes.bool,
  urlBasePath: PropTypes.string,
};

PushHeader.defaultProps = {
  jobCounts: null,
  watchState: 'none',
  isLoggedIn: false,
  isStaff: false,
  urlBasePath: '',
};
