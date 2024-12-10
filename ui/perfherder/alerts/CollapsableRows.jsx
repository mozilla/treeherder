import React from 'react';
import PropTypes from 'prop-types';
import { faAngleDown, faAngleUp } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import AlertTableRow from './AlertTableRow';

export default class CollapsableRows extends React.Component {
  topRows = 20;

  bottomRows = 6;

  constructor(props) {
    super(props);
    this.state = {
      isOpen: false,
    };
  }

  toggleRows = () => {
    this.setState((prevState) => ({
      isOpen: !prevState.isOpen,
    }));
  };

  render() {
    const { filteredAndSortedAlerts } = this.props;
    const { isOpen } = this.state;

    const startRows = filteredAndSortedAlerts.slice(0, this.topRows);
    const middleRows = filteredAndSortedAlerts.slice(
      this.topRows,
      filteredAndSortedAlerts.length - this.bottomRows,
    );
    const endRows = filteredAndSortedAlerts.slice(
      filteredAndSortedAlerts.length - this.bottomRows,
      filteredAndSortedAlerts.length,
    );

    return (
      <React.Fragment>
        {startRows.map((alert) => (
          <AlertTableRow key={alert.id} alert={alert} {...this.props} />
        ))}
        <tr
          className="border-left border-right"
          role="button"
          onClick={() => this.toggleRows()}
          data-testid={isOpen ? 'show-less-alerts' : 'show-more-alerts'}
        >
          <td className="text-right" colSpan="5" id="moreLessAlerts-{alert.id}">
            <span className="cursor-pointer">
              <FontAwesomeIcon icon={isOpen ? faAngleUp : faAngleDown} />{' '}
              {isOpen ? 'Show less alerts' : 'Show more alerts'}
            </span>
          </td>
          <td colSpan="3" aria-labelledby="moreLessAlerts-{alert.id}" />
        </tr>
        {isOpen && (
          <React.Fragment>
            {middleRows.map((alert) => (
              <AlertTableRow key={alert.id} alert={alert} {...this.props} />
            ))}
          </React.Fragment>
        )}
        {endRows.map((alert) => (
          <AlertTableRow key={alert.id} alert={alert} {...this.props} />
        ))}
      </React.Fragment>
    );
  }
}

CollapsableRows.propTypes = {
  alertSummary: PropTypes.shape({
    repository: PropTypes.string,
    framework: PropTypes.number,
    id: PropTypes.number,
  }).isRequired,
  user: PropTypes.shape({}),
  updateSelectedAlerts: PropTypes.func.isRequired,
  selectedAlerts: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  updateViewState: PropTypes.func.isRequired,
};

CollapsableRows.defaultProps = {
  user: null,
};
