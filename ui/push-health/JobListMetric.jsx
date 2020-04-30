import React from 'react';
import PropTypes from 'prop-types';
import { Row } from 'reactstrap';

import Metric from './Metric';
import Job from './Job';
import { filterJobs } from './helpers';

export default class JobListMetric extends React.PureComponent {
  render() {
    const {
      data,
      repo,
      revision,
      expanded,
      setExpanded,
      showParentMatches,
    } = this.props;
    const { name, result, details } = data;
    const jobs = filterJobs(details, showParentMatches);
    const msgForZeroJobs =
      details.length && !jobs.length
        ? `All failed ${name} also failed in Parent Push`
        : `All ${name} passed`;

    return (
      <Metric
        name={name}
        result={result}
        expanded={expanded}
        setExpanded={setExpanded}
      >
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
      </Metric>
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
  setExpanded: PropTypes.func.isRequired,
  expanded: PropTypes.bool.isRequired,
  showParentMatches: PropTypes.bool.isRequired,
};
