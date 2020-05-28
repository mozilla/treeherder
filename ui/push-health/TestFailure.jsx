import React from 'react';
import PropTypes from 'prop-types';
import {
  Badge,
  Button,
  Container,
  Row,
  Col,
  UncontrolledTooltip,
} from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faRedo,
  faCaretRight,
  faCaretDown,
} from '@fortawesome/free-solid-svg-icons';

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
    this.setState((prevState) => ({
      detailsShowing: !prevState.detailsShowing,
    }));
  };

  retriggerJob = async (job) => {
    const { notify, currentRepo } = this.props;

    JobModel.retrigger([job], currentRepo, notify);
  };

  render() {
    const { failure, repo, revision, groupedBy } = this.props;
    const {
      testName,
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
      failedInParent,
    } = failure;
    const { detailsShowing } = this.state;
    const jobList = [
      ...failJobs,
      ...passJobs,
      ...passInFailedJobs,
      ...inProgressJobs,
    ];

    return (
      <Row className="border-top m-3" key={key}>
        <Col>
          <Button
            id={key}
            className="border-0 text-darker-info btn-sm w-5 px-2 mx-2"
            outline
            data-testid={`toggleDetails-${key}`}
            onClick={this.toggleDetails}
          >
            <FontAwesomeIcon
              icon={detailsShowing ? faCaretDown : faCaretRight}
              style={{ minWidth: '1em' }}
              className="mr-1"
            />
            <span>
              {groupedBy !== 'path' && `${testName} `}
              {groupedBy !== 'platform' && `${platform} ${config}`}
            </span>
          </Button>
          <Button
            onClick={() => this.retriggerJob(failJobs[0])}
            outline
            className="btn btn-sm mr-2"
            title="Retrigger job"
            style={{ lineHeight: '10px' }}
          >
            <FontAwesomeIcon icon={faRedo} title="Retrigger" />
          </Button>
          <span className="ml-2" title={jobGroup}>
            {jobGroupSymbol}
          </span>
          {tier > 1 && (
            <span className="ml-1 small text-muted">[tier-{tier}]</span>
          )}
          (
          {jobList.map((job) => (
            <span key={job.id} className="mr-1">
              <Job job={job} revision={revision} repo={repo} />
            </span>
          ))}
          )
          {detailsShowing && (
            <React.Fragment>
              {jobList.map((job) => (
                <span key={job.id} data-testid="log-lines">
                  {logLines.map((logLine) => (
                    <Row className="small mt-2" key={logLine.line_number}>
                      <Container className="pre-wrap text-break">
                        {logLine.subtest}
                        <Col>
                          {logLine.message && (
                            <Row className="mb-3">
                              <Col xs="1" className="font-weight-bold">
                                Message:
                              </Col>
                              <Col className="text-monospace">
                                {logLine.message}
                              </Col>
                            </Row>
                          )}
                          {logLine.signature && (
                            <Row className="mb-3">
                              <Col xs="1" className="font-weight-bold">
                                Signature:
                              </Col>
                              <Col className="text-monospace">
                                {logLine.signature}
                              </Col>
                            </Row>
                          )}
                          {logLine.stackwalk_stdout && (
                            <Row className="mb-3">
                              <Col xs="1" className="font-weight-bold">
                                Stack
                              </Col>
                              <Col className="text-monospace">
                                {logLine.stackwalk_stdout}
                              </Col>
                            </Row>
                          )}
                        </Col>
                      </Container>
                    </Row>
                  ))}
                </span>
              ))}
            </React.Fragment>
          )}
        </Col>
        <span className="ml-1">
          <Row className="justify-content-between mr-2">
            {!!confidence && (
              <span title="Best guess at a classification" className="ml-auto">
                {classificationMap[suggestedClassification]}
                <Badge
                  color="darker-secondary"
                  className="ml-2 mr-3"
                  title="Confidence in this classification guess"
                >
                  {confidence}
                </Badge>
              </span>
            )}
          </Row>
          {!!failedInParent && (
            <Row>
              <Badge color="info">Failed In Parent</Badge>
            </Row>
          )}
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
  currentRepo: PropTypes.shape({}).isRequired,
  revision: PropTypes.string.isRequired,
  notify: PropTypes.func.isRequired,
  groupedBy: PropTypes.string.isRequired,
};

export default TestFailure;
