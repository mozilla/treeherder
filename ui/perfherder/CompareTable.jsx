import React from 'react';
import { Table, Progress } from 'reactstrap';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faExclamationTriangle,
  faThumbsUp,
} from '@fortawesome/free-solid-svg-icons';

import SimpleTooltip from '../shared/SimpleTooltip';

import { displayNumber } from './helpers';
import TableAverage from './TableAverage';

export default class CompareTable extends React.Component {
  getColorClass = (data, type) => {
    const { className, isRegression, isImprovement } = data;
    if (type === 'bar' && !isRegression && !isImprovement) return 'secondary';
    if (type === 'background' && className === 'warning')
      return `bg-${className} ${
        className !== 'warning' ? 'text-white font-weight-bold' : null
      }`;
    if (type === 'text' && className) return `text-${className}`;
    return className;
  };

  deltaTooltipText = (delta, percentage, improvement) =>
    `Mean difference: ${displayNumber(delta)} (= ${Math.abs(
      displayNumber(percentage),
    )}% ${improvement ? 'better' : 'worse'})`;

  render() {
    const { data, testName, title } = this.props;
    return (
      <Table sz="small" className="compare-table mb-0" key={title || testName}>
        <thead>
          <tr
            style={{ backgroundColor: 'lightgrey' }}
            className="subtest-header"
          >
            <th className="text-left">
              <span>{testName}</span>
            </th>
            <th style={{ width: '200px' }}>Base</th>
            {/* empty for less than/greater than data */}
            <th style={{ width: '30px' }} />
            <th style={{ width: '140px' }}>New</th>
            <th style={{ width: '100px' }}>Delta</th>
            {/* empty for progress bars (magnitude of difference) */}
            <th style={{ width: '120px' }} />
            <th style={{ width: '100px' }}>Confidence</th>
            <th className="text-right" style={{ width: '80px' }}>
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
                  <SimpleTooltip
                    text={
                      <Progress multi>
                        {/* the % of the bars that are colored and transparent is based on the newIsBetter metric,
                        which determines whether the colored bar for magnitude is displayed on the left or right */}
                        <Progress
                          bar
                          value={
                            !results.newIsBetter
                              ? 100 - results.magnitude
                              : results.magnitude
                          }
                          color={
                            !results.newIsBetter
                              ? 'transparent'
                              : this.getColorClass(results, 'bar')
                          }
                        />
                        <Progress
                          bar
                          value={
                            !results.newIsBetter
                              ? results.magnitude
                              : 100 - results.magnitude
                          }
                          color={
                            !results.newIsBetter
                              ? this.getColorClass(results, 'bar')
                              : 'transparent'
                          }
                        />
                      </Progress>
                    }
                    tooltipText="Relative magnitude of change (scale from 0 - 20%+)"
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
                <SimpleTooltip
                  textClass="detail-hint"
                  text={`${results.originalRuns.length} / ${
                    results.newRuns.length
                  }`}
                  tooltipText={`${results.originalRuns.length} base / ${
                    results.newRuns.length
                  } new`}
                />
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
  title: PropTypes.shape({}),
};

CompareTable.defaultProps = {
  data: null,
  title: null,
};
