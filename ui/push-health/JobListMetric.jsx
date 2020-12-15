import React from 'react';
import PropTypes from 'prop-types';
import { Row } from 'reactstrap';

import Job from './Job';

export default class JobListMetric extends React.PureComponent {
  render() {
    const { data, repo, revision } = this.props;
    const { name, details: jobs, result } = data;

    let msgForZeroJobs = `All ${name} passed`;
    const correctGrammer = name.slice(-1) === 's' ? 'are' : 'is';

    if (result === 'unknown') {
      msgForZeroJobs = `${name} ${correctGrammer} in progress. No failures detected.`;
    }

    return (
      <div>
        {jobs.length ? (
          jobs.map((job) => (
            <Row key={job.id} className="mt-2">
              <Job job={job} repo={repo} revision={revision} />
            </Row>
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
    details: PropTypes.array.isRequired,
  }).isRequired,
  repo: PropTypes.string.isRequired,
  revision: PropTypes.string.isRequired,
};
