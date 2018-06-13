import React from 'react';
import PropTypes from 'prop-types';

import { getSearchStr, getTimeFields, getJobMachineUrl } from '../../../helpers/job';
import { getInspectTaskUrl, getJobSearchStrHref } from '../../../helpers/url';

import ActionBar from './ActionBar';
import ClassificationsPanel from './ClassificationsPanel';
import StatusPanel from './StatusPanel';

export default class SummaryPanel extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      machineUrl: ''
    };
  }

  componentWillReceiveProps(nextProps) {
    if (!nextProps.selectedJob || !Object.keys(nextProps.selectedJob).length) {
      return;
    }

    this.setJobMachineUrl(nextProps);
  }

  async setJobMachineUrl(props) {
    let machineUrl = null;

    try {
      machineUrl = await getJobMachineUrl(props);
    } catch (err) {
      machineUrl = '';
    }

    if (this.state.machineUrl !== machineUrl) {
      this.setState({ machineUrl });
    }
  }

  render() {
    const {
      repoName, selectedJob, latestClassification, bugs, jobLogUrls,
      jobDetailLoading, buildUrl, logViewerUrl, logViewerFullUrl, isTryRepo, logParseStatus,
      pinJob, $injector, user,
    } = this.props;

    const timeFields = getTimeFields(selectedJob);
    const jobMachineName = selectedJob.machine_name;
    const jobSearchStr = getSearchStr(selectedJob);
    let iconCircleClass = null;

    const buildDirectoryUrl = (selectedJob.build_system_type === 'buildbot' && !!jobLogUrls.length) ?
      jobLogUrls[0].buildUrl : buildUrl;

    if (selectedJob.job_type_description) {
      iconCircleClass = 'fa fa-info-circle';
    }

    return (
      <div id="summary-panel">
        <ActionBar
          repoName={repoName}
          selectedJob={selectedJob}
          logParseStatus={logParseStatus}
          isTryRepo={isTryRepo}
          logViewerUrl={logViewerUrl}
          logViewerFullUrl={logViewerFullUrl}
          jobLogUrls={jobLogUrls}
          pinJob={pinJob}
          $injector={$injector}
          user={user}
        />
        <div id="summary-panel-content">
          <div>
            {jobDetailLoading &&
              <div className="overlay">
                <div>
                  <span className="fa fa-spinner fa-pulse th-spinner-lg" />
                </div>
              </div>
            }

            <ul className="list-unstyled">
              {latestClassification &&
                <ClassificationsPanel
                  job={selectedJob}
                  classification={latestClassification}
                  bugs={bugs}
                  repoName={repoName}
                  $injector={$injector}
                />}
              <StatusPanel selectedJob={selectedJob} />
              <div>
                <li className="small">
                  <label title="">Job</label>
                  <a
                    title="Filter jobs with this unique SHA signature"
                    href={getJobSearchStrHref(selectedJob.signature)}
                  >(sig)</a>:&nbsp;
                  <a
                    title="Filter jobs containing these keywords"
                    href={getJobSearchStrHref(jobSearchStr)}
                  >{jobSearchStr}</a>
                </li>
                {jobMachineName &&
                  <li className="small">
                    <label>Machine: </label>
                    <a
                      title="Inspect machine"
                      target="_blank"
                      href={this.state.machineUrl}
                    >{jobMachineName}</a>
                  </li>
                }
                {selectedJob.taskcluster_metadata &&
                  <li className="small">
                    <label>Task: </label>
                    <a
                      href={getInspectTaskUrl(selectedJob.taskcluster_metadata.task_id)}
                      target="_blank"
                    >{selectedJob.taskcluster_metadata.task_id}</a>
                  </li>
                }
                <li className="small">
                  <label>Build: </label>
                  <a
                    title="Open build directory in a new tab"
                    href={buildUrl}
                    target="_blank"
                  >{`${selectedJob.build_architecture} ${selectedJob.build_platform} ${selectedJob.build_os || ''}`}</a>
                  <span className={`ml-1${iconCircleClass}`} />
                </li>
                <li className="small">
                  <label>Job name: </label>
                  <a
                    title="Open build directory in a new tab"
                    href={buildDirectoryUrl}
                    target="_blank"
                  >{selectedJob.job_type_name}</a>
                  <span className={`ml-1${iconCircleClass}`} />
                </li>
                {timeFields && <span>
                  <li className="small">
                    <label>Requested: </label>{timeFields.requestTime}
                  </li>
                  {timeFields.startTime && <li className="small">
                    <label>Started: </label>{timeFields.startTime}
                  </li>}
                  {timeFields.endTime && <li className="small">
                    <label>Ended: </label>{timeFields.endTime}
                  </li>}
                  <li className="small">
                    <label>Duration: </label>{timeFields.duration}
                  </li>
                </span>}
                {!jobLogUrls.length ?
                  <li className="small"><label>Log parsing status: </label>No logs</li> :
                  jobLogUrls.map(data => (
                    <li className="small" key={data}>
                      <label>Log parsing status: </label>{data.parse_status}
                    </li>
                  ))
                }
              </div>
            </ul>
          </div>
        </div>
      </div>
    );
  }
}

SummaryPanel.propTypes = {
  repoName: PropTypes.string.isRequired,
  pinJob: PropTypes.func.isRequired,
  bugs: PropTypes.array.isRequired,
  $injector: PropTypes.object.isRequired,
  user: PropTypes.object.isRequired,
  selectedJob: PropTypes.object,
  latestClassification: PropTypes.object,
  jobLogUrls: PropTypes.array,
  jobDetailLoading: PropTypes.bool,
  buildUrl: PropTypes.string,
  logParseStatus: PropTypes.string,
  isTryRepo: PropTypes.bool,
  logViewerUrl: PropTypes.string,
  logViewerFullUrl: PropTypes.string,
};

SummaryPanel.defaultProps = {
  selectedJob: null,
  latestClassification: null,
  jobLogUrls: [],
  jobDetailLoading: false,
  buildUrl: null,
  logParseStatus: 'pending',
  isTryRepo: true,
  logViewerUrl: null,
  logViewerFullUrl: null,
};
