import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Col, Row, Spinner } from 'reactstrap';
import {
  faHeart,
  faCheck,
  faExclamationTriangle,
  faClock,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import broken from '../img/push-health-broken.png';
import ok from '../img/push-health-ok.png';
import { getPushHealthUrl } from '../helpers/url';

function MetricCount(props) {
  const { failure, inProgress } = props;
  let color = 'success';
  let icon = faCheck;
  let text = 'Passed';

  if (failure) {
    color = 'danger';
    icon = faExclamationTriangle;
    text = `Failures (${failure})`;
  } else if (inProgress) {
    color = 'secondary';
    icon = faClock;
    text = `In Progress (${inProgress})`;
  }

  return (
    <div className={`text-${color}`}>
      <FontAwesomeIcon icon={icon} color={color} className="mr-2" />
      {text}
    </div>
  );
}

class PushHealthSummary extends PureComponent {
  render() {
    const { healthStatus, revision, repoName } = this.props;
    const status = healthStatus || {};
    const {
      needInvestigation,
      testFailureCount,
      testInProgressCount,
      buildFailureCount,
      lintFailureCount,
      buildInProgressCount,
      lintingInProgressCount,
    } = status;
    const heartSize = 20;
    const pushHealthUrl = getPushHealthUrl({ revision, repo: repoName });

    return (
      <Col xs="8" className="pl-0">
        <span className="d-flex">
          <a
            href={pushHealthUrl}
            title="View Push Health details for this push"
          >
            <div
              className={`p-2 text-darker-info ${
                needInvestigation && 'button-border border-darker-info'
              }`}
            >
              {healthStatus !== null ? (
                <img
                  src={needInvestigation ? broken : ok}
                  alt={needInvestigation ? 'Broken' : 'OK'}
                  width={heartSize}
                  height={heartSize}
                  className="mr-1"
                />
              ) : (
                <span className="mx-1 text-darker-secondary">
                  <FontAwesomeIcon
                    icon={faHeart}
                    height={heartSize}
                    width={heartSize}
                    color="darker-secondary"
                  />
                </span>
              )}
              {needInvestigation ? 'Debug with Push Health' : 'Push Health'}
            </div>
          </a>
        </span>
        {healthStatus ? (
          <a
            href={pushHealthUrl}
            title="View Push Health details for this push"
          >
            <Row className="ml-3 mt-2">
              <Col>
                <Row className=" font-size-18 text-darker-secondary">
                  Linting
                  <FontAwesomeIcon
                    icon={faChevronRight}
                    className="ml-2 mt-2 font-size-11"
                  />
                </Row>
                <Row>
                  <MetricCount
                    failure={lintFailureCount}
                    inProgress={lintingInProgressCount}
                  />
                </Row>
              </Col>
              <Col>
                <Row className="font-size-18 text-darker-secondary">
                  Builds
                  <FontAwesomeIcon
                    icon={faChevronRight}
                    className="ml-2 mt-2 font-size-11"
                  />
                </Row>
                <Row>
                  <MetricCount
                    failure={buildFailureCount}
                    inProgress={buildInProgressCount}
                  />
                </Row>
              </Col>
              <Col>
                <Row className="font-size-18 text-darker-secondary">
                  Tests
                  <FontAwesomeIcon
                    icon={faChevronRight}
                    className="ml-2 mt-2 font-size-11"
                  />
                </Row>
                <Row>
                  <MetricCount
                    failure={testFailureCount}
                    inProgress={testInProgressCount}
                  />
                </Row>
              </Col>
            </Row>
          </a>
        ) : (
          <Spinner />
        )}
      </Col>
    );
  }
}

PushHealthSummary.propTypes = {
  revision: PropTypes.string.isRequired,
  repoName: PropTypes.string.isRequired,
  healthStatus: PropTypes.shape({
    needInvestigation: PropTypes.number,
    testFailureCount: PropTypes.number,
    buildFailureCount: PropTypes.number,
    lintFailureCount: PropTypes.number,
    buildInProgressCount: PropTypes.number,
    lintingInProgressCount: PropTypes.number,
  }),
};

PushHealthSummary.defaultProps = {
  healthStatus: {},
};

export default PushHealthSummary;
