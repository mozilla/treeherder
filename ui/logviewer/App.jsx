import React from 'react';
import { hot } from 'react-hot-loader/root';
import { LazyLog } from 'react-lazylog';
import isEqual from 'lodash/isEqual';

import {
  getAllUrlParams,
  getUrlParam,
  setUrlParam,
  getProjectJobUrl,
} from '../helpers/location';
import { scrollToLine } from '../helpers/utils';
import { isReftest } from '../helpers/job';
import {
  getJobsUrl,
  getReftestUrl,
  getArtifactsUrl,
  textLogErrorsEndpoint,
  getPerfAnalysisUrl,
  isResourceUsageProfile,
} from '../helpers/url';
import formatLogLineWithLinks from '../helpers/logFormatting';
import { getData } from '../helpers/http';
import JobModel from '../models/job';
import PushModel from '../models/push';
import JobArtifacts from '../shared/JobArtifacts';
import JobInfo from '../shared/JobInfo';
import RepositoryModel from '../models/repository';
import { formatArtifacts, errorLinesCss } from '../helpers/display';

import Navigation from './Navigation';
import ErrorLines from './ErrorLines';

import '../css/lazylog-custom-styles.css';
import './logviewer.css';

const JOB_DETAILS_COLLAPSED = 'jobDetailsCollapsed';

const getUrlLineNumber = function getUrlLineNumber() {
  const lineNumberParam = getUrlParam('lineNumber');

  if (lineNumberParam) {
    return lineNumberParam.split('-').map((line) => parseInt(line, 10));
  }
  return null;
};

class App extends React.PureComponent {
  constructor(props) {
    super(props);
    const queryString = getAllUrlParams();
    const collapseDetails = localStorage.getItem(JOB_DETAILS_COLLAPSED);

    this.state = {
      rawLogUrl: '',
      reftestUrl: '',
      jobExists: true,
      jobError: '',
      revision: null,
      errors: [],
      collapseDetails:
        collapseDetails !== null ? JSON.parse(collapseDetails) : true,
      highlight: getUrlLineNumber(),
      repoName: queryString.get('repo'),
      jobId: queryString.get('job_id'),
      jobUrl: null,
      currentRepo: null,
      jobDetails: [],
    };
  }

