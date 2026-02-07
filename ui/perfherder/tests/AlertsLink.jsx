import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router';

import SimpleTooltip from '../../shared/SimpleTooltip';
import { summaryStatusMap } from '../perf-helpers/constants';

export default class AlertsLink extends React.PureComponent {
  getTooltip = (type) => {
    return (
      <>
        {type.charAt(0).toUpperCase() + type.slice(1)} <br />
        {type !== 'untriaged' && (
          <i>Note: Untriaged {type} can be seen through untriaged link</i>
        )}
      </>
    );
  };

  getCell = (type, alertsNumber, filterText, framework) => {
    const summaryStatus = {
      improvements: summaryStatusMap.improvement,
      regressions: summaryStatusMap['all regressions'],
      untriaged: summaryStatusMap.untriaged,
    };

    return (
      <div className="d-flex justify-content-center">
        <div data-testid={type} className="w-50">
          <Link
            to={`./alerts?hideDwnToInv=0&filterText=${filterText}&page=1&status=${summaryStatus[type]}&framework=${framework.id}`}
            target="_blank"
          >
            <SimpleTooltip
              text={`${alertsNumber[type] || 0}`}
              tooltipText={this.getTooltip(type)}
            />
          </Link>
        </div>
      </div>
    );
  };

  render() {
    const {
      alerts,
      framework: frameworkName,
      allFrameworks,
      type,
    } = this.props;
    const {
      total_alerts: totalAlerts,
      total_regressions: regressions,
      total_untriaged: untriaged,
      suite,
      test,
    } = alerts;
    const improvements = totalAlerts - regressions;
    const framework = allFrameworks.find((item) => item.name === frameworkName);

    const filterText = suite && test ? suite.concat(`+${test}`) : suite || test;
    const alertsNumber = {
      improvements,
      regressions,
      untriaged,
    };

    return this.getCell(type, alertsNumber, filterText, framework);
  }
}

AlertsLink.propTypes = {
  alerts: PropTypes.shape({}).isRequired,
};
