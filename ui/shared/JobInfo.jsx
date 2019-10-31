import React from 'react';
import PropTypes from 'prop-types';

import { getInspectTaskUrl } from '../helpers/url';
import { getJobSearchStrHref } from '../helpers/job';
import { toDateStr } from '../helpers/display';

const getTimeFields = function getTimeFields(job) {
  // time fields to show in detail panel, but that should be grouped together
  const { endTimestamp, startTimestamp, submitTimestamp, duration } = job;
  const durationStr = `${duration} minute${duration > 1 ? 's' : ''}`;
  const timeFields = [
    { title: 'Requested', value: toDateStr(submitTimestamp) },
  ];

  if (startTimestamp) {
    timeFields.push({ title: 'Started', value: toDateStr(startTimestamp) });
  }
  if (endTimestamp) {
    timeFields.push({ title: 'Ended', value: toDateStr(endTimestamp) });
  }
  timeFields.push({
    title: 'Duration',
    value: startTimestamp
      ? durationStr
      : `Not started (queued for ${durationStr})`,
  });

  return timeFields;
};

export default class JobInfo extends React.PureComponent {
  render() {
    const { job, extraFields, showJobFilters } = this.props;
    const {
      signature,
      title,
      taskID,
      buildPlatform,
      jobTypeName,
      buildArchitecture,
      buildOS,
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
        {taskID && (
          <li className="small">
            <strong>Task: </strong>
            <a
              id="taskInfo"
              href={getInspectTaskUrl(taskID)}
              target="_blank"
              rel="noopener noreferrer"
            >
              {taskID}
            </a>
          </li>
        )}
        <li className="small">
          <strong>Build: </strong>
          <span>{`${buildArchitecture} ${buildPlatform} ${buildOS ||
            ''}`}</span>
        </li>
        <li className="small">
          <strong>Job name: </strong>
          <span>{jobTypeName}</span>
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
