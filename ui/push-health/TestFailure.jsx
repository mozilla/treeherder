import React from 'react';
import PropTypes from 'prop-types';
import { Badge, Button, Row, Col } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRedo } from '@fortawesome/free-solid-svg-icons';

import JobModel from '../models/job';

import Job from './Job';

const classificationMap = {
  fixedByCommit: 'Fixed By Commit',
  intermittent: 'Intermittent',
  needsInvestigation: 'Needs Investigation',
};

class TestFailure extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      detailsShowing: false,
    };
  }

  toggleDetails = () => {
    this.setState(prevState => ({ detailsShowing: !prevState.detailsShowing }));
  };

  retriggerJob = async job => {
    const { user, repo, notify, currentRepo } = this.props;

    if (!user.isLoggedIn) {
      notify('Must be logged in to retrigger a job', 'danger', {
        sticky: true,
      });
      return;
    }
    JobModel.retrigger([job], repo, notify, currentRepo);
  };

  render() {
    const { failure, repo, revision } = this.props;
    const {
      testName,
      jobName,
      jobSymbol,
      failJobs,
      passJobs,
      passInFailedJobs,
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
            <span title="Best guess at a classification" className="ml-auto">
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
          <Button
            onClick={() => this.retriggerJob(failJobs[0])}
            outline
            className="btn btn-sm mr-2"
            title="Retrigger job"
            style={{ lineHeight: '10px' }}
          >
            <FontAwesomeIcon icon={faRedo} title="Retrigger" />
          </Button>
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
          {!!passInFailedJobs.length && (
            <span
              className="text-success mr-1"
              title="The following jobs failed overall, but this test did not fail in them"
            >
              Passed in:
            </span>
          )}
          {passInFailedJobs.map(passedInAFailedJob => (
            <Job
              job={passedInAFailedJob}
              jobName={jobName}
              jobSymbol={jobSymbol}
              repo={repo}
              revision={revision}
              key={passedInAFailedJob.id}
            />
          ))}
        </div>
        {!!logLines.length &&
          logLines.map(logLine => (
            <Row
              className="small text-monospace mt-2 ml-3"
              key={logLine.line_number}
            >
              {detailsShowing ? (
                <div className="pre-wrap text-break">
                  {logLine.subtest}
                  <Row className="ml-3">
                    <div>{logLine.message}</div>
                  </Row>
                </div>
              ) : (
                <div className="pre-wrap text-break">
                  {!!logLine.subtest && logLine.subtest.substr(0, 200)}
                </div>
              )}
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
  currentRepo: PropTypes.object.isRequired,
  user: PropTypes.object.isRequired,
  revision: PropTypes.string.isRequired,
  notify: PropTypes.func.isRequired,
};

export default TestFailure;
