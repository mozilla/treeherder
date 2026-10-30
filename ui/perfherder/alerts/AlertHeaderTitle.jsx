import React from 'react';
import PropTypes from 'prop-types';
import { faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Link } from 'react-router';
import { Row, Col, Badge } from 'react-bootstrap';

import Clipboard from '../../shared/Clipboard';
import { getFrameworkName, getTitle } from '../perf-helpers/helpers';
import { severeAlertSeverities } from '../perf-helpers/constants';

const changeTypeBadges = {
  regression: 'danger',
  improvement: 'success',
};

export default class AlertHeaderTitle extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  render() {
    const { alertSummary, frameworks } = this.props;

    const { severity, change_type: changeType } = alertSummary;
    const showSeverity = severeAlertSeverities.includes(severity);
    const changeTypeBadge = changeTypeBadges[changeType];

    return (
      <Row>
        <Col className="d-flex align-items-start p-0">
          <Link
            className="text-dark me-1"
            target="_blank"
            to={`/perfherder/alerts?id=${alertSummary.id}&hideDwnToInv=0`}
            id={`alert summary ${alertSummary.id.toString()} title`}
            data-testid={`alert summary ${alertSummary.id.toString()} title`}
          >
            <h6 className="font-weight-bold d-flex align-items-start gap-2">
              <span>
                Alert #{alertSummary.id} - {alertSummary.repository} -{' '}
                {getTitle(alertSummary)}{' '}
                <FontAwesomeIcon
                  icon={faExternalLinkAlt}
                  className="icon-superscript"
                />
              </span>
            </h6>
            <Col>
              <Badge
                bg="secondary"
                text="white"
                className="me-2 mb-2 flex-shrink-0"
              >
                {getFrameworkName(frameworks, alertSummary.framework)}
              </Badge>
              {showSeverity ? (
                <Badge bg="danger" className="flex-shrink-0 me-2">
                  {severity}
                </Badge>
              ) : null}
              {changeTypeBadge ? (
                <Badge
                  bg="light"
                  text={changeTypeBadge}
                  className={`flex-shrink-0 me-2 border border-${changeTypeBadge}`}
                >
                  {changeType}
                </Badge>
              ) : null}
            </Col>
          </Link>
          <Clipboard
            text={`${alertSummary.id}`}
            description="Alert ID"
            variant="transparent"
          />
        </Col>
      </Row>
    );
  }
}

AlertHeaderTitle.propTypes = {
  alertSummary: PropTypes.shape({}).isRequired,
};
