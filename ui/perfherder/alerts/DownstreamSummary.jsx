import React from 'react';
import PropTypes from 'prop-types';

import { getTitle } from '../helpers';
import SimpleTooltip from '../../shared/SimpleTooltip';
import { getData } from '../../helpers/http';
import { endpoints } from '../constants';
import { getApiUrl } from '../../helpers/url';

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

  getAlertSummaryTitle = async (id) => {
    const { alertSummaries, updateViewState } = this.props;
    let alertSummary = alertSummaries.find((item) => item.id === id);

    if (!alertSummary) {
      const { data, failureStatus } = await getData(
        getApiUrl(`${endpoints.alertSummary}${id}/`),
      );

      if (failureStatus) {
        return updateViewState({
          errorMessages: [
            `Failed to retrieve downstream alert summary: ${data}`,
          ],
        });
      }
      alertSummary = data;
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
  updateViewState: PropTypes.func.isRequired,
};
