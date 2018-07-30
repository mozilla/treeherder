import React from 'react';
import PropTypes from 'prop-types';
import { Queue, slugid } from 'taskcluster-client-web';
import $ from 'jquery';
import jsyaml from 'js-yaml';

import thTaskcluster from '../../../js/services/taskcluster';
import tcJobActionsTemplate from '../../../partials/main/tcjobactions.html';
import { thEvents } from '../../../js/constants';
import { formatModelError, formatTaskclusterError } from '../../../helpers/errorMessage';
import { isReftest } from '../../../helpers/job';
import { getInspectTaskUrl, getReftestUrl } from '../../../helpers/url';
import JobDetailModel from '../../../models/jobDetail';
import JobModel from '../../../models/job';

import LogUrls from './LogUrls';

export default class ActionBar extends React.Component {
  constructor(props) {
    super(props);

    const { $injector } = this.props;

    this.thNotify = $injector.get('thNotify');
    this.thBuildApi = $injector.get('thBuildApi');
    this.ThResultSetStore = $injector.get('ThResultSetStore');
    this.tcactions = $injector.get('tcactions');
    this.$interpolate = $injector.get('$interpolate');
    this.$uibModal = $injector.get('$uibModal');
    this.$rootScope = $injector.get('$rootScope');
    this.$timeout = $injector.get('$timeout');
  }

  componentDidMount() {
    const { logParseStatus } = this.props;

    // Open the logviewer and provide notifications if it isn't available
    this.openLogViewerUnlisten = this.$rootScope.$on(thEvents.openLogviewer, () => {
      switch (logParseStatus) {
        case 'pending':
          this.thNotify.send('Log parsing in progress, log viewer not yet available', 'info'); break;
        case 'failed':
          this.thNotify.send('Log parsing has failed, log viewer is unavailable', 'warning'); break;
        case 'unavailable':
          this.thNotify.send('No logs available for this job', 'info'); break;
        case 'parsed':
          $('.logviewer-btn')[0].click();
      }
      this.$rootScope.$apply();
    });

    this.jobRetriggerUnlisten = this.$rootScope.$on(thEvents.jobRetrigger, (event, job) => {
        this.retriggerJob([job]);
    });

    this.customJobAction = this.customJobAction.bind(this);
  }

  componentWillUnmount() {
    this.openLogViewerUnlisten();
    this.jobRetriggerUnlisten();
  }

  canCancel() {
    const { selectedJob } = this.props;
    return selectedJob.state === 'pending' || selectedJob.state === 'running';
  }

  retriggerJob(jobs) {
    const { user, repoName } = this.props;

    if (user.isLoggedIn) {
        // Spin the retrigger button when retriggers happen
        $('#retrigger-btn > span').removeClass('action-bar-spin');
        window.requestAnimationFrame(function () {
            window.requestAnimationFrame(function () {
                $('#retrigger-btn > span').addClass('action-bar-spin');
            });
        });

        const job_id_list = jobs.map(job => job.id);
        // The logic here is somewhat complicated because we need to support
        // two use cases the first is the case where we notify a system other
        // then buildbot that a retrigger has been requested (eg mozilla-taskcluster).
        // The second is when we have the buildapi id and need to send a request
        // to the self serve api (which does not listen over pulse!).
        JobModel.retrigger(repoName, job_id_list).then(() => (
            JobDetailModel.getJobDetails({
                title: 'buildbot_request_id',
                repository: repoName,
                job_id__in: job_id_list.join(',') })
            .then((data) => {
                const requestIdList = data.map(datum => datum.value);
                requestIdList.forEach((requestId) => {
                    this.thBuildApi.retriggerJob(repoName, requestId);
                });
            })
        ).then(() => {
            this.$timeout(this.thNotify.send('Retrigger request sent', 'success'));
        }, (e) => {
            // Generic error eg. the user doesn't have LDAP access
            this.$timeout(this.thNotify.send(
                formatModelError(e, 'Unable to send retrigger'), 'danger'));
        }));
    } else {
        this.$timeout(this.thNotify.send('Must be logged in to retrigger a job', 'danger'));
    }
  }

