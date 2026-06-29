import { useState, useEffect } from 'react';

import { formatArtifacts } from '../helpers/display';
import { getData } from '../helpers/http';
import { isReftest } from '../helpers/job';
import {
  getArtifactsUrl,
  getJobsUrl,
  getReftestUrl,
} from '../helpers/url';
import { getAllUrlParams } from '../helpers/location';
import JobModel from '../models/job';
import PushModel from '../models/push';
import RepositoryModel from '../models/repository';

const startArtifactsRequests = (taskId, run, rootUrl, repoName) => {
  const params = { taskId, run, rootUrl };
  const jobArtifactsPromise = getData(getArtifactsUrl(params));

  let builtFromArtifactPromise;
  if (repoName === 'comm-central' || repoName === 'try-comm-central') {
    builtFromArtifactPromise = getData(
      getArtifactsUrl({
        ...params,
        artifactPath: 'public/build/built_from.json',
      }),
    );
  }

  return { jobArtifactsPromise, builtFromArtifactPromise };
};

/**
 * Loads everything needed to render the logviewer for a given job:
 * the job itself, its repo, push revision/URL, raw log + reftest URLs,
 * and the job artifacts list. Returns load state via {jobExists, jobError}.
 */
export function useJobData(repoName, jobId) {
  const [job, setJob] = useState(null);
  const [currentRepo, setCurrentRepo] = useState(null);
  const [jobDetails, setJobDetails] = useState([]);
  const [revision, setRevision] = useState(null);
  const [jobUrl, setJobUrl] = useState(null);
  const [rawLogUrl, setRawLogUrl] = useState('');
  const [reftestUrl, setReftestUrl] = useState('');
  const [jobExists, setJobExists] = useState(true);
  const [jobError, setJobError] = useState('');

  useEffect(() => {
    let artifactsPromises;

    // Start loading the log file early if the task parameter was provided
    const taskParam = getAllUrlParams().get('task');
    if (taskParam) {
      const [taskId, run] = taskParam.split('.');
      if (taskId && run !== undefined) {
        const earlyRawLogUrl = `https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/${taskId}/runs/${run}/artifacts/public/logs/live_backing.log`;
        setRawLogUrl(earlyRawLogUrl);

        artifactsPromises = startArtifactsRequests(
          taskId,
          run,
          'https://firefox-ci-tc.services.mozilla.com',
          repoName,
        );
      }
    }

    Promise.all([RepositoryModel.getList(), JobModel.get(repoName, jobId)])
      .then(async ([repos, jobData]) => {
        const repo = repos.find((r) => r.name === repoName);
        const pushPromise = PushModel.get(jobData.push_id);

        document.title = jobData.searchStr;

        const log = jobData.logs?.length
          ? jobData.logs.find((l) => l.name !== 'errorsummary_json')
          : null;
        const logUrl = log.url;
        const reftest =
          logUrl && jobData.job_group_name && isReftest(jobData)
            ? getReftestUrl(logUrl)
            : null;

        setJob(jobData);
        setReftestUrl(reftest);
        setJobExists(true);
        setCurrentRepo(repo);
        setRawLogUrl((prev) => (logUrl !== prev ? logUrl : prev));

        if (!artifactsPromises) {
          artifactsPromises = startArtifactsRequests(
            jobData.task_id,
            jobData.retry_id,
            repo.tc_root_url,
            repo.name,
          );
        }

        Promise.all([
          artifactsPromises.jobArtifactsPromise,
          artifactsPromises.builtFromArtifactPromise,
        ]).then(([artifactsResp, builtFromArtifactResp]) => {
          const params = {
            taskId: jobData.task_id,
            run: jobData.retry_id,
            rootUrl: repo.tc_root_url,
          };

          let details =
            !artifactsResp.failureStatus && artifactsResp.data.artifacts
              ? formatArtifacts(artifactsResp.data.artifacts, params)
              : [];

          if (builtFromArtifactResp && !builtFromArtifactResp.failureStatus) {
            details = [...details, ...builtFromArtifactResp.data];
          }

          setJobDetails(details);
        });

        pushPromise.then(async (pushResp) => {
          const { revision: rev } = await pushResp.json();
          const selectedTaskRun =
            jobData.task_id && jobData.retry_id !== undefined
              ? `${jobData.task_id}.${jobData.retry_id}`
              : null;
          setRevision(rev);
          setJobUrl(
            getJobsUrl({
              repo: repoName,
              revision: rev,
              selectedTaskRun,
            }),
          );
        });
      })
      .catch((error) => {
        setJobExists(false);
        setJobError(error.toString());
      });
  }, [repoName, jobId]);

  return {
    job,
    currentRepo,
    jobDetails,
    revision,
    jobUrl,
    rawLogUrl,
    reftestUrl,
    jobExists,
    jobError,
  };
}