  startArtifactsRequests = (taskId, run, rootUrl, repoName) => {
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

  componentWillUnmount() {
    window.removeEventListener('keydown', this.handleKeyDown);
  }

  handleKeyDown = (event) => {
    const { rawLogUrl, jobDetails, job } = this.state;

    // Ignore if user is typing in an input field
    if (
      event.target.tagName === 'INPUT' ||
      event.target.tagName === 'TEXTAREA'
    ) {
      return;
    }

    // Shift+L - Open raw log
    if (event.shiftKey && event.key === 'L') {
      event.preventDefault();
      if (rawLogUrl) {
        window.open(rawLogUrl, '_blank');
      }
      return;
    }

    // G - Open resource usage profile in profiler
    if (event.key === 'g') {
      event.preventDefault();
      const resourceUsageProfile = jobDetails.find((artifact) =>
        isResourceUsageProfile(artifact.value),
      );
      if (resourceUsageProfile) {
        window.open(
          getPerfAnalysisUrl(resourceUsageProfile.url, job),
          '_blank',
        );
      }
    }
  };

  async componentDidMount() {
    window.addEventListener('keydown', this.handleKeyDown);

    const { repoName, jobId } = this.state;

    const repoPromise = RepositoryModel.getList();
    const jobPromise = JobModel.get(repoName, jobId);
    let artifactsPromises;

    // Start loading the log file and the artifacts early if the task parameter
    // was provided.
    const taskParam = getAllUrlParams().get('task');
    if (taskParam) {
      const [taskId, run] = taskParam.split('.');
      if (taskId && run !== undefined) {
        // Construct log URL early and set in state
        const earlyRawLogUrl = `https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/${taskId}/runs/${run}/artifacts/public/logs/live_backing.log`;
        this.setState({ rawLogUrl: earlyRawLogUrl });

        // Start artifacts requests in parallel
        artifactsPromises = this.startArtifactsRequests(
          taskId,
          run,
          'https://firefox-ci-tc.services.mozilla.com',
          repoName,
        );
      }
    }

    Promise.all([repoPromise, jobPromise])
      .then(async ([repos, job]) => {
        const currentRepo = repos.find((repo) => repo.name === repoName);
        const pushPromise = PushModel.get(job.push_id);

        // set the title of  the browser window/tab
        document.title = job.searchStr;
        // This can be later changed to live_backing_log once all of the old logs
        // called builds-4h are removed
        const log =
          job.logs && job.logs.length
            ? job.logs.find((log) => log.name !== 'errorsummary_json')
            : null;
        const rawLogUrl = log.url;
        // other properties, in order of appearance
        // Test to disable successful steps checkbox on taskcluster jobs
        // Test to expose the reftest button in the logviewer actionbar
        const reftestUrl =
          rawLogUrl && job.job_group_name && isReftest(job)
            ? getReftestUrl(rawLogUrl)
            : null;

        const newState = {
          job,
          reftestUrl,
          jobExists: true,
          currentRepo,
        };

        // Update rawLogUrl if it's different
        if (rawLogUrl !== this.state.rawLogUrl) {
          newState.rawLogUrl = rawLogUrl;
        }

        this.setState(newState);

        // Start artifacts requests if we didn't do it early
        if (!artifactsPromises) {
          artifactsPromises = this.startArtifactsRequests(
            job.task_id,
            job.retry_id,
            currentRepo.tc_root_url,
            currentRepo.name,
          );
        }

        // Handle artifacts independently of push request
        Promise.all([
          artifactsPromises.jobArtifactsPromise,
          artifactsPromises.builtFromArtifactPromise,
        ]).then(([artifactsResp, builtFromArtifactResp]) => {
          const params = {
            taskId: job.task_id,
            run: job.retry_id,
            rootUrl: currentRepo.tc_root_url,
          };

          let jobDetails =
            !artifactsResp.failureStatus && artifactsResp.data.artifacts
              ? formatArtifacts(artifactsResp.data.artifacts, params)
              : [];

          if (builtFromArtifactResp && !builtFromArtifactResp.failureStatus) {
            jobDetails = [...jobDetails, ...builtFromArtifactResp.data];
          }

          this.setState({ jobDetails });
        });

        // Handle push request separately
        pushPromise.then(async (pushResp) => {
          const { revision } = await pushResp.json();
          const selectedTaskRun =
            job.task_id && job.retry_id !== undefined
              ? `${job.task_id}.${job.retry_id}`
              : null;
          this.setState({
            revision,
            jobUrl: getJobsUrl({
              repo: repoName,
              revision,
              selectedTaskRun,
            }),
          });
        });
      })
      .catch((error) => {
        this.setState({
          jobExists: false,
          jobError: error.toString(),
        });
      });

    const { data, failureStatus } = await getData(
      getProjectJobUrl(textLogErrorsEndpoint, jobId),
    );

    if (!failureStatus && data.length) {
      const errors = data.map((error) => ({
        line: error.line,
        lineNumber: error.line_number + 1,
      }));
      const firstErrorLineNumber = errors.length
        ? [errors[0].lineNumber]
        : null;
      const urlLN = getUrlLineNumber();
      const highlight = urlLN || firstErrorLineNumber;

      errorLinesCss(errors);
      this.setState({ errors });
      this.setSelectedLine(highlight, true);
    }
  }

  onHighlight = (range) => {
    const { highlight } = this.state;
    const { _start, _end, size } = range;
    // We can't use null to represent "no highlight", due to:
    // https://github.com/mozilla-frontend-infra/react-lazylog/issues/22
    let newHighlight = -1;

    if (size === 1) {
      newHighlight = [_start];
    } else if (size > 1) {
      newHighlight = [_start, _end - 1];
    }
    if (!isEqual(newHighlight, highlight)) {
      this.setSelectedLine(newHighlight);
    }
  };

  copySelectedLogToBugFiler = () => {
    let selectedLogText;
    if (
      document
        .querySelector('.log-contents')
        .contains(window.getSelection().anchorNode) &&
      window.getSelection().toString().trim()
    ) {
      // Use selection
      selectedLogText = window.getSelection().toString().trim();
    }

    const descriptionField = window.opener.document.getElementById(
      'summary-input',
    );
    const startPos = descriptionField.selectionStart;
    const endPos = descriptionField.selectionEnd;
    descriptionField.value =
      descriptionField.value.substring(0, startPos) +
      selectedLogText +
      descriptionField.value.substring(endPos, descriptionField.value.length);
    descriptionField.selectionStart = startPos + selectedLogText.length;
    descriptionField.selectionEnd = startPos + selectedLogText.length;

    const event = document.createEvent('HTMLEvents');
    event.initEvent('change', true, true);
    descriptionField.dispatchEvent(event);
  };

  collapseJobDetails = () => {
    const { collapseDetails } = this.state;

    this.setState(
      {
        collapseDetails: !collapseDetails,
      },
      () => {
        localStorage.setItem(JOB_DETAILS_COLLAPSED, !collapseDetails);
      },
    );
  };

  setSelectedLine = (highlight, scrollToTop) => {
    this.setState({ highlight }, () => {
      this.updateQuery({ highlight });
      if (highlight && scrollToTop) {
        this.scrollHighlightToTop(highlight);
      }
    });
  };

  scrollHighlightToTop = (highlight) => {
    const lineAtTop = highlight && highlight[0] > 7 ? highlight[0] - 7 : 0;

    scrollToLine(`a[id="${lineAtTop}"]`).catch(() => {
      // Silently handle cases where the line is not found
    });
  };

  updateQuery = () => {
    const { highlight } = this.state;

    if (highlight < 1) {
      setUrlParam('lineNumber', null);
    } else if (highlight.length > 1) {
      setUrlParam('lineNumber', `${highlight[0]}-${highlight[1]}`);
    } else {
      setUrlParam('lineNumber', highlight[0]);
    }
  };

  // This script has been borrowed from https://github.com/gregtatum/scripts/blob/master/mochitest-formatter/from-talos-log.js
  logFormatter = (line) => {
    let color = null;
    if (
      /INFO - GECKO\(\d+\)/.test(line) ||
      /INFO - TEST-UNEXPECTED-FAIL/.test(line)
    ) {
      // Do nothing
    } else if (/INFO - TEST-(OK)|(PASS)/.test(line)) color = '#3B7A3B';
    else if (/INFO - TEST-START/.test(line)) color = 'blue';
    else if (/INFO - TEST-/.test(line)) color = '#7A7A24';
    else if (/!!!/.test(line)) color = '#985E98';
    else if (/Browser Chrome Test Summary$/.test(line)) color = '#55677A';
    else if (/((INFO -)|([\s]+))(Passed|Failed|Todo):/.test(line))
      color = '#55677A';
    else if (/INFO/.test(line)) color = '#566262';

    // Format line with links (crash viewer, profiler)
    const { job, jobDetails } = this.state;
    return (
      <span style={{ color }}>
        {formatLogLineWithLinks(line, jobDetails, job)}
      </span>
    );
  };

  render() {
    const {
      job,
      rawLogUrl,
      reftestUrl,
      repoName,
      jobDetails,
      jobError,
      jobExists,
      revision,
      errors,
      collapseDetails,
      highlight,
      jobUrl,
      currentRepo,
    } = this.state;
    const extraFields = [
      {
        title: 'Revision',
        url: jobUrl,
        value: revision,
        clipboard: {
          description: 'full hash',
          text: revision,
        },
      },
    ];

    return (
      <div className="d-flex flex-column body-logviewer h-100">
        <Navigation
          jobExists={jobExists}
          result={job ? job.result : ''}
          jobError={jobError}
          rawLogUrl={rawLogUrl}
          reftestUrl={reftestUrl}
          jobUrl={jobUrl}
          collapseDetails={collapseDetails}
          collapseJobDetails={this.collapseJobDetails}
          copySelectedLogToBugFiler={this.copySelectedLogToBugFiler}
          job={job}
          jobDetails={jobDetails}
        />
        <div className="d-flex flex-column flex-fill">
          {!collapseDetails && (
            <div className="run-data d-flex flex-row mx-1 mb-2">
              <div className="d-flex flex-column job-data-panel">
                {job && (
                  <JobInfo
                    job={job}
                    extraFields={extraFields}
                    revision={revision}
                    className="list-unstyled"
                    showJobFilters={false}
                    currentRepo={currentRepo}
                  />
                )}
                <JobArtifacts
                  jobDetails={jobDetails}
                  repoName={repoName}
                  selectedJob={job}
                />
              </div>
              <ErrorLines
                errors={errors}
                onClickLine={this.setSelectedLine}
                jobDetails={jobDetails}
                job={job}
              />
            </div>
          )}
          <div className="log-contents flex-fill">
            {rawLogUrl && (
              <LazyLog
                url={rawLogUrl}
                formatPart={this.logFormatter}
                scrollToLine={highlight ? highlight[0] : 0}
                highlight={highlight}
                selectableLines
                onHighlight={this.onHighlight}
                onLoad={() => this.scrollHighlightToTop(highlight)}
                highlightLineClassName="yellow-highlight"
                rowHeight={13}
                extraLines={3}
                enableSearch
                caseInsensitive
              />
            )}
          </div>
        </div>
      </div>
    );
  }
}

export default hot(App);
