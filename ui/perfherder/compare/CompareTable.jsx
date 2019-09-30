import React from 'react';
import { Button, Table } from 'reactstrap';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faExclamationTriangle,
  faRedo,
  faThumbsUp,
  faHashtag,
} from '@fortawesome/free-solid-svg-icons';

import SimpleTooltip from '../../shared/SimpleTooltip';
import { displayNumber } from '../helpers';
import { compareTableText } from '../constants';
import ProgressBar from '../ProgressBar';
import { hashFunction } from '../../helpers/utils';
import JobModel from '../../models/job';
import RepositoryModel from '../../models/repository';

import TableAverage from './TableAverage';

export default class CompareTable extends React.PureComponent {
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

  // human readable signature name
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

  retriggerJobs = async (results, times) => {
    // retrigger base revision jobs
    const { projects } = this.props;

    this.retriggerByRevision(
      results.originalRetriggerableJobId,
      RepositoryModel.getRepo(results.originalRepoName, projects),
      true,
      times,
    );
    // retrigger new revision jobs
    this.retriggerByRevision(
      results.newRetriggerableJobId,
      RepositoryModel.getRepo(results.newRepoName, projects),
      false,
      times,
    );
  };

  retriggerByRevision = async (jobId, currentRepo, isBaseline, times) => {
    const { isBaseAggregate, notify, retriggerJob, getJob } = this.props;

    // do not retrigger if the base is aggregate (there is a selected time range)
    if (isBaseline && isBaseAggregate) {
      return;
    }

    if (jobId) {
      const job = await getJob(currentRepo.name, jobId);
      retriggerJob([job], currentRepo, notify, times);
    }
  };

  render() {
    const {
      data,
      testName,
      user,
      hasSubtests,
      isBaseAggregate,
      onPermalinkClick,
    } = this.props;
    return (
      <Table
        id={this.getHashBasedId(testName)}
        aria-label="Comparison table"
        sz="small"
        className="compare-table mb-0 px-0"
        key={testName}
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
                    onPermalinkClick(this.getHashBasedId(testName))
                  }
                  title="Permalink to this test table"
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
            <th className="table-width-lg" />
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
                    onClick={() => this.retriggerJobs(data[0], 5)}
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
            <tr
              id={this.getHashBasedId(testName, rowLevelResults.name)}
              aria-label="Comparison table row"
              key={rowLevelResults.name}
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
                        title="Permalink to this test"
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
