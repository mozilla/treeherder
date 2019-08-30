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
      sortOrderAsc: false,
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

  compareBy = key => {
    const { sortOrderAsc } = this.state;
    return function(a, b) {
      if (a[key] <= b[key]) {
        if (sortOrderAsc) return -1;
        return 1;
      }
      if (a[key] >= b[key]) {
        if (sortOrderAsc) return 1;
        return -1;
      }
      return 0;
    };
  };

  sortBy = (key, data) => {
    const { sortOrderAsc } = this.state;
    // eslint-disable-next-line react/no-access-state-in-setstate
    data.sort(this.compareBy(key));
    this.setState({ sortOrderAsc: !sortOrderAsc });

    $(
      'table.compare-table:nth-child(2) > thead:nth-child(1) > tr > th',
    ).removeClass('subtest-header-visible');
    $(
      'table.compare-table:nth-child(2) > thead:nth-child(1) > tr > th',
    ).addClass('subtest-header-visible');
    key = key.toLowerCase();
    if (sortOrderAsc) {
      $(`#${key}`).removeClass('sort-symbol-desc-visible');
      $(`#${key}`).addClass('sort-symbol-asc-visible');
    } else {
      $(`#${key}`).removeClass('sort-symbol-asc-visible');
      $(`#${key}`).addClass('sort-symbol-desc-visible');
    }

    this.forceUpdate();
  };

  render() {
    const { data, testName } = this.props;
    // console.log(`data: ${JSON.stringify(data)}`);
    return (
      <Table sz="small" className="compare-table mb-0 px-0" key={testName}>
        <thead>
          <tr className="subtest-header bg-lightgray">
            <th id="name" className="text-left">
              <span onClick={() => this.sortBy('name', data)}>{testName}</span>
            </th>
            <th
              id="originalvalue"
              className="table-width-lg"
              onClick={() => this.sortBy('originalValue', data)}
            >
              Base
            </th>
            {/* empty for less than/greater than data */}
            <th className="table-width-sm" />
            <th
              id="newvalue"
              className="table-width-lg"
              onClick={() => this.sortBy('newValue', data)}
            >
              New
            </th>
            <th
              id="deltapercentage"
              className="table-width-lg"
              onClick={() => this.sortBy('deltaPercentage', data)}
            >
              Delta
            </th>
            {/* empty for progress bars (magnitude of difference) */}
            <th className="table-width-lg" />
            <th
              id="confidence"
              className="table-width-lg"
              onClick={() => this.sortBy('confidence', data)}
            >
              Confidence
            </th>
            <th
              id="originalruns"
              className="text-right table-width-md"
              onClick={() => this.sortBy('originalRuns', data)}
            >
              # Runs
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
                    tooltipText={`${results.originalRuns.length} base / ${results.newRuns.length} new`}
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
