import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faStar } from '@fortawesome/free-solid-svg-icons';
import { Badge } from 'reactstrap';

import { getJobsUrl } from '../helpers/url';

export default class TestFailure extends React.PureComponent {
  render() {
    const { failure, repo, revision } = this.props;
    const {
      testName,
      jobName,
      jobId,
      classification,
      failureLine,
      confidence,
    } = failure;

    return (
      <div className="d-flex flex-column mt-2 mb-3 ml-2">
        <div className="d-flex border-bottom border-secondary justify-content-between">
          <span className="font-weight-bold pull-left">{testName}</span>
          <span>
            Line confidence:
            <Badge color="secondary" className="ml-2 mr-3">
              {confidence}
            </Badge>
          </span>
        </div>
        <div className="small">
          <a
            className="text-dark ml-3"
            href={getJobsUrl({ selectedJob: jobId, repo, revision })}
          >
            {jobName}
          </a>
          <span className="ml-1">
            <FontAwesomeIcon icon={faStar} />
            {classification}
          </span>
        </div>
        <span className="small text-monospace mt-2 ml-3">{failureLine}</span>
      </div>
    );
  }
}

TestFailure.propTypes = {
  failure: PropTypes.object.isRequired,
  repo: PropTypes.object.isRequired,
  revision: PropTypes.object.isRequired,
};
