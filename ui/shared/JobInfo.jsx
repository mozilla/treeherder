import React from 'react';
import PropTypes from 'prop-types';

import { getInspectTaskUrl } from '../helpers/url';
import { getJobSearchStrHref } from '../helpers/job';
import { toDateStr } from '../helpers/display';

const getTimeFields = function getTimeFields(job) {
  // time fields to show in detail panel, but that should be grouped together
  const { end_timestamp, start_timestamp, submit_timestamp, duration } = job;
  const durationStr = `${duration} minute${duration > 1 ? 's' : ''}`;
  const timeFields = [
    { title: 'Requested', value: toDateStr(submit_timestamp) },
  ];

  if (start_timestamp) {
    timeFields.push({ title: 'Started', value: toDateStr(start_timestamp) });
  }
  if (end_timestamp) {
    timeFields.push({ title: 'Ended', value: toDateStr(end_timestamp) });
  }
  timeFields.push({
    title: 'Duration',
    value: start_timestamp
      ? durationStr
      : `Not started (queued for ${durationStr})`,
  });

  return timeFields;
};

export default class JobInfo extends React.PureComponent {
  render() {
    const { job, extraFields, showJobFilters, currentRepo } = this.props;
    const {
      signature,
      title,
      task_id,
      build_platform,
      job_type_name,
      build_architecture,
      build_os,
    } = job;
    const timeFields = getTimeFields(job);

    return (
      <ul id="job-info" className="list-unstyled ml-1">
        <li className="small">
          <strong>Job: </strong>
          {showJobFilters ? (
            <React.Fragment>
              <a
                title="Filter jobs with this unique SHA signature"
                href={getJobSearchStrHref(signature)}
              >
                (sig)
              </a>
              :&nbsp;
              <a
                title="Filter jobs containing these keywords"
                href={getJobSearchStrHref(title)}
              >
                {title}
              </a>
            </React.Fragment>
          ) : (
            <span>{title}</span>
          )}
        </li>
        {task_id && currentRepo && (
          <li className="small">
            <strong>Task: </strong>
            <a
              id="taskInfo"
              href={getInspectTaskUrl(task_id, currentRepo.tc_root_url)}
              target="_blank"
              rel="noopener noreferrer"
            >
              {task_id}
            </a>
          </li>
        )}
        <li className="small">
          <strong>Build: </strong>
          <span>{`${build_architecture} ${build_platform} ${build_os ||
            ''}`}</span>
        </li>
        <li className="small">
          <strong>Job name: </strong>
          <span>{job_type_name}</span>
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
  currentRepo: PropTypes.shape({}),
};

JobInfo.defaultProps = {
  extraFields: [],
  showJobFilters: true,
  currentRepo: null,
};
