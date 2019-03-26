import React from 'react';
import PropTypes from 'prop-types';
import { Badge, Button, Row, Col, Collapse } from 'reactstrap';

import logviewerIcon from '../img/logviewerIcon.png';
import { getJobsUrl, getLogViewerUrl } from '../helpers/url';

export default class TestFailure extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      detailsShowing: false,
    };
  }

  toggleDetails = () => {
    this.setState(prevState => ({ detailsShowing: !prevState.detailsShowing }));
  };

  render() {
    const { failure, repo, revision } = this.props;
    const {
      testName,
      jobName,
      jobSymbol,
      jobs,
      logLines,
      confidence,
      platform,
      config,
      key,
    } = failure;
    const { detailsShowing } = this.state;

    return (
      <Col className="mt-2 mb-3 ml-2" key={key}>
        <Row className="border-bottom border-secondary justify-content-between">
          <span>{testName}</span>
          <span>
            Line confidence:
            <Badge color="secondary" className="ml-2 mr-3">
              {confidence}
            </Badge>
          </span>
        </Row>
        <div className="small">
          <span>
            {platform} {config}:
          </span>
          {jobs.map(job => (
            <span className="mr-2" key={job.id}>
              <a
                className="text-dark ml-3 px-1 border border-secondary rounded"
                href={getJobsUrl({ selectedJob: job.id, repo, revision })}
                title={jobName}
              >
                {jobSymbol}
              </a>
              <a
                className="logviewer-btn"
                href={getLogViewerUrl(job.id, repo)}
                target="_blank"
                rel="noopener noreferrer"
                title="Open the Log Viewer for this job"
              >
                <img
                  style={{ height: '18px' }}
                  alt="Logviewer"
                  src={logviewerIcon}
                  className="logviewer-icon text-dark"
                />
              </a>
            </span>
          ))}
        </div>
        {!!logLines.length &&
          logLines.map(logLine => (
            <Row
              className="small text-monospace mt-2 ml-3"
              key={logLine.line_number}
            >
              {logLine.subtest}
              <Collapse isOpen={detailsShowing}>
                <Row className="ml-3">
                  <div>{logLine.message}</div>
                </Row>
              </Collapse>
            </Row>
          ))}
        <div>
          <Button
            className="border-0 text-info bg-transparent p-1"
            onClick={this.toggleDetails}
          >
            {detailsShowing ? 'less...' : 'more...'}
          </Button>
        </div>
      </Col>
    );
  }
}

TestFailure.propTypes = {
  failure: PropTypes.object.isRequired,
  repo: PropTypes.string.isRequired,
  revision: PropTypes.string.isRequired,
};
