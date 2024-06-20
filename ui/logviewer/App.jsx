import React from 'react';
import { hot } from 'react-hot-loader/root';
import { LazyLog } from 'react-lazylog';
import isEqual from 'lodash/isEqual';
import { Collapse } from 'reactstrap';

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
} from '../helpers/url';
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
    };
  }

  async componentDidMount() {
    const { repoName, jobId } = this.state;

    const repoPromise = RepositoryModel.getList();
    const jobPromise = JobModel.get(repoName, jobId);

    Promise.all([repoPromise, jobPromise])
      .then(async ([repos, job]) => {
        const currentRepo = repos.find((repo) => repo.name === repoName);

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

        this.setState(
          {
            job,
            rawLogUrl,
            reftestUrl,
            jobExists: true,
            currentRepo,
          },
          async () => {
            const params = {
              taskId: job.task_id,
              run: job.retry_id,
              rootUrl: currentRepo.tc_root_url,
            };

            const jobArtifactsPromise = getData(getArtifactsUrl(params));
            let builtFromArtifactPromise;

            if (
              currentRepo.name === 'comm-central' ||
              currentRepo.name === 'try-comm-central'
            ) {
              builtFromArtifactPromise = getData(
                getArtifactsUrl({
                  ...params,
                  ...{ artifactPath: 'public/build/built_from.json' },
                }),
              );
            }
            const pushPromise = PushModel.get(job.push_id);

            Promise.all([
              jobArtifactsPromise,
              pushPromise,
              builtFromArtifactPromise,
            ]).then(
              async ([artifactsResp, pushResp, builtFromArtifactResp]) => {
                const { revision } = await pushResp.json();
                let jobDetails =
                  !artifactsResp.failureStatus && artifactsResp.data.artifacts
                    ? formatArtifacts(artifactsResp.data.artifacts, params)
                    : [];

                if (
                  builtFromArtifactResp &&
                  !builtFromArtifactResp.failureStatus
                ) {
                  jobDetails = [...jobDetails, ...builtFromArtifactResp.data];
                }

                this.setState({
                  revision,
                  jobUrl: getJobsUrl({
                    repo: repoName,
                    revision,
                    selectedJob: jobId,
                  }),
                  jobDetails,
                });
              },
            );
          },
        );
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

    scrollToLine(`a[id="${lineAtTop}"]`, 100);
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
    return <span style={{ color }}>{line}</span>;
  };

  render() {
    const {
      job,
      rawLogUrl,
      reftestUrl,
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
        />
        {job && (
          <div className="d-flex flex-column flex-fill">
            <Collapse isOpen={!collapseDetails}>
              <div className="run-data d-flex flex-row mx-1 mb-2">
                <div className="d-flex flex-column job-data-panel">
                  <JobInfo
                    job={job}
                    extraFields={extraFields}
                    revision={revision}
                    className="list-unstyled"
                    showJobFilters={false}
                    currentRepo={currentRepo}
                  />
                  <JobArtifacts jobDetails={jobDetails} />
                </div>
                <ErrorLines
                  errors={errors}
                  onClickLine={this.setSelectedLine}
                />
              </div>
            </Collapse>
            <div className="log-contents flex-fill">
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
            </div>
          </div>
        )}
      </div>
    );
  }
}

export default hot(App);
