import React from "react";
import PropTypes from 'prop-types';
import { Alert } from 'reactstrap';
import PushActionMenu from './PushActionMenu';

const Author = (props) => {
  const authorMatch = props.author.match(/\<(.*?)\>+/);
  const authorEmail = authorMatch ? authorMatch[1] : props.author;

  return (
    <span title="View pushes by this user" className="push-author">
      <a href={props.url} data-ignore-job-clear-on-click>{authorEmail}</a>
    </span>
  );
};

const PushCounts = (props) => {
  const { pending, running, completed } = props;
  const inProgress = pending + running;
  const total = completed + inProgress;
  const percentComplete = total > 0 ?
    Math.floor(((completed / total) * 100)) : undefined;

  return (
    <span className="push-progress">
      {percentComplete === 100 ?
        <span>- Complete -</span> :
        <span
          title="Proportion of jobs that are complete"
        >{percentComplete}% - {inProgress} in progress</span>
      }
    </span>
  );
};

export default class PushHeader extends React.PureComponent {

  constructor(props) {
    super(props);
    const { $injector, pushTimestamp, urlBasePath, repoName, revision, author } = this.props;

    this.$rootScope = $injector.get('$rootScope');
    this.thEvents = $injector.get('thEvents');
    this.thJobFilters = $injector.get('thJobFilters');
    this.thNotify = $injector.get('thNotify');
    this.thPinboard = $injector.get('thPinboard');
    this.thPinboardCountError = $injector.get('thPinboardCountError');
    this.thBuildApi = $injector.get('thBuildApi');
    this.ThResultSetStore = $injector.get('ThResultSetStore');
    this.ThResultSetModel = $injector.get('ThResultSetModel');
    this.ThModelErrors = $injector.get('ThModelErrors');
    this.ThTaskclusterErrors = $injector.get('ThTaskclusterErrors');

    const dateFormat = { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false };
    this.pushDateStr = new Date(pushTimestamp*1000).toLocaleString("en-US", dateFormat);
    this.revisionPushFilterUrl = `${urlBasePath}?repo=${repoName}&revision=${revision}`;
    this.authorPushFilterUrl = `${urlBasePath}?repo=${repoName}&author=${encodeURIComponent(author)}`;

    this.pinAllShownJobs = this.pinAllShownJobs.bind(this);
    this.triggerNewJobs = this.triggerNewJobs.bind(this);
    this.cancelAllJobs = this.cancelAllJobs.bind(this);

    this.state = {
      showConfirmCancelAll: false,
      runnableJobsSelected: false,
    };
  }

  componentWillMount() {
    this.toggleRunnableJobUnlisten = this.$rootScope.$on(
      this.thEvents.selectRunnableJob, (ev, runnableJobs, pushId) => {
        if (this.props.pushId === pushId) {
          this.setState({ runnableJobsSelected: runnableJobs.length > 0 });
        }
      }
    );
  }

  componentWillUnmount() {
    this.toggleRunnableJobUnlisten();
  }

  filterParams() {
    return Object.entries(this.thJobFilters.getActiveFilters())
      .reduce((acc, [key, value]) => `&${key}=${value}`, "");
  }

  triggerNewJobs() {
    const { repoName, loggedIn, pushId } = this.props;

    if (!window.confirm(
        'This will trigger all selected jobs. Click "OK" if you want to proceed.')) {
      return;
    }
    if (loggedIn) {
      const builderNames = this.ThResultSetStore.getSelectedRunnableJobs(repoName, pushId);
      this.ThResultSetStore.getGeckoDecisionTaskId(repoName, pushId).then((decisionTaskID) => {
        this.ThResultSetModel.triggerNewJobs(builderNames, decisionTaskID).then((result) => {
          this.thNotify.send(result, "success");
          this.ThResultSetStore.deleteRunnableJobs(repoName, pushId);
          this.props.hideRunnableJobsCb();
          this.setState({ runnableJobsSelected: false });
        }, (e) => {
          this.thNotify.send(this.ThTaskclusterErrors.format(e), 'danger', { sticky: true });
        });
      });
    } else {
      this.thNotify.send("Must be logged in to trigger a job", 'danger');
    }
  }

