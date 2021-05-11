import React from 'react';
import { Button, Table } from 'reactstrap';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHashtag } from '@fortawesome/free-solid-svg-icons';

import { getHashBasedId, getTalosDocsURL } from '../perf-helpers/helpers';
import { hashFunction } from '../../helpers/utils';
import { tableSort, getNextSort, sort } from '../perf-helpers/sort';
import SortButton from '../shared/SortButton';

import RetriggerButton from './RetriggerButton';
import CompareTableRow from './CompareTableRow';

export default class CompareTable extends React.Component {
  constructor(props) {
    super(props);
    const { data } = this.props;

    const { baseName, newName } = this.getBaseAndNewHeaders(data);

    this.state = {
      data,
      tableConfig: {
        TestName: {
          name: 'Test name',
          sortValue: 'name',
          currentSort: tableSort.default,
        },
        Base: {
          name: baseName,
          sortValue: 'originalValue',
          currentSort: tableSort.default,
        },
        Comparison: { name: 'Comparison' },
        New: {
          name: newName,
          sortValue: 'newValue',
          currentSort: tableSort.default,
        },
        Delta: {
          name: 'Delta',
          sortValue: 'deltaPercentage',
          currentSort: tableSort.default,
        },
        Magnitude: {
          name: 'Magnitude of Difference',
          sortValue: 'magnitude',
          currentSort: tableSort.default,
        },
        Confidence: {
          name: 'Confidence',
          sortValue: 'confidence',
          currentSort: tableSort.default,
        },
      },
    };
  }

  componentDidUpdate = (prevProps) => {
    const { data } = this.props;
    const { tableConfig } = this.state;

    if (data !== prevProps.data) {
      Object.keys(tableConfig).forEach((key) => {
        tableConfig[key].currentSort = tableSort.default;
      });
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({ data, tableConfig });
    }
  };

  getBaseAndNewHeaders = (data) => {
    const [firstElementOfData] = data;
    const {
      baseColumnMeasurementUnit,
      newColumnMeasurementUnit,
    } = firstElementOfData;
    let baseName = 'Base';
    let newName = 'New';
    if (baseColumnMeasurementUnit && newColumnMeasurementUnit) {
      baseName += ` (${baseColumnMeasurementUnit})`;
      newName += ` (${newColumnMeasurementUnit})`;
    }
    return { baseName, newName };
  };

  onChangeSort = (currentColumn) => {
    let { data } = this.props;
    const { tableConfig } = this.state;
    const { default: defaultSort } = tableSort;
    const { currentSort, sortValue } = currentColumn;
    const nextSort = getNextSort(currentSort);

    Object.keys(tableConfig).forEach((key) => {
      tableConfig[key].currentSort = defaultSort;
    });
    currentColumn.currentSort = nextSort;

    if (nextSort !== defaultSort) {
      data = sort(sortValue, nextSort, data, 'CompareTable');
    }

    this.setState({ data, tableConfig });
  };

  render() {
    const {
      testName,
      frameworkName,
      user,
      hasSubtests,
      isBaseAggregate,
      onPermalinkClick,
      history,
      onModalOpen,
    } = this.props;

    const { data } = this.state;
    const { tableConfig } = this.state;
    const suite = testName.split(' ')[0];
    const url = getTalosDocsURL(suite);

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
              <span>
                {testName}{' '}
                {frameworkName === 'talos' && <a href={url}>(docs)</a>}
              </span>
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
              <SortButton
                column={tableConfig.TestName}
                onChangeSort={this.onChangeSort}
              />
            </th>
            <th className="table-width-lg">
              <SortButton
                column={tableConfig.Base}
                onChangeSort={this.onChangeSort}
              />
            </th>
            {/* empty for less than/greater than data */}
            <th className="table-width-sm" aria-label="Comparison" />
            <th className="table-width-lg">
              <SortButton
                column={tableConfig.New}
                onChangeSort={this.onChangeSort}
              />
            </th>
            <th className="table-width-lg">
              <SortButton
                column={tableConfig.Delta}
                onChangeSort={this.onChangeSort}
              />
            </th>
            <th className="table-width-lg">
              <SortButton
                column={tableConfig.Magnitude}
                onChangeSort={this.onChangeSort}
              />
            </th>
            <th className="table-width-lg">
              <SortButton
                column={tableConfig.Confidence}
                onChangeSort={this.onChangeSort}
              />
            </th>
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
