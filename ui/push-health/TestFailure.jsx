import React from 'react';
import PropTypes from 'prop-types';
import {
  Badge,
  Button,
  Row,
  Col,
  UncontrolledTooltip,
  UncontrolledCollapse,
} from 'reactstrap';
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
    const { user, notify, currentRepo } = this.props;

    if (!user.isLoggedIn) {
      notify('Must be logged in to retrigger a job', 'danger', {
        sticky: true,
      });
      return;
    }
    JobModel.retrigger([job], currentRepo, notify);
  };

  render() {
    const { failure, repo, revision, groupedBy } = this.props;
    const {
      testName,
      action,
      jobName,
      jobSymbol,
      jobGroup,
      jobGroupSymbol,
      inProgressJobs,
      failJobs,
      passJobs,
      passInFailedJobs,
      logLines,
      confidence,
      platform,
      config,
      suggestedClassification,
      key,
      tier,
      passFailRatio,
    } = failure;
    const { detailsShowing } = this.state;

    return (
      <Row className="border-top m-3" key={key}>
        <Col>
          <Row>{groupedBy !== 'path' && <span>{testName}</span>}</Row>
          <Button
            onClick={() => this.retriggerJob(failJobs[0])}
            outline
            className="btn btn-sm mr-2"
            title="Retrigger job"
            style={{ lineHeight: '10px' }}
          >
            <FontAwesomeIcon icon={faRedo} title="Retrigger" />
          </Button>
          {groupedBy !== 'platform' && (
            <span>
              {platform} {config}:
            </span>
          )}
          <span
            className="mx-1 px-1 border border-secondary rounded"
            title={jobGroup}
          >
            {jobGroupSymbol}
          </span>
          {tier > 1 && (
            <span className="ml-1 small text-muted">[tier-{tier}]</span>
          )}
          <span color="secondary" className="text-uppercase ml-1 mr-1">
            {action} :
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
          {inProgressJobs.map(inProgressJob => (
            <Job
              job={inProgressJob}
              jobName={jobName}
              jobSymbol={jobSymbol}
              repo={repo}
              revision={revision}
              key={inProgressJob.id}
            />
          ))}
          {!!logLines.length && (
            <span>
              <Button
                id={key}
                className="border-0 text-info btn-sm p-1"
                outline
                onClick={this.toggleDetails}
              >
                {detailsShowing ? 'less...' : 'more...'}
              </Button>
              <UncontrolledCollapse toggler={key}>
                {logLines.map(logLine => (
                  <Row
                    className="small text-monospace mt-2 ml-3"
                    key={logLine.line_number}
                  >
                    <div className="pre-wrap text-break">
                      {logLine.subtest}
                      <Row className="ml-3">
                        <div>{logLine.message}</div>
                        <div>{logLine.signature}</div>
                        <div>{logLine.stackwalk_stdout}</div>
                      </Row>
                    </div>
                  </Row>
                ))}
              </UncontrolledCollapse>
            </span>
          )}
        </Col>
        <span className="ml-1">
          <Row className="justify-content-between mr-2">
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
          <Row>
            <span id={`${key}-ratio`} className="mr-3">
              <strong>Pass/Fail Ratio:</strong>{' '}
              {Math.round(passFailRatio * 100)}%
            </span>
            <UncontrolledTooltip target={`${key}-ratio`} placement="left">
              Greater than 50% (and/or classification history) will make this an
              intermittent
            </UncontrolledTooltip>
          </Row>
        </span>
      </Row>
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
  groupedBy: PropTypes.string.isRequired,
};

export default TestFailure;
