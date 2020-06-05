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
  faCheck,
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
      platform,
      config,
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
      <Row className="border-top pt-2" key={key}>
        <Row className="ml-5 w-100 mb-2 justify-content-between">
          <Col>
            <Row>
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
            </Row>
          </Col>
          <Col className="ml-2">
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
            ){!!failedInParent && <Badge color="info">Failed In Parent</Badge>}
          </Col>
          <Col xs="auto">
            <Button
              onClick={() => this.retriggerJob(failJobs[0])}
              outline
              className="mr-2 border-0"
              title="Retrigger job"
              style={{ lineHeight: '10px' }}
            >
              <FontAwesomeIcon icon={faRedo} />
            </Button>
            <Button
              outline
              className="mr-2 border-0"
              title="Mark resolved"
              style={{ lineHeight: '10px' }}
            >
              <FontAwesomeIcon icon={faCheck} />
            </Button>
          </Col>
          <Col xs="auto">
            <span id={`${key}-ratio`} className="mr-3">
              <strong>Pass/Fail Ratio:</strong>{' '}
              {Math.round(passFailRatio * 100)}%
            </span>
            <UncontrolledTooltip target={`${key}-ratio`} placement="left">
              Greater than 50% (and/or classification history) will make this an
              intermittent
            </UncontrolledTooltip>
          </Col>
        </Row>
        {detailsShowing && (
          <Row className="ml-2">
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
          </Row>
        )}
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
