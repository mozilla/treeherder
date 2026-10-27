import { useMemo } from 'react';
import PropTypes from 'prop-types';
import { Button } from 'react-bootstrap';

import { usePushesStore } from '../../../shared/stores/pushesStore';
import { selectJobViaUrl } from '../../../shared/stores/selectedJobStore';

// The task definition lists every task this one waits on. Most are toolchains
// and docker images reused from earlier pushes, which aren't jobs here, so only
// the ones in the loaded pushes are named. A retried task keeps its latest run.
export const findDependencies = (taskIds, jobMap) => {
  const wanted = new Set(taskIds);
  const byTask = new Map();
  for (const job of Object.values(jobMap)) {
    if (!wanted.has(job.task_id)) continue;
    const seen = byTask.get(job.task_id);
    if (!seen || job.retry_id > seen.retry_id) byTask.set(job.task_id, job);
  }
  const jobs = [...byTask.values()];
  // Unfinished first: they're what a waiting job is waiting for.
  jobs.sort((a, b) => (a.state === 'completed') - (b.state === 'completed'));
  return { jobs, others: wanted.size - jobs.length };
};

function DependsOn({ taskIds = [] }) {
  const jobMap = usePushesStore((state) => state.jobMap);
  const { jobs, others } = useMemo(
    () => findDependencies(taskIds, jobMap),
    [taskIds, jobMap],
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
};

export default DependsOn;
