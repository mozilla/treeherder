import React from 'react';
import { hot } from 'react-hot-loader/root';
import { LazyLog } from 'react-lazylog';
import isEqual from 'lodash/isEqual';
import uniqBy from 'lodash/uniqBy';

import { getAllUrlParams, getUrlParam, setUrlParam } from '../helpers/location';
import { scrollToLine } from '../helpers/utils';
import { isReftest } from '../helpers/job';
import { getJobsUrl, getReftestUrl, getArtifactsUrl } from '../helpers/url';
import { getData } from '../helpers/http';
import JobDetailModel from '../models/jobDetail';
import JobModel from '../models/job';
import PushModel from '../models/push';
import TextLogStepModel from '../models/textLogStep';
import JobDetails from '../shared/JobDetails';
import JobInfo from '../shared/JobInfo';
import RepositoryModel from '../models/repository';
import { formatArtifacts } from '../helpers/display';

import Navigation from './Navigation';
import ErrorLines from './ErrorLines';

const getUrlLineNumber = function getUrlLineNumber() {
  const lineNumberParam = getUrlParam('lineNumber');

  if (lineNumberParam) {
    return lineNumberParam.split('-').map(line => parseInt(line, 10));
  }
  return null;
};

const errorLinesCss = function errorLinesCss(errors) {
  const style = document.createElement('style');
  const rule = errors
    .map(({ lineNumber }) => `a[id="${lineNumber}"]+span`)
    .join(',')
    .concat('{background:#fbe3e3;color:#a94442}');

  style.type = 'text/css';
  document.getElementsByTagName('head')[0].appendChild(style);
  style.sheet.insertRule(rule);
};

class App extends React.PureComponent {
  constructor(props) {
    super(props);
    const queryString = getAllUrlParams();

    this.state = {
      rawLogUrl: '',
      reftestUrl: '',
      jobExists: true,
      jobError: '',
      revision: null,
      errors: [],
      highlight: getUrlLineNumber(),
      repoName: queryString.get('repo'),
      jobId: queryString.get('job_id'),
      jobUrl: null,
      currentRepo: null,
    };
  }

  componentDidMount() {
    const { repoName, jobId } = this.state;

    const repoPromise = RepositoryModel.getList();
    const jobPromise = JobModel.get(repoName, jobId);

    Promise.all([repoPromise, jobPromise])
      .then(async ([repos, job]) => {
        const currentRepo = repos.find(repo => repo.name === repoName);

        // set the title of  the browser window/tab
        document.title = job.title;
        const rawLogUrl = job.logs && job.logs.length ? job.logs[0].url : null;
        // other properties, in order of appearance
        // Test to disable successful steps checkbox on taskcluster jobs
        // Test to expose the reftest button in the logviewer actionbar
        const reftestUrl =
          rawLogUrl && job.job_group_name && isReftest(job)
            ? getReftestUrl(rawLogUrl)
            : null;

        const jobDetails = await JobDetailModel.getJobDetails({
          job_id: jobId,
        });

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
            const url = getArtifactsUrl(params);
            const jobArtifactsPromise = getData(url);
            const pushPromise = PushModel.get(job.push_id);

            Promise.all([jobArtifactsPromise, pushPromise]).then(
              async ([artifactsResp, pushResp]) => {
                const { revision } = await pushResp.json();
                const jobArtifacts =
                  !artifactsResp.failureStatus && artifactsResp.data.artifacts
                    ? formatArtifacts(artifactsResp.data.artifacts, params)
                    : [];

                // remove duplicates since the jobdetails endpoint will still
                // contain uploaded artifacts until 4 months after we stop storing them
                // see bug 1603249 for details; can be removed at some point
                const mergedJobDetails = uniqBy(
                  [...jobArtifacts, ...jobDetails],
                  'value',
                );

                this.setState({
                  revision,
                  jobUrl: getJobsUrl({
                    repo: repoName,
                    revision,
                    selectedJob: jobId,
                  }),
                  jobDetails: mergedJobDetails,
                });
              },
            );
          },
        );
      })
      .catch(error => {
        this.setState({
          jobExists: false,
          jobError: error.toString(),
        });
      });

    TextLogStepModel.get(jobId).then(textLogSteps => {
      const stepErrors = textLogSteps.length ? textLogSteps[0].errors : [];
      const errors = stepErrors.map(error => ({
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
    });
  }

  onHighlight = range => {
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

  setSelectedLine = (highlight, scrollToTop) => {
    this.setState({ highlight }, () => {
      this.updateQuery({ highlight });
      if (highlight && scrollToTop) {
        this.scrollHighlightToTop(highlight);
      }
    });
  };

  scrollHighlightToTop = highlight => {
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
        />
        {job && (
          <div className="d-flex flex-column flex-fill">
            <div className="run-data d-flex flex-row border-bottom border-secondary mx-1 mb-2">
              <div className="d-flex flex-column job-data-panel">
                <JobInfo
                  job={job}
                  extraFields={extraFields}
                  revision={revision}
                  className="list-unstyled"
                  showJobFilters={false}
                  currentRepo={currentRepo}
                />
                <JobDetails jobDetails={jobDetails} />
              </div>
              <ErrorLines errors={errors} onClickLine={this.setSelectedLine} />
            </div>
            <div className="log-contents flex-fill">
              <LazyLog
                url={rawLogUrl}
                scrollToLine={highlight ? highlight[0] : 0}
                highlight={highlight}
                selectableLines
                onHighlight={this.onHighlight}
                onLoad={() => this.scrollHighlightToTop(highlight)}
                highlightLineClassName="yellow-highlight"
                rowHeight={13}
                extraLines={3}
              />
            </div>
          </div>
        )}
      </div>
    );
  }
}

export default hot(App);
