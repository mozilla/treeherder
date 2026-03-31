import { memo } from 'react';
import PropTypes from 'prop-types';
import { Col, Row } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheck,
  faExclamationTriangle,
  faSpinner,
} from '@fortawesome/free-solid-svg-icons';

const StatusIcon = ({ value, isInProgress }) => {
  if (isInProgress) {
    return <FontAwesomeIcon icon={faSpinner} className="ms-2" />;
  }

  return value > 0 ? (
    <FontAwesomeIcon
      icon={faExclamationTriangle}
      className="ms-2 text-danger"
    />
  ) : (
    <FontAwesomeIcon icon={faCheck} className="ms-2 text-success" />
  );
};

const PushCountsDetails = ({
  build_failed,
  lint_failed,
  pending,
  running,
  test_failed,
  intermittentBuild,
  intermittentLint,
  intermittentTests,
}) => {
  const inProgress = pending + running;
  return (
    <div className="mt-4">
      <Row className="ms-3 mt-2">
        <Col>
          <div className="d-flex align-items-center">
            Linting
            <StatusIcon value={lint_failed} isInProgress={inProgress > 0} />
          </div>
          {lint_failed > 0 && (
            <div
              className="text-danger mt-1"
              title={`${lint_failed} lint failures`}
            >
              {lint_failed} lint {lint_failed === 1 ? 'job' : 'jobs'} failed
              {intermittentLint > 0 && (
                <>
                  <br />({intermittentLint} intermittent
                  {intermittentLint === 1 ? '' : 's'})
                </>
              )}
            </div>
          )}
        </Col>
        <Col>
          <div className="d-flex align-items-center">
            Builds
            <StatusIcon value={build_failed} isInProgress={inProgress > 0} />
          </div>
          {build_failed > 0 && (
            <div
              className="text-danger mt-1"
              title={`${build_failed} build jobs failed`}
            >
              {build_failed} build {build_failed === 1 ? 'job' : 'jobs'} failed
              {intermittentBuild > 0 && (
                <>
                  <br />({intermittentBuild} intermittent
                  {intermittentBuild === 1 ? '' : 's'})
                </>
              )}
            </div>
          )}
        </Col>
        <Col>
          <div className="d-flex align-items-center">
            Tests
            <StatusIcon value={test_failed} isInProgress={inProgress > 0} />
          </div>

          {test_failed > 0 && (
            <div
              className="text-danger mt-1"
              title={`${test_failed} job failures`}
            >
              {test_failed} {test_failed === 1 ? 'job' : 'jobs'} failed
              {intermittentTests > 0 && (
                <>
                  <br />({intermittentTests} intermittent
                  {intermittentTests === 1 ? '' : 's'})
                </>
              )}
            </div>
          )}
        </Col>
      </Row>
    </div>
  );
};

PushCountsDetails.propTypes = {
  build_failed: PropTypes.number.isRequired,
  lint_failed: PropTypes.number.isRequired,
  pending: PropTypes.number.isRequired,
  running: PropTypes.number.isRequired,
  test_failed: PropTypes.number.isRequired,
  intermittentBuild: PropTypes.number.isRequired,
  intermittentLint: PropTypes.number.isRequired,
  intermittentTests: PropTypes.number.isRequired,
};

export default memo(PushCountsDetails);