  backfillJob() {
    const { user, selectedJob, repoName } = this.props;

    if (!this.canBackfill()) {
      return;
    }
    if (!user.isLoggedIn) {
      this.thNotify.send('Must be logged in to backfill a job', 'danger');
      this.$rootScope.$apply();
      return;
    }
    if (!selectedJob.id) {
      this.thNotify.send('Job not yet loaded for backfill', 'warning');
      this.$rootScope.$apply();
      return;
    }

    if (selectedJob.build_system_type === 'taskcluster' || selectedJob.reason.startsWith('Created by BBB for task')) {
      this.ThResultSetStore.getGeckoDecisionTaskId(
        selectedJob.result_set_id).then(decisionTaskId => (
          this.tcactions.load(decisionTaskId, selectedJob).then((results) => {
            const actionTaskId = slugid();
            if (results) {
              const backfilltask = results.actions.find(result => result.name === 'backfill');
              // We'll fall back to actions.yaml if this isn't true
              if (backfilltask) {
                return this.tcactions.submit({
                  action: backfilltask,
                  actionTaskId,
                  decisionTaskId,
                  taskId: results.originalTaskId,
                  task: results.originalTask,
                  input: {},
                  staticActionVariables: results.staticActionVariables,
                }).then(() => {
                  this.$timeout(() => this.thNotify.send(
                    `Request sent to backfill job via actions.json (${actionTaskId})`,
                    'success'),
                  );
                }, (e) => {
                  // The full message is too large to fit in a Treeherder
                  // notification box.
                  this.$timeout(() => this.thNotify.send(
                    formatTaskclusterError(e),
                    'danger',
                    { sticky: true }),
                  );
                });
              }
            }

            // Otherwise we'll figure things out with actions.yml
            const queue = new Queue({ credentialAgent: thTaskcluster.getAgent() });

            // buildUrl is documented at
            // https://github.com/taskcluster/taskcluster-client-web#construct-urls
            // It is necessary here because getLatestArtifact assumes it is getting back
            // JSON as a reponse due to how the client library is constructed. Since this
            // result is yml, we'll fetch it manually using $http and can use the url
            // returned by this method.
            const url = queue.buildUrl(
              queue.getLatestArtifact,
              decisionTaskId,
              'public/action.yml',
            );
            fetch(url).then((resp) => {
              let action = resp.data;
              const template = this.$interpolate(action);
              action = template({
                action: 'backfill',
                action_args: `--project=${repoName}' --job=${selectedJob.id}`,
              });

              const task = thTaskcluster.refreshTimestamps(jsyaml.safeLoad(action));
              queue.createTask(actionTaskId, task).then(function () {
                this.$timeout(() => this.thNotify.send(
                  `Request sent to backfill job via actions.yml (${actionTaskId})`,
                  'success'),
                );
              }, (e) => {
                // The full message is too large to fit in a Treeherder
                // notification box.
                this.$timeout(() => this.thNotify.send(
                  formatTaskclusterError(e),
                  'danger',
                  { sticky: true }),
                );
              });
            });
          })
      ));
    } else {
      this.thNotify.send('Unable to backfill this job type!', 'danger', { sticky: true });
      this.$rootScope.$apply();
    }
  }

  // Can we backfill? At the moment, this only ensures we're not in a 'try' repo.
  canBackfill() {
    const { user, isTryRepo } = this.props;

    return user.isLoggedIn && !isTryRepo;
  }

  backfillButtonTitle() {
    const { user, isTryRepo } = this.props;
    let title = '';

    if (!user.isLoggedIn) {
      title = title.concat('must be logged in to backfill a job / ');
    }

    if (isTryRepo) {
      title = title.concat('backfill not available in this repository');
    }

    if (title === '') {
      title = 'Trigger jobs of ths type on prior pushes ' +
        'to fill in gaps where the job was not run';
    } else {
      // Cut off trailing '/ ' if one exists, capitalize first letter
      title = title.replace(/\/ $/, '');
      title = title.replace(/^./, l => l.toUpperCase());
    }
    return title;
  }

  cancelJobs(jobs) {
    const { repoName } = this.props;
    const jobIdsToCancel = jobs.filter(job => (job.state === 'pending' ||
      job.state === 'running')).map(
      job => job.id);
    // get buildbot ids of any buildbot jobs we want to cancel
    // first
    JobDetailModel.getJobDetails({
      job_id__in: jobIdsToCancel,
      title: 'buildbot_request_id',
    }).then(buildbotRequestIdDetails => (
      JobModel.cancel(repoName, jobIdsToCancel).then(
        () => {
          buildbotRequestIdDetails.forEach(
            (buildbotRequestIdDetail) => {
              const requestId = parseInt(buildbotRequestIdDetail.value);
              this.thBuildApi.cancelJob(repoName, requestId);
            });
        })
    )).then(() => {
      this.thNotify.send('Cancel request sent', 'success');
      this.$rootScope.$apply();
    }).catch(function (e) {
      this.thNotify.send(
        formatModelError(e, 'Unable to cancel job'),
        'danger',
        { sticky: true },
      );
      this.$rootScope.$apply();
    });
  }

  cancelJob() {
    this.cancelJobs([this.props.selectedJob]);
  }

