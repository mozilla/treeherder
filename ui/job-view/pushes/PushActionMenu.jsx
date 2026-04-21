import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Dropdown } from 'react-bootstrap';
import { useNavigate } from 'react-router';

import {
  createQueryParams,
  getPerfCompareChooserUrl,
  parseQueryParams,
} from '../../helpers/url';
import { formatTaskclusterError } from '../../helpers/errorMessage';
import CustomJobActions from '../CustomJobActions';
import PushModel from '../../models/push';
import JobModel from '../../models/job';
import { notify } from '../stores/notificationStore';
import { usePushesStore, updateRange } from '../stores/pushesStore';

function PushActionMenu({
  revision = null,
  runnableVisible,
  hideRunnableJobs,
  showRunnableJobs,
  showFuzzyJobs,
  pushId,
  currentRepo,
  getAllShownJobs,
}) {
  const navigate = useNavigate();
  const [customJobActionsShowing, setCustomJobActionsShowing] = useState(false);

  const decisionTaskMap = usePushesStore((state) => state.decisionTaskMap);

  const updateParamsAndRange = useCallback(
    (param) => {
      let queryParams = parseQueryParams(window.location.search);
      queryParams = { ...queryParams, ...{ [param]: revision } };

      navigate({
        search: createQueryParams(queryParams),
      });
      updateRange(queryParams);
    },
    [revision, navigate],
  );

  const triggerMissingJobs = useCallback(() => {
    const decisionTask = decisionTaskMap[pushId];

    if (
      !window.confirm(
        `This will trigger all missing jobs for revision ${revision}!\n\nClick "OK" if you want to proceed.`,
      )
    ) {
      return;
    }

    PushModel.triggerMissingJobs(
      pushId,
      notify,
      decisionTask,
      currentRepo,
    ).catch((e) => {
      notify(formatTaskclusterError(e), 'danger', { sticky: true });
    });
  }, [pushId, revision, decisionTaskMap, currentRepo]);

  const retriggerAllFailedJobs = useCallback(() => {
    const failedJobs = getAllShownJobs(pushId).filter(
      (job) =>
        job.resultStatus === 'testfailed' &&
        job.platform !== 'lint' &&
        job.job_type_symbol !== 'mozlint' &&
        !job.job_type_name.includes('build'),
    );

    if (!failedJobs.length) {
      notify('No failed test jobs to retrigger', 'warning');
      return;
    }

    if (
      !window.confirm(
        `This will retrigger ${failedJobs.length} failed test job${failedJobs.length > 1 ? 's' : ''} for revision ${revision}!\n\nClick "OK" if you want to proceed.`,
      )
    ) {
      return;
    }

    JobModel.retrigger(failedJobs, currentRepo, notify, 1, decisionTaskMap);
  }, [pushId, revision, getAllShownJobs, currentRepo, decisionTaskMap]);

  const toggleCustomJobActions = useCallback(() => {
    setCustomJobActionsShowing((prev) => !prev);
  }, []);

  return (
    <React.Fragment>
      <Dropdown className="btn-group">
        <Dropdown.Toggle
          size="sm"
          className="btn-push"
          title="Action menu"
          data-testid="push-action-menu-button"
        />
        <Dropdown.Menu>
          {runnableVisible ? (
            <Dropdown.Item
              tag="a"
              title="Hide Runnable Jobs"
              onClick={hideRunnableJobs}
            >
              Hide Runnable Jobs
            </Dropdown.Item>
          ) : (
            <Dropdown.Item
              tag="a"
              title="Add new jobs to this push"
              onClick={showRunnableJobs}
            >
              Add new jobs
            </Dropdown.Item>
          )}
          <Dropdown.Item
            tag="a"
            title="Add new jobs to this push via a fuzzy search"
            onClick={showFuzzyJobs}
          >
            Add new jobs (Search)
          </Dropdown.Item>
          <Dropdown.Item
            tag="a"
            title="Retrigger all jobs with failed test results in this push"
            onClick={retriggerAllFailedJobs}
          >
            Retrigger all failed test jobs
          </Dropdown.Item>
          <Dropdown.Item
            tag="a"
            title="Trigger all jobs that were optimized away"
            onClick={triggerMissingJobs}
          >
            Trigger missing jobs
          </Dropdown.Item>
          <Dropdown.Item
            tag="a"
            target="_blank"
            rel="noopener noreferrer"
            href={`https://bugherder.mozilla.org/?cset=${revision}&tree=${currentRepo.name}`}
            title="Use Bugherder to mark the bugs in this push"
          >
            Mark with Bugherder
          </Dropdown.Item>
          <Dropdown.Item
            tag="a"
            onClick={toggleCustomJobActions}
            title="View/Edit/Submit Action tasks for this push"
          >
            Custom Push Action...
          </Dropdown.Item>
          <Dropdown.Item
            tag="a"
            onClick={() => updateParamsAndRange('tochange')}
            data-testid="top-of-range-menu-item"
          >
            Set as top of range
          </Dropdown.Item>
          <Dropdown.Item
            tag="a"
            onClick={() => updateParamsAndRange('fromchange')}
            data-testid="bottom-of-range-menu-item"
          >
            Set as bottom of range
          </Dropdown.Item>
          <Dropdown.Divider />
          <Dropdown.Item
            tag="a"
            href={getPerfCompareChooserUrl({
              newRepo: currentRepo.name,
              newRev: revision,
            })}
            target="_blank"
            rel="noopener noreferrer"
            title="Compare performance against another revision"
          >
            Compare Performance
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
      {customJobActionsShowing && (
        <CustomJobActions
          job={null}
          pushId={pushId}
          currentRepo={currentRepo}
          toggle={toggleCustomJobActions}
        />
      )}
    </React.Fragment>
  );
}

PushActionMenu.propTypes = {
  runnableVisible: PropTypes.bool.isRequired,
  revision: PropTypes.string,
  currentRepo: PropTypes.shape({
    name: PropTypes.string,
  }).isRequired,
  pushId: PropTypes.number.isRequired,
  hideRunnableJobs: PropTypes.func.isRequired,
  showRunnableJobs: PropTypes.func.isRequired,
  showFuzzyJobs: PropTypes.func.isRequired,
  getAllShownJobs: PropTypes.func.isRequired,
};

export default PushActionMenu;
