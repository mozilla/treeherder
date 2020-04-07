import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faStar } from '@fortawesome/free-solid-svg-icons';
import { Badge, Col, Row } from 'reactstrap';

import SimpleTooltip from '../shared/SimpleTooltip';
import { getBtnClass } from '../helpers/job';
import { getJobsUrl, getLogViewerUrl } from '../helpers/url';
import logviewerIcon from '../img/logviewerIcon.svg';

class Job extends PureComponent {
  render() {
    const { job, repo, revision } = this.props;
    const {
      id,
      result,
      state,
      failure_classification_id: failureClassificationId,
      job_type_name: jobName,
      job_type_symbol: jobSymbol,
      failedInParent,
    } = job;
    const resultStatus = state === 'completed' ? result : state;

    return (
      <span className="ml-1">
        <SimpleTooltip
          autohide={false}
          text={
            <span>
              <a
                className={`p-1 rounded ${getBtnClass(
                  result,
                  failureClassificationId,
                )} border`}
                href={getJobsUrl({ selectedJob: job.id, repo, revision })}
                target="_blank"
                rel="noopener noreferrer"
              >
                {jobSymbol}
              </a>
              {failureClassificationId !== 1 && (
                <FontAwesomeIcon
                  icon={faStar}
                  title="Classified"
                  color="lightgray"
                />
              )}
              {!!failedInParent && (
                <Badge color="info" className="ml-1">
                  Failed in parent
                </Badge>
              )}
            </span>
          }
          tooltipText={
            <Col className="align-items-start" key={id}>
              <Row className="mb-2">{jobName}</Row>
              <Row>Result: {resultStatus}</Row>
              {job.result === 'testfailed' && (
                <Row>
                  Open Log Viewer:
                  <a
                    className="logviewer-btn ml-1"
                    href={getLogViewerUrl(job.id, repo)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open the Log Viewer for this job"
                  >
                    <img
                      style={{ height: '18px' }}
                      alt="Logviewer"
                      src={logviewerIcon}
                      className="logviewer-icon text-light mb-1"
                    />
                  </a>
                </Row>
              )}
            </Col>
          }
        />
      </span>
    );
  }
}

Job.propTypes = {
  job: PropTypes.shape({
    id: PropTypes.number.isRequired,
    result: PropTypes.string.isRequired,
    failure_classification_id: PropTypes.number.isRequired,
    job_type_name: PropTypes.string.isRequired,
    job_type_symbol: PropTypes.string.isRequired,
  }).isRequired,
  repo: PropTypes.string.isRequired,
  revision: PropTypes.string.isRequired,
};

export default Job;
