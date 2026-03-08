import { useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import { Button } from 'react-bootstrap';

import { thMaxPushFetchSize } from '../../../helpers/constants';
import { toDateStr, toShortDateStr } from '../../../helpers/display';
import { addAggregateFields, getBtnClass } from '../../../helpers/job';
import { getJobsUrl, textLogErrorsEndpoint } from '../../../helpers/url';
import JobModel from '../../../models/job';
import PushModel from '../../../models/push';
import { notify } from '../../stores/notificationStore';
import { getProjectJobUrl } from '../../../helpers/location';
import { getData } from '../../../helpers/http';

const PAGE_SIZE = 20;

function SimilarJobsTab({ repoName, classificationMap, selectedJobFull }) {
  const [similarJobs, setSimilarJobs] = useState([]);
  const [filterNoSuccessfulJobs, setFilterNoSuccessfulJobs] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedSimilarJob, setSelectedSimilarJob] = useState(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const similarJobsRef = useRef(similarJobs);
  const selectedSimilarJobRef = useRef(selectedSimilarJob);
  similarJobsRef.current = similarJobs;
  selectedSimilarJobRef.current = selectedSimilarJob;

  const showJobInfo = useCallback((job) => {
    JobModel.get(repoName, job.id).then(async (nextJob) => {
      addAggregateFields(nextJob);
      nextJob.failure_classification =
        classificationMap[nextJob.failure_classification_id];

      const { data, failureStatus } = await getData(
        getProjectJobUrl(textLogErrorsEndpoint, nextJob.id),
      );
      if (!failureStatus && data.length) {
        nextJob.error_lines = data;
      }
      setSelectedSimilarJob(nextJob);
    });
  }, [repoName, classificationMap]);

  const getSimilarJobs = useCallback(async (currentPage, currentFilterNoSuccess) => {
    const options = {
      count: PAGE_SIZE + 1,
      offset: (currentPage - 1) * PAGE_SIZE,
    };

    if (currentFilterNoSuccess) {
      options.nosuccess = '';
    }

    const {
      data: newSimilarJobs,
      failureStatus,
    } = await JobModel.getSimilarJobs(selectedJobFull.id, options);

    if (!failureStatus) {
      const nextPage = newSimilarJobs.length > PAGE_SIZE;
      setHasNextPage(nextPage);
      if (nextPage) {
        newSimilarJobs.pop();
      }
      const pushIds = [...new Set(newSimilarJobs.map((job) => job.push_id))];
      let pushList = { results: [] };
      const { data, failureStatus: pushFailureStatus } = await PushModel.getList({
        id__in: pushIds.join(','),
        count: thMaxPushFetchSize,
      });

      if (!pushFailureStatus) {
        pushList = data;
        const pushes = pushList.results.reduce(
          (acc, push) => ({ ...acc, [push.id]: push }),
          {},
        );
        newSimilarJobs.forEach((simJob) => {
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
        setSimilarJobs((prev) => [...prev, ...newSimilarJobs]);
        if (!selectedSimilarJobRef.current && newSimilarJobs.length > 0) {
          showJobInfo(newSimilarJobs[0]);
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
    setIsLoading(false);
  }, [selectedJobFull.id, repoName, showJobInfo]);

  useEffect(() => {
    getSimilarJobs(1, false);
  }, [getSimilarJobs]);

  const showNext = useCallback(() => {
    const nextPage = page + 1;
    setPage(nextPage);
    setIsLoading(true);
    getSimilarJobs(nextPage, filterNoSuccessfulJobs);
  }, [page, filterNoSuccessfulJobs, getSimilarJobs]);

  const toggleFilter = useCallback(() => {
    const newValue = !filterNoSuccessfulJobs;
    setFilterNoSuccessfulJobs(newValue);
    setSimilarJobs([]);
    setIsLoading(true);
    getSimilarJobs(1, newValue);
  }, [filterNoSuccessfulJobs, getSimilarJobs]);

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
            {similarJobs.map((similarJob) => {
              const { status, isClassified } = getBtnClass(
                similarJob.resultStatus,
                similarJob.failure_classification_id,
              );
              return (
                <tr
                  key={similarJob.id}
                  onClick={() => showJobInfo(similarJob)}
                  className={
                    selectedSimilarJobId === similarJob.id
                      ? 'table-active'
                      : ''
                  }
                >
                  <td>
                    <button
                      className="btn job-btn btn-xs"
                      type="button"
                      data-status={status}
                      data-classified={isClassified ? 'true' : undefined}
                    >
                      {similarJob.job_type_symbol}
                      {similarJob.failure_classification_id > 1 &&
                        ![6, 8].includes(
                          similarJob.failure_classification_id,
                        ) && <span>*</span>}
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
              );
            })}
          </tbody>
        </table>
        {hasNextPage && (
          <Button
            variant="outline-secondary"
            className="bg-light"
            type="button"
            onClick={showNext}
          >
            Show previous jobs
          </Button>
        )}
      </div>
      <div className="similar-job-detail-panel">
        <form className="form form-inline">
          <div className="checkbox">
            <input
              onChange={toggleFilter}
              type="checkbox"
              checked={filterNoSuccessfulJobs}
            />
            <span className="fs-80">Exclude successful jobs</span>
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
                        {selectedSimilarJob.error_lines.map((error) => (
                          <li key={error.id}>
                            <span className="fs-80" title={error.line}>
                              {error.line}
                            </span>
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

SimilarJobsTab.propTypes = {
  repoName: PropTypes.string.isRequired,
  classificationMap: PropTypes.shape({}).isRequired,
  selectedJobFull: PropTypes.shape({}).isRequired,
};

export default SimilarJobsTab;
