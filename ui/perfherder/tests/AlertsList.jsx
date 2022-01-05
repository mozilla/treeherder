import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

import SimpleTooltip from '../../shared/SimpleTooltip';

export default class AlertsList extends React.PureComponent {
  render() {
    const { alerts, framework: frameworkName, frameworks } = this.props;
    const {
      total_alerts: totalAlerts,
      total_regressions: regressions,
      suite,
    } = alerts;
    const improvements = totalAlerts - regressions;
    const framework = frameworks.find((item) => item.name === frameworkName);
    console.log(framework);
    return (
      <div className="d-flex justify-content-center">
        <div data-testid="improvements" className="w-50">
          <Link
            to={`./alerts?hideDwnToInv=0&filterText=${suite}&page=1&status=4&framework=${framework.id}`}
            target="_blank"
          >
            <SimpleTooltip
              text={`${improvements || 0}`}
              tooltipText="Improvements"
            />
          </Link>
        </div>
        <div data-testid="regressions" className="w-50">
          <SimpleTooltip
            text={`${regressions || 0}`}
            tooltipText="Regressions"
          />
        </div>
      </div>
    );
  }
}

AlertsList.propTypes = {
  alerts: PropTypes.shape({}).isRequired,
};
