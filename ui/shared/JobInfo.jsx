import React from 'react';
import PropTypes from 'prop-types';

import { getInspectTaskUrl } from '../helpers/url';
import { getJobSearchStrHref } from '../helpers/job';
import { toDateStr } from '../helpers/display';
import { checkRootUrl } from '../taskcluster-auth-callback/constants';

import Clipboard from './Clipboard';

const getTimeFields = function getTimeFields(job) {
  // time fields to show in detail panel, but that should be grouped together
  const {
    end_timestamp: endTimestamp,
    start_timestamp: startTimestamp,
    submit_timestamp: submitTimestamp,
    duration,
  } = job;
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
    const { job, extraFields, showJobFilters, currentRepo } = this.props;
    const {
      signature,
      title,
      task_id: taskId,
      build_platform: buildPlatform,
      job_type_name: jobTypeName,
      build_architecture: buildArchitecture,
      build_os: buildOs,
      submit_timestamp: submitTimestamp,
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
        {taskId && currentRepo && (
          <li className="small">
            <strong>Task: </strong>
            <a
              id="taskInfo"
              href={getInspectTaskUrl(
                taskId,
                checkRootUrl(currentRepo.tc_root_url),
                submitTimestamp,
              )}
              target="_blank"
              rel="noopener noreferrer"
            >
              {taskId}
            </a>
            <Clipboard description="task ID" text={taskId} />
          </li>
        )}
        <li className="small">
          <strong>Build: </strong>
          <span>{`${buildArchitecture} ${buildPlatform} ${buildOs ||
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
            {field.clipboard && (
              <Clipboard
                description={field.clipboard.description}
                text={field.clipboard.text}
              />
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
    PropTypes.exact({
      title: PropTypes.string.isRequired,
      url: PropTypes.string,
      value: PropTypes.string,
      clipboard: PropTypes.exact({
        description: PropTypes.string.isRequired,
        text: PropTypes.string,
      }),
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
