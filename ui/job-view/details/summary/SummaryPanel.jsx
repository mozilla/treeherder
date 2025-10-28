import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

import JobInfo from '../../../shared/JobInfo';

import ActionBar from './ActionBar';
import ClassificationsPanel from './ClassificationsPanel';
import StatusPanel from './StatusPanel';

class SummaryPanel extends React.PureComponent {
  render() {
    const {
      selectedJobFull,
      latestClassification,
      bugs,
      jobLogUrls,
      jobDetails,
      jobDetailLoading,
      logViewerUrl,
      logViewerFullUrl,
      logParseStatus,
      user,
      currentRepo,
      classificationMap,
    } = this.props;

    const logs = jobLogUrls.filter(
      (log) => !log.name.includes('perfherder-data'),
    );
    const artifacts = jobLogUrls.filter((artifact) =>
      artifact.name.includes('perfherder-data'),
    );
    const logStatus = [
      {
        title: 'Log parsing status',
        value: !logs.length
          ? 'No logs'
          : logs.map((log) => log.parse_status).join(', '),
      },
    ];
    const artifactStatus = [
      {
        title: 'Artifact parsing status',
        value: !artifacts.length ? 'No artifacts' : null,
        subfields: artifacts.length
          ? artifacts.map((artifact) => ({
              name: artifact.name,
              value: artifact.parse_status,
            }))
          : null,
      },
    ];

    return (
      <div
        id="summary-panel"
        role="region"
        aria-label="Summary"
        data-testid="summary-panel"
      >
        <ActionBar
          selectedJobFull={selectedJobFull}
          logParseStatus={logParseStatus}
          currentRepo={currentRepo}
          isTryRepo={currentRepo.is_try_repo}
          jobDetails={jobDetails}
          logViewerUrl={logViewerUrl}
          logViewerFullUrl={logViewerFullUrl}
          jobLogUrls={logs}
          user={user}
        />
        <div id="summary-panel-content">
          {jobDetailLoading && (
            <div className="overlay">
              <div>
                <FontAwesomeIcon
                  icon={faSpinner}
                  pulse
                  className="th-spinner-lg"
                  title="Loading..."
                />
              </div>
            </div>
          )}

          <ul className="list-unstyled">
            {latestClassification && (
              <ClassificationsPanel
                job={selectedJobFull}
                classification={latestClassification}
                classificationMap={classificationMap}
                bugs={bugs}
                currentRepo={currentRepo}
              />
            )}
            <StatusPanel selectedJobFull={selectedJobFull} />
            <JobInfo
              job={selectedJobFull}
              extraFields={[...logStatus, ...artifactStatus]}
              currentRepo={currentRepo}
            />
          </ul>
        </div>
      </div>
    );
  }
}

SummaryPanel.propTypes = {
  bugs: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  user: PropTypes.shape({}).isRequired,
  currentRepo: PropTypes.shape({}).isRequired,
  classificationMap: PropTypes.shape({}).isRequired,
  selectedJobFull: PropTypes.shape({}).isRequired,
  latestClassification: PropTypes.shape({}),
  jobLogUrls: PropTypes.arrayOf(PropTypes.shape({})),
  jobDetails: PropTypes.arrayOf({
    url: PropTypes.string.isRequired,
    value: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
  }),
  jobDetailLoading: PropTypes.bool,
  logParseStatus: PropTypes.string,
  logViewerUrl: PropTypes.string,
  logViewerFullUrl: PropTypes.string,
};

SummaryPanel.defaultProps = {
  latestClassification: null,
  jobLogUrls: [],
  jobDetails: [],
  jobDetailLoading: false,
  logParseStatus: 'pending',
  logViewerUrl: null,
  logViewerFullUrl: null,
};

export default SummaryPanel;
