import React from 'react';
import PropTypes from 'prop-types';
import { faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Link } from 'react-router';
import { Row, Col, Badge } from 'react-bootstrap';

import Clipboard from '../../shared/Clipboard';
import { getFrameworkName, getTitle } from '../perf-helpers/helpers';

export default class AlertHeaderTitle extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  isAlertSummaryCritical = (alertSummary) => {
    const { alerts } = alertSummary;

    const criticalTests = [
      'speedometer3 score windows11-64-24h2-shippable',
      'newssite-applink-startup applink_startup android-hw-a55-14-0-aarch64-shippable',
    ];

    const isCritical = alerts.some((alert) => {
      const { series_signature: seriesSignature } = alert;
      const { suite, test, machine_platform: platform } = seriesSignature;

      return criticalTests.includes(`${suite} ${test} ${platform}`);
    });

    return isCritical;
  };

  render() {
    const { alertSummary, frameworks } = this.props;

    const isCritical = this.isAlertSummaryCritical(alertSummary);

    return (
      <Row>
        <Col className="d-flex align-items-start p-0">
          <Link
            className="text-dark me-1"
            target="_blank"
            to={`./alerts?id=${alertSummary.id}&hideDwnToInv=0`}
            id={`alert summary ${alertSummary.id.toString()} title`}
            data-testid={`alert summary ${alertSummary.id.toString()} title`}
          >
            <h6 className="font-weight-bold d-flex align-items-start gap-2">
              <Badge bg="secondary" text="white" className="flex-shrink-0 mt-1">
                {getFrameworkName(frameworks, alertSummary.framework)}
              </Badge>
              {isCritical ? (
                <Badge bg="danger" className="flex-shrink-0">
                  critical
                </Badge>
              ) : null}
              <span>
                Alert #{alertSummary.id} - {alertSummary.repository} -{' '}
                {getTitle(alertSummary)}{' '}
                <FontAwesomeIcon
                  icon={faExternalLinkAlt}
                  className="icon-superscript"
                />
              </span>
            </h6>
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