  cancelAllJobs() {
    const { repoName, revision, isTryRepo, isStaff, pushId } = this.props;

    this.setState({ showConfirmCancelAll: false });
    if (!(isTryRepo || isStaff)) return;

    this.ThResultSetModel.cancelAll(pushId, repoName).then(() => (
        this.thBuildApi.cancelAll(repoName, revision)
    )).catch((e) => {
        this.thNotify.send(
          this.ThModelErrors.format(e, "Failed to cancel all jobs"),
          'danger', true
        );
    });
  }

  pinAllShownJobs() {
    if (!this.thPinboard.spaceRemaining()) {
      this.thNotify.send(this.thPinboardCountError, 'danger');
      return;
    }
    const shownJobs = this.ThResultSetStore.getAllShownJobs(
      this.props.repoName,
      this.thPinboard.spaceRemaining(),
      this.thPinboardCountError,
      this.props.pushId
    );
    this.thPinboard.pinJobs(shownJobs);

    if (!this.$rootScope.selectedJob) {
      this.$rootScope.$emit(this.thEvents.jobClick, shownJobs[0]);
    }
  }

  render() {
    const { repoName, loggedIn, pushId, isTryRepo, isStaff, jobCounts, author,
            revision, runnableVisible, $injector,
            showRunnableJobsCb, hideRunnableJobsCb } = this.props;

    const cancelJobsTitle = loggedIn ?
      "Cancel all jobs" :
      "Must be logged in to cancel jobs";
    const canCancelJobs = isTryRepo || isStaff;
    const counts = jobCounts || { pending: 0, running: 0, completed: 0 };

    return (
      <div className="push-header">
        <div className="push-bar" key="push-header">
          <span className="push-left">
            <span className="push-title-left">
              <span>
                <a
                  href={`${this.revisionPushFilterUrl}${this.filterParams()}`}
                  title="View only this push"
                  data-ignore-job-clear-on-click
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
            <a
              className="btn btn-sm btn-push test-view-btn"
              href={`/testview.html?repo=${repoName}&revision=${revision}`}
              target="_blank"
              title="View details on failed test results for this push"
            >View Tests</a>
            {canCancelJobs &&
              <button
                className="btn btn-sm btn-push cancel-all-jobs-btn"
                title={cancelJobsTitle}
                data-ignore-job-clear-on-click
                onClick={() => this.setState({ showConfirmCancelAll: true })}
              >
                <span
                  className="fa fa-times-circle cancel-job-icon dim-quarter"
                  data-ignore-job-clear-on-click
                />
              </button>
            }
            <button
              className="btn btn-sm btn-push pin-all-jobs-btn"
              title="Pin all available jobs in this push"
              data-ignore-job-clear-on-click
              onClick={this.pinAllShownJobs}
            >
              <span
                className="fa fa-thumb-tack"
                data-ignore-job-clear-on-click
              />
            </button>
            {this.state.runnableJobsSelected && runnableVisible &&
              <button
                className="btn btn-sm btn-push trigger-new-jobs-btn"
                title="Trigger new jobs"
                data-ignore-job-clear-on-click
                onClick={this.triggerNewJobs}
              >Trigger New Jobs</button>
            }
            <PushActionMenu
              loggedIn={loggedIn}
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
  jobCounts: PropTypes.object,
  loggedIn: PropTypes.bool,
  isStaff: PropTypes.bool,
  repoName: PropTypes.string.isRequired,
  isTryRepo: PropTypes.bool,
  urlBasePath: PropTypes.string,
  $injector: PropTypes.object.isRequired,
  runnableVisible: PropTypes.bool.isRequired,
  showRunnableJobsCb: PropTypes.func.isRequired,
  hideRunnableJobsCb: PropTypes.func.isRequired,
};

