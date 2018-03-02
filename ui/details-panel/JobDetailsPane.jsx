import PropTypes from 'prop-types';

import treeherder from '../js/treeherder';
import {
  getBugUrl,
  getSlaveHealthUrl,
  getInspectTaskUrl,
  getWorkerExplorerUrl,
  linkifyRevisions,
  getJobSearchStrHref,
} from '../helpers/urlHelper';
import { getStatus, getSearchStr } from "../helpers/jobHelper";
import { toDateStr } from "../helpers/displayHelper";

const ClassificationsPane = (props) => {
  const {
    dateFilter, repoName, ThRepositoryModel,
    classifications, job, classificationTypes, bugs,
  } = props;
  const repo = ThRepositoryModel.getRepo(repoName);
  const repoURLHTML = { __html: linkifyRevisions(classifications[0].text, repo) };
  const failureId = classifications[0].failure_classification_id;
  const iconClass = (failureId === 7 ?
    "fa-star-o" : "fa fa-star") + " star-" + job.result;
  const classificationName = classificationTypes.classifications[failureId];

  return (
    <ul className="list-unstyled content-spacer">
      <li>
        <span title={classificationName.name}>
          <i className={`fa ${iconClass}`} />
          <span className="ml-1">{classificationName.name}</span>
        </span>
        {bugs.length > 0 &&
          <a
            target="_blank"
            rel="noopener"
            href={getBugUrl(bugs[0].bug_id)}
            title={`View bug ${bugs[0].bug_id}`}
          ><em> {bugs[0].bug_id}</em></a>}
      </li>
      {classifications[0].text.length > 0 &&
        <li><em dangerouslySetInnerHTML={repoURLHTML} /></li>
      }
      <li className="revision-comment">
        {dateFilter(classifications[0].created, 'EEE MMM d, H:mm:ss')}
      </li>
      <li className="revision-comment">
        {classifications[0].who}
      </li>
    </ul>
  );
};

const JobStatusPane = (props) => {
  const { job } = props;
  const shadingClass = `result-status-shading-${getStatus(job)}`;

  return (
    <ul className="list-unstyled">
      <li
        id="result-status-pane"
        className={`small ${shadingClass}`}
      >
        <div>
          <label>Result:</label>
          <span> {job.result}</span>
        </div>
        <div>
          <label>State:</label>
          <span> {job.state}</span>
        </div>
      </li>
    </ul>
  );
};


const JobDetailsListItem = (props) => {
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
        timeFields.duration = "Not started (queued for " + duration + ")";
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

    if (job.build_system_type === 'buildbot' && jobLogUrls.length > 0) {
      buildUrl = jobLogUrls[0].buildUrl;
    }
    if (job.job_type_description) {
      iconCircleClass = "fa fa-info-circle";
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
        {!jobLogUrls ?
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

class JobDetailsPane extends React.Component {
  constructor(props) {
    super(props);

    const { $injector } = this.props;
    this.dateFilter = $injector.get('$filter')('date');
    this.ThRepositoryModel = $injector.get('ThRepositoryModel');

    this.state = {
      classifications: [],
      bugs: []
    };
  }

  componentWillReceiveProps(nextProps) {
    this.updateState(nextProps.classifications, { classifications: nextProps.classifications });
    this.updateState(nextProps.bugs, { bugs: nextProps.bugs });
  }

  updateState(propsReceived, stateChanges) {
    if (propsReceived) {
      this.setState(stateChanges);
    }
  }

  render() {
    const {
      jobDetailLoading, job, classificationTypes, repoName,
      jobLogUrls, buildUrl
    } = this.props;
    const { bugs, classifications } = this.state;
    return (
      <div>
        {jobDetailLoading &&
          <div className="overlay">
            <div>
              <span className="fa fa-spinner fa-pulse th-spinner-lg" />
            </div>
          </div>
        }
        {classifications.length > 0 &&
          <ClassificationsPane
            job={job}
            classifications={classifications}
            bugs={bugs}
            dateFilter={this.dateFilter}
            classificationTypes={classificationTypes}
            repoName={repoName}
            ThRepositoryModel={this.ThRepositoryModel}
          />
        }
        <JobStatusPane
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

JobDetailsPane.propTypes = {
  classifications: PropTypes.array,
  bugs: PropTypes.array,
  job: PropTypes.object,
  $injector: PropTypes.object,
  jobLogUrls: PropTypes.array,
  buildUrl: PropTypes.string,
  classificationTypes: PropTypes.object,
  jobDetailLoading: PropTypes.bool,
  repoName: PropTypes.string
};

treeherder.directive('jobDetailsPane', ['reactDirective', '$injector', (reactDirective, $injector) =>
  reactDirective(JobDetailsPane, undefined, {}, { $injector })]);
