import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBug, faStar } from '@fortawesome/free-solid-svg-icons';
import Markdown from 'react-markdown';

import { getBtnClass } from '../helpers/job';
import {
  bzBaseUrl,
  getJobsUrl,
  getLogViewerUrl,
  getArtifactsUrl,
} from '../helpers/url';
import { getData } from '../helpers/http';
import logviewerIcon from '../img/logviewerIcon.png';
import { formatArtifacts } from '../helpers/display';

class UnsupportedJob extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      errorSummary: null,
    };
  }

  componentDidMount() {
    this.fetchErrorSummary();
  }

  fetchErrorSummary = async () => {
    const { job, currentRepo } = this.props;

    const params = {
      jobId: job.id,
      taskId: job.task_id,
      run: job.run_id,
      rootUrl: currentRepo.tc_root_url,
    };
    const jobArtifactsUrl = getArtifactsUrl(params);
    const { data, failureStatus } = await getData(jobArtifactsUrl);

    if (!failureStatus && data.artifacts) {
      const errorSummaryLog = data.artifacts.filter((item) =>
        item.name.endsWith('_errorsummary.log'),
      );

      if (errorSummaryLog.length) {
        const errorSummary = formatArtifacts(errorSummaryLog, params);

        this.setState({
          errorSummary: errorSummary[0],
        });
      }
    }
  };

  render() {
    const { job, jobName, jobSymbol, currentRepo, revision } = this.props;
    const { errorSummary } = this.state;
    const {
      id,
      result,
      failure_classification_id: failureClassificationId,
    } = job;

    return (
      <span className="mr-2" key={id}>
        <a
          className={`btn job-btn filter-shown btn-sm mt-1 ${getBtnClass(
            result,
            failureClassificationId,
          )}`}
          href={getJobsUrl({
            selectedJob: job.id,
            repo: currentRepo.name,
            revision,
          })}
          title={jobName}
        >
          {jobSymbol}
        </a>
        {failureClassificationId !== 1 && (
          <FontAwesomeIcon icon={faStar} title="Classified" />
        )}
        {job.result === 'testfailed' && (
          <a
            className="logviewer-btn m-2"
            href={getLogViewerUrl(job.id, currentRepo.name)}
            target="_blank"
            rel="noopener noreferrer"
            title="Open the Log Viewer for this job"
          >
            <img
              style={{ height: '18px' }}
              alt="Logviewer"
              src={logviewerIcon}
              className="logviewer-icon text-dark mb-1"
            />
          </a>
        )}
        <a
          className="mr-2"
          href={`${bzBaseUrl}/enter_bug.cgi`}
          target="_blank"
          rel="noopener noreferrer"
          title="file a bug for this failure"
        >
          <FontAwesomeIcon
            icon={faBug}
            title="File bug"
            className="text-dark"
          />
        </a>
        {errorSummary ? (
          <a href={errorSummary.url} target="_blank" rel="noopener noreferrer">
            {errorSummary.value}
          </a>
        ) : (
          <Markdown>No ``*_errorsummary.log`` exists for this task.</Markdown>
        )}
      </span>
    );
  }
}

UnsupportedJob.propTypes = {
  job: PropTypes.shape({
    id: PropTypes.number.isRequired,
    result: PropTypes.string.isRequired,
    failure_classification_id: PropTypes.number.isRequired,
  }).isRequired,
  jobName: PropTypes.string.isRequired,
  jobSymbol: PropTypes.string.isRequired,
  currentRepo: PropTypes.shape({}).isRequired,
  revision: PropTypes.string.isRequired,
};

export default UnsupportedJob;
