import React from 'react';
import { hot } from 'react-hot-loader/root';
import { LazyLog } from 'react-lazylog';
import isEqual from 'lodash/isEqual';

import { getAllUrlParams, getUrlParam, setUrlParam } from '../helpers/location';
import { isReftest } from '../helpers/job';
import { getJobsUrl, getReftestUrl } from '../helpers/url';
import JobModel from '../models/job';
import JobDetailModel from '../models/jobDetail';
import PushModel from '../models/push';
import TextLogStepModel from '../models/textLogStep';
import JobDetails from '../shared/JobDetails';
import JobInfo from '../shared/JobInfo';

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
    };
  }

  componentDidMount() {
    const { repoName, jobId } = this.state;

    JobModel.get(repoName, jobId)
      .then(async job => {
        // set the title of the browser window/tab
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
            jobDetails,
            jobExists: true,
          },
          async () => {
            // get the revision and linkify it
            PushModel.get(job.push_id).then(async resp => {
              const push = await resp.json();
              const { revision } = push;

              this.setState({
                revision,
                jobUrl: getJobsUrl({
                  repo: repoName,
                  revision,
                  selectedJob: jobId,
                }),
              });
            });
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

    this.scrollToLine(`a[id="${lineAtTop}"]`, 100);
  };

  scrollToLine = (selector, time, iteration = 0) => {
    const line = document.querySelector(selector);

    if (line !== null) {
      line.scrollIntoView(true);
      return;
    }
    if (iteration < 10) {
      setTimeout(() => this.scrollToLine(selector, time, iteration + 1), time);
    }
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
    } = this.state;
    const extraFields = [
      {
        title: 'Revision',
        url: jobUrl,
        value: revision,
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
