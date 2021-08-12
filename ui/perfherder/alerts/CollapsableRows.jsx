import React from 'react';
import PropTypes from 'prop-types';
import { faAngleUp } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import AlertTableRow from './AlertTableRow';

export default class CollapsableRows extends React.Component {
  visibleRows = 20;

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

    const startRows = filteredAndSortedAlerts.slice(0, this.visibleRows);
    const middleRows = filteredAndSortedAlerts.slice(
      this.visibleRows,
      filteredAndSortedAlerts.length - 6,
    );
    const endRows = filteredAndSortedAlerts.slice(
      filteredAndSortedAlerts.length - 6,
      filteredAndSortedAlerts.length,
    );

    return (
      <React.Fragment>
        {startRows.map((alert) => (
          <AlertTableRow key={alert.id} alert={alert} {...this.props} />
        ))}
        {isOpen && (
          <React.Fragment>
            {middleRows.map((alert) => (
              <AlertTableRow key={alert.id} alert={alert} {...this.props} />
            ))}
            <tr
              className="border-left border-right"
              role="button"
              onClick={() => this.toggleRows()}
            >
              <td />
              <td />
              <td>
                <span className="cursor-pointer">
                  <FontAwesomeIcon icon={faAngleUp} />
                  Show less alerts
                </span>
              </td>
              <td />
              <td />
              <td />
              <td />
            </tr>
          </React.Fragment>
        )}
        {!isOpen && (
          <React.Fragment>
            <tr
              className="border-left border-right cursor-pointer"
              role="button"
              onClick={() => this.toggleRows()}
            >
              <td className="cursor-pointer" />
              <td />
              <td>
                <span className="cursor-pointer">...</span>
              </td>
              <td>
                <span className="cursor-pointer">...</span>
              </td>
              <td>
                <span className="cursor-pointer">...</span>
              </td>
              <td>
                <span className="cursor-pointer">...</span>
              </td>
              <td>
                <span className="cursor-pointer">...</span>
              </td>
            </tr>
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
