import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import { Button } from 'reactstrap';

import { thMaxPushFetchSize } from '../../../helpers/constants';
import { toDateStr, toShortDateStr } from '../../../helpers/display';
import { addAggregateFields, getBtnClass } from '../../../helpers/job';
import { getJobsUrl } from '../../../helpers/url';
import JobModel from '../../../models/job';
import PushModel from '../../../models/push';
import TextLogStepModel from '../../../models/textLogStep';
import { notify } from '../../redux/stores/notifications';

class SimilarJobsTab extends React.Component {
  constructor(props) {
    super(props);

    this.pageSize = 20;

    this.state = {
      similarJobs: [],
      filterBuildPlatformId: true,
      filterOptionCollectionHash: true,
      page: 1,
      selectedSimilarJob: null,
      hasNextPage: false,
      isLoading: true,
    };

    // map between state fields and job fields
    this.filterMap = {
      filterBuildPlatformId: 'build_platform_id',
      filterOptionCollectionHash: 'option_collection_hash',
    };
  }

  componentDidMount() {
    this.getSimilarJobs();
  }

  getSimilarJobs = async () => {
    const { page, similarJobs, selectedSimilarJob } = this.state;
    const { repoName, selectedJobFull, notify } = this.props;
    const options = {
      // get one extra to detect if there are more jobs that can be loaded (hasNextPage)
      count: this.pageSize + 1,
      offset: (page - 1) * this.pageSize,
    };

    ['filterBuildPlatformId', 'filterOptionCollectionHash'].forEach(key => {
      if (this.state[key]) {
        const field = this.filterMap[key];
        options[field] = selectedJobFull[field];
      }
    });

    const {
      data: newSimilarJobs,
      failureStatus,
    } = await JobModel.getSimilarJobs(selectedJobFull.id, options);

    if (!failureStatus) {
      this.setState({ hasNextPage: newSimilarJobs.length > this.pageSize });
      newSimilarJobs.pop();
      // create an array of unique push ids
      const pushIds = [...new Set(newSimilarJobs.map(job => job.push_id))];
      // get pushes and revisions for the given ids
      let pushList = { results: [] };
      const { data, failureStatus } = await PushModel.getList({
        id__in: pushIds.join(','),
        count: thMaxPushFetchSize,
      });

      if (!failureStatus) {
        pushList = data;
        // decorate the list of jobs with their result sets
        const pushes = pushList.results.reduce(
          (acc, push) => ({ ...acc, [push.id]: push }),
          {},
        );
        newSimilarJobs.forEach(simJob => {
          simJob.result_set = pushes[simJob.push_id];
          simJob.revisionResultsetFilterUrl = getJobsUrl({
            repo: repoName,
            revision: simJob.result_set.revisions[0].revision,
          });
          simJob.authorResultsetFilterUrl = getJobsUrl({
            repo: repoName,
            author: simJob.result_set.author,
          });
        });
        this.setState({ similarJobs: [...similarJobs, ...newSimilarJobs] });
        // on the first page show the first element info by default
        if (!selectedSimilarJob && newSimilarJobs.length > 0) {
          this.showJobInfo(newSimilarJobs[0]);
        }
      } else {
        notify(`Error fetching similar jobs push data: ${data}`, 'danger', {
          sticky: true,
        });
      }
    } else {
      notify(`Error fetching similar jobs: ${failureStatus}`, 'danger', {
        sticky: true,
      });
    }
    this.setState({ isLoading: false });
  };

  // this is triggered by the show previous jobs button
  showNext = () => {
    const { page } = this.state;
    this.setState({ page: page + 1, isLoading: true }, this.getSimilarJobs);
  };

  showJobInfo = job => {
    const { repoName, classificationMap } = this.props;

    JobModel.get(repoName, job.id).then(nextJob => {
      addAggregateFields(nextJob);
      nextJob.failure_classification =
        classificationMap[nextJob.failure_classification_id];

      // retrieve the list of error lines
      TextLogStepModel.get(nextJob.id).then(textLogSteps => {
        nextJob.error_lines = textLogSteps.reduce(
          (acc, step) => [...acc, ...step.errors],
          [],
        );
        this.setState({ selectedSimilarJob: nextJob });
      });
    });
  };

  toggleFilter = filterField => {
    this.setState(
      prevState => ({
        [filterField]: !prevState[filterField],
        similarJobs: [],
        isLoading: true,
      }),
      this.getSimilarJobs,
    );
  };

