import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Col, Row } from 'react-bootstrap';
import { faHeart } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import broken from '../img/push-health-broken.png';
import ok from '../img/push-health-ok.png';
import { getPushHealthUrl } from '../helpers/url';

import StatusButton from './StatusButton';

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
      metrics,
    } = status;
    const { linting, builds, tests } = metrics;
    const heartSize = 20;
    const pushHealthUrl = getPushHealthUrl({ revision, repo: repoName });
    const noResultsFound =
      metrics &&
      linting.result === 'none' &&
      builds.result === 'none' &&
      tests.result === 'none';

    if (noResultsFound) return <React.Fragment />;
    return (
      <Col xs="8" className="ps-0">
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
                  className="me-1"
                />
              ) : (
                <span className="mx-1 text-darker-secondary">
                  <FontAwesomeIcon
                    icon={faHeart}
                    height={heartSize}
                    width={heartSize}
                    variant="darker-secondary"
                  />
                </span>
              )}
              {needInvestigation ? 'Debug with Push Health' : 'Push Health'}
            </div>
          </a>
        </span>
        {healthStatus && (
          <Row className="ms-3 mt-2">
            <Col>
              {linting.result !== 'none' && (
                <StatusButton
                  failureCount={lintFailureCount}
                  inProgressCount={lintingInProgressCount}
                  status={linting.result}
                  title="Linting"
                  repo={repoName}
                  revision={revision}
                />
              )}
            </Col>
            <Col>
              {builds.result !== 'none' && (
                <StatusButton
                  failureCount={buildFailureCount}
                  inProgressCount={buildInProgressCount}
                  status={builds.result}
                  title="Builds"
                  repo={repoName}
                  revision={revision}
                />
              )}
            </Col>
            <Col>
              {tests.result !== 'none' && (
                <StatusButton
                  failureCount={testFailureCount}
                  inProgressCount={testInProgressCount}
                  status={tests.result}
                  title="Tests"
                  repo={repoName}
                  revision={revision}
                />
              )}
            </Col>
          </Row>
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
