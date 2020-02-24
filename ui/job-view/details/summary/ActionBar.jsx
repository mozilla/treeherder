import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import {
  Button,
  DropdownMenu,
  DropdownItem,
  DropdownToggle,
  UncontrolledDropdown,
} from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartBar } from '@fortawesome/free-regular-svg-icons';
import {
  faEllipsisH,
  faRedo,
  faThumbtack,
  faTimesCircle,
  faCrosshairs,
} from '@fortawesome/free-solid-svg-icons';

import { thEvents } from '../../../helpers/constants';
import { formatTaskclusterError } from '../../../helpers/errorMessage';
import {
  isReftest,
  isPerfTest,
  isTestIsolatable,
  findJobInstance,
} from '../../../helpers/job';
import { getInspectTaskUrl, getReftestUrl } from '../../../helpers/url';
import JobModel from '../../../models/job';
import TaskclusterModel from '../../../models/taskcluster';
import CustomJobActions from '../../CustomJobActions';
import { notify } from '../../redux/stores/notifications';
import { pinJob } from '../../redux/stores/pinnedJobs';
import { getAction } from '../../../helpers/taskcluster';

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
    const {
      user,
      selectedJobFull,
      notify,
      decisionTaskMap,
      currentRepo,
    } = this.props;
    if (!user.isLoggedIn) {
      return notify('Must be logged in to create a gecko profile', 'danger');
    }

    const { id: decisionTaskId } = decisionTaskMap[selectedJobFull.push_id];

    TaskclusterModel.load(decisionTaskId, selectedJobFull, currentRepo).then(
      results => {
        try {
          const geckoprofile = getAction(results.actions, 'geckoprofile');

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
            currentRepo,
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
        } catch (e) {
          notify(formatTaskclusterError(e), 'danger', { sticky: true });
        }
      },
    );
  };

  retriggerJob = async jobs => {
    const { user, notify, decisionTaskMap, currentRepo } = this.props;

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

    JobModel.retrigger(jobs, currentRepo, notify, 1, decisionTaskMap);
  };

  backfillJob = async () => {
    const {
      user,
      selectedJobFull,
      notify,
      decisionTaskMap,
      currentRepo,
    } = this.props;

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

    const { id: decisionTaskId } = decisionTaskMap[selectedJobFull.push_id];

    TaskclusterModel.load(decisionTaskId, selectedJobFull, currentRepo).then(
      results => {
        try {
          const backfilltask = getAction(results.actions, 'backfill');

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
        } catch (e) {
          notify(formatTaskclusterError(e), 'danger', { sticky: true });
        }
      },
    );
  };

  isolateJob = async () => {
    const {
      user,
      selectedJobFull,
      notify,
      decisionTaskMap,
      currentRepo,
    } = this.props;
    const { id: decisionTaskId } = decisionTaskMap[selectedJobFull.push_id];

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

    TaskclusterModel.load(decisionTaskId, selectedJobFull, currentRepo).then(
      results => {
        try {
          const isolationtask = getAction(
            results.actions,
            'isolate-test-failures',
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
            staticActionVariables: results.staticActionVariables,
            currentRepo,
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
        } catch (e) {
          notify(formatTaskclusterError(e), 'danger', { sticky: true });
        }
      },
    );
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
      selectedJobFull,
      notify,
      decisionTaskMap,
      currentRepo,
    } = this.props;

    if (!user.isLoggedIn) {
      return notify(
        'Must be logged in to create an interactive task',
        'danger',
      );
    }

    const { id: decisionTaskId } = decisionTaskMap[selectedJobFull.push_id];
    const results = await TaskclusterModel.load(
      decisionTaskId,
      selectedJobFull,
      currentRepo,
    );

    try {
      const interactiveTask = getAction(results.actions, 'create-interactive');

      await TaskclusterModel.submit({
        action: interactiveTask,
        decisionTaskId,
        taskId: results.originalTaskId,
        input: {
          notify: user.email,
        },
        staticActionVariables: results.staticActionVariables,
        currentRepo,
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
    const { user, notify, decisionTaskMap, currentRepo } = this.props;

    if (!user.isLoggedIn) {
      return notify('Must be logged in to cancel a job', 'danger');
    }
    JobModel.cancel(
      jobs.filter(({ state }) => state === 'pending' || state === 'running'),
      currentRepo,
      notify,
      decisionTaskMap,
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
          <ul className="nav actionbar-nav">
            <LogUrls
              logUrls={jobLogUrls}
              logViewerUrl={logViewerUrl}
              logViewerFullUrl={logViewerFullUrl}
            />
            <li>
              <Button
                id="pin-job-btn"
                title="Add this job to the pinboard"
                className="actionbar-nav-btn icon-blue bg-transparent border-0"
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
                className={`actionbar-nav-btn bg-transparent border-0 ${
                  user.isLoggedIn ? 'icon-green' : 'disabled'
                }`}
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
                    className="actionbar-nav-btn"
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
            <li>
              <Button
                id="find-job-btn"
                title="Scroll to selection"
                className="actionbar-nav-btn icon-blue bg-transparent border-0"
                onClick={() =>
                  findJobInstance(jobLogUrls[0] && jobLogUrls[0].job_id, true)
                }
              >
                <FontAwesomeIcon
                  icon={faCrosshairs}
                  title="Find job instance"
                />
              </Button>
            </li>
            {this.canCancel() && (
              <li>
                <Button
                  title={
                    user.isLoggedIn
                      ? 'Cancel this job'
                      : 'Must be logged in to cancel a job'
                  }
                  className={`bg-transparent border-0 actionbar-nav-btn ${
                    user.isLoggedIn ? 'hover-warning' : 'disabled'
                  }`}
                  onClick={() => this.cancelJob()}
                >
                  <FontAwesomeIcon icon={faTimesCircle} title="Cancel job" />
                </Button>
              </li>
            )}
            <li className="ml-auto">
              <UncontrolledDropdown>
                <DropdownToggle className="bg-transparent text-light border-0 pr-2 py-2 m-0">
                  <FontAwesomeIcon
                    icon={faEllipsisH}
                    title="Other job actions"
                    className="align-baseline"
                  />
                </DropdownToggle>
                <DropdownMenu className="actionbar-menu dropdown-menu-right">
                  <DropdownItem
                    tag="a"
                    id="backfill-btn"
                    className={`${
                      !user.isLoggedIn || !this.canBackfill() ? 'disabled' : ''
                    }`}
                    title={this.backfillButtonTitle()}
                    onClick={() => !this.canBackfill() || this.backfillJob()}
                  >
                    Backfill
                  </DropdownItem>
                  {selectedJobFull.task_id && (
                    <React.Fragment>
                      <DropdownItem
                        tag="a"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="pl-4"
                        href={getInspectTaskUrl(
                          selectedJobFull.task_id,
                          currentRepo.tc_root_url,
                          selectedJobFull.submit_timestamp,
                        )}
                      >
                        Inspect Task
                      </DropdownItem>
                      <DropdownItem
                        tag="a"
                        className="py-2"
                        onClick={this.createInteractiveTask}
                      >
                        Create Interactive Task
                      </DropdownItem>
                      {isPerfTest(selectedJobFull) && (
                        <DropdownItem
                          tag="a"
                          className="py-2"
                          onClick={this.createGeckoProfile}
                        >
                          Create Gecko Profile
                        </DropdownItem>
                      )}
                      {isTestIsolatable(selectedJobFull) && (
                        <DropdownItem
                          tag="a"
                          className="py-2"
                          onClick={this.isolateJob}
                        >
                          Run Isolation Tests
                        </DropdownItem>
                      )}
                      <DropdownItem
                        tag="a"
                        onClick={this.toggleCustomJobActions}
                        className="dropdown-item"
                      >
                        Custom Action...
                      </DropdownItem>
                    </React.Fragment>
                  )}
                </DropdownMenu>
              </UncontrolledDropdown>
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
  decisionTaskMap: PropTypes.object.isRequired,
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

const mapStateToProps = ({ pushes: { decisionTaskMap } }) => ({
  decisionTaskMap,
});

export default connect(mapStateToProps, { notify, pinJob })(ActionBar);
