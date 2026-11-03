import { useMemo } from 'react';
import PropTypes from 'prop-types';
import { Button } from 'react-bootstrap';

import { usePushesStore } from '../../../shared/stores/pushesStore';
import { selectJobViaUrl } from '../../../shared/stores/selectedJobStore';

// The task definition lists every task this one waits on. Most are toolchains
// and docker images built in earlier pushes, so only the ones in this job's own
// push are named, and the rest are counted. A retried task keeps its latest run.
export const findDependencies = (taskIds, pushId, jobMap) => {
  const dependencyIds = new Set(taskIds);
  const latestRuns = new Map();
  for (const job of Object.values(jobMap)) {
    if (job.push_id !== pushId || !dependencyIds.has(job.task_id)) continue;
    const seen = latestRuns.get(job.task_id);
    if (!seen || job.retry_id > seen.retry_id) latestRuns.set(job.task_id, job);
  }
  const jobs = [...latestRuns.values()];
  // Unfinished first: they're what a waiting job is waiting for.
  const unfinished = jobs.filter((job) => job.state !== 'completed');
  const finished = jobs.filter((job) => job.state === 'completed');
  return {
    jobs: [...unfinished, ...finished],
    others: dependencyIds.size - jobs.length,
  };
};

function DependsOn({ taskIds = [], pushId }) {
  const jobMap = usePushesStore((state) => state.jobMap);
  const { jobs, others } = useMemo(
    () => findDependencies(taskIds, pushId, jobMap),
    [taskIds, pushId, jobMap],
  );

  if (!taskIds.length) return null;

  return (
    <li className="ms-1 fs-80" data-testid="depends-on">
      <strong>Depends on: </strong>
      {jobs.map((job, i) => (
        <span key={job.id}>
          {i > 0 && ', '}
          <Button
            variant="link"
            className="dependency-link p-0"
            title="Select this job"
            onClick={() => selectJobViaUrl(job)}
          >
            {job.job_type_name}
          </Button>{' '}
          ({job.resultStatus})
        </span>
      ))}
      {others > 0 && (
        <span>
          {jobs.length ? ', and ' : ''}
          {others} {others === 1 ? 'task' : 'tasks'} not in this push
        </span>
      )}
    </li>
  );
}

DependsOn.propTypes = {
  taskIds: PropTypes.arrayOf(PropTypes.string),
  pushId: PropTypes.number.isRequired,
};

export default DependsOn;
