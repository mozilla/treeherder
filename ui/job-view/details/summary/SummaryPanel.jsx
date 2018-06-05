import _ from 'lodash';
import React from 'react';
import PropTypes from 'prop-types';
import { react2angular } from 'react2angular/index.es2015';

import treeherder from '../../../js/treeherder';
import {
  getSlaveHealthUrl,
  getInspectTaskUrl,
  getWorkerExplorerUrl,
  getJobSearchStrHref,
} from '../../../helpers/url';
import { getSearchStr } from '../../../helpers/job';
import { toDateStr } from '../../../helpers/display';
import ClassificationsPanel from './ClassificationsPanel';
import StatusPanel from './StatusPanel';

function JobDetailsListItem(props) {
  const {
    label, labelHref, labelTitle, labelOnclick, labelTarget, labelText,
    href, text, title, onclick, target, iconClass
  } = props;

  return (
    <li className="small">
      <label>{label}</label>
      {labelHref &&
        <a
          title={labelTitle}
          href={labelHref}
          onClick={labelOnclick}
          target={labelTarget}
          rel="noopener"
        >{labelText} <span className="fa fa-pencil-square-o icon-superscript" />: </a>
      }
      {!href ? <span className="ml-1">{text}</span> :
      <a
        title={title}
        className="ml-1"
        href={href}
        onClick={onclick}
        target={target}
        rel="noopener"
      >{text}</a>
      }
      {iconClass && <span className={`ml-1${iconClass}`} />}
    </li>
  );
}

JobDetailsListItem.propTypes = {
  label: PropTypes.string.isRequired,
  labelHref: PropTypes.string,
  labelTitle: PropTypes.string,
  labelText: PropTypes.string,
  href: PropTypes.string,
  text: PropTypes.string,
  title: PropTypes.string,
  target: PropTypes.string,
  iconClass: PropTypes.string,
  labelOnclick: PropTypes.func,
  labelTarget: PropTypes.string,
  onclick: PropTypes.func,
};

JobDetailsListItem.defaultProps = {
  labelHref: null,
  labelTitle: null,
  labelText: null,
  href: null,
  text: null,
  title: null,
  target: null,
  iconClass: null,
  labelOnclick: null,
  labelTarget: null,
  onclick: null,
};