  customJobAction() {
    const { repoName, selectedJob } = this.props;

    this.$uibModal.open({
      template: tcJobActionsTemplate,
      controller: 'TCJobActionsCtrl',
      size: 'lg',
      resolve: {
        job: () => selectedJob,
        repoName: () => repoName,
        resultsetId: () => selectedJob.result_set_id,
      },
    });
  }

  render() {
    const { selectedJob, logViewerUrl, logViewerFullUrl, jobLogUrls, user, pinJob } = this.props;

    return (
      <div id="job-details-actionbar">
        <nav className="navbar navbar-dark details-panel-navbar">
          <ul className="nav navbar-nav actionbar-nav">

            <LogUrls
              logUrls={jobLogUrls}
              logViewerUrl={logViewerUrl}
              logViewerFullUrl={logViewerFullUrl}
            />
            <li>
              <span
                id="pin-job-btn"
                title="Add this job to the pinboard"
                className="btn icon-blue"
                onClick={() => pinJob(selectedJob)}
              ><span className="fa fa-thumb-tack" /></span>
            </li>
            <li>
              <span
                id="retrigger-btn"
                title={user.isLoggedIn ? 'Repeat the selected job' : 'Must be logged in to retrigger a job'}
                className={`btn ${user.isLoggedIn ? 'icon-green' : 'disabled'}`}
                disabled={!user.isLoggedIn}
                onClick={() => this.retriggerJob([selectedJob])}
              ><span className="fa fa-repeat" /></span>
            </li>
            {isReftest(selectedJob) && jobLogUrls.map(jobLogUrl => (<li key={`reftest-${jobLogUrl.id}`}>
              <a
                title="Launch the Reftest Analyser in a new window"
                target="_blank"
                rel="noopener noreferrer"
                href={getReftestUrl(jobLogUrl.url)}
              ><span className="fa fa-bar-chart-o" /></a>
            </li>))}
            {this.canCancel() && <li>
              <a
                title={user.isLoggedIn ? 'Cancel this job' : 'Must be logged in to cancel a job'}
                className={user.isLoggedIn ? 'hover-warning' : 'disabled'}
                onClick={() => this.cancelJob()}
              ><span className="fa fa-times-circle cancel-job-icon" /></a>
            </li>}
          </ul>
          <ul className="nav navbar-right">
            <li className="dropdown">
              <span
                id="actionbar-menu-btn"
                title="Other job actions"
                aria-haspopup="true"
                aria-expanded="false"
                className="dropdown-toggle"
                data-toggle="dropdown"
              ><span className="fa fa-ellipsis-h" aria-hidden="true" /></span>
              <ul className="dropdown-menu actionbar-menu" role="menu">
                <li>
                  <span
                    id="backfill-btn"
                    className={`btn dropdown-item ${!user.isLoggedIn || !this.canBackfill() ? 'disabled' : ''}`}
                    title={this.backfillButtonTitle()}
                    onClick={() => !this.canBackfill() || this.backfillJob()}
                  >Backfill</span>
                </li>
                {selectedJob.taskcluster_metadata && <React.Fragment>
                  <li>
                    <a
                      target="_blank"
                      rel="noopener noreferrer"
                      className="dropdown-item"
                      href={getInspectTaskUrl(selectedJob.taskcluster_metadata.task_id)}
                    >Inspect Task</a>
                  </li>
                  <li>
                    <a
                      target="_blank"
                      rel="noopener noreferrer"
                      className="dropdown-item"
                      href={`${getInspectTaskUrl(selectedJob.taskcluster_metadata.task_id)}/create`}
                    >Edit and Retrigger</a>
                  </li>
                  <li>
                    <a
                      target="_blank"
                      rel="noopener noreferrer"
                      className="dropdown-item"
                      href={`https://tools.taskcluster.net/tasks/${selectedJob.taskcluster_metadata.task_id}/interactive`}
                    >Create Interactive Task</a>
                  </li>
                  <li>
                    <a
                      onClick={this.customJobAction}
                      className="dropdown-item"
                    >Custom Action...</a>
                  </li>
                </React.Fragment>}
              </ul>
            </li>
          </ul>
        </nav>
      </div>
    );
  }
}

ActionBar.propTypes = {
  pinJob: PropTypes.func.isRequired,
  $injector: PropTypes.object.isRequired,
  user: PropTypes.object.isRequired,
  repoName: PropTypes.string.isRequired,
  selectedJob: PropTypes.object.isRequired,
  logParseStatus: PropTypes.string.isRequired,
  jobLogUrls: PropTypes.array,
  isTryRepo: PropTypes.bool,
  logViewerUrl: PropTypes.string,
  logViewerFullUrl: PropTypes.string,
};

ActionBar.defaultProps = {
  isTryRepo: true, // default to more restrictive for backfilling
  logViewerUrl: null,
  logViewerFullUrl: null,
  jobLogUrls: [],
};
