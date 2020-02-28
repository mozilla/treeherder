import React from 'react';
import PropTypes from 'prop-types';

import Metric from './Metric';
import Job from './Job';

export default class JobListMetric extends React.PureComponent {
  render() {
    const { data, repo, revision, expanded, setExpanded } = this.props;
    const { name, result, details } = data;

    return (
      <Metric
        name={name}
        result={result}
        expanded={expanded}
        setExpanded={setExpanded}
      >
        <div>
          {details.length ? (
            details.map(job => (
              <Job
                job={job}
                jobName={job.job_type_name}
                jobSymbol={job.job_type_symbol}
                repo={repo}
                revision={revision}
                key={job.id}
              />
            ))
          ) : (
            <div>All {name} passed</div>
          )}
        </div>
      </Metric>
    );
  }
}

JobListMetric.propTypes = {
  data: PropTypes.object.isRequired,
  repo: PropTypes.string.isRequired,
  revision: PropTypes.string.isRequired,
  setExpanded: PropTypes.func.isRequired,
  expanded: PropTypes.bool.isRequired,
};
