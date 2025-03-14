import React from 'react';
import PropTypes from 'prop-types';
import { Button } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

import {
  thBugSuggestionLimit,
  thEvents,
  requiredInternalOcurrences,
} from '../../../helpers/constants';
import { getResultState, isReftest } from '../../../helpers/job';
import { getReftestUrl } from '../../../helpers/url';
import BugFiler from '../../BugFiler';
import InternalIssueFiler from '../../InternalIssueFiler';
import BugSuggestionsModel from '../../../models/bugSuggestions';

import ErrorsList from './ErrorsList';
import ListItem from './ListItem';
import SuggestionsListItem from './SuggestionsListItem';

class FailureSummaryTab extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      isBugFilerOpen: false,
      isInternalIssueFilerOpen: false,
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
      suggestion: suggestion,
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

  bugFilerCallback = (data) => {
    const { addBug } = this.props;

    addBug({ id: data.id, newBug: data.id });
    window.dispatchEvent(new CustomEvent(thEvents.saveClassification));
    // Open the newly filed bug in a new tab or window for further editing
    window.open(data.url);
  };

  internalIssueFilerCallback = async (data) => {
    const { addBug } = this.props;
    const { suggestion, suggestions } = this.state;

    await addBug({ ...data, newBug: `i${data.internal_id}` });
    window.dispatchEvent(new CustomEvent(thEvents.saveClassification));

    // Try matching an internal bug already fetched with enough occurences
    const internalBugs = suggestions
      .map((s) => s.bugs.open_recent)
      .flat()
      .filter((bug) => bug.id === null);
    const existingBug = internalBugs.filter(
      (bug) => bug.internal_id === data.internal_id,
    )[0];
    if (existingBug && existingBug.occurrences >= requiredInternalOcurrences) {
      this.fileBug(suggestion);
    }
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

        let isPerfTest = false;
        if (
          suggestion.search.includes('browser/base/content/test/performance')
        ) {
          isPerfTest = true;
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
        if (simpleCase.length > 0 && !isPerfTest && !crashLeak) {
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
      currentRepo,
      developerMode,
    } = this.props;
    const {
      isBugFilerOpen,
      isInternalIssueFilerOpen,
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
          (suggestion.counter === 0 && currentRepo.name === 'try'))
      ) {
        if (selectedJob.newFailure === 0) {
          suggestion.showNewButton = true;
        }
        selectedJob.newFailure++;
      }
    });

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
            <Button
              className="failure-summary-new-message"
              outline
              title="New Test Failure"
            >
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
              toggleInternalIssueFiler={() =>
                this.fileInternalIssue(suggestion)
              }
              selectedJob={selectedJob}
              addBug={addBug}
              currentRepo={currentRepo}
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
  jobLogUrls: PropTypes.arrayOf({
    id: PropTypes.number.isRequired,
    job_id: PropTypes.number.isRequired,
    name: PropTypes.string.isRequired,
    url: PropTypes.string.isRequired,
    parse_status: PropTypes.string.isRequired,
  }),
  logParseStatus: PropTypes.string,
  logViewerFullUrl: PropTypes.string,
  currentRepo: PropTypes.shape({}).isRequired,
  addBug: PropTypes.func,
  pinJob: PropTypes.func,
  developerMode: PropTypes.bool,
};

FailureSummaryTab.defaultProps = {
  jobLogUrls: [],
  logParseStatus: 'pending',
  logViewerFullUrl: null,
  addBug: null,
  pinJob: null,
  developerMode: false,
};

export default FailureSummaryTab;
