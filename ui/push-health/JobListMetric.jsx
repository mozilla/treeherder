import React from 'react';
import PropTypes from 'prop-types';

import PlatformConfig from './PlatformConfig';

export default class JobListMetric extends React.PureComponent {
  render() {
    const {
      data,
      currentRepo,
      revision,
      notify,
      selectedJobName,
      selectedTaskId,
      updateParamsAndState,
    } = this.props;
    const { name, result, details } = data;
    const jobNames = {};

    let msgForZeroJobs = `All ${name} passed`;
    const correctGrammer = name.slice(-1) === 's' ? 'are' : 'is';

    if (result === 'unknown') {
      msgForZeroJobs = `${name} ${correctGrammer} in progress. No failures detected.`;
    }

    details.forEach((job) => {
      if (!jobNames[job.job_type_name]) {
        jobNames[job.job_type_name] = [job];
      } else {
        jobNames[job.job_type_name].push(job);
      }
    });
    const jobsList = Object.entries(jobNames);

    return (
      <div>
        {jobsList.length > 0 ? (
          jobsList.map(([jobName, jobs]) => (
            <PlatformConfig
              key={jobName}
              jobName={jobName}
              currentRepo={currentRepo}
              revision={revision}
              notify={notify}
              selectedJobName={selectedJobName}
              selectedTaskId={selectedTaskId}
              updateParamsAndState={updateParamsAndState}
              jobs={jobs}
            >
              <span className="px-2 text-darker-secondary font-weight-500">
                {jobName}
              </span>
            </PlatformConfig>
          ))
        ) : (
          <div>{msgForZeroJobs}</div>
        )}
      </div>
    );
  }
}

JobListMetric.propTypes = {
  data: PropTypes.shape({
    name: PropTypes.string.isRequired,
    result: PropTypes.string.isRequired,
    details: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  }).isRequired,
  currentRepo: PropTypes.shape({}).isRequired,
  updateParamsAndState: PropTypes.func.isRequired,
};
