import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faStar } from '@fortawesome/free-solid-svg-icons';
import { Badge, Row, Col } from 'reactstrap';

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
      <Col className="mt-2 mb-3 ml-2">
        <Row className="border-bottom border-secondary justify-content-between">
          <span className="font-weight-bold">{testName}</span>
          <span>
            Line confidence:
            <Badge color="secondary" className="ml-2 mr-3">
              {confidence}
            </Badge>
          </span>
        </Row>
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
        <Row className="small text-monospace mt-2 ml-3">{failureLine}</Row>
      </Col>
    );
  }
}

TestFailure.propTypes = {
  failure: PropTypes.object.isRequired,
  repo: PropTypes.string.isRequired,
  revision: PropTypes.string.isRequired,
};
