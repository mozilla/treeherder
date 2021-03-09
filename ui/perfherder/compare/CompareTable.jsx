import React from 'react';
import { Button, Table } from 'reactstrap';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHashtag } from '@fortawesome/free-solid-svg-icons';

import { getHashBasedId } from '../helpers';
import { hashFunction } from '../../helpers/utils';
import { compareTableSort } from '../constants';

import RetriggerButton from './RetriggerButton';
import CompareTableRow from './CompareTableRow';
import CompareSortButton from './CompareSortButton';

export default class CompareTable extends React.Component {
  sortTypes = {
    [compareTableSort.ascending]: {
      sortByString: (value) => (a, b) => a[value].localeCompare(b[value]),
      sortByValue: (value) => (a, b) => a[value] - b[value],
    },
    [compareTableSort.descending]: {
      sortByString: (value) => (a, b) => b[value].localeCompare(a[value]),
      sortByValue: (value) => (a, b) => b[value] - a[value],
    },
  };

  constructor(props) {
    super(props);
    const { data } = this.props;

    this.state = {
      data,
      tableConfig: {
        TestName: {
          name: 'Test name',
          sortValue: 'name',
          currentSort: compareTableSort.default,
        },
        Base: {
          name: 'Base',
          sortValue: 'originalValue',
          currentSort: compareTableSort.default,
        },
        Comparison: { name: 'Comparison' },
        New: {
          name: 'New',
          sortValue: 'newValue',
          currentSort: compareTableSort.default,
        },
        Delta: {
          name: 'Delta',
          sortValue: 'deltaPercentage',
          currentSort: compareTableSort.default,
        },
        Magnitude: {
          name: 'Magnitude of Difference',
          sortValue: 'magnitude',
          currentSort: compareTableSort.default,
        },
        Confidence: {
          name: 'Confidence',
          sortValue: 'confidence',
          currentSort: compareTableSort.default,
        },
      },
    };
  }

  componentDidUpdate = (prevProps) => {
    const { data } = this.props;
    const { tableConfig } = this.state;

    if (data !== prevProps.data) {
      Object.keys(tableConfig).forEach((key) => {
        tableConfig[key].currentSort = compareTableSort.default;
      });
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({ data, tableConfig });
    }
  };

  getNextSort = (currentSort) => {
    const { ascending, descending, default: defaultSort } = compareTableSort;
    const nextSort = {
      ascending: descending,
      descending: defaultSort,
      default: ascending,
    };

    return nextSort[currentSort];
  };

  sort = (sortValue, sortType, data) => {
    const validData = [];
    const nullData = [];
    data.forEach((item) => {
      if (item[sortValue] || item[sortValue] === 0) {
        validData.push(item);
      } else {
        nullData.push(item);
      }
    });
    const { sortByString, sortByValue } = this.sortTypes[sortType];
    const doSort = sortValue === 'name' ? sortByString : sortByValue;

    if (validData.length) {
      data = validData.sort(doSort(sortValue));
      data = data.concat(nullData);
    }

    return data;
  };

  onChangeSort = (currentColumn) => {
    let { data } = this.props;
    const { tableConfig } = this.state;
    const { default: defaultSort } = compareTableSort;
    const { currentSort, sortValue } = currentColumn;
    const nextSort = this.getNextSort(currentSort);

    Object.keys(tableConfig).forEach((key) => {
      tableConfig[key].currentSort = defaultSort;
    });
    currentColumn.currentSort = nextSort;

    if (nextSort !== defaultSort) {
      data = this.sort(sortValue, nextSort, data);
    }

    this.setState({ data, tableConfig });
  };

  render() {
    const {
      testName,
      user,
      hasSubtests,
      isBaseAggregate,
      onPermalinkClick,
      history,
      onModalOpen,
    } = this.props;

    const { data, tableConfig } = this.state;

    const [firstElementOfData] = data;
    const {
      baseColumnMeasurementUnit,
      newColumnMeasurementUnit,
    } = firstElementOfData;
    if (baseColumnMeasurementUnit && newColumnMeasurementUnit) {
      tableConfig.Base.name = `${tableConfig.Base.name} (${baseColumnMeasurementUnit})`;
      tableConfig.New.name = `${tableConfig.New.name} (${newColumnMeasurementUnit})`;
    }

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
              <CompareSortButton
                column={tableConfig.TestName}
                onChangeSort={this.onChangeSort}
              />
            </th>
            <th className="table-width-lg">
              <CompareSortButton
                column={tableConfig.Base}
                onChangeSort={this.onChangeSort}
              />
            </th>
            {/* empty for less than/greater than data */}
            <th className="table-width-sm" aria-label="Comparison" />
            <th className="table-width-lg">
              <CompareSortButton
                column={tableConfig.New}
                onChangeSort={this.onChangeSort}
              />
            </th>
            <th className="table-width-lg">
              <CompareSortButton
                column={tableConfig.Delta}
                onChangeSort={this.onChangeSort}
              />
            </th>
            <th className="table-width-lg">
              <CompareSortButton
                column={tableConfig.Magnitude}
                onChangeSort={this.onChangeSort}
              />
            </th>
            <th className="table-width-lg">
              <CompareSortButton
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
