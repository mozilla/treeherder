import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import PropTypes from 'prop-types';
import countBy from 'lodash/countBy';

import { thFailureResults } from '../../helpers/constants';
import { getUrlParam } from '../../helpers/location';
import { getBtnClass } from '../../helpers/job';

import JobButton from './JobButton';
import JobCount from './JobCount';

function GroupSymbol({ symbol, tier = 1, toggleExpanded }) {
  return (
    <button type="button" className="btn group-symbol" onClick={toggleExpanded}>
      {symbol}
      {tier !== 1 && <span className="small">[tier {tier}]</span>}
    </button>
  );
}

GroupSymbol.propTypes = {
  symbol: PropTypes.string.isRequired,
  toggleExpanded: PropTypes.func.isRequired,
  tier: PropTypes.number,
};

export function JobGroupComponent({
  group,
  filterModel,
  filterPlatformCb,
  pushGroupState,
  duplicateJobsVisible,
  groupCountsExpanded,
  intermittentJobTypeNames,
  runnableVisible,
  toggleSelectedRunnableJob,
}) {
  // The group should be expanded initially if the global group state is expanded
  const groupState = getUrlParam('group_state');
  const [expanded, setExpanded] = useState(
    groupState === 'expanded' || pushGroupState === 'expanded',
  );

  // Create refs for job buttons
  const jobButtonRefs = useRef({});

  // Initialize refs for jobs
  useMemo(() => {
    for (const job of group.jobs) {
      if (!jobButtonRefs.current[job.id]) {
        jobButtonRefs.current[job.id] = React.createRef();
      }
    }
  }, [group.jobs]);

  // getDerivedStateFromProps equivalent
  useEffect(() => {
    if (pushGroupState === 'expanded') {
      setExpanded(true);
    }
  }, [pushGroupState]);

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const toggleAll = useCallback(() => {
    for (const ref of Object.values(jobButtonRefs.current)) {
      if (!ref.current || !ref.current.props.visible) {
        continue;
      }
      toggleSelectedRunnableJob(ref.current.props.job.signature);
      ref.current.toggleRunnableSelected();
    }
  }, [toggleSelectedRunnableJob]);

  const groupButtonsAndCounts = useCallback(
    (jobs, isExpanded) => {
      let buttons = [];
      const counts = [];
      const selectedTaskRun = getUrlParam('selectedTaskRun');

      if (isExpanded || groupCountsExpanded) {
        // All buttons should be shown when the group is expanded
        buttons = jobs;
      } else {
        const stateCounts = {};
        const typeSymbolCounts = countBy(jobs, 'job_type_symbol');
        jobs.forEach((job) => {
          const { resultStatus, visible } = job;
          const { status } = getBtnClass(resultStatus);
          if (!visible) return;

          let countInfo = {
            status,
            countText: resultStatus,
          };
          if (
            thFailureResults.includes(resultStatus) ||
            (typeSymbolCounts[job.job_type_symbol] > 1 && duplicateJobsVisible)
          ) {
            // render the job itself, not a count
            buttons.push(job);
          } else {
            countInfo = { ...countInfo, ...stateCounts[countInfo.status] };
            if (selectedTaskRun === job.task_run || countInfo.selectedClasses) {
              countInfo.selectedClasses = ' selected-count btn-lg-xform';
            } else {
              countInfo.selectedClasses = '';
            }
            if (stateCounts[countInfo.status]) {
              countInfo.count = stateCounts[countInfo.status].count + 1;
            } else {
              countInfo.count = 1;
            }
            countInfo.lastJob = job;
            stateCounts[countInfo.status] = countInfo;
          }
        });
        Object.entries(stateCounts).forEach(([, countInfo]) => {
          if (countInfo.count === 1) {
            buttons.push(countInfo.lastJob);
          } else {
            counts.push(countInfo);
          }
        });
      }
      return { buttons, counts };
    },
    [duplicateJobsVisible, groupCountsExpanded],
  );

  const {
    name: groupName,
    symbol: groupSymbol,
    tier: groupTier,
    jobs: groupJobs,
    mapKey: groupMapKey,
  } = group;

  const { buttons, counts } = groupButtonsAndCounts(groupJobs, expanded);

  const isIntermittent = (job) => {
    if (job.result !== 'testfailed') {
      return false;
    }

    return intermittentJobTypeNames.has(job.job_type_name);
  };

  return (
    <span className="platform-group" data-group-key={groupMapKey}>
      <span className="disabled job-group" title={groupName}>
        <GroupSymbol
          symbol={groupSymbol}
          tier={groupTier}
          toggleExpanded={toggleExpanded}
        />
        {runnableVisible && expanded && (
          <button
            className="btn group-select-all-runnable"
            type="button"
            title="Select or deselect all jobs in this group"
            onClick={toggleAll}
          >
            [All]
          </button>
        )}
        <span className="group-content">
          <span className="group-job-list">
            {buttons.map((job) => (
              <JobButton
                job={job}
                filterModel={filterModel}
                visible={job.visible}
                filterPlatformCb={filterPlatformCb}
                intermittent={isIntermittent(job)}
                key={job.id}
                ref={jobButtonRefs.current[job.id]}
              />
            ))}
          </span>
          <span className="group-count-list">
            {counts.map((countInfo) => (
              <JobCount
                count={countInfo.count}
                onClick={toggleExpanded}
                className={countInfo.selectedClasses}
                status={countInfo.status}
                title={`${countInfo.count} ${countInfo.countText} jobs in group`}
                key={countInfo.lastJob.id}
              />
            ))}
          </span>
        </span>
      </span>
    </span>
  );
}

JobGroupComponent.propTypes = {
  group: PropTypes.shape({}).isRequired,
  confirmGroup: PropTypes.shape({}),
  filterModel: PropTypes.shape({}).isRequired,
  filterPlatformCb: PropTypes.func.isRequired,
  pushGroupState: PropTypes.string.isRequired,
  duplicateJobsVisible: PropTypes.bool.isRequired,
  groupCountsExpanded: PropTypes.bool.isRequired,
};

export default JobGroupComponent;
