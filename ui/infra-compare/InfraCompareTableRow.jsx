import React from 'react';
import PropTypes from 'prop-types';

export default class InfraCompareTableRow extends React.PureComponent {
  render() {
    const {
      rowLevelResults: {
        suite,
        originalValue,
        newValue,
        originalFailures,
        newFailures,
        originalDataPoints,
        newDataPoints,
      },
    } = this.props;

    return (
      <tr color="danger">
        <th className="text-left">{suite}</th>
        <td>{originalValue}</td>
        <td>
          {originalValue < newValue && <span>&lt;</span>}
          {originalValue > newValue && <span>&gt;</span>}
        </td>
        <td>{newValue}</td>
        <td>{originalFailures}</td>
        <td>
          {originalFailures < newFailures && <span>&lt;</span>}
          {originalFailures > newFailures && <span>&gt;</span>}
        </td>
        <td>{newFailures}</td>
        <td>{originalDataPoints}</td>
        <td>
          {originalDataPoints < newDataPoints && <span>&lt;</span>}
          {originalDataPoints > newDataPoints && <span>&gt;</span>}
        </td>
        <td>{newDataPoints}</td>
      </tr>
    );
  }
}

InfraCompareTableRow.propTypes = {
  user: PropTypes.shape({}).isRequired,
  rowLevelResults: PropTypes.shape({}).isRequired,
};
