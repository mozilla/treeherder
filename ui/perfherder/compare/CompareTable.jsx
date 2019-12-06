/* eslint-disable jsx-a11y/control-has-associated-label */

import React from 'react';
import { Button, Table } from 'reactstrap';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHashtag, faRedo } from '@fortawesome/free-solid-svg-icons';

import { getHashBasedId } from '../helpers';
import { compareTableText } from '../constants';
import { hashFunction } from '../../helpers/utils';
import JobModel from '../../models/job';
import RepositoryModel from '../../models/repository';

import CompareTableRow from './CompareTableRow';

export default class CompareTable extends React.PureComponent {
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
      history,
    } = this.props;

    return (
      <Table
        id={getHashBasedId(testName)}
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
                      getHashBasedId(testName),
                      history,
                      this.header,
                    )
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
            <CompareTableRow
              rowLevelResults={rowLevelResults}
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
