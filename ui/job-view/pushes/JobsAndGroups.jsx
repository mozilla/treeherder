import PropTypes from 'prop-types';
import React, { useMemo } from 'react';

import JobButton from './JobButton';
import JobGroup from './JobGroup';

export const getIntermittentJobTypeNames = (groupJobs, confirmGroup) => {
  /* Given a set of jobs from a group and related confirmFailures:
   * collect all failed jobs
   * collect all confirm failure job names
   * collect all confirm failure jobs that failed (i.e. confirmed)
   * if job is retriggered, assuming >50% green == intermittent
   * if job has confirm-failure: assuming green is intermittent, orange is failure
   * if job has both cf and retrigger:
   * confirm-failure is failed: mark as failed
   * confirm-failure is green: add +1 to total success jobs
   */
  const failedJobTypeNames = {};
  const jobCountByConfirmName = {};
  const jobCountByName = {};
  const confirmedJobNames = [];

  for (const job of groupJobs) {
    if (!Object.keys(jobCountByName).includes(job.job_type_name)) {
      jobCountByName[job.job_type_name] = 0;
    }

    // job state of retry, usercancel, etc. is misleading
    if (
      !['success', 'testfailed', 'exception', 'busted'].includes(job.result)
    ) {
      continue;
    }
    jobCountByName[job.job_type_name]++;

    // -cf group can have >1 job of each job_type_name and >1 type of job
    if (
      confirmGroup !== undefined &&
      Object.keys(confirmGroup).includes('jobs')
    ) {
      for (const sgjob of confirmGroup.jobs) {
        if (sgjob.result === 'unknown') continue;

        const cfJobName = sgjob.job_type_name.split('-cf')[0];
        if (cfJobName === job.job_type_name) {
          if (!Object.keys(jobCountByConfirmName).includes(cfJobName)) {
            jobCountByConfirmName[cfJobName] = 0;
          }
          jobCountByConfirmName[cfJobName]++;

          // if we find a failing -cf job, then this is a regression!
          // TODO: we could fail for infra
          if (sgjob.result === 'testfailed') {
            confirmedJobNames.push(cfJobName);
          }
        }
      }
    }

    if (job.result === 'testfailed') {
      if (!Object.keys(failedJobTypeNames).includes(job.job_type_name)) {
        failedJobTypeNames[job.job_type_name] = [];
      }
      // TODO: add list of failures here, specifically NEW failures
      failedJobTypeNames[job.job_type_name].push(job.id);
    }
  }

  const intermittentJobTypeNames = new Set();
  const failedNames = Object.keys(failedJobTypeNames);
  for (const job of groupJobs) {
    // if failed in -cf mode, do not consider as intermittent
    if (confirmedJobNames.includes(job.job_type_name)) continue;

    if (job.result === 'success' && failedNames.includes(job.job_type_name)) {
      // TODO: make the default threshold lower, now 1/2 pass, ideally 2/3 pass
      let threshold = 0.5;

      // if -cf job exists (only here if green), then job is confirmed intermittent
      if (jobCountByConfirmName[job.job_type_name] > 0) threshold = 1;

      if (
        failedJobTypeNames[job.job_type_name].length /
          jobCountByName[job.job_type_name] <=
        threshold
      ) {
        intermittentJobTypeNames.add(job.job_type_name);
      }
    } else if (
      // here if we have at least 1 green -cf job, we can mark the failures as intermittent
      jobCountByConfirmName[job.job_type_name] > 0
    ) {
      intermittentJobTypeNames.add(job.job_type_name);
    }
  }

  return intermittentJobTypeNames;
};

export default function JobsAndGroups({
  groups,
  filterPlatformCb,
  filterModel,
  pushGroupState,
  duplicateJobsVisible,
  groupCountsExpanded,
  runnableVisible,
  toggleSelectedRunnableJob,
}) {
  const { intermittentJobTypeNames, confirmGroups } = useMemo(() => {
    const intermittentNames = new Set();
    const cfGroups = {};

    for (const g of groups) {
      // group.mapKey == pushID groupSymbol Tier platform buildtype
      // find matching group.mapKey
      if (g.symbol.endsWith('-cf')) {
        let foundTier = false;
        let gname = '';
        for (let tier = 1; tier <= 3; tier++) {
          gname = g.mapKey.replace('-cf3', tier);
          for (const t of groups) {
            if (t.mapKey === gname) foundTier = true;
          }
          if (foundTier) break;
        }

        if (foundTier) {
          cfGroups[gname] = g;
        }
      }

      const { jobs } = g;
      const confirmGroup =
        cfGroups[jobs.mapKey] === undefined ? {} : cfGroups[jobs.mapKey];
      const intermittentTypes = getIntermittentJobTypeNames(jobs, confirmGroup);
      intermittentTypes.forEach((intermittentType) =>
        intermittentNames.add(intermittentType),
      );
    }

    return {
      intermittentJobTypeNames: intermittentNames,
      confirmGroups: cfGroups,
    };
  }, [groups]);

  const isIntermittent = (job) => {
    if (job.result !== 'testfailed') {
      return false;
    }

    return intermittentJobTypeNames.has(job.job_type_name);
  };

  return (
    <td className="job-row">
      {groups.map((group) => {
        if (group.tier !== 1 || group.symbol !== '') {
          return (
            group.visible && (
              <JobGroup
                group={group}
                confirmGroup={confirmGroups[group.mapKey] || {}}
                filterModel={filterModel}
                filterPlatformCb={filterPlatformCb}
                key={group.mapKey}
                pushGroupState={pushGroupState}
                duplicateJobsVisible={duplicateJobsVisible}
                groupCountsExpanded={groupCountsExpanded}
                runnableVisible={runnableVisible}
                intermittentJobTypeNames={intermittentJobTypeNames}
                toggleSelectedRunnableJob={toggleSelectedRunnableJob}
              />
            )
          );
        }
        return group.jobs.map((job) => (
          <JobButton
            job={job}
            filterModel={filterModel}
            visible={job.visible}
            filterPlatformCb={filterPlatformCb}
            intermittent={isIntermittent(job)}
            key={job.id}
          />
        ));
      })}
    </td>
  );
}

JobsAndGroups.propTypes = {
  groups: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  filterModel: PropTypes.shape({}).isRequired,
  filterPlatformCb: PropTypes.func.isRequired,
  pushGroupState: PropTypes.string.isRequired,
  duplicateJobsVisible: PropTypes.bool.isRequired,
  groupCountsExpanded: PropTypes.bool.isRequired,
};
