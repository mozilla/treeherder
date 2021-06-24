import React from 'react';

import ProgressBar from '../../shared/ProgressBar';
import SimpleTooltip from '../../shared/SimpleTooltip';
import { formatNumber } from '../perf-helpers/helpers';

export default class AlertTableMagnitude extends React.PureComponent {
  // arbitrary scale from 0-20% multiplied by 5, capped
  // at 100 (so 20% regression === 100% bad)
  getCappedMagnitude = (percent) => Math.min(Math.abs(percent) * 5, 100);

  render() {
    const { alert } = this.props;
    return (
      <div className="d-flex align-items-end justify-content-center">
        <div className="w-50 text-right">{formatNumber(alert.prev_value)}</div>
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
        <span className="w-50">{formatNumber(alert.new_value)}</span>
      </div>
    );
  }
}
