import React from 'react';
import { Table } from 'reactstrap';
import PropTypes from 'prop-types';

import InfraCompareTableRow from './InfraCompareTableRow';

export default class InfraCompareTable extends React.PureComponent {
  render() {
    const { data, key } = this.props;

    return (
      <Table
        id={key}
        aria-label="Comparison table"
        sz="small"
        className="compare-table mb-0 px-0"
        key={key}
        innerRef={(el) => {
          this.header = el;
        }}
      >
        <thead>
          <tr className="subtest-header bg-lightgray">
            <th className="3text-left, table-width-lg">
              <span>{data[0].platform}</span>
            </th>
            <th className="table-width-sm">sec(Base)</th>
            {/* empty for less than/greater than data  */}
            <th className="table-width-sm" aria-label="Comparison" />
            <th className="table-width-sm">sec(New)</th>
            <th className="table-width-sm">fails(Base)</th>
            {/* empty for less than/greater than data  */}
            <th className="table-width-sm" aria-label="Comparison" />
            <th className="table-width-sm">fails(New)</th>
            <th className="table-width-sm">Data Points(Base)</th>
            {/* empty for less than/greater than data  */}
            <th className="table-width-sm" aria-label="Comparison" />
            <th className="table-width-sm">Data Points(New)</th>
          </tr>
        </thead>
        {data.map((suiteResults) => (
          <tbody>
            <InfraCompareTableRow
              key={suiteResults.suite}
              rowLevelResults={suiteResults}
              {...this.props}
            />
          </tbody>
        ))}
      </Table>
    );
  }
}

InfraCompareTable.propTypes = {
  data: PropTypes.arrayOf(PropTypes.shape({})),
};

InfraCompareTable.defaultProps = {
  data: null,
};