class JobDetailsList extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      machineUrl: ''
    };
  }

  componentWillReceiveProps(nextProps) {
    if (_.isEmpty(nextProps.job)) {
      return;
    }

    this.setJobMachineUrl(nextProps);
  }

  async setJobMachineUrl(props) {
    let machineUrl = null;

    try {
      machineUrl = await this.getJobMachineUrl(props);
    } catch (err) {
      machineUrl = '';
    }

    if (this.state.machineUrl !== machineUrl) {
      this.setState({ machineUrl });
    }
  }

  getJobMachineUrl(props) {
    const { job } = props;
    const { build_system_type, machine_name } = job;
    const machineUrl = (machine_name !== 'unknown' && build_system_type === 'buildbot') ?
      getSlaveHealthUrl(machine_name) :
      getWorkerExplorerUrl(job.taskcluster_metadata.task_id);

    return machineUrl;
  }

  getTimeFields(job) {
    // time fields to show in detail panel, but that should be grouped together
    const timeFields = {
      requestTime: toDateStr(job.submit_timestamp)
    };

    // If start time is 0, then duration should be from requesttime to now
    // If we have starttime and no endtime, then duration should be starttime to now
    // If we have both starttime and endtime, then duration will be between those two
    const endtime = job.end_timestamp || Date.now() / 1000;
    const starttime = job.start_timestamp || job.submit_timestamp;
    const duration = `${Math.round((endtime - starttime)/60, 0)} minute(s)`;

    if (job.start_timestamp) {
        timeFields.startTime = toDateStr(job.start_timestamp);
        timeFields.duration = duration;
    } else {
        timeFields.duration = `Not started (queued for ${duration})`;
    }

    if (job.end_timestamp) {
        timeFields.endTime = toDateStr(job.end_timestamp);
    }

    return timeFields;
  }

  render() {
    const { job, jobLogUrls } = this.props;
    const timeFields = this.getTimeFields(job);
    const jobMachineName = job.machine_name;
    const jobSearchStr = getSearchStr(job);
    let buildUrl = null;
    let iconCircleClass = null;

    if (job.build_system_type === 'buildbot' && !!jobLogUrls.length) {
      buildUrl = jobLogUrls[0].buildUrl;
    }
    if (job.job_type_description) {
      iconCircleClass = 'fa fa-info-circle';
    }
    return (
      <ul className="list-unstyled content-spacer">
        <JobDetailsListItem
          label="Job"
          labelTitle="Filter jobs with this unique SHA signature"
          labelHref={getJobSearchStrHref(job.signature)}
          labelText="(sig)"
          title="Filter jobs containing these keywords"
          href={getJobSearchStrHref(jobSearchStr)}
          text={jobSearchStr}
        />
        {jobMachineName &&
          <JobDetailsListItem
            label="Machine: "
            text={jobMachineName}
            title="Inspect machine"
            target="_blank"
            href={this.state.machineUrl}
          />
        }
        {job.taskcluster_metadata &&
          <JobDetailsListItem
            label="Task:"
            text={job.taskcluster_metadata.task_id}
            href={getInspectTaskUrl(job.taskcluster_metadata.task_id)}
            target="_blank"
          />
        }
        <JobDetailsListItem
          key="Build"
          label={`Build:`}
          title="Open build directory in a new tab"
          href={buildUrl}
          target="_blank"
          text={`${job.build_architecture} ${job.build_platform} ${job.build_os || ''}`}
          iconClass={iconCircleClass}
        />
        <JobDetailsListItem
          key="Job name"
          label="Job name:"
          title="Open build directory in a new tab"
          href={buildUrl}
          target="_blank"
          text={job.job_type_name}
          iconClass={iconCircleClass}
        />
        {timeFields && <span>
          <JobDetailsListItem
            label="Requested:"
            text={timeFields.requestTime}
          />
          {timeFields.startTime &&
            <JobDetailsListItem
              label="Started:"
              text={timeFields.startTime}
            />
          }
          {timeFields.endTime &&
            <JobDetailsListItem
              label="Ended:"
              text={timeFields.endTime}
            />
          }
          <JobDetailsListItem
            label="Duration:"
            text={timeFields.duration}
          />
        </span>}
        {!jobLogUrls.length ?
          <JobDetailsListItem label="Log parsing status: " text="No logs" /> :
          jobLogUrls.map(data => (
            <JobDetailsListItem
              label="Log parsing status: "
              text={data.parse_status}
              key={data}
            />
          ))
        }
      </ul>
    );
  }
}

JobDetailsList.propTypes = {
  job: PropTypes.object.isRequired,
  jobLogUrls: PropTypes.array,
};

JobDetailsList.defaultProps = {
  jobLogUrls: [],
};

class SummaryPanel extends React.Component {
  constructor(props) {
    super(props);

    const { $injector } = this.props;
    this.dateFilter = $injector.get('$filter')('date');
    this.ThRepositoryModel = $injector.get('ThRepositoryModel');
  }

  render() {
    const {
      jobDetailLoading, job, classificationTypes, repoName,
      jobLogUrls, buildUrl, classification, bugs
    } = this.props;
    return (
      <div>
        {jobDetailLoading &&
          <div className="overlay">
            <div>
              <span className="fa fa-spinner fa-pulse th-spinner-lg" />
            </div>
          </div>
        }
        {classification &&
          <ClassificationsPanel
            job={job}
            classification={classification}
            bugs={bugs}
            dateFilter={this.dateFilter}
            classificationTypes={classificationTypes}
            repoName={repoName}
            ThRepositoryModel={this.ThRepositoryModel}
          />
        }
        <StatusPanel
          job={job}
        />
        <JobDetailsList
          job={job}
          jobLogUrls={jobLogUrls}
          buildUrl={buildUrl}
        />
      </div>
    );
  }
}

SummaryPanel.propTypes = {
  job: PropTypes.object.isRequired,
  $injector: PropTypes.object.isRequired,
  classificationTypes: PropTypes.object.isRequired,
  repoName: PropTypes.string.isRequired,
  jobLogUrls: PropTypes.array,
  jobDetailLoading: PropTypes.bool,
  classification: PropTypes.object,
  bugs: PropTypes.array,
  buildUrl: PropTypes.string,
};

SummaryPanel.defaultProps = {
  jobLogUrls: [],
  jobDetailLoading: false,
  classification: null,
  bugs: [],
  buildUrl: null,
};

treeherder.component('summaryPanel', react2angular(
  SummaryPanel,
  ['job', 'classificationTypes', 'repoName', 'jobLogUrls', 'jobDetailLoading', 'classification', 'bugs', 'buildUrl'],
  ['$injector']));
