import { useState, useEffect, useRef, useCallback } from 'react';
import { Queue } from 'taskcluster-client-web';

import { thEvents } from '../../helpers/constants';
import { addAggregateFields } from '../../helpers/job';
import { getLogViewerUrl, getArtifactsUrl } from '../../helpers/url';
import { formatArtifacts } from '../../helpers/display';
import { getData } from '../../helpers/http';
import BugJobMapModel from '../../models/bugJobMap';
import JobClassificationModel from '../../models/classification';
import JobModel from '../../models/job';
import JobLogUrlModel from '../../models/jobLogUrl';
import PerfSeriesModel from '../../models/perfSeries';
import { Perfdocs } from '../../perfherder/perf-helpers/perfdocs';

// Debounce delay for loading job details when rapidly switching jobs
const JOB_DETAILS_DEBOUNCE_MS = 200;

const fetchTaskData = async (taskId, rootUrl) => {
  let testGroups = [];
  let taskQueueId = null;

  if (!taskId || !rootUrl) {
    return { testGroups, taskQueueId };
  }

  const queue = new Queue({ rootUrl });
  const taskDefinition = await queue.task(taskId);
  if (taskDefinition) {
    taskQueueId = taskDefinition.taskQueueId;
    if (taskDefinition.payload.env?.MOZHARNESS_TEST_PATHS) {
      const testGroupsData = Object.values(
        JSON.parse(taskDefinition.payload.env.MOZHARNESS_TEST_PATHS),
      );
      if (testGroupsData.length) {
        [testGroups] = testGroupsData;
      }
    }
  }

  return { testGroups, taskQueueId };
};

const fetchClassifications = async (jobId, signal) => {
  const [classifications, bugs] = await Promise.all([
    JobClassificationModel.getList({ job_id: jobId }, signal),
    BugJobMapModel.getList({ job_id: jobId }, signal),
  ]);
  return { classifications, bugs };
};

const processPerfData = (rowOrResponse, repoName, frameworks) => {
  const jobData = !rowOrResponse.failureStatus
    ? rowOrResponse.data
    : rowOrResponse;

  if (jobData.failureStatus) {
    return [];
  }

  const mappedFrameworks = {};
  frameworks.forEach((element) => {
    mappedFrameworks[element.id] = element.name;
  });

  const perfJobDetail = jobData.data.map((performanceData) => {
    const signature = performanceData.signature_data;
    return {
      url: `/perfherder/graphs?series=${[
        repoName,
        signature.id,
        1,
        signature.frameworkId,
      ]}&selected=${[signature.id, performanceData.id]}`,
      shouldAlert: signature.should_alert,
      value: performanceData.value,
      measurementUnit: signature.measurementUnit,
      lowerIsBetter: signature.lowerIsBetter,
      title: signature.name,
      suite: signature.suite,
      options: signature.options.join(' '),
      frameworkName: mappedFrameworks[signature.frameworkId],
      perfdocs: new Perfdocs(
        mappedFrameworks[signature.frameworkId],
        signature.suite,
        signature.platform,
        signature.name,
      ),
    };
  });

  perfJobDetail.sort((a, b) => {
    // Sort perfJobDetails by value of shouldAlert in a particular order:
    // first true values, after that null values and then false.
    if (a.shouldAlert === true) return -1;
    if (a.shouldAlert === false) return 1;
    if (a.shouldAlert === null && b.shouldAlert === true) return 1;
    if (a.shouldAlert === null && b.shouldAlert === false) return -1;
    return 0;
  });

  return perfJobDetail;
};

/**
 * Custom hook for managing job details fetching with proper cleanup and debouncing.
 *
 * @param {Object} selectedJob - The currently selected job from Redux
 * @param {Object} currentRepo - The current repository
 * @param {Array} pushList - List of pushes to find the job's push
 * @param {Array} frameworks - Performance frameworks for perf data processing
 * @returns {Object} - Job details state and loading flags
 */
