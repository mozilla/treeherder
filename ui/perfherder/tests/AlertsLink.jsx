import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

import SimpleTooltip from '../../shared/SimpleTooltip';
import { summaryStatusMap } from '../perf-helpers/constants';

export default class AlertsLink extends React.PureComponent {
  render() {
    const { alerts, framework: frameworkName, allFrameworks } = this.props;
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
    return (
      <div className="d-flex justify-content-center">
        <div data-testid="improvements" className="w-50">
          <Link
            to={`./alerts?hideDwnToInv=0&filterText=${filterText}&page=1&status=${summaryStatusMap.improvement}&framework=${framework.id}`}
            target="_blank"
          >
            <SimpleTooltip
              text={`${improvements || 0}`}
              tooltipText="Improvements"
            />
          </Link>
        </div>
        <div data-testid="regressions" className="w-50">
          <Link
            to={`./alerts?hideDwnToInv=0&filterText=${filterText}&page=1&status=${summaryStatusMap['all regressions']}&framework=${framework.id}`}
            target="_blank"
          >
            <SimpleTooltip
              text={`${regressions || 0}`}
              tooltipText="Regressions"
            />
          </Link>
        </div>
        <div data-testid="untriaged" className="w-50">
          <Link
            to={`./alerts?hideDwnToInv=0&filterText=${filterText}&page=1&status=${summaryStatusMap.untriaged}&framework=${framework.id}`}
            target="_blank"
          >
            <SimpleTooltip text={`${untriaged || 0}`} tooltipText="Untriaged" />
          </Link>
        </div>
      </div>
    );
  }
}

AlertsLink.propTypes = {
  alerts: PropTypes.shape({}).isRequired,
};
