import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import { connect } from 'react-redux';

import { thEvents } from '../../../../helpers/constants';
import { isReftest } from '../../../../helpers/job';
import { getBugUrl } from '../../../../helpers/url';
import { pinJob, addBug } from '../../../redux/stores/pinnedJobs';
import BugFiler from '../../BugFiler';

import ErrorsList from './ErrorsList';
import ListItem from './ListItem';
import SuggestionsListItem from './SuggestionsListItem';

class FailureSummaryTab extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      isBugFilerOpen: false,
    };
  }

  fileBug = suggestion => {
    const { selectedJobFull, pinJob } = this.props;

    pinJob(selectedJobFull);
    this.setState({
      isBugFilerOpen: true,
      suggestion,
    });
  };

  toggleBugFiler = () => {
    this.setState(prevState => ({ isBugFilerOpen: !prevState.isBugFilerOpen }));
  };

  bugFilerCallback = data => {
    const { addBug } = this.props;

    addBug({ id: data.success });
    window.dispatchEvent(new CustomEvent(thEvents.saveClassification));
    // Open the newly filed bug in a new tab or window for further editing
    window.open(getBugUrl(data.success));
  };

  render() {
    const {
      jobLogUrls,
      logParseStatus,
      suggestions,
      errors,
      logViewerFullUrl,
      bugSuggestionsLoading,
      selectedJobFull,
      reftestUrl,
    } = this.props;
    const { isBugFilerOpen, suggestion } = this.state;
    const logs = jobLogUrls;
    const jobLogsAllParsed = logs.every(jlu => jlu.parse_status !== 'pending');

    return (
      <div className="w-100 h-100" role="region" aria-label="Failure Summary">
        <ul className="list-unstyled failure-summary-list" ref={this.fsMount}>
          {suggestions.map((suggestion, index) => (
            <SuggestionsListItem
              key={index} // eslint-disable-line react/no-array-index-key
              index={index}
              suggestion={suggestion}
              toggleBugFiler={() => this.fileBug(suggestion)}
              selectedJobFull={selectedJobFull}
            />
          ))}

          {!!errors.length && <ErrorsList errors={errors} />}

          {!bugSuggestionsLoading &&
            jobLogsAllParsed &&
            !logs.length &&
            !suggestions.length &&
            !errors.length && <ListItem text="Failure summary is empty" />}

          {!bugSuggestionsLoading &&
            jobLogsAllParsed &&
            !!logs.length &&
            logParseStatus === 'success' && (
              <li>
                <p className="failure-summary-line-empty mb-0">
                  Log parsing complete. Generating bug suggestions.
                  <br />
                  <span>
                    The content of this panel will refresh in 5 seconds.
                  </span>
                </p>
              </li>
            )}

          {!bugSuggestionsLoading &&
            !jobLogsAllParsed &&
            logs.map(jobLog => (
              <li key={jobLog.id}>
                <p className="failure-summary-line-empty mb-0">
                  Log parsing in progress.
                  <br />
                  <a
                    title="Open the raw log in a new window"
                    target="_blank"
                    rel="noopener noreferrer"
                    href={jobLog.url}
                  >
                    The raw log
                  </a>{' '}
                  is available. This panel will automatically recheck every 5
                  seconds.
                </p>
              </li>
            ))}

          {!bugSuggestionsLoading && logParseStatus === 'failed' && (
            <ListItem text="Log parsing failed.  Unable to generate failure summary." />
          )}

          {!bugSuggestionsLoading && logParseStatus === 'skipped-size' && (
            <ListItem text="Log parsing was skipped since the log exceeds the size limit." />
          )}

          {!bugSuggestionsLoading && !logs.length && (
            <ListItem text="No logs available for this job." />
          )}

          {bugSuggestionsLoading && (
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
        </ul>
        {isBugFilerOpen && (
          <BugFiler
            isOpen={isBugFilerOpen}
            toggle={this.toggleBugFiler}
            suggestion={suggestion}
            suggestions={suggestions}
            fullLog={jobLogUrls[0].url}
            parsedLog={logViewerFullUrl}
            reftestUrl={isReftest(selectedJobFull) ? reftestUrl : ''}
            successCallback={this.bugFilerCallback}
            jobGroupName={selectedJobFull.job_group_name}
          />
        )}
      </div>
    );
  }
}

FailureSummaryTab.propTypes = {
  addBug: PropTypes.func.isRequired,
  pinJob: PropTypes.func.isRequired,
  selectedJobFull: PropTypes.shape({}).isRequired,
  suggestions: PropTypes.arrayOf(PropTypes.object),
  errors: PropTypes.arrayOf(PropTypes.object),
  bugSuggestionsLoading: PropTypes.bool,
  jobLogUrls: PropTypes.arrayOf(PropTypes.object),
  logParseStatus: PropTypes.string,
  reftestUrl: PropTypes.string,
  logViewerFullUrl: PropTypes.string,
};

FailureSummaryTab.defaultProps = {
  suggestions: [],
  reftestUrl: null,
  errors: [],
  bugSuggestionsLoading: false,
  jobLogUrls: [],
  logParseStatus: 'pending',
  logViewerFullUrl: null,
};

export default connect(null, { addBug, pinJob })(FailureSummaryTab);
