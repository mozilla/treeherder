import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faStar } from '@fortawesome/free-solid-svg-icons';

import { getBtnClass } from '../helpers/job';
import { getJobsUrl, getLogViewerUrl } from '../helpers/url';
import logviewerIcon from '../img/logviewerIcon.png';

class Job extends PureComponent {
  render() {
    const { job, jobName, jobSymbol, repo, revision } = this.props;
    const {
      id,
      result,
      state,
      failure_classification_id: failureClassificationId,
    } = job;
    const resultStatus = state === 'completed' ? result : state;

    return (
      <span className="mr-2" key={id}>
        <a
          className={`btn job-btn filter-shown btn-sm mt-1 ${getBtnClass(
            result,
            failureClassificationId,
          )} border`}
          href={getJobsUrl({ selectedJob: job.id, repo, revision })}
          title={`${jobName} - ${resultStatus}`}
        >
          {jobSymbol}
        </a>
        {failureClassificationId !== 1 && (
          <FontAwesomeIcon icon={faStar} title="Classified" />
        )}
        {job.result === 'testfailed' && (
          <a
            className="logviewer-btn"
            href={getLogViewerUrl(job.id, repo)}
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
      </span>
    );
  }
}

Job.propTypes = {
  job: PropTypes.shape({
    id: PropTypes.number.isRequired,
    result: PropTypes.string.isRequired,
    failure_classification_id: PropTypes.number.isRequired,
  }).isRequired,
  jobName: PropTypes.string.isRequired,
  jobSymbol: PropTypes.string.isRequired,
  repo: PropTypes.string.isRequired,
  revision: PropTypes.string.isRequired,
};

export default Job;
