import React from 'react';
import { Table } from 'reactstrap';
import PropTypes from 'prop-types';

import InfraCompareTableRow from './InfraCompareTableRow';

export default class InfraCompareTable extends React.PureComponent {
  render() {
    const { data, key } = this.props;

    return (
      <React.Fragment>
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
              <th className="table-width-lg">Base(sec)</th>
              {/* empty for less than/greater than data  */}
              <th className="table-width-sm" aria-label="Comparison" />
              <th className="table-width-lg">New(sec)</th>
              <th className="table-width-lg">Base(fails)</th>
              {/* empty for less than/greater than data  */}
              <th className="table-width-sm" aria-label="Comparison" />
              <th className="table-width-lg">New(fails)</th>
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
      </React.Fragment>
    );
  }
}

InfraCompareTable.propTypes = {
  key: PropTypes.string.isRequired,
  data: PropTypes.arrayOf(PropTypes.shape({})),
};

InfraCompareTable.defaultProps = {
  data: null,
};
