import React from 'react';
import PropTypes from 'prop-types';

import { getInspectTaskUrl } from '../helpers/url';
import { getSearchStr, getJobSearchStrHref } from '../helpers/job';
import { toDateStr } from '../helpers/display';

const getTimeFields = function getTimeFields(job) {
  // time fields to show in detail panel, but that should be grouped together
  const { end_timestamp, start_timestamp, submit_timestamp } = job;
  const timeFields = [
    { title: 'Requested', value: toDateStr(submit_timestamp) },
  ];

  // If start time is 0, then duration should be from requesttime to now
  // If we have starttime and no endtime, then duration should be starttime to now
  // If we have both starttime and endtime, then duration will be between those two
  const endtime = end_timestamp || Date.now() / 1000;
  const starttime = start_timestamp || submit_timestamp;
  const duration = `${Math.round((endtime - starttime) / 60, 0)} minute(s)`;

  if (start_timestamp) {
    timeFields.push({ title: 'Started', value: toDateStr(start_timestamp) });
  }
  if (end_timestamp) {
    timeFields.push({ title: 'Ended', value: toDateStr(end_timestamp) });
  }
  timeFields.push({
    title: 'Duration',
    value: start_timestamp ? duration : `Not started (queued for ${duration})`,
  });

  return timeFields;
};

export default class JobInfo extends React.PureComponent {
  render() {
    const { job, extraFields, showJobFilters } = this.props;
    const jobSearchStr = getSearchStr(job);
    const timeFields = getTimeFields(job);

    return (
      <ul id="job-info" className="list-unstyled">
        <li className="small">
          <strong>Job: </strong>
          {showJobFilters ? (
            <React.Fragment>
              <a
                title="Filter jobs with this unique SHA signature"
                href={getJobSearchStrHref(job.signature)}
              >
                (sig)
              </a>
              :&nbsp;
              <a
                title="Filter jobs containing these keywords"
                href={getJobSearchStrHref(jobSearchStr)}
              >
                {jobSearchStr}
              </a>
            </React.Fragment>
          ) : (
            <span>{job.getTitle()}</span>
          )}
        </li>
        {job.taskcluster_metadata && (
          <li className="small">
            <strong>Task: </strong>
            <a
              id="taskInfo"
              href={getInspectTaskUrl(job.taskcluster_metadata.task_id)}
              target="_blank"
              rel="noopener noreferrer"
            >
              {job.taskcluster_metadata.task_id}
            </a>
          </li>
        )}
        <li className="small">
          <strong>Build: </strong>
          <span>{`${job.build_architecture} ${
            job.build_platform
          } ${job.build_os || ''}`}</span>
        </li>
        <li className="small">
          <strong>Job name: </strong>
          <span>{job.job_type_name}</span>
        </li>
        {[...timeFields, ...extraFields].map(field => (
          <li className="small" key={`${field.title}${field.value}`}>
            <strong>{field.title}: </strong>
            {field.url ? (
              <a
                title={field.value}
                href={field.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {field.value}
              </a>
            ) : (
              <span>{field.value}</span>
            )}
          </li>
        ))}
      </ul>
    );
  }
}

JobInfo.propTypes = {
  job: PropTypes.object.isRequired,
  extraFields: PropTypes.arrayOf(
    PropTypes.shape({
      title: PropTypes.string.isRequired,
      url: PropTypes.string,
      value: PropTypes.string,
    }),
  ),
  showJobFilters: PropTypes.bool,
};

JobInfo.defaultProps = {
  extraFields: [],
  showJobFilters: true,
};
