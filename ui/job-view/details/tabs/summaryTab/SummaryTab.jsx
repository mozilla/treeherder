import { useState, useCallback, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Button } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faAngleDown,
  faAngleUp,
  faSpinner,
} from '@fortawesome/free-solid-svg-icons';

import {
  buildFailureSuggestions,
  matchBugSuggestions,
  computeSummaryDivergence,
  isNewFailureLine,
} from '../../../../helpers/testSummary';
import {
  requiredInternalOccurrences,
  thEvents,
} from '../../../../helpers/constants';
import { getResultState, isReftest } from '../../../../helpers/job';
import { getReftestUrl } from '../../../../helpers/url';
import BugFiler from '../../../../shared/BugFiler';
import InternalIssueFiler from '../../../../shared/InternalIssueFiler';
import ListItem from '../../../../shared/tabs/failureSummary/ListItem';
import SuggestionsListItem from '../../../../shared/tabs/failureSummary/SuggestionsListItem';

import SummaryItem from './SummaryItem';

const SummaryTab = ({
  summary = null,
  summaryLoading = false,
  summaryError = null,
  selectedJob,
  jobLogUrls = [],
  jobDetails = [],
  logParseStatus = 'pending',
  logViewerFullUrl = null,
  addBug = null,
  pinJob,
  currentRepo,
  bugSuggestions = null,
  bugSuggestionsLoading = false,
}) => {
  const [isBugFilerOpen, setIsBugFilerOpen] = useState(false);
  const [isInternalIssueFilerOpen, setIsInternalIssueFilerOpen] =
    useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(null);

  const failureSuggestions = useMemo(
    () => buildFailureSuggestions(summary),
    [summary],
  );

  const suggestions = useMemo(
    () => matchBugSuggestions(failureSuggestions, bugSuggestions || []),
    [failureSuggestions, bugSuggestions],
  );

  // Compare the two summaries once both are loaded. When they disagree, the
  // classic Failure Summary is rendered stacked below the summary so no
  // failure line is lost to the reader.
  const divergence = useMemo(
    () =>
      summary && bugSuggestions && !bugSuggestionsLoading
        ? computeSummaryDivergence(failureSuggestions, bugSuggestions)
        : { diverged: false },
    [summary, failureSuggestions, bugSuggestions, bugSuggestionsLoading],
  );

  // New failure lines of the classic failure summary stacked below, flagged
  // exactly as the Failure Summary tab flags them. Only the API's lines carry
  // the data this needs (`failure_new_in_rev` / `counter`).
  const newFailures = useMemo(() => {
    const isNew = (suggestion) =>
      isNewFailureLine(suggestion, currentRepo.name);

    return {
      count: (bugSuggestions || []).filter(isNew).length,
      // Only the first one is flagged with the "NEW" button.
      firstIndex: (bugSuggestions || []).findIndex(isNew),
    };
  }, [bugSuggestions, currentRepo.name]);

  // The classic failure summary is shown whenever the API returned lines.
  // Anything narrower hides data the reader can no longer reach elsewhere:
  // this tab replaced the Failure Summary tab, and a job can have bug
  // suggestions with no summary.jsonl at all (nothing to diverge from).
  const hasClassicLines = !!bugSuggestions?.length;

  // The classic failure summary is folded away by default: it is a second
  // opinion on failures the summary above already lists. When the artifact
  // found nothing, it is the only content there is, so it starts open.
  const summaryIsEmpty = !summaryLoading && suggestions.length === 0;
  const [showClassic, setShowClassic] = useState(summaryIsEmpty);
  const [prevSummaryIsEmpty, setPrevSummaryIsEmpty] = useState(summaryIsEmpty);
  if (summaryIsEmpty !== prevSummaryIsEmpty) {
    // The artifact finished loading (or another job was selected): apply the
    // default again rather than keeping the previous job's fold state.
    setPrevSummaryIsEmpty(summaryIsEmpty);
    setShowClassic(summaryIsEmpty);
  }

  // Number of failing tests (not error lines — a test can emit several).
  const failedCount = summary
    ? Object.values(summary.realFailCounts || {}).reduce((a, b) => a + b, 0)
    : 0;

  const fileBug = useCallback(
    (suggestion) => {
      pinJob(selectedJob);
      setActiveSuggestion(suggestion);
      setIsBugFilerOpen(true);
    },
    [pinJob, selectedJob],
  );

  const fileInternalIssue = useCallback(
    (suggestion) => {
      pinJob(selectedJob);
      setActiveSuggestion(suggestion);
      setIsInternalIssueFilerOpen(true);
    },
    [pinJob, selectedJob],
  );

  // An internal issue filed from the pin board escalates to a real Bugzilla
  // bug once it has been seen enough times. The listener lived in the Failure
  // Summary tab until that tab was removed.
  const checkInternalFailureOccurrences = useCallback(
    (bugInternalId) => {
      const classicSuggestions = bugSuggestions || [];
      const existingBug = classicSuggestions
        .flatMap((s) => s.bugs.open_recent)
        .filter((bug) => bug.id === null)
        .find((bug) => bug.internal_id === bugInternalId);
      if (!existingBug) return;

      if (existingBug.occurrences >= requiredInternalOccurrences - 1) {
        existingBug.occurrences += 1;
        fileBug(
          classicSuggestions.find((s) =>
            s.bugs.open_recent.some(
              (bug) => bug.internal_id === existingBug.internal_id,
            ),
          ),
        );
      }
    },
    [bugSuggestions, fileBug],
  );

  useEffect(() => {
    const onInternalIssueClassification = (event) =>
      checkInternalFailureOccurrences(event.detail.internalBugId);

    window.addEventListener(
      thEvents.internalIssueClassification,
      onInternalIssueClassification,
    );

    return () =>
      window.removeEventListener(
        thEvents.internalIssueClassification,
        onInternalIssueClassification,
      );
  }, [checkInternalFailureOccurrences]);

  const bugFilerCallback = async (data) => {
    await addBug({ id: data.id, newBug: data.id });
    window.dispatchEvent(new CustomEvent(thEvents.saveClassification));
    window.open(data.url);
  };

  const internalIssueFilerCallback = async (data) => {
    await addBug({ ...data, newBug: `i${data.internal_id}` });
    window.dispatchEvent(new CustomEvent(thEvents.saveClassification));
    checkInternalFailureOccurrences(data.internal_id);
  };

  const logs = jobLogUrls.filter(
    (jlu) => !jlu.name.includes('perfherder-data'),
  );
  const jobLogsAllParsed =
    logs.length > 0 && logs.every((jlu) => jlu.parse_status !== 'pending');

  return (
    <div id="summary-tab" role="region" aria-label="Summary">
      {!!summary && (
        <p className="failure-summary-line-empty mb-0">
          <strong>{summary.counts.total}</strong> tests:{' '}
          <span className="text-success">
            {summary.counts.PASS || 0} passed
          </span>
          {', '}
          <span className={failedCount ? 'text-danger' : ''}>
            {failedCount} failed
          </span>
          {', '}
          {/* Always rendered, zero included, so the row keeps one shape. */}
          <span className="text-muted">{summary.counts.SKIP || 0} skipped</span>
        </p>
      )}
      <ul className="list-unstyled w-100 h-100 mb-0 overflow-auto text-small font-size-11">
        {summaryError && <ListItem text={summaryError} />}

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

        {!summaryLoading && !summaryError && suggestions.length === 0 && (
          <ListItem
            text={
              summary
                ? 'No failures found in the summary.'
                : 'No summary artifact for this job.'
            }
          />
        )}
        {suggestions.map((suggestion, index) => (
          <SummaryItem
            key={`${selectedJob.id}-${index}`} // eslint-disable-line react/no-array-index-key
            suggestion={suggestion}
            toggleBugFiler={fileBug}
            toggleInternalIssueFiler={fileInternalIssue}
            selectedJob={selectedJob}
            jobDetails={jobDetails}
            currentRepo={currentRepo}
            anchor={summary?.anchor}
            addBug={addBug}
          />
        ))}
        {hasClassicLines && (
          <li className="border-top mt-2 pt-2">
            <h3 className="font-size-12 mb-0">
              <Button
                variant="link"
                className="failure-summary-line-empty p-0 fw-bold text-decoration-none"
                onClick={() => setShowClassic((prev) => !prev)}
                aria-expanded={showClassic}
                aria-controls="classic-failure-summary"
              >
                <FontAwesomeIcon
                  icon={showClassic ? faAngleUp : faAngleDown}
                  className="me-2"
                />
                Failure Summary (classic)
              </Button>
            </h3>
            <div id="classic-failure-summary">
              {showClassic && (
                <>
                  {divergence.diverged && (
                    <p className="failure-summary-line-empty text-muted mb-0">
                      The classic failure summary below differs from the summary
                      above.
                    </p>
                  )}
                  {newFailures.count > 0 && (
                    <Button
                      className="failure-summary-new-message border-0"
                      title="New Test Failure"
                    >
                      {newFailures.count} new failure line(s). First one is
                      flagged, it might be good to look at all failures in this
                      job.
                    </Button>
                  )}
                  <ul className="list-unstyled w-100 mb-0">
                    {(bugSuggestions || []).map((suggestion, index) => (
                      <SuggestionsListItem
                        key={`classic-${selectedJob.id}-${index}`} // eslint-disable-line react/no-array-index-key
                        index={index}
                        suggestion={suggestion}
                        showNewButton={index === newFailures.firstIndex}
                        toggleBugFiler={() => fileBug(suggestion)}
                        toggleInternalIssueFiler={() =>
                          fileInternalIssue(suggestion)
                        }
                        selectedJob={selectedJob}
                        addBug={addBug}
                        currentRepo={currentRepo}
                        jobDetails={jobDetails}
                      />
                    ))}
                  </ul>
                </>
              )}
            </div>
          </li>
        )}

        {summaryLoading && (
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
          toggle={() => setIsBugFilerOpen(false)}
          suggestion={activeSuggestion}
          suggestions={suggestions}
          fullLog={logs[0]?.url}
          parsedLog={logViewerFullUrl}
          reftestUrl={
            isReftest(selectedJob) && logs[0] ? getReftestUrl(logs[0].url) : ''
          }
          successCallback={bugFilerCallback}
          selectedJob={selectedJob}
          currentRepo={currentRepo}
          platform={selectedJob.platform}
        />
      )}
      {isInternalIssueFilerOpen && (
        <InternalIssueFiler
          isOpen={isInternalIssueFilerOpen}
          suggestion={activeSuggestion}
          toggle={() => setIsInternalIssueFilerOpen(false)}
          jobGroupName={selectedJob.job_group_name}
          jobTypeName={selectedJob.job_type_name}
          successCallback={internalIssueFilerCallback}
        />
      )}
    </div>
  );
};

SummaryTab.propTypes = {
  summary: PropTypes.shape({}),
  summaryLoading: PropTypes.bool,
  summaryError: PropTypes.string,
  selectedJob: PropTypes.shape({}).isRequired,
  jobLogUrls: PropTypes.arrayOf(PropTypes.shape({})),
  jobDetails: PropTypes.arrayOf(PropTypes.shape({})),
  logParseStatus: PropTypes.string,
  logViewerFullUrl: PropTypes.string,
  addBug: PropTypes.func,
  pinJob: PropTypes.func.isRequired,
  currentRepo: PropTypes.shape({}).isRequired,
  bugSuggestions: PropTypes.arrayOf(PropTypes.shape({})),
  bugSuggestionsLoading: PropTypes.bool,
};

export default SummaryTab;