function useJobDetails(selectedJob, currentRepo, pushList, frameworks) {
  const [selectedJobFull, setSelectedJobFull] = useState(null);
  const [jobDetails, setJobDetails] = useState([]);
  const [jobLogUrls, setJobLogUrls] = useState([]);
  const [jobDetailLoading, setJobDetailLoading] = useState(false);
  const [jobArtifactsLoading, setJobArtifactsLoading] = useState(false);
  const [logViewerUrl, setLogViewerUrl] = useState(null);
  const [logViewerFullUrl, setLogViewerFullUrl] = useState(null);
  const [perfJobDetail, setPerfJobDetail] = useState([]);
  const [jobRevision, setJobRevision] = useState(null);
  const [logParseStatus, setLogParseStatus] = useState('unavailable');
  const [classifications, setClassifications] = useState([]);
  const [testGroups, setTestGroups] = useState([]);
  const [bugs, setBugs] = useState([]);

  // Refs for cleanup
  const abortControllerRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const previousJobIdRef = useRef(null);
  const isFirstLoadRef = useRef(true);

  const findPush = useCallback(
    (pushId) => pushList.find((push) => pushId === push.id),
    [pushList],
  );

  // Update classifications when the classification changed event fires
  const updateClassifications = useCallback(async () => {
    if (!selectedJob) return;

    try {
      const result = await fetchClassifications(selectedJob.id);
      setClassifications(result.classifications);
      setBugs(result.bugs);
    } catch (error) {
      if (error.name !== 'AbortError') {
        // eslint-disable-next-line no-console
        console.error('Error updating classifications:', error);
      }
    }
  }, [selectedJob]);

  // Listen for classification changed events
  useEffect(() => {
    window.addEventListener(
      thEvents.classificationChanged,
      updateClassifications,
    );

    return () => {
      window.removeEventListener(
        thEvents.classificationChanged,
        updateClassifications,
      );
    };
  }, [updateClassifications]);

  // Main effect for loading job details
  useEffect(() => {
    // If no job is selected, clear the state
    if (!selectedJob) {
      setSelectedJobFull(null);
      previousJobIdRef.current = null;
      isFirstLoadRef.current = true;
      return;
    }

    const jobId = selectedJob.id;

    // Determine if we need to reload
    const isNewJob = previousJobIdRef.current !== jobId;
    const isFirstLoad = isFirstLoadRef.current;

    // For subsequent loads (not first), we debounce
    // For first load or initial job selection, load immediately
    const shouldDebounce = !isFirstLoad && !isNewJob;

    const loadJobDetails = async (signal) => {
      if (!currentRepo) return;

      setJobDetailLoading(true);
      setJobArtifactsLoading(true);

      try {
        const push = findPush(selectedJob.push_id);

        const artifactsParams = {
          jobId: selectedJob.id,
          taskId: selectedJob.task_id,
          run: selectedJob.retry_id,
          rootUrl: currentRepo.tc_root_url,
        };

        // Start all promises
        const jobPromise =
          'logs' in selectedJob
            ? Promise.resolve(selectedJob)
            : JobModel.get(currentRepo.name, selectedJob.id, signal);

        const jobArtifactsPromise = getData(
          getArtifactsUrl(artifactsParams),
          signal,
        );

        let builtFromArtifactPromise;
        if (
          currentRepo.name === 'comm-central' ||
          currentRepo.name === 'try-comm-central'
        ) {
          builtFromArtifactPromise = getData(
            getArtifactsUrl({
              ...artifactsParams,
              artifactPath: 'public/build/built_from.json',
            }),
          );
        }

        const jobLogUrlPromise = JobLogUrlModel.getList(
          { job_id: selectedJob.id },
          signal,
        );

        const perfPromise = PerfSeriesModel.getJobData(currentRepo.name, {
          job_id: selectedJob.id,
        });

        const taskDataPromise = fetchTaskData(
          selectedJob.task_id,
          currentRepo.tc_root_url,
        );

        const classificationsPromise = fetchClassifications(
          selectedJob.id,
          signal,
        );

        // Wait for main data
        const [
          jobResultData,
          jobLogUrlResult,
          taskData,
          classificationsResult,
        ] = await Promise.all([
          jobPromise,
          jobLogUrlPromise,
          taskDataPromise,
          classificationsPromise,
        ]);

        // Check if we were aborted
        if (signal.aborted) return;

        // Process job result
        const fullJob = {
          ...jobResultData,
          hasSideBySide: selectedJob.hasSideBySide,
          taskQueueId: taskData.taskQueueId,
        };
        addAggregateFields(fullJob);

        // Process log URLs
        const filteredLogUrls = jobLogUrlResult.filter(
          (log) => !log.name.endsWith('_json'),
        );

        let parseStatus = 'unavailable';
        if (filteredLogUrls.length && filteredLogUrls[0].parse_status) {
          parseStatus = filteredLogUrls[0].parse_status;
        }

        const logUrl = getLogViewerUrl(
          selectedJob.id,
          currentRepo.name,
          null,
          fullJob,
        );
        const fullLogUrl = `${window.location.origin}${logUrl}`;

        // Update state with main job data
        setSelectedJobFull(fullJob);
        setJobLogUrls(filteredLogUrls);
        setLogParseStatus(parseStatus);
        setLogViewerUrl(logUrl);
        setLogViewerFullUrl(fullLogUrl);
        setJobRevision(push ? push.revision : null);
        setTestGroups(taskData.testGroups);
        setClassifications(classificationsResult.classifications);
        setBugs(classificationsResult.bugs);

        // For failed jobs, show the panel immediately
        if (
          ['busted', 'testfailed', 'exception'].includes(fullJob.resultStatus)
        ) {
          setJobDetailLoading(false);
        }

        // Handle artifacts separately (can be slower)
        try {
          const jobArtifactsResult = await jobArtifactsPromise;
          if (signal.aborted) return;

          let details = jobArtifactsResult.data.artifacts
            ? formatArtifacts(
                jobArtifactsResult.data.artifacts,
                artifactsParams,
              )
            : [];

          if (builtFromArtifactPromise) {
            const builtFromResult = await builtFromArtifactPromise;
            if (!builtFromResult.failureStatus) {
              details = [...details, ...builtFromResult.data];
            }
          }

          setJobDetails(details);
          setJobArtifactsLoading(false);
        } catch (error) {
          if (error.name !== 'AbortError') {
            setJobArtifactsLoading(false);
          }
        }

        // Handle perf data
        try {
          const perfResult = await perfPromise;
          if (signal.aborted) return;

          const perfDetails = processPerfData(
            perfResult,
            currentRepo.name,
            frameworks,
          );
          setPerfJobDetail(perfDetails);

          // For non-failed jobs, wait for perf data before hiding loading
          if (
            !['busted', 'testfailed', 'exception'].includes(
              fullJob.resultStatus,
            )
          ) {
            setJobDetailLoading(false);
          }
        } catch (error) {
          if (error.name !== 'AbortError') {
            setPerfJobDetail([]);
            setJobDetailLoading(false);
          }
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          // eslint-disable-next-line no-console
          console.error('Error loading job details:', error);
          setJobDetailLoading(false);
          setJobArtifactsLoading(false);
        }
      }
    };

    // Cancel any pending operations
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Update tracking refs
    previousJobIdRef.current = jobId;
    isFirstLoadRef.current = false;

    if (shouldDebounce) {
      // Debounce for rapid job switching (e.g., keyboard navigation)
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        loadJobDetails(abortController.signal);
      }, JOB_DETAILS_DEBOUNCE_MS);
    } else {
      // Load immediately for first selection or new job
      loadJobDetails(abortController.signal);
    }

    // Cleanup function
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      abortController.abort();
    };
    // We track specific fields that should trigger a reload
  }, [
    selectedJob?.id,
    selectedJob?.state,
    selectedJob?.result,
    selectedJob?.failure_classification_id,
    currentRepo,
    frameworks,
    findPush,
    selectedJob,
  ]);

  return {
    selectedJobFull,
    jobDetails,
    jobLogUrls,
    jobDetailLoading,
    jobArtifactsLoading,
    logViewerUrl,
    logViewerFullUrl,
    perfJobDetail,
    jobRevision,
    logParseStatus,
    classifications,
    testGroups,
    bugs,
  };
}

export default useJobDetails;
