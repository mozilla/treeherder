import React from 'react';
import { Table } from 'reactstrap';
import PropTypes from 'prop-types';

import { getJobsUrl } from '../helpers/url';
import { hashFunction } from '../helpers/utils';

import InfraCompareTableRow from './InfraCompareTableRow';
import { getHashBasedId } from './helpers';

export default class InfraCompareTable extends React.PureComponent {
  render() {
    const {
      data,
      platform,
      validated: { originalProject, newProject, originalRevision, newRevision },
    } = this.props;

    return (
      <Table
        id={platform}
        aria-label="Comparison table"
        sz="small"
        className="compare-table mb-0 px-0"
        key={platform}
        innerRef={(el) => {
          this.header = el;
        }}
      >
        <thead>
          <tr className="subtest-header bg-lightgray">
            <th className="3text-left, table-width-lg">
              <span>{platform}</span>
            </th>
            <th className="table-width-sm">
              <a
                href={getJobsUrl({
                  repo: originalProject,
                  revision: originalRevision,
                  searchStr: platform,
                })}
                target="_blank"
                rel="noopener noreferrer"
              >
                sec(Base)
              </a>
            </th>
            {/* empty for less than/greater than data  */}
            <th className="table-width-sm" aria-label="Comparison" />
            <th className="table-width-sm">
              <a
                href={getJobsUrl({
                  repo: newProject,
                  revision: newRevision,
                  searchStr: platform,
                })}
                target="_blank"
                rel="noopener noreferrer"
              >
                sec(Base)
              </a>
            </th>
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
              hashkey={getHashBasedId(
                suiteResults.suite,
                hashFunction,
                suiteResults.platform,
              )}
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
