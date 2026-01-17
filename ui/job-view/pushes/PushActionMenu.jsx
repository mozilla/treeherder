import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';
import { Dropdown } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';

import {
  createQueryParams,
  getPushHealthUrl,
  getPerfCompareChooserUrl,
  parseQueryParams,
} from '../../helpers/url';
import { formatTaskclusterError } from '../../helpers/errorMessage';
import CustomJobActions from '../CustomJobActions';
import PushModel from '../../models/push';
import { notify } from '../redux/stores/notifications';
import { updateRange } from '../redux/stores/pushes';

function PushActionMenu({
  revision = null,
  runnableVisible,
  hideRunnableJobs,
  showRunnableJobs,
  showFuzzyJobs,
  pushId,
  currentRepo,
}) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [customJobActionsShowing, setCustomJobActionsShowing] = useState(false);

  // Redux state
  const decisionTaskMap = useSelector((state) => state.pushes.decisionTaskMap);

  const updateParamsAndRange = useCallback(
    (param) => {
      let queryParams = parseQueryParams(window.location.search);
      queryParams = { ...queryParams, ...{ [param]: revision } };

      navigate({
        search: createQueryParams(queryParams),
      });
      dispatch(updateRange(queryParams));
    },
    [revision, dispatch, navigate],
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
      (msg, severity, options) => dispatch(notify(msg, severity, options)),
      decisionTask,
      currentRepo,
    ).catch((e) => {
      dispatch(notify(formatTaskclusterError(e), 'danger', { sticky: true }));
    });
  }, [pushId, revision, decisionTaskMap, currentRepo, dispatch]);

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
            href={getPushHealthUrl({ repo: currentRepo.name, revision })}
            target="_blank"
            rel="noopener noreferrer"
            title="Enable Health Badges in the Health menu"
          >
            Push Health
          </Dropdown.Item>
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
};

export default PushActionMenu;
