import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import sortBy from 'lodash/sortBy';
import { Col, Row } from 'react-bootstrap';

import {
  sxsTaskName,
  thEvents,
  thOptionOrder,
  thPlatformMap,
} from '../../helpers/constants';
import decompress from '../../helpers/gzip';
import { getGroupMapKey } from '../../helpers/aggregateId';
import {
  getAllUrlParams,
  getUrlParam,
  setUrlParam,
} from '../../helpers/location';
import JobModel from '../../models/job';
import RunnableJobModel from '../../models/runnableJob';
import { getRevisionTitle } from '../../helpers/revision';
import { getPercentComplete } from '../../helpers/display';
import { notify } from '../redux/stores/notifications';
import {
  updateJobMap,
  recalculateUnclassifiedCounts,
} from '../redux/stores/pushes';
import {
  checkRootUrl,
  prodFirefoxRootUrl,
} from '../../taskcluster-auth-callback/constants';
import { RevisionList } from '../../shared/RevisionList';
import { Revision } from '../../shared/Revision';
import PushHealthSummary from '../../shared/PushHealthSummary';
import { getTaskRunStr } from '../../helpers/job';

import FuzzyJobFinder from './FuzzyJobFinder';
import PushHeader from './PushHeader';
import PushJobs from './PushJobs';

const watchCycleStates = ['none', 'push', 'job', 'none'];
const platformArray = Object.values(thPlatformMap);

// Bug 1638424 - Transform WPT test paths to look like paths
// from a local checkout
export const transformTestPath = (path) => {
  let newPath = path;
  // WPT path transformations
  if (path.startsWith('/_mozilla')) {
    // /_mozilla/<path> => testing/web-platform/mozilla/tests/<path>
    const modifiedPath = path.replace('/_mozilla', '');
    newPath = `testing/web-platform/mozilla/tests${modifiedPath}`;
  } else if (path.startsWith('/')) {
    // /<path> => testing/web-platform/tests/<path>
    newPath = `testing/web-platform/tests${path}`;
  }

  return newPath;
};

/**
 * Calculate job counts by state from a list of jobs.
 * Exported for testing purposes.
 */
export const getJobCount = (jobs) => {
  const filteredByCommit = jobs.filter(
    (job) => job.failure_classification_id === 2,
  );

  return jobs.reduce(
    (memo, job) =>
      job.result !== 'superseded'
        ? { ...memo, [job.state]: memo[job.state] + 1 }
        : memo,
    {
      unscheduled: 0,
      pending: 0,
      running: 0,
      completed: 0,
      fixedByCommit: filteredByCommit.length,
    },
  );
};

export const transformedPaths = (manifestsByTask) => {
  const newManifestsByTask = {};
  Object.keys(manifestsByTask).forEach((taskName) => {
    newManifestsByTask[taskName] = manifestsByTask[taskName].map((testPath) =>
      transformTestPath(testPath),
    );
  });
  return newManifestsByTask;
};

const fetchGeckoDecisionArtifact = async (project, revision, filePath) => {
  let artifactContents = {};
  const rootUrl = prodFirefoxRootUrl;
  const url = `${checkRootUrl(
    rootUrl,
  )}/api/index/v1/task/gecko.v2.${project}.revision.${revision}.taskgraph.decision/artifacts/public/${filePath}`;
  const response = await fetch(url);
  if (url.endsWith('.gz')) {
    if ([200, 303, 304].includes(response.status)) {
      const blob = await response.blob();
      const binData = await blob.arrayBuffer();
      artifactContents = await decompress(binData);
    }
  } else if (url.endsWith('.json')) {
    if ([200, 303, 304].includes(response.status)) {
      artifactContents = await response.json();
    }
  }
  return artifactContents;
};