  render() {
    const {
      similarJobs,
      selectedSimilarJob,
      hasNextPage,
      filterOptionCollectionHash,
      filterBuildPlatformId,
      isLoading,
    } = this.state;
    const selectedSimilarJobId = selectedSimilarJob
      ? selectedSimilarJob.id
      : null;

    return (
      <div
        className="similar-jobs w-100"
        role="region"
        aria-label="Similar Jobs"
      >
        <div className="similar-job-list">
          <table className="table table-super-condensed table-hover">
            <thead>
              <tr>
                <th>Job</th>
                <th>Pushed</th>
                <th>Author</th>
                <th>Duration</th>
                <th>Revision</th>
              </tr>
            </thead>
            <tbody>
              {similarJobs.map(similarJob => (
                <tr
                  key={similarJob.id}
                  onClick={() => this.showJobInfo(similarJob)}
                  className={
                    selectedSimilarJobId === similarJob.id ? 'table-active' : ''
                  }
                >
                  <td>
                    <button
                      className={`btn btn-similar-jobs btn-xs ${getBtnClass(
                        similarJob.resultStatus,
                        similarJob.failure_classification_id,
                      )}`}
                      type="button"
                    >
                      {similarJob.job_type_symbol}
                      {similarJob.failure_classification_id > 1 && (
                        <span>*</span>
                      )}
                    </button>
                  </td>
                  <td title={toDateStr(similarJob.result_set.push_timestamp)}>
                    {toShortDateStr(similarJob.result_set.push_timestamp)}
                  </td>
                  <td>
                    <a href={similarJob.authorResultsetFilterUrl}>
                      {similarJob.result_set.author}
                    </a>
                  </td>
                  <td>{similarJob.duration} min</td>
                  <td>
                    <a href={similarJob.revisionResultsetFilterUrl}>
                      {similarJob.result_set.revisions[0].revision}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {hasNextPage && (
            <Button
              outline
              className="bg-light"
              type="button"
              onClick={this.showNext}
            >
              Show previous jobs
            </Button>
          )}
        </div>
        <div className="similar-job-detail-panel">
          <form className="form form-inline">
            <div className="checkbox">
              <input
                onChange={() => this.toggleFilter('filterBuildPlatformId')}
                type="checkbox"
                checked={filterBuildPlatformId}
              />
              <small>Same platform</small>
            </div>
            <div className="checkbox">
              <input
                onChange={() => this.toggleFilter('filterOptionCollectionHash')}
                type="checkbox"
                checked={filterOptionCollectionHash}
              />
              <small>Same options</small>
            </div>
          </form>
          <div className="similar_job_detail">
            {selectedSimilarJob && (
              <table className="table table-super-condensed">
                <tbody>
                  <tr>
                    <th>Result</th>
                    <td>{selectedSimilarJob.resultStatus}</td>
                  </tr>
                  <tr>
                    <th>Build</th>
                    <td>
                      {selectedSimilarJob.build_architecture}{' '}
                      {selectedSimilarJob.build_platform}{' '}
                      {selectedSimilarJob.build_os}
                    </td>
                  </tr>
                  <tr>
                    <th>Build option</th>
                    <td>{selectedSimilarJob.platform_option}</td>
                  </tr>
                  <tr>
                    <th>Job name</th>
                    <td>{selectedSimilarJob.job_type_name}</td>
                  </tr>
                  <tr>
                    <th>Started</th>
                    <td>{toDateStr(selectedSimilarJob.start_timestamp)}</td>
                  </tr>
                  <tr>
                    <th>Duration</th>
                    <td>
                      {selectedSimilarJob.duration >= 0
                        ? `${selectedSimilarJob.duration.toFixed(0)} minute(s)`
                        : 'unknown'}
                    </td>
                  </tr>
                  <tr>
                    <th>Classification</th>
                    <td>
                      <strong
                        className={`badge ${selectedSimilarJob.failure_classification.star}`}
                      >
                        {selectedSimilarJob.failure_classification.name}
                      </strong>
                    </td>
                  </tr>
                  {!!selectedSimilarJob.error_lines && (
                    <tr>
                      <td colSpan={2}>
                        <ul className="list-unstyled error_list">
                          {selectedSimilarJob.error_lines.map(error => (
                            <li key={error.id}>
                              <small title={error.line}>{error.line}</small>
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
        {isLoading && (
          <div className="overlay">
            <div>
              <FontAwesomeIcon
                icon={faSpinner}
                pulse
                className="th-spinner-lg"
                title="Loading..."
              />
            </div>
          </div>
        )}
      </div>
    );
  }
}

SimilarJobsTab.propTypes = {
  repoName: PropTypes.string.isRequired,
  classificationMap: PropTypes.shape({}).isRequired,
  notify: PropTypes.func.isRequired,
  selectedJobFull: PropTypes.shape({}).isRequired,
};

export default connect(null, { notify })(SimilarJobsTab);
