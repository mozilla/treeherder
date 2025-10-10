import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Button, Dropdown } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartBar } from '@fortawesome/free-regular-svg-icons';
import {
  faEllipsisH,
  faRedo,
  faThumbtack,
  faTimesCircle,
  faCrosshairs,
  faGaugeHigh,
} from '@fortawesome/free-solid-svg-icons';

import {
  geckoProfileTaskName,
  sxsTaskName,
  thEvents,
} from '../../../helpers/constants';
import { triggerTask } from '../../../helpers/performance';
import { formatTaskclusterError } from '../../../helpers/errorMessage';
import {
  isReftest,
  isPerfTest,
  canConfirmFailure,
  confirmFailure,
  findJobInstance,
} from '../../../helpers/job';
import {
  getInspectTaskUrl,
  getReftestUrl,
  getPerfAnalysisUrl,
  isResourceUsageProfile,
} from '../../../helpers/url';
import JobModel from '../../../models/job';
import TaskclusterModel from '../../../models/taskcluster';
import CustomJobActions from '../../CustomJobActions';
import { notify } from '../../redux/stores/notifications';
import { pinJob } from '../../redux/stores/pinnedJobs';
import { getAction } from '../../../helpers/taskcluster';
import { checkRootUrl } from '../../../taskcluster-auth-callback/constants';

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
    window.addEventListener(thEvents.openRawLog, this.onOpenRawLog);
    window.addEventListener(thEvents.openGeckoProfile, this.onOpenGeckoProfile);
    window.addEventListener(thEvents.jobRetrigger, this.onRetriggerJob);
  }

  componentWillUnmount() {
    window.removeEventListener(thEvents.openLogviewer, this.onOpenLogviewer);
    window.removeEventListener(thEvents.openRawLog, this.onOpenRawLog);
    window.removeEventListener(
      thEvents.openGeckoProfile,
      this.onOpenGeckoProfile,
    );
    window.removeEventListener(thEvents.jobRetrigger, this.onRetriggerJob);
  }

  onRetriggerJob = (event) => {
    this.retriggerJob([event.detail.job]);
  };

  // Open the logviewer and provide notifications if it isn't available
  onOpenLogviewer = () => {
    const { logParseStatus, notify } = this.props;

    switch (logParseStatus) {
      case 'pending':
        notify('Log parsing in progress, log viewer not yet available');
        break;
      case 'failed':
        notify('Log parsing has failed, log viewer is unavailable', 'warning');
        break;
      case 'skipped-size':
        notify('Log parsing was skipped, log viewer is unavailable', 'warning');
        break;
      case 'unavailable':
        notify('No logs available for this job');
        break;
      case 'parsed':
        document.querySelector('.logviewer-btn').click();
    }
  };

  // Open the raw log and provide notifications if it isn't available
  onOpenRawLog = () => {
    const { jobLogUrls, notify } = this.props;
    if (jobLogUrls && jobLogUrls.length > 0) {
      window.open(jobLogUrls[0].url, '_blank');
    } else {
      notify('No logs available for this job');
    }
  };

  // Open the gecko profile and provide notifications if it isn't available
  onOpenGeckoProfile = () => {
    const { notify, selectedJobFull } = this.props;
    const resourceUsageProfile = this.getResourceUsageProfile();

    if (resourceUsageProfile) {
      window.open(
        getPerfAnalysisUrl(resourceUsageProfile.url, selectedJobFull),
        '_blank',
      );
    } else {
      notify('No resource usage profile available for this job');
    }
  };

  getResourceUsageProfile = () => {
    const { jobDetails } = this.props;
    return jobDetails.find((artifact) =>
      isResourceUsageProfile(artifact.value),
    );
  };

  canCancel = () => {
    const { selectedJobFull } = this.props;
    return (
      selectedJobFull.state === 'pending' || selectedJobFull.state === 'running'
    );
  };

  createGeckoProfile = async () => {
    const {
      selectedJobFull,
      notify,
      decisionTaskMap,
      currentRepo,
    } = this.props;
    return triggerTask(
      selectedJobFull,
      notify,
      decisionTaskMap,
      currentRepo,
      geckoProfileTaskName,
    );
  };

  createSideBySide = async () => {
    const {
      selectedJobFull,
      notify,
      decisionTaskMap,
      currentRepo,
    } = this.props;
    await triggerTask(
      selectedJobFull,
      notify,
      decisionTaskMap,
      currentRepo,
      sxsTaskName,
    );
  };

  retriggerJob = async (jobs) => {
    const { notify, decisionTaskMap, currentRepo } = this.props;

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
      selectedJobFull,
      notify,
      decisionTaskMap,
      currentRepo,
    } = this.props;

    if (!this.canBackfill()) {
      return;
    }

    if (!selectedJobFull.id) {
      notify('Job not yet loaded for backfill', 'warning');

      return;
    }

    const { id: decisionTaskId } = decisionTaskMap[selectedJobFull.push_id];

    TaskclusterModel.load(decisionTaskId, selectedJobFull, currentRepo).then(
      (results) => {
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
            (e) => {
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

  handleConfirmFailure = async () => {
    const {
      selectedJobFull,
      notify,
      decisionTaskMap,
      currentRepo,
    } = this.props;
    confirmFailure(selectedJobFull, notify, decisionTaskMap, currentRepo);
  };

  // Can we backfill? At the moment, this only ensures we're not in a 'try' repo.
  canBackfill = () => {
    const { isTryRepo } = this.props;

    return !isTryRepo;
  };

  backfillButtonTitle = () => {
    const { isTryRepo } = this.props;
    let title = '';

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
      title = title.replace(/^./, (l) => l.toUpperCase());
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

    const { id: decisionTaskId } = decisionTaskMap[selectedJobFull.push_id];
    const results = await TaskclusterModel.load(
      decisionTaskId,
      selectedJobFull,
      currentRepo,
    );

    try {
      const interactiveTask = getAction(results.actions, 'create-interactive');

      if (user.email === '') {
        notify('Please login before creating an interactive task');
        return;
      }

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

  cancelJobs = (jobs) => {
    const { notify, decisionTaskMap, currentRepo } = this.props;

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
      pinJob,
      currentRepo,
    } = this.props;
    const { customJobActionsShowing } = this.state;
    const resourceUsageProfile = this.getResourceUsageProfile();

    return (
      <div id="actionbar">
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
                title="Retrigger job (r)"
                className="actionbar-nav-btn bg-transparent border-0 icon-green"
                onClick={() => this.retriggerJob([selectedJobFull])}
              >
                <FontAwesomeIcon icon={faRedo} />
              </Button>
            </li>
            {resourceUsageProfile &&
              // not shown at the same time as the reftest analyzer to avoid running out of space.
              !isReftest(selectedJobFull) && (
                <li>
                  <a
                    title="Show the resource usage profile in the Firefox Profiler (g)"
                    className="actionbar-nav-btn btn"
                    target="_blank"
                    rel="noopener noreferrer"
                    href={getPerfAnalysisUrl(
                      resourceUsageProfile.url,
                      selectedJobFull,
                    )}
                  >
                    <FontAwesomeIcon icon={faGaugeHigh} />
                  </a>
                </li>
              )}
            {isReftest(selectedJobFull) &&
              jobLogUrls.map((jobLogUrl) => (
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
                  title="Must be logged in to cancel a job"
                  className="bg-transparent border-0 actionbar-nav-btn hover-warning"
                  onClick={() => this.cancelJob()}
                >
                  <FontAwesomeIcon icon={faTimesCircle} title="Cancel job" />
                </Button>
              </li>
            )}
            <li className="ms-auto d-flex align-items-center">
              <Dropdown>
                <Dropdown.Toggle
                  className="bg-transparent text-light border-0 pe-2 py-2 m-0 d-flex align-items-center"
                  bsPrefix="btn"
                >
                  <FontAwesomeIcon
                    icon={faEllipsisH}
                    title="Other job actions"
                  />
                </Dropdown.Toggle>
                <Dropdown.Menu
                  className="actionbar-menu dropdown-menu"
                  align="end"
                  style={{
                    zIndex: 10000,
                  }}
                  popperConfig={{
                    strategy: 'fixed',
                    modifiers: [
                      {
                        name: 'offset',
                        options: {
                          offset: [0, 4],
                        },
                      },
                      {
                        name: 'preventOverflow',
                        options: {
                          boundary: 'viewport',
                          padding: 8,
                        },
                      },
                      {
                        name: 'flip',
                        options: {
                          fallbackPlacements: ['bottom-end', 'top-end'],
                        },
                      },
                    ],
                  }}
                  renderOnMount
                >
                  <Dropdown.Item
                    as="a"
                    id="backfill-btn"
                    className={`${!this.canBackfill() ? 'disabled' : ''}`}
                    title={this.backfillButtonTitle()}
                    onClick={() => !this.canBackfill() || this.backfillJob()}
                  >
                    Backfill
                  </Dropdown.Item>
                  {selectedJobFull.task_id && (
                    <React.Fragment>
                      <Dropdown.Item
                        as="a"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ps-4"
                        href={getInspectTaskUrl(
                          selectedJobFull.task_id,
                          checkRootUrl(currentRepo.tc_root_url),
                          selectedJobFull.submit_timestamp,
                        )}
                      >
                        Inspect Task
                      </Dropdown.Item>
                      <Dropdown.Item
                        as="a"
                        className="py-2"
                        onClick={this.createInteractiveTask}
                      >
                        Create Interactive Task
                      </Dropdown.Item>
                      {isPerfTest(selectedJobFull) && (
                        <Dropdown.Item
                          as="a"
                          className="py-2"
                          onClick={this.createGeckoProfile}
                        >
                          Create Gecko Profile
                        </Dropdown.Item>
                      )}
                      {isPerfTest(selectedJobFull) &&
                        !selectedJobFull.hasSideBySide && (
                          <Dropdown.Item
                            as="a"
                            className="py-2"
                            onClick={this.createSideBySide}
                          >
                            Generate side-by-side
                          </Dropdown.Item>
                        )}
                      {canConfirmFailure(selectedJobFull) && (
                        <Dropdown.Item
                          as="a"
                          className="py-2"
                          onClick={this.handleConfirmFailure}
                        >
                          Confirm Test Failures
                        </Dropdown.Item>
                      )}
                      <Dropdown.Item
                        as="a"
                        onClick={this.toggleCustomJobActions}
                        className="dropdown-item"
                      >
                        Custom Action...
                      </Dropdown.Item>
                    </React.Fragment>
                  )}
                </Dropdown.Menu>
              </Dropdown>
            </li>
          </ul>
        </nav>
        {customJobActionsShowing && (
          <CustomJobActions
            job={selectedJobFull}
            pushId={selectedJobFull.push_id}
            currentRepo={currentRepo}
            toggle={this.toggleCustomJobActions}
          />
        )}
      </div>
    );
  }
}

ActionBar.propTypes = {
  pinJob: PropTypes.func.isRequired,
  decisionTaskMap: PropTypes.shape({}).isRequired,
  user: PropTypes.shape({}).isRequired,
  selectedJobFull: PropTypes.shape({}).isRequired,
  logParseStatus: PropTypes.string.isRequired,
  notify: PropTypes.func.isRequired,
  jobLogUrls: PropTypes.arrayOf(PropTypes.shape({})),
  currentRepo: PropTypes.shape({}).isRequired,
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
