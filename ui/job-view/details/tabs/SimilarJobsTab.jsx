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
import { notify } from '../../../shared/stores/notificationStore';
import { getProjectJobUrl } from '../../../helpers/location';
import { getData } from '../../../helpers/http';

import {
  getSimilarJobsSnapshot,
  setSimilarJobsSnapshot,
  isSnapshotFresh,
} from './similarJobsCache';

const PAGE_SIZE = 20;

function SimilarJobsTab({ repoName, classificationMap, selectedJobFull }) {
  const [similarJobs, setSimilarJobs] = useState([]);
  const [filterNoSuccessfulJobs, setFilterNoSuccessfulJobs] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedSimilarJob, setSelectedSimilarJob] = useState(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  // Start without a spinner when we already have a snapshot to restore, so the
  // cache hit renders instantly. The mount effect below manages it thereafter.
  const [isLoading, setIsLoading] = useState(
    () => !getSimilarJobsSnapshot(selectedJobFull.id),
  );

  // Tracks whether the component is still mounted, so a background revalidate
  // that resolves after the user tabs away updates the cache but skips setState.
  const isMountedRef = useRef(true);
  // Time of the last successful *list* fetch, used as the cache snapshot's
  // freshness timestamp (selection/pagination writes preserve it).
  const lastFetchTimeRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Fetch a slice of similar jobs and enrich each with its push data. Returns
  // { jobs, hasNext } or null on error. `wanted` is the number of rows to
  // display; we request one extra to detect a further page.
  const fetchAndEnrich = useCallback(
    async ({ offset, wanted, currentFilter }) => {
      const options = { count: wanted + 1, offset };
      if (currentFilter) {
        options.nosuccess = '';
      }

      const { data: raw, failureStatus } = await JobModel.getSimilarJobs(
        selectedJobFull.id,
        options,
      );
      if (failureStatus) {
        notify(`Error fetching similar jobs: ${failureStatus}`, 'danger', {
          sticky: true,
        });
        return null;
      }

      const hasNext = raw.length > wanted;
      const jobs = hasNext ? raw.slice(0, wanted) : raw;

      const pushIds = [...new Set(jobs.map((job) => job.push_id))];
      const { data: pushData, failureStatus: pushFailureStatus } =
        await PushModel.getList({
          id__in: pushIds.join(','),
          count: thMaxPushFetchSize,
        });
      if (pushFailureStatus) {
        notify(`Error fetching similar jobs push data: ${pushData}`, 'danger', {
          sticky: true,
        });
        return null;
      }

      const pushes = pushData.results.reduce(
        (acc, push) => ({ ...acc, [push.id]: push }),
        {},
      );
      jobs.forEach((simJob) => {
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

      return { jobs, hasNext };
    },
    [selectedJobFull.id, repoName],
  );

  // Fetch a single similar job's detail (classification + error lines) for the
  // detail panel. Returns the enriched job.
  const fetchJobDetail = useCallback(
    async (job) => {
      const nextJob = await JobModel.get(repoName, job.id);
      addAggregateFields(nextJob);
      nextJob.failure_classification =
        classificationMap[nextJob.failure_classification_id];

      const { data, failureStatus } = await getData(
        getProjectJobUrl(textLogErrorsEndpoint, nextJob.id),
      );
      if (!failureStatus && data.length) {
        nextJob.error_lines = data;
      }
      return nextJob;
    },
    [repoName, classificationMap],
  );

  const showJobInfo = useCallback(
    (job) => {
      fetchJobDetail(job).then((nextJob) => {
        if (isMountedRef.current) {
          setSelectedSimilarJob(nextJob);
        }
      });
    },
    [fetchJobDetail],
  );

  // Load the first page from scratch (cache miss, or filter change).
  const loadInitial = useCallback(
    async (currentFilter) => {
      setIsLoading(true);
      const result = await fetchAndEnrich({
        offset: 0,
        wanted: PAGE_SIZE,
        currentFilter,
      });
      if (!isMountedRef.current) return;
      setIsLoading(false);
      if (!result) return;

      lastFetchTimeRef.current = Date.now();
      setPage(1);
      setSimilarJobs(result.jobs);
      setHasNextPage(result.hasNext);
      if (result.jobs.length > 0) {
        showJobInfo(result.jobs[0]);
      }
    },
    [fetchAndEnrich, showJobInfo],
  );

  // Stale-while-revalidate: refetch every currently-loaded page in one request,
  // refresh the selected job's detail, then update the cache (always) and the
  // component state (only if still mounted).
  const revalidate = useCallback(
    async (snapshot) => {
      const {
        page: snapPage,
        filterNoSuccessfulJobs: snapFilter,
        selectedSimilarJob: snapSelected,
      } = snapshot;

      const result = await fetchAndEnrich({
        offset: 0,
        wanted: snapPage * PAGE_SIZE,
        currentFilter: snapFilter,
      });
      if (!result) return;
      lastFetchTimeRef.current = Date.now();

      let refreshedSelected = snapSelected;
      if (snapSelected && result.jobs.some((job) => job.id === snapSelected.id)) {
        refreshedSelected = await fetchJobDetail(snapSelected).catch(
          () => snapSelected,
        );
      }

      // Always refresh the cache so the next tab open is up to date, even if the
      // user has already tabbed away.
      setSimilarJobsSnapshot(selectedJobFull.id, {
        similarJobs: result.jobs,
        page: snapPage,
        filterNoSuccessfulJobs: snapFilter,
        selectedSimilarJob: refreshedSelected,
        hasNextPage: result.hasNext,
        timestamp: lastFetchTimeRef.current,
      });

      if (isMountedRef.current) {
        setSimilarJobs(result.jobs);
        setHasNextPage(result.hasNext);
        setSelectedSimilarJob(refreshedSelected);
      }
    },
    [fetchAndEnrich, fetchJobDetail, selectedJobFull.id],
  );

  // On mount (or when the investigated job changes): restore from cache and
  // revalidate if stale, otherwise load fresh.
  useEffect(() => {
    const snapshot = getSimilarJobsSnapshot(selectedJobFull.id);
    if (snapshot) {
      setSimilarJobs(snapshot.similarJobs);
      setPage(snapshot.page);
      setFilterNoSuccessfulJobs(snapshot.filterNoSuccessfulJobs);
      setSelectedSimilarJob(snapshot.selectedSimilarJob);
      setHasNextPage(snapshot.hasNextPage);
      setIsLoading(false);
      lastFetchTimeRef.current = snapshot.timestamp;
      if (!isSnapshotFresh(snapshot)) {
        revalidate(snapshot);
      }
    } else {
      loadInitial(false);
    }
    // Intentionally keyed only on the investigated job id; loadInitial/revalidate
    // are stable per job and we do not want to re-run on their identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedJobFull.id]);

  // Persist the tab state so a remount restores exactly where the user left off.
  // Uses the last *fetch* time (not now) so the revalidate dedup stays accurate.
  useEffect(() => {
    if (isLoading || similarJobs.length === 0) {
      return;
    }
    setSimilarJobsSnapshot(selectedJobFull.id, {
      similarJobs,
      page,
      filterNoSuccessfulJobs,
      selectedSimilarJob,
      hasNextPage,
      timestamp: lastFetchTimeRef.current,
    });
  }, [
    similarJobs,
    page,
    filterNoSuccessfulJobs,
    selectedSimilarJob,
    hasNextPage,
    isLoading,
    selectedJobFull.id,
  ]);

  const showNext = useCallback(async () => {
    const nextPage = page + 1;
    setIsLoading(true);
    const result = await fetchAndEnrich({
      offset: page * PAGE_SIZE,
      wanted: PAGE_SIZE,
      currentFilter: filterNoSuccessfulJobs,
    });
    if (!isMountedRef.current) return;
    setIsLoading(false);
    if (!result) return;

    lastFetchTimeRef.current = Date.now();
    setPage(nextPage);
    setSimilarJobs((prev) => [...prev, ...result.jobs]);
    setHasNextPage(result.hasNext);
  }, [page, filterNoSuccessfulJobs, fetchAndEnrich]);

  const toggleFilter = useCallback(() => {
    const newValue = !filterNoSuccessfulJobs;
    setFilterNoSuccessfulJobs(newValue);
    setSelectedSimilarJob(null);
    setSimilarJobs([]);
    loadInitial(newValue);
  }, [filterNoSuccessfulJobs, loadInitial]);

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
