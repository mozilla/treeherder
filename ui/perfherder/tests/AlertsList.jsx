import React from 'react';
import PropTypes from 'prop-types';

import SimpleTooltip from '../../shared/SimpleTooltip';

export default class AlertsList extends React.PureComponent {
  render() {
    const { alerts } = this.props;
    const {
      total_alerts: totalAlerts,
      total_regressions: regressions,
    } = alerts;
    const improvements = totalAlerts - regressions;
    return (
      <div className="d-flex justify-content-around">
        <div data-testid="improvements">
          <SimpleTooltip
            text={`${improvements || 0}`}
            tooltipText="Improvements"
          />
        </div>
        <div data-testid="regressions">
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
