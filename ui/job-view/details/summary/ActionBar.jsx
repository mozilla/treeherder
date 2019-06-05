import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Button } from 'reactstrap';
import $ from 'jquery';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartBar } from '@fortawesome/free-regular-svg-icons';
import {
  faEllipsisH,
  faRedo,
  faThumbtack,
  faTimesCircle,
} from '@fortawesome/free-solid-svg-icons';

import { thEvents } from '../../../helpers/constants';
import { formatTaskclusterError } from '../../../helpers/errorMessage';
import { isReftest, isPerfTest } from '../../../helpers/job';
import { getInspectTaskUrl, getReftestUrl } from '../../../helpers/url';
import JobModel from '../../../models/job';
import TaskclusterModel from '../../../models/taskcluster';
import CustomJobActions from '../../CustomJobActions';
import { withPinnedJobs } from '../../context/PinnedJobs';
import { withPushes } from '../../context/Pushes';
import { notify } from '../../redux/stores/notifications';

import LogUrls from './LogUrls';

class ActionBar extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      customJobActionsShowing: false,
    };
  }

  componentDidMount() {
    window.addEventListener(thEvents.openLogviewer, this.onOpenLogviewer);
    window.addEventListener(thEvents.jobRetrigger, this.onRetriggerJob);
  }

  componentWillUnmount() {
    window.removeEventListener(thEvents.openLogviewer, this.onOpenLogviewer);
    window.removeEventListener(thEvents.jobRetrigger, this.onRetriggerJob);
  }

  onRetriggerJob = event => {
    this.retriggerJob([event.detail.job]);
  };

  // Open the logviewer and provide notifications if it isn't available
  onOpenLogviewer = () => {
    const { logParseStatus, notify } = this.props;

    switch (logParseStatus) {
      case 'pending':
        notify('Log parsing in progress, log viewer not yet available', 'info');
        break;
      case 'failed':
        notify('Log parsing has failed, log viewer is unavailable', 'warning');
        break;
      case 'skipped-size':
        notify('Log parsing was skipped, log viewer is unavailable', 'warning');
        break;
      case 'unavailable':
        notify('No logs available for this job', 'info');
        break;
      case 'parsed':
        $('.logviewer-btn')[0].click();
    }
  };

  canCancel = () => {
    const { selectedJob } = this.props;
    return selectedJob.state === 'pending' || selectedJob.state === 'running';
  };

  createGeckoProfile = () => {
    const { user, selectedJob, getGeckoDecisionTaskId, notify } = this.props;
    if (!user.isLoggedIn) {
      return notify('Must be logged in to create a gecko profile', 'danger');
    }

    getGeckoDecisionTaskId(selectedJob.push_id).then(decisionTaskId =>
      TaskclusterModel.load(decisionTaskId, selectedJob).then(results => {
        const geckoprofile = results.actions.find(
          result => result.name === 'geckoprofile',
        );

        if (
          geckoprofile === undefined ||
          !Object.prototype.hasOwnProperty.call(geckoprofile, 'kind')
        ) {
          return notify(
            'Job was scheduled without taskcluster support for GeckoProfiles',
          );
        }

        TaskclusterModel.submit({
          action: geckoprofile,
          decisionTaskId,
          taskId: results.originalTaskId,
          task: results.originalTask,
          input: {},
          staticActionVariables: results.staticActionVariables,
        }).then(
          () => {
            notify(
              'Request sent to collect gecko profile job via actions.json',
              'success',
            );
          },
          e => {
            // The full message is too large to fit in a Treeherder
            // notification box.
            notify(formatTaskclusterError(e), 'danger', { sticky: true });
          },
        );
      }),
    );
  };

  retriggerJob = jobs => {
    const { user, repoName, notify } = this.props;

    if (!user.isLoggedIn) {
      return notify('Must be logged in to retrigger a job', 'danger');
    }

    // Spin the retrigger button when retriggers happen
    $('#retrigger-btn > svg').removeClass('action-bar-spin');
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        $('#retrigger-btn > svg').addClass('action-bar-spin');
      });
    });

    JobModel.retrigger(jobs, repoName, notify);
  };

  backfillJob = () => {
    const { user, selectedJob, getGeckoDecisionTaskId, notify } = this.props;

    if (!this.canBackfill()) {
      return;
    }

    if (!user.isLoggedIn) {
      notify('Must be logged in to backfill a job', 'danger');

      return;
    }

    if (!selectedJob.id) {
      notify('Job not yet loaded for backfill', 'warning');

      return;
    }

    if (
      selectedJob.build_system_type === 'taskcluster' ||
      selectedJob.reason.startsWith('Created by BBB for task')
    ) {
      getGeckoDecisionTaskId(selectedJob.push_id).then(decisionTaskId =>
        TaskclusterModel.load(decisionTaskId, selectedJob).then(results => {
          const backfilltask = results.actions.find(
            result => result.name === 'backfill',
          );

          return TaskclusterModel.submit({
            action: backfilltask,
            decisionTaskId,
            taskId: results.originalTaskId,
            input: {},
            staticActionVariables: results.staticActionVariables,
          }).then(
            () => {
              notify(
                'Request sent to backfill job via actions.json',
                'success',
              );
            },
            e => {
              // The full message is too large to fit in a Treeherder
              // notification box.
              notify(formatTaskclusterError(e), 'danger', { sticky: true });
            },
          );
        }),
      );
    } else {
      notify('Unable to backfill this job type!', 'danger', { sticky: true });
    }
  };

  // Can we backfill? At the moment, this only ensures we're not in a 'try' repo.
  canBackfill = () => {
    const { user, isTryRepo } = this.props;

    return user.isLoggedIn && !isTryRepo;
  };

  backfillButtonTitle = () => {
    const { user, isTryRepo } = this.props;
    let title = '';

    if (!user.isLoggedIn) {
      title = title.concat('must be logged in to backfill a job / ');
    }

    if (isTryRepo) {
      title = title.concat('backfill not available in this repository');
    }

    if (title === '') {
      title =
        'Trigger jobs of this type on prior pushes ' +
        'to fill in gaps where the job was not run';
    } else {
      // Cut off trailing '/ ' if one exists, capitalize first letter
      title = title.replace(/\/ $/, '');
      title = title.replace(/^./, l => l.toUpperCase());
    }
    return title;
  };

  createInteractiveTask = async () => {
    const {
      user,
      selectedJob,
      repoName,
      getGeckoDecisionTaskId,
      notify,
    } = this.props;
    const jobId = selectedJob.id;

    if (!user.isLoggedIn) {
      return notify(
        'Must be logged in to create an interactive task',
        'danger',
      );
    }

    const job = await JobModel.get(repoName, jobId);
    const decisionTaskId = await getGeckoDecisionTaskId(job.push_id);
    const results = await TaskclusterModel.load(decisionTaskId, job);
    const interactiveTask = results.actions.find(
      result => result.name === 'create-interactive',
    );

    try {
      await TaskclusterModel.submit({
        action: interactiveTask,
        decisionTaskId,
        taskId: results.originalTaskId,
        input: {
          notify: user.email,
        },
        staticActionVariables: results.staticActionVariables,
      });

      notify(
        `Request sent to create an interactive job via actions.json.
          You will soon receive an email containing a link to interact with the task.`,
        'success',
      );
    } catch (e) {
      // The full message is too large to fit in a Treeherder
      // notification box.
      notify(formatTaskclusterError(e), 'danger', { sticky: true });
    }
  };

  cancelJobs = jobs => {
    const { user, repoName, getGeckoDecisionTaskId, notify } = this.props;
    const jobIds = jobs
      .filter(({ state }) => state === 'pending' || state === 'running')
      .map(({ id }) => id);

    if (!user.isLoggedIn) {
      return notify('Must be logged in to cancel a job', 'danger');
    }

    JobModel.cancel(jobIds, repoName, getGeckoDecisionTaskId, notify);
  };

  cancelJob = () => {
    this.cancelJobs([this.props.selectedJob]);
  };

  toggleCustomJobActions = () => {
    const { customJobActionsShowing } = this.state;

    this.setState({ customJobActionsShowing: !customJobActionsShowing });
  };

  render() {
    const {
      selectedJob,
      logViewerUrl,
      logViewerFullUrl,
      jobLogUrls,
      user,
      pinJob,
    } = this.props;
    const { customJobActionsShowing } = this.state;

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
              <Button
                id="pin-job-btn"
                title="Add this job to the pinboard"
                className="btn icon-blue"
                onClick={() => pinJob(selectedJob)}
              >
                <FontAwesomeIcon icon={faThumbtack} title="Pin job" />
              </Button>
            </li>
            <li>
              <Button
                id="retrigger-btn"
                title={
                  user.isLoggedIn
                    ? 'Repeat the selected job'
                    : 'Must be logged in to retrigger a job'
                }
                className={`btn ${user.isLoggedIn ? 'icon-green' : 'disabled'}`}
                disabled={!user.isLoggedIn}
                onClick={() => this.retriggerJob([selectedJob])}
              >
                <FontAwesomeIcon icon={faRedo} title="Retrigger job" />
              </Button>
            </li>
            {isReftest(selectedJob) &&
              jobLogUrls.map(jobLogUrl => (
                <li key={`reftest-${jobLogUrl.id}`}>
                  <a
                    title="Launch the Reftest Analyzer in a new window"
                    target="_blank"
                    rel="noopener noreferrer"
                    href={getReftestUrl(jobLogUrl.url)}
                  >
                    <FontAwesomeIcon
                      icon={faChartBar}
                      title="Reftest analyzer"
                    />
                  </a>
                </li>
              ))}
            {this.canCancel() && (
              <li>
                <Button
                  title={
                    user.isLoggedIn
                      ? 'Cancel this job'
                      : 'Must be logged in to cancel a job'
                  }
                  className={user.isLoggedIn ? 'hover-warning' : 'disabled'}
                  onClick={() => this.cancelJob()}
                >
                  <FontAwesomeIcon icon={faTimesCircle} title="Cancel job" />
                </Button>
              </li>
            )}
          </ul>
          <ul className="nav navbar-right">
            <li className="dropdown">
              <Button
                id="actionbar-menu-btn"
                title="Other job actions"
                aria-haspopup="true"
                aria-expanded="false"
                className="btn btn-sm dropdown-toggle bg-transparent border-0 pr-2 py-0 m-0"
                data-toggle="dropdown"
              >
                <FontAwesomeIcon icon={faEllipsisH} title="Other job actions" />
              </Button>
              <ul className="dropdown-menu actionbar-menu" role="menu">
                <li>
                  <span
                    id="backfill-btn"
                    className={`btn dropdown-item ${
                      !user.isLoggedIn || !this.canBackfill() ? 'disabled' : ''
                    }`}
                    title={this.backfillButtonTitle()}
                    onClick={() => !this.canBackfill() || this.backfillJob()}
                  >
                    Backfill
                  </span>
                </li>
                {selectedJob.taskcluster_metadata && (
                  <React.Fragment>
                    <li>
                      <a
                        target="_blank"
                        rel="noopener noreferrer"
                        className="dropdown-item"
                        href={getInspectTaskUrl(
                          selectedJob.taskcluster_metadata.task_id,
                        )}
                      >
                        Inspect Task
                      </a>
                    </li>
                    <li>
                      <Button
                        className="dropdown-item py-2"
                        onClick={this.createInteractiveTask}
                      >
                        Create Interactive Task
                      </Button>
                    </li>
                    {isPerfTest(selectedJob) && (
                      <li>
                        <Button
                          className="dropdown-item py-2"
                          onClick={this.createGeckoProfile}
                        >
                          Create Gecko Profile
                        </Button>
                      </li>
                    )}
                    <li>
                      <Button
                        onClick={this.toggleCustomJobActions}
                        className="dropdown-item"
                      >
                        Custom Action...
                      </Button>
                    </li>
                  </React.Fragment>
                )}
              </ul>
            </li>
          </ul>
        </nav>
        {customJobActionsShowing && (
          <CustomJobActions
            job={selectedJob}
            pushId={selectedJob.push_id}
            isLoggedIn={user.isLoggedIn}
            toggle={this.toggleCustomJobActions}
          />
        )}
      </div>
    );
  }
}

ActionBar.propTypes = {
  pinJob: PropTypes.func.isRequired,
  user: PropTypes.object.isRequired,
  repoName: PropTypes.string.isRequired,
  selectedJob: PropTypes.object.isRequired,
  logParseStatus: PropTypes.string.isRequired,
  getGeckoDecisionTaskId: PropTypes.func.isRequired,
  notify: PropTypes.func.isRequired,
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

const mapStateToProps = ({ selectedJob: { selectedJob } }) => ({ selectedJob });

export default connect(
  mapStateToProps,
  { notify },
)(withPushes(withPinnedJobs(ActionBar)));
