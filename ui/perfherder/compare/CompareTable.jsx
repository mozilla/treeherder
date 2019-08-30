import React from 'react';
import { Button, Table } from 'reactstrap';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faExclamationTriangle,
  faThumbsUp,
  faHashtag,
} from '@fortawesome/free-solid-svg-icons';

import SimpleTooltip from '../../shared/SimpleTooltip';
import { displayNumber } from '../helpers';
import { sortHashes } from '../../helpers/sort';
import ProgressBar from '../ProgressBar';
import { hashFunction } from '../../helpers/utils';

import TableAverage from './TableAverage';

export default class CompareTable extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      sorted: false,
      sortedTestName: '',
      sortedColumnName: '',
      sortOrder: false,
      sortClass: '',
    };
  }

  getColorClass = (data, type) => {
    const { className, isRegression, isImprovement } = data;
    if (type === 'bar' && !isRegression && !isImprovement) return 'secondary';
    if (type === 'background' && className === 'warning')
      return `bg-${className}`;
    if (type === 'text' && className) return `text-${className}`;
    return className;
  };

  deltaTooltipText = (delta, percentage, improvement) =>
    `Mean difference: ${displayNumber(delta)} (= ${Math.abs(
      displayNumber(percentage),
    )}% ${improvement ? 'better' : 'worse'})`;

  // humane readable signature name
  getSignatureName = (testName, platformName) =>
    [testName, platformName].filter(item => item !== null).join(' ');

  getHashBasedId = (testName, platformName = null) => {
    const { hashFunction } = this.props;

    const tableSection = platformName === null ? 'header' : 'row';
    const hashValue = hashFunction(
      this.getSignatureName(testName, platformName),
    );

    return `table-${tableSection}-${hashValue}`;
  };

  // Sorts the specified key of the array data depending on the typeof key
  // If something changes in columns, you just need to update sortableKeys
  // with the corresponding type
  // The data model of the sortable keys is:
  // name: string
  // originalValue: number
  // newValue: number
  // deltaPercentage: number
  // confidence: number
  // originalRuns: array
  // newRuns: array
  // default: string
  sortBy = (columnName, data) => {
    let { sortOrder, sortClass } = this.state;
    const { sortedTestName, sortedColumnName } = this.state;
    const { testName } = this.props;
    const sortableKeys = {
      name: 'string',
      originalValue: 'number',
      newValue: 'number',
      deltaPercentage: 'number',
      confidence: 'number',
      originalRuns: 'array',
      newRuns: 'array',
    };
    const sorted = true;
    if (sorted) {
      // ^ sorted flag becomes true after clicking for the first time any column
      // Toggle sort order if clicked a column header several consecutive times
      if (sortedTestName === testName && sortedColumnName === columnName) {
        data.sort(
          sortHashes(columnName, sortableKeys[columnName], !sortOrder),
        );
      } else {
        // sort ascending if any column was clicked for the first time
        sortOrder = true;
        data.sort(
          sortHashes(columnName, sortableKeys[columnName], !sortOrder),
        );
      }
      if (sortOrder) sortClass = 'sorted-asc ';
      else sortClass = 'sorted-desc ';
    } else sortClass = '';
    this.setState({
      sorted,
      sortOrder: !sortOrder,
      sortedTestName: testName,
      sortedColumnName: columnName,
      sortClass,
    });

    this.forceUpdate();
  };

  render() {
    const { data, onPermalinkClick, testName } = this.props;
    const { sorted, sortedColumnName, sortClass } = this.state;
    return (
      <Table
        id={this.getHashBasedId(testName)}
        aria-label="Comparison table"
        sz="small"
        className="compare-table mb-0 px-0"
        key={testName}
      >
        <thead>
          <tr
            className={`${
              sorted
                ? 'subtest-header subtest-header-visible '
                : 'subtest-header '
            }bg-lightgray`}
          >
            <th
              className={`${
                sortedColumnName === 'name' ? sortClass : ''
              }text-left`}
            >
              <span onClick={() => this.sortBy('name', data)}>{testName}</span>
              <Button
                className="permalink p-0 ml-1"
                color="link"
                onClick={() => onPermalinkClick(this.getHashBasedId(testName))}
                title="Permalink to this test table"
              >
                <FontAwesomeIcon icon={faHashtag} />
              </Button>
            </th>
            <th
              className={`${
                sortedColumnName === 'originalValue' ? sortClass : ''
              }table-width-lg`}
            >
              <span onClick={() => this.sortBy('originalValue', data)}>
                Base
              </span>
            </th>
            {/* empty for less than/greater than data */}
            <th className="table-width-sm" />
            <th
              className={`${
                sortedColumnName === 'newValue' ? sortClass : ''
              }table-width-lg`}
            >
              <span onClick={() => this.sortBy('newValue', data)}>New</span>
            </th>
            <th
              className={`${
                sortedColumnName === 'deltaPercentage' ? sortClass : ''
              }table-width-lg`}
              onClick={() => this.sortBy('deltaPercentage', data)}
            >
              <span onClick={() => this.sortBy('deltaPercentage', data)}>
                Delta
              </span>
            </th>
            {/* empty for progress bars (magnitude of difference) */}
            <th className="table-width-lg" />
            <th
              className={`${
                sortedColumnName === 'confidence' ? sortClass : ''
              }table-width-lg`}
            >
              <span onClick={() => this.sortBy('confidence', data)}>
                Confidence
              </span>
            </th>
            <th
              className={`${
                sortedColumnName in ['originalRuns', 'newRuns'] ? sortClass : ''
              }text-right table-width-md`}
            >
              <span onClick={() => this.sortBy('originalRuns', data)}>
                # Runs base{' '}
              </span>
              /<span onClick={() => this.sortBy('newRuns', data)}> new</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map(results => (
            <tr
              id={this.getHashBasedId(testName, results.name)}
              aria-label="Comparison table row"
              key={results.name}
            >
              <th className="text-left font-weight-normal pl-1">
                {results.name}
                <span className="result-links">
                  <span>
                    <Button
                      className="permalink p-0 ml-1"
                      color="link"
                      onClick={() =>
                        onPermalinkClick(
                          this.getHashBasedId(testName, results.name),
                        )
                      }
                      title="Permalink to this test"
                    >
                      <FontAwesomeIcon icon={faHashtag} />
                    </Button>
                  </span>
                  {results.links &&
                    results.links.map(link => (
                      <span key={link.title}>
                        <a href={link.href}>{` ${link.title}`}</a>
                      </span>
                    ))}
                </span>
              </th>
              <TableAverage
                value={results.originalValue}
                stddev={results.originalStddev}
                stddevpct={results.originalStddevPct}
                replicates={results.originalRuns}
              />
              <td>
                {results.originalValue < results.newValue && <span>&lt;</span>}
                {results.originalValue > results.newValue && <span>&gt;</span>}
              </td>
              <TableAverage
                value={results.newValue}
                stddev={results.newStddev}
                stddevpct={results.newStddevPct}
                replicates={results.newRuns}
              />
              <td className={this.getColorClass(results, 'background')}>
                {results.delta &&
                Math.abs(displayNumber(results.deltaPercentage)) !== 0 ? (
                  <SimpleTooltip
                    textClass="detail-hint"
                    text={
                      <React.Fragment>
                        {(results.isRegression || results.isImprovement) && (
                          <FontAwesomeIcon
                            icon={
                              results.isRegression
                                ? faExclamationTriangle
                                : faThumbsUp
                            }
                            title={
                              results.isRegression
                                ? 'regression'
                                : 'improvement'
                            }
                            className={this.getColorClass(results, 'text')}
                            size="lg"
                          />
                        )}
                        {`  ${displayNumber(results.deltaPercentage)}%`}
                      </React.Fragment>
                    }
                    tooltipText={this.deltaTooltipText(
                      results.delta,
                      results.deltaPercentage,
                      results.newIsBetter,
                    )}
                  />
                ) : null}
                {results.delta
                  ? Math.abs(displayNumber(results.deltaPercentage)) === 0 && (
                      <span>{displayNumber(results.deltaPercentage)}%</span>
                    )
                  : null}
              </td>
              <td>
                {results.delta ? (
                  <ProgressBar
                    magnitude={results.magnitude}
                    regression={!results.newIsBetter}
                    color={this.getColorClass(results, 'bar')}
                  />
                ) : null}
              </td>
              <td>
                {results.delta &&
                results.confidence &&
                results.confidenceText ? (
                  <SimpleTooltip
                    textClass="detail-hint"
                    text={`${displayNumber(results.confidence)} (${
                      results.confidenceText
                    })`}
                    tooltipText={results.confidenceTextLong}
                  />
                ) : null}
              </td>
              <td className="text-right">
                {results.originalRuns && (
                  <SimpleTooltip
                    textClass="detail-hint"
                    text={`${results.originalRuns.length} / ${results.newRuns.length}`}
                    tooltipText={`
              ${results.originalRuns.length} base / ${results.newRuns.length} new`}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    );
  }
}

CompareTable.propTypes = {
  data: PropTypes.arrayOf(PropTypes.shape({})),
  testName: PropTypes.string.isRequired,
  hashFunction: PropTypes.func,
  onPermalinkClick: PropTypes.func.isRequired,
};

CompareTable.defaultProps = {
  data: null,
  hashFunction,
};