function Push({
  push,
  currentRepo,
  duplicateJobsVisible,
  filterModel,
  notificationSupported,
  getAllShownJobs,
  groupCountsExpanded,
  isOnlyRevision,
  pushHealthVisibility,
  decisionTaskMap,
  bugSummaryMap,
  allUnclassifiedFailureCount,
  router,
  notify,
  updateJobMap,
  recalculateUnclassifiedCounts,
}) {
  const collapsedPushes = getUrlParam('collapsedPushes') || '';

  const [fuzzyModal, setFuzzyModal] = useState(false);
  const [platforms, setPlatforms] = useState([]);
  const [jobList, setJobList] = useState([]);
  const [runnableVisible, setRunnableVisible] = useState(false);
  const [selectedRunnableJobs, setSelectedRunnableJobs] = useState([]);
  const [watched, setWatched] = useState('none');
  const [jobCounts, setJobCounts] = useState({
    pending: 0,
    running: 0,
    completed: 0,
    fixedByCommit: 0,
  });
  const [pushGroupState, setPushGroupState] = useState('collapsed');
  const [collapsed, setCollapsed] = useState(collapsedPushes.includes(push.id));
  const [filteredTryPush, setFilteredTryPush] = useState(false);
  const [pushHealthStatus, setPushHealthStatus] = useState(null);
  const [fuzzyJobList, setFuzzyJobList] = useState([]);
  const [filteredFuzzyList, setFilteredFuzzyList] = useState([]);
  const [manifestsByTask, setManifestsByTask] = useState({});

  const containerRef = useRef(null);
  const prevRouterSearch = useRef(router.location.search);
  const prevJobCounts = useRef(jobCounts);
  const jobListRef = useRef(jobList);
  const manifestsByTaskRef = useRef(manifestsByTask);

  // Keep refs in sync
  useEffect(() => {
    jobListRef.current = jobList;
  }, [jobList]);

  useEffect(() => {
    manifestsByTaskRef.current = manifestsByTask;
  }, [manifestsByTask]);

  const getJobGroupInfo = useCallback((job) => {
    const {
      job_group_name: name,
      job_group_symbol: jobGroupSymbol,
      platform,
      platform_option: platformOption,
      tier,
      push_id: pushId,
    } = job;
    const symbol = jobGroupSymbol === '?' ? '' : jobGroupSymbol;
    const mapKey = getGroupMapKey(
      pushId,
      symbol,
      tier,
      platform,
      platformOption,
    );

    return { name, tier, symbol, mapKey };
  }, []);

  const groupJobByPlatform = useCallback(
    (jobs) => {
      const plats = [];

      if (jobs.length === 0) {
        return plats;
      }
      jobs.forEach((job) => {
        // search for the right platform
        const platformName = thPlatformMap[job.platform] || job.platform;
        let platform = plats.find(
          (p) => platformName === p.name && job.platform_option === p.option,
        );
        if (platform === undefined) {
          platform = {
            name: platformName,
            option: job.platform_option,
            groups: [],
          };
          plats.push(platform);
        }

        const groupInfo = getJobGroupInfo(job);
        // search for the right group
        let group = platform.groups.find(
          (g) => groupInfo.symbol === g.symbol && groupInfo.tier === g.tier,
        );
        if (group === undefined) {
          group = { ...groupInfo, jobs: [] };
          platform.groups.push(group);
        }
        group.jobs.push(job);
      });
      return plats;
    },
    [getJobGroupInfo],
  );

  const sortGroupedJobs = useCallback((plats) => {
    plats.forEach((platform) => {
      platform.groups.forEach((group) => {
        group.jobs = sortBy(group.jobs, (job) =>
          // Symbol could be something like 1, 2 or 3. Or A, B, C or R1, R2, R10.
          // So this will pad the numeric portion with 0s like R001, R010, etc.
          job.job_type_symbol.replace(/([\D]*)([\d]*)/g, (matcher, s1, s2) =>
            s2 !== '' ? s1 + `00${s2}`.slice(-3) : matcher,
          ),
        );
      });
      platform.groups.sort(
        (a, b) => a.symbol.length + a.tier - b.symbol.length - b.tier,
      );
    });
    plats.sort(
      (a, b) =>
        platformArray.indexOf(a.name) * 100 +
        (thOptionOrder[a.option] || 10) -
        (platformArray.indexOf(b.name) * 100 + (thOptionOrder[b.option] || 10)),
    );
    return plats;
  }, []);

  const mapPushJobs = useCallback(
    (jobs, skipJobMap) => {
      // whether or not we got any jobs for this push, the operation to fetch
      // them has completed.
      push.jobsLoaded = true;
      if (jobs.length > 0) {
        const currentJobList = jobListRef.current;
        const currentManifestsByTask = manifestsByTaskRef.current;
        const newIds = jobs.map((job) => job.id);
        // remove old versions of jobs we just fetched.
        const existingJobs = currentJobList.filter(
          (job) => !newIds.includes(job.id),
        );
        // Join both lists and add test_paths and task_run property
        const newJobList = [...existingJobs, ...jobs].map((job) => {
          if (Object.keys(currentManifestsByTask).length > 0) {
            job.test_paths = currentManifestsByTask[job.job_type_name] || [];
          }
          job.task_run = getTaskRunStr(job);
          return job;
        });
        const sideBySideJobs = newJobList.filter((sxsJob) =>
          sxsJob.job_type_symbol.includes(sxsTaskName),
        );
        // If the pageload job has a side-by-side comparison associated
        // add job.hasSideBySide containing sxsTaskName ("side-by-side")
        newJobList.forEach((job) => {
          if (job.job_type_name.includes('browsertime')) {
            const matchingSxsJobs = sideBySideJobs.filter(
              (sxsJob) =>
                sxsJob.job_type_name.includes(
                  job.job_type_name.split('/opt-')[0],
                ) && // platform
                sxsJob.job_type_name.includes(
                  job.job_type_name.split('/opt-')[1],
                ), // testName
            );
            if (matchingSxsJobs.length > 0) {
              job.hasSideBySide = matchingSxsJobs[0].job_type_name;
            } else {
              job.hasSideBySide = false;
            }
          }
        });
        const newPlatforms = sortGroupedJobs(groupJobByPlatform(newJobList));
        const newJobCounts = getJobCount(newJobList);

        setPlatforms(newPlatforms);
        setJobList(newJobList);
        setJobCounts(newJobCounts);

        if (!skipJobMap) {
          updateJobMap(jobs);
        }
        recalculateUnclassifiedCounts();
      }
    },
    [
      push,
      sortGroupedJobs,
      groupJobByPlatform,
      getJobCount,
      updateJobMap,
      recalculateUnclassifiedCounts,
    ],
  );

  const fetchJobs = useCallback(async () => {
    const { data, failureStatus } = await JobModel.getList(
      {
        push_id: push.id,
      },
      { fetchAll: true },
    );

    if (!failureStatus) {
      mapPushJobs(data);
    } else {
      notify(failureStatus, 'danger', { sticky: true });
    }
  }, [push.id, mapPushJobs, notify]);

  const fetchTestManifests = useCallback(async () => {
    const manifests = await fetchGeckoDecisionArtifact(
      currentRepo.name,
      push.revision,
      'manifests-by-task.json.gz',
    );
    const transformed = transformedPaths(manifests);
    setManifestsByTask(transformed);
    manifestsByTaskRef.current = transformed;
    // Re-map jobs with the new manifests
    mapPushJobs(jobListRef.current);
  }, [currentRepo.name, push.revision, mapPushJobs]);

  const testForFilteredTry = useCallback(() => {
    const filterParams = ['revision', 'author'];
    const urlParams = getAllUrlParams();
    const isFiltered =
      filterParams.some((f) => urlParams.has(f)) && currentRepo.name === 'try';

    setFilteredTryPush(isFiltered);
  }, [currentRepo.name]);

  const handleUrlChanges = useCallback(async () => {
    const allParams = getAllUrlParams();
    const collapsedPushesParam = allParams.get('collapsedPushes') || '';

    if (allParams.has('test_paths')) {
      await fetchTestManifests();
    } else {
      setManifestsByTask({});
    }
    setCollapsed(collapsedPushesParam.includes(push.id));
  }, [push.id, fetchTestManifests]);

  const handleApplyNewJobs = useCallback(
    (event) => {
      const { jobs } = event.detail;
      const newJobs = jobs[push.id];

      if (newJobs) {
        mapPushJobs(newJobs);
      }
    },
    [push.id, mapPushJobs],
  );

  const toggleSelectedRunnableJob = useCallback((signature) => {
    setSelectedRunnableJobs((prev) => {
      const jobIndex = prev.indexOf(signature);
      if (jobIndex === -1) {
        return [...prev, signature];
      }
      return prev.filter((_, i) => i !== jobIndex);
    });
  }, []);

  const setSingleRevisionWindowTitle = useCallback(() => {
    const percentComplete = getPercentComplete(jobCounts);
    const title = `[${allUnclassifiedFailureCount}] ${currentRepo.name}`;

    document.title = `${percentComplete}% - ${title}: ${getRevisionTitle(
      push.revisions,
    )}`;
  }, [
    jobCounts,
    allUnclassifiedFailureCount,
    currentRepo.name,
    push.revisions,
  ]);

  const togglePushCollapsed = useCallback(() => {
    const pushId = `${push.id}`;
    const collapsedPushesParam = getUrlParam('collapsedPushes');
    const collapsedSet = collapsedPushesParam
      ? new Set(collapsedPushesParam.split(','))
      : new Set();

    setCollapsed((prev) => {
      const newCollapsed = !prev;
      if (!newCollapsed) {
        collapsedSet.delete(pushId);
      } else {
        collapsedSet.add(pushId);
      }
      setUrlParam(
        'collapsedPushes',
        collapsedSet.size ? Array.from(collapsedSet) : null,
      );
      return newCollapsed;
    });
  }, [push.id]);

  const expandAllPushGroups = useCallback((callback) => {
    // This sets the group state once, then unsets it in the callback.  This
    // has the result of triggering an expand on all the groups, but then
    // gives control back to each group to decide to expand or not.
    setPushGroupState('expanded');
    setTimeout(() => {
      setPushGroupState('collapsed');
      callback();
    }, 0);
  }, []);

  const showUpdateNotifications = useCallback(() => {
    if (
      !notificationSupported ||
      Notification.permission !== 'granted' ||
      watched === 'none'
    ) {
      return;
    }

    const lastCounts = prevJobCounts.current;
    if (jobCounts) {
      const lastUncompleted = lastCounts.pending + lastCounts.running;
      const nextUncompleted = jobCounts.pending + jobCounts.running;

      const lastCompleted = lastCounts.completed;
      const nextCompleted = jobCounts.completed;

      let message;
      if (lastUncompleted > 0 && nextUncompleted === 0) {
        message = 'Push completed';
        setWatched('none');
      } else if (watched === 'job' && lastCompleted < nextCompleted) {
        const completeCount = nextCompleted - lastCompleted;
        message = `${completeCount} jobs completed`;
      }

      if (message) {
        const notification = new Notification(message, {
          body: `${currentRepo.name} rev ${push.revision.substring(0, 12)}`,
          tag: push.id,
        });

        notification.onerror = (event) => {
          notify(`${event.target.title}: ${event.target.body}`, 'danger');
        };

        notification.onclick = (event) => {
          if (containerRef.current) {
            containerRef.current.scrollIntoView();
            event.target.close();
          }
        };
      }
    }
  }, [
    notificationSupported,
    watched,
    jobCounts,
    currentRepo.name,
    push.revision,
    push.id,
    notify,
  ]);

  const showRunnableJobs = useCallback(async () => {
    try {
      const runJobList = await RunnableJobModel.getList(currentRepo, {
        decisionTask: decisionTaskMap[push.id],
        push_id: push.id,
      });

      if (runJobList.length === 0) {
        notify('No new jobs available');
      }
      mapPushJobs(runJobList, true);
      setRunnableVisible(runJobList.length > 0);
    } catch (error) {
      notify(
        `Error fetching runnable jobs: Failed to fetch task ID (${error})`,
        'danger',
      );
    }
  }, [currentRepo, decisionTaskMap, push.id, mapPushJobs, notify]);

  const hideRunnableJobs = useCallback(() => {
    const newJobList = jobListRef.current.filter(
      (job) => job.state !== 'runnable',
    );

    setRunnableVisible(false);
    setSelectedRunnableJobs([]);
    setJobList(newJobList);
    jobListRef.current = newJobList;
    mapPushJobs(newJobList);
  }, [mapPushJobs]);

  const showFuzzyJobs = useCallback(async () => {
    const createRegExp = (str, opts) =>
      new RegExp(str.raw[0].replace(/\s/gm, ''), opts || '');
    const excludedJobNames = createRegExp`
      (balrog|beetmover|bouncer-locations-firefox|build-docker-image|build-(.+)-nightly|
      build-(.+)-upload-symbols|checksums|cron-bouncer|dmd|fetch|google-play-strings|
      push-to-release|mar-signing|nightly|packages|release-bouncer|release-early|
      release-final|release-secondary|release-snap|release-source|release-update|
      repackage-l10n|repo-update|searchfox|sign-and-push|test-(.+)-devedition|
      test-linux(32|64)(-asan|-pgo|-qr)?\/(opt|debug)-jittest|test-macosx64-ccov|
      test-verify|test-windows10-64-ux|toolchain|upload-generated-sources)`;

    try {
      notify('Fetching runnable jobs... This could take a while...');
      let fuzzyList = await RunnableJobModel.getList(currentRepo, {
        decisionTask: decisionTaskMap[push.id],
      });
      fuzzyList = [
        ...new Set(
          fuzzyList.map((job) => {
            const obj = {};
            obj.name = job.job_type_name;
            obj.symbol = job.job_type_symbol;
            obj.groupsymbol = job.job_group_symbol;
            return obj;
          }),
        ),
      ].sort((a, b) => (a.name > b.name ? 1 : -1));
      const filteredList = fuzzyList.filter(
        (job) => job.name.search(excludedJobNames) < 0,
      );
      setFuzzyJobList(fuzzyList);
      setFilteredFuzzyList(filteredList);
      setFuzzyModal(true);
    } catch (error) {
      notify(
        `Error fetching runnable jobs: Failed to fetch task ID (${error})`,
        'danger',
      );
    }
  }, [currentRepo, decisionTaskMap, push.id, notify]);

  const cycleWatchState = useCallback(async () => {
    if (!notificationSupported) {
      return;
    }

    let next = watchCycleStates[watchCycleStates.indexOf(watched) + 1];

    if (next !== 'none' && Notification.permission !== 'granted') {
      const result = await Notification.requestPermission();

      if (result === 'denied') {
        notify('Notification permission denied', 'danger');

        next = 'none';
      }
    }
    setWatched(next);
  }, [notificationSupported, watched, notify]);

  const toggleFuzzyModal = useCallback(() => {
    setFuzzyModal((prev) => !prev);
  }, []);

  const pushHealthStatusCallback = useCallback((status) => {
    setPushHealthStatus(status);
  }, []);

  // componentDidMount
  useEffect(() => {
    const allParams = getAllUrlParams();
    const promises = [];

    if (!allParams.has('nojobs')) {
      promises.push(fetchJobs());
    }
    if (allParams.has('test_paths')) {
      promises.push(fetchTestManifests());
    }

    Promise.all(promises).then(() => {
      testForFilteredTry();
    });

    window.addEventListener(thEvents.applyNewJobs, handleApplyNewJobs);

    return () => {
      window.removeEventListener(thEvents.applyNewJobs, handleApplyNewJobs);
    };
  }, [handleApplyNewJobs]);

  // componentDidUpdate - show notifications
  useEffect(() => {
    showUpdateNotifications();
    prevJobCounts.current = jobCounts;
  }, [jobCounts, showUpdateNotifications]);

  // componentDidUpdate - test for filtered try
  useEffect(() => {
    testForFilteredTry();
  }, [testForFilteredTry]);

  // componentDidUpdate - handle URL changes
  useEffect(() => {
    if (prevRouterSearch.current !== router.location.search) {
      handleUrlChanges();
      prevRouterSearch.current = router.location.search;
    }
  }, [router.location.search, handleUrlChanges]);

  const {
    id,
    push_timestamp: pushTimestamp,
    revision,
    revisions,
    revision_count: revisionCount,
    author,
  } = push;
  const tipRevision = push.revisions[0];
  const decisionTask = decisionTaskMap[push.id];
  const decisionTaskId = decisionTask ? decisionTask.id : null;
  const showPushHealthSummary =
    filteredTryPush &&
    (pushHealthVisibility === 'All' ||
      currentRepo.name === pushHealthVisibility.toLowerCase());

  if (isOnlyRevision) {
    setSingleRevisionWindowTitle();
  }

  return (
    <div className="push" data-testid={`push-${push.id}`} ref={containerRef}>
      <FuzzyJobFinder
        isOpen={fuzzyModal}
        toggle={toggleFuzzyModal}
        jobList={fuzzyJobList}
        filteredJobList={filteredFuzzyList}
        className="fuzzy-modal"
        pushId={id}
        decisionTaskId={decisionTaskId}
        currentRepo={currentRepo}
      />
      <PushHeader
        push={push}
        pushId={id}
        pushTimestamp={pushTimestamp}
        author={author}
        revision={revision}
        jobCounts={jobCounts}
        watchState={watched}
        currentRepo={currentRepo}
        filterModel={filterModel}
        runnableVisible={runnableVisible}
        showRunnableJobs={showRunnableJobs}
        hideRunnableJobs={hideRunnableJobs}
        showFuzzyJobs={showFuzzyJobs}
        cycleWatchState={cycleWatchState}
        expandAllPushGroups={expandAllPushGroups}
        collapsed={collapsed}
        getAllShownJobs={getAllShownJobs}
        selectedRunnableJobs={selectedRunnableJobs}
        notificationSupported={notificationSupported}
        pushHealthVisibility={pushHealthVisibility}
        groupCountsExpanded={groupCountsExpanded}
        pushHealthStatusCallback={pushHealthStatusCallback}
        togglePushCollapsed={togglePushCollapsed}
      />
      <div className="push-body-divider" />
      {!collapsed ? (
        <Row className="push g-1 flex-nowrap ms-5">
          {currentRepo ? (
            <>
              <Col xs={5}>
                <RevisionList
                  revision={revision}
                  revisions={revisions}
                  revisionCount={revisionCount}
                  repo={currentRepo}
                  bugSummaryMap={bugSummaryMap}
                  widthClass="mb-3 ms-4"
                  commitShaClass="font-monospace"
                >
                  {showPushHealthSummary && pushHealthStatus && (
                    <div className="mt-4">
                      <PushHealthSummary
                        healthStatus={pushHealthStatus}
                        revision={revision}
                        repoName={currentRepo.name}
                      />
                    </div>
                  )}
                </RevisionList>
              </Col>
              <Col xs={7} className="job-list job-list-pad">
                <PushJobs
                  push={push}
                  platforms={platforms}
                  repoName={currentRepo.name}
                  filterModel={filterModel}
                  pushGroupState={pushGroupState}
                  toggleSelectedRunnableJob={toggleSelectedRunnableJob}
                  runnableVisible={runnableVisible}
                  duplicateJobsVisible={duplicateJobsVisible}
                  groupCountsExpanded={groupCountsExpanded}
                />
              </Col>
            </>
          ) : (
            <Col xs={12} className="job-list job-list-pad">
              <PushJobs
                push={push}
                platforms={platforms}
                repoName={currentRepo.name}
                filterModel={filterModel}
                pushGroupState={pushGroupState}
                toggleSelectedRunnableJob={toggleSelectedRunnableJob}
                runnableVisible={runnableVisible}
                duplicateJobsVisible={duplicateJobsVisible}
                groupCountsExpanded={groupCountsExpanded}
              />
            </Col>
          )}
        </Row>
      ) : (
        <Row className="push revision-list">
          <Col xs={12}>
            <ul className="list-unstyled">
              <Revision
                revision={tipRevision}
                repo={currentRepo}
                key={tipRevision.revision}
                commitShaClass="font-monospace"
              />
            </ul>
          </Col>
        </Row>
      )}
    </div>
  );
}

