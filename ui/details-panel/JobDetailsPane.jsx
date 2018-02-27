import PropTypes from 'prop-types';

import treeherder from '../js/treeherder';
import { getBugUrl, getSlaveHealthUrl, getInspectTaskUrl, getWorkerExplorerUrl } from '../helpers/urlHelper';

const ClassificationsPane = (props) => {
  const {
    linkifyURLsFilter, linkifyClassificationsFilter, dateFilter, repoName,
    classifications, job, classificationTypes, bugs, getBugUrl
  } = props;
  const filterClassificationsText = (text) => {
    const url = linkifyURLsFilter(text);
    return linkifyClassificationsFilter(url, repoName);
  };
  const repoURLHTML = { __html: filterClassificationsText(classifications[0].text) };
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
  const { resultStatusShading, job } = props;

  return (
    <ul className="list-unstyled">
      <li
        id="result-status-pane"
        className={`small ${resultStatusShading}`}
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

    this.filterTextEvent = this.filterTextEvent.bind(this);

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
    const { job, getSlaveHealthUrl, getWorkerExplorerUrl } = props;
    const { build_system_type, machine_name } = job;
    const machineUrl = (machine_name !== 'unknown' && build_system_type === 'buildbot') ?
      getSlaveHealthUrl(machine_name) :
      getWorkerExplorerUrl(job.taskcluster_metadata.task_id);

    return machineUrl;
  }

  filterTextEvent(event, input) {
    event.preventDefault();
    this.props.filterByJobSearchStr(input);
  }

  render() {
    const {
      job, jobLogUrls, jobSearchSignatureHref, jobSearchSignature,
      jobSearchStrHref, jobSearchStr, getInspectTaskUrl, visibleFields,
      visibleTimeFields
    } = this.props;
    const jobMachineName = job.machine_name;
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
          labelHref={jobSearchSignatureHref}
          labelOnclick={event => this.filterTextEvent(event, jobSearchSignature)}
          labelText="(sig)"
          title="Filter jobs containing these keywords"
          href={jobSearchStrHref}
          onclick={event => this.filterTextEvent(event, jobSearchStr)}
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
            label="Task:" text={job.taskcluster_metadata.task_id}
            href={getInspectTaskUrl(job.taskcluster_metadata.task_id)}
            target="_blank"
          />
        }
        {visibleFields &&
          Object.keys(visibleFields).map(keyName => (
            <JobDetailsListItem
              key={keyName}
              label={`${keyName}:`}
              title="Open build directory in a new tab"
              href={buildUrl}
              target="_blank"
              text={visibleFields[keyName]}
              iconClass={iconCircleClass}
            />
          ))
        }
        {visibleTimeFields && <span>
          <JobDetailsListItem
            label="Requested:"
            text={visibleTimeFields.requestTime}
          />
          {visibleTimeFields.startTime &&
            <JobDetailsListItem
              label="Started:"
              text={visibleTimeFields.startTime}
            />
          }
          {visibleTimeFields.endTime &&
            <JobDetailsListItem
              label="Ended:"
              text={visibleTimeFields.endTime}
            />
          }
          <JobDetailsListItem
            label="Duration:"
            text={visibleTimeFields.duration}
          />
        </span>}
        {!jobLogUrls ?
          <JobDetailsListItem label="Log parsing status: " text="No logs" /> :
          jobLogUrls.map(data => (
            <JobDetailsListItem
              label="Log parsing status: "
              text={data.parse_status} key={data}
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
    this.linkifyURLsFilter = $injector.get('$filter')('linkifyURLs');
    this.linkifyClassificationsFilter = $injector.get('$filter')('linkifyClassifications');

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
      jobDetailLoading, job, getBugUrl, classificationTypes, repoName,
      resultStatusShading, getSlaveHealthUrl, getWorkerExplorerUrl, jobSearchSignatureHref,
      jobSearchSignature, filterByJobSearchStr, jobSearchStrHref, jobSearchStr,
      visibleTimeFields, jobLogUrls, getInspectTaskUrl, visibleFields,
      buildUrl
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
            linkifyURLsFilter={this.linkifyURLsFilter}
            linkifyClassificationsFilter={this.linkifyClassificationsFilter}
            classificationTypes={classificationTypes}
            repoName={repoName}
          />
        }
        <JobStatusPane
          job={job}
          resultStatusShading={resultStatusShading}
        />
        <JobDetailsList
          job={job}
          jobSearchSignatureHref={jobSearchSignatureHref}
          jobSearchSignature={jobSearchSignature}
          filterByJobSearchStr={filterByJobSearchStr}
          jobSearchStrHref={jobSearchStrHref}
          jobSearchStr={jobSearchStr}
          visibleTimeFields={visibleTimeFields}
          jobLogUrls={jobLogUrls}
          visibleFields={visibleFields}
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
  resultStatusShading: PropTypes.string,
  $injector: PropTypes.object,
  jobSearchSignatureHref: PropTypes.string,
  jobSearchSignature: PropTypes.string,
  filterByJobSearchStr: PropTypes.func,
  jobSearchStrHref: PropTypes.string,
  jobSearchStr: PropTypes.string,
  visibleTimeFields: PropTypes.object,
  jobLogUrls: PropTypes.array,
  visibleFields: PropTypes.object,
  buildUrl: PropTypes.string,
  classificationTypes: PropTypes.object,
  jobDetailLoading: PropTypes.bool,
  repoName: PropTypes.string
};

treeherder.directive('jobDetailsPane', ['reactDirective', '$injector', (reactDirective, $injector) =>
  reactDirective(JobDetailsPane, undefined, {}, { $injector })]);
