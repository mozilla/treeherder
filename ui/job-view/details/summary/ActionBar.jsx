import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
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
import { pinJob } from '../../stores/pinnedJobsStore';
import { notify } from '../../stores/notificationStore';
import { getAction } from '../../../helpers/taskcluster';
import { checkRootUrl } from '../../../taskcluster-auth-callback/constants';
import { usePushesStore } from '../../stores/pushesStore';

import LogUrls from './LogUrls';

export function ActionBar({
  user,
  selectedJobFull,
  logParseStatus,
  jobLogUrls = [],
  jobDetails = [],
  currentRepo,
  isTryRepo,
  logViewerUrl = null,
  logViewerFullUrl = null,
  taskExpired = false,
}) {
  const [customJobActionsShowing, setCustomJobActionsShowing] = useState(false);
  const decisionTaskMap = usePushesStore((state) => state.decisionTaskMap);

  const getResourceUsageProfile = () =>
    jobDetails.find((artifact) => isResourceUsageProfile(artifact.value));

  const canCancel = () =>
    selectedJobFull.state === 'pending' || selectedJobFull.state === 'running';

  const canBackfill = () => !isTryRepo && !taskExpired;

  const backfillButtonTitle = () => {
    let title = '';

    if (isTryRepo) {
      title = title.concat('backfill not available in this repository');
    }

    if (taskExpired) {
      title = title.concat(
        title ? ' / ' : '',
        'Taskcluster task expired — backfill unavailable',
      );
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

  const retriggerJob = async (jobs) => {
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

  const createGeckoProfile = async () =>
    triggerTask(
      selectedJobFull,
      notify,
      decisionTaskMap,
      currentRepo,
      geckoProfileTaskName,
    );

  const createSideBySide = async () => {
    await triggerTask(
      selectedJobFull,
      notify,
      decisionTaskMap,
      currentRepo,
      sxsTaskName,
    );
  };

  const backfillJob = async () => {
    if (!canBackfill()) {
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

  const handleConfirmFailure = async () => {
    confirmFailure(selectedJobFull, notify, decisionTaskMap, currentRepo);
  };

  const createInteractiveTask = async () => {
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

  const cancelJobs = (jobs) => {
    JobModel.cancel(
      jobs.filter(({ state }) => state === 'pending' || state === 'running'),
      currentRepo,
      notify,
      decisionTaskMap,
    );
  };

  const cancelJob = () => {
    cancelJobs([selectedJobFull]);
  };

  const toggleCustomJobActions = () => {
    setCustomJobActionsShowing((showing) => !showing);
  };

  // For running tasks, fall back to the live.log artifact for raw log only.
  let rawLogUrls = jobLogUrls;
  if (
    selectedJobFull.state === 'running' &&
    jobDetails &&
    !jobLogUrls.length
  ) {
    const liveLog = jobDetails.find((detail) =>
      detail.value.includes('live.log'),
    );
    if (liveLog) {
      rawLogUrls = [{ url: liveLog.url, name: 'live.log', id: 'live' }];
    }
  }
  const firstRawLogUrl = rawLogUrls.find(
    (logUrl) => !logUrl.name.includes('perfherder-data'),
  )?.url;

  // Re-register window listeners whenever values they read change so the
  // captured closures stay current.
  useEffect(() => {
    const onOpenLogviewer = () => {
      if (!taskExpired && logParseStatus === 'parsed' && logViewerUrl) {
        window.open(logViewerUrl, '_blank', 'noopener,noreferrer');
      }
      // When unavailable (or the task expired), the LogUrls button is rendered
      // disabled with an explanatory tooltip, so we don't need a notification.
    };

    const onOpenRawLog = () => {
      if (!taskExpired && firstRawLogUrl) {
        window.open(firstRawLogUrl, '_blank', 'noopener,noreferrer');
      }
      // When no raw log is available (or the task expired), the LogUrls button
      // is rendered disabled with a tooltip, so we don't need a notification.
    };

    const onOpenGeckoProfile = () => {
      const resourceUsageProfile = getResourceUsageProfile();
      if (resourceUsageProfile) {
        window.open(
          getPerfAnalysisUrl(resourceUsageProfile.url, selectedJobFull),
          '_blank',
        );
      } else {
        notify('No resource usage profile available for this job');
      }
    };

    const onRetriggerJob = (event) => {
      retriggerJob([event.detail.job]);
    };

    window.addEventListener(thEvents.openLogviewer, onOpenLogviewer);
    window.addEventListener(thEvents.openRawLog, onOpenRawLog);
    window.addEventListener(thEvents.openGeckoProfile, onOpenGeckoProfile);
    window.addEventListener(thEvents.jobRetrigger, onRetriggerJob);

    return () => {
      window.removeEventListener(thEvents.openLogviewer, onOpenLogviewer);
      window.removeEventListener(thEvents.openRawLog, onOpenRawLog);
      window.removeEventListener(thEvents.openGeckoProfile, onOpenGeckoProfile);
      window.removeEventListener(thEvents.jobRetrigger, onRetriggerJob);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    logParseStatus,
    logViewerUrl,
    firstRawLogUrl,
    taskExpired,
    selectedJobFull,
    jobDetails,
    decisionTaskMap,
    currentRepo,
  ]);

  const resourceUsageProfile = getResourceUsageProfile();
  const expiredTitleSuffix = taskExpired
    ? ' (unavailable — Taskcluster task expired)'
    : '';

  return (
    <div id="actionbar">
      <nav className="navbar navbar-dark details-panel-navbar">
        <ul className="nav actionbar-nav">
          <LogUrls
            logUrls={jobLogUrls}
            rawLogUrls={rawLogUrls}
            logViewerUrl={logViewerUrl}
            logViewerFullUrl={logViewerFullUrl}
            taskExpired={taskExpired}
          />
          <li>
            <Button
              id="pin-job-btn"
              title="Add this job to the pinboard"
              className="actionbar-nav-btn bg-transparent border-0"
              onClick={() => pinJob(selectedJobFull)}
            >
              <FontAwesomeIcon icon={faThumbtack} title="Pin job" />
            </Button>
          </li>
          <li>
            <Button
              id="retrigger-btn"
              title={`Retrigger job (r)${expiredTitleSuffix}`}
              className="actionbar-nav-btn bg-transparent border-0 icon-green"
              onClick={() => retriggerJob([selectedJobFull])}
              disabled={taskExpired}
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
              className="actionbar-nav-btn bg-transparent border-0"
              onClick={() => findJobInstance(jobLogUrls[0]?.job_id, true)}
            >
              <FontAwesomeIcon icon={faCrosshairs} title="Find job instance" />
            </Button>
          </li>
          {canCancel() && (
            <li>
              <Button
                title={`Must be logged in to cancel a job${expiredTitleSuffix}`}
                className="bg-transparent border-0 actionbar-nav-btn hover-warning"
                onClick={() => cancelJob()}
                disabled={taskExpired}
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
                <FontAwesomeIcon icon={faEllipsisH} title="Other job actions" />
              </Dropdown.Toggle>
              <Dropdown.Menu
                className="actionbar-menu dropdown-menu"
                align="start"
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
                  className={`${!canBackfill() ? 'disabled' : ''}`}
                  title={backfillButtonTitle()}
                  onClick={() => !canBackfill() || backfillJob()}
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
                      className={`py-2 ${taskExpired ? 'disabled' : ''}`}
                      title={
                        taskExpired
                          ? 'Taskcluster task expired — action unavailable'
                          : undefined
                      }
                      onClick={() => !taskExpired && createInteractiveTask()}
                    >
                      Create Interactive Task
                    </Dropdown.Item>
                    {isPerfTest(selectedJobFull) && (
                      <Dropdown.Item
                        as="a"
                        className={`py-2 ${taskExpired ? 'disabled' : ''}`}
                        title={
                          taskExpired
                            ? 'Taskcluster task expired — action unavailable'
                            : undefined
                        }
                        onClick={() => !taskExpired && createGeckoProfile()}
                      >
                        Create Gecko Profile
                      </Dropdown.Item>
                    )}
                    {isPerfTest(selectedJobFull) &&
                      !selectedJobFull.hasSideBySide && (
                        <Dropdown.Item
                          as="a"
                          className={`py-2 ${taskExpired ? 'disabled' : ''}`}
                          title={
                            taskExpired
                              ? 'Taskcluster task expired — action unavailable'
                              : undefined
                          }
                          onClick={() => !taskExpired && createSideBySide()}
                        >
                          Generate side-by-side
                        </Dropdown.Item>
                      )}
                    {canConfirmFailure(selectedJobFull) && (
                      <Dropdown.Item
                        as="a"
                        className={`py-2 ${taskExpired ? 'disabled' : ''}`}
                        title={
                          taskExpired
                            ? 'Taskcluster task expired — action unavailable'
                            : undefined
                        }
                        onClick={() => !taskExpired && handleConfirmFailure()}
                      >
                        Confirm Test Failures
                      </Dropdown.Item>
                    )}
                    <Dropdown.Item
                      as="a"
                      onClick={() => !taskExpired && toggleCustomJobActions()}
                      className={`dropdown-item ${
                        taskExpired ? 'disabled' : ''
                      }`}
                      title={
                        taskExpired
                          ? 'Taskcluster task expired — action unavailable'
                          : undefined
                      }
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
          toggle={toggleCustomJobActions}
        />
      )}
    </div>
  );
}

ActionBar.propTypes = {
  user: PropTypes.shape({}).isRequired,
  selectedJobFull: PropTypes.shape({}).isRequired,
  logParseStatus: PropTypes.string.isRequired,
  jobLogUrls: PropTypes.arrayOf(PropTypes.shape({})),
  jobDetails: PropTypes.arrayOf(PropTypes.shape({})),
  currentRepo: PropTypes.shape({}).isRequired,
  isTryRepo: PropTypes.bool,
  logViewerUrl: PropTypes.string,
  logViewerFullUrl: PropTypes.string,
  taskExpired: PropTypes.bool,
};

export default React.memo(ActionBar);