Push.propTypes = {
  push: PropTypes.shape({}).isRequired,
  currentRepo: PropTypes.shape({
    name: PropTypes.string,
  }).isRequired,
  filterModel: PropTypes.shape({}).isRequired,
  notificationSupported: PropTypes.bool.isRequired,
  getAllShownJobs: PropTypes.func.isRequired,
  updateJobMap: PropTypes.func.isRequired,
  recalculateUnclassifiedCounts: PropTypes.func.isRequired,
  allUnclassifiedFailureCount: PropTypes.number.isRequired,
  duplicateJobsVisible: PropTypes.bool.isRequired,
  groupCountsExpanded: PropTypes.bool.isRequired,
  notify: PropTypes.func.isRequired,
  isOnlyRevision: PropTypes.bool.isRequired,
  pushHealthVisibility: PropTypes.string.isRequired,
  decisionTaskMap: PropTypes.shape({}).isRequired,
  bugSummaryMap: PropTypes.shape({}).isRequired,
};

const mapStateToProps = ({
  pushes: { allUnclassifiedFailureCount, decisionTaskMap, bugSummaryMap },
  router,
}) => ({
  allUnclassifiedFailureCount,
  decisionTaskMap,
  bugSummaryMap,
  router,
});

export { Push as PushClass };

export default connect(mapStateToProps, {
  notify,
  updateJobMap,
  recalculateUnclassifiedCounts,
})(memo(Push));
