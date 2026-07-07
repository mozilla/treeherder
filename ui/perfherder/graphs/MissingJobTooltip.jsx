import { useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Button } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';

import { getJobsUrl } from '../../helpers/url';
import { notify } from '../../shared/stores/notificationStore';
import { formatTaskclusterError } from '../../helpers/errorMessage';
import { toMercurialDateStr } from '../../helpers/display';
import RepositoryModel from '../../models/repository';
import JobModel from '../../models/job';
import PushModel from '../../models/push';
import TaskclusterModel from '../../models/taskcluster';
import { getAction } from '../../helpers/taskcluster';
import Clipboard from '../../shared/Clipboard';

const MissingJobTooltip = ({
  testData,
  user,
  projects = [],
  lockTooltip,
  closeTooltip,
  datum,
  x,
  y,
  windowWidth,
}) => {
  const testDetails = testData.find(
    (item) => item.signature_id === datum.signature_id,
  );

  const currentRepo = RepositoryModel.getRepo(
    testDetails.repository_name,
    projects,
  );

  // Build sorted timeline combining actual and missing data points to find prevRevision.
  const allPoints = [
    ...testDetails.data.map((d) => ({ revision: d.revision, x: d.x })),
    ...(testDetails.missingData || []).map((d) => ({ revision: d.revision, x: d.x })),
  ].sort((a, b) => a.x - b.x);

  const currentIndex = allPoints.findIndex((p) => p.revision === datum.revision);
  const prevRevision = currentIndex > 0 ? allPoints[currentIndex - 1].revision : null;

  let pushUrl;
  if (prevRevision && currentRepo) {
    const repoModel = new RepositoryModel(currentRepo);
    pushUrl = repoModel.getPushLogRangeHref({
      fromchange: prevRevision,
      tochange: datum.revision,
    });
  }

  const jobsUrl = getJobsUrl({
    repo: datum.repository_name,
    revision: datum.revision,
    ...(datum.jobId ? { selectedJob: datum.jobId } : {}),
    group_state: 'expanded',
  });

  const retriggerJob = async () => {
    if (!currentRepo) {
      notify(
        'Unknown repository for this data point; cannot retrigger.',
        'danger',
      );
      return;
    }
    try {
      const job = await JobModel.get(currentRepo.name, datum.jobId);
      await JobModel.retrigger([job], currentRepo, notify, 1);
    } catch (e) {
      notify(formatTaskclusterError(e), 'danger', { sticky: true });
    }
  };

  const backfillJob = async () => {
    if (!currentRepo) {
      notify(
        'Unknown repository for this data point; cannot backfill.',
        'danger',
      );
      return;
    }
    if (currentRepo.is_try_repo) {
      notify('Backfill is not available for try repositories.', 'warning');
      return;
    }
    try {
      const job = await JobModel.get(currentRepo.name, datum.jobId);
      const { id: decisionTaskId } = await PushModel.getDecisionTaskId(
        datum.pushId,
        notify,
      );
      const results = await TaskclusterModel.load(
        decisionTaskId,
        job,
        currentRepo,
      );
      const backfilltask = getAction(results.actions, 'backfill');
      await TaskclusterModel.submit({
        action: backfilltask,
        decisionTaskId,
        taskId: results.originalTaskId,
        input: {},
        staticActionVariables: results.staticActionVariables,
        currentRepo,
      });
      notify('Request sent to backfill job via actions.json', 'success');
    } catch (e) {
      notify(formatTaskclusterError(e), 'danger', { sticky: true });
    }
  };

  const tooltipRef = useRef(null);
  const [tooltipHeight, setTooltipHeight] = useState(0);

  useLayoutEffect(() => {
    if (!tooltipRef.current) return;

    const element = tooltipRef.current;

    const measure = () => {
      const h = element.getBoundingClientRect().height;
      if (h && Math.abs(h - tooltipHeight) > 1) setTooltipHeight(h);
    };

    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => measure());
    ro.observe(element);

    return () => ro.disconnect();
  }, [tooltipHeight]);

  const verticalOffset = 10;
  const horizontalOffset = x >= 1275 && windowWidth <= 1825 ? 100 : 0;
  const effectiveHeight = tooltipHeight || 186;
  const centered = {
    x: x - 280 / 2 - horizontalOffset,
    y: y - effectiveHeight - verticalOffset,
  };

  return (
    <foreignObject width="100%" height="100%" x={centered.x} y={centered.y}>
      <div
        ref={tooltipRef}
        className={`graph-tooltip ${lockTooltip ? 'locked' : null}`}
        xmlns="http://www.w3.org/1999/xhtml"
        data-testid="missingJobTooltip"
      >
        <div className="body">
          <div className="position-relative m-0">
            <Button
              variant="outline-secondary"
              className="close position-absolute end-0 m-0 px-1 py-0"
              onClick={closeTooltip}
            >
              <FontAwesomeIcon
                className="pointer text-white"
                icon={faTimes}
                size="xs"
                title="close tooltip"
              />
            </Button>
          </div>
          <div>
            <p data-testid="repoName">({testDetails.repository_name})</p>
            <p className="small" data-testid="platform">
              {testDetails.platform}
            </p>
          </div>
          <div>
            <p
              className={`small ${
                datum.status === 'failed' ? 'text-danger' : 'text-warning'
              }`}
            >
              {datum.status === 'failed' ? 'Job failed' : 'Job not run'}
            </p>
          </div>
          <div>
            <span>
              <a href={pushUrl} target="_blank" rel="noopener noreferrer">
                {datum.revision.slice(0, 12)}
              </a>{' '}
              {datum.jobId && (
                <>
                  {'('}
                  <a href={jobsUrl} target="_blank" rel="noopener noreferrer">
                    job
                  </a>
                  {') '}
                </>
              )}
              <Clipboard text={datum.revision} description="Revision" />
            </span>
            {datum.jobId && user.isStaff && (
              <p className="pt-2">
                <Button
                  variant="outline-darker-info"
                  size="sm"
                  onClick={retriggerJob}
                >
                  retrigger
                </Button>{' '}
                <Button
                  variant="outline-darker-info"
                  size="sm"
                  onClick={backfillJob}
                >
                  backfill
                </Button>
              </p>
            )}
            <p className="small text-white pt-2">
              {`Push time: ${toMercurialDateStr(datum.x)}`}
            </p>
          </div>
        </div>
        <div
          className="tip"
          style={{ transform: `translateX(${horizontalOffset}px)` }}
        />
      </div>
    </foreignObject>
  );
};

MissingJobTooltip.propTypes = {
  testData: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  user: PropTypes.shape({}).isRequired,
  projects: PropTypes.arrayOf(PropTypes.shape({})),
  lockTooltip: PropTypes.bool.isRequired,
  closeTooltip: PropTypes.func.isRequired,
  datum: PropTypes.shape({}).isRequired,
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  windowWidth: PropTypes.number.isRequired,
};

export default MissingJobTooltip;
