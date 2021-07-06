import React from 'react';
import PropTypes from 'prop-types';
import numeral from 'numeral';

import ProgressBar from '../../shared/ProgressBar';
import SimpleTooltip from '../../shared/SimpleTooltip';
import { formatNumber } from '../perf-helpers/helpers';

export default class Magnitude extends React.PureComponent {
  // arbitrary scale from 0-20% multiplied by 5, capped
  // at 100 (so 20% regression === 100% bad)
  getCappedMagnitude = (percent) => Math.min(Math.abs(percent) * 5, 100);

  abbreviateNumber = (num) =>
    numeral(num).format('0.0a').toString().toUpperCase();

  render() {
    const { alert } = this.props;
    return (
      <div className="d-flex align-items-end justify-content-center">
        <div
          className="w-50 text-right text-nowrap"
          data-testid="previous-value"
        >
          <SimpleTooltip
            textClass="detail-hint"
            text={this.abbreviateNumber(alert.prev_value)}
            tooltipText={`Previous value: ${formatNumber(alert.prev_value)}`}
            autohide={false}
          />
        </div>
        <div className="d-flex flex-column">
          <div className="align-self-center pb-1">
            <SimpleTooltip
              textClass="detail-hint"
              text={`${alert.amount_pct}%`}
              tooltipText={`Absolute difference: ${alert.amount_abs}`}
              autohide={false}
            />
          </div>
          <div className="px-2 table-width-lg align-self-center">
            <ProgressBar
              magnitude={this.getCappedMagnitude(alert.amount_pct)}
              regression={alert.is_regression}
              color={!alert.is_regression ? 'success' : 'danger'}
            />
          </div>
        </div>
        <div className="w-50 text-nowrap" data-testid="new-value">
          <SimpleTooltip
            textClass="detail-hint"
            text={this.abbreviateNumber(alert.new_value)}
            tooltipText={`New value: ${formatNumber(alert.new_value)}`}
            autohide={false}
          />
        </div>
      </div>
    );
  }
}

Magnitude.propTypes = {
  alert: PropTypes.shape({}).isRequired,
};
