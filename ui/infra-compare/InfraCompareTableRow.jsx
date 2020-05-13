import React from 'react';
import PropTypes from 'prop-types';

import ProgressBar from '../shared/ProgressBar';

export default class InfraCompareTableRow extends React.PureComponent {
  getColorClass = (data, type) => {
    const { className, isRegression, isImprovement } = data;
    if (type === 'bar' && !isRegression && !isImprovement) return 'secondary';
    if (type === 'background' && className === 'warning')
      return `bg-${className}`;
    if (type === 'text' && className) return `text-${className}`;
    return className;
  };

  render() {
    const { testName, rowLevelResults } = this.props;

    return (
      <React.Fragment>
        <tr>
          <th className="text-left">Average Run time</th>
          <td>{rowLevelResults.originalValue}</td>
          <td>
            {rowLevelResults.originalValue < rowLevelResults.newValue && (
              <span>&lt;</span>
            )}
            {rowLevelResults.originalValue > rowLevelResults.newValue && (
              <span>&gt;</span>
            )}
          </td>
          <td>{rowLevelResults.newValue}</td>
          <td>{rowLevelResults.delta}</td>
          {rowLevelResults.delta ? (
            <ProgressBar
              magnitude={rowLevelResults.magnitude}
              regression={!rowLevelResults.newIsBetter}
              color={this.getColorClass(rowLevelResults, 'bar')}
            />
          ) : null}
        </tr>
        <tr
          id={testName}
          aria-label="Comparison table row"
          ref={(el) => {
            this.rowTitle = el;
          }}
        >
          <th className="text-left">Failures</th>
          <td>{rowLevelResults.originalFailures}</td>
          <td>
            {rowLevelResults.originalFailures < rowLevelResults.newFailures && (
              <span>&lt;</span>
            )}
            {rowLevelResults.originalFailures > rowLevelResults.newFailures && (
              <span>&gt;</span>
            )}
          </td>
          <td>{rowLevelResults.newFailures}</td>
          <td>{rowLevelResults.failureDelta}</td>
          {rowLevelResults.failureDelta ? (
            <ProgressBar
              magnitude={rowLevelResults.failureDelta}
              color={this.getColorClass(rowLevelResults, 'bar')}
            />
          ) : null}
        </tr>
        <tr
          id={testName}
          aria-label="Comparison table row"
          ref={(el) => {
            this.rowTitle = el;
          }}
        >
          <th className="text-left">Failures Average Duration</th>
          <td>{rowLevelResults.originalFailureAvgRunTime}</td>
          <td>
            {rowLevelResults.originalFailureAvgRunTime <
              rowLevelResults.newFailureAvgRunTime && <span>&lt;</span>}
            {rowLevelResults.originalFailureAvgRunTime >
              rowLevelResults.newFailureAvgRunTime && <span>&gt;</span>}
          </td>
          <td>{rowLevelResults.newFailureAvgRunTime}</td>
          <td>{rowLevelResults.failureRunTimeDelta}</td>
          {rowLevelResults.failureRunTimeDelta ? (
            <ProgressBar
              magnitude={rowLevelResults.failureRuntimeMagnitude}
              color={this.getColorClass(rowLevelResults, 'bar')}
            />
          ) : null}
        </tr>
      </React.Fragment>
    );
  }
}

InfraCompareTableRow.propTypes = {
  testName: PropTypes.string.isRequired,
};
