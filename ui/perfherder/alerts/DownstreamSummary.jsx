import React from 'react';
import PropTypes from 'prop-types';

import { getAlertSummary, getTitle } from '../helpers';
import SimpleTooltip from '../../shared/SimpleTooltip';

// TODO remove $stateParams and $state after switching to react router
export default class DownstreamSummary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      tooltipText: '',
    };
  }

  async componentDidMount() {
    const tooltipText = await this.getAlertSummaryTitle(this.props.id);
    this.setState({ tooltipText });
  }

  // TODO error handling
  getAlertSummaryTitle = async id => {
    let alertSummary = this.props.alertSummaries.find(item => item.id === id);
    if (!alertSummary) {
      alertSummary = await getAlertSummary(id);
    }
    return getTitle(alertSummary);
  };

  render() {
    const { id, position } = this.props;
    const { tooltipText } = this.state;

    return (
      <React.Fragment>
        {tooltipText && (
          <SimpleTooltip
            text={
              <span>
                <a href={`perf.html#/alerts?id=${id}`} className="text-info">
                  #{id}
                </a>
                {position === 0 ? '' : ', '}
              </span>
            }
            tooltipText={tooltipText}
          />
        )}
      </React.Fragment>
    );
  }
}

DownstreamSummary.propTypes = {
  id: PropTypes.number.isRequired,
  alertSummaries: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  position: PropTypes.number.isRequired,
};
