import React from 'react';
import PropTypes from 'prop-types';
import { Badge, Button, Row, Col, Collapse } from 'reactstrap';

import Job from './Job';

const classificationMap = {
  fixedByCommit: 'Fixed By Commit',
  intermittent: 'Intermittent',
  needsInvestigation: 'Needs Investigation',
};

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
      failJobs,
      passJobs,
      logLines,
      confidence,
      platform,
      config,
      suggestedClassification,
      key,
    } = failure;
    const { detailsShowing } = this.state;

    return (
      <Col className="mt-2 mb-3 ml-2" key={key}>
        <Row className="border-bottom border-secondary justify-content-between">
          <span>{testName}</span>
          {!!confidence && (
            <span title="Best guess at a classification">
              {classificationMap[suggestedClassification]}
              <Badge
                color="secondary"
                className="ml-2 mr-3"
                title="Confidence in this classification guess"
              >
                {confidence}
              </Badge>
            </span>
          )}
        </Row>
        <div className="small">
          <span>
            {platform} {config}:
          </span>
          {failJobs.map(failJob => (
            <Job
              job={failJob}
              jobName={jobName}
              jobSymbol={jobSymbol}
              repo={repo}
              revision={revision}
              key={failJob.id}
            />
          ))}
          {passJobs.map(passJob => (
            <Job
              job={passJob}
              jobName={jobName}
              jobSymbol={jobSymbol}
              repo={repo}
              revision={revision}
              key={passJob.id}
            />
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
  failure: PropTypes.shape({
    testName: PropTypes.string.isRequired,
    jobName: PropTypes.string.isRequired,
    jobSymbol: PropTypes.string.isRequired,
    failJobs: PropTypes.arrayOf(PropTypes.shape({})),
    passJobs: PropTypes.arrayOf(PropTypes.shape({})),
    logLines: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
    confidence: PropTypes.number.isRequired,
    platform: PropTypes.string.isRequired,
    config: PropTypes.string.isRequired,
    suggestedClassification: PropTypes.string.isRequired,
    key: PropTypes.string.isRequired,
  }).isRequired,
  repo: PropTypes.string.isRequired,
  revision: PropTypes.string.isRequired,
};
