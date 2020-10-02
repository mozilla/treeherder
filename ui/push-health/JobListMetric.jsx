import React from 'react';
import PropTypes from 'prop-types';
import { Row } from 'reactstrap';

import Job from './Job';
import { filterJobs } from './helpers';

export default class JobListMetric extends React.PureComponent {
  render() {
    const { data, repo, revision, showParentMatches } = this.props;
    const { name, details, result } = data;

    const jobs = filterJobs(details, showParentMatches);
    let msgForZeroJobs = `All ${name} passed`;
    const correctGrammer = name.slice(-1) === 's' ? 'are' : 'is';

    if (result === 'unknown') {
      msgForZeroJobs = `${name} ${correctGrammer} in progress. No failures detected.`;
    } else if (details.length && !jobs.length) {
      msgForZeroJobs = `All failed ${name} also failed in Parent Push`;
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
  showParentMatches: PropTypes.bool.isRequired,
};
