import React from 'react';
import { Button } from 'reactstrap';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faExclamationTriangle,
  faThumbsUp,
  faHashtag,
} from '@fortawesome/free-solid-svg-icons';

import SimpleTooltip from '../../shared/SimpleTooltip';
import { displayNumber, formatNumber, getHashBasedId } from '../helpers';
import ProgressBar from '../ProgressBar';
import { hashFunction } from '../../helpers/utils';

import TableAverage from './TableAverage';
import RetriggerButton from './RetriggerButton';

export default class CompareTableRow extends React.PureComponent {
  getColorClass = (data, type) => {
    const { className, isRegression, isImprovement } = data;
    if (type === 'bar' && !isRegression && !isImprovement) return 'secondary';
    if (type === 'background' && className === 'warning')
      return `bg-${className}`;
    if (type === 'text' && className) return `text-${className}`;
    return className;
  };

  deltaTooltipText = (delta, percentage, improvement) =>
    `Mean difference: ${formatNumber(displayNumber(delta))} (= ${Math.abs(
      displayNumber(percentage),
    )}% ${improvement ? 'better' : 'worse'})`;

  render() {
    const {
      testName,
      user,
      hasSubtests,
      isBaseAggregate,
      onPermalinkClick,
      history,
      rowLevelResults,
      hashFunction,
      onModalOpen,
    } = this.props;

    return (
      <tr
        id={getHashBasedId(testName, hashFunction, rowLevelResults.name)}
        aria-label="Comparison table row"
        ref={(el) => {
          this.rowTitle = el;
        }}
      >
        <th className="text-left font-weight-normal pl-1">
          {rowLevelResults.name}
          <span className="result-links">
            {onPermalinkClick && (
              <span>
                <Button
                  className="permalink p-0 ml-1"
                  color="link"
                  onClick={() =>
                    onPermalinkClick(
                      getHashBasedId(
                        testName,
                        hashFunction,
                        rowLevelResults.name,
                      ),
                      history,
                      this.rowTitle,
                    )
                  }
                  title="Permalink to this test"
                  aria-label={`Permalink to test ${rowLevelResults.name}`}
                >
                  <FontAwesomeIcon icon={faHashtag} />
                </Button>
              </span>
            )}
            {rowLevelResults.links &&
              rowLevelResults.links.map((link) => (
                <span key={link.title}>
                  <a href={link.href}>{` ${link.title}`}</a>
                </span>
              ))}
          </span>
        </th>
        <TableAverage
          value={rowLevelResults.originalValue}
          stddev={rowLevelResults.originalStddev}
          stddevpct={rowLevelResults.originalStddevPct}
          replicates={rowLevelResults.originalRuns}
        />
        <td>
          {rowLevelResults.originalValue < rowLevelResults.newValue && (
            <span>&lt;</span>
          )}
          {rowLevelResults.originalValue > rowLevelResults.newValue && (
            <span>&gt;</span>
          )}
        </td>
        <TableAverage
          value={rowLevelResults.newValue}
          stddev={rowLevelResults.newStddev}
          stddevpct={rowLevelResults.newStddevPct}
          replicates={rowLevelResults.newRuns}
        />
        <td className={this.getColorClass(rowLevelResults, 'background')}>
          {rowLevelResults.delta &&
          Math.abs(displayNumber(rowLevelResults.deltaPercentage)) !== 0 ? (
            <SimpleTooltip
              textClass="detail-hint"
              text={
                <React.Fragment>
                  {(rowLevelResults.isRegression ||
                    rowLevelResults.isImprovement) && (
                    <FontAwesomeIcon
                      icon={
                        rowLevelResults.isRegression
                          ? faExclamationTriangle
                          : faThumbsUp
                      }
                      title={
                        rowLevelResults.isRegression
                          ? 'regression'
                          : 'improvement'
                      }
                      className={this.getColorClass(rowLevelResults, 'text')}
                      size="lg"
                    />
                  )}
                  {`  ${displayNumber(rowLevelResults.deltaPercentage)}%`}
                </React.Fragment>
              }
              tooltipText={this.deltaTooltipText(
                rowLevelResults.delta,
                rowLevelResults.deltaPercentage,
                rowLevelResults.newIsBetter,
              )}
            />
          ) : null}
          {rowLevelResults.delta
            ? Math.abs(displayNumber(rowLevelResults.deltaPercentage)) ===
                0 && (
                <span>{displayNumber(rowLevelResults.deltaPercentage)}%</span>
              )
            : null}
        </td>
        <td>
          {rowLevelResults.delta ? (
            <ProgressBar
              magnitude={rowLevelResults.magnitude}
              regression={!rowLevelResults.newIsBetter}
              color={this.getColorClass(rowLevelResults, 'bar')}
            />
          ) : null}
        </td>
        <td>
          {rowLevelResults.delta &&
          rowLevelResults.confidence &&
          rowLevelResults.confidenceText ? (
            <SimpleTooltip
              textClass="detail-hint"
              text={`${displayNumber(rowLevelResults.confidence)} (${
                rowLevelResults.confidenceText
              })`}
              tooltipText={rowLevelResults.confidenceTextLong}
            />
          ) : null}
        </td>
        <td className="text-right">
          {!hasSubtests &&
            !rowLevelResults.isNoiseMetric &&
            (rowLevelResults.newRetriggerableJobId || !isBaseAggregate) &&
            user.isLoggedIn && (
              <RetriggerButton
                onClick={() => {
                  onModalOpen(rowLevelResults);
                }}
              />
            )}
          {rowLevelResults.originalRuns && (
            <SimpleTooltip
              textClass="detail-hint"
              text={`${rowLevelResults.originalRuns.length} / ${rowLevelResults.newRuns.length}`}
              tooltipText={`${rowLevelResults.originalRuns.length} base / ${rowLevelResults.newRuns.length} new`}
            />
          )}
        </td>
      </tr>
    );
  }
}

CompareTableRow.propTypes = {
  testName: PropTypes.string.isRequired,
  onModalOpen: PropTypes.func.isRequired,
  hashFunction: PropTypes.func,
  onPermalinkClick: PropTypes.func,
};

CompareTableRow.defaultProps = {
  hashFunction,
  onPermalinkClick: undefined,
};
