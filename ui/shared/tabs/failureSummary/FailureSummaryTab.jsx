import React from 'react';
import PropTypes from 'prop-types';
import { Button } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

import { thBugSuggestionLimit, thEvents } from '../../../helpers/constants';
import { getResultState, isReftest } from '../../../helpers/job';
import { getReftestUrl } from '../../../helpers/url';
import { getUrlParam } from '../../../helpers/location';
import BugFiler from '../../BugFiler';
import BugSuggestionsModel from '../../../models/bugSuggestions';

import ErrorsList from './ErrorsList';
import ListItem from './ListItem';
import SuggestionsListItem from './SuggestionsListItem';

class FailureSummaryTab extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      isBugFilerOpen: false,
      suggestions: [],
      errors: [],
      bugSuggestionsLoading: false,
    };
  }

  componentDidMount() {
    this.loadBugSuggestions();
  }

  componentDidUpdate(prevProps) {
    const { selectedJob } = this.props;

    if (
      !!selectedJob &&
      !!prevProps.selectedJob &&
      selectedJob.id !== prevProps.selectedJob.id
    ) {
      this.loadBugSuggestions();
    }
  }

  fileBug = (suggestion) => {
    const { selectedJob, pinJob, initializeGlean } = this.props;

    // accumulate telemetry on failure classification type
    // submit data when all jobs are counted
    if (!getUrlParam('noTelemetry')) {
      initializeGlean();
    }

    pinJob(selectedJob);
    this.setState({
      isBugFilerOpen: true,
      suggestion,
    });
  };

  toggleBugFiler = () => {
    this.setState((prevState) => ({
      isBugFilerOpen: !prevState.isBugFilerOpen,
    }));
  };

  bugFilerCallback = (data) => {
    const { addBug } = this.props;

    addBug({ id: data.id });
    window.dispatchEvent(new CustomEvent(thEvents.saveClassification));
    // Open the newly filed bug in a new tab or window for further editing
    window.open(data.url);
  };

  loadBugSuggestions = () => {
    const { selectedJob } = this.props;

    if (!selectedJob) {
      return;
    }
    this.setState({ bugSuggestionsLoading: true });
    BugSuggestionsModel.get(selectedJob.id).then(async (suggestions) => {
      suggestions.forEach((suggestion) => {
        const simpleCase = [];

        // HACK: if not a test failure for any test in error set, ignore
        let crashLeak = false;
        if (suggestion.search.startsWith('PROCESS-CRASH')) {
          crashLeak = true;
        }

        if (suggestion.bugs.open_recent.length > 0) {
          suggestion.bugs.open_recent.forEach((bug) => {
            if (bug.summary.endsWith('single tracking bug')) {
              simpleCase.push(bug);
            }
          });
        }
        if (simpleCase.length === 0 && suggestion.bugs.all_others.length > 0) {
          suggestion.bugs.all_others.forEach((bug) => {
            if (bug.summary.endsWith('single tracking bug')) {
              simpleCase.push(bug);
            }
          });
        }

        // HACK: use the simple case if found.
        if (simpleCase.length > 0 && !crashLeak) {
          suggestion.bugs.open_recent = simpleCase;

          // HACK: remove any other bugs, keep this simple.
          suggestion.bugs.all_others = [];
        }

        suggestion.bugs.too_many_open_recent =
          suggestion.bugs.open_recent.length > thBugSuggestionLimit;
        suggestion.bugs.too_many_all_others =
          suggestion.bugs.all_others.length > thBugSuggestionLimit;
        suggestion.valid_open_recent =
          suggestion.bugs.open_recent.length > 0 &&
          !suggestion.bugs.too_many_open_recent;
        suggestion.valid_all_others =
          suggestion.bugs.all_others.length > 0 &&
          !suggestion.bugs.too_many_all_others &&
          // If we have too many open_recent bugs, we're unlikely to have
          // relevant all_others bugs, so don't show them either.
          !suggestion.bugs.too_many_open_recent;
      });

      this.setState({ bugSuggestionsLoading: false, suggestions }, () => {
        const scrollArea = document.querySelector(
          '#failure-summary-scroll-area',
        );

        if (scrollArea.scrollTo) {
          scrollArea.scrollTo(0, 0);
          window.getSelection().removeAllRanges();
        }
      });
    });
  };

  render() {
    const {
      jobLogUrls,
      logParseStatus,
      logViewerFullUrl,
      selectedJob,
      addBug,
      updatePinnedJob,
      repoName,
      developerMode,
    } = this.props;
    const {
      isBugFilerOpen,
      suggestion,
      bugSuggestionsLoading,
      suggestions,
      errors,
    } = this.state;
    const logs = jobLogUrls;
    const jobLogsAllParsed =
      logs.length > 0 && logs.every((jlu) => jlu.parse_status !== 'pending');

    selectedJob.newFailure = 0;
    suggestions.forEach((suggestion) => {
      suggestion.showNewButton = false;
      // small hack here to use counter==0 and try for display only
      if (
        suggestion.search.split(' | ').length === 3 &&
        (suggestion.failure_new_in_rev === true ||
          (suggestion.counter === 0 && repoName === 'try'))
      ) {
        if (selectedJob.newFailure === 0) {
          suggestion.showNewButton = true;
        }
        selectedJob.newFailure++;
      }
    });

    if (selectedJob.newFailure > 0) {
      updatePinnedJob(selectedJob);
    }

    return (
      <div className="w-100 h-100" role="region" aria-label="Failure Summary">
        <ul
          className={`${
            !developerMode && 'font-size-11'
          } list-unstyled w-100 h-100 mb-0 overflow-auto text-small`}
          ref={this.fsMount}
          id="failure-summary-scroll-area"
        >
          {selectedJob.newFailure > 0 && (
            <Button className="btn-orange" outline title="New Test Failure">
              {selectedJob.newFailure} new failure line(s). First one is
              flagged, it might be good to look at all failures in this job.
            </Button>
          )}

          {suggestions.map((suggestion, index) => (
            <SuggestionsListItem
              key={`${selectedJob.id}-${index}`} // eslint-disable-line react/no-array-index-key
              index={index}
              suggestion={suggestion}
              toggleBugFiler={() => this.fileBug(suggestion)}
              selectedJob={selectedJob}
              addBug={addBug}
              repoName={repoName}
              developerMode={developerMode}
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
            fullLog={jobLogUrls[0].url}
            parsedLog={logViewerFullUrl}
            reftestUrl={
              isReftest(selectedJob) ? getReftestUrl(jobLogUrls[0].url) : ''
            }
            successCallback={this.bugFilerCallback}
            jobGroupName={selectedJob.job_group_name}
            jobTypeName={selectedJob.job_type_name}
          />
        )}
      </div>
    );
  }
}

FailureSummaryTab.propTypes = {
  selectedJob: PropTypes.shape({}).isRequired,
  jobLogUrls: PropTypes.arrayOf(PropTypes.object),
  logParseStatus: PropTypes.string,
  logViewerFullUrl: PropTypes.string,
  repoName: PropTypes.string.isRequired,
  addBug: PropTypes.func,
  pinJob: PropTypes.func,
  updatePinnedJob: PropTypes.func,
  developerMode: PropTypes.bool,
  initializeGlean: PropTypes.func.isRequired,
};

FailureSummaryTab.defaultProps = {
  jobLogUrls: [],
  logParseStatus: 'pending',
  logViewerFullUrl: null,
  addBug: null,
  pinJob: null,
  updatePinnedJob: null,
  developerMode: false,
};

export default FailureSummaryTab;
