import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Button } from 'reactstrap';
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
import { isReftest, isPerfTest, isTestIsolatable } from '../../../helpers/job';
import { getInspectTaskUrl, getReftestUrl } from '../../../helpers/url';
import JobModel from '../../../models/job';
import PushModel from '../../../models/push';
import TaskclusterModel from '../../../models/taskcluster';
import CustomJobActions from '../../CustomJobActions';
import { notify } from '../../redux/stores/notifications';
import { pinJob } from '../../redux/stores/pinnedJobs';

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
        document.querySelector('.logviewer-btn').click();
    }
  };

  canCancel = () => {
    const { selectedJobFull } = this.props;
    return (
      selectedJobFull.state === 'pending' || selectedJobFull.state === 'running'
    );
  };

  createGeckoProfile = async () => {
    const { user, selectedJobFull, notify, currentRepo } = this.props;
    if (!user.isLoggedIn) {
      return notify('Must be logged in to create a gecko profile', 'danger');
    }

    const { id: decisionTaskId } = await PushModel.getDecisionTaskId(
      selectedJobFull.push_id,
      notify,
    );
    TaskclusterModel.load(decisionTaskId, selectedJobFull, currentRepo).then(
      results => {
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
      },
    );
  };

  retriggerJob = jobs => {
    const { user, notify, currentRepo } = this.props;

    if (!user.isLoggedIn) {
      return notify('Must be logged in to retrigger a job', 'danger');
    }

    // Spin the retrigger button when retriggers happen
    document
      .querySelector('#retrigger-btn > svg')
      .classList.remove('action-bar-spin');
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document
          .querySelector('#retrigger-btn > svg')
          .classList.add('action-bar-spin');
      });
    });

    JobModel.retrigger(jobs, currentRepo.name, notify, currentRepo);
  };

  backfillJob = async () => {
    const { user, selectedJobFull, notify, currentRepo } = this.props;

    if (!this.canBackfill()) {
      return;
    }

    if (!user.isLoggedIn) {
      notify('Must be logged in to backfill a job', 'danger');

      return;
    }

    if (!selectedJobFull.id) {
      notify('Job not yet loaded for backfill', 'warning');

      return;
    }

    if (
      selectedJobFull.build_system_type === 'taskcluster' ||
      selectedJobFull.reason.startsWith('Created by BBB for task')
    ) {
      const { id: decisionTaskId } = await PushModel.getDecisionTaskId(
        selectedJobFull.push_id,
        notify,
      );
      TaskclusterModel.load(decisionTaskId, selectedJobFull, currentRepo).then(
        results => {
          const backfilltask = results.actions.find(
            result => result.name === 'backfill',
          );

          return TaskclusterModel.submit({
            action: backfilltask,
            decisionTaskId,
            taskId: results.originalTaskId,
            input: {},
            staticActionVariables: results.staticActionVariables,
            currentRepo,
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
        },
      );
    } else {
      notify('Unable to backfill this job type!', 'danger', { sticky: true });
    }
  };

  isolateJob = async () => {
    const { user, selectedJobFull, notify, currentRepo } = this.props;
    const { id: decisionTaskId } = await PushModel.getDecisionTaskId(
      selectedJobFull.push_id,
      notify,
    );

    if (!isTestIsolatable(selectedJobFull)) {
      return;
    }

    if (!user.isLoggedIn) {
      notify('Must be logged in to isolate a job', 'danger');

      return;
    }

    if (!selectedJobFull.id) {
      notify('Job not yet loaded for isolation', 'warning');

      return;
    }

    if (selectedJobFull.state !== 'completed') {
      notify('Job not yet completed. Try again later.', 'warning');

      return;
    }

    if (
      selectedJobFull.build_system_type === 'taskcluster' ||
      selectedJobFull.reason.startsWith('Created by BBB for task')
    ) {
      TaskclusterModel.load(decisionTaskId, selectedJobFull, currentRepo).then(
        results => {
          const isolationtask = results.actions.find(
            result => result.name === 'isolate-test-failures',
          );

          if (!isolationtask) {
            notify(
              'Request to isolate job via actions.json failed could not find action.',
              'danger',
              { sticky: true },
            );
            return;
          }

          let times = 1;
          let response = null;
          do {
            response = window.prompt(
              'Enter number of times (1..100) to run isolation jobs: ',
              times,
            );
            if (response == null) {
              break;
            }
            times = parseInt(response, 10);
          } while (Number.isNaN(times) || times < 1 || times > 100);

          if (response === null) {
            notify('Request to isolate job via actions.json aborted.');
            return;
          }

          return TaskclusterModel.submit({
            action: isolationtask,
            decisionTaskId,
            taskId: results.originalTaskId,
            input: { times },
            currentRepo,
            staticActionVariables: results.staticActionVariables,
          }).then(
            () => {
              notify(
                'Request sent to isolate-test-failures job via actions.json',
                'success',
              );
            },
            e => {
              // The full message is too large to fit in a Treeherder
              // notification box.
              notify(formatTaskclusterError(e), 'danger', { sticky: true });
            },
          );
        },
      );
    } else {
      notify('Unable to isolate this job type!', 'danger', { sticky: true });
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
    const { user, selectedJobFull, notify, currentRepo } = this.props;
    const jobId = selectedJobFull.id;

    if (!user.isLoggedIn) {
      return notify(
        'Must be logged in to create an interactive task',
        'danger',
      );
    }

    const job = await JobModel.get(currentRepo.name, jobId);
    const { id: decisionTaskId } = await PushModel.getDecisionTaskId(
      job.push_id,
      notify,
    );
    const results = await TaskclusterModel.load(
      decisionTaskId,
      job,
      currentRepo,
    );
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
    const { user, notify, currentRepo } = this.props;

    if (!user.isLoggedIn) {
      return notify('Must be logged in to cancel a job', 'danger');
    }
    JobModel.cancel(
      jobs.filter(({ state }) => state === 'pending' || state === 'running'),
      currentRepo.name,
      notify,
      currentRepo,
    );
  };

  cancelJob = () => {
    this.cancelJobs([this.props.selectedJobFull]);
  };

  toggleCustomJobActions = () => {
    const { customJobActionsShowing } = this.state;

    this.setState({ customJobActionsShowing: !customJobActionsShowing });
  };

  render() {
    const {
      selectedJobFull,
      logViewerUrl,
      logViewerFullUrl,
      jobLogUrls,
      user,
      pinJob,
      currentRepo,
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
                onClick={() => pinJob(selectedJobFull)}
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
                onClick={() => this.retriggerJob([selectedJobFull])}
              >
                <FontAwesomeIcon icon={faRedo} title="Retrigger job" />
              </Button>
            </li>
            {isReftest(selectedJobFull) &&
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
                {selectedJobFull.taskcluster_metadata && (
                  <React.Fragment>
                    <li>
                      <a
                        target="_blank"
                        rel="noopener noreferrer"
                        className="dropdown-item"
                        href={getInspectTaskUrl(
                          selectedJobFull.taskcluster_metadata.task_id,
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
                    {isPerfTest(selectedJobFull) && (
                      <li>
                        <Button
                          className="dropdown-item py-2"
                          onClick={this.createGeckoProfile}
                        >
                          Create Gecko Profile
                        </Button>
                      </li>
                    )}
                    {isTestIsolatable(selectedJobFull) && (
                      <li>
                        <Button
                          className="dropdown-item py-2"
                          onClick={this.isolateJob}
                        >
                          Run Isolation Tests
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
            job={selectedJobFull}
            pushId={selectedJobFull.push_id}
            currentRepo={currentRepo}
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
  selectedJobFull: PropTypes.object.isRequired,
  logParseStatus: PropTypes.string.isRequired,
  notify: PropTypes.func.isRequired,
  jobLogUrls: PropTypes.array,
  currentRepo: PropTypes.object.isRequired,
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

export default connect(
  null,
  { notify, pinJob },
)(ActionBar);
