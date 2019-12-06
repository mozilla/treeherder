/* eslint-disable jsx-a11y/control-has-associated-label */

import React from 'react';
import { Button, Table } from 'reactstrap';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHashtag, faRedo } from '@fortawesome/free-solid-svg-icons';

import { getHashBasedId, retriggerJobs } from '../helpers';
import { compareTableText } from '../constants';
import { hashFunction } from '../../helpers/utils';
import JobModel from '../../models/job';

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
    } = this.props;

    return (
      <Table
        id={getHashBasedId(testName, hashFunction)}
        aria-label="Comparison table"
        sz="small"
        className="compare-table mb-0 px-0"
        key={testName}
        innerRef={el => {
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
                  title={`Permalink to this test table: ${testName}`}
                >
                  <FontAwesomeIcon icon={faHashtag} />
                </Button>
              )}
            </th>
            <th className="table-width-lg">Base</th>
            {/* empty for less than/greater than data */}
            <th className="table-width-sm" />
            <th className="table-width-lg">New</th>
            <th className="table-width-lg">Delta</th>
            {/* empty for progress bars (magnitude of difference) */}
            <th className="table-width-lg">Magnitude of Difference</th>
            <th className="table-width-lg">Confidence</th>
            <th className="text-right table-width-md">
              {hasSubtests &&
                data &&
                data.length &&
                (data[0].newRetriggerableJobId || !isBaseAggregate) &&
                user.isLoggedIn && (
                  <Button
                    className="retrigger-btn btn icon-green mr-1 py-0 px-1"
                    title={compareTableText.retriggerButtonTitle}
                    onClick={() => retriggerJobs(data[0], 5, this.props)}
                  >
                    <FontAwesomeIcon icon={faRedo} />
                  </Button>
                )}
              # Runs
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map(rowLevelResults => (
            <CompareTableRow
              key={rowLevelResults.name}
<<<<<<< 39891e0e01f1ef9eeed451d1efada0462f91150f
              rowLevelResults={rowLevelResults}
              hashFunction={hashFunction}
              {...this.props}
            />
=======
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
                            this.getHashBasedId(testName, rowLevelResults.name),
                          )
                        }
                        title={`Permalink to this test: ${rowLevelResults.name}`}
                      >
                        <FontAwesomeIcon icon={faHashtag} />
                      </Button>
                    </span>
                  )}
                  {rowLevelResults.links &&
                    rowLevelResults.links.map(link => (
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
                Math.abs(displayNumber(rowLevelResults.deltaPercentage)) !==
                  0 ? (
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
                            className={this.getColorClass(
                              rowLevelResults,
                              'text',
                            )}
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
                      <span>
                        {displayNumber(rowLevelResults.deltaPercentage)}%
                      </span>
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
                    <Button
                      className="retrigger-btn btn icon-green mr-1 py-0 px-1"
                      title={compareTableText.retriggerButtonTitle}
                      onClick={() => this.retriggerJobs(rowLevelResults, 5)}
                    >
                      <FontAwesomeIcon icon={faRedo} />
                    </Button>
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
>>>>>>> Bug 1600752 - Compare View Changes
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
  onPermalinkClick: PropTypes.func,
  getJob: PropTypes.func,
  retriggerJob: PropTypes.func,
};

CompareTable.defaultProps = {
  data: null,
  hashFunction,
  onPermalinkClick: undefined,
  getJob: JobModel.get,
  retriggerJob: JobModel.retrigger,
};
