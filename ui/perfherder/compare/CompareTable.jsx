import React from 'react';
import { Table } from 'reactstrap';
import $ from 'jquery';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faExclamationTriangle,
  faThumbsUp,
} from '@fortawesome/free-solid-svg-icons';

import SimpleTooltip from '../../shared/SimpleTooltip';
import { displayNumber } from '../helpers';
import ProgressBar from '../ProgressBar';

import TableAverage from './TableAverage';

export default class CompareTable extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      columnName: '',
      sortOrderAsc: false,
      sorted: false,
      borderTopColor: '',
      borderTopWidth: '',
      borderBottomColor: '',
      borderBottomWidth: '',
    };

    this.compareBy.bind(this);
    this.sortBy.bind(this);
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

  compareBy = (key, shouldBeNumber) => {
    const { sortOrderAsc } = this.state;
    return (a, b) => {
      // If a[key] or b[key] doesn't exist, they are skipped by the sorting
      // so they need to be initialized with a default value
      if (shouldBeNumber) {
        // eslint-disable-next-line no-restricted-globals
        if (isNaN(a[key]) && !Array.isArray(a[key])) a[key] = 0;
        // eslint-disable-next-line no-restricted-globals
        if (isNaN(b[key]) && !Array.isArray(b[key])) b[key] = 0;
      } else {
        a[key] = typeof a[key] === 'undefined' ? '' : a[key];
        b[key] = typeof b[key] === 'undefined' ? '' : b[key];
      }
      const ak = Array.isArray(a[key]) ? a[key].length : a[key];
      const bk = Array.isArray(b[key]) ? b[key].length : b[key];
      if (ak < bk) {
        if (sortOrderAsc) return -1;
        return 1;
      }
      if (ak > bk) {
        if (sortOrderAsc) return 1;
        return -1;
      }
      return 0;
    };
  };

  sortBy = (key, data) => {
    const { sortOrderAsc } = this.state
    let {
      borderTopColor,
      borderTopWidth,
      borderBottomColor,
      borderBottomWidth,
    } = this.state;
    const columnName = key;
    // every other columns except "name" are numbers
    const shouldBeNumber = key !== 'name';
    data.sort(this.compareBy(key, shouldBeNumber));
    const sorted = true;
    if (sorted) {
      if (sortOrderAsc) {
        borderTopColor = '#333';
        borderTopWidth = '1px';
        borderBottomColor = '';
        borderBottomWidth = '';
        this.setState({
          columnName,
          sortOrderAsc: !sortOrderAsc,
          sorted,
          borderTopColor,
          borderTopWidth,
          borderBottomColor,
          borderBottomWidth,
        });
      } else {
        borderBottomColor = '#333';
        borderBottomWidth = '1px';
        borderTopColor = '';
        borderTopWidth = '';
        this.setState({
          columnName,
          sortOrderAsc: !sortOrderAsc,
          sorted,
          borderTopColor,
          borderTopWidth,
          borderBottomColor,
          borderBottomWidth,
        });
      }
    };
    // console.log(`sortOrderAsc: ${sortOrderAsc}`);
    // console.log(`sortBy sorted: ${sorted}`);

    this.forceUpdate();
  };

  render() {
    // eslint-disable-next-line react/prop-types
    const { data, testName } = this.props;
    const {
      columnName,
      sorted,
      borderTopColor,
      borderTopWidth,
      borderBottomColor,
      borderBottomWidth,
    } = this.state;
    console.log(`data: ${JSON.stringify(data)}`);
    console.log(`render sorted: ${JSON.stringify(sorted)}`);
    return (
      <Table sz="small" className="compare-table mb-0 px-0" key={testName}>
        <thead>
          <tr className={`${sorted ? 'subtest-header-visible ' : 'subtest-header '}bg-lightgray`}>
            <th
              style={{
                borderTopColor: columnName === 'name' ? borderTopColor : '',
                borderTopWidth: columnName === 'name' ? borderTopWidth : '',
                borderBottomColor: columnName === 'name' ? borderBottomColor : '',
                borderBottomWidth: columnName === 'name' ? borderBottomWidth : '',
              }}
              className="text-left"
            >
              <span onClick={() => this.sortBy('name', data)}>{testName}</span>
            </th>
            <th
              style={{
                borderTopColor: columnName === 'originalValue' ? borderTopColor : '',
                borderTopWidth: columnName === 'originalValue' ? borderTopWidth : '',
                borderBottomColor: columnName === 'originalValue' ? borderBottomColor : '',
                borderBottomWidth: columnName === 'originalValue' ? borderBottomWidth : '',
              }}
              className="table-width-lg"
            >
              <span onClick={() => this.sortBy('originalValue', data)}>Base</span>
            </th>
            {/* empty for less than/greater than data */}
            <th className="table-width-sm" />
            <th
              style={{
                borderTopColor: columnName === 'newValue' ? borderTopColor : '',
                borderTopWidth: columnName === 'newValue' ? borderTopWidth : '',
                borderBottomColor: columnName === 'newValue' ? borderBottomColor : '',
                borderBottomWidth: columnName === 'newValue' ? borderBottomWidth : '',
              }}
              className="table-width-lg"
            >
              <span onClick={() => this.sortBy('newValue', data)}>New</span>
            </th>
            <th
              style={{
                borderTopColor: columnName === 'deltaPercentage' ? borderTopColor : '',
                borderTopWidth: columnName === 'deltaPercentage' ? borderTopWidth : '',
                borderBottomColor: columnName === 'deltaPercentage' ? borderBottomColor : '',
                borderBottomWidth: columnName === 'deltaPercentage' ? borderBottomWidth : '',
              }}
              className="table-width-lg"
              onClick={() => this.sortBy('deltaPercentage', data)}
            >
              <span onClick={() => this.sortBy('deltaPercentage', data)}>Delta</span>
            </th>
            {/* empty for progress bars (magnitude of difference) */}
            <th className="table-width-lg" />
            <th
              style={{
                borderTopColor: columnName === 'confidence' ? borderTopColor : '',
                borderTopWidth: columnName === 'confidence' ? borderTopWidth : '',
                borderBottomColor: columnName === 'confidence' ? borderBottomColor : '',
                borderBottomWidth: columnName === 'confidence' ? borderBottomWidth : '',
              }}
              className="table-width-lg"
            >
              <span onClick={() => this.sortBy('confidence', data)}>Confidence</span>
            </th>
            <th
              style={{
                borderTopColor: columnName === ('originalRuns' || 'newRuns') ? borderTopColor : '',
                borderTopWidth: columnName === ('originalRuns' || 'newRuns') ? borderTopWidth : '',
                borderBottomColor: columnName === ('originalRuns' || 'newRuns') ? borderBottomColor : '',
                borderBottomWidth: columnName === ('originalRuns' || 'newRuns') ? borderBottomWidth : '',
              }}
              className="text-right table-width-md"
            >
              <span onClick={() => this.sortBy('originalRuns', data)}># Runs base </span>
              /<span onClick={() => this.sortBy('newRuns', data)}> new</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map(results => (
            <tr key={results.name}>
              <th className="text-left font-weight-normal pl-1">
                {results.name}
                {results.links && (
                  <span className="result-links">
                    {results.links.map(link => (
                      <span key={link.title}>
                        <a href={link.href}>{` ${link.title}`}</a>
                      </span>
                    ))}
                  </span>
                )}
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
};

CompareTable.defaultProps = {
  data: null,
};
