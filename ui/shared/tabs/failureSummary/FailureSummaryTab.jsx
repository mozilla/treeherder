import React from 'react';
import PropTypes from 'prop-types';
import { Button } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

import {
  thEvents,
  requiredInternalOccurrences,
} from '../../../helpers/constants';
import { getResultState, isReftest } from '../../../helpers/job';
import { getReftestUrl } from '../../../helpers/url';
import BugFiler from '../../BugFiler';
import InternalIssueFiler from '../../InternalIssueFiler';

import ErrorsList from './ErrorsList';
import ListItem from './ListItem';
import SuggestionsListItem from './SuggestionsListItem';

class FailureSummaryTab extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      isBugFilerOpen: false,
      isInternalIssueFilerOpen: false,
      errors: [],
    };
  }

  componentDidMount() {
    window.addEventListener(
      thEvents.internalIssueClassification,
      this.handleInternalIssueClassification,
    );
  }

  componentWillUnmount() {
    window.removeEventListener(
      thEvents.internalIssueClassification,
      this.handleInternalIssueClassification,
    );
  }

  handleInternalIssueClassification = (event) => {
    this.checkInternalFailureOccurrences(event.detail.internalBugId);
  };

  componentDidUpdate(prevProps) {
    const { bugSuggestions } = this.props;

    if (bugSuggestions !== prevProps.bugSuggestions) {
      // Fresh suggestions arrived (job change or refresh): reset the reading
      // position. Guarded — the data now loads in the background, even while
      // this tab's panel is not mounted in the DOM.
      const scrollArea = document.querySelector('#failure-summary-scroll-area');

      if (scrollArea?.scrollTo) {
        scrollArea.scrollTo(0, 0);
        window.getSelection().removeAllRanges();
      }
    }
  }

  fileBug = (suggestion) => {
    const { selectedJob, pinJob } = this.props;

    pinJob(selectedJob);
    this.setState({
      isBugFilerOpen: true,
      suggestion,
    });
  };

  fileInternalIssue = (suggestion) => {
    const { selectedJob, pinJob } = this.props;

    pinJob(selectedJob);
    this.setState({
      isInternalIssueFilerOpen: true,
      suggestion,
    });
  };

  toggleBugFiler = () => {
    this.setState((prevState) => ({
      isBugFilerOpen: !prevState.isBugFilerOpen,
    }));
  };

  toggleInternalIssueFiler = () => {
    this.setState((prevState) => ({
      isInternalIssueFilerOpen: !prevState.isInternalIssueFilerOpen,
    }));
  };

  bugFilerCallback = async (data) => {
    const { addBug } = this.props;

    await addBug({ id: data.id, newBug: data.id });
    window.dispatchEvent(new CustomEvent(thEvents.saveClassification));
    // Open the newly filed bug in a new tab or window for further editing
    window.open(data.url);
  };

  checkInternalFailureOccurrences = (bugInternalId) => {
    // Try matching an internal bug already fetched with enough occurences
    const suggestions = this.props.bugSuggestions || [];

    const internalBugs = suggestions
      .flatMap((s) => s.bugs.open_recent)
      .filter((bug) => bug.id === null);
    const existingBug = internalBugs.filter(
      (bug) => bug.internal_id === bugInternalId,
    )[0];
    if (!existingBug) {
      return;
    }
    const suggestion = suggestions.find((s) =>
      s.bugs.open_recent
        .map((bug) => bug.internal_id)
        .includes(existingBug.internal_id),
    );
    // Check if we reached the required number of occurrence to open a bug in Bugzilla
    if (existingBug.occurrences >= requiredInternalOccurrences - 1) {
      existingBug.occurrences += 1;
      this.fileBug(suggestion);
    }
  };

  internalIssueFilerCallback = async (data) => {
    const { addBug } = this.props;

    await addBug({ ...data, newBug: `i${data.internal_id}` });
    window.dispatchEvent(new CustomEvent(thEvents.saveClassification));

    this.checkInternalFailureOccurrences(data.internal_id);
  };

  render() {
    const {
      jobLogUrls = [],
      jobDetails = [],
      logParseStatus = 'pending',
      logViewerFullUrl = null,
      selectedJob,
      addBug = null,
      currentRepo,
      developerMode = false,
      bugSuggestions = null,
      bugSuggestionsLoading = false,
    } = this.props;
    const { isBugFilerOpen, isInternalIssueFilerOpen, suggestion, errors } =
      this.state;
    const suggestions = bugSuggestions || [];
    const logs = jobLogUrls.filter(
      (jlu) => !jlu.name.includes('perfherder-data'),
    );
    const jobLogsAllParsed =
      logs.length > 0 && logs.every((jlu) => jlu.parse_status !== 'pending');

    // A "new failure" line has a three-part `search` and is either flagged new
    // in the revision, or (on try) has never been seen before (counter === 0).
    // Derived at render time rather than mutated onto the props so render stays
    // a pure function of props/state.
    const isNewFailureLine = (candidate) =>
      candidate.search.split(' | ').length === 3 &&
      (candidate.failure_new_in_rev === true ||
        (candidate.counter === 0 && currentRepo.name === 'try'));

    const newFailureCount = suggestions.filter(isNewFailureLine).length;
    // Only the first new-failure line is flagged with the "NEW" button.
    const firstNewFailureIndex = suggestions.findIndex(isNewFailureLine);

    return (
      <div className="w-100 h-100" role="region" aria-label="Failure Summary">
        <ul
          className={`${
            !developerMode && 'font-size-11'
          } list-unstyled w-100 h-100 mb-0 overflow-auto text-small`}
          ref={this.fsMount}
          id="failure-summary-scroll-area"
        >
          {newFailureCount > 0 && (
            <Button
              className="failure-summary-new-message border-0"
              title="New Test Failure"
            >
              {newFailureCount} new failure line(s). First one is flagged, it
              might be good to look at all failures in this job.
            </Button>
          )}

          {suggestions.map((suggestion, index) => (
            <SuggestionsListItem
              key={`${selectedJob.id}-${index}`} // eslint-disable-line react/no-array-index-key
              index={index}
              suggestion={suggestion}
              showNewButton={index === firstNewFailureIndex}
              toggleBugFiler={() => this.fileBug(suggestion)}
              toggleInternalIssueFiler={() =>
                this.fileInternalIssue(suggestion)
              }
              selectedJob={selectedJob}
              addBug={addBug}
              currentRepo={currentRepo}
              developerMode={developerMode}
              jobDetails={jobDetails}
            />
          ))}

          {!!errors.length && <ErrorsList errors={errors} />}

          {!jobLogsAllParsed && <ListItem text="Log parsing not complete" />}

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
            logs.map((jobLog) => (
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
            <ListItem
              text={`No logs yet available for this ${getResultState(
                selectedJob,
              )} job.`}
            />
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
            fullLog={logs[0].url}
            parsedLog={logViewerFullUrl}
            reftestUrl={
              isReftest(selectedJob) ? getReftestUrl(logs[0].url) : ''
            }
            successCallback={this.bugFilerCallback}
            selectedJob={selectedJob}
            currentRepo={currentRepo}
            platform={selectedJob.platform}
          />
        )}

        {isInternalIssueFilerOpen && (
          <InternalIssueFiler
            isOpen={isInternalIssueFilerOpen}
            suggestion={suggestion}
            toggle={this.toggleInternalIssueFiler}
            jobGroupName={selectedJob.job_group_name}
            jobTypeName={selectedJob.job_type_name}
            successCallback={this.internalIssueFilerCallback}
          />
        )}
      </div>
    );
  }
}

FailureSummaryTab.propTypes = {
  selectedJob: PropTypes.shape({}).isRequired,
  bugSuggestions: PropTypes.arrayOf(PropTypes.shape({})),
  bugSuggestionsLoading: PropTypes.bool,
  jobLogUrls: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.number,
      job_id: PropTypes.number,
      name: PropTypes.string.isRequired,
      url: PropTypes.string.isRequired,
      parse_status: PropTypes.string,
    }),
  ),
  jobDetails: PropTypes.arrayOf(
    PropTypes.shape({
      url: PropTypes.string.isRequired,
      value: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired,
    }),
  ),
  logParseStatus: PropTypes.string,
  logViewerFullUrl: PropTypes.string,
  currentRepo: PropTypes.shape({}).isRequired,
  addBug: PropTypes.func,
  pinJob: PropTypes.func,
  developerMode: PropTypes.bool,
};

export default FailureSummaryTab;
