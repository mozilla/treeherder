import React from 'react';
import { Table } from 'reactstrap';
import PropTypes from 'prop-types';

import { hashFunction } from '../helpers/utils';

import InfraCompareTableRow from './InfraCompareTableRow';

export default class InfraCompareTable extends React.PureComponent {
  render() {
    const { data, testName } = this.props;

    return (
      <Table
        id={testName}
        aria-label="Comparison table"
        sz="small"
        className="compare-table mb-0 px-0"
        key={testName}
        innerRef={(el) => {
          this.header = el;
        }}
      >
        <thead>
          <tr className="subtest-header bg-lightgray">
            <th className="text-left, table-width-lg">
              <span>{testName}</span>
            </th>
            <th className="table-width-lg">Base</th>
            {/* empty for less than/greater than data */}
            <th className="table-width-sm" aria-label="Comparison" />
            <th className="table-width-lg">New</th>
            <th className="table-width-lg">Delta</th>
            <th className="table-width-lg">Magnitude of Difference</th>
          </tr>
        </thead>
        <tbody>
          {data.map((rowLevelResults) => (
            <InfraCompareTableRow
              key={rowLevelResults.jobName}
              rowLevelResults={rowLevelResults}
              {...this.props}
            />
          ))}
        </tbody>
      </Table>
    );
  }
}

InfraCompareTable.propTypes = {
  data: PropTypes.arrayOf(PropTypes.shape({})),
  testName: PropTypes.string.isRequired,
  hashFunction: PropTypes.func,
  onPermalinkClick: PropTypes.func,
};

InfraCompareTable.defaultProps = {
  data: null,
  hashFunction,
  onPermalinkClick: undefined,
};
