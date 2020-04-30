import React from 'react';
import { Button, Table } from 'reactstrap';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHashtag } from '@fortawesome/free-solid-svg-icons';

import { getHashBasedId } from '../helpers';
import { hashFunction } from '../../helpers/utils';

import RetriggerButton from './RetriggerButton';
import CompareTableRow from './CompareTableRow';

export default class CompareTable extends React.PureComponent {
  render() {
    const {
      data,
      testName,
      user,
      hasSubtests,
      isBaseAggregate,
      onPermalinkClick,
      history,
      onModalOpen,
    } = this.props;

    return (
      <Table
        id={getHashBasedId(testName, hashFunction)}
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
            <th className="text-left">
              <span>{testName}</span>
              {onPermalinkClick && (
                <Button
                  className="permalink p-0 ml-1"
                  color="link"
                  onClick={() =>
                    onPermalinkClick(
                      getHashBasedId(testName, hashFunction),
                      history,
                      this.header,
                    )
                  }
                  title="Permalink to this test table"
                  aria-label={`Permalink to test ${testName} table`}
                >
                  <FontAwesomeIcon icon={faHashtag} />
                </Button>
              )}
            </th>
            <th className="table-width-lg">Base</th>
            {/* empty for less than/greater than data */}
            <th className="table-width-sm" aria-label="Comparison" />
            <th className="table-width-lg">New</th>
            <th className="table-width-lg">Delta</th>
            <th className="table-width-lg">Magnitude of Difference</th>
            <th className="table-width-lg">Confidence</th>
            <th className="text-right table-width-md">
              {hasSubtests &&
                data &&
                data.length &&
                (data[0].newRetriggerableJobId || !isBaseAggregate) &&
                user.isLoggedIn && (
                  <RetriggerButton onClick={() => onModalOpen(data[0])} />
                )}
              Total Runs
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((rowLevelResults) => (
            <CompareTableRow
              key={rowLevelResults.name}
              rowLevelResults={rowLevelResults}
              hashFunction={hashFunction}
              onModalOpen={onModalOpen}
              {...this.props}
            />
          ))}
        </tbody>
      </Table>
    );
  }
}

CompareTable.propTypes = {
  data: PropTypes.arrayOf(PropTypes.shape({})),
  testName: PropTypes.string.isRequired,
  onModalOpen: PropTypes.func.isRequired,
  hashFunction: PropTypes.func,
  onPermalinkClick: PropTypes.func,
};

CompareTable.defaultProps = {
  data: null,
  hashFunction,
  onPermalinkClick: undefined,
};
